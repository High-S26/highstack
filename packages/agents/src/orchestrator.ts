import { analyse as rechne } from "@highstack/engine";
import { TEAM_KERN } from "./experten";
import { fuehreAus, type Laufoptionen } from "./runtime";
import type { Bericht, Compliancebefund, Komiteeurteil } from "./schemas";

export interface Teamergebnis {
  berichte: Record<string, { ergebnis: Bericht; schritte: string[] } | { fehler: string }>;
  komitee: { ergebnis: Komiteeurteil; schritte: string[] } | null;
  compliance: Compliancebefund | null;
}

/** Kurzfassung eines Berichts für das Komitee und die Compliance. */
export const kurz = (b: Bericht) => ({ kernaussage: b.kernaussage, bewertung: b.bewertung, kennzahlen: b.kennzahlen?.slice(0, 6), abschnitte: b.abschnitte?.map(a => ({ titel: a.titel, punkte: a.punkte.slice(0, 5) })), fragen: b.fragen?.slice(0, 6) });

async function mitBegrenzung<T>(aufgaben: (() => Promise<T>)[], gleichzeitig: number, signal?: AbortSignal) {
  const ergebnisse: T[] = new Array(aufgaben.length); let i = 0;
  const worker = async () => { while (i < aufgaben.length && !signal?.aborted) { const j = i++; ergebnisse[j] = await aufgaben[j]!(); } };
  await Promise.all(Array.from({ length: Math.max(1, gleichzeitig) }, worker));
  return ergebnisse;
}

/**
 * Teamlauf: Fachexperten arbeiten parallel (begrenzt), das Komitee führt zusammen, Compliance gibt frei.
 * Der Projektentwickler kommt hinzu, wenn Gestaltungsmodule aktiv sind; der Dokumentprüfer, wenn Unterlagen vorliegen.
 */
export async function teamlauf(o: Laufoptionen & { gleichzeitig?: number; mitCompliance?: boolean }): Promise<Teamergebnis> {
  const a = o.analyse ?? rechne(o.eingabe);
  const opts = { ...o, analyse: a };
  const team: string[] = [...TEAM_KERN];
  if (Object.keys(o.eingabe.module ?? {}).length) team.push("projektentwickler");
  if ((o.dokumente?.liste() ?? []).some(d => d.status !== "offen")) team.push("dokumentpruefer");
  const berichte: Teamergebnis["berichte"] = {};
  await mitBegrenzung(team.map(id => async () => {
    try { berichte[id] = await fuehreAus<Bericht>(id, opts); }
    catch (e) { if (o.signal?.aborted) throw e; berichte[id] = { fehler: (e as Error).message }; }
  }), o.gleichzeitig ?? 3, o.signal);
  const fertig = Object.fromEntries(Object.entries(berichte).filter(([, v]) => "ergebnis" in v).map(([k, v]) => [k, kurz((v as { ergebnis: Bericht }).ergebnis)]));
  if (!Object.keys(fertig).length) return { berichte, komitee: null, compliance: null };
  const komitee = await fuehreAus<Komiteeurteil>("komitee", { ...opts, zusatz: { berichteDerExperten: fertig } }, "Die Fachexperten haben berichtet (berichteDerExperten). Prüfe ihre Befunde gegeneinander, rechne strittige Punkte nach und fälle das Urteil.");
  let compliance: Compliancebefund | null = null;
  if (o.mitCompliance !== false) {
    try { compliance = (await fuehreAus<Compliancebefund>("compliance", { ...opts, zusatz: { pruefgegenstand: { berichte: fertig, komitee: komitee.ergebnis } } }, "Prüfe die folgenden Ergebnisse vor der Ausgabe an den Investor.")).ergebnis; }
    catch { compliance = null; }
  }
  return { berichte, komitee, compliance };
}
