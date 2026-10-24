import { describe, expect, it } from "vitest";
import { bewerte, bilanz, bis, gewichteAus, leseCsv, leseTabelle, lies, lage, plusTage, prognosen, risikolage, rueckblick, wertAm, type Punkt, type Reihen } from "../src";

/** Werktägliche Reihe mit Trend und reproduzierbarem Rauschen */
function reihe(start: string, tage: number, f: (i: number) => number): Punkt[] {
  const out: Punkt[] = []; for (let i = 0; i < tage; i++) { const d = plusTage(start, i); const wd = new Date(d).getUTCDay(); if (wd !== 0 && wd !== 6) out.push({ d, w: f(i) }); } return out;
}
const zufall = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };

describe("Zeitreihen und Import", () => {
  it("liest CSV in deutschen und internationalen Formaten", () => {
    expect(leseCsv("Datum;Wert\n01.10.2026;2,15\n01.09.2026;2,10")).toEqual([{ d: "2026-09-01", w: 2.1 }, { d: "2026-10-01", w: 2.15 }]);
    expect(leseCsv("date,value\n2026-07,48.2\n2026-Q2,101")).toEqual([{ d: "2026-04-01", w: 101 }, { d: "2026-07-01", w: 48.2 }]);
    expect(leseCsv("KEY,TIME_PERIOD,OBS_VALUE\nICP,2026-08,2.3")).toEqual([{ d: "2026-08-01", w: 2.3 }]);
  });
  it("beachtet den Veröffentlichungsverzug", () => {
    const p = [{ d: "2026-08-01", w: 1 }, { d: "2026-09-01", w: 2 }];
    expect(wertAm(p, "2026-09-05")).toBe(2);
    expect(wertAm(p, "2026-09-05", 14)).toBe(1);
  });
});

describe("Wirkungsketten und Prognosen", () => {
  const r = zufall(7);
  let k = 4000; const sp = reihe("2024-01-01", 900, () => (k *= 1 + 0.0004 + r() * 0.02));
  const basis: Reihen = { sp500: sp, vix: reihe("2024-01-01", 900, () => 16 + r() * 2) };
  const stichtag = "2026-03-02";

  it("eine invertierte Zinskurve senkt die Wahrscheinlichkeit für steigende Aktien", () => {
    const ohne = prognosen({ stichtag, reihen: basis, ereignisse: [] }).find(p => p.ziel === "aktien-us" && p.horizontTage === 365)!;
    const mit = prognosen({ stichtag, reihen: { ...basis, kurve: reihe("2025-01-01", 500, () => -0.6) }, ereignisse: [] }).find(p => p.ziel === "aktien-us" && p.horizontTage === 365)!;
    expect(mit.pHoch).toBeLessThan(ohne.pHoch);
    expect(mit.beitraege.some(b => b.mechanismus === "zinskurve" && b.richtung === -1)).toBe(true);
    expect(mit.spanne!.p10).toBeLessThan(mit.spanne!.p50); expect(mit.spanne!.p90).toBeGreaterThan(mit.spanne!.p50);
  });

  it("rechnet nie mit Daten aus der Zukunft", () => {
    const voll = prognosen({ stichtag, reihen: basis, ereignisse: [] });
    const gekappt = prognosen({ stichtag, reihen: { sp500: bis(basis.sp500, stichtag), vix: bis(basis.vix, stichtag) }, ereignisse: [] });
    expect(voll).toEqual(gekappt);
  });

  it("Indexaufnahme und Lockup erzeugen Einzelwert-Prognosen", () => {
    const l = lage({ stichtag, reihen: { ...basis, "kurs:SPCX": reihe("2026-01-01", 70, i => 150 + i) }, ereignisse: [{ id: "e1", datum: plusTage(stichtag, 5), art: "index-aufnahme", titel: "Aufnahme S&P 500", symbol: "SPCX" }] });
    const p = l.prognosen.find(x => x.ziel === "einzelwert")!;
    expect(p.symbol).toBe("SPCX"); expect(p.pHoch).toBeGreaterThan(0.52);
  });

  it("Risikolage halbiert die Positionsgröße bei Stress", () => {
    const stress: Reihen = { sp500: reihe("2025-01-01", 400, i => 5000 - i * 3), vix: [{ d: "2026-01-30", w: 35 }] };
    expect(risikolage({ stichtag: "2026-02-04", reihen: stress, ereignisse: [] })).toMatchObject({ lage: "risk-off", faktor: 0.5 });
    expect(risikolage({ stichtag: "2026-02-04", reihen: {}, ereignisse: [] }).faktor).toBe(1);
  });
});

