import { irr } from "../core";

/** Kostenblock eines Projekts, gleichmäßig über Monate verteilt. */
export interface Kostenblock { name: string; betrag: number; startMonat: number; dauerMonate: number }

export interface ProjektInput {
  /** Kosten in Monat 0 (Ankauf inkl. Nebenkosten) */
  ankauf: number;
  kosten: Kostenblock[];
  /** Eigenkapitalanteil an den Gesamtkosten (ohne Zinsen) */
  ekQuote: number;
  /** Bauzeit- bzw. Zwischenfinanzierungszins p. a. */
  zins: number;
  /** Monat des Ausstiegs (Verkauf oder Bewertung als Bestand) */
  exitMonat: number;
  /** Erlös bzw. Wert beim Ausstieg, bereits nach Vertriebskosten */
  erloes: number;
  /** Laufende Erträge vor dem Ausstieg je Monat (z. B. Miete im Bestand), optional */
  ertragMonat?: (monat: number) => number;
}

/** Monatliche Projektrechnung: Eigenkapital zuerst, dann Fremdkapital; Zinsen werden kapitalisiert. */
export function projektrechnung(inp: ProjektInput) {
  const n = Math.max(1, Math.round(inp.exitMonat));
  const bedarf = new Array(n + 1).fill(0) as number[];
  bedarf[0] = inp.ankauf;
  for (const k of inp.kosten) {
    const d = Math.max(1, Math.round(k.dauerMonate));
    for (let m = 0; m < d; m++) { const idx = Math.min(n, Math.round(k.startMonat) + m); bedarf[idx]! += k.betrag / d; }
  }
  const gesamtkosten = bedarf.reduce((a, b) => a + b, 0);
  const ekGesamt = gesamtkosten * inp.ekQuote;
  let ekRest = ekGesamt, schuld = 0, zinsen = 0;
  const flowsEk: number[] = new Array(n + 1).fill(0);
  const zm = inp.zins / 12;
  for (let m = 0; m <= n; m++) {
    if (m > 0) { const z = schuld * zm; zinsen += z; schuld += z; }
    const ertrag = inp.ertragMonat ? inp.ertragMonat(m) : 0;
    let b = bedarf[m]! - ertrag;
    if (b < 0) { flowsEk[m]! += -b; b = 0; }
    const ek = Math.min(ekRest, b); ekRest -= ek; flowsEk[m]! -= ek;
    schuld += b - ek;
  }
  const rueckzahlung = schuld;
  flowsEk[n]! += inp.erloes - rueckzahlung;
  const ekEingesetzt = ekGesamt - ekRest;
  const gewinn = inp.erloes - gesamtkosten - zinsen + (inp.ertragMonat ? Array.from({ length: n + 1 }, (_, m) => inp.ertragMonat!(m)).reduce((a, b) => a + b, 0) : 0);
  const irrMonat = irr(flowsEk);
  return {
    gesamtkosten, zinsen, gesamtkostenInklZinsen: gesamtkosten + zinsen, eigenkapital: ekEingesetzt, fremdkapitalMax: rueckzahlung,
    erloes: inp.erloes, gewinn, margeAufKosten: gewinn / (gesamtkosten + zinsen),
    ekMultiple: ekEingesetzt > 0 ? (ekEingesetzt + gewinn) / ekEingesetzt : null,
    irr: irrMonat == null ? null : Math.pow(1 + irrMonat, 12) - 1,
    laufzeitMonate: n,
  };
}
export type Projektergebnis = ReturnType<typeof projektrechnung>;
