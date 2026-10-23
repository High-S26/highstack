import { describe, expect, it } from "vitest";
import { faktenFuer, type Marktbericht } from "../lib/marktwissen";

const b = (id: string, datum: string, status: "geprueft" | "entwurf", fakten: Marktbericht["fakten"]): Marktbericht => ({ id, titel: "Survey", herausgeber: "Haus", stand: datum, datum, quelleUrl: "", lizenz: "", kernaussagen: [], fakten, status, herkunft: "import", erfasst: 0, geaendert: 0 });
const f = (id: string, region: string, kennzahl: string, wert: number, segment: "wohnen" | "buero" = "wohnen", thema: "miete" | "zins" | "rendite" = "miete") => ({ id, thema, segment, region, kennzahl, wert, einheit: "€/m²", stichtag: "" });

describe("Marktwissen", () => {
  const alt = b("a", "2026-03-31", "geprueft", [f("1", "Düsseldorf", "Neuvertragsmiete", 12)]);
  const neu = b("n", "2026-09-30", "geprueft", [f("2", "Düsseldorf", "Neuvertragsmiete", 13), f("3", "Top 7", "Spitzenrendite", 4.25, "wohnen", "rendite"), f("4", "Deutschland", "EZB-Einlagensatz", 2.5, "wohnen", "zins"), f("5", "Köln", "Neuvertragsmiete", 11), f("6", "Düsseldorf", "Büromiete", 45, "buero")]);
  const entwurf = b("e", "2026-12-31", "entwurf", [f("7", "Düsseldorf", "Neuvertragsmiete", 99)]);
  it("nimmt Stadt vor Top 7 vor Deutschland, neuesten geprüften Stand, passendes Segment", () => {
    const r = faktenFuer([alt, neu, entwurf], { ort: "Düsseldorf-Bilk", titel: "", asset: "ETW" });
    expect(r.map(x => x.id)).toEqual(["2", "3", "4"]);
  });
  it("Top 7 nur für Städte der Top 7", () => {
    expect(faktenFuer([neu], { ort: "Neuss", titel: "", asset: "ETW" }).map(x => x.id)).toEqual(["4"]);
  });
  it("Gewerbe bekommt Bürodaten", () => {
    expect(faktenFuer([neu], { ort: "Düsseldorf", titel: "", asset: "Gewerbe" }).map(x => x.id)).toContain("6");
  });
});
