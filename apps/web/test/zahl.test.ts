import { describe, expect, it } from "vitest";
import { leseZahl } from "../lib/zahl";

describe("leseZahl: übliche Schreibweisen von Beträgen", () => {
  it.each([
    ["185", 185], ["185,-", 185], ["185,- €", 185], ["185 EUR", 185], ["185 Euro", 185], ["ca. 185", 185],
    ["185 €/Monat", 185], ["mtl. 185 €", 185], ["1.250,50", 1250.5], ["245.000", 245000], ["3,8 %", 3.8],
  ])("%s → %d", (t, v) => expect(leseZahl(t)).toBe(v));
  it("lehnt Unsinn weiter ab", () => { expect(leseZahl("abc")).toBeNull(); expect(leseZahl("1e6")).toBeNull(); expect(leseZahl("")).toBeNull(); });
});
