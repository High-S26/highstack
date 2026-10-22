import { simuliere, type Simulation } from "./core";
import type { Objekt, Params, Szenario } from "./types";

/**
 * Externe Faktoren: was der Markt mit dem Objekt macht, unabhängig vom Verhandeln.
 * Zinsniveau nach der Zinsbindung, Wertentwicklung, Inflation, Mietmarkt, Leerstand, Ausstiegszeitpunkt.
 * Wird bei Bedarf gerechnet (rund 45 Simulationen), nicht in jeder Analyse.
 */
export type Messgroesse = "irr" | "nv" | "cf" | "cfMin";
export const messe = (m: Simulation | null, g: Messgroesse): number | null => !m ? null : g === "irr" ? m.irr : g === "nv" ? m.nettovermoegenEnde : g === "cf" ? m.cashflowSchnittMonat : Math.min(...m.jahre.map(j => j.cashflow)) / 12;

export const ZINS_STUFEN = [-0.01, 0, 0.01, 0.02, 0.03];
/** Abweichungen von Ihrer Annahme zur Wertentwicklung, in Prozentpunkten p. a. */
export const WERT_STUFEN = [-0.02, -0.01, 0, 0.01, 0.02];

export const STRESS: { id: string; name: string; text: string; s: (b: Szenario) => Partial<Szenario> }[] = [
  { id: "zinsschock", name: "Zinsschock", text: "Anschlusszins 3 %-Punkte über heute, Wertentwicklung −0,5 % p. a.", s: b => ({ anschlusszinsAufschlag: b.anschlusszinsAufschlag + 0.03, wertentwicklung: -0.005 }) },
  { id: "stagflation", name: "Stagflation", text: "Kosten +4 % p. a., Mieten nur +1 % p. a., Werte stagnieren", s: () => ({ kostensteigerung: 0.04, mietsteigerung: 0.01, wertentwicklung: 0 }) },
  { id: "krise", name: "Immobilienkrise", text: "Werte −2 % p. a., 8 %-Punkte mehr Leerstand, Anschlusszins +1,5", s: b => ({ wertentwicklung: -0.02, leerstandZusatz: b.leerstandZusatz + 0.08, anschlusszinsAufschlag: b.anschlusszinsAufschlag + 0.015 }) },
  { id: "rueckenwind", name: "Rückenwind", text: "Werte +3 % p. a., Mieten +3 % p. a., Anschlusszins 1 %-Punkt günstiger", s: b => ({ wertentwicklung: 0.03, mietsteigerung: 0.03, anschlusszinsAufschlag: b.anschlusszinsAufschlag - 0.01 }) },
];

export function externeFaktoren(p: Params, o: Objekt, miete: number | null, s: Szenario) {
  const sim = (x: Partial<Szenario>) => simuliere(p, o, miete, { ...s, ...x });
  const basis = sim({});
  if (!basis) return null;
  const matrix = ZINS_STUFEN.map(dz => WERT_STUFEN.map(w => sim({ anschlusszinsAufschlag: s.anschlusszinsAufschlag + dz, wertentwicklung: s.wertentwicklung + w })));
  const faktoren: { label: string; text: string; schlechter: Simulation | null; besser: Simulation | null }[] = [
    { label: "Zinsniveau nach Zinsbindung ±2 %-Pkt.", text: "Anschlussfinanzierung teurer oder günstiger", schlechter: sim({ anschlusszinsAufschlag: s.anschlusszinsAufschlag + 0.02 }), besser: sim({ anschlusszinsAufschlag: s.anschlusszinsAufschlag - 0.02 }) },
    { label: "Wertentwicklung ±1,5 %-Pkt.", text: "Marktpreise steigen schneller oder fallen", schlechter: sim({ wertentwicklung: s.wertentwicklung - 0.015 }), besser: sim({ wertentwicklung: s.wertentwicklung + 0.015 }) },
    { label: "Inflation ±1,5 %-Pkt.", text: "Mieten und Kosten steigen gemeinsam", schlechter: sim({ mietsteigerung: s.mietsteigerung - 0.015, kostensteigerung: s.kostensteigerung - 0.015 }), besser: sim({ mietsteigerung: s.mietsteigerung + 0.015, kostensteigerung: s.kostensteigerung + 0.015 }) },
    { label: "Mietmarkt ±1 %-Pkt.", text: "nur die Mietsteigerung ändert sich", schlechter: sim({ mietsteigerung: s.mietsteigerung - 0.01 }), besser: sim({ mietsteigerung: s.mietsteigerung + 0.01 }) },
    { label: "Bau- und Instandhaltungskosten +2 %-Pkt.", text: "Handwerker, Material, Verwaltung", schlechter: sim({ kostensteigerung: s.kostensteigerung + 0.02 }), besser: null },
    { label: "Leerstand im Markt +8 %-Pkt.", text: "längere Wechsel, schwächere Nachfrage", schlechter: sim({ leerstandZusatz: s.leerstandZusatz + 0.08 }), besser: null },
    { label: "Ausstieg 5 Jahre früher / später", text: "Verkaufszeitpunkt", schlechter: sim({ haltedauer: Math.max(3, s.haltedauer - 5) }), besser: sim({ haltedauer: s.haltedauer + 5 }) },
  ];
  const stress = STRESS.map(x => ({ ...x, sim: sim(x.s(s)) }));
  return { basis, matrix, faktoren, stress };
}
export type ExterneFaktoren = NonNullable<ReturnType<typeof externeFaktoren>>;
