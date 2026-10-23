import { indikator, wertNach } from "./indikatoren";
import { MECHANISMEN } from "./mechanismen";
import type { Prognose, Reihen } from "./types";

/**
 * Überprüfung: Jede Prognose wird bei Fälligkeit gegen den eingetretenen Wert gehalten.
 * Maße: Trefferquote der Richtung, Brier-Score (mittlerer quadrierter Fehler der Wahrscheinlichkeit,
 * 0 perfekt, 0,25 Münzwurf), Skill gegenüber der bloßen Grundhäufigkeit, Kalibrierung
 * („Wenn wir 70 % sagen, tritt es in 70 % der Fälle ein?“) und Abdeckung der 80-%-Spanne.
 */
export function bewerte(p: Prognose, reihen: Reihen, heute: string): Prognose {
  if (p.ergebnis || p.faellig > heute) return p;
  const tol = indikator(p.reihe)?.frequenz === "monatlich" ? 40 : indikator(p.reihe)?.frequenz === "quartal" ? 100 : 10;
  const x = wertNach(reihen[p.reihe], p.faellig, tol); if (!x || x.d > heute) return p;
  const hoch = x.w > p.ausgang; const o = hoch ? 1 : 0;
  const imBand = p.spanne ? x.w >= p.spanne.p10 && x.w <= p.spanne.p90 : null;
  return { ...p, ergebnis: { am: x.d, wert: x.w, hoch, brier: Math.round((p.pHoch - o) ** 2 * 10000) / 10000, imBand, fehlerProzent: p.spanne && p.ausgang ? Math.round((x.w / p.spanne.p50 - 1) * 10000) / 100 : 0 } };
}

export interface Bilanz {
  n: number;
  offen: number;
  trefferquote: number | null;
  brier: number | null;
  /** Brier der Grundhäufigkeit (immer die beobachtete Quote vorhersagen) */
  brierBasis: number | null;
  /** 1 − Brier / Basis: über 0 heißt besser als die Grundhäufigkeit */
  skill: number | null;
  bandAbdeckung: number | null;
  kalibrierung: { von: number; bis: number; n: number; vorhergesagt: number; eingetreten: number }[];
  jeMechanismus: { id: string; name: string; n: number; treffer: number; quote: number | null }[];
  jeZiel: { ziel: string; horizontTage: number; n: number; trefferquote: number | null; brier: number | null }[];
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const mittel = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

export function bilanz(alle: Prognose[]): Bilanz {
  const fertig = alle.filter(p => p.ergebnis); const n = fertig.length;
  const entschieden = fertig.filter(p => p.pHoch !== 0.5);
  const treffer = entschieden.filter(p => (p.pHoch > 0.5) === p.ergebnis!.hoch).length;
  const brier = mittel(fertig.map(p => p.ergebnis!.brier));
  const quote = mittel(fertig.map(p => (p.ergebnis!.hoch ? 1 : 0)));
  const brierBasis = quote == null ? null : quote * (1 - quote);
  const band = fertig.filter(p => p.ergebnis!.imBand != null);
  const stufen = [[0, 0.4], [0.4, 0.5], [0.5, 0.6], [0.6, 0.7], [0.7, 1.01]] as const;
  const kalibrierung = stufen.map(([von, bis]) => { const g = fertig.filter(p => p.pHoch >= von && p.pHoch < bis); return { von, bis: Math.min(1, bis), n: g.length, vorhergesagt: r3(mittel(g.map(p => p.pHoch)) ?? 0), eingetreten: r3(mittel(g.map(p => (p.ergebnis!.hoch ? 1 : 0))) ?? 0) }; }).filter(k => k.n);
  const jeMechanismus = MECHANISMEN.map(m => {
    const b = fertig.flatMap(p => p.beitraege.filter(x => x.mechanismus === m.id).map(x => (x.richtung === 1) === p.ergebnis!.hoch));
    return { id: m.id, name: m.name, n: b.length, treffer: b.filter(Boolean).length, quote: b.length ? r3(b.filter(Boolean).length / b.length) : null };
  });
  const schluessel = [...new Set(fertig.map(p => `${p.ziel}|${p.horizontTage}`))];
  const jeZiel = schluessel.map(k => { const [ziel, h] = k.split("|"); const g = fertig.filter(p => p.ziel === ziel && p.horizontTage === Number(h)); const e = g.filter(p => p.pHoch !== 0.5);
    return { ziel: ziel!, horizontTage: Number(h), n: g.length, trefferquote: e.length ? r3(e.filter(p => (p.pHoch > 0.5) === p.ergebnis!.hoch).length / e.length) : null, brier: g.length ? r3(mittel(g.map(p => p.ergebnis!.brier))!) : null }; });
  return {
    n, offen: alle.length - n,
    trefferquote: entschieden.length ? r3(treffer / entschieden.length) : null,
    brier: brier == null ? null : r3(brier), brierBasis: brierBasis == null ? null : r3(brierBasis),
    skill: brier != null && brierBasis ? r3(1 - brier / brierBasis) : null,
    bandAbdeckung: band.length ? r3(band.filter(p => p.ergebnis!.imBand).length / band.length) : null,
    kalibrierung, jeMechanismus, jeZiel,
  };
}

/**
 * Gewichte nachschärfen: Trefferquote je Mechanismus mit Laplace-Glättung (Treffer+2)/(n+4),
 * daraus ein Faktor zwischen 0,25 und 1,75 auf das Ausgangsgewicht. Unter 20 Fällen bleibt alles beim Alten.
 */
export function gewichteAus(b: Bilanz, mindestens = 20): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of b.jeMechanismus) {
    const basis = MECHANISMEN.find(x => x.id === m.id)!.gewicht;
    if (m.n < mindestens) { out[m.id] = basis; continue; }
    const q = (m.treffer + 2) / (m.n + 4);
    out[m.id] = Math.round(basis * Math.min(1.75, Math.max(0.25, 1 + (q - 0.5) * 3)) * 100) / 100;
  }
  return out;
}
