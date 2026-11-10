import { describe, expect, it } from "vitest";
import { bilanz, positionsstand, schliesse, stoppKurs, zielKurs, type Journaleintrag } from "../src/journal";

const e: Journaleintrag = { id: "j1", am: 0, basis: "DAX", richtung: "long", quelle: "eigene", produkt: { isin: "DE000HS5DAX5", name: "KO", art: "ko", hebel: 20 }, einsatz: 100, einstieg: { kurs: 10, stueck: 10, orderId: "o1", am: 0 }, stoppProdukt: 0.1, zielProdukt: 0.2, status: "offen" };
describe("Journal", () => {
  it("Ziel und Stopp im Produkt", () => { expect(stoppKurs(e)).toBe(9); expect(zielKurs(e)).toBe(12); });
  it("Zustände der Position", () => {
    expect(positionsstand(e, 12.1).zustand).toBe("ziel"); expect(positionsstand(e, 11.7).zustand).toBe("ziel-nah");
    expect(positionsstand(e, 10.3).zustand).toBe("laeuft"); expect(positionsstand(e, 9.2).zustand).toBe("stopp-nah"); expect(positionsstand(e, 8.9).zustand).toBe("stopp");
    expect(positionsstand(e, 11).ergebnis).toBeCloseTo(10, 6);
  });
  it("Schließen und Bilanz", () => {
    const a = schliesse(e, 11.5, "Ziel"); const b = schliesse({ ...e, id: "j2", quelle: "modell" }, 9, "Stopp");
    expect(a.ergebnis).toBe(15); expect(b.ergebnis).toBe(-10);
    expect(bilanz([a, b, e])).toEqual({ gesamt: { trades: 2, treffer: 0.5, summe: 5 }, eigene: { trades: 1, treffer: 1, summe: 15 }, modell: { trades: 1, treffer: 0, summe: -10 } });
  });
});
