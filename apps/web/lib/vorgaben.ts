import { BEISPIEL_OBJEKT, type Anlageprofil, type Investorenprofil, type Objekt } from "@highstack/engine";
import type { Dokument, Objektdatensatz, Profil, Suchauftrag } from "./typen";

export const id = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const STANDARD_INVESTOR: Investorenprofil = {
  eigenkapital: 50000, kreditrahmen: 230000, bundesland: "NW", sollzins: 0.038, tilgung: 0.02, zinsbindung: 10, risiko: "ausgewogen",
  struktur: "privat", grenzsteuersatz: 0.42, gbrAnteil: 0.5, gmbhKostenJahr: 2500, gmbhGruendung: 1500,
  notar: 0.02, makler: 0.0357, mietausfall: 0.02, beleihungsabschlag: 0.1, maxBeleihungsauslauf: 1, minDscr: 1.1,
};
export const neuesAnlageprofil = (name = "Neues Anlageprofil"): Anlageprofil => ({
  id: id(), name, strategie: "Mix", regionen: [], assetklassen: ["ETW"], preisMax: null, minBruttorendite: 0.05, maxFaktor: 22, minCashflow: 0, haltedauer: 15,
  gewichte: { rendite: 30, lage: 25, substanz: 20, finanzierung: 25 }, ko: { erbbaurecht: true, sonderumlage: true, energieGH: false },
});
export function standardProfil(): Profil {
  const ap = neuesAnlageprofil("Mein erstes Investment");
  return { onboarded: false, investor: STANDARD_INVESTOR, anlageprofile: [ap], aktivesAnlageprofil: ap.id };
}
export const LEERES_OBJEKT: Objekt = {
  titel: "Neues Objekt", ort: "", asset: "ETW", kaufpreis: null, wohnflaeche: null, leer: false, miete: null, marktmieteQm: null, vergleichspreisQm: null,
  hausgeldNichtUmlagefaehig: null, ruecklageAnteil: null, baujahr: null, energieklasse: null, bodenrichtwert: null, gebaeudeanteil: 0.75, erbbaurecht: false, sonderumlage: false,
};

export const UNTERLAGEN: Record<"ETW" | "MFH", [string, string, string][]> = {
  ETW: [["grundbuch", "Grundbuchauszug", "Abt. II (Rechte, Lasten) und III (Grundschulden)"], ["teilung", "Teilungserklärung & Aufteilungsplan", "Sondereigentum, Sondernutzungsrechte, Kostenverteilung"], ["protokolle", "WEG-Protokolle (3 Jahre)", "Sanierungsbeschlüsse, Streit, Sonderumlagen"], ["wirtschaft", "Wirtschaftsplan & Hausgeldabrechnung", "Hausgeld, Rückstände, umlagefähig oder nicht"], ["ruecklage", "Stand der Erhaltungsrücklage", "Höhe je m², geplante Entnahmen"], ["energie", "Energieausweis", "Klasse, Kennwert, Gültigkeit"], ["miete", "Mietvertrag & Zahlungseingänge", "Miethöhe, Staffel/Index, Rückstände"], ["flaeche", "Wohnflächenberechnung", "Fläche laut Exposé vs. Berechnung"], ["baulast", "Baulastenverzeichnis", "Eingetragene Baulasten"], ["kaufvertrag", "Kaufvertragsentwurf", "Fälligkeit, Gewährleistung, Lasten, Sondervereinbarungen"], ["sonst", "Weitere Unterlagen", "Alles, was sonst vorliegt"]],
  MFH: [["grundbuch", "Grundbuchauszug", "Abt. II und III"], ["mieter", "Mieterliste", "Mieten, Laufzeiten, Leerstand"], ["vertraege", "Mietverträge", "Konditionen, Befristung, Staffel/Index"], ["bk", "Betriebskostenabrechnungen (2 Jahre)", "Umlage, Nachzahlungen"], ["instand", "Instandhaltungshistorie", "Letzte Maßnahmen, Stau"], ["energie", "Energieausweis", "Klasse, Kennwert, Gültigkeit"], ["flaeche", "Flächenaufstellung", "Flächen vs. Exposé"], ["baulast", "Baulastenverzeichnis", "Eingetragene Baulasten"], ["bauakte", "Bauakte & Genehmigungen", "Genehmigte Nutzung, Auflagen"], ["kaufvertrag", "Kaufvertragsentwurf", "Fälligkeit, Gewährleistung, Lasten"], ["sonst", "Weitere Unterlagen", "Alles, was sonst vorliegt"]],
};
/** Angebotsunterlagen: was der Verkäufer oder Makler liefert. Wird ausgelesen und angezeigt. */
export const ANGEBOT: [string, string, string][] = [["expose", "Exposé & Inserat", "Angaben werden ausgelesen und mit den Unterlagen abgeglichen"], ["grundriss", "Grundrisse & Pläne", "Raumaufteilung, Flächen, Ausrichtung"], ["fotos", "Fotos", "Zustand, Ausstattung, Umfeld"]];
export const ANGEBOT_KEYS = new Set(ANGEBOT.map(x => x[0]));
export const unterlagenFuer = (asset: string) => [...ANGEBOT, ...UNTERLAGEN[asset === "MFH" || asset === "Gewerbe" ? "MFH" : "ETW"]];
export function standardDokumente(asset: string): Dokument[] {
  return unterlagenFuer(asset).map(([schluessel, titel]) => ({ schluessel, titel, status: "offen" }));
}

export function neuesObjekt(anlageprofilId: string, beispiel = false, status: Objektdatensatz["status"] = "pruefung"): Objektdatensatz {
  const objekt = beispiel ? { ...BEISPIEL_OBJEKT } : { ...LEERES_OBJEKT };
  return { id: id(), status, anlageprofilId, objekt, szenario: {}, module: {}, expose: "", dokumente: standardDokumente(objekt.asset), experten: {}, erstellt: Date.now(), geaendert: Date.now() };
}

export function neueSuche(p: Profil, name?: string): Suchauftrag {
  const ap = p.anlageprofile.find(a => a.id === p.aktivesAnlageprofil) ?? p.anlageprofile[0]!;
  const region = ap.regionen[0] ?? "";
  return { id: id(), name: name ?? ([ap.assetklassen[0] ?? "ETW", region].filter(Boolean).join(" ") || "Neue Suche"), anlageprofilId: ap.id, region, asset: ap.assetklassen[0] ?? "ETW", aktiv: true, erstellt: Date.now() };
}

/** Anlageprofil passend zur Strategie vorbelegen (Rendite, Faktor, Cashflow, Gewichte) */
export function nachStrategie(ap: Anlageprofil, risiko: Investorenprofil["risiko"]): Anlageprofil {
  const s = ap.strategie;
  return { ...ap, name: ap.name.trim() || "Neues Anlageprofil", minBruttorendite: s === "Cashflow" ? 0.06 : s === "Wertsteigerung" ? 0.035 : 0.05, maxFaktor: s === "Cashflow" ? 17 : s === "Wertsteigerung" ? 30 : 22, minCashflow: s === "Wertsteigerung" ? -150 : 0, gewichte: { rendite: s === "Cashflow" ? 40 : 25, lage: s === "Wertsteigerung" ? 40 : 25, substanz: 20, finanzierung: 25 }, ko: { ...ap.ko, energieGH: risiko === "vorsichtig" } };
}
