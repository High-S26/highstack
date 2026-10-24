import { kurs as k2, zahl } from "./format";
import type { Bar, Signal, StrategieTyp, StrategieWerte } from "./types";

const mittel = (x: number[]) => x.reduce((a, b) => a + b, 0) / Math.max(1, x.length);
const stdabw = (x: number[]) => { const m = mittel(x); return Math.sqrt(mittel(x.map(v => (v - m) ** 2))); };
export const vwap = (bars: Bar[]) => { const v = bars.reduce((a, b) => a + b.v, 0); return v ? bars.reduce((a, b) => a + ((b.h + b.l + b.c) / 3) * b.v, 0) / v : bars.at(-1)?.c ?? 0; };
const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Ausbruch aus der Eröffnungsspanne: Schlusskurs über dem Hoch der ersten Minuten bei erhöhtem Volumen.
 * Stopp am anderen Ende der Spanne, Ziel als Vielfaches des Risikos.
 */
export function ausbruch(symbol: string, bars: Bar[], w: StrategieWerte, short: boolean): Signal | null {
  if (bars.length <= w.spanneMin + 1) return null;
  const spanne = bars.slice(0, w.spanneMin); const hoch = Math.max(...spanne.map(b => b.h)); const tief = Math.min(...spanne.map(b => b.l));
  const letzte = bars.at(-1)!; const vorher = bars.at(-2)!; const vol = mittel(bars.slice(-w.fenster - 1, -1).map(b => b.v));
  if (letzte.v < w.volumenFaktor * vol) return null;
  if (letzte.c > hoch && vorher.c <= hoch) { const stopp = Math.max(tief, letzte.c - (hoch - tief)); const risiko = letzte.c - stopp; if (risiko <= 0) return null;
    return { symbol, richtung: "long", kurs: letzte.c, stopp: r2(stopp), ziel: r2(letzte.c + w.zielR * risiko), staerke: Math.min(1, letzte.v / vol / 4), grund: `Ausbruch über das Hoch der ersten ${w.spanneMin} Minuten (${k2(hoch)}) mit ${zahl(letzte.v / vol, 1)}-fachem Volumen` }; }
  if (short && letzte.c < tief && vorher.c >= tief) { const stopp = Math.min(hoch, letzte.c + (hoch - tief)); const risiko = stopp - letzte.c; if (risiko <= 0) return null;
    return { symbol, richtung: "short", kurs: letzte.c, stopp: r2(stopp), ziel: r2(letzte.c - w.zielR * risiko), staerke: Math.min(1, letzte.v / vol / 4), grund: `Bruch unter das Tief der ersten ${w.spanneMin} Minuten (${k2(tief)}) mit ${zahl(letzte.v / vol, 1)}-fachem Volumen` }; }
  return null;
}

/** Rückkehr zum Mittelwert: Kurs weit unter (über) dem volumengewichteten Durchschnitt des Tages, Ziel der Durchschnitt */
export function mittelwert(symbol: string, bars: Bar[], w: StrategieWerte, short: boolean): Signal | null {
  if (bars.length < w.fenster + 2) return null;
  // laufender VWAP in einem Durchgang (statt für jede Minute neu über alle Minuten)
  const lauf: number[] = []; let pv = 0, vv = 0; for (const b of bars) { pv += ((b.h + b.l + b.c) / 3) * b.v; vv += b.v; lauf.push(vv ? pv / vv : b.c); }
  const vw = lauf.at(-1)!; const abw = bars.slice(-w.fenster).map((b, i) => b.c - lauf[bars.length - w.fenster + i]!);
  const s = stdabw(abw); if (!s) return null;
  const letzte = bars.at(-1)!; const z = (letzte.c - vw) / s;
  if (z <= -w.z) { const stopp = letzte.c - (vw - letzte.c) / w.zielR; return { symbol, richtung: "long", kurs: letzte.c, stopp: r2(stopp), ziel: r2(vw), staerke: Math.min(1, -z / (2 * w.z)), grund: `${zahl(-z, 1)} Standardabweichungen unter dem Tagesdurchschnitt (${k2(vw)})` }; }
  if (short && z >= w.z) { const stopp = letzte.c + (letzte.c - vw) / w.zielR; return { symbol, richtung: "short", kurs: letzte.c, stopp: r2(stopp), ziel: r2(vw), staerke: Math.min(1, z / (2 * w.z)), grund: `${zahl(z, 1)} Standardabweichungen über dem Tagesdurchschnitt (${k2(vw)})` }; }
  return null;
}

