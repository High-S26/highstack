import { bis, gleitend, lies, nettoLiquiditaet, plusTage, punktAktuell, schwankungJeTag, tageZwischen } from "./indikatoren";
import { fehlendeDaten, MECHANISMEN } from "./mechanismen";
import type { Lagebild, Prognose, Regime, Risikolage, Wirkung, Ziel } from "./types";

export const MODELL = "wirkungsketten-1";

/** An welcher Reihe ein Ziel gemessen wird */
export const reiheFuer = (ziel: Ziel, symbol?: string) => ({ "aktien-us": "sp500", "aktien-eu": "dax", "zins-lang": "us10j", "immo-wert": "immo-preis", volatilitaet: "vix", einzelwert: `kurs:${symbol}` })[ziel];
export const ZIEL_NAME: Record<Ziel, string> = { "aktien-us": "Aktien USA (S&P 500)", "aktien-eu": "Aktien Deutschland (DAX)", "zins-lang": "Langfristige Zinsen (US 10J)", "immo-wert": "Wohnimmobilienpreise", volatilitaet: "Schwankung (VIX)", einzelwert: "Einzelwert" };

/** Grundwahrscheinlichkeit für „steigt“ ohne jedes Signal (langfristige Häufigkeit) */
const BASIS: Record<Ziel, (h: number) => number> = { "aktien-us": h => (h >= 180 ? 0.7 : h >= 60 ? 0.6 : 0.55), "aktien-eu": h => (h >= 180 ? 0.65 : h >= 60 ? 0.57 : 0.53), "zins-lang": () => 0.5, "immo-wert": () => 0.62, volatilitaet: () => 0.45, einzelwert: () => 0.52 };
/** Feste Prognosehorizonte je Ziel (Tage) */
export const HORIZONTE: Record<Ziel, number[]> = { "aktien-us": [30, 90, 365], "aktien-eu": [30, 90, 365], "zins-lang": [90], "immo-wert": [365], volatilitaet: [30], einzelwert: [10] };

const logit = (p: number) => Math.log(p / (1 - p));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
/** Quantil der Standardnormalverteilung (Acklam) */
export function normQuantil(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const q = Math.min(Math.max(p, 1e-9), 1 - 1e-9);
  if (q < 0.02425) { const r = Math.sqrt(-2 * Math.log(q)); return (((((c[0]! * r + c[1]!) * r + c[2]!) * r + c[3]!) * r + c[4]!) * r + c[5]!) / ((((d[0]! * r + d[1]!) * r + d[2]!) * r + d[3]!) * r + 1); }
  if (q > 1 - 0.02425) return -normQuantil(1 - q);
  const r = q - 0.5, s = r * r;
  return (((((a[0]! * s + a[1]!) * s + a[2]!) * s + a[3]!) * s + a[4]!) * s + a[5]!) * r / (((((b[0]! * s + b[1]!) * s + b[2]!) * s + b[3]!) * s + b[4]!) * s + 1);
}

/** Wahrscheinlichkeit für „steigt“ aus den Wirkungen eines Ziels, auf der Log-Odds-Skala kombiniert */
export function wahrscheinlichkeit(ziel: Ziel, h: number, eigene: Wirkung[], gewichte: Record<string, number> = {}) {
  let x = logit(BASIS[ziel](h)); const beitraege: Prognose["beitraege"] = [];
  for (const e of eigene) {
    const g = gewichte[e.mechanismus] ?? MECHANISMEN.find(m => m.id === e.mechanismus)?.gewicht ?? 0.5;
    const passung = Math.min(e.horizontTage, h) / Math.max(e.horizontTage, h);
    const b = g * e.staerke * passung * 1.2; if (b < 0.02) continue;
    x += e.richtung * b; beitraege.push({ mechanismus: e.mechanismus, richtung: e.richtung, staerke: Math.round(b * 100) / 100, grund: e.grund });
  }
  return { pHoch: Math.min(0.92, Math.max(0.08, sigmoid(x))), beitraege };
}

export function wirkungen(l: Lagebild): Wirkung[] {
  return MECHANISMEN.flatMap(m => { try { return m.wirkung(l); } catch { return []; } });
}

