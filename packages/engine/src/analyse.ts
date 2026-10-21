import type { Anlageprofil, Investorenprofil, Objekt, Szenario } from "./types";
import { bewerte, params, simuliere, spielraum, standardSzenario, steuern, VORLAGEN, zielpreis, type Simulation, mitStellplaetzen } from "./core";
import { MODULE, rechneModul } from "./module/index";

export interface Analyseeingabe {
  investor: Investorenprofil;
  anlageprofil: Anlageprofil;
  objekt: Objekt;
  /** Abweichungen von der Standard-Einstellung im Durchspielen */
  szenario?: Partial<Szenario>;
  /** Aktivierte Gestaltungsmodule mit Parametern */
  module?: Record<string, Record<string, number | string | boolean>>;
}

const r0 = (v: number | null | undefined) => v != null && Number.isFinite(v) ? Math.round(v) : null;
const r3 = (v: number | null | undefined) => v != null && Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null;
export const simKurz = (m: Simulation | null) => m ? {
  kaufpreis: r0(m.kaufpreis), darlehen: r0(m.darlehen), rateMonat: r0(m.rateMonat), cashflowJahr1Monat: r0(m.cashflowJahr1Monat),
  cashflowSchnittMonat: r0(m.cashflowSchnittMonat), zuzahlungGesamt: r0(Math.min(0, m.cashflowSumme)), restschuldEnde: r0(m.restschuldEnde),
  nettovermoegenEnde: r0(m.nettovermoegenEnde), irrVorSteuern: r3(m.irr), dscrJahr1: r3(m.dscrJahr1), dscrMin: r3(m.dscrMin),
} : null;

/** Vollständige, deterministische Analyse eines Objekts. Grundlage für App und Agenten. */
export function analyse(e: Analyseeingabe) {
  const p = params(e.investor, e.anlageprofil);
  const o = mitStellplaetzen(e.objekt);
  const bewertung = bewerte(p, o);
  const s: Szenario = { ...standardSzenario(p), ...(e.szenario ?? {}) };
  const sim = simuliere(p, o, bewertung.miete, s);
  const vorlagen = Object.fromEntries(Object.entries(VORLAGEN).map(([k, v]) => [k, simuliere(p, o, bewertung.miete, { ...s, ...v })]));
  const variationen: [string, Partial<Szenario>, Partial<Szenario> | null][] = [
    ["Sollzins ±1 %-Pkt.", { sollzins: s.sollzins + 0.01 }, { sollzins: Math.max(0, s.sollzins - 0.01) }],
    ["Miete ±10 %", { mietFaktor: s.mietFaktor * 0.9 }, { mietFaktor: s.mietFaktor * 1.1 }],
    ["Kaufpreis ±10 %", { kaufpreisAenderung: (1 + s.kaufpreisAenderung) * 1.1 - 1 }, { kaufpreisAenderung: (1 + s.kaufpreisAenderung) * 0.9 - 1 }],
    ["Hausgeld ±20 %", { hausgeldFaktor: 1.2 }, { hausgeldFaktor: 0.8 }],
    ["Mietsteigerung ±1 %-Pkt.", { mietsteigerung: s.mietsteigerung - 0.01 }, { mietsteigerung: s.mietsteigerung + 0.01 }],
    ["Wertentwicklung ±1 %-Pkt.", { wertentwicklung: s.wertentwicklung - 0.01 }, { wertentwicklung: s.wertentwicklung + 0.01 }],
    ["Leerstand +5 %-Pkt.", { leerstandZusatz: s.leerstandZusatz + 0.05 }, null],
  ];
  const sensitivitaet = variationen.map(([label, a, b]) => ({ label, schlechter: simuliere(p, o, bewertung.miete, { ...s, ...a }), besser: b ? simuliere(p, o, bewertung.miete, { ...s, ...b }) : null }));
  const zp = (ziel: "cashflow" | "rendite" | "faktor" | "dscr", wert: number) => bewertung.miete ? zielpreis(p, o, bewertung.miete, s, ziel, wert) : null;
  const zielpreise = {
    cashflowNull: zp("cashflow", 0),
    mindestrendite: zp("rendite", e.anlageprofil.minBruttorendite),
    maxFaktor: e.anlageprofil.maxFaktor ? zp("faktor", e.anlageprofil.maxFaktor) : null,
    dscr: zp("dscr", e.investor.minDscr),
  };
  const st = sim ? steuern(sim, p, o) : null;
  const module = Object.fromEntries(Object.entries(e.module ?? {}).map(([id, werte]) => [id, rechneModul(id, werte, o, p)]));
  return { params: p, spielraum: spielraum(p), bewertung, szenario: s, simulation: sim, vorlagen, sensitivitaet, zielpreise, steuern: st, module };
}
export type Analyse = ReturnType<typeof analyse>;

