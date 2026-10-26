import { describe, expect, it } from "vitest";
import { grundkalender, mitGrundkalender, verfallstag } from "../src";

describe("Grundkalender", () => {
  const g = grundkalender("2026-10-01", "2026-12-31");
  const am = (d: string) => g.filter(t => t.datum === d).map(t => t.titel);
  it("offizielle Termine in deutscher Zeit", () => {
    expect(g.find(t => t.datum === "2026-10-28" && t.art === "zinsentscheid")).toMatchObject({ zeit: "19:00", land: "US", wichtig: true });
    expect(g.find(t => t.datum === "2026-12-09" && t.art === "zinsentscheid")!.zeit).toBe("20:00"); // beide Länder Winterzeit
    expect(g.find(t => t.datum === "2026-10-29" && t.art === "zinsentscheid")).toMatchObject({ zeit: "14:15", land: "EU" });
    expect(g.find(t => t.datum === "2026-11-06" && t.art === "arbeitsmarkt")!.zeit).toBe("14:30");
    expect(g.find(t => t.datum === "2026-11-10" && t.art === "inflation")!.zeit).toBe("14:30");
    expect(am("2026-11-26")).toContain("US-Börse geschlossen: Thanksgiving");
    expect(g.find(t => t.datum === "2026-11-27" && t.art === "feiertag")!.zeit).toBe("19:00");
  });
  it("Regeln: Verfall, VIX, Bitcoin, Monatsende, Zeitumstellung", () => {
    expect(verfallstag(2026, 10)).toBe("2026-10-16");
    expect(verfallstag(2026, 4)).toBe("2026-04-17"); // Karfreitag (03.04.) ist der erste Freitag
    expect(g.find(t => t.datum === "2026-12-18" && t.art === "verfall")!.titel).toMatch(/Großer Verfall/);
    expect(am("2026-10-21")).toContain("VIX-Verfall (Optionen und Futures)");
    expect(g.find(t => t.datum === "2026-10-30" && /Bitcoin/.test(t.titel))!.zeit).toBe("09:00");
    expect(am("2026-12-31")).toContain("Letzter Handelstag des Jahres");
    expect(am("2026-10-25").join()).toMatch(/Europa: Ende der Sommerzeit/);
    expect(am("2026-11-01").join()).toMatch(/USA: Ende der Sommerzeit/);
  });
  it("gespeicherte Termine haben Vorrang, Grundtermine werden nicht doppelt", () => {
    const e = mitGrundkalender([{ id: "x", datum: "2026-10-28", zeit: "19:00", land: "US", art: "zinsentscheid", wichtig: true, titel: "Fed, Ergebnis der FOMC-Sitzung" }], "2026-10-26", "2026-11-01");
    expect(e.filter(t => t.datum === "2026-10-28" && t.art === "zinsentscheid")).toHaveLength(1);
    expect(e.some(t => t.id.startsWith("gk-") && /Bitcoin/.test(t.titel))).toBe(true);
  });
});

describe("BEA: PCE und BIP", () => {
  it("29.10.2026: PCE und erste BIP-Schätzung um 13:30 deutscher Zeit, wichtig", async () => {
    const { grundkalender } = await import("../src");
    const g = grundkalender("2026-10-29", "2026-10-29");
    expect(g.find(t => /PCE/.test(t.titel))).toMatchObject({ zeit: "13:30", wichtig: true, art: "inflation" });
    expect(g.find(t => /BIP/.test(t.titel))).toMatchObject({ zeit: "13:30", wichtig: true });
  });
});
