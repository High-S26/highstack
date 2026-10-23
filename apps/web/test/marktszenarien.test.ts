import { describe, expect, it } from "vitest";
import { standardSzenario, params, BEISPIEL_INVESTOR as INV, BEISPIEL_ANLAGEPROFIL as AP } from "@highstack/engine";
import { marktszenarien } from "../lib/marktszenarien";
import type { Marktfakt } from "../lib/marktwissen";

const fk = (x: Partial<Marktfakt>): Marktfakt => ({ id: Math.random().toString(), thema: "miete", segment: "wohnen", region: "Düsseldorf", kennzahl: "", wert: null, einheit: "", stichtag: "Q3 2026", quelle: "Haus Survey", stand: "Q3 2026", berichtId: "b", rang: 30, ...x });
describe("Marktszenarien", () => {
  const s = standardSzenario(params(INV, AP));
  const f = [fk({ kennzahl: "Mietwachstum Neuvertrag", wert: 3.5, einheit: "% z. Vj." }), fk({ thema: "makro", region: "Deutschland", kennzahl: "Inflation September", wert: 3.3, rang: 11 }), fk({ thema: "zins", region: "Deutschland", kennzahl: "10-jähriger EUR-Swap", wertText: "3,20–3,70", rang: 12 })];
  it("leitet Annahmen nachvollziehbar ab und ordnet die Szenarien", () => {
    const [k, m, o] = marktszenarien(f, s, 0.038, 0.035);
    expect(m!.s.mietsteigerung).toBeCloseTo(0.0275, 6);
    expect(m!.s.kostensteigerung).toBeCloseTo(0.0265, 6);
    expect(m!.s.anschlusszinsAufschlag! + 0.038).toBeCloseTo(0.0445, 6);
    expect(k!.s.wertentwicklung!).toBeLessThan(m!.s.wertentwicklung!); expect(o!.s.wertentwicklung!).toBeGreaterThan(m!.s.wertentwicklung!);
    expect(m!.grundlagen.find(g => g.parameter === "Mietsteigerung")!.quelle).toContain("Haus Survey");
  });
  it("ohne Marktdaten bleiben Ihre Annahmen die Basis", () => {
    const [, m] = marktszenarien([], s, 0.038, 0.035);
    expect(m!.s.mietsteigerung).toBe(s.mietsteigerung);
  });
});
