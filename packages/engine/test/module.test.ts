import { describe, expect, it } from "vitest";
import { MODULE, params, projektrechnung, rechneModul, BEISPIEL_ANLAGEPROFIL as AP, BEISPIEL_INVESTOR as INV, BEISPIEL_OBJEKT as OBJ } from "../src";

const p = params(INV, AP);

describe("Projektrechnung", () => {
  it("ohne Zins und mit vollem Eigenkapital ist Gewinn = Erlös − Kosten", () => {
    const r = projektrechnung({ ankauf: 100, kosten: [{ name: "Bau", betrag: 50, startMonat: 1, dauerMonate: 2 }], ekQuote: 1, zins: 0, exitMonat: 6, erloes: 200 });
    expect(r.gesamtkosten).toBe(150);
    expect(r.gewinn).toBe(50);
    expect(r.zinsen).toBe(0);
  });
  it("kapitalisiert Zinsen auf Fremdkapital", () => {
    const r = projektrechnung({ ankauf: 1000, kosten: [], ekQuote: 0, zins: 0.12, exitMonat: 12, erloes: 1200 });
    expect(r.zinsen).toBeCloseTo(1000 * (Math.pow(1.01, 12) - 1), 6);
  });
});

describe("Gestaltungsmodule", () => {
  it("alle Module rechnen mit Standardwerten ohne Fehler", () => {
    for (const m of MODULE) {
      const r = rechneModul(m.id, undefined, OBJ, p);
      expect(r.kennzahlen.length).toBeGreaterThan(0);
      for (const k of r.kennzahlen) expect(k.wert === null || Number.isFinite(k.wert)).toBe(true);
    }
  });
  it("möbliert: Mietpreisbremse deckelt die Miete auf Vergleichsmiete × 1,1 × (1 + Zuschlag)", () => {
    const r = rechneModul("moebliert", { mieteMoebliertQm: 30, vergleichsmieteQm: 12, zuschlagQuote: 0.1, mietpreisbremse: true }, OBJ, p);
    expect(r.details!.mieteQm).toBeCloseTo(12 * 1.1 * 1.1, 6);
  });
  it("Grundstück: Residualwert erreicht genau die Zielmarge", () => {
    const r = rechneModul("entwicklung", { zielMarge: 0.15, verkaufspreisQm: 7500 }, OBJ, p);
    const res = r.details!.residualwert!;
    expect(res).toBeGreaterThan(0);
    const check = rechneModul("entwicklung", { zielMarge: 0.15, verkaufspreisQm: 7500, kaufpreisGrundstueck: res }, OBJ, p);
    expect(check.projekt!.margeAufKosten).toBeCloseTo(0.15, 3);
  });
  it("Grundstück: meldet, wenn die Marge selbst ohne Grundstück nicht reicht", () => {
    const r = rechneModul("entwicklung", { verkaufspreisQm: 3000 }, OBJ, p);
    expect(r.details!.residualwert).toBeNull();
    expect(r.hinweise[0]!.art).toBe("crit");
  });
  it("Sanierung: Kappungsgrenze 3 €/m² in sechs Jahren", () => {
    const r = rechneModul("sanierung", { kosten: 500000, anteilModernisierung: 1, foerderQuote: 0, wohnflaeche: 58, mieteQm: 12 }, OBJ, p);
    expect(r.kennzahlen.find(k => k.key === "umlageQm")!.wert).toBeCloseTo(3, 6);
  });
  it("Zusatzerträge: Warnung, wenn PV über 10 % der Mieteinnahmen in der GmbH", () => {
    const r = rechneModul("flaechenertraege", { pvJahr: 2000 }, OBJ, { ...p, struktur: "gmbh" });
    expect(r.hinweise.some(h => h.art === "crit")).toBe(true);
  });
});