/** Auffälligkeit: Kurssprung und Volumensprung zugleich, in Richtung des Sprungs */
export function anomalie(symbol: string, bars: Bar[], w: StrategieWerte, short: boolean): Signal | null {
  if (bars.length < w.fenster + 2) return null;
  const fenster = bars.slice(-w.fenster - 1, -1); const letzte = bars.at(-1)!; const vorher = bars.at(-2)!;
  const renditen = fenster.slice(1).map((b, i) => b.c / fenster[i]!.c - 1); const r = letzte.c / vorher.c - 1;
  const zr = (r - mittel(renditen)) / (stdabw(renditen) || 1e-9); const zv = (letzte.v - mittel(fenster.map(b => b.v))) / (stdabw(fenster.map(b => b.v)) || 1e-9);
  if (zv < w.z) return null;
  if (zr >= 2) { const stopp = Math.min(letzte.l, letzte.c * 0.995); const risiko = letzte.c - stopp; return { symbol, richtung: "long", kurs: letzte.c, stopp: r2(stopp), ziel: r2(letzte.c + w.zielR * risiko), staerke: Math.min(1, zv / (2 * w.z)), grund: `Auffälligkeit: Kurs +${zahl(r * 100)} % in einer Minute (${zahl(zr, 1)} σ), Volumen ${zahl(zv, 1)} σ über normal` }; }
  if (short && zr <= -2) { const stopp = Math.max(letzte.h, letzte.c * 1.005); const risiko = stopp - letzte.c; return { symbol, richtung: "short", kurs: letzte.c, stopp: r2(stopp), ziel: r2(letzte.c - w.zielR * risiko), staerke: Math.min(1, zv / (2 * w.z)), grund: `Auffälligkeit: Kurs ${zahl(r * 100)} % in einer Minute (${zahl(zr, 1)} σ), Volumen ${zahl(zv, 1)} σ über normal` }; }
  return null;
}

/** Kontext für Strategien, die den Markt brauchen (z. B. SPY als Vergleich) */
export interface Kontext { markt?: Bar[] }

/**
 * Momentum der letzten Handelsstunde: Die Bewegung der ersten 30 Minuten setzt sich zum Handelsschluss häufig fort
 * (Gao/Han/Li/Zhou 2018, „Market intraday momentum“). Einstieg um 15:00 New York in Richtung der Eröffnungsbewegung.
 */
export function momentum(symbol: string, bars: Bar[], w: StrategieWerte, short: boolean): Signal | null {
  if (bars.length < 331 || bars.length > 336) return null; // nur im Fenster 15:00 bis 15:05
  const r30 = bars[29]!.c / bars[0]!.o - 1; const schwelle = (w.schwelle ?? 0.3) / 100;
  const letzte = bars.at(-1)!; const atr = mittel(bars.slice(-30).map(b => b.h - b.l)) || letzte.c * 0.001;
  if (r30 >= schwelle) { const stopp = letzte.c - 2 * atr; return { symbol, richtung: "long", kurs: letzte.c, stopp: r2(stopp), ziel: r2(letzte.c + w.zielR * 2 * atr), staerke: Math.min(1, r30 / (3 * schwelle)), grund: `Erste 30 Minuten ${zahl(r30 * 100)} %: Momentum zum Handelsschluss` }; }
  if (short && r30 <= -schwelle) { const stopp = letzte.c + 2 * atr; return { symbol, richtung: "short", kurs: letzte.c, stopp: r2(stopp), ziel: r2(letzte.c - w.zielR * 2 * atr), staerke: Math.min(1, -r30 / (3 * schwelle)), grund: `Erste 30 Minuten ${zahl(r30 * 100)} %: Momentum zum Handelsschluss` }; }
  return null;
}

