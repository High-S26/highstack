import { describe, expect, it } from "vitest";
import { analyse, bewerte, irr, params, simuliere, spielraum, standardSzenario, zielpreis, BEISPIEL_ANLAGEPROFIL as AP, BEISPIEL_INVESTOR as INV, BEISPIEL_OBJEKT as OBJ } from "../src";

const p = params(INV, AP);

describe("Spielraum", () => {
  it("leitet Kaufpreis und nötige Rendite ab (NRW, 50 T€ EK, 230 T€ Kredit)", () => {
    const sr = spielraum(p);
    expect(Math.round(sr.kpMax)).toBe(249844);
    expect(sr.noetigeRendite!).toBeCloseTo(0.0643, 3);
    expect(sr.traegtSich).toBe(false);
  });
});

describe("Bewertung", () => {
  it("rechnet Kennzahlen und stuft das Beispiel als Pass ein", () => {
    const b = bewerte(p, OBJ);
    expect(b.kennzahlen.bruttorendite!).toBeCloseTo(0.03527, 4);
    expect(b.kennzahlen.faktor!).toBeCloseTo(28.36, 1);
    expect(Math.round(b.kennzahlen.cashflowMonat!)).toBe(-490);
    expect(b.einstufung).toBe("pass");
  });
  it("greift K.O.-Kriterien", () => {
    expect(bewerte(p, { ...OBJ, erbbaurecht: true }).ko).toContain("Erbbaurecht");
  });
});

describe("Simulation und Zielpreise", () => {
  const s = standardSzenario(p);
  it("rechnet die Basis über 15 Jahre wie der Prototyp", () => {
    const m = simuliere(p, OBJ, 720, s)!;
    expect(Math.round(m.cashflowJahr1Monat)).toBe(-490);
    expect(Math.round(m.nettovermoegenEnde / 1000)).toBe(154);
    expect(m.irr!).toBeCloseTo(0.0284, 3);
  });
  it("findet den Kaufpreis für Cashflow ± 0 und für 5 % Rendite", () => {
    expect(Math.round(zielpreis(p, OBJ, 720, s, "cashflow", 0)!)).toBe(154571);
    expect(Math.round(zielpreis(p, OBJ, 720, s, "rendite", 0.05)!)).toBe(172800);
  });
  it("IRR einer einfachen Reihe", () => {
    expect(irr([-100, 110])!).toBeCloseTo(0.1, 6);
  });
});

describe("Analyse", () => {
  it("liefert Steuern für alle Strukturen und Sensitivitäten", () => {
    const a = analyse({ investor: INV, anlageprofil: AP, objekt: OBJ });
    expect(Math.round(a.steuern!.privat.zuwachsNachSteuern / 1000)).toBe(64);
    expect(a.sensitivitaet).toHaveLength(7);
  });
});
