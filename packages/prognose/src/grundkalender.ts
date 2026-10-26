import type { Ereignis } from "./types";
import { inDeutscheZeit, type Termin } from "./termine";

/**
 * Grundkalender: Termine, die ohne externe Quelle feststehen.
 * - Offizielle Jahrespläne (veröffentlicht von den Institutionen selbst, Stand Oktober 2026; BEA für BIP und PCE):
 *   Fed (FOMC-Entscheide 14:00 New York, Pressekonferenz 14:30), EZB (Entscheid 14:15, Pressekonferenz 14:45 deutscher Zeit),
 *   BLS (US-Arbeitsmarktbericht und Verbraucherpreise 08:30 New York), NYSE (Feiertage, verkürzte Handelstage).
 * - Regeln: US-Optionsverfall am dritten Freitag (vor einem Börsenfeiertag am Donnerstag), großer Verfall im März, Juni,
 *   September und Dezember mit Anpassung der S&P-Indizes nach Handelsschluss, VIX-Verfall (Mittwoch 30 Tage vor dem
 *   SPX-Verfall des Folgemonats), Bitcoin-Optionen bei Deribit am letzten Freitag 08:00 UTC, letzter Handelstag des Monats
 *   und Quartals, Zeitumstellung in den USA und in Europa.
 * Quartalszahlen stehen nicht fest (die Unternehmen legen sie selbst fest) und kommen aus importierten Kalendern.
 */
export const GRUNDKALENDER_STAND = "Oktober 2026";

const FOMC: string[] = ["2026-01-28", "2026-03-18", "2026-04-29", "2026-06-17", "2026-07-29", "2026-09-16", "2026-10-28", "2026-12-09",
  "2027-01-27", "2027-03-17", "2027-04-28", "2027-06-09", "2027-07-28", "2027-09-15", "2027-10-27", "2027-12-08"];
const EZB: string[] = ["2026-10-29", "2026-12-17", "2027-02-04", "2027-03-18", "2027-04-29", "2027-06-10", "2027-07-22", "2027-09-09", "2027-10-28", "2027-12-16"];
const ARBEITSMARKT: string[] = ["2026-01-09", "2026-02-11", "2026-03-06", "2026-04-03", "2026-05-08", "2026-06-05", "2026-07-02", "2026-08-07", "2026-09-04", "2026-10-02", "2026-11-06", "2026-12-04",
  "2027-01-08", "2027-02-05", "2027-03-05", "2027-04-02", "2027-05-07", "2027-06-04", "2027-07-02", "2027-08-06", "2027-09-03", "2027-10-08", "2027-11-05", "2027-12-03"];
const VPI: string[] = ["2026-09-11", "2026-10-14", "2026-11-10", "2026-12-10",
  "2027-01-13", "2027-02-11", "2027-03-10", "2027-04-13", "2027-05-12", "2027-06-10", "2027-07-14", "2027-08-11", "2027-09-14", "2027-10-14", "2027-11-10", "2027-12-10"];
