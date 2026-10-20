/** Erwerbsstruktur des Investors. */
export type Struktur = "privat" | "gbr" | "gmbh" | "offen";
export type Assetklasse = "ETW" | "MFH" | "EFH/ZFH" | "Gewerbe";
export type Einstufung = "opp" | "watch" | "pass";

/** Investorenprofil: wer investiert. Prozentwerte als Dezimalzahl (0.038 = 3,8 %). */
export interface Investorenprofil {
  eigenkapital: number;
  kreditrahmen: number;
  bundesland: string;
  sollzins: number;
  tilgung: number;
  zinsbindung: number;
  risiko: "vorsichtig" | "ausgewogen" | "offensiv";
  struktur: Struktur;
  grenzsteuersatz: number;
  gbrAnteil: number;
  gmbhKostenJahr: number;
  gmbhGruendung: number;
  notar: number;
  makler: number;
  mietausfall: number;
  beleihungsabschlag: number;
  maxBeleihungsauslauf: number;
  minDscr: number;
}

/** Anlageprofil: was gesucht wird. */
export interface Anlageprofil {
  id: string;
  name: string;
  strategie: "Cashflow" | "Mix" | "Wertsteigerung" | "Value-Add";
  regionen: string[];
  assetklassen: Assetklasse[];
  preisMax: number | null;
  minBruttorendite: number;
  maxFaktor: number | null;
  minCashflow: number;
  haltedauer: number;
  gewichte: { rendite: number; lage: number; substanz: number; finanzierung: number };
  ko: { erbbaurecht: boolean; sonderumlage: boolean; energieGH: boolean };
}

/** Objektdaten. null = unbekannt. */
export interface Objekt {
  titel: string;
  ort: string;
  asset: Assetklasse;
  kaufpreis: number | null;
  wohnflaeche: number | null;
  leer: boolean;
  miete: number | null;
  marktmieteQm: number | null;
  vergleichspreisQm: number | null;
  hausgeldNichtUmlagefaehig: number | null;
  ruecklageAnteil: number | null;
  baujahr: number | null;
  energieklasse: string | null;
  bodenrichtwert: number | null;
  gebaeudeanteil: number;
  erbbaurecht: boolean;
  sonderumlage: boolean;
}

/** Einstellung im Durchspielen. Prozentwerte als Dezimalzahl. */
export interface Szenario {
  kaufpreisAenderung: number;
  eigenkapital: number;
  sollzins: number;
  tilgung: number;
  anschlusszinsAufschlag: number;
  mietFaktor: number;
  mietsteigerung: number;
  kostensteigerung: number;
  leerstandZusatz: number;
  wertentwicklung: number;
  haltedauer: number;
  hausgeldFaktor?: number;
}

export interface Params extends Investorenprofil {
  anlageprofil: Anlageprofil;
  grunderwerbsteuer: number;
}
