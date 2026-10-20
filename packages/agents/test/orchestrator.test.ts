import { describe, expect, it } from "vitest";
import { BEISPIEL_ANLAGEPROFIL as AP, BEISPIEL_INVESTOR as INV, BEISPIEL_OBJEKT as OBJ } from "@highstack/engine";
import { EXPERTEN, fuehreAus, kurzurteil, neuerVerbrauch, regelpruefung, rueckfrage, STANDARD_MODELLE, teamlauf, testClient, WERKZEUGE, type Dokumentquelle, type Ereignis } from "../src";

const eingabe = { investor: INV, anlageprofil: AP, objekt: OBJ };
const basis = () => ({ client: testClient(), modelle: STANDARD_MODELLE });

describe("Experten", () => {
  it("alle Experten sind geladen und nutzen nur vorhandene Werkzeuge", () => {
    expect(EXPERTEN.length).toBeGreaterThanOrEqual(13);
    for (const e of EXPERTEN) for (const w of e.werkzeuge) expect(WERKZEUGE[w], `${e.id}:${w}`).toBeDefined();
  });
  it("Modell je Rolle: stark nur für Komitee, Recht, Projektentwicklung", () => {
    const stark = EXPERTEN.filter(e => e.modell === "expert").map(e => e.id).sort();
    expect(stark).toEqual(["komitee", "projektentwickler", "recht"]);
  });
});

describe("Laufzeit", () => {
  it("Makler rechnet zusätzliche Zielpreise mit dem Rechenwerk und gibt ab", async () => {
    const ev: Ereignis[] = [];
    const r = await fuehreAus("makler", { ...basis(), eingabe, onEreignis: e => ev.push(e) });
    expect(r.schritte.some(s => s.includes("154.571 €"))).toBe(true);
    expect(ev.at(-1)!.typ).toBe("fertig");
  });
  it("Kurzurteil braucht genau einen Aufruf", async () => {
    const v = neuerVerbrauch();
    const r = await kurzurteil({ ...basis(), eingabe, verbrauch: v });
    expect(r.ergebnis.einstufung).toBe("Watch");
    expect(v.aufrufe).toBe(1);
  });
  it("Rückfrage liefert Text", async () => {
    const t = await rueckfrage("bank", { ...basis(), eingabe, bisherigesErgebnis: {}, verlauf: [], frage: "Mehr Eigenkapital?" });
    expect(t).toContain("Testmodus");
  });
});

describe("Compliance-Regeln", () => {
  it("erkennt Handlungsanweisungen und Rechtsform-Empfehlungen", () => {
    const r = regelpruefung({ makler: { kernaussage: "Kaufen Sie das Objekt nur unter 200.000 €." }, steuer: { abschnitte: [{ titel: "x", punkte: ["Gründen Sie eine GmbH."] }] } });
    expect(r.freigabe).toBe(false);
    expect(r.beanstandungen.map(b => b.experte).sort()).toEqual(["makler", "steuer"]);
  });
  it("lässt sachliche Einschätzungen durch", () => {
    expect(regelpruefung({ bank: { kernaussage: "Aus Bankensicht ist der Beleihungsauslauf mit 102 % zu hoch." } }).freigabe).toBe(true);
  });
});

describe("Orchestrator", () => {
  it("überspringt den Teamlauf bei Pass ohne Gestaltung und Unterlagen", async () => {
    const r = await teamlauf({ ...basis(), eingabe });
    expect(r.uebersprungen).toMatch(/Pass/);
    expect(r.verbrauch.aufrufe).toBe(0);
  });
  it("läuft mit Gestaltung: Projektentwickler, Komitee, Compliance per Regeln ohne Modell", async () => {
    const schritte: string[] = [];
    const r = await teamlauf({ ...basis(), eingabe: { ...eingabe, module: { moebliert: {} } }, onEreignis: e => { if (e.typ === "schritt") schritte.push(`${e.experte}: ${e.text}`); } });
    expect(Object.keys(r.berichte)).toEqual(expect.arrayContaining(["makler", "verwalter", "bank", "vermoegen", "steuer", "recht", "projektentwickler"]));
    expect(r.komitee?.ergebnis.synthese.urteil).toBe("Watch");
    expect(r.compliance).toMatchObject({ freigabe: true, quelle: "regeln" });
    expect(schritte.some(s => s.startsWith("projektentwickler: Rechnet Modul Möbliertes Wohnen"))).toBe(true);
    expect(r.verbrauch.aufrufe).toBeLessThanOrEqual(20);
  });
  it("nutzt gespeicherte Ergebnisse bei unveränderten Eingaben", async () => {
    const e2 = { ...eingabe, module: { moebliert: {} } };
    const r1 = await teamlauf({ ...basis(), eingabe: e2 });
    const vorhanden = Object.fromEntries([...Object.entries(r1.berichte).filter(([, v]) => "hash" in v), ["komitee", r1.komitee!]]) as never;
    const r2 = await teamlauf({ ...basis(), eingabe: e2, vorhanden });
    expect(r2.verbrauch.aufrufe).toBe(0);
  });
  it("Dokumentprüfer läuft zuerst und gibt Befunde an die anderen", async () => {
    const dokumente: Dokumentquelle = { liste: () => [{ schluessel: "protokolle", titel: "WEG-Protokolle", status: "erhalten" }], lies: async () => ({ titel: "WEG-Protokolle", text: "Sonderumlage 85.000 €" }) };
    const reihenfolge: string[] = [];
    await teamlauf({ ...basis(), eingabe, dokumente, onEreignis: e => { if (e.typ === "start") reihenfolge.push(e.experte); } });
    expect(reihenfolge[0]).toBe("dokumentpruefer");
  });
});
