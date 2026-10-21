import type { Anlageprofil, Einstufung, Investorenprofil, Objekt, Params, Position, Stellplatz, Szenario } from "./types";

export const GRUNDERWERBSTEUER: Record<string, number> = {
  NW: 0.065, BW: 0.05, BY: 0.035, BE: 0.06, BB: 0.065, HB: 0.05, HH: 0.055, HE: 0.06,
  MV: 0.06, NI: 0.05, RP: 0.05, SL: 0.065, SN: 0.055, ST: 0.05, SH: 0.065, TH: 0.05,
};
/** Annahme: nicht umlagefähige Kosten in Prozent der Miete, nur für den Spielraum. */
export const KOSTENQUOTE_SPIELRAUM = 0.15;
const ENERGIE_SCORE: Record<string, number> = { "A+": 100, A: 95, B: 85, C: 72, D: 60, E: 48, F: 35, G: 20, H: 10 };

const fin = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);
const lin = (x: number | null | undefined, x0: number, y0: number, x1: number, y1: number) => {
  if (!fin(x)) return null;
  const t = (x - x0) / (x1 - x0);
  return Math.max(0, Math.min(100, y0 + t * (y1 - y0)));
};

export function params(inv: Investorenprofil, ap: Anlageprofil): Params {
  return { ...inv, anlageprofil: ap, grunderwerbsteuer: GRUNDERWERBSTEUER[inv.bundesland] ?? 0.065 };
}
const STELLPLATZ_ART: Record<Stellplatz["art"], string> = { tiefgarage: "Tiefgaragenstellplatz", aussen: "Außenstellplatz", garage: "Garage", carport: "Carport", duplex: "Duplex-Stellplatz" };
/** Mitgekaufte Stellplätze: Preis, Miete und Kosten, die zum Objekt hinzukommen */
export function stellplatzSumme(o: Objekt) {
  const l = (o.stellplaetze ?? []).filter(x => x.erwerben);
  return {
    anzahl: l.length,
    kaufpreis: l.reduce((a, x) => a + (x.preis === "separat" ? x.kaufpreis ?? 0 : 0), 0),
    miete: l.reduce((a, x) => a + (x.nutzung === "mieter" || x.nutzung === "fremd" ? x.miete ?? 0 : 0), 0),
    hausgeld: l.reduce((a, x) => a + (x.hausgeld ?? 0), 0),
  };
}
/** Objekt mit mitgekauften Stellplätzen: Gesamtpreis und Kosten. Miete kommt in bewerte hinzu. */
export function mitStellplaetzen(o: Objekt): Objekt {
  const s = stellplatzSumme(o); if (!s.anzahl) return o;
  return { ...o, kaufpreis: o.kaufpreis != null ? o.kaufpreis + s.kaufpreis : o.kaufpreis, hausgeldNichtUmlagefaehig: (o.hausgeldNichtUmlagefaehig ?? 0) + s.hausgeld || o.hausgeldNichtUmlagefaehig };
}

/** Betrag mit Tausenderpunkt für Hinweistexte */
export const eurDe = (v: number) => Math.round(v).toLocaleString("de-DE");
export const nebenkostenSatz = (p: Params) => p.grunderwerbsteuer + p.notar + p.makler;

/** Interner Zinsfuß einer Zahlungsreihe (Periode = Index). null, wenn nicht bestimmbar. */
export function irr(flows: number[]): number | null {
  if (!(flows[0]! < 0)) return null;
  const npv = (r: number) => flows.reduce((a, c, i) => a + c / Math.pow(1 + r, i), 0);
  let lo = -0.99, hi = 1.5, flo = npv(lo);
  const fhi = npv(hi);
  if (!fin(flo) || !fin(fhi) || flo * fhi > 0) return null;
  for (let i = 0; i < 100; i++) {
    const m = (lo + hi) / 2, fm = npv(m);
    if (flo * fm <= 0) hi = m; else { lo = m; flo = fm; }
  }
  return (lo + hi) / 2;
}

