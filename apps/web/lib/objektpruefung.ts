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
  baujahr: [0, new Date().getFullYear() + 10, "Baujahr"], neuvermietungQm: [0, 500, "Neuvermietung je m²"], maklerProvision: [0, 0.15, "Maklerprovision"],
  liegenschaftszins: [0.001, 0.15, "Liegenschaftszins"], restnutzungsdauer: [1, 100, "Restnutzungsdauer"], grundstueckAnteilQm: [0, 1e6, "Grundstücksanteil"],
};
const AUSSENARTEN = ["balkon", "loggia", "terrasse", "dachterrasse", "garten", "wintergarten"];
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
    if (k === "aussenflaeche") {
      if (w == null) { out[k] = null; continue; }
      const a = w as Record<string, unknown>;
      const qm = a.qm == null ? null : typeof a.qm === "number" && a.qm >= 0 && a.qm <= 10000 ? a.qm : undefined;
      if (typeof a !== "object" || !AUSSENARTEN.includes(String(a.art)) || qm === undefined) { v.push("Außenfläche: ungültig"); continue; }
      out[k] = { art: a.art, qm, anrechnung: typeof a.anrechnung === "number" ? Math.min(0.5, Math.max(0, a.anrechnung)) : 0.25, inWohnflaeche: a.inWohnflaeche === true, ausrichtung: typeof a.ausrichtung === "string" ? a.ausrichtung.slice(0, 40) : null, ...(typeof a.anbieterAnrechnung === "number" ? { anbieterAnrechnung: Math.min(0.5, Math.max(0, a.anbieterAnrechnung)) } : {}) };
      continue;
    }
    if (k === "mietvertrag") {
      if (w == null) { out[k] = null; continue; }
      const m = w as Record<string, unknown>;
      if (typeof m !== "object" || !["standard", "staffel", "index"].includes(String(m.art))) { v.push("Mietvertrag: Art ungültig"); continue; }
      const datum = m.letzteErhoehung == null || m.letzteErhoehung === "" ? null : typeof m.letzteErhoehung === "string" && /^(19|20)\d\d-(0[1-9]|1[0-2])$/.test(m.letzteErhoehung) ? m.letzteErhoehung : undefined;
      if (datum === undefined) { v.push("Letzte Mieterhöhung: Monat als JJJJ-MM"); continue; }
      if (datum && datum > new Date().toISOString().slice(0, 7)) { v.push("Letzte Mieterhöhung: liegt in der Zukunft"); continue; }
      // ungültige Teilangaben melden statt still zu verwerfen (INV-066)
      const sp = m.staffelProzent == null ? null : typeof m.staffelProzent === "number" && Math.abs(m.staffelProzent) <= 0.2 ? m.staffelProzent : (v.push("Staffel pro Jahr: höchstens 20 %"), null);
      const wj = m.mieterwechselJahr == null ? null : typeof m.mieterwechselJahr === "number" && m.mieterwechselJahr >= 1 && m.mieterwechselJahr <= 60 ? Math.round(m.mieterwechselJahr) : (v.push("Mieterwechsel: Jahr 1 bis 60"), null);
      const vor = m.mieteVorErhoehung == null ? null : typeof m.mieteVorErhoehung === "number" && m.mieteVorErhoehung > 0 && m.mieteVorErhoehung < 1e7 ? m.mieteVorErhoehung : (v.push("Miete vor der letzten Erhöhung: keine gültige Zahl"), null);
      out[k] = { art: m.art, letzteErhoehung: datum, staffelProzent: sp, mieterwechselJahr: wj, mieteVorErhoehung: vor };
      continue;
    }
    if (k === "mietregulierung") { if (w == null || w === "angespannt" || w === "normal") out[k] = w ?? null; else v.push("Mietregulierung: angespannt oder normal"); continue; }
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
    if (k === "stichtag") { if (typeof w === "string" && /^(19|20)\d\d-(0[1-9]|1[0-2])$/.test(w)) out[k] = w; else v.push("Übergang: Monat als JJJJ-MM"); continue; }
    if (k === "mietentwicklung") { if (w === "mietrecht" || w === "pauschal") out[k] = w; else v.push("Mietentwicklung: mietrecht oder pauschal"); continue; }
    if (typeof w === "boolean" || typeof w === "string") { out[k] = w; continue; }
    v.push(`${k}: ungültiger Wert`);
  }
  return { szenario: out as Partial<Szenario>, verworfen: v };
}
