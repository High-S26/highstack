import { describe, expect, it } from "vitest";
import { abschluss, ausbruch, kuenstlicherTag, trefferbilanz, leererZustand, neueEinstellungen, notaus, simBroker, simWeiter, stueckzahl, takt, STANDARD_WERTE, type Bar } from "../src";

const bar = (c: number, v = 1000, h = c, l = c): Bar => ({ t: "", o: c, h, l, c, v });
describe("Strategien", () => {
  it("Ausbruch erkennt Bruch des Spannenhochs mit Volumen", () => {
    const bars = [...Array.from({ length: 15 }, (_, i) => bar(100 + (i % 3), 1000, 101 + (i % 3), 99)), ...Array.from({ length: 20 }, () => bar(101.5, 1000, 102, 101)), bar(103.5, 5000, 103.6, 101.8)];
    const s = ausbruch("X", bars, STANDARD_WERTE, false)!;
    expect(s.richtung).toBe("long"); expect(s.stopp).toBeLessThan(s.kurs); expect(s.ziel).toBeGreaterThan(s.kurs);
  });
});
describe("Risikomanager", () => {
  it("Stückzahl folgt dem Risiko je Trade und der Positionsgrenze", () => {
    const e = { ...neueEinstellungen(500), risikoProTrade: 0.01, maxPosition: 0.3 };
    expect(stueckzahl(e, { symbol: "X", richtung: "long", kurs: 100, stopp: 99, ziel: 102, staerke: 1, grund: "" }, 500, 500, true)).toBe(1.5);
    expect(stueckzahl(e, { symbol: "X", richtung: "long", kurs: 100, stopp: 90, ziel: 120, staerke: 1, grund: "" }, 500, 500, false)).toBe(0);
  });
});
describe("Agent in der Simulation", () => {
  it("handelt einen Tag, hält die Grenzen ein und ist am Ende flat", async () => {
    const e = { ...neueEinstellungen(10000), modus: "auto" as const, richtung: "long-short" as const, strategie: "anomalie" as const, maxTradesTag: 5, tagesziel: 1e9, tagesverlust: 1e9 };
    const z = leererZustand(); z.aktiv = true; z.simUhr = { datum: "2026-10-26", minute: 0 };
    const b = simBroker(z, e.startkapital);
    for (let i = 0; i < 392; i++) { await takt(e, z, b); simWeiter(z); }
    expect(kuenstlicherTag("AAPL", "2026-10-26").length).toBe(390);
    expect(z.tag!.trades).toBeLessThanOrEqual(5);
    expect(Object.keys(z.sim!.positionen)).toEqual([]);
    expect(z.log.some(l => l.art === "schluss")).toBe(true);
  });
  it("Tagesziel stoppt den Handel, Not-Aus schließt alles", async () => {
    const e = { ...neueEinstellungen(10000), modus: "auto" as const, strategie: "anomalie" as const, tagesziel: 0.01 };
    const z = leererZustand(); z.simUhr = { datum: "2026-10-27", minute: 0 };
    const b = simBroker(z, e.startkapital);
    await takt(e, z, b); simWeiter(z);
    z.sim!.cash += 50; // Gewinn erzeugen
    await takt(e, z, b);
    expect(z.tag!.status).toBe("ziel");
    await b.sende({ symbol: "AAPL", seite: "kauf", qty: 1, grund: "t" }); await notaus(z, b);
    expect(Object.keys(z.sim!.positionen)).toEqual([]); expect(z.aktiv).toBe(false);
  });
  it("Vorschlagsmodus legt Zettel vor statt zu handeln", async () => {
    const e = { ...neueEinstellungen(10000), modus: "vorschlag" as const, strategie: "anomalie" as const, tagesziel: 1e9, tagesverlust: 1e9 };
    const z = leererZustand(); z.simUhr = { datum: "2026-10-26", minute: 0 };
    const b = simBroker(z, e.startkapital);
    for (let i = 0; i < 200; i++) { await takt(e, z, b); simWeiter(z); }
    expect(z.vorschlaege.length).toBeGreaterThan(0); expect(Object.keys(z.sim!.positionen)).toEqual([]);
  });
  it("legt jeden geschlossenen Trade als überprüfte Prognose ab", async () => {
    const e = { ...neueEinstellungen(10000), modus: "auto" as const, richtung: "long-short" as const, strategie: "anomalie" as const, maxTradesTag: 8, tagesziel: 1e9, tagesverlust: 1e9 };
    const z = leererZustand(); z.aktiv = true; z.simUhr = { datum: "2026-10-26", minute: 0 };
    const b = simBroker(z, e.startkapital);
    for (let i = 0; i < 392; i++) { await takt(e, z, b); simWeiter(z); }
    const l = z.abschluesse ?? [];
    expect(l.length).toBe((z.verlauf[0] ?? z.tag!).trades);
    const t = trefferbilanz(l);
    expect(t.gesamt.n).toBe(l.length);
    expect(t.gesamt.ergebnis).toBeCloseTo(l.reduce((a, x) => a + x.gv, 0), 1);
  });
  it("Marktumfeld verkleinert Positionen oder sperrt Einstiege", async () => {
    const lauf = async (faktor?: number) => {
      const e = { ...neueEinstellungen(10000), modus: "auto" as const, richtung: "long-short" as const, strategie: "anomalie" as const, maxTradesTag: 3, maxPosition: 1, tagesziel: 1e9, tagesverlust: 1e9 };
      const z = leererZustand(); z.simUhr = { datum: "2026-10-26", minute: 0 }; const b = simBroker(z, e.startkapital); const qty: number[] = [];
      for (let i = 0; i < 392; i++) { await takt(e, z, b, new Date(), faktor == null ? undefined : { faktor, text: `Faktor ${faktor}` }); simWeiter(z); }
      for (const a of z.abschluesse ?? []) qty.push(a.qty * a.einstieg);
      return { z, volumen: qty.reduce((a, b) => a + b, 0) / Math.max(1, qty.length) };
    };
    const normal = await lauf(); const halb = await lauf(0.5); const null0 = await lauf(0);
    expect(halb.volumen).toBeLessThan(normal.volumen * 0.7);
    expect(null0.z.abschluesse ?? []).toEqual([]);
    expect(halb.z.log.some(l => l.text.includes("Marktumfeld"))).toBe(true);
  });
  it("R-Vielfaches und Ergebnis eines Abschlusses", () => {
    const z = leererZustand();
    const a = abschluss(z, { symbol: "X", richtung: "short", qty: 10, einstieg: 100, stopp: 102, ziel: 96, seit: "", grund: "" }, 96, "Ziel erreicht", "");
    expect(a).toMatchObject({ gv: 40, r: 2 });
  });
});