/** Spielraum: Kombination aus Investoren- und Anlageprofil. */
export function spielraum(p: Params) {
  const nk = nebenkostenSatz(p);
  const kpMaxFinanzierbar = (p.eigenkapital + p.kreditrahmen) / (1 + nk);
  const kpMax = Math.min(kpMaxFinanzierbar, p.anlageprofil.preisMax ?? Infinity);
  const darlehen = Math.max(0, kpMax * (1 + nk) - p.eigenkapital);
  const rate = darlehen * (p.sollzins + p.tilgung) / 12;
  const noetigeRendite = kpMax > 0 ? darlehen * (p.sollzins + p.tilgung) / (kpMax * (1 - p.mietausfall - KOSTENQUOTE_SPIELRAUM)) : null;
  const beleihungsauslauf = darlehen / (kpMax * (1 - p.beleihungsabschlag));
  const cashflowBeiZielrendite = (p.anlageprofil.minBruttorendite * kpMax / 12) * (1 - p.mietausfall - KOSTENQUOTE_SPIELRAUM) - rate;
  return { nebenkostenSatz: nk, kpMaxFinanzierbar, kpMax, darlehen, rate, noetigeRendite, noetigerFaktor: noetigeRendite ? 1 / noetigeRendite : null, beleihungsauslauf, cashflowBeiZielrendite, traegtSich: cashflowBeiZielrendite >= p.anlageprofil.minCashflow };
}

export interface Hinweis { art: "crit" | "warn" | "good" | "info"; text: string }

