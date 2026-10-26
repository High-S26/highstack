import { describe, expect, it } from "vitest";
import { abschluss, pruefeEinstellungen, ausbruch, kuenstlicherTag, trefferbilanz, leererZustand, neueEinstellungen, notaus, simBroker, simWeiter, stueckzahl, takt, STANDARD_WERTE, type Bar } from "../src";

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
describe("Bugfix Welle 1", () => {
  it("Prüfung weist Echtgeld, unsinnige Grenzen und falsche Kürzel ab und wirft Fremdfelder weg", () => {
    const { fehler } = pruefeEinstellungen({ ...neueEinstellungen(10000), broker: "alpaca-live" }, { erlaubteBroker: ["simulation"] });
    expect(fehler.map(f => f.feld)).toContain("broker");
    const b = pruefeEinstellungen({ ...neueEinstellungen(10000), tagesziel: 0, tagesverlust: -50, maxPosition: 1000, maxTradesTag: 0, symbole: ["aapl", "AAPL", "$$$"], tenant: "fremd" });
    expect(b.fehler.map(f => f.feld)).toEqual(expect.arrayContaining(["tagesziel", "tagesverlust", "maxPosition", "maxTradesTag", "symbole"]));
    expect(b.e.symbole.filter(x => x === "AAPL").length).toBe(1);
    expect("tenant" in b.e).toBe(false);
    expect(pruefeEinstellungen(neueEinstellungen(500)).fehler).toEqual([]);
  });
  it("Trades je Tag gilt auch für mehrere Signale im selben Takt", async () => {
    const e = { ...neueEinstellungen(10000), modus: "auto" as const, richtung: "long-short" as const, strategie: "anomalie" as const, maxTradesTag: 2, maxPositionen: 6, symbole: ["AAPL", "MSFT", "NVDA", "AMD", "TSLA", "META"], tagesziel: 1e9, tagesverlust: 1e9 };
    const z = leererZustand(); z.simUhr = { datum: "2026-10-26", minute: 0 }; const b = simBroker(z, e.startkapital);
    for (let i = 0; i < 392; i++) { await takt(e, z, b); simWeiter(z); }
    expect((z.verlauf[0] ?? z.tag!).trades).toBeLessThanOrEqual(2);
  });
  it("Nach dem Stopp offene Positionen werden geschlossen, Vorschläge verfallen", async () => {
    const e = { ...neueEinstellungen(10000), modus: "vorschlag" as const, strategie: "anomalie" as const, tagesziel: 0.01 };
    const z = leererZustand(); z.simUhr = { datum: "2026-10-27", minute: 0 }; const b = simBroker(z, e.startkapital);
    await takt(e, z, b); simWeiter(z);
    z.vorschlaege.push({ id: "x", zeit: "", antrag: { symbol: "AAPL", seite: "kauf", qty: 1, grund: "t" }, art: "einstieg", status: "offen" });
    z.sim!.cash += 50; await takt(e, z, b); simWeiter(z);
    expect(z.tag!.status).toBe("ziel"); expect(z.vorschlaege.find(v => v.id === "x")!.status).toBe("verfallen");
    await b.sende({ symbol: "MSFT", seite: "kauf", qty: 1, grund: "nachträglich" });
    await takt(e, z, b);
    expect(Object.keys(z.sim!.positionen)).toEqual([]);
  });
  it("Not-Aus hält auch ohne Broker an und sagt ehrlich, dass nichts geschlossen wurde", async () => {
    const z = leererZustand(); z.aktiv = true; z.tag = { datum: "2026-10-26", start: 1000, ende: null, trades: 1, status: "laeuft" };
    const r = await notaus(z, null, "Not-Aus", "Zugang fehlt");
    expect(z.aktiv).toBe(false); expect(r.geschlossen).toBe(false); expect(r.text).toContain("nicht geschlossen");
    const nie = leererZustand(); expect((await notaus(nie, null, "Not-Aus", "Zugang fehlt")).text).toContain("keine Positionen bekannt");
  });
});
describe("Bugfix Welle 2", () => {
  it("Marktumfeld verkleinert auch Positionen, die die Höchstposition begrenzt", async () => {
    const lauf = async (faktor?: number) => {
      const e = { ...neueEinstellungen(10000), modus: "auto" as const, richtung: "long-short" as const, strategie: "anomalie" as const, risikoProTrade: 0.05, maxPosition: 0.1, maxTradesTag: 3, tagesziel: 1e6, tagesverlust: 5000 };
      const z = leererZustand(); z.simUhr = { datum: "2026-10-26", minute: 0 }; const b = simBroker(z, e.startkapital);
      for (let i = 0; i < 392; i++) { await takt(e, z, b, new Date(), faktor == null ? undefined : { faktor, text: "t" }); simWeiter(z); }
      const l = z.abschluesse ?? []; return l.reduce((a, x) => a + x.qty * x.einstieg, 0) / Math.max(1, l.length);
    };
    const voll = await lauf(); const halb = await lauf(0.5);
    expect(voll).toBeGreaterThan(0); expect(halb).toBeLessThan(voll * 0.6);
  });
  it("Einstiegs-Vorschläge verfallen nach 15 Minuten und blockieren das Limit nicht", async () => {
    const e = { ...neueEinstellungen(10000), modus: "vorschlag" as const, richtung: "long-short" as const, strategie: "anomalie" as const, maxTradesTag: 2, tagesziel: 1e6, tagesverlust: 5000 };
    const z = leererZustand(); z.simUhr = { datum: "2026-10-26", minute: 0 }; const b = simBroker(z, e.startkapital);
    for (let i = 0; i < 392; i++) { await takt(e, z, b); simWeiter(z); }
    const verfallen = z.vorschlaege.filter(v => v.art === "einstieg" && v.status === "verfallen");
    expect(verfallen.length).toBeGreaterThan(2);
    expect(z.vorschlaege.every(v => v.status !== "offen" || (v.alter ?? 0) <= 15)).toBe(true);
  });
  it("Protokoll im deutschen Format: Stückzahlen mit Komma, Kurse mit zwei Stellen", async () => {
    const e = { ...neueEinstellungen(10000), modus: "auto" as const, strategie: "anomalie" as const, tagesziel: 1e6, tagesverlust: 5000 };
    const z = leererZustand(); z.simUhr = { datum: "2026-10-26", minute: 0 }; const b = simBroker(z, e.startkapital);
    for (let i = 0; i < 392; i++) { await takt(e, z, b); simWeiter(z); }
    const orders = z.log.filter(l => l.art === "order").map(l => l.text);
    expect(orders.length).toBeGreaterThan(0);
    for (const t of orders) expect(t).toMatch(/^(Kauf|Verkauf) \d+(,\d{1,3})? [A-Z]+ zu \d{1,3}(\.\d{3})*,\d{2}/);
  });
});


