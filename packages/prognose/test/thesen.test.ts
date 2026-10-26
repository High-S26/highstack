import { describe, expect, it } from "vitest";
import { grundkalender, plusTage, realisierteSchwankung, thesen, type Ereignis, type Punkt } from "../src";

// Lage wie im Artikel: Fed am 28.10., Zahlen der Tech-Schwergewichte, PCE-Daten, Zinserhöhung im September, Inflation und Öl steigen
const monatlich = (werte: [string, number][]): Punkt[] => werte.map(([d, w]) => ({ d, w }));
const taeglich = (start: string, n: number, f: (i: number) => number): Punkt[] => Array.from({ length: n }, (_, i) => ({ d: plusTage(start, i), w: f(i) }));
const zahlen = (datum: string, symbol: string): Ereignis => ({ id: symbol, datum, art: "zahlen", symbol, titel: `${symbol}, Ergebnis`, zeitpunkt: "nachboerslich", wichtig: true, land: "US" });
const ereignisse: Ereignis[] = [
  ...grundkalender("2026-10-20", "2026-11-10").map((t, i) => ({ ...t, id: `g${i}` })),
  zahlen("2026-10-28", "MSFT"), zahlen("2026-10-28", "GOOGL"), zahlen("2026-10-29", "AMZN"),
  { id: "pce", datum: "2026-10-29", zeit: "13:30", land: "US", art: "inflation", wichtig: true, titel: "Persönliche Ausgaben und Einkommen (PCE)" },
];
const r = {
  "leitzins-us": monatlich([["2026-06-01", 3.625], ["2026-07-01", 3.625], ["2026-08-01", 3.625], ["2026-09-01", 3.625], ["2026-09-17", 3.875], ["2026-10-01", 3.875], ["2026-10-23", 3.875]]),
  "inflation-us": monatlich([["2026-05-01", 3.0], ["2026-06-01", 3.2], ["2026-07-01", 3.4], ["2026-08-01", 3.5], ["2026-09-01", 3.7]]),
  oel: taeglich("2026-08-01", 86, i => 95 + i * 0.25),
  vix: taeglich("2026-10-01", 26, () => 15),
  sp500: taeglich("2026-09-01", 56, i => 7000 * (1 + 0.012 * Math.sin(i * 1.9))),
};

describe("Thesen", () => {
  const t = thesen({ stichtag: "2026-10-26", reihen: r, ereignisse });
  const id = (x: string) => t.find(y => y.id === x);
  it("Ereignisfenster wie im Artikel", () => {
    const c = id("cluster")!;
    expect(c.fakten.map(f => f.text).join(" | ")).toMatch(/Fed-Zinsentscheid.*19:00/);
    expect(c.fakten.map(f => f.text).join(" | ")).toMatch(/MSFT, GOOGL, AMZN/);
    expect(c.maerkte).toContain("MSFT");
  });
  it("Falken-Risiko aus Zinserhöhung, Inflation und Öl", () => {
    const z = id("zins")!;
    expect(z.titel).toMatch(/Falken-Risiko/);
    expect(z.fakten.map(f => f.text).join(" | ")).toMatch(/Leitzins zuletzt erhöht.*Inflation steigt.*Ölpreis/);
  });
  it("niedrige eingepreiste gegen hohe tatsächliche Schwankung", () => {
    expect(realisierteSchwankung(r.sp500, "2026-10-26")!).toBeGreaterThan(17);
    expect(id("vola-billig")).toBeTruthy();
  });
  it("Monatswechsel und Sortierung nach Stärke", () => {
    expect(id("monatswechsel")!.titel).toMatch(/Monatsende 30\.10\./);
    expect(t[0]!.staerke).toBeGreaterThanOrEqual(t.at(-1)!.staerke);
  });
});
