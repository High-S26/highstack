import { describe, expect, it } from "vitest";
import { analyse, BEISPIEL_ANLAGEPROFIL as AP, BEISPIEL_INVESTOR as INV, BEISPIEL_OBJEKT, bewerte, flaechen, mietpfad, params, regulierung, type Objekt } from "../src";

// Aushang Düsseldorf-Mitte: 33,5 m² Wohnfläche zzgl. 15,6 m² Dachterrasse, vermietet für 422 €
const DG: Objekt = { ...BEISPIEL_OBJEKT, titel: "DG Düsseldorf-Mitte", ort: "Düsseldorf-Mitte", kaufpreis: 165200, wohnflaeche: 33.5, miete: 422, marktmieteQm: 14,
  aussenflaeche: { art: "dachterrasse", qm: 15.6, anrechnung: 0.25, inWohnflaeche: false, ausrichtung: "Süd" } };
const opts = { jahre: 10, vmSteigerung: 0, inflation: 0.02, stichtag: "2026-11" };

describe("Fläche", () => {
  it("rechnet die Dachterrasse nach Wohnflächenverordnung an", () => {
    expect(flaechen(DG).gesamt).toBeCloseTo(37.4, 1);
    expect(flaechen({ ...DG, aussenflaeche: { ...DG.aussenflaeche!, anrechnung: 0.5 } }).gesamt).toBeCloseTo(41.3, 1);
    expect(flaechen({ ...DG, aussenflaeche: { ...DG.aussenflaeche!, anrechnung: 0.9 } }).gesamt).toBeCloseTo(41.3, 1); // höchstens die Hälfte
    expect(flaechen({ ...DG, aussenflaeche: { ...DG.aussenflaeche!, inWohnflaeche: true } }).gesamt).toBe(33.5);
    const b = bewerte(params(INV, AP), DG);
    expect(b.kennzahlen.preisQm).toBeCloseTo(165200 / 37.4, 0);
    expect(b.hinweise.some(h => /Dachterrasse 15,6 m² \(Süd\)/.test(h.text))).toBe(true);
  });
});