/** BEA: Konsumausgaben mit PCE-Inflation (Personal Income and Outlays) und BIP; Erstschätzung des BIP ist die wichtigste */
const PCE: string[] = ["2026-10-29", "2026-11-25", "2026-12-23", "2027-01-28", "2027-02-25", "2027-03-31", "2027-04-29", "2027-05-27", "2027-06-25", "2027-07-29", "2027-08-25", "2027-09-30", "2027-10-28", "2027-11-24", "2027-12-22"];
const BIP: [string, "erst" | "zweit" | "dritt"][] = [["2026-10-29", "erst"], ["2026-11-25", "zweit"], ["2026-12-23", "dritt"], ["2027-01-28", "erst"], ["2027-02-25", "zweit"], ["2027-03-31", "dritt"], ["2027-04-29", "erst"], ["2027-05-27", "zweit"], ["2027-06-25", "dritt"], ["2027-07-29", "erst"], ["2027-08-25", "zweit"], ["2027-09-30", "dritt"], ["2027-10-28", "erst"], ["2027-11-24", "zweit"], ["2027-12-22", "dritt"]];
/** NYSE: geschlossen bzw. Schluss um 13:00 New York */
export const NYSE_FEIERTAGE: Record<string, string> = {
  "2026-01-01": "Neujahr", "2026-01-19": "Martin Luther King Day", "2026-02-16": "Washington's Birthday", "2026-04-03": "Karfreitag", "2026-05-25": "Memorial Day", "2026-06-19": "Juneteenth", "2026-07-03": "Unabhängigkeitstag (nachgeholt)", "2026-09-07": "Labor Day", "2026-11-26": "Thanksgiving", "2026-12-25": "Weihnachten",
  "2027-01-01": "Neujahr", "2027-01-18": "Martin Luther King Day", "2027-02-15": "Washington's Birthday", "2027-03-26": "Karfreitag", "2027-05-31": "Memorial Day", "2027-06-18": "Juneteenth (nachgeholt)", "2027-07-05": "Unabhängigkeitstag (nachgeholt)", "2027-09-06": "Labor Day", "2027-11-25": "Thanksgiving", "2027-12-24": "Weihnachten (nachgeholt)",
  "2028-01-17": "Martin Luther King Day", "2028-02-21": "Washington's Birthday", "2028-04-14": "Karfreitag", "2028-05-29": "Memorial Day", "2028-06-19": "Juneteenth", "2028-07-04": "Unabhängigkeitstag", "2028-09-04": "Labor Day", "2028-11-23": "Thanksgiving", "2028-12-25": "Weihnachten",
};
export const NYSE_VERKUERZT: Record<string, string> = { "2026-11-27": "Tag nach Thanksgiving", "2026-12-24": "Heiligabend", "2027-11-26": "Tag nach Thanksgiving", "2028-07-03": "Vor dem Unabhängigkeitstag", "2028-11-24": "Tag nach Thanksgiving" };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const tag = (j: number, m: number, d: number) => new Date(Date.UTC(j, m - 1, d, 12));
const wochentag = (d: Date) => d.getUTCDay();
const plus = (d: Date, n: number) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };
/** n-ter Wochentag (0 = So … 6 = Sa) eines Monats; n = -1: letzter */
function nterWochentag(j: number, m: number, wt: number, n: number): Date {
  if (n > 0) { let d = tag(j, m, 1); while (wochentag(d) !== wt) d = plus(d, 1); return plus(d, 7 * (n - 1)); }
  let d = tag(j, m + 1, 0); while (wochentag(d) !== wt) d = plus(d, -1); return d;
}
export const istHandelstag = (datum: string) => { const w = new Date(datum + "T12:00:00Z").getUTCDay(); return w !== 0 && w !== 6 && !NYSE_FEIERTAGE[datum]; };
/** Dritter Freitag; ist er Börsenfeiertag, der Handelstag davor */
export function verfallstag(j: number, m: number): string { let d = nterWochentag(j, m, 5, 3); while (!istHandelstag(iso(d))) d = plus(d, -1); return iso(d); }
function letzterHandelstag(j: number, m: number): string { let d = tag(j, m + 1, 0); while (!istHandelstag(iso(d))) d = plus(d, -1); return iso(d); }

