import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { textAusBild, normalisiereOcr } from "../lib/ocr";
import { musterErkennung } from "../lib/erfassung";

const FOTO = "/tmp/claude-0/-home-claude/a63e209a-47ca-5889-84a9-ed4a4c2b741b/scratchpad/aushang.jpg";

describe("Foto einer Anzeige", () => {
  it("korrigiert typische Lesefehler", () => {
    expect(normalisiereOcr("ca. 41.3 m? (Wohnfläche 33,5 m” zzgl.")).toBe("ca. 41,3 m² (Wohnfläche 33,5 m² zzgl.");
  });
  it.runIf(existsSync(FOTO))("liest einen abfotografierten Aushang aus", async () => {
    const r = await textAusBild(new Uint8Array(readFileSync(FOTO)));
    const f = musterErkennung(r.text).felder;
    expect(f).toMatchObject({ kaufpreis: 165200, miete: 422, wohnflaeche: 33.5, leer: false, ort: "Düsseldorf-Mitte" });
    expect(f.titel).toContain("Dachgeschosswohnung");
  }, 120_000);
});
