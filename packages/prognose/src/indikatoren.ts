import type { Indikator, Punkt, Reihen } from "./types";

/**
 * Katalog der Konjunktur- und Marktdaten. FRED (St. Louis Fed) und das EZB-Datenportal liefern frei abrufbar;
 * Einkaufsmanagerindizes, ifo, DAX und Bauzinsen pflegt der Admin (Lizenz der Anbieter beachten).
 */
export const INDIKATOREN: Indikator[] = [
  { id: "sp500", name: "S&P 500", einheit: "Punkte", kategorie: "markt", frequenz: "taeglich", vorlauf: "frueh", verzug: 0, quelle: { art: "fred", serie: "SP500", text: "FRED SP500" }, grenzen: [100, 50000], text: "Breiter US-Aktienindex; Maßstab für Aktien USA." },
  { id: "dax", name: "DAX", einheit: "Punkte", kategorie: "markt", frequenz: "taeglich", vorlauf: "frueh", verzug: 0, quelle: { art: "manuell", text: "Schlusskurse, z. B. Deutsche Börse" }, grenzen: [1000, 100000], text: "Deutscher Leitindex; Maßstab für Aktien Europa." },
  { id: "vix", name: "VIX", einheit: "Punkte", kategorie: "stimmung", frequenz: "taeglich", vorlauf: "gleich", verzug: 0, quelle: { art: "fred", serie: "VIXCLS", text: "FRED VIXCLS" }, grenzen: [5, 150], text: "Erwartete Schwankung des S&P 500 („Angstbarometer“)." },
  { id: "us10j", name: "US-Staatsanleihe 10 Jahre", einheit: "%", kategorie: "zins", frequenz: "taeglich", vorlauf: "gleich", verzug: 0, quelle: { art: "fred", serie: "DGS10", text: "FRED DGS10" }, grenzen: [-2, 20], text: "Langfristiger Marktzins USA." },
  { id: "kurve", name: "Zinskurve 10J − 2J (USA)", einheit: "%-Pkt.", kategorie: "zins", frequenz: "taeglich", vorlauf: "frueh", verzug: 0, quelle: { art: "fred", serie: "T10Y2Y", text: "FRED T10Y2Y" }, grenzen: [-5, 5], text: "Negativ = invertiert; ging den meisten US-Rezessionen voraus." },
  { id: "leitzins-us", name: "Leitzins USA (Fed Funds)", einheit: "%", kategorie: "zins", frequenz: "taeglich", vorlauf: "spaet", verzug: 1, quelle: { art: "fred", serie: "DFF", text: "FRED DFF" }, grenzen: [-1, 25], text: "Effektiver Tagesgeldsatz der Fed." },
  { id: "leitzins-ezb", name: "EZB-Einlagesatz", einheit: "%", kategorie: "zins", frequenz: "taeglich", vorlauf: "spaet", verzug: 0, quelle: { art: "fred", serie: "ECBDFR", text: "FRED ECBDFR" }, grenzen: [-2, 20], text: "Leitzins der Eurozone (Einlagefazilität)." },
  { id: "bund10j", name: "Bundesanleihe 10 Jahre", einheit: "%", kategorie: "zins", frequenz: "monatlich", vorlauf: "gleich", verzug: 5, quelle: { art: "fred", serie: "IRLTLT01DEM156N", text: "FRED/OECD IRLTLT01DEM156N" }, grenzen: [-2, 15], text: "Langfristiger Zins Deutschland; Basis für Bauzinsen und Immobilienrenditen." },
  { id: "bauzins", name: "Bauzins 10 Jahre fest", einheit: "%", kategorie: "immobilien", frequenz: "monatlich", vorlauf: "gleich", verzug: 35, quelle: { art: "manuell", text: "Bundesbank MFI-Zinsstatistik" }, grenzen: [0, 20], text: "Effektivzins für Wohnungsbaukredite." },
  { id: "hy-spread", name: "Risikoaufschlag Hochzinsanleihen", einheit: "%-Pkt.", kategorie: "kredit", frequenz: "taeglich", vorlauf: "frueh", verzug: 1, quelle: { art: "fred", serie: "BAMLH0A0HYM2", text: "FRED ICE BofA HY OAS" }, grenzen: [0.5, 30], text: "Steigt, wenn Kreditgeber Ausfälle fürchten." },
  { id: "inflation-us", name: "Inflation USA (VPI, Vorjahr)", einheit: "%", kategorie: "inflation", frequenz: "monatlich", vorlauf: "spaet", verzug: 14, quelle: { art: "fred", serie: "CPIAUCSL", text: "FRED CPIAUCSL" }, umrechnung: "vorjahr", grenzen: [-5, 30], text: "Verbraucherpreise USA gegenüber Vorjahr." },
  { id: "inflation-ez", name: "Inflation Eurozone (HVPI, Vorjahr)", einheit: "%", kategorie: "inflation", frequenz: "monatlich", vorlauf: "spaet", verzug: 17, quelle: { art: "ezb", serie: "ICP/M.U2.N.000000.4.ANR", text: "EZB-Datenportal HVPI" }, grenzen: [-5, 30], text: "Maßstab der EZB; Treiber für Mieten (Indexmieten) und Kosten." },
  { id: "arbeitslos-us", name: "Arbeitslosenquote USA", einheit: "%", kategorie: "arbeit", frequenz: "monatlich", vorlauf: "spaet", verzug: 7, quelle: { art: "fred", serie: "UNRATE", text: "FRED UNRATE" }, grenzen: [0, 30], text: "Grundlage der Sahm-Regel." },
  { id: "pmi-us", name: "Einkaufsmanagerindex USA (Industrie)", einheit: "Punkte", kategorie: "wachstum", frequenz: "monatlich", vorlauf: "frueh", verzug: 1, quelle: { art: "manuell", text: "ISM / S&P Global" }, grenzen: [20, 80], text: "Über 50 Wachstum, unter 50 Schrumpfung." },
  { id: "pmi-ez", name: "Einkaufsmanagerindex Eurozone", einheit: "Punkte", kategorie: "wachstum", frequenz: "monatlich", vorlauf: "frueh", verzug: 1, quelle: { art: "manuell", text: "HCOB / S&P Global" }, grenzen: [20, 80], text: "Über 50 Wachstum, unter 50 Schrumpfung." },
  { id: "ifo", name: "ifo Geschäftsklima", einheit: "Index", kategorie: "stimmung", frequenz: "monatlich", vorlauf: "frueh", verzug: 0, quelle: { art: "manuell", text: "ifo Institut" }, grenzen: [50, 150], text: "Stimmung der deutschen Wirtschaft." },
  { id: "fed-bilanz", name: "Bilanzsumme der Fed", einheit: "Mio. $", kategorie: "zins", frequenz: "woechentlich", vorlauf: "frueh", verzug: 2, quelle: { art: "fred", serie: "WALCL", text: "FRED WALCL" }, grenzen: [500_000, 20_000_000], text: "Wächst sie, kommt Liquidität in die Märkte; schrumpft sie (QT), wird Liquidität entzogen." },
  { id: "reverse-repo", name: "Reverse Repo der Fed", einheit: "Mrd. $", kategorie: "zins", frequenz: "taeglich", vorlauf: "frueh", verzug: 1, quelle: { art: "fred", serie: "RRPONTSYD", text: "FRED RRPONTSYD" }, grenzen: [0, 5000], text: "Geparkte Liquidität; sinkt sie, fließt Geld zurück in die Märkte." },
  { id: "tga", name: "Konto des US-Finanzministeriums (TGA)", einheit: "Mio. $", kategorie: "zins", frequenz: "woechentlich", vorlauf: "frueh", verzug: 2, quelle: { art: "fred", serie: "WTREGEN", text: "FRED WTREGEN" }, grenzen: [0, 3_000_000], text: "Steigt das Guthaben des Finanzministeriums, wird dem Markt Liquidität entzogen." },
  { id: "eurusd", name: "Euro in US-Dollar", einheit: "USD", kategorie: "waehrung", frequenz: "taeglich", vorlauf: "gleich", verzug: 1, quelle: { art: "fred", serie: "DEXUSEU", text: "FRED DEXUSEU" }, grenzen: [0.5, 2.5], text: "Wechselkurs; wichtig für US-Werte in Euro." },
  { id: "oel", name: "Ölpreis Brent", einheit: "USD", kategorie: "rohstoff", frequenz: "taeglich", vorlauf: "frueh", verzug: 1, quelle: { art: "fred", serie: "DCOILBRENTEU", text: "FRED DCOILBRENTEU" }, grenzen: [5, 500], text: "Energiepreise wirken auf Inflation und Margen." },
  { id: "immo-preis", name: "Wohnimmobilienpreise Deutschland", einheit: "Index", kategorie: "immobilien", frequenz: "quartal", vorlauf: "spaet", verzug: 45, quelle: { art: "manuell", text: "vdp, Europace oder Destatis Häuserpreisindex" }, grenzen: [10, 1000], text: "Wertentwicklung Wohnen; Maßstab für Immobilienprognosen." },
];
export const indikator = (id: string) => INDIKATOREN.find(i => i.id === id);

