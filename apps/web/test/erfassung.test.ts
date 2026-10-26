import { describe, expect, it } from "vitest";
import { musterErkennung } from "../lib/erfassung";

describe("Stellplatz aus Inserat", () => {
  it("erkennt separat zu kaufenden TG-Stellplatz als Teileigentum", () => {
    const e = musterErkennung("3-Zimmer-Wohnung, Kaufpreis 289.000 €, Wohnfläche 74 m². Ein Tiefgaragenstellplatz kann zzgl. 18.500 € erworben werden (Teileigentum, eigenes Grundbuch).");
    expect(e.felder.kaufpreis).toBe(289000);
    expect(e.felder.stellplaetze?.[0]).toMatchObject({ art: "tiefgarage", preis: "separat", kaufpreis: 18500, recht: "teileigentum" });
  });
  it("erkennt Stellplatz im Preis und ignoriert „kein Stellplatz“", () => {
    expect(musterErkennung("Kaufpreis 199.000 €, inkl. Außenstellplatz").felder.stellplaetze?.[0]).toMatchObject({ art: "aussen", preis: "inklusive" });
    expect(musterErkennung("Kaufpreis 199.000 €, kein Stellplatz vorhanden").felder.stellplaetze).toBeUndefined();
  });
});

describe("Hausgeld aus Exposé", () => {
  const hg = (t: string) => musterErkennung(`Kaufpreis 250.000 €. ${t}`).felder;
  it.each([
    ["Hausgeld: 310 €", 310], ["Wohngeld mtl. ca. € 310,-", 310], ["Hausgeld (inkl. Instandhaltungsrücklage) 310,00 EUR", 310],
    ["Hausgeld 2025: 310 Euro monatlich", 310], ["Hausgeld\n\n310,50 €", 310.5], ["monatliches Hausgeld von 1.120 €", 1120],
  ])("%s", (t, w) => { expect(hg(t).hausgeldGesamt).toBe(w); expect(hg(t).hausgeldNichtUmlagefaehig).toBe(Math.round(w * 0.4)); });
  it("nimmt den nicht umlagefähigen Anteil, wenn genannt", () => {
    expect(hg("Hausgeld 310 €, davon nicht umlagefähig 118 €").hausgeldNichtUmlagefaehig).toBe(118);
  });
  it("verwechselt das Baujahr nicht mit dem Hausgeld", () => {
    expect(hg("Hausgeld auf Anfrage. Baujahr 1998, Miete 820 €").hausgeldGesamt).toBeUndefined();
  });
});

describe("Bugfix Welle 2: Auslesen", () => {
  it("beachtet Verneinungen (INV-003)", () => {
    const a = musterErkennung("Schöne Wohnung in 50667 Köln. Kaufpreis: 199.000 €. Kein Erbbaurecht. Eine Sonderumlage ist nicht geplant.").felder;
    expect(a.erbbaurecht).toBe(false); expect(a.sonderumlage).toBe(false);
    expect(musterErkennung("Die Wohnung ist unvermietet. Kaufpreis: 199.000 €").felder.leer).toBe(true);
    expect(musterErkennung("Die Wohnung ist vermietet, die Miete ist nicht indexiert. Kaufpreis: 199.000 €").felder.leer).toBe(false);
    expect(musterErkennung("Ein Stellplatz ist nicht vorhanden. Kaufpreis: 199.000 €").felder.stellplaetze).toBeUndefined();
    expect(musterErkennung("Das Objekt liegt im Erbbaurecht. Kaufpreis: 199.000 €").felder.erbbaurecht).toBe(true);
  });
  it("nimmt für den Stellplatz keine fremden Beträge (INV-004)", () => {
    const a = musterErkennung("QA Apartment mit Stellplatz in Köln Sülz\nKaufpreis: 129.000 €\nWohnfläche: 34 m²\nKaltmiete: 520 €").felder;
    expect(a.stellplaetze?.[0]?.kaufpreis ?? null).toBeNull();
    const b = musterErkennung("Wohnung in 50733 Köln. Kaufpreis: 210.000 €. Stellplatz: Außenstellplatz inklusive. Hausgeld monatlich 260 €, davon nicht umlagefähig 95 €.").felder;
    expect(b.stellplaetze?.[0]?.miete ?? null).toBeNull(); expect(b.stellplaetze?.[0]?.preis).toBe("inklusive");
    const c = musterErkennung("Wohnung mit Tiefgarage in 40211 Düsseldorf\nKaufpreis: 240.000 €\nDer Tiefgaragenstellplatz kann zzgl. 18.000 € erworben werden.").felder;
    expect(c.stellplaetze?.[0]).toMatchObject({ art: "tiefgarage", preis: "separat", kaufpreis: 18000 });
    const d = musterErkennung("Wohnung in 40211 Düsseldorf. Kaufpreis 240.000 €. Der Stellplatz ist nicht im Kaufpreis enthalten und kostet 15.000 €.").felder;
    expect(d.stellplaetze?.[0]?.kaufpreis).toBe(15000);
  });
  it("erkennt übliche Kaufpreis-Schreibweisen (INV-005)", () => {
    expect(musterErkennung("Kaufpreis: 289.000,- €").felder.kaufpreis).toBe(289000);
    expect(musterErkennung("Kaufpreis: EUR 289.000").felder.kaufpreis).toBe(289000);
  });
  it("nimmt Ort und Titel nicht aus dem Briefkopf des Maklers (INV-006)", () => {
    const a = musterErkennung("Immobilien Muster GmbH, Königsallee 1, 40212 Düsseldorf\nQA Wohnung in 50667 Köln Altstadt\nKaufpreis: 250.000 €").felder;
    expect(a.ort).toBe("Köln"); expect(a.titel).toBe("QA Wohnung in 50667 Köln Altstadt");
  });
});