describe("Überprüfung", () => {
  it("bewertet fällige Prognosen und bilanziert Treffer, Brier und Kalibrierung", () => {
    const reihen: Reihen = { sp500: [{ d: "2026-01-01", w: 100 }, { d: "2026-02-01", w: 110 }, { d: "2026-03-01", w: 95 }] };
    const p = (id: string, erstellt: string, faellig: string, pHoch: number) => ({ id, erstellt, ziel: "aktien-us" as const, reihe: "sp500", horizontTage: 31, faellig, ausgang: reihen.sp500!.find(x => x.d === erstellt)!.w, pHoch, beitraege: [{ mechanismus: "trend", richtung: (pHoch > 0.5 ? 1 : -1) as 1 | -1, staerke: 0.3, grund: "" }], modell: "t", spanne: { p10: 90, p50: 102, p90: 112 } });
    const a = bewerte(p("a", "2026-01-01", "2026-02-01", 0.8), reihen, "2026-03-10");
    const b = bewerte(p("b", "2026-02-01", "2026-03-01", 0.3), reihen, "2026-03-10");
    const c = bewerte(p("c", "2026-03-01", "2026-04-01", 0.6), reihen, "2026-03-10");
    expect(a.ergebnis).toMatchObject({ hoch: true, brier: 0.04, imBand: true });
    expect(b.ergebnis).toMatchObject({ hoch: false, brier: 0.09 });
    expect(c.ergebnis).toBeUndefined();
    const bi = bilanz([a, b, c]);
    expect(bi).toMatchObject({ n: 2, offen: 1, trefferquote: 1, brier: 0.065 });
    expect(bi.skill!).toBeGreaterThan(0);
    expect(bi.jeMechanismus.find(m => m.id === "trend")).toMatchObject({ n: 2, treffer: 2 });
  });

  it("Rückblick läuft über eine Historie und schärft Gewichte nur mit genug Fällen", () => {
    const r = zufall(3); let k = 3000;
    const reihen: Reihen = { sp500: reihe("2020-01-01", 2000, () => (k *= 1 + 0.0003 + r() * 0.025)), vix: reihe("2020-01-01", 2000, () => 18 + r() * 10) };
    const { bilanz: b, gewichte } = rueckblick(reihen, { von: "2021-01-01", bis: "2024-12-31", schrittTage: 30, lernen: true });
    expect(b.n).toBeGreaterThan(80);
    expect(b.brier!).toBeLessThan(0.4);
    expect(Object.keys(gewichte)).toContain("trend");
    expect(gewichteAus({ ...b, jeMechanismus: [{ id: "trend", name: "", n: 100, treffer: 80, quote: 0.8 }] }).trend).toBeGreaterThan(0.5);
  });
});
describe("Bugfix Welle 2: Import und Datenalter", () => {
  it("weist mehrdeutige Kommas, ungültige und zukünftige Daten sowie unplausible Werte zeilengenau ab", () => {
    const r = leseTabelle("Datum;Wert\n2026-08-01,2,15\n2026-13-45;2,1\n2030-01-01;2,0\n2026-09-01;71,4\n2026-10-01;2,70\n2026-07-01;2,5;Kommentar 9", { grenzen: [-2, 15], heute: "2026-10-24" });
    expect(r.punkte).toEqual([{ d: "2026-07-01", w: 2.5 }, { d: "2026-10-01", w: 2.7 }]);
    expect(r.fehler.map(f => f.zeile)).toEqual([2, 3, 4, 5]);
    expect(r.fehler[0]!.text).toContain("Mehrdeutig"); expect(r.fehler[1]!.text).toContain("Ungültiges Datum"); expect(r.fehler[2]!.text).toContain("Zukunft"); expect(r.fehler[3]!.text).toContain("außerhalb");
  });
  it("versteht FRED-CSV mit fehlenden Werten und Tabulator", () => {
    expect(leseTabelle("observation_date,DGS10\n2026-10-01,4.12\n2026-10-02,.", { heute: "2026-10-24" })).toEqual({ punkte: [{ d: "2026-10-01", w: 4.12 }], fehler: [] });
    expect(leseTabelle("2026-10-01\t48,7").punkte).toEqual([{ d: "2026-10-01", w: 48.7 }]);
  });
  it("veraltete Werte zählen nicht als aktuell", () => {
    const r = { bund10j: [{ d: "2015-06-01", w: 0.8 }], vix: [{ d: "2025-11-20", w: 35 }] };
    expect(lies(r, "bund10j", "2026-10-24")).toBeNull();
    expect(lies(r, "vix", "2026-10-24")).toBeNull();
    expect(lies({ bund10j: [{ d: "2026-09-01", w: 2.7 }] }, "bund10j", "2026-10-24")).toBe(2.7);
    expect(risikolage({ stichtag: "2026-10-24", reihen: r, ereignisse: [] }).faktor).toBe(1);
  });
});

