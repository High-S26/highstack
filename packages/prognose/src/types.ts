/** Ein Datenpunkt einer Zeitreihe: Stichtag (ISO-Datum) und Wert */
export interface Punkt { d: string; w: number }
export interface Reihe { id: string; punkte: Punkt[]; quelle?: string; aktualisiert?: string }
export type Reihen = Record<string, Punkt[]>;

export type Kategorie = "zins" | "inflation" | "wachstum" | "arbeit" | "stimmung" | "markt" | "kredit" | "immobilien" | "waehrung" | "rohstoff";

export interface Indikator {
  id: string;
  name: string;
  einheit: string;
  kategorie: Kategorie;
  frequenz: "taeglich" | "woechentlich" | "monatlich" | "quartal";
  /** Frühindikator, gleichlaufend oder nachlaufend zur Konjunktur */
  vorlauf: "frueh" | "gleich" | "spaet";
  /** Tage zwischen Stichtag und Veröffentlichung: im Rückblick darf erst danach mit dem Wert gerechnet werden */
  verzug: number;
  quelle: { art: "fred" | "ezb" | "manuell"; serie?: string; text: string };
  /** Umrechnung beim Abruf: Index in Veränderung zum Vorjahr */
  umrechnung?: "vorjahr";
  text: string;
}

/** Wofür eine Prognose gilt */
export type Ziel = "aktien-us" | "aktien-eu" | "zins-lang" | "immo-wert" | "volatilitaet" | "einzelwert";

export interface Ereignis {
  id: string;
  datum: string;
  art: "zinsentscheid" | "inflation" | "arbeitsmarkt" | "zahlen" | "index-aufnahme" | "lockup-ende" | "ipo" | "sonstiges";
  titel: string;
  /** Betroffener Wert bei Einzelereignissen, z. B. NVDA */
  symbol?: string;
  wichtig?: boolean;
}

/** Ergebnis eines Mechanismus zu einem Stichtag */
export interface Wirkung {
  mechanismus: string;
  ziel: Ziel;
  symbol?: string;
  /** +1 steigend, −1 fallend */
  richtung: 1 | -1;
  /** 0 bis 1 */
  staerke: number;
  horizontTage: number;
  grund: string;
}

export interface Lagebild {
  stichtag: string;
  reihen: Reihen;
  ereignisse: Ereignis[];
}

export interface Mechanismus {
  id: string;
  name: string;
  /** Theoretische Grundlage, in einem Satz */
  theorie: string;
  /** Benötigte Reihen */
  braucht: string[];
  /** Ausgangsgewicht; wird aus der Bilanz nachgeschärft */
  gewicht: number;
  wirkung(l: Lagebild): Wirkung[];
}

export interface Prognose {
  id: string;
  erstellt: string;
  ziel: Ziel;
  symbol?: string;
  /** Reihe, an der das Ergebnis gemessen wird */
  reihe: string;
  horizontTage: number;
  faellig: string;
  ausgang: number;
  /** Wahrscheinlichkeit für steigend */
  pHoch: number;
  /** Spanne für den Wert bei Fälligkeit: 10 %, 50 %, 90 % */
  spanne?: { p10: number; p50: number; p90: number };
  beitraege: { mechanismus: string; richtung: 1 | -1; staerke: number; grund: string }[];
  modell: string;
  ergebnis?: { am: string; wert: number; hoch: boolean; brier: number; imBand: boolean | null; fehlerProzent: number };
}

export type Regime = "erholung" | "ueberhitzung" | "stagflation" | "abschwung" | "unklar";
export type Risikolage = "risk-on" | "neutral" | "risk-off";
