import { MODULE, rechneModul, simKurz, simuliere, steuern, zielpreis, type Analyse, type Analyseeingabe, type Struktur, type Szenario } from "@highstack/engine";
import type { Werkzeugdefinition } from "./llm";

/** Quelle für hochgeladene Unterlagen eines Objekts (Text bereits extrahiert). */
export interface Dokumentquelle {
  liste(): { schluessel: string; titel: string; status: string }[];
  lies(schluessel: string): Promise<{ titel: string; text: string; befund?: unknown } | null>;
}
export interface Werkzeugkontext { eingabe: Analyseeingabe; analyse: Analyse; dokumente?: Dokumentquelle }
export interface Werkzeug extends Werkzeugdefinition { ausfuehren(input: Record<string, unknown>, k: Werkzeugkontext): Promise<{ ergebnis: unknown; zusammenfassung: string }> }

const eur = (v: number | null | undefined) => v == null || !Number.isFinite(v) ? "–" : `${Math.round(v).toLocaleString("de-DE")} €`;
const pct = (v: number | null | undefined) => v == null || !Number.isFinite(v) ? "–" : `${(v * 100).toFixed(1).replace(".", ",")} %`;
const n = (inp: Record<string, unknown>, k: string) => { const v = inp[k]; if (v == null || v === "") return null; const x = Number(v); return Number.isFinite(x) ? x : null; };

function szenarioAus(inp: Record<string, unknown>, k: Werkzeugkontext): Szenario {
  const s = { ...k.analyse.szenario }; const o = k.eingabe.objekt; const miete = k.analyse.bewertung.miete;
  if (n(inp, "kaufpreis") != null && o.kaufpreis) s.kaufpreisAenderung = n(inp, "kaufpreis")! / o.kaufpreis - 1;
  if (n(inp, "eigenkapital") != null) s.eigenkapital = n(inp, "eigenkapital")!;
  if (n(inp, "sollzins") != null) s.sollzins = n(inp, "sollzins")! / 100;
  if (n(inp, "tilgung") != null) s.tilgung = n(inp, "tilgung")! / 100;
  if (n(inp, "miete_monat") != null && miete) s.mietFaktor = n(inp, "miete_monat")! / miete;
  const map: [string, keyof Szenario][] = [["mietsteigerung", "mietsteigerung"], ["kostensteigerung", "kostensteigerung"], ["wertentwicklung", "wertentwicklung"], ["leerstand_zusatz", "leerstandZusatz"], ["anschlusszins_aufschlag", "anschlusszinsAufschlag"]];
  for (const [a, b] of map) if (n(inp, a) != null) (s as Record<string, number>)[b] = n(inp, a)! / 100;
  if (n(inp, "hausgeld_faktor") != null) s.hausgeldFaktor = n(inp, "hausgeld_faktor")!;
  if (n(inp, "haltedauer") != null) s.haltedauer = Math.max(1, Math.min(40, Math.round(n(inp, "haltedauer")!)));
  return s;
}
const beschreibeEingabe = (inp: Record<string, unknown>) => Object.entries(inp).filter(([, v]) => v != null && v !== "").map(([k, v]) => `${k.replace(/_/g, " ")} ${typeof v === "object" ? JSON.stringify(v) : v}`).join(", ");