/** Bewertung zum Angebotspreis gegen das Anlageprofil. */
export function bewerte(p: Params, o: Objekt) {
  const ap = p.anlageprofil;
  const hinweise: Hinweis[] = [];
  const nk = nebenkostenSatz(p);
  const kpMax = Math.min((p.eigenkapital + p.kreditrahmen) / (1 + nk), ap.preisMax ?? Infinity);
  const k: Record<string, number | null> = { nebenkostenSatz: nk, kpMax };
  let darlehen: number | null = null, rate: number | null = null, luecke = 0, invest: number | null = null;
  if (o.kaufpreis) {
    invest = o.kaufpreis * (1 + nk);
    darlehen = Math.max(0, invest - p.eigenkapital);
    luecke = Math.max(0, darlehen - p.kreditrahmen);
    rate = darlehen * (p.sollzins + p.tilgung) / 12;
    Object.assign(k, { nebenkosten: o.kaufpreis * nk, gesamtinvestition: invest, darlehen, finanzierungsluecke: luecke, rateMonat: rate, beleihungsauslauf: darlehen / (o.kaufpreis * (1 - p.beleihungsabschlag)), ekQuote: Math.min(p.eigenkapital, invest) / invest });
  }
  let miete = o.leer ? null : o.miete;
  if (!miete && o.marktmieteQm && o.wohnflaeche) {
    miete = o.marktmieteQm * o.wohnflaeche;
    hinweise.push({ art: "info", text: `Keine Ist-Miete: Marktmiete laut Mietspiegel angesetzt (${eurDe(miete)} € pro Monat).` });
  }
  const sp = stellplatzSumme(o);
  if (miete != null && sp.miete) miete += sp.miete;
  for (const x of (o.stellplaetze ?? [])) {
    const name = STELLPLATZ_ART[x.art];
    if (x.preis === "separat" && x.kaufpreis && !x.erwerben) hinweise.push({ art: "info", text: `${name} für ${eurDe(x.kaufpreis)} € wäre separat zu haben und ist nicht eingerechnet.` });
    if (x.preis === "separat" && x.kaufpreis && x.miete) hinweise.push({ art: "info", text: `${name} für sich: ${(x.miete * 12 / x.kaufpreis * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} % Bruttorendite (${eurDe(x.miete)} € Miete).` });
    if (x.recht === "teileigentum" && x.erwerben) hinweise.push({ art: "good", text: `${name} ist Teileigentum mit eigenem Grundbuchblatt: später einzeln verkauf- oder an Dritte vermietbar.` });
    if (x.recht === "sondernutzung" && x.erwerben) hinweise.push({ art: "info", text: `${name} ist ein Sondernutzungsrecht: nur innerhalb der Eigentümergemeinschaft übertragbar.` });
  }
  k.miete = miete;
  if (o.kaufpreis && miete && invest != null && rate != null) {
    const jm = miete * 12;
    const nettoJ = jm * (1 - p.mietausfall) - (o.hausgeldNichtUmlagefaehig ?? 0) * 12;
    Object.assign(k, { bruttorendite: jm / o.kaufpreis, faktor: o.kaufpreis / jm, nettomietrendite: nettoJ / invest, cashflowMonat: miete * (1 - p.mietausfall) - (o.hausgeldNichtUmlagefaehig ?? 0) - rate, dscr: rate > 0 ? nettoJ / (rate * 12) : null });
  }
  if (o.kaufpreis && o.wohnflaeche) k.preisQm = o.kaufpreis / o.wohnflaeche;
  if (k.preisQm && o.vergleichspreisQm) k.preisVsMarkt = k.preisQm / o.vergleichspreisQm - 1;
  if (o.miete && o.wohnflaeche && o.marktmieteQm && !o.leer) k.mietpotenzial = o.marktmieteQm / (o.miete / o.wohnflaeche) - 1;

  const teil = {
    rendite: fin(k.bruttorendite) ? lin(k.bruttorendite, ap.minBruttorendite * 0.6, 0, ap.minBruttorendite * 1.4, 100) : null,
    lage: fin(k.preisVsMarkt) ? lin(k.preisVsMarkt, 0.25, 0, -0.2, 100) : null,
    substanz: o.energieklasse ? Math.max(0, (ENERGIE_SCORE[o.energieklasse] ?? 50) - (o.sonderumlage ? 20 : 0)) : null,
    finanzierung: fin(k.dscr) ? lin(k.dscr, p.minDscr * 0.8, 0, p.minDscr * 1.3, 100) : null,
  };
  if (teil.finanzierung != null && fin(k.beleihungsauslauf) && k.beleihungsauslauf > p.maxBeleihungsauslauf) teil.finanzierung = Math.max(0, teil.finanzierung - 25);
  if (teil.finanzierung != null && luecke > 0) teil.finanzierung = 0;
  const w = ap.gewichte;
  const parts: [keyof typeof teil, number][] = [["rendite", w.rendite], ["lage", w.lage], ["substanz", w.substanz], ["finanzierung", w.finanzierung]];
  const used = parts.filter(([key, g]) => teil[key] != null && g > 0);
  const wsum = used.reduce((a, [, g]) => a + g, 0);
  const score = wsum ? used.reduce((a, [key, g]) => a + (teil[key] as number) * g, 0) / wsum : null;

  const ko: string[] = [];
  if (ap.ko.erbbaurecht && o.erbbaurecht) ko.push("Erbbaurecht");
  if (ap.ko.sonderumlage && o.sonderumlage) ko.push("Sonderumlage offen");
  if (ap.ko.energieGH && (o.energieklasse === "G" || o.energieklasse === "H")) ko.push(`Energieklasse ${o.energieklasse}`);
  ko.forEach(x => hinweise.unshift({ art: "crit", text: `K.O.-Kriterium: ${x}` }));
  if (o.kaufpreis && o.kaufpreis > kpMax) hinweise.push({ art: "crit", text: `Kaufpreis liegt über dem Rahmen von ${eurDe(kpMax)} €.` });
  if (luecke > 0) hinweise.push({ art: "crit", text: `Finanzierungslücke von ${eurDe(luecke)} € gegenüber dem Kreditrahmen.` });
  if (fin(k.cashflowMonat)) hinweise.push(k.cashflowMonat < ap.minCashflow ? { art: "crit", text: `Monatliche Zuzahlung von ${eurDe(Math.max(0, -k.cashflowMonat))} € (Ziel: Cashflow ab ${ap.minCashflow} €).` } : { art: "good", text: `Cashflow ${eurDe(k.cashflowMonat)} € pro Monat nach Rate und Kosten.` });
  if (ap.assetklassen.length && !ap.assetklassen.includes(o.asset)) hinweise.push({ art: "warn", text: `Assetklasse ${o.asset} ist nicht Teil des Anlageprofils „${ap.name}“.` });
  const regionOk = !ap.regionen.length || !o.ort || ap.regionen.some(r => o.ort.toLowerCase().includes(r.toLowerCase().split(/\s+/)[0]!));
  if (!regionOk) hinweise.push({ art: "info", text: `${o.ort} liegt außerhalb der Regionen im Anlageprofil.` });

  let einstufung: Einstufung | null;
  if (ko.length || (o.kaufpreis && o.kaufpreis > kpMax * 1.15) || luecke > 0) einstufung = "pass";
  else if (score == null) einstufung = null;
  else einstufung = score >= 70 ? "opp" : score >= 50 ? "watch" : "pass";
  if (einstufung === "opp" && (!o.kaufpreis || !miete || o.hausgeldNichtUmlagefaehig == null)) einstufung = "watch";
  return { kennzahlen: k, teilscores: teil, score, einstufung, hinweise, ko, miete, regionOk };
}