// ---------- Rechnen mit Zeitreihen ----------
const tag = 86_400_000;
export const plusTage = (d: string, n: number) => new Date(Date.parse(d) + n * tag).toISOString().slice(0, 10);
export const tageZwischen = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / tag);

/** Sortiert, ohne Doppelungen (späterer Wert gewinnt) */
export function ordne(p: Punkt[]): Punkt[] {
  const m = new Map<string, number>(); for (const x of p) if (Number.isFinite(x.w)) m.set(x.d.slice(0, 10), x.w);
  return [...m].map(([d, w]) => ({ d, w })).sort((a, b) => a.d.localeCompare(b.d));
}

/** Letzter bekannter Wert zum Stichtag. Mit Verzug: nur was zum Stichtag schon veröffentlicht war. */
export function wertAm(p: Punkt[] | undefined, stichtag: string, verzug = 0): number | null {
  if (!p?.length) return null; const grenze = plusTage(stichtag, -verzug);
  let lo = 0, hi = p.length - 1, r = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (p[m]!.d <= grenze) { r = m; lo = m + 1; } else hi = m - 1; }
  return r < 0 ? null : p[r]!.w;
}
/** Punkte bis zum Stichtag (unter Beachtung des Verzugs) */
export const bis = (p: Punkt[] | undefined, stichtag: string, verzug = 0) => (p ?? []).filter(x => x.d <= plusTage(stichtag, -verzug));
/** Erster Wert am oder nach dem Datum (für die Auflösung einer Prognose), höchstens `toleranz` Tage später */
export function wertNach(p: Punkt[] | undefined, datum: string, toleranz = 10): Punkt | null {
  const x = (p ?? []).find(q => q.d >= datum); return x && tageZwischen(datum, x.d) <= toleranz ? x : null;
}

