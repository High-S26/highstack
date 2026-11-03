import { describe, expect, it } from "vitest";
import { atr, faktoren, gewichte, leseKerzenCsv, lerntage, produktplan, rueckblickDax, tagessignal, type Tageskerze } from "../src/dax";

/** Reproduzierbarer Zufall */
function zufall(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const tage = (n: number) => { const r: string[] = []; const d = new Date("2018-01-02T12:00:00Z"); while (r.length < n) { if (![0, 6].includes(d.getUTCDay())) r.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); } return r; };

/** Künstliche Märkte: mit `kante` folgt der DAX-Tagesverlauf dem Vorzeichen des US-Vorabends */
function markt(n: number, kante: number, seed = 7) {
  const r = zufall(seed); const n01 = () => Math.sqrt(-2 * Math.log(Math.max(1e-12, r()))) * Math.cos(2 * Math.PI * r());
  const d = tage(n); const spx: Tageskerze[] = []; const dax: Tageskerze[] = []; const nk: Tageskerze[] = [];
  let s = 3000, x = 12000, k = 20000;
  for (let i = 0; i < n; i++) {
    const sr = n01() * 0.01; const sAlt = s; s *= 1 + sr; spx.push({ d: d[i]!, o: sAlt, h: Math.max(sAlt, s) * 1.002, l: Math.min(sAlt, s) * 0.998, c: s });
    k *= 1 + n01() * 0.01; nk.push({ d: d[i]!, o: k, h: k * 1.003, l: k * 0.997, c: k });
    const usVorabend = i > 0 ? spx[i - 1]!.c / spx[i - 2 > 0 ? i - 2 : 0]!.c - 1 : 0;
    const o = x * (1 + n01() * 0.002); const intraday = n01() * 0.008 + (kante ? Math.sign(usVorabend) * (Math.abs(usVorabend) > 0.003 ? kante : 0) : 0);
    const c = o * (1 + intraday); const h = Math.max(o, c) * (1 + Math.abs(n01()) * 0.002), l = Math.min(o, c) * (1 - Math.abs(n01()) * 0.002);
    dax.push({ d: d[i]!, o, h, l, c }); x = c;
  }
  return { dax, spx, nk };
}

describe("DAX-Tagestrade", () => {
  it("lernt einen echten Vorteil des US-Vorabends und handelt im Walk-forward mit Gewinn", () => {
    const m = markt(1600, 0.004);
    const g = gewichte(lerntage(m.dax, m.spx, m.nk));
    const us = g.find(x => x.id === "us")!; expect(us.gewicht).toBeGreaterThan(0.5); expect(us.treffer).toBeGreaterThan(0.6);
    const r = rueckblickDax(m.dax, m.spx, m.nk)!;
    expect(r.trades).toBeGreaterThan(200); expect(r.summe).toBeGreaterThan(0); expect(r.gewinnfaktor!).toBeGreaterThan(1.2);
  });
  it("ohne Vorteil im Markt: kaum Trades, keine erfundene Kante", () => {
    const m = markt(1600, 0, 11);
    const r = rueckblickDax(m.dax, m.spx, m.nk)!;
    expect(r.faktoren.filter(x => x.gewicht !== 0).length).toBeLessThanOrEqual(1);
    expect(r.trades / r.tage).toBeLessThan(0.25);
  });
  it("kein Blick in die Zukunft: Gewichte im Rückblick ändern sich nicht durch spätere Tage", () => {
    const m = markt(1400, 0.004);
    const kurz = rueckblickDax(m.dax.slice(0, 1200), m.spx.slice(0, 1200), m.nk.slice(0, 1200))!;
    const lang = rueckblickDax(m.dax, m.spx, m.nk)!;
    const tageKurz = new Map(kurz.letzte.map(x => [x.d, x.richtung]));
    const gleich = lang.letzte.filter(x => tageKurz.has(x.d));
    for (const x of gleich) expect(tageKurz.get(x.d)).toBe(x.richtung);
  });
  it("Faktoren am Morgen nutzen nur bekannte Daten", () => {
    const m = markt(120, 0); const heute = m.dax[100]!.d;
    const f = faktoren({ datum: heute, dax: m.dax.slice(0, 100), spx: m.spx.slice(0, 101), nikkei: m.nk.slice(0, 101), eroeffnung: null });
    const us = f.find(x => x.id === "us")!; expect(us.text).toContain(m.spx[99]!.d); // US-Kerze von heute zählt nicht
    expect(f.find(x => x.id === "luecke")!.wert).toBe(0);
  });
  it("Signal: Richtung aus Gewichten, halbes Risiko an Tagen mit wichtigen Terminen", () => {
    const m = markt(1600, 0.004); const g = gewichte(lerntage(m.dax, m.spx, m.nk));
    const i = m.spx.findIndex((x, j) => j > 1500 && x.c / m.spx[j - 1]!.c - 1 > 0.006);
    const s = tagessignal({ datum: m.dax[i + 1]!.d, dax: m.dax.slice(0, i + 1), spx: m.spx.slice(0, i + 1), nikkei: m.nk.slice(0, i + 1), eroeffnung: m.dax[i + 1]!.o }, g, [{ titel: "Fed-Zinsentscheid", zeit: "19:00", wichtig: true }]);
    expect(s.richtung).toBe("long"); expect(s.stopp!).toBeLessThan(s.bezug!); expect(s.risikoFaktor).toBe(0.5);
    expect(s.gruende.join(" ")).toMatch(/US-Schluss/);
  });
  it("ATR als mittlere True Range", () => {
    const k: Tageskerze[] = Array.from({ length: 16 }, (_, i) => ({ d: `2024-01-${String(i + 1).padStart(2, "0")}`, o: 100, h: 102, l: 98, c: 100 }));
    expect(atr(k)).toBeCloseTo(4, 9);
  });
});

