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

import { strategieVorschlag } from "../src/strategie";
import { BEISPIEL_ANLAGEPROFIL, BEISPIEL_INVESTOR, BEISPIEL_OBJEKT } from "../src/beispiel";
describe("Strategievorschlag", () => {
  it("liefert Szenario und Gründe, Tilgung nach Risikoneigung", () => {
    const v = strategieVorschlag({ investor: { ...BEISPIEL_INVESTOR, risiko: "vorsichtig" }, anlageprofil: BEISPIEL_ANLAGEPROFIL, objekt: BEISPIEL_OBJEKT })!;
    expect(v.szenario.tilgung).toBe(0.03);
    expect(v.szenario.eigenkapital).toBe(BEISPIEL_INVESTOR.eigenkapital);
    expect(v.gruende.length).toBeGreaterThan(2);
  });
  it("verhandelt höchstens im Rahmen der Risikoneigung", () => {
    const v = strategieVorschlag({ investor: { ...BEISPIEL_INVESTOR, risiko: "offensiv" }, anlageprofil: BEISPIEL_ANLAGEPROFIL, objekt: BEISPIEL_OBJEKT })!;
    expect(v.szenario.kaufpreisAenderung!).toBeGreaterThanOrEqual(-0.15);
  });
});

describe("Eigene Positionen", () => {
  const basis = simuliere(p, OBJ, 720, standardSzenario(p))!;
  it("Stellplatz +80 € im Monat hebt den Cashflow um 80 €", () => {
    const m = simuliere(p, OBJ, 720, { ...standardSzenario(p), positionen: [{ id: "a", name: "Stellplatz", art: "einnahme", betrag: 80, takt: "monatlich", abJahr: 1 }] })!;
    expect(m.cashflowJahr1Monat - basis.cashflowJahr1Monat).toBeCloseTo(80, 6);
  });
  it("Küche 6.000 € einmalig in Jahr 2 belastet nur Jahr 2", () => {
    const m = simuliere(p, OBJ, 720, { ...standardSzenario(p), positionen: [{ id: "k", name: "Küche", art: "ausgabe", betrag: 6000, takt: "einmalig", abJahr: 2 }] })!;
    expect(m.jahre[1]!.cashflow - basis.jahre[1]!.cashflow).toBeCloseTo(-6000, 6);
    expect(m.jahre[2]!.cashflow).toBeCloseTo(basis.jahre[2]!.cashflow, 6);
  });
  it("Sondertilgung senkt die Restschuld", () => {
    const m = simuliere(p, OBJ, 720, { ...standardSzenario(p), positionen: [{ id: "s", name: "Sondertilgung", art: "sondertilgung", betrag: 10000, takt: "einmalig", abJahr: 5 }] })!;
    expect(basis.restschuldEnde - m.restschuldEnde).toBeGreaterThan(10000);
    expect(m.jahre[4]!.cashflow - basis.jahre[4]!.cashflow).toBeCloseTo(-10000, 6);
  });
  it("Ausgabe beim Kauf (Jahr 0) erhöht den Kapitaleinsatz und senkt die Rendite", () => {
    const m = simuliere(p, OBJ, 720, { ...standardSzenario(p), positionen: [{ id: "r", name: "Renovierung", art: "ausgabe", betrag: 15000, takt: "einmalig", abJahr: 0 }] })!;
    expect(m.beimKauf).toBe(-15000);
    expect(m.irr!).toBeLessThan(basis.irr!);
  });
});

describe("Stellplätze", () => {
  const tg = { id: "s1", art: "tiefgarage" as const, preis: "separat" as const, kaufpreis: 20000, recht: "teileigentum" as const, nutzung: "fremd" as const, miete: 80, hausgeld: 15, erwerben: true };
  it("rechnet separat gekauften Stellplatz in Preis, Miete und Kosten ein", () => {
    const ohne = analyse({ investor: INV, anlageprofil: AP, objekt: OBJ });
    const mit = analyse({ investor: INV, anlageprofil: AP, objekt: { ...OBJ, stellplaetze: [tg] } });
    expect(mit.bewertung.miete! - ohne.bewertung.miete!).toBe(80);
    expect(mit.bewertung.hinweise.some(h => h.text.includes("Teileigentum"))).toBe(true);
    expect(mit.bewertung.hinweise.some(h => h.text.includes("4,8 %"))).toBe(true);
    expect(mit.bewertung.kennzahlen.cashflowMonat!).toBeLessThan(ohne.bewertung.kennzahlen.cashflowMonat! + 80);
  });
  it("lässt abgewählten Stellplatz außen vor und weist darauf hin", () => {
    const ohne = analyse({ investor: INV, anlageprofil: AP, objekt: OBJ });
    const ab = analyse({ investor: INV, anlageprofil: AP, objekt: { ...OBJ, stellplaetze: [{ ...tg, erwerben: false }] } });
    expect(ab.bewertung.kennzahlen.cashflowMonat).toBe(ohne.bewertung.kennzahlen.cashflowMonat);
    expect(ab.bewertung.hinweise.some(h => h.text.includes("nicht eingerechnet"))).toBe(true);
  });
  it("Stellplatz im Kaufpreis verändert den Preis nicht", () => {
    const mit = analyse({ investor: INV, anlageprofil: AP, objekt: { ...OBJ, stellplaetze: [{ ...tg, preis: "inklusive", kaufpreis: null }] } });
    expect(mit.bewertung.kennzahlen.faktor!).toBeLessThan(28.36);
  });
});