export const WERKZEUGE: Record<string, Werkzeug> = {
  rechne_szenario: {
    name: "rechne_szenario",
    description: "Rechnet eine Variante des Objekts mit dem Rechenwerk über die Haltedauer. Alle Felder optional; nicht genannte bleiben wie in der Einstellung des Investors. Beträge in Euro, Prozentwerte als Prozentzahl (4.5 = 4,5 %). Gibt Rate, Cashflow, Zuzahlung, Restschuld, Nettovermögen, IRR und DSCR zurück.",
    input_schema: { type: "object", properties: Object.fromEntries(["kaufpreis", "eigenkapital", "sollzins", "tilgung", "miete_monat", "mietsteigerung", "kostensteigerung", "wertentwicklung", "leerstand_zusatz", "anschlusszins_aufschlag", "hausgeld_faktor", "haltedauer"].map(k => [k, { type: "number" }])) },
    async ausfuehren(inp, k) {
      const m = simKurz(simuliere(k.analyse.params, k.eingabe.objekt, k.analyse.bewertung.miete, szenarioAus(inp, k)));
      if (!m) return { ergebnis: { fehler: "Kaufpreis oder Miete fehlen" }, zusammenfassung: "Variante nicht rechenbar: Kaufpreis oder Miete fehlen" };
      return { ergebnis: m, zusammenfassung: `Rechnet Variante (${beschreibeEingabe(inp) || "wie eingestellt"}): Cashflow ${eur(m.cashflowJahr1Monat)} pro Monat, IRR ${pct(m.irrVorSteuern)}` };
    },
  },
  zielpreis: {
    name: "zielpreis",
    description: "Ermittelt den Kaufpreis, bei dem ein Ziel genau erreicht wird. ziel: 'cashflow' (Cashflow Jahr 1 in Euro pro Monat), 'rendite' (Bruttorendite in Prozent), 'faktor' (Kaufpreisfaktor) oder 'dscr' (Kapitaldienstdeckung Jahr 1). Übrige Annahmen wie eingestellt.",
    input_schema: { type: "object", properties: { ziel: { type: "string", enum: ["cashflow", "rendite", "faktor", "dscr"] }, wert: { type: "number" } }, required: ["ziel", "wert"] },
    async ausfuehren(inp, k) {
      const ziel = String(inp.ziel) as "cashflow" | "rendite" | "faktor" | "dscr"; const w = Number(inp.wert);
      const o = k.eingabe.objekt, miete = k.analyse.bewertung.miete;
      if (!o.kaufpreis || !miete || !Number.isFinite(w)) throw new Error("Kaufpreis, Miete oder Zielwert fehlen");
      const kp = zielpreis(k.analyse.params, o, miete, k.analyse.szenario, ziel, ziel === "rendite" ? w / 100 : w);
      if (kp == null) return { ergebnis: { ziel, wert: w, erreichbar: false }, zusammenfassung: `Zielpreis für ${ziel} ${w}: nicht erreichbar` };
      const bei = simKurz(simuliere(k.analyse.params, o, miete, { ...k.analyse.szenario, kaufpreisAenderung: kp / o.kaufpreis - 1 }));
      const abstand = kp / o.kaufpreis - 1;
      return { ergebnis: { ziel, wert: w, kaufpreis: Math.round(kp), abstandZumAngebotProzent: Math.round(abstand * 1000) / 10, beiDiesemPreis: bei }, zusammenfassung: `Sucht Zielpreis für ${ziel} ${w}: ${eur(kp)} (${abstand >= 0 ? "+" : "−"}${Math.abs(Math.round(abstand * 100))} % zum Angebot)` };
    },
  },
  steuer_rechnung: {
    name: "steuer_rechnung",
    description: "Rechnet die Steuerwirkung der aktuellen Einstellung für eine Erwerbsstruktur: 'privat', 'gbr' oder 'gmbh'. Vereinfachtes Informationsmodell.",
    input_schema: { type: "object", properties: { struktur: { type: "string", enum: ["privat", "gbr", "gmbh"] } }, required: ["struktur"] },
    async ausfuehren(inp, k) {
      const sim = k.analyse.simulation; if (!sim) throw new Error("Kaufpreis oder Miete fehlen");
      const st = String(inp.struktur) as Struktur; const t = steuern(sim, { ...k.analyse.params, struktur: st }, k.eingabe.objekt);
      const conv = (x: typeof t.privat) => ({ steuernLaufend: Math.round(x.steuernLaufend), steuerVerkauf: Math.round(x.steuerVerkauf), steuerAusschuettung: Math.round(x.steuerAusschuettung), cashflowNachSteuernJahr1Monat: Math.round(x.cashflowJahr1Monat), zuwachsNachSteuern: Math.round(x.zuwachsNachSteuern), irrNachSteuern: x.irr });
      const ergebnis = { struktur: st, abschreibungJahr: Math.round(t.afaJahr), abschreibungSatz: t.afaSatz, ...(st === "gmbh" ? { imMantel: conv(t.gmbh), nachAusschuettung: conv(t.gmbhAusgeschuettet) } : { ergebnis: conv(t.privat) }), hinweis: st === "gbr" ? "Werte für die GbR gesamt; je Gesellschafter nach Anteil." : undefined };
      return { ergebnis, zusammenfassung: `Rechnet Steuern für ${st === "gmbh" ? "GmbH" : st === "gbr" ? "GbR" : "privat"}: Zuwachs nach Steuern ${eur(st === "gmbh" ? t.gmbhAusgeschuettet.zuwachsNachSteuern : t.privat.zuwachsNachSteuern)}` };
    },
  },
  lies_unterlagen: {
    name: "lies_unterlagen",
    description: "Liest eine hochgeladene Unterlage des Objekts. 'schluessel' ist einer der Schlüssel aus 'unterlagen' im Kontext. Gibt Titel, Textauszug und vorhandene Prüfbefunde zurück.",
    input_schema: { type: "object", properties: { schluessel: { type: "string" } }, required: ["schluessel"] },
    async ausfuehren(inp, k) {
      const key = String(inp.schluessel ?? inp.kategorie ?? "");
      const d = k.dokumente ? await k.dokumente.lies(key) : null;
      if (!d) return { ergebnis: { schluessel: key, vorhanden: false, hinweis: "Keine lesbare Unterlage hochgeladen." }, zusammenfassung: `Sucht Unterlage „${key}“: nicht vorhanden` };
      return { ergebnis: { schluessel: key, titel: d.titel, text: d.text.slice(0, 15000), befund: d.befund ?? null }, zusammenfassung: `Liest Unterlage: ${d.titel}` };
    },
  },
  rechne_modul: {
    name: "rechne_modul",
    description: `Rechnet ein Gestaltungsmodul für das Objekt. 'modul' ist eine dieser Kennungen: ${MODULE.map(m => `${m.id} (${m.name}; Parameter: ${m.parameter.map(p => p.key).join(", ")})`).join("; ")}. 'werte' überschreibt einzelne Parameter; Prozentwerte als Dezimalzahl (0.2 = 20 %). Ohne 'werte' gelten die eingestellten bzw. Standardwerte.`,
    input_schema: { type: "object", properties: { modul: { type: "string", enum: MODULE.map(m => m.id) }, werte: { type: "object" } }, required: ["modul"] },
    async ausfuehren(inp, k) {
      const id = String(inp.modul); const basis = k.eingabe.module?.[id] ?? {};
      const r = rechneModul(id, { ...basis, ...((inp.werte as Record<string, number | string | boolean>) ?? {}) }, k.eingabe.objekt, k.analyse.params);
      const kz = Object.fromEntries(r.kennzahlen.map(x => [x.label, x.wert == null ? null : x.einheit === "%" ? Math.round(x.wert * 1000) / 10 + " %" : Math.round(x.wert * 100) / 100 + (x.einheit ? " " + x.einheit : "")]));
      const gewinn = r.kennzahlen.find(x => x.key === "gewinn" || x.key === "mehrertrag" || x.key === "mehr");
      return { ergebnis: { modul: id, kennzahlen: kz, hinweise: r.hinweise.map(h => h.text) }, zusammenfassung: `Rechnet Modul ${MODULE.find(m => m.id === id)?.name ?? id}${inp.werte ? ` (${beschreibeEingabe(inp.werte as Record<string, unknown>)})` : ""}${gewinn ? `: ${gewinn.label} ${eur(gewinn.wert)}` : ""}` };
    },
  },
};