/** Kompakter, JSON-tauglicher Kontext für die Agenten. */
export function agentenkontext(e: Analyseeingabe, a: Analyse = analyse(e)) {
  const ap = e.anlageprofil, inv = e.investor;
  return {
    investorenprofil: { eigenkapital: inv.eigenkapital, kreditrahmen: inv.kreditrahmen, bundesland: inv.bundesland, sollzins: inv.sollzins, tilgung: inv.tilgung, zinsbindung: inv.zinsbindung, risiko: inv.risiko, erwerbsstruktur: inv.struktur, grenzsteuersatz: inv.struktur === "gmbh" ? undefined : inv.grenzsteuersatz },
    anlageprofil: { name: ap.name, strategie: ap.strategie, regionen: ap.regionen, assetklassen: ap.assetklassen, minBruttorendite: ap.minBruttorendite, maxFaktor: ap.maxFaktor, minCashflow: ap.minCashflow, haltedauer: ap.haltedauer },
    spielraum: { kaufpreisBis: r0(a.spielraum.kpMax), rateMonat: r0(a.spielraum.rate), noetigeRenditeFuerCashflowNull: r3(a.spielraum.noetigeRendite) },
    objekt: e.objekt,
    bewertung: { score: r0(a.bewertung.score), einstufung: a.bewertung.einstufung, kennzahlen: Object.fromEntries(Object.entries(a.bewertung.kennzahlen).map(([k, v]) => [k, r3(v)])), hinweise: a.bewertung.hinweise.map(h => h.text) },
    einstellungDurchspielen: { annahmen: a.szenario, ergebnis: simKurz(a.simulation) },
    vergleich: Object.fromEntries(Object.entries(a.vorlagen).map(([k, v]) => [k, simKurz(v)])),
    sensitivitaetCashflowJahr1: a.sensitivitaet.map(x => ({ faktor: x.label, schlechter: r0(x.schlechter?.cashflowJahr1Monat), besser: r0(x.besser?.cashflowJahr1Monat) })),
    zielpreise: Object.fromEntries(Object.entries(a.zielpreise).map(([k, v]) => [k, r0(v)])),
    steuern: a.steuern && { erwerbsstruktur: inv.struktur, abschreibungJahr: r0(a.steuern.afaJahr), privatOderGbrGesamt: { zuwachsNachSteuern: r0(a.steuern.privat.zuwachsNachSteuern), irr: r3(a.steuern.privat.irr) }, gmbhImMantel: { zuwachsNachSteuern: r0(a.steuern.gmbh.zuwachsNachSteuern), irr: r3(a.steuern.gmbh.irr) }, gmbhAusgeschuettet: { zuwachsNachSteuern: r0(a.steuern.gmbhAusgeschuettet.zuwachsNachSteuern), irr: r3(a.steuern.gmbhAusgeschuettet.irr) } },
    gestaltung: Object.fromEntries(Object.entries(a.module).map(([id, r]) => [id, { modul: MODULE.find(m => m.id === id)?.name, kennzahlen: r.kennzahlen.map(k => ({ [k.label]: k.einheit === "%" ? r3(k.wert) : r0(k.wert), einheit: k.einheit })), hinweise: r.hinweise.map(h => h.text) }])),
  };
}