describe("Korrelationsgruppen", () => {
  it("erkennt gleichlaufende Werte", async () => {
    const { korrelation } = await import("../src");
    const a = Array.from({ length: 61 }, (_, i) => ({ c: 100 + Math.sin(i / 3) * 2 + i * 0.01 }));
    const b = a.map(x => ({ c: x.c * 2 + 0.001 }));
    const c = a.map((x, i) => ({ c: 100 + Math.cos(i * 1.7) }));
    expect(korrelation(a, b)!).toBeGreaterThan(0.95);
    expect(Math.abs(korrelation(a, c)!)).toBeLessThan(0.5);
    expect(korrelation(a.slice(0, 10), b.slice(0, 10))).toBeNull();
  });
});

describe("Stopp-Ausführung in der Simulation", () => {
  it("führt einen Stopp zum Stopp-Kurs aus, bei Kurslücke zum Eröffnungskurs", async () => {
    const tag = (crash: { o: number; l: number; c: number }): Bar[] => Array.from({ length: 390 }, (_, i) => i === 50 ? { t: "", o: crash.o, h: crash.o, l: crash.l, c: crash.c, v: 1000 } : { t: "", o: 100, h: 100.1, l: 99.9, c: 100, v: 1000 });
    for (const [crash, erwartet] of [[{ o: 100, l: 97, c: 97.5 }, 99 * 0.9995], [{ o: 96, l: 95, c: 95.5 }, 96 * 0.9995]] as const) {
      const z = leererZustand(); z.simUhr = { datum: "2026-10-26", minute: 49 };
      const b = simBroker(z, 10000, { quelle: () => tag(crash) });
      await b.sende({ symbol: "X", seite: "kauf", qty: 10, grund: "t" });
      z.simUhr.minute = 50;
      const r = await b.sende({ symbol: "X", seite: "verkauf", qty: 10, grund: "Stopp", stoppKurs: 99 });
      expect(r.preis).toBeCloseTo(Math.round(erwartet * 100) / 100, 2);
    }
  });
});

describe("TRD-015: Eigene App rechnet Dollar-Kurse in Euro um", () => {
  it("Kurse, Bewertung und Bars in Euro; ohne Wechselkurs kein Vermischen", async () => {
    const { manuellerBroker, leererZustand, bucheManuell } = await import("../src");
    const z = leererZustand();
    const daten = { bars: async (s: string[]) => Object.fromEntries(s.map(x => [x, [{ t: "2026-10-26T14:00:00Z", o: 110, h: 112, l: 108, c: 110, v: 1000 }]])) };
    const b = manuellerBroker(z, 10000, daten, undefined, async () => ({ usdJeEur: 1.1, stand: "2026-10-23" }));
    const bars = await b.bars(["AAPL"]);
    expect(bars.AAPL![0]!.c).toBeCloseTo(100, 6);
    expect(bars.AAPL![0]!.v).toBe(1000);
    bucheManuell(z, "AAPL", "kauf", 10, 99); // in der App zu 99 € ausgeführt
    const pos = await b.positionen();
    expect(pos[0]!.gv).toBeCloseTo(10, 6); // (100 − 99) × 10 €, nicht (110 − 99)
    expect((await b.konto()).waehrung).toBe("EUR");
    expect(z.wechselkurs).toMatchObject({ usdJeEur: 1.1, stand: "2026-10-23" });
    // Abruf fällt aus: letzter Kurs gilt weiter; ganz ohne Kurs Fehler statt Vermischen
    z.wechselkurs!.abgerufen = 0;
    const b2 = manuellerBroker(z, 10000, daten, undefined, async () => { throw new Error("offline"); });
    expect((await b2.bars(["AAPL"])).AAPL![0]!.c).toBeCloseTo(100, 6);
    const b3 = manuellerBroker(leererZustand(), 10000, daten, undefined, async () => { throw new Error("offline"); });
    await expect(b3.bars(["AAPL"])).rejects.toThrow(/Wechselkurs/);
  });
});
