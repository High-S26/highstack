import type { Objekt, Szenario } from "@highstack/engine";

/**
 * Plausibilität der Objektdaten für Anlegen und Ändern über die Schnittstelle.
 * Ungültige Felder werden nicht gespeichert (der bisherige Wert bleibt) und mit Grund gemeldet;
 * die übrigen Änderungen gehen durch. So sperrt ein einzelner Tippfehler nie das ganze Objekt.
 */
const ZAHLEN: Partial<Record<keyof Objekt, [number, number, string]>> = {
  kaufpreis: [0, 1e10, "Kaufpreis"], wohnflaeche: [0, 1e6, "Wohnfläche"], miete: [0, 1e8, "Miete"],
  marktmieteQm: [0, 500, "Vergleichsmiete je m²"], vergleichspreisQm: [0, 200_000, "Vergleichspreis je m²"],
  hausgeldNichtUmlagefaehig: [0, 1e7, "Hausgeld nicht umlagefähig"], hausgeldGesamt: [0, 1e7, "Hausgeld gesamt"],
  ruecklageAnteil: [0, 1e9, "Rücklage, Ihr Anteil"], bodenrichtwert: [0, 200_000, "Bodenrichtwert"], gebaeudeanteil: [0, 1, "Gebäudeanteil"],
  baujahr: [0, new Date().getFullYear() + 10, "Baujahr"],
};
const TEXTE: (keyof Objekt)[] = ["titel", "ort", "asset", "wohnlage"];
const JANEIN: (keyof Objekt)[] = ["leer", "erbbaurecht", "sonderumlage"];
export const ENERGIEKLASSEN = ["A+", "A", "B", "C", "D", "E", "F", "G", "H"];

export function bereinige(o: Record<string, unknown>): { objekt: Partial<Objekt>; verworfen: string[] } {
  const v: string[] = []; const out: Record<string, unknown> = {};
  for (const [k, w] of Object.entries(o)) {
    const z = ZAHLEN[k as keyof Objekt];
    if (z) {
      if (w === null) { out[k] = null; continue; }
      if (typeof w !== "number" || !Number.isFinite(w)) { v.push(`${z[2]}: keine Zahl`); continue; }
      if (w < z[0] || w > z[1]) { const f = (x: number) => x.toLocaleString("de-DE", { useGrouping: k !== "baujahr" }); v.push(`${z[2]}: ${f(w)} liegt außerhalb von ${f(z[0])} bis ${f(z[1])}`); continue; }
      out[k] = w; continue;
    }
    if (TEXTE.includes(k as keyof Objekt)) { if (w == null || typeof w === "string") out[k] = typeof w === "string" ? w.slice(0, 300) : w; else v.push(`${k}: kein Text`); continue; }
    if (JANEIN.includes(k as keyof Objekt)) { if (typeof w === "boolean") out[k] = w; else v.push(`${k}: ja oder nein erwartet`); continue; }
    if (k === "energieklasse") { if (w == null || w === "") out[k] = null; else if (typeof w === "string" && ENERGIEKLASSEN.includes(w.toUpperCase())) out[k] = w.toUpperCase(); else v.push(`Energieklasse: ${ENERGIEKLASSEN.join(", ")}`); continue; }
    if (k === "stellplaetze") {
      if (!Array.isArray(w)) { v.push("Stellplätze: Liste erwartet"); continue; }
      const ok = w.filter(x => x && typeof x === "object" && typeof (x as { id?: unknown }).id === "string" && ((x as { kaufpreis?: unknown }).kaufpreis == null || (typeof (x as { kaufpreis: unknown }).kaufpreis === "number" && (x as { kaufpreis: number }).kaufpreis >= 0)) && ((x as { miete?: unknown }).miete == null || (typeof (x as { miete: unknown }).miete === "number" && (x as { miete: number }).miete >= 0)));
      if (ok.length !== w.length) v.push("Stellplätze: ungültige Einträge nicht übernommen");
      out[k] = ok; continue;
    }
    if (k === "gefragt" || k === "herkunft") { if (w && typeof w === "object" && !Array.isArray(w)) out[k] = w; else v.push(`${k}: ungültig`); continue; }
    // unbekannte Felder werden nicht gespeichert
  }
  return { objekt: out as Partial<Objekt>, verworfen: v };
}

/** Szenario im Durchspielen: nur endliche Zahlen; Positionen als Liste gültiger Einträge */
export function bereinigeSzenario(s: Record<string, unknown>): { szenario: Partial<Szenario>; verworfen: string[] } {
  const v: string[] = []; const out: Record<string, unknown> = {};
  for (const [k, w] of Object.entries(s)) {
    if (k === "positionen") { if (Array.isArray(w)) out[k] = w.filter(x => x && typeof x === "object" && typeof (x as { betrag?: unknown }).betrag === "number" && Number.isFinite((x as { betrag: number }).betrag)); else v.push("Eigene Positionen: Liste erwartet"); continue; }
    if (typeof w === "number" && Number.isFinite(w)) { out[k] = k === "haltedauer" ? Math.min(60, Math.max(1, Math.round(w))) : w; continue; }
    if (w == null) { out[k] = w; continue; }
    if (typeof w === "boolean" || typeof w === "string") { out[k] = w; continue; }
    v.push(`${k}: ungültiger Wert`);
  }
  return { szenario: out as Partial<Szenario>, verworfen: v };
}
