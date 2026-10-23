import { simuliere, type Simulation } from "./core";
import type { Objekt, Params, Szenario } from "./types";

/**
 * Prognose: Wertentwicklung aus Mietwachstum und Renditeveränderung, Bandbreite möglicher Verläufe,
 * Zerlegung des Vermögensaufbaus und Wirkung einzelner Parameter. Reine Rechnung, keine Empfehlung.
 */

/** Wert = Jahresmiete / Rendite. Wertentwicklung p. a. aus Mietwachstum und Verschiebung der Rendite über die Jahre. */
export function wertAusMarkt(mietwachstum: number, renditeHeute: number, renditeShift: number, jahre: number) {
  const y1 = Math.max(0.005, renditeHeute + renditeShift); const t = Math.max(1, jahre);
  const ausMiete = mietwachstum; const ausRendite = Math.pow(renditeHeute / y1, 1 / t) - 1;
  return { wertentwicklung: (1 + ausMiete) * (1 + ausRendite) - 1, ausMiete, ausRendite, renditeEnde: y1 };
}

/** Zerlegung des Ergebnisses am Ende der Haltedauer (vor Steuern) */
export function zerlegung(m: Simulation) {
  const ende = m.jahre[m.jahre.length - 1]!;
  const nebenkosten = m.gesamtinvestition - m.kaufpreis;
  const tilgung = m.darlehen - ende.restschuld;
  const wertzuwachs = ende.wert - m.kaufpreis;
  const cashflow = m.jahre.reduce((a, j) => a + j.cashflow, 0) + m.beimKauf;
  const ergebnis = ende.nettovermoegen + cashflow - m.ekEinsatz;
  return { eigenkapital: m.ekEinsatz, nebenkosten: -nebenkosten, tilgung, wertzuwachs, cashflow, ergebnis, vermoegenEnde: ende.nettovermoegen };
}

/** Wirkung von einem Prozentpunkt je Parameter auf Nettovermögen am Ende und Eigenkapitalrendite */
export function elastizitaeten(p: Params, o: Objekt, miete: number | null, s: Szenario) {
  const basis = simuliere(p, o, miete, s); if (!basis) return null;
  const teste: [string, keyof Szenario, number, string][] = [
    ["Wertentwicklung", "wertentwicklung", 0.01, "+1 %-Pkt. p. a."], ["Mietsteigerung", "mietsteigerung", 0.01, "+1 %-Pkt. p. a."],
    ["Anschlusszins", "anschlusszinsAufschlag", 0.01, "+1 %-Pkt."], ["Kostensteigerung", "kostensteigerung", 0.01, "+1 %-Pkt. p. a."],
    ["Sollzins heute", "sollzins", 0.01, "+1 %-Pkt."], ["Leerstand", "leerstandZusatz", 0.01, "+1 %-Pkt."],
  ];
  return teste.map(([label, key, d, text]) => { const m = simuliere(p, o, miete, { ...s, [key]: (s[key] as number) + d })!; return { label, key, text, nv: m.nettovermoegenEnde - basis.nettovermoegenEnde, irr: m.irr != null && basis.irr != null ? m.irr - basis.irr : null, cf: m.cashflowSumme - basis.cashflowSumme }; })
    .sort((a, b) => Math.abs(b.nv + b.cf) - Math.abs(a.nv + a.cf));
}

/** Streuung der Marktparameter (Standardabweichung je Jahr bzw. einmalig) */
export interface Streuung { mietsteigerung: number; wertentwicklung: number; anschlusszins: number; kostensteigerung: number; leerstand: number }
export const STANDARD_STREUUNG: Streuung = { mietsteigerung: 0.01, wertentwicklung: 0.015, anschlusszins: 0.01, kostensteigerung: 0.01, leerstand: 0.02 };

// Reproduzierbarer Zufall: gleiche Eingaben ergeben gleiche Bandbreite
function zufall(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const normal = (r: () => number) => Math.sqrt(-2 * Math.log(Math.max(1e-12, r()))) * Math.cos(2 * Math.PI * r());
const quantil = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); const i = (s.length - 1) * q; const lo = Math.floor(i); return s[lo]! + (s[Math.ceil(i)]! - s[lo]!) * (i - lo); };

/**
 * Bandbreite möglicher Verläufe: viele Simulationen mit gestreuten Marktparametern um Ihre Einstellung.
 * Ergebnis je Jahr: 10 %, 50 % und 90 % Quantil von Wert und Nettovermögen, dazu Kennzahlen am Ende.
 */
export function bandbreite(p: Params, o: Objekt, miete: number | null, s: Szenario, streuung: Streuung = STANDARD_STREUUNG, n = 400) {
  if (!simuliere(p, o, miete, s)) return null;
  const r = zufall(Math.round((o.kaufpreis ?? 0) + (miete ?? 0) * 7 + s.haltedauer * 13));
  const laeufe: Simulation[] = [];
  for (let i = 0; i < n; i++) {
    const x: Szenario = { ...s,
      mietsteigerung: s.mietsteigerung + normal(r) * streuung.mietsteigerung,
      wertentwicklung: s.wertentwicklung + normal(r) * streuung.wertentwicklung,
      anschlusszinsAufschlag: s.anschlusszinsAufschlag + normal(r) * streuung.anschlusszins,
      kostensteigerung: s.kostensteigerung + normal(r) * streuung.kostensteigerung,
      leerstandZusatz: Math.max(0, s.leerstandZusatz + Math.abs(normal(r)) * streuung.leerstand),
    };
    const m = simuliere(p, o, miete, x); if (m) laeufe.push(m);
  }
  const jahre = laeufe[0]!.jahre.map((_, t) => {
    const w = laeufe.map(m => m.jahre[t]!.wert); const nv = laeufe.map(m => m.jahre[t]!.nettovermoegen);
    return { jahr: t + 1, wert: [quantil(w, 0.1), quantil(w, 0.5), quantil(w, 0.9)] as const, nv: [quantil(nv, 0.1), quantil(nv, 0.5), quantil(nv, 0.9)] as const };
  });
  const ergebnis = laeufe.map(m => zerlegung(m).ergebnis);
  const cfMin = laeufe.map(m => Math.min(...m.jahre.map(j => j.cashflow)) / 12);
  return {
    jahre, n: laeufe.length,
    ergebnis: [quantil(ergebnis, 0.1), quantil(ergebnis, 0.5), quantil(ergebnis, 0.9)] as const,
    verlustQuote: ergebnis.filter(e => e < 0).length / ergebnis.length,
    irr: [quantil(laeufe.map(m => m.irr ?? 0), 0.1), quantil(laeufe.map(m => m.irr ?? 0), 0.5), quantil(laeufe.map(m => m.irr ?? 0), 0.9)] as const,
    schwaechstesJahr: quantil(cfMin, 0.1),
  };
}
export type Bandbreite = NonNullable<ReturnType<typeof bandbreite>>;
