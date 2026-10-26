/** Minutenkerze */
export interface Bar { t: string; o: number; h: number; l: number; c: number; v: number }

export interface Konto { equity: number; cash: number; waehrung: string }
export interface Position { symbol: string; qty: number; einstand: number; kurs: number; wert: number; gv: number }
export interface OrderAntrag { symbol: string; seite: "kauf" | "verkauf"; qty: number; grund: string; /** nur Simulation: Stopp-Kurs, zu dem ein Stopp-Ausstieg ausgeführt wird (bei Kurslücke der Eröffnungskurs) */ stoppKurs?: number }
export interface Ausfuehrung { id: string; symbol: string; seite: "kauf" | "verkauf"; qty: number; preis: number | null; status: "ausgefuehrt" | "offen" | "abgelehnt"; meldung?: string; zeit: string }

export type StrategieTyp = "ausbruch" | "mittelwert" | "anomalie" | "momentum" | "staerke";
export interface StrategieWerte {
  /** Ausbruch: Minuten der Eröffnungsspanne */
  spanneMin: number;
  /** Mindestvolumen gegenüber dem Durchschnitt */
  volumenFaktor: number;
  /** Mittelwert und Anomalie: Abweichung in Standardabweichungen */
  z: number;
  /** Rückblick in Minuten */
  fenster: number;
  /** Ziel als Vielfaches des Risikos */
  zielR: number;
  /** Momentum und relative Stärke: Mindestbewegung in Prozent */
  schwelle?: number;
  /** Relative Stärke: Vergleichswert (Markt), Standard SPY */
  referenz?: string;
}
export type BrokerArt = "simulation" | "alpaca-paper" | "alpaca-live" | "manuell" | "ibkr";

export interface AgentEinstellungen {
  name: string;
  broker: BrokerArt;
  /** Name der App beim manuellen Broker, z. B. Trade Republic */
  brokerApp?: string;
  startkapital: number;
  /** Tagesziel: ist es erreicht, schließt der Agent alles und pausiert bis morgen */
  tagesziel: number;
  /** Tagesverlust-Limit: ist es erreicht, schließt der Agent alles und stoppt für heute */
  tagesverlust: number;
  /** Risiko je Trade in Prozent des Kontos (Abstand Einstieg bis Stopp) */
  risikoProTrade: number;
  /** Höchster Anteil des Kontos in einer Position */
  maxPosition: number;
  maxTradesTag: number;
  maxPositionen: number;
  symbole: string[];
  strategie: StrategieTyp;
  werte: StrategieWerte;
  richtung: "long" | "long-short";
  /** Minuten vor Handelsschluss, zu denen alles geschlossen wird */
  schlussVorEnde: number;
  /** vorschlag: jede Order bestätigen; auto: innerhalb der Grenzen selbst handeln */
  modus: "vorschlag" | "auto";
  /** Marktumfeld (Risikolage, wichtige Termine) skaliert das Risiko je Trade; Standard an */
  marktlage?: boolean;
  /** Nachrichten, Insider-Käufe und Short-Anteil als Filter; Standard an */
  kontext?: boolean;
  /** Wirtschaftskalender: Einstiegspausen um wichtige Daten, Regeln an Tagen mit Unternehmenszahlen; Standard an */
  termine?: boolean;
}

export interface Signal { symbol: string; richtung: "long" | "short"; kurs: number; stopp: number; ziel: number; staerke: number; grund: string }

/** Vom Agenten geführte Position mit Stopp und Ziel (Software-Stopps, je Takt geprüft) */
export interface Gefuehrt { symbol: string; richtung: "long" | "short"; qty: number; einstieg: number; stopp: number; ziel: number; seit: string; grund: string; staerke?: number; strategie?: StrategieTyp }

/** Abgeschlossener Trade: das Signal war eine Prognose, hier steht, was daraus wurde */
export interface Abschluss { symbol: string; richtung: "long" | "short"; qty: number; einstieg: number; ausstieg: number; stopp: number; ziel: number; seit: string; bis: string; grund: string; ausstiegGrund: string; gv: number; r: number; staerke?: number; strategie?: StrategieTyp }

/** Marktumfeld für einen Takt: Faktor auf das Risiko je Trade (0 = keine neuen Einstiege) */
export interface Umfeld { faktor: number; text: string }

export interface Vorschlag { id: string; zeit: string; antrag: OrderAntrag; signal?: Signal; art: "einstieg" | "ausstieg"; status: "offen" | "ausgefuehrt" | "abgelehnt" | "verfallen"; meldung?: string; /** Takte seit dem Vorschlag (veraltet) */ alter?: number; /** Handelsminute der Entstehung; Einstiege verfallen nach VORSCHLAG_GUELTIG Minuten */ minute?: number }

export interface Logeintrag { zeit: string; art: "signal" | "order" | "sperre" | "ausstieg" | "schluss" | "info" | "fehler"; text: string }

export interface Tag { datum: string; start: number; ende: number | null; trades: number; status: "laeuft" | "ziel" | "limit" | "notaus" | "beendet" }

export interface Agentzustand {
  aktiv: boolean;
  tag: Tag | null;
  verlauf: Tag[];
  gefuehrt: Gefuehrt[];
  vorschlaege: Vorschlag[];
  log: Logeintrag[];
  letzterTakt: string | null;
  /** Kontostand der Simulation; beim echten Broker führt der Broker */
  sim?: { cash: number; positionen: Record<string, { qty: number; einstand: number }> };
  /** Uhr der Simulation: virtueller Handelstag im Zeitraffer */
  simUhr?: { datum: string; minute: number };
  /** Manueller Broker: vom Nutzer bestätigte Bestände */
  manuell?: { cash: number; positionen: Record<string, { qty: number; einstand: number; /** Kurs in der App ÷ umgerechneter Kurs beim Kauf (Abweichung des Handelsplatzes) */ faktor?: number }> };
  /** Manueller Broker in Euro mit Dollar-Kursen: EZB-Referenzkurs (US-Dollar je Euro) */
  wechselkurs?: { usdJeEur: number; stand: string; abgerufen: number };
  /** Abgeschlossene Trades, neueste zuerst */
  abschluesse?: Abschluss[];
  /** Zuletzt protokollierte Terminpause, damit sie nur einmal im Protokoll erscheint */
  terminPause?: string;
  /** Zuletzt protokolliertes Umfeld, damit es nur bei Änderung im Protokoll erscheint */
  umfeld?: string;
}
