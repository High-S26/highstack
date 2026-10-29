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
  /** Wohnlage laut Mietspiegel der Stadt (einfach, mittel, gut …) */
  wohnlage?: string | null;
  /** Hausgeld gesamt laut Exposé (nur zur Anzeige; gerechnet wird mit dem nicht umlagefähigen Teil) */
  hausgeldGesamt?: number | null;
  /** Woher ein Wert stammt, wenn er ermittelt und nicht eingegeben wurde */
  herkunft?: Record<string, { quelle: string; von: number; bis: number; am: number }>;
  /** Balkon, Loggia, Terrasse, Dachterrasse, Garten */
  aussenflaeche?: Aussenflaeche | null;
  /** Mietvertrag: Art und Stand der letzten Erhöhung (für den Mietpfad nach Mietrecht) */
  mietvertrag?: Mietvertrag | null;
  /** Gilt am Ort Mietpreisbremse und abgesenkte Kappungsgrenze? null = nach Ort ermitteln */
  mietregulierung?: "angespannt" | "normal" | null;
  /** Käuferprovision für dieses Objekt (0 = provisionsfrei); ohne Angabe gilt der Satz aus dem Investorenprofil */
  maklerProvision?: number | null;
  /** Angestrebte Kaltmiete je m² bei Neuvermietung; ohne Angabe die ortsübliche Vergleichsmiete */
  neuvermietungQm?: number | null;
  /** Ertragswert: Liegenschaftszins (Dezimalzahl) laut Gutachterausschuss; ohne Angabe Standard je Objektart */
  liegenschaftszins?: number | null;
  /** Ertragswert: Restnutzungsdauer in Jahren; ohne Angabe aus dem Baujahr */
  restnutzungsdauer?: number | null;
  /** Grundstücksanteil in m² (bei ETW: Grundstücksfläche × Miteigentumsanteil), für den Bodenwert */
  grundstueckAnteilQm?: number | null;
}

export type Aussenart = "balkon" | "loggia" | "terrasse" | "dachterrasse" | "garten" | "wintergarten";
/**
 * Außenfläche. Nach Wohnflächenverordnung zählen Balkone, Loggien, Dachgärten und Terrassen in der Regel zu einem Viertel,
 * höchstens zur Hälfte zur Wohnfläche; Gärten zählen nicht.
 */
export interface Aussenflaeche {
  art: Aussenart;
  qm: number | null;
  /** Anteil, mit dem die Fläche zur Wohnfläche zählt (0,25 Regelfall, bis 0,5) */
  anrechnung: number;
  /** schon in der angegebenen Wohnfläche enthalten */
  inWohnflaeche: boolean;
  ausrichtung?: string | null;
  /** Anteil, mit dem der Anbieter die Fläche in seiner Gesamtangabe ansetzt (nur Hinweis) */
  anbieterAnrechnung?: number;
}
export interface Mietvertrag {
  art: "standard" | "staffel" | "index";
  /** Monat, ab dem die letzte Erhöhung galt (JJJJ-MM); unbekannt = gerade erst erhöht (vorsichtig) */
  letzteErhoehung?: string | null;
  /** Kaltmiete vor der letzten Erhöhung (für die Kappungsgrenze, wenn die Erhöhung keine drei Jahre zurückliegt) */
  mieteVorErhoehung?: number | null;
  /** Staffel pro Jahr (Staffelmiete) */
  staffelProzent?: number | null;
  /** Angenommener Mieterwechsel im Haltejahr x (Neuvermietung), sonst keiner */
  mieterwechselJahr?: number | null;
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
  /** „mietrecht“: Miete folgt den gesetzlichen Erhöhungsregeln Richtung Vergleichsmiete (mietsteigerung = Entwicklung der Vergleichsmiete); „pauschal“: Miete steigt jedes Jahr um mietsteigerung */
  mietentwicklung?: "mietrecht" | "pauschal";
  /** Monat des Übergangs (JJJJ-MM), Bezug für Fristen im Mietpfad */
  stichtag?: string;
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