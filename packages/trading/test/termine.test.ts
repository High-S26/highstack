import { describe, expect, it } from "vitest";
import { nyMinute, terminlage, leererZustand, neueEinstellungen, simBroker, takt, STRATEGIEN, type Bar } from "../src";

describe("Wirtschaftskalender intraday", () => {
  it("rechnet deutsche Zeit in New Yorker Handelsminuten um, auch in der Woche mit verschobener Zeitumstellung", () => {
    expect(nyMinute("2026-10-29", "14:30")).toEqual({ minute: 0, zeitNy: "09:30" });   // EU schon Winterzeit, USA noch Sommerzeit
    expect(nyMinute("2026-11-05", "14:30")).toEqual({ minute: -60, zeitNy: "08:30" }); // beide Winterzeit
    expect(nyMinute("2026-10-28", "19:00").zeitNy).toBe("14:00");
  });
  const termine = [
    { datum: "2026-10-28", zeit: "13:30", titel: "Arbeitsmarktbericht Oktober", art: "arbeitsmarkt", land: "US", wichtig: true },
    { datum: "2026-10-28", zeit: "19:00", titel: "Fed, Zinsentscheid", art: "zinsentscheid", land: "US", wichtig: true },
    { datum: "2026-10-28", zeit: "12:00", titel: "Microsoft, Ergebnis 1Q", art: "zahlen", symbol: "MSFT", wichtig: true },
    { datum: "2026-10-28", zeit: "22:05", titel: "Meta, Ergebnis 3Q", art: "zahlen", symbol: "META", wichtig: true },
    { datum: "2026-10-27", zeit: "22:05", titel: "Visa, Ergebnis 4Q", art: "zahlen", symbol: "V", wichtig: true },
    { datum: "2026-10-28", zeit: "22:30", titel: "Apple, Ergebnis 4Q", art: "zahlen", symbol: "AAPL", wichtig: true },
  ];
  const l = terminlage(termine, "2026-10-28", ["MSFT", "META", "V", "NVDA"]);
  it("setzt Pausen, Regeln je Wert und Ideen", () => {
    expect(l.pausen).toContainEqual({ von: 0, bis: 10, titel: "Eröffnung nach Arbeitsmarktbericht Oktober" });
    expect(l.pausen).toContainEqual({ von: 260, bis: 315, titel: "Fed, Zinsentscheid" });
    expect(l.werte.MSFT).toMatchObject({ faktor: 0.5 });                 // vor Handelsbeginn
    expect(l.werte.META).toMatchObject({ faktor: 1, keinEinstiegAb: 330 }); // nach Handelsschluss
    expect(l.werte.V).toMatchObject({ faktor: 0.5 });                    // gestern nach Schluss
    expect(l.ideen.some(i => i.symbol === "AAPL")).toBe(true);            // nicht beobachtet, aber groß
    expect(l.heute[0]!.zeit).toBe("12:00");
  });
  it("der Agent steigt in der Pause nicht ein und verkleinert an Zahlentagen", async () => {
    const flach: Bar[] = Array.from({ length: 390 }, () => ({ t: "", o: 100, h: 100.05, l: 99.95, c: 100, v: 1000 }));
    const alt = STRATEGIEN.ausbruch.fn;
    (STRATEGIEN.ausbruch as { fn: unknown }).fn = (s: string) => ({ symbol: s, richtung: "long", kurs: 100, stopp: 99, ziel: 103, grund: "Test", staerke: 1 });
    try {
      const z = leererZustand(); z.simUhr = { datum: "2026-10-28", minute: 270 };
      const b = simBroker(z, 10000, { quelle: () => flach });
      const e = { ...neueEinstellungen(10000), symbole: ["NVDA"], modus: "auto" as const };
      await takt(e, z, b, new Date(), undefined, undefined, l);
      expect(Object.keys(z.sim!.positionen)).toEqual([]);
      expect(z.log.some(x => /Fed, Zinsentscheid/.test(x.text))).toBe(true);
      z.simUhr.minute = 120; await takt({ ...e, symbole: ["MSFT"] }, z, b, new Date(), undefined, undefined, l);
      const mit = z.sim!.positionen.MSFT!.qty;
      const z2 = leererZustand(); z2.simUhr = { datum: "2026-10-28", minute: 120 }; const b2 = simBroker(z2, 10000, { quelle: () => flach });
      await takt({ ...e, symbole: ["MSFT"], termine: false }, z2, b2, new Date(), undefined, undefined, l);
      expect(mit).toBeCloseTo(z2.sim!.positionen.MSFT!.qty / 2, 0);
    } finally { (STRATEGIEN.ausbruch as { fn: unknown }).fn = alt; }
  });
});

describe("Zahlen ohne Uhrzeit mit Zeitpunkt", () => {
  it("„nach Börsenschluss“ wirkt wie Zahlen am Abend", async () => {
    const { terminlage } = await import("../src");
    const l = terminlage([{ datum: "2026-10-28", titel: "Quartalszahlen Microsoft", art: "zahlen", symbol: "MSFT", zeitpunkt: "nachboerslich", wichtig: true }], "2026-10-28", ["MSFT"]);
    expect(l.werte.MSFT).toMatchObject({ faktor: 1, keinEinstiegAb: 330 });
    expect(l.werte.MSFT!.text).toMatch(/nach Handelsschluss/);
  });
});
