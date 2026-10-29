import type { Anlageprofil, Investorenprofil, Objekt, Szenario } from "./types";
import { bewerte, params, simuliere, spielraum, standardSzenario, steuern, VORLAGEN, zielpreis, type Simulation, mitStellplaetzen } from "./core";
import { MODULE, rechneModul } from "./module/index";
import { flaechen, mietpfad, type Mietpfad } from "./mietrecht";
import { kaufpreisCheck } from "./kaufpreis";

export interface Analyseeingabe {
  investor: Investorenprofil;
  anlageprofil: Anlageprofil;
  objekt: Objekt;
  /** Abweichungen von der Standard-Einstellung im Durchspielen */
  szenario?: Partial<Szenario>;
  /** Aktivierte Gestaltungsmodule mit Parametern */
  module?: Record<string, Record<string, number | string | boolean>>;
  /** Monat des Übergangs (JJJJ-MM) für Fristen; Standard: aktueller Monat */
  stichtag?: string;
}

/** Was der Mietpfad für die Kalkulation bedeutet: mit gesetzlicher Anpassung gegenüber eingefrorener Miete */
export interface Mietwirkung {
  pfad: Mietpfad;
  cashflow: { jahr: number; mit: number; ohne: number }[];
  irrMit: number | null; irrOhne: number | null;
  mehrMieteSumme: number;
  /** Kaufpreis für Cashflow ± 0, wenn die Miete die Vergleichsmiete erreicht hat */
  zielpreisVergleichsmiete: number | null;
  /** Kaufpreis für Cashflow ± 0 bei Neuvermietung zum zulässigen Höchstwert */
  zielpreisNeuvermietung: number | null;
}

const r0 = (v: number | null | undefined) => v != null && Number.isFinite(v) ? Math.round(v) : null;
const r3 = (v: number | null | undefined) => v != null && Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null;
export const simKurz = (m: Simulation | null) => m ? {
  kaufpreis: r0(m.kaufpreis), darlehen: r0(m.darlehen), rateMonat: r0(m.rateMonat), cashflowJahr1Monat: r0(m.cashflowJahr1Monat),
  cashflowSchnittMonat: r0(m.cashflowSchnittMonat), zuzahlungGesamt: r0(Math.min(0, m.cashflowSumme)), restschuldEnde: r0(m.restschuldEnde),
  nettovermoegenEnde: r0(m.nettovermoegenEnde), irrVorSteuern: r3(m.irr), dscrJahr1: r3(m.dscrJahr1), dscrMin: r3(m.dscrMin),
} : null;

/** Parameter für ein Objekt: eine objektbezogene Käuferprovision (z. B. provisionsfrei) ersetzt den Profilwert */
export function paramsFuer(e: Pick<Analyseeingabe, "investor" | "anlageprofil" | "objekt">) {
  const mp = e.objekt.maklerProvision; return params(mp != null && mp >= 0 && mp <= 0.15 ? { ...e.investor, makler: mp } : e.investor, e.anlageprofil);
}

/** Vollständige, deterministische Analyse eines Objekts. Grundlage für App und Agenten. */
export function analyse(e: Analyseeingabe) {
  const p = paramsFuer(e);
  const o = mitStellplaetzen(e.objekt);
  const bewertung = bewerte(p, o);
  const s: Szenario = { ...standardSzenario(p), ...(e.szenario ?? {}) };
  const gueltig = (x?: string) => !!x && /^(19|20)\d\d-(0[1-9]|1[0-2])$/.test(x);
  s.stichtag = gueltig(e.stichtag) ? e.stichtag : gueltig(s.stichtag) ? s.stichtag : new Date().toISOString().slice(0, 7);
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
  const mietrecht = mietwirkung(p, o, bewertung.miete, s, sim);
  const module = Object.fromEntries(Object.entries(e.module ?? {}).map(([id, werte]) => [id, rechneModul(id, werte, o, p)]));
  // Kaufpreis-Check mit der Wohnung allein (Stellplätze nur im Faktor auf die Gesamtinvestition)
  const kaufpreis = kaufpreisCheck(p, e.objekt, mietrecht?.pfad);
  return { params: p, spielraum: spielraum(p), bewertung, szenario: s, simulation: sim, vorlagen, sensitivitaet, zielpreise, steuern: st, module, mietrecht, kaufpreis };
}