/**
 * Prognosen zum Stichtag: je Ziel und Horizont eine Wahrscheinlichkeit für „steigt“ und eine Spanne.
 * Kombination auf der Log-Odds-Skala: Grundwahrscheinlichkeit plus gewichtete Beiträge;
 * ein Beitrag zählt umso mehr, je besser sein eigener Horizont zum Prognosehorizont passt.
 */
export function prognosen(l: Lagebild, gewichte: Record<string, number> = {}, id = (i: number) => `p${l.stichtag}-${i}`): Prognose[] {
  const alle = wirkungen(l); const out: Prognose[] = [];
  const gruppen = new Map<string, { ziel: Ziel; symbol?: string }>();
  for (const z of Object.keys(HORIZONTE) as Ziel[]) if (z !== "einzelwert") gruppen.set(z, { ziel: z });
  for (const x of alle) if (x.ziel === "einzelwert" && x.symbol) gruppen.set(`einzelwert:${x.symbol}`, { ziel: "einzelwert", symbol: x.symbol });
  for (const { ziel, symbol } of gruppen.values()) {
    const reihe = reiheFuer(ziel, symbol); const p = bis(l.reihen[reihe], l.stichtag);
    // Ausgangswert muss aktuell sein; Kursreihen von Einzelwerten höchstens 10 Tage alt
    const ausgang = reihe.startsWith("kurs:") ? (p.at(-1) && tageZwischen(p.at(-1)!.d, l.stichtag) <= 10 ? p.at(-1)!.w : null) : lies(l.reihen, reihe, l.stichtag);
    if (ausgang == null) continue;
    const eigene = alle.filter(x => x.ziel === ziel && x.symbol === symbol);
    const sigma = schwankungJeTag(p);
    for (const h of HORIZONTE[ziel]) {
      const { pHoch, beitraege } = wahrscheinlichkeit(ziel, h, eigene, gewichte);
      let spanne: Prognose["spanne"];
      if (sigma && ausgang > 0) {
        const s = sigma * Math.sqrt(h); const m = normQuantil(pHoch) * s; const r = (v: number) => Math.round(v * 100) / 100;
        spanne = { p10: r(ausgang * Math.exp(m - 1.2816 * s)), p50: r(ausgang * Math.exp(m)), p90: r(ausgang * Math.exp(m + 1.2816 * s)) };
      }
      out.push({ id: id(out.length), erstellt: l.stichtag, ziel, ...(symbol ? { symbol } : {}), reihe, horizontTage: h, faellig: plusTage(l.stichtag, h), ausgang, pHoch: Math.round(pHoch * 1000) / 1000, ...(spanne ? { spanne } : {}), beitraege, modell: MODELL });
    }
  }
  return out;
}

/** Konjunkturphase nach Wachstums- und Inflationstrend (Investment Clock) */
export function regime(l: Lagebild): { regime: Regime; text: string; wachstum: number | null; inflation: number | null; liquiditaet: number | null } {
  const lj = nettoLiquiditaet(l.reihen, l.stichtag), lv = nettoLiquiditaet(l.reihen, l.stichtag, 91);
  const liquiditaet = lj != null && lv != null && lv > 0 ? lj / lv - 1 : null;
  const liqText = liquiditaet == null ? "" : ` Liquidität: ${liquiditaet >= 0.02 ? "steigend, Rückenwind" : liquiditaet <= -0.02 ? "sinkend, Gegenwind" : "seitwärts"}.`;
  const r0 = regimeOhneLiquiditaet(l); return { ...r0, text: r0.text + liqText, liquiditaet };
}
function regimeOhneLiquiditaet(l: Lagebild): { regime: Regime; text: string; wachstum: number | null; inflation: number | null } {
  const trend = (ids: string[]) => { for (const id of ids) { const j = lies(l.reihen, id, l.stichtag), v = lies(l.reihen, id, l.stichtag, 90); if (j != null && v != null) return j - v; } return null; };
  const wa = trend(["pmi-us", "pmi-ez", "ifo"]); const inf = trend(["inflation-us", "inflation-ez"]);
  if (wa == null || inf == null) return { regime: "unklar", text: "Für die Konjunkturphase fehlen Einkaufsmanager- oder Inflationsdaten.", wachstum: wa, inflation: inf };
  const TEXT: Record<Exclude<Regime, "unklar">, string> = {
    erholung: "Erholung: Wachstum zieht an, Inflation sinkt. Historisch die beste Phase für Aktien; Zinsen bleiben niedrig, gut für Immobilienwerte.",
    ueberhitzung: "Überhitzung: Wachstum und Inflation steigen. Notenbanken straffen; Rohstoffe und Sachwerte halten sich, Anleihen leiden.",
    stagflation: "Stagflation: Wachstum schwächt sich ab, Inflation steigt. Schwierig für Aktien und Anleihen; Liquidität und kurze Laufzeiten.",
    abschwung: "Abschwung: Wachstum und Inflation sinken. Anleihen profitieren, Zinsen fallen; Immobilienwerte stabilisieren sich mit Verzögerung.",
  };
  const r: Exclude<Regime, "unklar"> = wa >= 0 ? (inf <= 0 ? "erholung" : "ueberhitzung") : (inf > 0 ? "stagflation" : "abschwung");
  return { regime: r, text: TEXT[r], wachstum: wa, inflation: inf };
}

