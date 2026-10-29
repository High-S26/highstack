import { describe, expect, it } from "vitest";
import { analyse, barwertfaktor, BEISPIEL_ANLAGEPROFIL, BEISPIEL_INVESTOR, BEISPIEL_OBJEKT, ertragswert, kaufpreisCheck, params, preislage, type Objekt } from "../src/index";

const p = params(BEISPIEL_INVESTOR, BEISPIEL_ANLAGEPROFIL);
const o = (x: Partial<Objekt> = {}): Objekt => ({ ...BEISPIEL_OBJEKT, ...x });

describe("Kaufpreis-Check", () => {
  it("Faktoren und Marktfaktor", () => {
    const c = kaufpreisCheck(p, o())!;
    expect(c.faktorIst).toBeCloseTo(245000 / (720 * 12), 6);
    expect(c.marktfaktor).toBeCloseTo(4600 / (13.2 * 12), 6);
    expect(c.faktorVergleich).toBeCloseTo(245000 / (13.2 * 58 * 12), 6);
    // Faktor/Marktfaktor = Preisverhältnis ÷ Mietverhältnis
    expect(1 + c.faktorAbw!).toBeCloseTo((1 + c.preisAbw!) / (1 + c.mietAbw!), 9);
    expect(c.lage).toBe("markt");
    expect(c.faktorGesamt).toBeCloseTo(245000 * (1 + 0.065 + 0.02 + 0.0357) / (720 * 12), 6);
  });
  it("hoher Faktor wegen niedriger Miete wird als Mietpotenzial erklärt", () => {
    const c = kaufpreisCheck(p, o({ miete: 560, kaufpreis: 266800 }))!; // Preis = Vergleichspreis, Miete 27 % darunter
    expect(c.lage).toBe("deutlich-teuer"); expect(c.ursache).toBe("miete");
    expect(c.aussagen.join(" ")).toMatch(/niedrigen Miete/);
  });
  it("hoher Faktor wegen hohem Preis", () => {
    const c = kaufpreisCheck(p, o({ miete: 765.6, kaufpreis: 320000 }))!;
    expect(c.ursache).toBe("preis"); expect(c.lage).toBe("teuer");
    expect(c.preisMarktfaktor).toBeCloseTo(c.marktfaktor! * 765.6 * 12, 4);
  });
  it("Faktor nach Mietanpassung aus dem Mietpfad", () => {
    const a = analyse({ investor: BEISPIEL_INVESTOR, anlageprofil: BEISPIEL_ANLAGEPROFIL, objekt: o() });
    expect(a.kaufpreis!.faktorNachAnpassung!.faktor).toBeLessThan(a.kaufpreis!.faktorIst!);
  });
  it("leer: Faktor auf die Vergleichsmiete, keine Mietursache", () => {
    const c = kaufpreisCheck(p, o({ leer: true, miete: null }))!;
    expect(c.faktorIst).toBeNull(); expect(c.faktorAbw).toBeCloseTo(c.faktorVergleich! / c.marktfaktor! - 1, 9);
  });
  it("ohne Vergleichswerte: nur Ertragswert, fehlende Angaben genannt", () => {
    const c = kaufpreisCheck(p, o({ marktmieteQm: null, vergleichspreisQm: null }))!;
    expect(c.marktfaktor).toBeNull(); expect(c.lage).toBeNull(); expect(c.fehlt).toContain("Vergleichspreis je m²");
    expect(c.ertragswert).not.toBeNull();
  });
  it("Preislage-Grenzen", () => { expect(preislage(-0.11)).toBe("guenstig"); expect(preislage(0.1)).toBe("markt"); expect(preislage(0.2)).toBe("teuer"); expect(preislage(0.3)).toBe("deutlich-teuer"); });
});

describe("Ertragswert", () => {
  it("Barwertfaktor wie in der Vervielfältigertabelle", () => { expect(barwertfaktor(0.05, 30)).toBeCloseTo(15.37, 2); expect(barwertfaktor(0.02, 40)).toBeCloseTo(27.36, 2); });
  it("Rechnung von Hand nachvollziehbar", () => {
    const x = o({ liegenschaftszins: 0.03, restnutzungsdauer: 40, bodenrichtwert: 1000, grundstueckAnteilQm: 20 });
    const e = ertragswert(x, 800, 60, 250000, 2026);
    const roh = 9600, bwk = 430 + 14 * 60 + 0.02 * roh, re = roh - bwk, bw = 20000;
    expect(e.bewirtschaftung).toBeCloseTo(bwk, 6);
    expect(e.wert).toBeCloseTo(re * barwertfaktor(0.03, 40) + bw / Math.pow(1.03, 40), 4);
    expect(e.bodenwertQuelle).toBe("bodenrichtwert"); expect(e.von).toBeLessThan(e.wert); expect(e.bis).toBeGreaterThan(e.wert);
  });
  it("Restnutzungsdauer aus Baujahr mit Untergrenze, Abschlag im angespannten Markt", () => {
    expect(ertragswert(o({ baujahr: 2000 }), 800, 60, 250000, 2026).restnutzungsdauer).toBe(54);
    expect(ertragswert(o({ baujahr: 1950 }), 800, 60, 250000, 2026).restnutzungsdauer).toBe(30);
    expect(ertragswert(o({ ort: "Düsseldorf" }), 800, 60, 250000, 2026).liegenschaftszins).toBeCloseTo(0.015, 9);
    expect(ertragswert(o({ ort: "Kleinstadt", mietregulierung: "normal" }), 800, 60, 250000, 2026).liegenschaftszins).toBeCloseTo(0.02, 9);
  });
});
