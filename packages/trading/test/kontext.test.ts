import { describe, expect, it } from "vitest";
import { alpacaNachrichten, einordnen, kontextlage, kontextSperre, leseFinra, leseForm4, secInsider, type Nachricht } from "../src";

describe("Nachrichten einordnen", () => {
  it("erkennt Hoch- und Herabstufungen, Zahlen, Prognosen und Rechtliches", () => {
    expect(einordnen("Morgan Stanley upgrades NVDA to Overweight")).toEqual({ art: "hochstufung", richtung: 1 });
    expect(einordnen("Apple downgraded to Sell at XYZ")).toEqual({ art: "herabstufung", richtung: -1 });
    expect(einordnen("AMD beats Q3 estimates, record revenue")).toMatchObject({ richtung: 1 });
    expect(einordnen("Tesla misses on deliveries")).toMatchObject({ art: "zahlen-schlecht" });
    expect(einordnen("Meta raises full-year guidance")).toMatchObject({ art: "prognose-hoch" });
    expect(einordnen("Company lowers outlook amid weak demand")).toMatchObject({ art: "prognose-runter" });
    expect(einordnen("SEC opens investigation into accounting")).toMatchObject({ art: "rechtlich", richtung: -1 });
    expect(einordnen("CEO speaks at conference")).toEqual({ art: "sonstiges", richtung: 0 });
  });
  it("liest die Alpaca-Nachrichten-API", async () => {
    const holen = (async () => new Response(JSON.stringify({ news: [{ id: 1, headline: "NVDA upgraded to Buy", created_at: "2026-10-23T14:00:00Z", symbols: ["NVDA"], source: "benzinga" }] }))) as unknown as typeof fetch;
    const n = await alpacaNachrichten({ keyId: "k", secret: "s" }, ["NVDA"], "2026-10-22T00:00:00Z", holen);
    expect(n[0]).toMatchObject({ art: "hochstufung", richtung: 1, symbole: ["NVDA"] });
  });
});

const FORM4 = (name: string, code: string, stueck: number, preis: number) => `<ownershipDocument><reportingOwner><reportingOwnerId><rptOwnerName>${name}</rptOwnerName></reportingOwnerId><reportingOwnerRelationship><isOfficer>1</isOfficer><officerTitle>CFO</officerTitle></reportingOwnerRelationship></reportingOwner><nonDerivativeTable><nonDerivativeTransaction><transactionDate><value>2026-10-10</value></transactionDate><transactionCoding><transactionCode>${code}</transactionCode></transactionCoding><transactionAmounts><transactionShares><value>${stueck}</value></transactionShares><transactionPricePerShare><value>${preis}</value></transactionPricePerShare></transactionAmounts></nonDerivativeTransaction></nonDerivativeTable></ownershipDocument>`;

describe("Insider (SEC Form 4)", () => {
  it("liest Käufe über die Börse und ignoriert andere Codes", () => {
    expect(leseForm4(FORM4("Jane Doe", "P", 1000, 50.5), "XYZ")).toEqual([{ symbol: "XYZ", datum: "2026-10-10", person: "Jane Doe", rolle: "CFO", art: "kauf", stueck: 1000, preis: 50.5, wert: 50500 }]);
    expect(leseForm4(FORM4("Jane Doe", "A", 1000, 0), "XYZ")).toEqual([]);
  });
  it("holt die Meldungen eines Werts mit User-Agent", async () => {
    const kopf: string[] = [];
    const holen = (async (u: string, i?: RequestInit) => {
      kopf.push((i?.headers as Record<string, string>)["user-agent"]!);
      if (u.includes("submissions")) return new Response(JSON.stringify({ filings: { recent: { form: ["4", "10-Q", "4"], accessionNumber: ["0001-26-000001", "x", "0001-26-000002"], filingDate: ["2026-10-12", "2026-10-01", "2026-10-11"], primaryDocument: ["xslF345X05/doc1.xml", "q.htm", "xslF345X05/doc2.xml"] } } }));
      return new Response(u.endsWith("doc1.xml") ? FORM4("A", "P", 100, 10) : FORM4("B", "P", 200, 10));
    }) as unknown as typeof fetch;
    const g = await secInsider("XYZ", "0000123456", "2026-09-01", holen, "highstack test@example.com");
    expect(g.map(x => x.person)).toEqual(["A", "B"]); expect(kopf.every(k => k.includes("@"))).toBe(true);
  });
});

describe("Kontext als Filter", () => {
  const jetzt = new Date("2026-10-23T16:00:00Z");
  const n = (titel: string, sym = "NVDA"): Nachricht => ({ id: titel, zeit: "2026-10-23T13:00:00Z", symbole: [sym], titel, quelle: "t", ...einordnen(titel) });
  it("sperrt Käufe gegen frische schlechte Nachrichten und Shorts gegen Insider-Käufe oder hohen Short-Anteil", () => {
    const schlecht = kontextlage("NVDA", [n("NVDA downgraded to Sell")], [], null, jetzt);
    expect(kontextSperre("long", schlecht)).toContain("Schlechte Nachricht"); expect(kontextSperre("short", schlecht)).toBeNull();
    const insider = kontextlage("NVDA", [], [{ symbol: "NVDA", datum: "2026-10-10", person: "A", rolle: "CEO", art: "kauf", stueck: 1, preis: 1, wert: 50000 }, { symbol: "NVDA", datum: "2026-10-12", person: "B", rolle: "CFO", art: "kauf", stueck: 1, preis: 1, wert: 60000 }], 0.65, jetzt);
    expect(kontextSperre("short", insider)).toBeTruthy(); expect(kontextSperre("long", insider)).toBeNull();
    expect(kontextlage("NVDA", [{ ...n("NVDA downgraded"), zeit: "2026-10-20T10:00:00Z" }], [], null, jetzt).nachrichten).toBe(0);
  });
  it("liest die FINRA-Tagesdatei", () => {
    expect(leseFinra("Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market\n20261022|NVDA|6000|0|10000|B,Q,N\n20261022|AAPL|1|0|0|Q", ["NVDA", "AAPL"])).toEqual({ NVDA: 0.6 });
  });
});