/**
 * Netto-Liquidität (Mrd. $) = Fed-Bilanz − Reverse Repo − Finanzministeriumskonto, zum Stichtag.
 * Eine verbreitete Näherung dafür, wie viel Zentralbankgeld tatsächlich in den Märkten arbeitet.
 */
export function nettoLiquiditaet(r: Reihen, stichtag: string, vorTagen = 0): number | null {
  const fed = lies(r, "fed-bilanz", stichtag, vorTagen), rrp = lies(r, "reverse-repo", stichtag, vorTagen), tga = lies(r, "tga", stichtag, vorTagen);
  return fed == null || tga == null ? null : fed / 1000 - (rrp ?? 0) - tga / 1000;
}

/** Höchstalter eines Werts je Frequenz (Tage nach dem Stichtag des Werts, zusätzlich zum Veröffentlichungsverzug) */
export const MAX_ALTER: Record<Indikator["frequenz"], number> = { taeglich: 10, woechentlich: 21, monatlich: 75, quartal: 200 };

/** Letzter veröffentlichter Punkt zum Stichtag, null wenn keiner da oder er zu alt ist */
export function punktAktuell(r: Reihen, id: string, stichtag: string, vorTagen = 0): Punkt | null {
  const p = r[id]; if (!p?.length) return null; const ind = indikator(id); const verzug = ind?.verzug ?? 0;
  const tag = plusTage(stichtag, -vorTagen); const grenze = plusTage(tag, -verzug);
  let lo = 0, hi = p.length - 1, x = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (p[m]!.d <= grenze) { x = m; lo = m + 1; } else hi = m - 1; }
  if (x < 0) return null;
  const max = (ind ? MAX_ALTER[ind.frequenz] : 30) + verzug;
  return tageZwischen(p[x]!.d, tag) > max ? null : p[x]!;
}
/** Wert des Indikators zum Stichtag: mit Veröffentlichungsverzug, und nur, wenn er nicht veraltet ist */
export function lies(r: Reihen, id: string, stichtag: string, vorTagen = 0): number | null {
  return punktAktuell(r, id, stichtag, vorTagen)?.w ?? null;
}

export function gleitend(p: Punkt[], n: number): number | null { if (p.length < n) return null; let s = 0; for (const x of p.slice(-n)) s += x.w; return s / n; }

/** Relative-Stärke-Index nach Wilder */
export function rsi(p: Punkt[], n = 14): number | null {
  if (p.length < n + 1) return null; const w = p.slice(-(n * 5 + 1)).map(x => x.w);
  let auf = 0, ab = 0;
  for (let i = 1; i <= n; i++) { const d = w[i]! - w[i - 1]!; if (d > 0) auf += d; else ab -= d; }
  auf /= n; ab /= n;
  for (let i = n + 1; i < w.length; i++) { const d = w[i]! - w[i - 1]!; auf = (auf * (n - 1) + Math.max(d, 0)) / n; ab = (ab * (n - 1) + Math.max(-d, 0)) / n; }
  return ab === 0 ? 100 : 100 - 100 / (1 + auf / ab);
}

/** Schwankung je Tag (Standardabweichung der Log-Renditen, auf Kalendertage umgerechnet) */
export function schwankungJeTag(p: Punkt[], fenster = 250): number | null {
  const q = p.slice(-(fenster + 1)); if (q.length < 20 || q.some(x => x.w <= 0)) return null;
  const r: number[] = [];
  for (let i = 1; i < q.length; i++) { const t = Math.max(1, tageZwischen(q[i - 1]!.d, q[i]!.d)); r.push(Math.log(q[i]!.w / q[i - 1]!.w) / Math.sqrt(t)); }
  const m = r.reduce((a, b) => a + b, 0) / r.length; return Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / (r.length - 1));
}

/** Index in Veränderung zum Vorjahr (Prozent) */
export function vorjahr(p: Punkt[]): Punkt[] {
  const o = ordne(p); const out: Punkt[] = [];
  for (const x of o) { const ref = o.find(y => y.d <= plusTage(x.d, -350) && y.d >= plusTage(x.d, -380) && y.d.slice(5, 7) === x.d.slice(5, 7)); if (ref?.w) out.push({ d: x.d, w: Math.round((x.w / ref.w - 1) * 10000) / 100 }); }
  return out;
}
