import { describe, expect, it } from "vitest";
import { erkenneArt, grundrissSeiten, verschiebe } from "../lib/unterlagen";
import { unterlagenFuer } from "../lib/vorgaben";

const erlaubt = new Set(unterlagenFuer("ETW").map(x => x[0]));
const EXPOSE = `Exposé · Schöne 3-Zimmer-Eigentumswohnung in Düsseldorf-Bilk
Objektbeschreibung: Die Wohnung liegt im 2. OG. Laut Teilungserklärung gehört ein Kellerraum dazu, Miteigentumsanteil 45/1000, Sondereigentum.
Ausstattung: Parkett, Balkon. Energieausweis: Verbrauchsausweis, 112 kWh. Kaufpreis 289.000 €. Käuferprovision 3,57 %. Ihr Ansprechpartner: Muster Immobilien.`;

describe("Unterlagen erkennen", () => {
  it("Exposé mit Erwähnung der Teilungserklärung bleibt Exposé", () => {
    expect(erkenneArt("Unterlagen_Wohnung.pdf", "application/pdf", EXPOSE, erlaubt)).toMatchObject({ schluessel: "expose" });
    expect(erkenneArt("Exposé_Bilk.pdf", "application/pdf", EXPOSE, erlaubt)).toMatchObject({ schluessel: "expose", sicher: true });
  });
  it("echte Teilungserklärung, Protokoll, Bild", () => {
    expect(erkenneArt("scan.pdf", "application/pdf", "Teilungserklärung nach § 8 WEG. Gemeinschaftsordnung. § 1 Sondereigentum … Aufteilungsplan", erlaubt).schluessel).toBe("teilung");
    expect(erkenneArt("doc.pdf", "application/pdf", "Protokoll der ordentlichen Eigentümerversammlung. TOP 1 … TOP 2 beschlossen", erlaubt).schluessel).toBe("protokolle");
    expect(erkenneArt("Grundriss_2OG.png", "image/png", "", erlaubt)).toMatchObject({ schluessel: "grundriss", sicher: true });
    expect(erkenneArt("IMG_2041.jpg", "image/jpeg", "", erlaubt).schluessel).toBe("fotos");
    expect(erkenneArt("x.pdf", "application/pdf", "", erlaubt).schluessel).toBe("sonst");
  });
  it("findet Grundriss-Seiten im Exposé", () => {
    expect(grundrissSeiten([EXPOSE, "Lage und Umgebung " + "x ".repeat(600), "Grundriss Wohnen 24,5 m² Schlafen 14 m² Küche 8 m² Bad 6 m² Flur Balkon"])).toEqual([3]);
  });
  it("verschiebt eine Datei samt Text", () => {
    const l = [{ schluessel: "teilung", titel: "T", status: "erhalten" as const, dateien: [{ id: "a", name: "e.pdf", mime: "application/pdf", text: "X", am: 1 }] }];
    const n = verschiebe(l, "a", "expose", () => "Exposé");
    expect(n.find(d => d.schluessel === "teilung")).toMatchObject({ status: "offen", dateien: [] });
    expect(n.find(d => d.schluessel === "expose")).toMatchObject({ status: "erhalten", text: "X", dateiId: "a" });
  });
});