export function standardSzenario(p: Params): Szenario {
  return { kaufpreisAenderung: 0, eigenkapital: p.eigenkapital, sollzins: p.sollzins, tilgung: p.tilgung, anschlusszinsAufschlag: 0.005, mietFaktor: 1, mietsteigerung: 0.02, kostensteigerung: 0.02, leerstandZusatz: 0, wertentwicklung: 0.015, haltedauer: p.anlageprofil.haltedauer };
}
export const VORLAGEN = {
  konservativ: { kaufpreisAenderung: 0, mietsteigerung: 0.01, kostensteigerung: 0.03, wertentwicklung: 0, anschlusszinsAufschlag: 0.02, leerstandZusatz: 0.03, mietFaktor: 1 },
  basis: { kaufpreisAenderung: 0, mietsteigerung: 0.02, kostensteigerung: 0.02, wertentwicklung: 0.015, anschlusszinsAufschlag: 0.005, leerstandZusatz: 0, mietFaktor: 1 },
  optimistisch: { kaufpreisAenderung: -0.05, mietsteigerung: 0.03, kostensteigerung: 0.02, wertentwicklung: 0.03, anschlusszinsAufschlag: 0, leerstandZusatz: 0, mietFaktor: 1 },
} satisfies Record<string, Partial<Szenario>>;

export interface Jahr { jahr: number; miete: number; kosten: number; positionen: number; sondertilgung: number; zins: number; tilgung: number; cashflow: number; restschuld: number; wert: number; nettovermoegen: number; dscr: number | null }

/** Betrag einer eigenen Position im Jahr t (ohne Vorzeichen) */
export function positionImJahr(x: Position, t: number, s: Pick<Szenario, "mietsteigerung" | "kostensteigerung">): number {
  const ab = Math.max(x.takt === "einmalig" ? 0 : 1, Math.round(x.abJahr || 0));
  if (x.takt === "einmalig") return t === ab ? x.betrag : 0;
  if (t < ab || (x.bisJahr != null && t > x.bisJahr)) return 0;
  const g = x.dynamisch ? Math.pow(1 + (x.art === "einnahme" ? s.mietsteigerung : s.kostensteigerung), t - ab) : 1;
  return (x.takt === "monatlich" ? x.betrag * 12 : x.betrag) * g;
}

