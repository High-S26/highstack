import type { Objekt } from "@highstack/engine";

/**
 * Plausibilität der Objektdaten, für Anlegen und Ändern über die Schnittstelle.
 * Unsinnige Werte (negativ, Baujahr in der Zukunft, unbekannte Energieklasse) werden abgewiesen statt gerechnet.
 */
const GRENZEN: Partial<Record<keyof Objekt, [number, number, string]>> = {
  kaufpreis: [0, 1e9, "Kaufpreis"], wohnflaeche: [0, 100_000, "Wohnfläche"], miete: [0, 10_000_000, "Miete"],
  marktmieteQm: [0, 200, "Vergleichsmiete je m²"], vergleichspreisQm: [0, 100_000, "Vergleichspreis je m²"],
  hausgeldNichtUmlagefaehig: [0, 1_000_000, "Hausgeld nicht umlagefähig"], hausgeldGesamt: [0, 1_000_000, "Hausgeld gesamt"],
  ruecklageAnteil: [0, 1, "Anteil Rücklage"], bodenrichtwert: [0, 100_000, "Bodenrichtwert"], gebaeudeanteil: [0, 1, "Gebäudeanteil"],
};
export const ENERGIEKLASSEN = ["A+", "A", "B", "C", "D", "E", "F", "G", "H"];

export function pruefeObjekt(o: Partial<Objekt>): string[] {
  const f: string[] = []; const jahr = new Date().getFullYear();
  for (const [k, [lo, hi, name]] of Object.entries(GRENZEN) as [keyof Objekt, [number, number, string]][]) {
    if (!(k in o) || o[k] == null) continue; const v = o[k];
    if (typeof v !== "number" || !Number.isFinite(v)) f.push(`${name}: bitte eine Zahl.`);
    else if (v < lo || v > hi) f.push(`${name}: zwischen ${lo.toLocaleString("de-DE")} und ${hi.toLocaleString("de-DE")}.`);
  }
  // Untergrenzen bewusst bei 0: beim Tippen („2“ auf dem Weg zu „289.000“) wird zwischengespeichert
  if (o.baujahr != null && (typeof o.baujahr !== "number" || o.baujahr < 0 || o.baujahr > jahr + 5)) f.push(`Baujahr: höchstens ${jahr + 5}.`);
  if (o.energieklasse != null && o.energieklasse !== "" && !ENERGIEKLASSEN.includes(String(o.energieklasse).toUpperCase())) f.push(`Energieklasse: ${ENERGIEKLASSEN.join(", ")}.`);
  if (o.titel != null && typeof o.titel === "string" && o.titel.length > 300) f.push("Titel: höchstens 300 Zeichen.");
  for (const sp of o.stellplaetze ?? []) {
    if (sp.kaufpreis != null && (sp.kaufpreis < 0 || sp.kaufpreis > 1e7)) f.push("Stellplatz-Kaufpreis: zwischen 0 und 10 Mio.");
    if (sp.miete != null && (sp.miete < 0 || sp.miete > 10_000)) f.push("Stellplatz-Miete: zwischen 0 und 10.000 €.");
  }
  return f;
}
export const normalisiere = (o: Partial<Objekt>): Partial<Objekt> => (o.energieklasse ? { ...o, energieklasse: String(o.energieklasse).toUpperCase() } : o);
