import { describe, expect, it } from "vitest";
import { alpacaHistorie, aufbereiten, kennzahlen, kuenstlicheHistorie, momentum, neueEinstellungen, rueckblickTrading, staerke, STANDARD_WERTE, trendRegel, type Bar } from "../src";

const bar = (o: number, c: number, v = 1000): Bar => ({ t: "", o, h: Math.max(o, c), l: Math.min(o, c), c, v });

describe("Kennzahlen", () => {
  it("rechnet Rendite, maximalen Verlust und Erholungszeit nach", () => {
    const k = kennzahlen([{ datum: "a", wert: 110 }, { datum: "b", wert: 99 }, { datum: "c", wert: 104.5 }, { datum: "d", wert: 115 }], 100);
    expect(k.rendite).toBeCloseTo(0.15, 6);
    expect(k.maxVerlust).toBeCloseTo(-0.1, 6);
    expect(k.erholungTage).toBe(2);
    expect(k.sharpe).not.toBeNull();
  });
});

describe("Daten aufbereiten", () => {
  it("ordnet UTC-Zeitstempel den Minuten ab 9:30 New York zu und füllt Lücken", () => {
    const roh = { SPY: Array.from({ length: 390 }, (_, i) => ({ t: new Date(Date.UTC(2026, 9, 21, 13, 30 + i)).toISOString(), o: 100, h: 101, l: 99, c: 100 + i / 100, v: i === 5 ? 0 : 500 })).filter((_, i) => i !== 10) };
    const h = aufbereiten(roh);
    expect(h.tage).toEqual(["2026-10-21"]);
    const l = h.bars["2026-10-21"]!.SPY!;
    expect(l.length).toBe(390); expect(l[10]!.c).toBe(l[9]!.c); expect(l[10]!.v).toBe(0); expect(l[389]!.c).toBeCloseTo(103.89, 2);
  });
  it("holt Alpaca-Kerzen seitenweise und fällt bei fehlender SIP-Berechtigung auf IEX zurück", async () => {
    const urls: string[] = [];
    const holen = (async (u: string) => {
      urls.push(u); const q = new URL(u).searchParams;
      if (q.get("feed") === "sip") return new Response("forbidden", { status: 403 });
      const seite = q.get("page_token") ? 2 : 1;
      const bars = Array.from({ length: 195 }, (_, i) => ({ t: new Date(Date.UTC(2026, 9, 21, 13, 30 + i + (seite - 1) * 195)).toISOString(), o: 1, h: 1, l: 1, c: 1, v: 10 }));
      return new Response(JSON.stringify({ bars: { SPY: bars }, next_page_token: seite === 1 ? "x" : null }), { status: 200 });
    }) as unknown as typeof fetch;
    const h = await alpacaHistorie({ keyId: "k", secret: "s" }, ["SPY"], "2026-10-21", "2026-10-21", holen);
    expect(h.tage).toEqual(["2026-10-21"]); expect(urls.filter(u => u.includes("feed=iex")).length).toBe(2);
  });
});

describe("Neue Strategien", () => {
  it("Momentum steigt um 15 Uhr in Richtung der ersten 30 Minuten ein", () => {
    const bars = Array.from({ length: 331 }, (_, i) => bar(100 + (i < 30 ? i * 0.02 : 0.6), 100 + (i < 30 ? (i + 1) * 0.02 : 0.6)));
    const s = momentum("SPY", bars, { ...STANDARD_WERTE, schwelle: 0.3 }, false)!;
    expect(s.richtung).toBe("long"); expect(s.stopp).toBeLessThan(s.kurs);
    expect(momentum("SPY", bars.slice(0, 200), STANDARD_WERTE, false)).toBeNull();
  });
  it("Relative Stärke braucht steigenden Markt und Vorsprung", () => {
    const markt = Array.from({ length: 60 }, (_, i) => bar(100 + i * 0.01, 100 + (i + 1) * 0.01));
    const wert = Array.from({ length: 60 }, (_, i) => bar(50 + i * 0.01, 50 + (i + 1) * 0.01 + (i === 59 ? 0.6 : 0)));
    const s = staerke("NVDA", wert, { ...STANDARD_WERTE, schwelle: 1 }, false, { markt })!;
    expect(s?.richtung).toBe("long");
    expect(staerke("NVDA", wert, STANDARD_WERTE, false, {})).toBeNull();
  });
});

describe("Rückblick", () => {
  it("handelt den unveränderten Agenten über mehrere Tage und rechnet Vergleiche", async () => {
    const e = { ...neueEinstellungen(10000), strategie: "anomalie" as const, richtung: "long-short" as const, symbole: ["AAPL", "MSFT", "SPY"], tagesziel: 1e6, tagesverlust: 5000 };
    const h = kuenstlicheHistorie(e.symbole, "2026-09-01", "2026-09-07");
    const r = await rueckblickTrading(e, h, { benchmark: "SPY" });
    expect(r.kurve.length).toBe(5);
    expect(r.kennzahlen.endwert).toBe(r.kurve.at(-1)!.wert);
    expect(r.vergleich[0]!.name).toContain("SPY");
    expect(r.hinweise.join(" ")).toContain("Künstliche Kurse");
    expect(trendRegel(h, "SPY", 10000)).toBeNull();
  }, 60_000);
});