/**
 * Relative Stärke mit Marktfilter: Wert läuft seit Eröffnung deutlich besser als der Markt (SPY), der Markt selbst
 * steigt, und der Kurs liegt über dem Tagesdurchschnitt. Short spiegelbildlich bei fallendem Markt.
 */
export function staerke(symbol: string, bars: Bar[], w: StrategieWerte, short: boolean, ctx?: Kontext): Signal | null {
  const m = ctx?.markt; if (!m || m.length < 31 || bars.length < 31 || bars.length !== m.length) return null;
  const rS = bars.at(-1)!.c / bars[0]!.o - 1; const rM = m.at(-1)!.c / m[0]!.o - 1; const rel = rS - rM; const schwelle = (w.schwelle ?? 1) / 100;
  const vorher = bars.at(-2)!.c / bars[0]!.o - 1 - (m.at(-2)!.c / m[0]!.o - 1);
  const letzte = bars.at(-1)!; const vw = vwap(bars);
  if (rM > 0 && rel >= schwelle && vorher < schwelle && letzte.c > vw) { const stopp = Math.min(vw, letzte.c * 0.993); const risiko = letzte.c - stopp; if (risiko <= 0) return null; return { symbol, richtung: "long", kurs: letzte.c, stopp: r2(stopp), ziel: r2(letzte.c + w.zielR * risiko), staerke: Math.min(1, rel / (3 * schwelle)), grund: `${zahl(rel * 100)} %-Punkte stärker als der Markt (${zahl(rM * 100)} %), über dem Tagesdurchschnitt` }; }
  if (short && rM < 0 && rel <= -schwelle && vorher > -schwelle && letzte.c < vw) { const stopp = Math.max(vw, letzte.c * 1.007); const risiko = stopp - letzte.c; if (risiko <= 0) return null; return { symbol, richtung: "short", kurs: letzte.c, stopp: r2(stopp), ziel: r2(letzte.c - w.zielR * risiko), staerke: Math.min(1, -rel / (3 * schwelle)), grund: `${zahl(-rel * 100)} %-Punkte schwächer als der Markt (${zahl(rM * 100)} %), unter dem Tagesdurchschnitt` }; }
  return null;
}

export const STRATEGIEN: Record<StrategieTyp, { name: string; text: string; fn: (symbol: string, bars: Bar[], w: StrategieWerte, short: boolean, ctx?: Kontext) => Signal | null; braucht?: "markt" }> = {
  ausbruch: { name: "Ausbruch", text: "Kauft, wenn der Kurs die Spanne der ersten Handelsminuten mit viel Volumen verlässt.", fn: ausbruch },
  mittelwert: { name: "Rückkehr zum Mittelwert", text: "Kauft deutlich unter dem Tagesdurchschnitt und zielt auf die Rückkehr dorthin.", fn: mittelwert },
  anomalie: { name: "Auffälligkeiten", text: "Reagiert auf ungewöhnliche Kurs- und Volumensprünge in Richtung des Sprungs.", fn: anomalie },
  momentum: { name: "Momentum letzte Stunde", text: "Steigt um 15 Uhr New York in Richtung der ersten 30 Minuten ein; belegt für breite Märkte (SPY, QQQ).", fn: momentum },
  staerke: { name: "Relative Stärke", text: "Kauft Werte, die bei steigendem Markt deutlich besser laufen als der S&P 500 (SPY).", fn: staerke, braucht: "markt" },
};