describe("Produktplan", () => {
  it("Knock-out-Barriere jenseits des Stopps, Einsatz aus dem Risiko", () => {
    const p = produktplan({ dax: 24000, richtung: "long", atr: 240, budget: 1000, risikoProzent: 0.02, gebuehrJeOrder: 0, maxHebel: 20 });
    // Stopp 0,5 ATR = 120 Punkte = 0,5 %; Barriere mind. max(360, 360) Punkte → Hebel 24000/360 ≈ 66,7 → begrenzt auf 20 (Abstand 5 %)
    expect(p.ko.hebel).toBe(20); expect(p.ko.barriere).toBe(22800);
    expect(p.ko.verlustBeiStopp).toBeCloseTo(20, 1); expect(p.etf.verlustBeiStopp).toBeCloseTo(5, 1); // ETF: Budget reicht nicht für das volle Risiko
    expect(p.ko.einsatz).toBeCloseTo(200, 1); expect(p.etf.einsatz).toBeCloseTo(1000, 1);
    expect(p.szenarien[0]!.ko).toBeCloseTo(40, 1); // +1 % DAX × Hebel 20 auf 200 €
  });
  it("Gebühren bei kleinem Budget werden benannt", () => {
    const p = produktplan({ dax: 24000, richtung: "short", atr: 240, budget: 100, risikoProzent: 0.02, gebuehrJeOrder: 0.99 });
    expect(p.hinweise.join(" ")).toMatch(/kein Tagestrade|Gebühren/); expect(p.ko.barriere).toBeGreaterThan(24000);
  });
});

describe("Kerzen-CSV", () => {
  it("liest Stooq und deutsche Exporte", () => {
    expect(leseKerzenCsv("Date,Open,High,Low,Close,Volume\n2026-10-30,24000,24200,23900,24100,0\n2026-10-29,23900,24050,23800,24000,0")).toEqual([{ d: "2026-10-29", o: 23900, h: 24050, l: 23800, c: 24000 }, { d: "2026-10-30", o: 24000, h: 24200, l: 23900, c: 24100 }]);
    expect(leseKerzenCsv("Datum;Eröffnung;Hoch;Tief;Schluss\n30.10.2026;24.000,5;24.200;23.900;24.100,25")[0]).toEqual({ d: "2026-10-30", o: 24000.5, h: 24200, l: 23900, c: 24100.25 });
  });
});
