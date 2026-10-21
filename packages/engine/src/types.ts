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
  /** Stellplätze, die zum Angebot gehören oder dazugekauft werden können */
  stellplaetze?: Stellplatz[];
  /** Beantwortete Rückfragen: „nein“ oder „unbekannt“, damit nicht erneut gefragt wird */
  gefragt?: Record<string, "ja" | "nein" | "unbekannt">;
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
  /** Eigene Positionen: z. B. Stellplatz, Küche, Sondertilgung */
  positionen?: Position[];
}

/**
 * Eigene Position im Durchspielen. Einnahmen und Ausgaben fließen in den Cashflow,
 * eine Sondertilgung senkt die Restschuld und kostet im Jahr der Zahlung Liquidität.
 * Jahr 0 = beim Kauf (nur einmalig): erhöht oder senkt den Eigenkapitaleinsatz.
 */
export interface Position {
  id: string;
  name: string;
  art: "einnahme" | "ausgabe" | "sondertilgung";
  betrag: number;
  takt: "einmalig" | "monatlich" | "jaehrlich";
  abJahr: number;
  bisJahr?: number | null;
  /** wächst mit Miet- bzw. Kostensteigerung */
  dynamisch?: boolean;
}

export interface Params extends Investorenprofil {
  anlageprofil: Anlageprofil;
  grunderwerbsteuer: number;
}

/**
 * Stellplatz. Oft separat gekauft (eigener Preis, eigene Grunderwerbsteuer im Gesamtpreis),
 * als Teileigentum mit eigenem Grundbuchblatt (einzeln verkauf- und vermietbar) oder als
 * Sondernutzungsrecht (nur innerhalb der Eigentümergemeinschaft übertragbar).
 */
export interface Stellplatz {
  id: string;
  art: "tiefgarage" | "aussen" | "garage" | "carport" | "duplex";
  preis: "inklusive" | "separat";
  /** Preis, wenn separat */
  kaufpreis: number | null;
  recht: "teileigentum" | "sondernutzung" | "unbekannt";
  nutzung: "mieter" | "selbst" | "fremd" | "leer";
  /** Miete im Monat, wenn nicht schon in der Wohnungsmiete enthalten */
  miete: number | null;
  /** nicht umlagefähiges Hausgeld für den Stellplatz im Monat */
  hausgeld: number | null;
  /** wird mitgekauft (bei separatem Preis abwählbar) */
  erwerben: boolean;
}