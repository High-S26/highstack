import { describe, expect, it } from "vitest";
import { abfrage, findeMietspiegel, klasseFuer, leererMietspiegel, pruefe } from "../lib/mietspiegel";

const ms = leererMietspiegel("m1", "Musterstadt");
ms.aliase = ["Musterstadt-Nord"];
// 5 Baujahre × 4 Größen × 3 Lagen; Wert steigt mit Baujahr und Lage, sinkt mit Größe
ms.felder = [];
for (let b = 0; b < 5; b++) for (let g = 0; g < 4; g++) for (let l = 0; l < 3; l++) { const m = 8 + b * 0.8 - g * 0.3 + l * 1.2; ms.felder.push({ k: [b, g, l], von: m - 1, mittel: m, bis: m + 1 }); }

describe("Mietspiegel", () => {
  it("ordnet Klassen zu, Grenzwerte in die untere Klasse", () => {
    expect(klasseFuer(ms.merkmale[0]!, 1998)).toBe(3);
    expect(klasseFuer(ms.merkmale[1]!, 60)).toBe(1);
    expect(klasseFuer(ms.merkmale[1]!, 74)).toBe(2);
    expect(klasseFuer(ms.merkmale[2]!, "gut")).toBe(2);
    expect(klasseFuer(ms.merkmale[2]!, null)).toBeNull();
  });
  it("liefert genaues Feld bei vollständigen Angaben", () => {
    const t = abfrage(ms, { baujahr: 1998, flaeche: 74, lage: "mittel" })!;
    expect(t).toMatchObject({ mittel: 11, von: 10, bis: 12, genau: true, felder: 1 });
  });
  it("verbreitert die Spanne bei unbekannter Wohnlage", () => {
    const t = abfrage(ms, { baujahr: 1998, flaeche: 74 })!;
    expect(t.genau).toBe(false); expect(t.offen).toEqual(["Wohnlage"]);
    expect(t.von).toBe(8.8); expect(t.bis).toBe(13.2); expect(t.mittel).toBe(11);
  });
  it("findet die Stadt in Ort oder Titel", () => {
    expect(findeMietspiegel([ms], "Musterstadt-Nord")?.id).toBe("m1");
    expect(findeMietspiegel([ms], "", "2-Zi.-ETW, 12345 Musterstadt")?.id).toBe("m1");
    expect(findeMietspiegel([ms], "Andernorts")).toBeNull();
  });
  it("prüft auf Lücken", () => {
    expect(pruefe(leererMietspiegel("x", "A"))).toContain("Keine Werte erfasst");
  });
});
