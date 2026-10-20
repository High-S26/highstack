import { analyse as rechne } from "@highstack/engine";
import { regelpruefung } from "./compliance";
import { TEAM_KERN } from "./experten";
import { neuerVerbrauch, type Verbrauch } from "./llm";
import { eingabeHash, fuehreAus, type Laufoptionen } from "./runtime";
import type { Bericht, Compliancebefund, Komiteeurteil, Kurzurteil } from "./schemas";

export interface Gespeichert { ergebnis: unknown; schritte: string[]; hash?: string }
export interface Teamergebnis {
  uebersprungen?: string;
  berichte: Record<string, { ergebnis: Bericht; schritte: string[]; hash: string; ausSpeicher: boolean } | { fehler: string }>;
  komitee: { ergebnis: Komiteeurteil; schritte: string[]; hash: string; ausSpeicher: boolean } | null;
  compliance: (Compliancebefund & { quelle: "regeln" | "modell" }) | null;
  verbrauch: Verbrauch;
}

/** Kurzfassung eines Berichts für Komitee und Folgeexperten. */
export const kurz = (b: Bericht) => ({ kernaussage: b.kernaussage, bewertung: b.bewertung, kennzahlen: b.kennzahlen?.slice(0, 6), abschnitte: b.abschnitte?.map(a => ({ titel: a.titel, punkte: a.punkte.slice(0, 5) })), fragen: b.fragen?.slice(0, 6) });

async function mitBegrenzung<T>(aufgaben: (() => Promise<T>)[], gleichzeitig: number, signal?: AbortSignal) {
  const ergebnisse: T[] = new Array(aufgaben.length); let i = 0;
  const worker = async () => { while (i < aufgaben.length && !signal?.aborted) { const j = i++; ergebnisse[j] = await aufgaben[j]!(); } };
  await Promise.all(Array.from({ length: Math.max(1, gleichzeitig) }, worker));
  return ergebnisse;
}

/** Führt einen Experten aus oder nimmt das gespeicherte Ergebnis, wenn sich die Eingaben nicht geändert haben. */
export async function mitSpeicher<T>(id: string, o: Laufoptionen, vorhanden?: Gespeichert, auftrag?: string): Promise<{ ergebnis: T; schritte: string[]; hash: string; ausSpeicher: boolean }> {
  const hash = await eingabeHash(id, o);
  if (vorhanden?.hash === hash) {
    o.onEreignis?.({ typ: "fertig", experte: id, ergebnis: vorhanden.ergebnis, schritte: vorhanden.schritte, ausSpeicher: true });
    return { ergebnis: vorhanden.ergebnis as T, schritte: vorhanden.schritte, hash, ausSpeicher: true };
  }
  const r = await fuehreAus<T>(id, o, auftrag);
  return { ...r, hash, ausSpeicher: false };
}

/** Stufe 1: ein Aufruf, erste Einschätzung. */
export function kurzurteil(o: Laufoptionen, vorhanden?: Gespeichert) {
  return mitSpeicher<Kurzurteil>("kurzurteil", o, vorhanden);
}

/** Wann ein Teamlauf ohne ausdrücklichen Wunsch nicht startet. */
export function teamlaufNoetig(o: Pick<Laufoptionen, "eingabe" | "analyse" | "dokumente">): { noetig: boolean; grund?: string } {
  const a = o.analyse ?? rechne(o.eingabe);
  const module = Object.keys(o.eingabe.module ?? {}).length > 0;
  const unterlagen = (o.dokumente?.liste() ?? []).some(d => d.status !== "offen");
  if (a.bewertung.einstufung === "pass" && !module && !unterlagen) return { noetig: false, grund: `Einstufung Pass: ${a.bewertung.hinweise.filter(h => h.art === "crit").map(h => h.text).slice(0, 2).join(" ") || "das Objekt passt nicht zum Anlageprofil."} Ein Teamlauf ändert an den Zahlen nichts; sinnvoll erst mit Gestaltung, Unterlagen oder einem anderen Preis.` };
  return { noetig: true };
}