/** Risikolage für die Positionsgröße im Trading */
export function risikolage(l: Lagebild): { lage: Risikolage; faktor: number; gruende: string[] } {
  let s = 0; const g: string[] = [];
  const de = (v: number, n = 1) => v.toLocaleString("de-DE", { minimumFractionDigits: n, maximumFractionDigits: n });
  const stand = (d: string) => `Stand ${d.slice(8, 10)}.${d.slice(5, 7)}.`;
  const p = bis(l.reihen["sp500"], l.stichtag); const ma = gleitend(p, 200); const letzt = p.at(-1);
  if (ma && letzt && tageZwischen(letzt.d, l.stichtag) <= 10) { if (letzt.w > ma) { s += 1; g.push(`S&P 500 über der 200-Tage-Linie (${stand(letzt.d)})`); } else { s -= 1; g.push(`S&P 500 unter der 200-Tage-Linie (${stand(letzt.d)})`); } }
  const vp = punktAktuell(l.reihen, "vix", l.stichtag);
  if (vp) { const v = vp.w; const t = `${de(v)}, ${stand(vp.d)}`; if (v < 20) { s += 1; g.push(`VIX ruhig (${t})`); } else if (v > 30) { s -= 2; g.push(`VIX hoch (${t})`); } else { s -= 1; g.push(`VIX erhöht (${t})`); } }
  const h = lies(l.reihen, "hy-spread", l.stichtag), h0 = lies(l.reihen, "hy-spread", l.stichtag, 90);
  if (h != null && h0 != null) { if (h - h0 > 0.75) { s -= 1; g.push("Kreditaufschläge steigen"); } else if (h - h0 < -0.5) { s += 0.5; g.push("Kreditaufschläge sinken"); } }
  // Termine mit Uhrzeit zählen nur an ihrem Tag (die Intraday-Pause im Trading deckt den Zeitpunkt ab), ohne Uhrzeit auch am Vortag
  const wichtig = l.ereignisse.filter(e => e.wichtig && !e.symbol && (e.datum === l.stichtag || (!e.zeit && e.datum === plusTage(l.stichtag, 1))));
  const terminFaktor = !wichtig.length ? 1 : wichtig.some(e => !e.zeit) ? 0.5 : 0.75;
  if (wichtig.length) g.push(`Termin: ${wichtig.map(e => e.zeit ? `${e.titel} (${e.zeit} Uhr)` : e.titel).join(", ")}`);
  if (!g.length) return { lage: "neutral", faktor: 1, gruende: ["Keine aktuellen Marktdaten; Positionsgröße unverändert"] };
  // Fehlt der VIX oder ist er veraltet, gibt es keine Entwarnung: höchstens „neutral“
  if (!vp) g.push("VIX fehlt oder ist veraltet");
  let lage: Risikolage = s >= 1 ? "risk-on" : s <= -2 ? "risk-off" : "neutral"; if (!vp && lage === "risk-on") lage = "neutral";
  const faktor = (lage === "risk-on" ? 1 : lage === "neutral" ? 0.75 : 0.5) * terminFaktor;
  return { lage, faktor, gruende: g };
}

export function lage(l: Lagebild, gewichte: Record<string, number> = {}) {
  return { stichtag: l.stichtag, regime: regime(l), risiko: risikolage(l), wirkungen: wirkungen(l), fehlend: fehlendeDaten(l), prognosen: prognosen(l, gewichte) };
}