/** Jahresplan über die Haltedauer mit Anschlussfinanzierung nach der Zinsbindung. */
export function simuliere(p: Params, o: Objekt, mieteMonat: number | null, s: Szenario) {
  if (!o.kaufpreis || !fin(mieteMonat)) return null;
  const kp = o.kaufpreis * (1 + s.kaufpreisAenderung);
  const nk = nebenkostenSatz(p);
  const invest = kp * (1 + nk);
  const ekEinsatz = Math.min(s.eigenkapital, invest);
  const darlehen = Math.max(0, invest - s.eigenkapital);
  const ausfall = Math.min(0.95, p.mietausfall + s.leerstandZusatz);
  const hausgeld = (o.hausgeldNichtUmlagefaehig ?? 0) * (s.hausgeldFaktor ?? 1);
  const miete0 = mieteMonat * s.mietFaktor;
  let rest = darlehen, z = s.sollzins, annuitaet = darlehen * (s.sollzins + s.tilgung);
  const pos = (s.positionen ?? []).filter(x => Number.isFinite(x.betrag) && x.betrag !== 0);
  // Jahr 0: einmalige Positionen beim Kauf verändern den Eigenkapitaleinsatz
  const beimKauf = pos.filter(x => x.takt === "einmalig" && (x.abJahr || 0) <= 0 && x.art !== "sondertilgung").reduce((a, x) => a + (x.art === "einnahme" ? x.betrag : -x.betrag), 0);
  const jahre: Jahr[] = [];
  for (let t = 1; t <= s.haltedauer; t++) {
    if (t === p.zinsbindung + 1 && rest > 0) { z = s.sollzins + s.anschlusszinsAufschlag; annuitaet = rest * (z + s.tilgung); }
    const miete = miete0 * 12 * Math.pow(1 + s.mietsteigerung, t - 1) * (1 - ausfall);
    const kosten = hausgeld * 12 * Math.pow(1 + s.kostensteigerung, t - 1);
    const zins = rest * z;
    const tilgung = Math.max(0, Math.min(rest, annuitaet - zins));
    rest -= tilgung;
    const positionen = pos.filter(x => x.art !== "sondertilgung").reduce((a, x) => a + (x.art === "einnahme" ? 1 : -1) * positionImJahr(x, t, s), 0);
    const sondertilgung = Math.min(rest, pos.filter(x => x.art === "sondertilgung").reduce((a, x) => a + positionImJahr(x, t, s), 0));
    rest -= sondertilgung;
    const cashflow = miete - kosten + positionen - zins - tilgung - sondertilgung;
    const wert = kp * Math.pow(1 + s.wertentwicklung, t);
    jahre.push({ jahr: t, miete, kosten, positionen, sondertilgung, zins, tilgung, cashflow, restschuld: rest, wert, nettovermoegen: wert - rest, dscr: zins + tilgung > 0 ? (miete - kosten + positionen) / (zins + tilgung) : null });
  }
  const ende = jahre[jahre.length - 1]!;
  const flows = [-ekEinsatz + beimKauf, ...jahre.map(j => j.cashflow)];
  flows[flows.length - 1]! += ende.wert - ende.restschuld;
  const dscrs = jahre.map(j => j.dscr).filter(fin);
  return {
    kaufpreis: kp, gesamtinvestition: invest, beimKauf, nebenkostenSatz: nk, darlehen, ekEinsatz, jahre, miete0, ausfall, hausgeld,
    rateMonat: darlehen * (s.sollzins + s.tilgung) / 12,
    nettovermoegenStart: kp - darlehen,
    cashflowJahr1Monat: jahre[0]!.cashflow / 12,
    cashflowSchnittMonat: jahre.reduce((a, j) => a + j.cashflow, 0) / jahre.length / 12,
    cashflowSumme: jahre.reduce((a, j) => a + j.cashflow, 0),
    restschuldEnde: ende.restschuld, nettovermoegenEnde: ende.nettovermoegen,
    dscrJahr1: jahre[0]!.dscr, dscrMin: dscrs.length ? Math.min(...dscrs) : null,
    irr: irr(flows),
  };
}
export type Simulation = NonNullable<ReturnType<typeof simuliere>>;

