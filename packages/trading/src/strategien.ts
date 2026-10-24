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
  const vw = vwap(bars); const abw = bars.slice(-w.fenster).map(b => b.c - vwap(bars.slice(0, bars.indexOf(b) + 1)));
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

export const STRATEGIEN: Record<StrategieTyp, { name: string; text: string; fn: typeof ausbruch }> = {
  ausbruch: { name: "Ausbruch", text: "Kauft, wenn der Kurs die Spanne der ersten Handelsminuten mit viel Volumen verlässt.", fn: ausbruch },
  mittelwert: { name: "Rückkehr zum Mittelwert", text: "Kauft deutlich unter dem Tagesdurchschnitt und zielt auf die Rückkehr dorthin.", fn: mittelwert },
  anomalie: { name: "Auffälligkeiten", text: "Reagiert auf ungewöhnliche Kurs- und Volumensprünge in Richtung des Sprungs.", fn: anomalie },
};