function mietwirkung(p: ReturnType<typeof params>, o: Objekt, miete: number | null, s: Szenario, sim: Simulation | null): Mietwirkung | null {
  if (!miete || !sim) return null;
  const pfad = mietpfad(o, { jahre: s.haltedauer, vmSteigerung: s.mietsteigerung, inflation: s.kostensteigerung, stichtag: s.stichtag });
  if (!pfad) return null;
  // Vergleich: Miete bleibt eingefroren (keine Anpassung)
  const ohne = simuliere(p, o, miete, { ...s, mietentwicklung: "pauschal", mietsteigerung: 0 })!;
  const mit = s.mietentwicklung === "pauschal" ? simuliere(p, o, miete, { ...s, mietentwicklung: "mietrecht" })! : sim;
  const extra = Math.max(0, miete - pfad.start);
  const pauschal = { ...s, mietentwicklung: "pauschal" as const };
  return {
    pfad,
    cashflow: [1, 2, 3, 5, 10].filter(j => j <= mit.jahre.length).map(j => ({ jahr: j, mit: mit.jahre[j - 1]!.cashflow / 12, ohne: ohne.jahre[j - 1]!.cashflow / 12 })),
    irrMit: mit.irr, irrOhne: ohne.irr,
    mehrMieteSumme: mit.jahre.reduce((a, j, i) => a + j.miete - ohne.jahre[i]!.miete, 0),
    zielpreisVergleichsmiete: zielpreis(p, o, pfad.vergleichsmiete + extra, pauschal, "cashflow", 0),
    zielpreisNeuvermietung: pfad.zulaessigNeuvermietung ? zielpreis(p, o, Math.min(pfad.zulaessigNeuvermietung, Math.max(pfad.vergleichsmiete, o.neuvermietungQm ? o.neuvermietungQm * pfad.flaeche : 0)) + extra, pauschal, "cashflow", 0) : null,
  };
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
    flaeche: (() => { const f = flaechen(e.objekt); return f.angerechnet ? { wohnflaeche: f.wohnflaeche, aussenflaeche: f.aussen, angerechnet: r3(f.angerechnet), gerechnetMit: r3(f.gesamt) } : undefined; })(),
    mietpfad: a.mietrecht ? { regulierung: a.mietrecht.pfad.regulierung.text, vertrag: a.mietrecht.pfad.vertrag, istMiete: r0(a.mietrecht.pfad.start), istQm: r3(a.mietrecht.pfad.istQm), vergleichsmiete: r0(a.mietrecht.pfad.vergleichsmiete), potenzialMonat: r0(a.mietrecht.pfad.potenzialMonat), zulaessigBeiNeuvermietung: r0(a.mietrecht.pfad.zulaessigNeuvermietung), ersteErhoehung: a.mietrecht.pfad.ersteErhoehung && { ab: a.mietrecht.pfad.ersteErhoehung.datum, auf: r0(a.mietrecht.pfad.ersteErhoehung.miete), grund: a.mietrecht.pfad.ersteErhoehung.grund }, vergleichsmieteErreicht: a.mietrecht.pfad.vergleichErreicht, cashflowMitUndOhneAnpassung: a.mietrecht.cashflow.map(c => ({ jahr: c.jahr, mit: r0(c.mit), ohne: r0(c.ohne) })), irrMit: r3(a.mietrecht.irrMit), irrOhne: r3(a.mietrecht.irrOhne), kaufpreisCashflowNullBeiVergleichsmiete: r0(a.mietrecht.zielpreisVergleichsmiete), hinweise: a.mietrecht.pfad.hinweise } : undefined,
    bewertung: { score: r0(a.bewertung.score), einstufung: a.bewertung.einstufung, kennzahlen: Object.fromEntries(Object.entries(a.bewertung.kennzahlen).map(([k, v]) => [k, r3(v)])), hinweise: a.bewertung.hinweise.map(h => h.text) },
    einstellungDurchspielen: { annahmen: a.szenario, ergebnis: simKurz(a.simulation) },
    vergleich: Object.fromEntries(Object.entries(a.vorlagen).map(([k, v]) => [k, simKurz(v)])),
    sensitivitaetCashflowJahr1: a.sensitivitaet.map(x => ({ faktor: x.label, schlechter: r0(x.schlechter?.cashflowJahr1Monat), besser: r0(x.besser?.cashflowJahr1Monat) })),
    zielpreise: Object.fromEntries(Object.entries(a.zielpreise).map(([k, v]) => [k, r0(v)])),
    kaufpreisCheck: a.kaufpreis ? (() => { const c = a.kaufpreis; const ew = c.ertragswert; return {
      preisQm: r0(c.preisQm), vergleichspreisQm: c.vergleichspreisQm, preisGegenVergleich: r3(c.preisAbw), mieteGegenVergleich: r3(c.mietAbw),
      faktorIst: r3(c.faktorIst), faktorAufVergleichsmiete: r3(c.faktorVergleich), faktorGesamtinvestition: r3(c.faktorGesamt), marktfaktor: r3(c.marktfaktor),
      faktorGegenMarkt: r3(c.faktorAbw), preislage: c.lage, ursache: c.ursache,
      faktorNachMietanpassung: c.faktorNachAnpassung && { faktor: r3(c.faktorNachAnpassung.faktor), wann: c.faktorNachAnpassung.wann },
      preisBeiMarktfaktor: r0(c.preisMarktfaktor), preisNachVergleichspreis: r0(c.preisVergleich),
      ertragswert: ew && { wert: r0(ew.wert), spanne: [r0(ew.von), r0(ew.bis)], angebotGegenErtragswert: r3(ew.abweichung), liegenschaftszins: ew.liegenschaftszins, restnutzungsdauer: ew.restnutzungsdauer, reinertrag: r0(ew.reinertrag), annahmen: ew.annahmen },
      aussagen: c.aussagen, fehlt: c.fehlt,
    }; })() : undefined,
    steuern: a.steuern && { erwerbsstruktur: inv.struktur, abschreibungJahr: r0(a.steuern.afaJahr), privatOderGbrGesamt: { zuwachsNachSteuern: r0(a.steuern.privat.zuwachsNachSteuern), irr: r3(a.steuern.privat.irr) }, gmbhImMantel: { zuwachsNachSteuern: r0(a.steuern.gmbh.zuwachsNachSteuern), irr: r3(a.steuern.gmbh.irr) }, gmbhAusgeschuettet: { zuwachsNachSteuern: r0(a.steuern.gmbhAusgeschuettet.zuwachsNachSteuern), irr: r3(a.steuern.gmbhAusgeschuettet.irr) } },
    gestaltung: Object.fromEntries(Object.entries(a.module).map(([id, r]) => [id, { modul: MODULE.find(m => m.id === id)?.name, kennzahlen: r.kennzahlen.map(k => ({ [k.label]: k.einheit === "%" ? r3(k.wert) : r0(k.wert), einheit: k.einheit })), hinweise: r.hinweise.map(h => h.text) }])),
  };
}
