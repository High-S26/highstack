import { describe, expect, it } from "vitest";
import { musterErkennung } from "../lib/erfassung";

describe("Stellplatz aus Inserat", () => {
  it("erkennt separat zu kaufenden TG-Stellplatz als Teileigentum", () => {
    const e = musterErkennung("3-Zimmer-Wohnung, Kaufpreis 289.000 €, Wohnfläche 74 m². Ein Tiefgaragenstellplatz kann zzgl. 18.500 € erworben werden (Teileigentum, eigenes Grundbuch).");
    expect(e.felder.kaufpreis).toBe(289000);
    expect(e.felder.stellplaetze?.[0]).toMatchObject({ art: "tiefgarage", preis: "separat", kaufpreis: 18500, recht: "teileigentum" });
  });
  it("erkennt Stellplatz im Preis und ignoriert „kein Stellplatz“", () => {
    expect(musterErkennung("Kaufpreis 199.000 €, inkl. Außenstellplatz").felder.stellplaetze?.[0]).toMatchObject({ art: "aussen", preis: "inklusive" });
    expect(musterErkennung("Kaufpreis 199.000 €, kein Stellplatz vorhanden").felder.stellplaetze).toBeUndefined();
  });
});

describe("Hausgeld aus Exposé", () => {
  const hg = (t: string) => musterErkennung(`Kaufpreis 250.000 €. ${t}`).felder;
  it.each([
    ["Hausgeld: 310 €", 310], ["Wohngeld mtl. ca. € 310,-", 310], ["Hausgeld (inkl. Instandhaltungsrücklage) 310,00 EUR", 310],
    ["Hausgeld 2025: 310 Euro monatlich", 310], ["Hausgeld\n\n310,50 €", 310.5], ["monatliches Hausgeld von 1.120 €", 1120],
  ])("%s", (t, w) => { expect(hg(t).hausgeldGesamt).toBe(w); expect(hg(t).hausgeldNichtUmlagefaehig).toBe(Math.round(w * 0.4)); });
  it("nimmt den nicht umlagefähigen Anteil, wenn genannt", () => {
    expect(hg("Hausgeld 310 €, davon nicht umlagefähig 118 €").hausgeldNichtUmlagefaehig).toBe(118);
  });
  it("verwechselt das Baujahr nicht mit dem Hausgeld", () => {
    expect(hg("Hausgeld auf Anfrage. Baujahr 1998, Miete 820 €").hausgeldGesamt).toBeUndefined();
  });
});