/**
 * Stufe 3, Teamlauf: Dokumentprüfer zuerst (falls Unterlagen), dann Fachexperten parallel mit seinen Befunden,
 * Projektentwickler bei Gestaltung, Komitee, Compliance per Regeln (Modell nur bei Treffern).
 */
export async function teamlauf(o: Laufoptionen & { gleichzeitig?: number; erzwingen?: boolean; vorhanden?: Record<string, Gespeichert> }): Promise<Teamergebnis> {
  const verbrauch = o.verbrauch ?? neuerVerbrauch();
  const a = o.analyse ?? rechne(o.eingabe);
  const opts: Laufoptionen = { ...o, analyse: a, verbrauch };
  const leer: Teamergebnis = { berichte: {}, komitee: null, compliance: null, verbrauch };
  if (!o.erzwingen) { const g = teamlaufNoetig(opts); if (!g.noetig) return { ...leer, uebersprungen: g.grund }; }
  const berichte: Teamergebnis["berichte"] = {};
  const lauf = async (id: string, zusatz?: Record<string, unknown>) => {
    try { berichte[id] = await mitSpeicher<Bericht>(id, { ...opts, zusatz: { ...(opts.zusatz ?? {}), ...(zusatz ?? {}) } }, o.vorhanden?.[id]); }
    catch (e) { if (o.signal?.aborted) throw e; berichte[id] = { fehler: (e as Error).message }; }
  };
  let befunde: Record<string, unknown> | undefined;
  if ((o.dokumente?.liste() ?? []).some(d => d.status !== "offen")) {
    await lauf("dokumentpruefer");
    const d = berichte.dokumentpruefer; if (d && "ergebnis" in d) befunde = { befundeUnterlagen: kurz(d.ergebnis) };
  }
  const team: string[] = [...TEAM_KERN];
  if (Object.keys(o.eingabe.module ?? {}).length) team.push("projektentwickler");
  await mitBegrenzung(team.map(id => () => lauf(id, befunde)), o.gleichzeitig ?? 3, o.signal);
  const fertig = Object.fromEntries(Object.entries(berichte).sort(([x], [y]) => x.localeCompare(y)).filter(([, v]) => "ergebnis" in v).map(([k, v]) => [k, kurz((v as { ergebnis: Bericht }).ergebnis)]));
  if (!Object.keys(fertig).length) return { ...leer, berichte };
  const komitee = await mitSpeicher<Komiteeurteil>("komitee", { ...opts, zusatz: { berichteDerExperten: fertig } }, o.vorhanden?.komitee, "Die Fachexperten haben berichtet (berichteDerExperten). Prüfe ihre Befunde gegeneinander, rechne nur Strittiges nach und fälle das Urteil.");
  const regeln = regelpruefung({ ...Object.fromEntries(Object.entries(berichte).filter(([, v]) => "ergebnis" in v).map(([k, v]) => [k, (v as { ergebnis: Bericht }).ergebnis])), komitee: komitee.ergebnis });
  let compliance: Teamergebnis["compliance"] = { ...regeln, quelle: "regeln" };
  if (!regeln.freigabe) {
    try {
      const r = await fuehreAus<Compliancebefund>("compliance", { ...opts, zusatz: { regeltreffer: regeln.beanstandungen, pruefgegenstand: { berichte: fertig, komitee: komitee.ergebnis } } }, "Die Regelprüfung hat Treffer gemeldet (regeltreffer). Prüfe, ob sie berechtigt sind, und formuliere Korrekturen.");
      compliance = { ...r.ergebnis, quelle: "modell" };
    } catch { /* Regelbefund bleibt bestehen */ }
  }
  return { berichte, komitee, compliance, verbrauch };
}