/** Termine des Grundkalenders zwischen von und bis (JJJJ-MM-TT) */
export function grundkalender(von: string, bis: string): Termin[] {
  const out: Termin[] = []; const q = (art: string) => `${art} (Grundkalender, Stand ${GRUNDKALENDER_STAND})`;
  const im = (d: string) => d >= von && d <= bis;
  const et = (d: string, h: number, m: number) => inDeutscheZeit(d, h, m, "ET");
  for (const d of FOMC) if (im(d)) { out.push({ datum: d, zeit: et(d, 14, 0).zeit, land: "US", art: "zinsentscheid", wichtig: true, titel: "Fed, Zinsentscheid (FOMC)", quelle: q("Federal Reserve, Sitzungskalender") }); out.push({ datum: d, zeit: et(d, 14, 30).zeit, land: "US", art: "rede", wichtig: false, titel: "Fed, Pressekonferenz nach dem Zinsentscheid", quelle: q("Federal Reserve") }); }
  for (const d of EZB) if (im(d)) { out.push({ datum: d, zeit: "14:15", land: "EU", art: "zinsentscheid", wichtig: true, titel: "EZB, Zinsentscheid", quelle: q("EZB, Sitzungskalender") }); out.push({ datum: d, zeit: "14:45", land: "EU", art: "rede", wichtig: false, titel: "EZB, Pressekonferenz nach dem Zinsentscheid", quelle: q("EZB") }); }
  for (const d of ARBEITSMARKT) if (im(d)) out.push({ datum: d, zeit: et(d, 8, 30).zeit, land: "US", art: "arbeitsmarkt", wichtig: true, titel: "US-Arbeitsmarktbericht", quelle: q("BLS, Veröffentlichungsplan") });
  for (const d of VPI) if (im(d)) out.push({ datum: d, zeit: et(d, 8, 30).zeit, land: "US", art: "inflation", wichtig: true, titel: "US-Verbraucherpreise", quelle: q("BLS, Veröffentlichungsplan") });
  for (const d of PCE) if (im(d)) out.push({ datum: d, zeit: et(d, 8, 30).zeit, land: "US", art: "inflation", wichtig: true, titel: "US-Konsumausgaben und PCE-Inflation", quelle: q("BEA, Veröffentlichungsplan") });
  for (const [d, a] of BIP) if (im(d)) out.push({ datum: d, zeit: et(d, 8, 30).zeit, land: "US", art: "konjunktur", wichtig: a === "erst", titel: `US-BIP (${a === "erst" ? "erste" : a === "zweit" ? "zweite" : "dritte"} Schätzung)`, quelle: q("BEA, Veröffentlichungsplan") });
  for (const [d, n] of Object.entries(NYSE_FEIERTAGE)) if (im(d)) out.push({ datum: d, land: "US", art: "feiertag", wichtig: false, titel: `US-Börse geschlossen: ${n}`, quelle: q("NYSE, Feiertagskalender") });
  for (const [d, n] of Object.entries(NYSE_VERKUERZT)) if (im(d)) out.push({ datum: d, zeit: et(d, 13, 0).zeit, land: "US", art: "feiertag", wichtig: false, titel: `US-Börse schließt früher (13:00 New York): ${n}`, quelle: q("NYSE, Feiertagskalender") });
  // Regeln je Monat
  const [j0, m0] = von.split("-").map(Number) as [number, number]; const [j1, m1] = bis.split("-").map(Number) as [number, number];
  for (let j = j0, m = m0; j < j1 || (j === j1 && m <= m1); m === 12 ? (j++, m = 1) : m++) {
    const quartal = m % 3 === 0; const v = verfallstag(j, m);
    // Verfall ist kein Pausentermin (keine Uhrzeit, wirkt vor allem zum Schluss); die Bedeutung trägt die These
    if (im(v)) out.push({ datum: v, land: "US", art: "verfall", wichtig: false, titel: quartal ? "Großer Verfall (Optionen und Futures), Anpassung der S&P-Indizes nach Handelsschluss" : "US-Optionsverfall (monatlich)", quelle: q("Regel: dritter Freitag") });
    const v2 = verfallstag(m === 12 ? j + 1 : j, m === 12 ? 1 : m + 1); const vix = iso(plus(new Date(v2 + "T12:00:00Z"), -30));
    if (im(vix)) out.push({ datum: vix, land: "US", art: "verfall", wichtig: false, titel: "VIX-Verfall (Optionen und Futures)", quelle: q("Regel: 30 Tage vor dem SPX-Verfall des Folgemonats") });
    const btc = iso(nterWochentag(j, m, 5, -1)); const b = inDeutscheZeit(btc, 8, 0, "UTC");
    if (im(btc)) out.push({ datum: btc, zeit: b.zeit, art: "verfall", wichtig: false, titel: `Bitcoin-Optionsverfall bei Deribit${quartal ? " (Quartal)" : ""}`, quelle: q("Regel: letzter Freitag 08:00 UTC") });
    const ende = letzterHandelstag(j, m);
    if (im(ende)) out.push({ datum: ende, land: "US", art: "sonstiges", wichtig: false, titel: quartal ? (m === 12 ? "Letzter Handelstag des Jahres" : "Letzter Handelstag des Quartals") : "Letzter Handelstag des Monats", quelle: q("Regel") });
    if (m === 3) { const us = iso(nterWochentag(j, 3, 0, 2)); const eu = iso(nterWochentag(j, 3, 0, -1));
      if (im(us)) out.push({ datum: us, land: "US", art: "sonstiges", wichtig: false, titel: "USA: Beginn der Sommerzeit (bis zur Umstellung in Europa öffnet New York eine Stunde früher nach deutscher Zeit)", quelle: q("Regel: zweiter Sonntag im März") });
      if (im(eu)) out.push({ datum: eu, land: "EU", art: "sonstiges", wichtig: false, titel: "Europa: Beginn der Sommerzeit", quelle: q("Regel: letzter Sonntag im März") }); }
    if (m === 10) { const eu = iso(nterWochentag(j, 10, 0, -1)); if (im(eu)) out.push({ datum: eu, land: "EU", art: "sonstiges", wichtig: false, titel: "Europa: Ende der Sommerzeit (bis zur Umstellung in den USA öffnet New York um 14:30 deutscher Zeit)", quelle: q("Regel: letzter Sonntag im Oktober") }); }
    if (m === 11) { const us = iso(nterWochentag(j, 11, 0, 1)); if (im(us)) out.push({ datum: us, land: "US", art: "sonstiges", wichtig: false, titel: "USA: Ende der Sommerzeit", quelle: q("Regel: erster Sonntag im November") }); }
  }
  return out.sort((a, c) => `${a.datum}${a.zeit ?? "99"}`.localeCompare(`${c.datum}${c.zeit ?? "99"}`));
}

/** Gespeicherte und Grundkalender-Termine zusammenführen; gespeicherte haben Vorrang, doppelte Grundtermine entfallen */
export function mitGrundkalender(gespeichert: Ereignis[], von: string, bis: string): Ereignis[] {
  const gleich = (a: Termin, b: Termin) => a.datum === b.datum && a.art === b.art && (a.art === "verfall" || a.art === "feiertag" ? a.titel.slice(0, 12) === b.titel.slice(0, 12) || a.art === "feiertag" : (a.zeit ?? "") === (b.zeit ?? "") && (a.land ?? "") === (b.land ?? ""));
  const gk = grundkalender(von, bis).filter(g => !gespeichert.some(e => gleich(e, g))).map((g, i) => ({ ...g, id: `gk-${g.datum}-${i}` }));
  return [...gespeichert, ...gk];
}
