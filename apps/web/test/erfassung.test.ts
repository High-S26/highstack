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
