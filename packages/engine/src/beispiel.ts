import type { Anlageprofil, Investorenprofil, Objekt } from "./types";

/** Beispielwerte für Tests und Testmodus. Ausgedacht, keine echten Objekte. */
export const BEISPIEL_INVESTOR: Investorenprofil = {
  eigenkapital: 50000, kreditrahmen: 230000, bundesland: "NW", sollzins: 0.038, tilgung: 0.02, zinsbindung: 10, risiko: "ausgewogen",
  struktur: "privat", grenzsteuersatz: 0.42, gbrAnteil: 0.5, gmbhKostenJahr: 2500, gmbhGruendung: 1500,
  notar: 0.02, makler: 0.0357, mietausfall: 0.02, beleihungsabschlag: 0.1, maxBeleihungsauslauf: 1, minDscr: 1.1,
};
export const BEISPIEL_ANLAGEPROFIL: Anlageprofil = {
  id: "ap-beispiel", name: "Mix Düsseldorf", strategie: "Mix", regionen: ["Düsseldorf"], assetklassen: ["ETW"], preisMax: null,
  minBruttorendite: 0.05, maxFaktor: 22, minCashflow: 0, haltedauer: 15,
  gewichte: { rendite: 30, lage: 25, substanz: 20, finanzierung: 25 }, ko: { erbbaurecht: true, sonderumlage: true, energieGH: false },
};
export const BEISPIEL_OBJEKT: Objekt = {
  titel: "Beispiel: 2-Zi.-ETW, Düsseldorf-Stadtmitte", ort: "Düsseldorf-Stadtmitte", asset: "ETW", kaufpreis: 245000, wohnflaeche: 58, leer: false,
  miete: 720, marktmieteQm: 13.2, vergleichspreisQm: 4600, hausgeldNichtUmlagefaehig: 110, ruecklageAnteil: 6500, baujahr: 1962,
  energieklasse: "E", bodenrichtwert: null, gebaeudeanteil: 0.75, erbbaurecht: false, sonderumlage: false,
};
