import { describe, expect, it } from "vitest";
import { BEISPIEL_ANLAGEPROFIL as AP, BEISPIEL_INVESTOR as INV, BEISPIEL_OBJEKT as OBJ } from "@highstack/engine";
import { EXPERTEN, fuehreAus, rueckfrage, STANDARD_MODELLE, teamlauf, testClient, WERKZEUGE, type Ereignis } from "../src";

const eingabe = { investor: INV, anlageprofil: AP, objekt: OBJ };

describe("Experten", () => {
  it("alle Experten sind geladen und nutzen nur vorhandene Werkzeuge", () => {
    expect(EXPERTEN.length).toBeGreaterThanOrEqual(12);
    for (const e of EXPERTEN) for (const w of e.werkzeuge) expect(WERKZEUGE[w], `${e.id}:${w}`).toBeDefined();
  });
});

describe("Laufzeit", () => {
  it("Makler rechnet Zielpreise mit dem Rechenwerk und gibt ab", async () => {
    const ev: Ereignis[] = [];
    const r = await fuehreAus("makler", { client: testClient(), modelle: STANDARD_MODELLE, eingabe, onEreignis: e => ev.push(e) });
    expect(r.schritte.some(s => s.includes("154.571 €"))).toBe(true);
    expect(r.schritte.some(s => s.includes("172.800 €"))).toBe(true);
    expect(ev.at(-1)!.typ).toBe("fertig");
  });
  it("Rückfrage liefert Text", async () => {
    const t = await rueckfrage("bank", { client: testClient(), modelle: STANDARD_MODELLE, eingabe, bisherigesErgebnis: {}, verlauf: [], frage: "Mehr Eigenkapital?" });
    expect(t).toContain("Testmodus");
  });
});

describe("Orchestrator", () => {
  it("Teamlauf mit Gestaltungsmodul: Projektentwickler, Komitee und Compliance", async () => {
    const schritte: string[] = [];
    const r = await teamlauf({ client: testClient(), modelle: STANDARD_MODELLE, eingabe: { ...eingabe, module: { moebliert: {} } }, onEreignis: e => { if (e.typ === "schritt") schritte.push(`${e.experte}: ${e.text}`); } });
    expect(Object.keys(r.berichte)).toEqual(expect.arrayContaining(["makler", "verwalter", "bank", "vermoegen", "steuer", "recht", "projektentwickler"]));
    expect(r.komitee?.ergebnis.synthese.urteil).toBe("Watch");
    expect(r.compliance?.freigabe).toBe(true);
    expect(schritte.some(s => s.startsWith("projektentwickler: Rechnet Modul Möbliertes Wohnen"))).toBe(true);
    expect(schritte.some(s => s.startsWith("steuer: Rechnet Steuern für GmbH"))).toBe(true);
  });
});
