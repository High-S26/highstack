/**
 * Journal der eigenen Trades: Idee, Umsetzung, Einstieg, Ziel und Stopp im Produkt, Ausstieg, Ergebnis.
 * Grundlage für die Positionsführung und später für das Lernen (Treffer je Quelle, je Richtung, je Produkt).
 */
export interface Journaleintrag {
  id: string; am: number;
  basis: string; richtung: "long" | "short";
  /** eigene Idee oder Modellsignal */
  quelle: "eigene" | "modell";
  idee?: string | null;
  produkt: { isin: string; name: string | null; art: "etf" | "ko" | "aktie"; hebel: number };
  einsatz: number;
  einstieg: { kurs: number | null; stueck: number | null; orderId: string | null; am: number };
  /** Anteil, um den das Produkt fallen darf bzw. steigen soll */
  stoppProdukt: number; zielProdukt: number;
  stopp?: { kurs: number; orderId: string | null } | null;
  ausstieg?: { kurs: number | null; am: number; orderId: string | null; grund: string } | null;
  /** vor Gebühren */
  ergebnis?: number | null;
  status: "offen" | "geschlossen";
  modell?: { richtung: string; punkte: number } | null;
}

export const stoppKurs = (e: Journaleintrag) => e.einstieg.kurs ? Math.round(e.einstieg.kurs * (1 - e.stoppProdukt) * 100) / 100 : null;
export const zielKurs = (e: Journaleintrag) => e.einstieg.kurs ? Math.round(e.einstieg.kurs * (1 + e.zielProdukt) * 100) / 100 : null;

/** Zustand einer offenen Position bei aktuellem Geldkurs */
export function positionsstand(e: Journaleintrag, geld: number | null) {
  const ein = e.einstieg.kurs, n = e.einstieg.stueck;
  if (!geld || !ein) return { zustand: "unbekannt" as const, wert: null, ergebnis: null, prozent: null };
  const prozent = geld / ein - 1; const ergebnis = n ? (geld - ein) * n : null;
  const ziel = zielKurs(e)!, stopp = stoppKurs(e)!;
  const zustand = geld >= ziel ? "ziel" as const : geld <= stopp ? "stopp" as const : geld <= ein - (ein - stopp) * 0.7 ? "stopp-nah" as const : geld >= ein + (ziel - ein) * 0.8 ? "ziel-nah" as const : "laeuft" as const;
  return { zustand, wert: n ? geld * n : null, ergebnis, prozent };
}

export function schliesse(e: Journaleintrag, kurs: number | null, grund: string, orderId: string | null = null, am = Date.now()): Journaleintrag {
  const ergebnis = kurs != null && e.einstieg.kurs != null && e.einstieg.stueck ? Math.round((kurs - e.einstieg.kurs) * e.einstieg.stueck * 100) / 100 : null;
  return { ...e, status: "geschlossen", ausstieg: { kurs, am, orderId, grund }, ergebnis };
}

/** Bilanz über geschlossene Trades, getrennt nach Quelle */
export function bilanz(liste: Journaleintrag[]) {
  const zu = liste.filter(e => e.status === "geschlossen" && e.ergebnis != null);
  const teil = (q?: Journaleintrag["quelle"]) => { const x = q ? zu.filter(e => e.quelle === q) : zu; const g = x.filter(e => e.ergebnis! > 0).length; return { trades: x.length, treffer: x.length ? g / x.length : null, summe: Math.round(x.reduce((a, e) => a + e.ergebnis!, 0) * 100) / 100 }; };
  return { gesamt: teil(), eigene: teil("eigene"), modell: teil("modell") };
}