describe("Grobe Orientierung ohne KI (INV-018)", () => {
  it("erkennt die Stadt nur aus dem Ort und als ganzes Wort", async () => {
    const { orientierung } = await import("../lib/marktwerte");
    expect(orientierung({ ort: "Köln", titel: "Wohnung Hamburger Straße", wohnflaeche: null, baujahr: null, energieklasse: null }).grundlage).toContain("Köln");
    expect(orientierung({ ort: "Kassel", titel: "Für Interessenten: Wohnung", wohnflaeche: null, baujahr: null, energieklasse: null }).grundlage).toContain("Keine Stadt");
    expect(orientierung({ ort: "Köln", titel: "x", wohnflaeche: null, baujahr: null, energieklasse: null }).marktmieteQm.von).toBe(Math.round(8.5 * 10) / 10);
  });
});

describe("Nachtest Welle 2 Investments", () => {
  it("„Erbbaurecht: nein“ und „Sonderumlage: keine“ sind Verneinungen (INV-003)", () => {
    const a = musterErkennung("Kaufpreis: 199.000 €\nErbbaurecht: nein\nSonderumlage: keine").felder;
    expect(a.erbbaurecht).toBe(false); expect(a.sonderumlage).toBe(false);
  });
  it("Stellplatz, Hotel oder Mittelstraße sind keine Makler-Kontaktzeilen (INV-046)", () => {
    const a = musterErkennung("Apartment mit Stellplatz in 50937 Köln\nWohnfläche: 34 m²\nKaufpreis: 129.000 €").felder;
    expect(a.titel).toBe("Apartment mit Stellplatz in 50937 Köln"); expect(a.ort).toBe("Köln");
  });
  it("Server übernimmt gültige Felder und meldet ungültige, statt das Objekt zu sperren (INV-047, INV-049)", async () => {
    const { bereinige } = await import("../lib/objektpruefung");
    const r = bereinige({ ruecklageAnteil: 6500, baujahr: 2090, gebaeudeanteil: 1.5, ort: 123, stellplaetze: "x", kaufpreis: 250000, energieklasse: "b" });
    expect(r.objekt).toEqual({ ruecklageAnteil: 6500, kaufpreis: 250000, energieklasse: "B" });
    expect(r.verworfen.length).toBe(4);
  });
});

describe("Außenfläche und Mietvertrag (Aushang Dachterrasse)", async () => {
  const { aussenflaecheAusText, mietvertragAusText, musterErkennung } = await import("../lib/erfassung");
  it("erkennt Dachterrasse mit Größe, Ausrichtung und Anbieter-Anrechnung", () => {
    const t = "Charmante Dachgeschosswohnung in Düsseldorf-Mitte\nca. 41,3 m² (Wohnfläche 33,5 m² zzgl. 15,6 m² Dachterrasse mıt Südausrichtung)\nDie Wohnung ist derzeit vermietet. Kaltmiete aktuell: 422 €\nKaufpreis: 165.200 €";
    const f = musterErkennung(t).felder;
    expect(f.wohnflaeche).toBe(33.5);
    expect(f.aussenflaeche).toEqual({ art: "dachterrasse", qm: 15.6, anrechnung: 0.25, inWohnflaeche: false, ausrichtung: "Süd", anbieterAnrechnung: 0.5 });
  });
  it("Balkon inklusive, verneint, ohne Größe", () => {
    expect(aussenflaecheAusText("Wohnfläche 72 m² inkl. Balkon (6 m²), Westbalkon.", 72)).toMatchObject({ art: "balkon", qm: 6, inWohnflaeche: true, ausrichtung: "West" });
    expect(aussenflaecheAusText("Die Wohnung hat keinen Balkon.", 50)).toBeNull();
    expect(aussenflaecheAusText("Schöne Wohnung mit Loggia nach Süden.", 50)).toMatchObject({ art: "loggia", qm: null, ausrichtung: "Süd" });
    expect(aussenflaecheAusText("Wohnung in der Gartenstraße 5", 50)).toBeNull();
  });
  it("Staffel-, Indexmiete und letzte Mieterhöhung", () => {
    expect(mietvertragAusText("Indexmietvertrag, letzte Mieterhöhung 03/2025")).toEqual({ art: "index", letzteErhoehung: "2025-03" });
    expect(mietvertragAusText("Staffelmiete mit 2,5 % pro Jahr")).toMatchObject({ art: "staffel", staffelProzent: 0.025 });
    expect(mietvertragAusText("Mieterhöhung zuletzt 2024")).toEqual({ art: "standard", letzteErhoehung: "2024-01" });
    expect(mietvertragAusText("Kaltmiete 500 €")).toBeNull();
  });
});

describe("INV-054: Kaufpreis in Millionen", async () => {
  const { musterErkennung } = await import("../lib/erfassung");
  it("liest „1,25 Mio. €“", () => {
    expect(musterErkennung("Mehrfamilienhaus in Köln\nKaufpreis: 1,25 Mio. €").felder.kaufpreis).toBe(1250000);
    expect(musterErkennung("Preis 2 Millionen Euro").felder.kaufpreis).toBe(2000000);
  });
});