describe("Mietpfad", () => {
  it("Düsseldorf: Kappungsgrenze 15 %, Mietpreisbremse", () => {
    expect(regulierung(DG)).toMatchObject({ angespannt: true, kappung: 0.15, bremse: true, geprueft: true });
    expect(regulierung({ ort: "Kleinstadt", mietregulierung: null })).toMatchObject({ kappung: 0.15, geprueft: false });
    expect(regulierung({ ort: "Kleinstadt", mietregulierung: "normal" })).toMatchObject({ kappung: 0.2, bremse: false });
  });
  it("Bestand: frühestens 15 Monate nach der letzten Erhöhung, je drei Jahre höchstens 15 %, bis zur Vergleichsmiete", () => {
    const vm = 14 * 37.4; // 523,60 €
    // letzte Erhöhung 01/2026 von 400 € auf 422 €: frühestens 04/2027 (Monat 5 ab 11/2026), Kappung auf die Miete drei Jahre vorher (400 €) → 460 €
    const p = mietpfad({ ...DG, mietvertrag: { art: "standard", letzteErhoehung: "2026-01", mieteVorErhoehung: 400 } }, opts)!;
    expect(p.ersteErhoehung).toMatchObject({ monat: 5, datum: "04/2027" });
    expect(p.ersteErhoehung!.miete).toBeCloseTo(400 * 1.15, 2);
    // nächste Erhöhung frühestens 15 Monate später; Kappung bezieht sich auf die Miete drei Jahre vorher (422 €) → keine weitere bis 3 Jahre nach Start
    const zweite = p.schritte.filter(x => x.art === "558")[1]!;
    expect(zweite.monat).toBeGreaterThanOrEqual(26);
    expect(zweite.miete).toBeCloseTo(422 * 1.15, 1); // drei Jahre nach 01/2026: Basis 422 €
    const dritte = p.schritte.filter(x => x.art === "558")[2]!;
    expect(dritte.miete).toBeCloseTo(vm, 1);
    expect(p.vergleichErreicht).toBe(dritte.datum);
    expect(p.potenzialMonat).toBeCloseTo(vm - 422, 1);
  });
  it("INV-055: letzte Erhöhung unter drei Jahren ohne Vormiete: vorsichtig erst drei Jahre danach", () => {
    const p = mietpfad({ ...DG, mietvertrag: { art: "standard", letzteErhoehung: "2026-01" } }, opts)!;
    expect(p.ersteErhoehung).toMatchObject({ monat: 26, datum: "01/2029" });
    expect(p.hinweise.join(" ")).toMatch(/keine drei Jahre zurück/);
    // alte Erhöhung (über drei Jahre): sofort nach der Frist volle Kappung auf die heutige Miete
    const alt = mietpfad({ ...DG, mietvertrag: { art: "standard", letzteErhoehung: "2022-01" } }, opts)!;
    expect(alt.ersteErhoehung).toMatchObject({ monat: 3 }); expect(alt.ersteErhoehung!.miete).toBeCloseTo(422 * 1.15, 2);
  });
  it("ohne Datum der letzten Erhöhung vorsichtig: wie gerade erhöht", () => {
    const p = mietpfad(DG, opts)!;
    expect(p.ersteErhoehung!.monat).toBe(36);
    expect(p.hinweise.join(" ")).toMatch(/letzten Mieterhöhung unbekannt/);
  });
  it("Neuvermietung: höchstens Vergleichsmiete + 10 %, höhere Vormiete bleibt", () => {
    const leer = mietpfad({ ...DG, leer: true, miete: null, neuvermietungQm: 20 }, opts)!;
    expect(leer.start).toBeCloseTo(14 * 1.1 * 37.4, 1);
    expect(leer.hinweise.join(" ")).toMatch(/über dem zulässigen Rahmen/);
    // INV-056: ohne eigenes Ziel bleibt die höhere Vormiete ebenfalls
    const ohneZiel = mietpfad({ ...DG, miete: 600, mietvertrag: { art: "standard", letzteErhoehung: "2020-01", mieterwechselJahr: 3 } }, opts)!;
    expect(ohneZiel.schritte.find(x => x.art === "neuvermietung")!.miete).toBe(600);
    const wechsel = mietpfad({ ...DG, miete: 600, neuvermietungQm: 20, mietvertrag: { art: "standard", letzteErhoehung: "2020-01", mieterwechselJahr: 3 } }, opts)!;
    const n = wechsel.schritte.find(x => x.art === "neuvermietung")!;
    expect(n.miete).toBe(600); // Vormiete über dem Rahmen darf bleiben
    expect(wechsel.jahre[2]).toBeCloseTo(600 * 11, 0); // ein Monat Leerstand
    expect(wechsel.hinweise.join(" ")).toMatch(/über der Vergleichsmiete/);
  });
  it("Index- und Staffelmiete: keine Erhöhung nach § 558", () => {
    const idx = mietpfad({ ...DG, mietvertrag: { art: "index", letzteErhoehung: "2026-05" } }, opts)!;
    expect(idx.schritte.every(x => x.art === "index")).toBe(true);
    expect(idx.ersteErhoehung!.monat).toBe(6);
    expect(idx.ersteErhoehung!.miete).toBeCloseTo(422 * 1.02, 1);
    const st = mietpfad({ ...DG, mietvertrag: { art: "staffel", letzteErhoehung: "2026-05", staffelProzent: 0.03 } }, opts)!;
    expect(st.schritte[0]).toMatchObject({ art: "staffel", monat: 6 });
  });
  it("fließt in die Kalkulation: mehr Cashflow ab der Erhöhung, Zielpreis bei voller Vergleichsmiete", () => {
    const e = { investor: INV, anlageprofil: AP, objekt: { ...DG, mietvertrag: { art: "standard" as const, letzteErhoehung: "2022-01" } }, stichtag: "2026-11" };
    const a = analyse(e);
    const m = a.mietrecht!;
    expect(m.pfad.ersteErhoehung!.monat).toBe(3); // Verlangen nach Übergang, wirksam ab dem dritten Monat
    expect(a.simulation!.jahre[1]!.miete).toBeGreaterThan(a.simulation!.jahre[0]!.miete);
    expect(m.cashflow.find(x => x.jahr === 5)!.mit).toBeGreaterThan(m.cashflow.find(x => x.jahr === 5)!.ohne);
    expect(m.irrMit!).toBeGreaterThan(m.irrOhne!);
    expect(m.zielpreisVergleichsmiete!).toBeGreaterThan(a.zielpreise.cashflowNull!);
    const pauschal = analyse({ ...e, szenario: { mietentwicklung: "pauschal" } });
    expect(pauschal.simulation!.mietrecht).toBe(false);
  });
});
