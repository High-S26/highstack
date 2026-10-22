import { mitStellplaetzen, type Analyse, type Objekt } from "@highstack/engine";

/** Achsen des Netzdiagramms: wie gut ein Objekt zum Anlageprofil passt, je 0 bis 100 (null = Daten fehlen). */
export interface Achse { key: string; label: string; wert: number | null; text: string }
const lin = (x: number, x0: number, y0: number, x1: number, y1: number) => Math.max(0, Math.min(100, y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)));
const r = (v: number | null | undefined) => (v == null || !isFinite(v) ? null : Math.round(v));

export function matchAchsen(o: Objekt, a: Analyse): Achse[] {
  const b = a.bewertung; const k = b.kennzahlen; const t = b.teilscores; const ap = a.params.anlageprofil;
  const kp = mitStellplaetzen(o).kaufpreis;
  const budget = kp && k.kpMax ? lin(kp / k.kpMax, 1.3, 0, 0.85, 100) : null;
  const suche = (b.regionOk ? 50 : 0) + (!ap.assetklassen.length || ap.assetklassen.includes(o.asset) ? 50 : 0);
  return [
    { key: "rendite", label: "Rendite", wert: r(t.rendite), text: "Bruttorendite gegen Ihre Mindestrendite" },
    { key: "cashflow", label: "Cashflow", wert: r(k.cashflowMonat == null ? null : lin(k.cashflowMonat, ap.minCashflow - 400, 0, ap.minCashflow + 150, 100)), text: "Monatlicher Überschuss gegen Ihr Ziel" },
    { key: "budget", label: "Budget", wert: r(budget), text: "Preis gegen den Rahmen aus Ihrem Kapital" },
    { key: "finanzierung", label: "Finanzierung", wert: r(t.finanzierung), text: "Schuldendienstdeckung und Beleihung" },
    { key: "substanz", label: "Substanz", wert: r(t.substanz), text: "Energieklasse, Sonderumlagen" },
    { key: "markt", label: "Preis/Markt", wert: r(t.lage), text: "Preis je m² gegen Vergleichspreis" },
    { key: "suche", label: "Suche", wert: suche, text: "Region und Objektart wie im Anlageprofil" },
  ];
}