/** Kaufpreis, bei dem ein Ziel genau erreicht wird. */
export function zielpreis(p: Params, o: Objekt, mieteMonat: number, s: Szenario, ziel: "cashflow" | "rendite" | "faktor" | "dscr", wert: number): number | null {
  if (!o.kaufpreis) return null;
  const jahresmiete = mieteMonat * s.mietFaktor * 12;
  if (ziel === "rendite") return jahresmiete / wert;
  if (ziel === "faktor") return jahresmiete * wert;
  const f = (kv: number) => { const m = simuliere(p, o, mieteMonat, { ...s, kaufpreisAenderung: kv })!; return ziel === "dscr" ? (m.dscrJahr1 ?? 99) - wert : m.cashflowJahr1Monat - wert; };
  let lo = -0.9, hi = 1.5;
  if (f(lo) < 0) return null;
  if (f(hi) >= 0) return o.kaufpreis * (1 + hi);
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (f(m) >= 0) lo = m; else hi = m; }
  return o.kaufpreis * (1 + lo);
}

/** Steuerwirkung je Struktur (vereinfachtes Informationsmodell). */
export function steuern(sim: Simulation, p: Params, o: Objekt) {
  const satz = !o.baujahr ? 0.02 : o.baujahr < 1925 ? 0.025 : o.baujahr >= 2023 ? 0.03 : 0.02;
  const basis = sim.gesamtinvestition * o.gebaeudeanteil;
  const KST = 0.15825, ABG = 0.26375;
  let afaSumme = 0;
  const jahre = sim.jahre.map(j => { const afa = Math.max(0, Math.min(basis * satz, basis - afaSumme)); afaSumme += afa; return { ...j, afa, einkuenfte: j.miete - j.kosten - j.zins - afa }; });
  const ende = jahre[jahre.length - 1]!;
  const gewinn = ende.wert - (sim.gesamtinvestition - afaSumme);
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const H = sim.jahre.length;
  const stP = jahre.map(j => j.einkuenfte * p.grenzsteuersatz);
  const verkaufP = H < 10 ? Math.max(0, gewinn) * p.grenzsteuersatz : 0;
  const cfP = jahre.map((j, i) => j.cashflow - stP[i]!);
  const flowsP = [-sim.ekEinsatz, ...cfP]; flowsP[flowsP.length - 1]! += ende.wert - ende.restschuld - verkaufP;
  let vortrag = 0; const stG: number[] = [], cfG: number[] = [];
  jahre.forEach(j => { const e = j.einkuenfte - p.gmbhKostenJahr; let st = 0; if (e < 0) vortrag += -e; else { const v = Math.min(vortrag, e); vortrag -= v; st = (e - v) * KST; } stG.push(st); cfG.push(j.cashflow - p.gmbhKostenJahr - st); });
  const verkaufG = Math.max(0, gewinn - vortrag) * KST;
  const flowsG = [-(sim.ekEinsatz + p.gmbhGruendung), ...cfG]; flowsG[flowsG.length - 1]! += ende.wert - ende.restschuld - verkaufG;
  const ausschuettung = Math.max(0, sum(flowsG)) * ABG;
  const flowsGA = flowsG.slice(); flowsGA[flowsGA.length - 1]! -= ausschuettung;
  const res = (st: number[], verkauf: number, cf: number[], flows: number[], aus: number) => ({ steuernLaufend: sum(st), steuerVerkauf: verkauf, steuerAusschuettung: aus, cashflowJahr1Monat: cf[0]! / 12, cashflowSchnittMonat: sum(cf) / cf.length / 12, zuwachsNachSteuern: sum(flows), irr: irr(flows) });
  return { afaSatz: satz, afaJahr: basis * satz, privat: res(stP, verkaufP, cfP, flowsP, 0), gmbh: res(stG, verkaufG, cfG, flowsG, 0), gmbhAusgeschuettet: res(stG, verkaufG, cfG, flowsGA, ausschuettung) };
}
