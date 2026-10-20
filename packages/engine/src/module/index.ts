import type { Objekt, Params } from "../types";
import { nebenkostenSatz } from "../core";
import { projektrechnung, type Projektergebnis } from "./projekt";

export type ParamTyp = "zahl" | "prozent" | "euro" | "auswahl" | "jaNein";
export interface ParamDef {
  key: string; label: string; typ: ParamTyp; einheit?: string;
  standard: number | string | boolean | ((o: Objekt, p: Params) => number | string | boolean);
  min?: number; max?: number; schritt?: number; optionen?: { wert: string; label: string }[]; hilfe?: string; gruppe: string;
}
export interface Kennzahl { key: string; label: string; wert: number | null; einheit: "€" | "%" | "x" | "Monate" | "Jahre" | "m²" | "€/m²" | "" }
import type { Hinweis } from "../core";
export type { Hinweis };
export interface Modulergebnis { kennzahlen: Kennzahl[]; hinweise: Hinweis[]; projekt?: Projektergebnis; details?: Record<string, number | null> }
export interface Modul {
  id: string; name: string; kurz: string; experten: string[]; huerden: string[];
  parameter: ParamDef[];
  rechne(werte: Record<string, number | string | boolean>, o: Objekt, p: Params): Modulergebnis;
}
type W = Record<string, number | string | boolean>;
const num = (w: W, k: string) => Number(w[k] ?? 0);
const str = (w: W, k: string) => String(w[k] ?? "");
const bool = (w: W, k: string) => w[k] === true || w[k] === "true";
const de = (v: number, d = 1) => v.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });
const kz = (key: string, label: string, wert: number | null, einheit: Kennzahl["einheit"]): Kennzahl => ({ key, label, wert: wert != null && Number.isFinite(wert) ? wert : null, einheit });
const projektKennzahlen = (r: Projektergebnis): Kennzahl[] => [
  kz("gesamtkosten", "Gesamtkosten inkl. Zinsen", r.gesamtkostenInklZinsen, "€"),
  kz("erloes", "Erlös bzw. Wert beim Ausstieg", r.erloes, "€"),
  kz("gewinn", "Gewinn", r.gewinn, "€"),
  kz("marge", "Marge auf Kosten", r.margeAufKosten, "%"),
  kz("eigenkapital", "Eigenkapital", r.eigenkapital, "€"),
  kz("multiple", "Eigenkapital-Multiple", r.ekMultiple, "x"),
  kz("irr", "Eigenkapitalrendite p. a. (IRR)", r.irr, "%"),
  kz("laufzeit", "Laufzeit", r.laufzeitMonate, "Monate"),
];
const ausstiegParams = (gruppe = "Ausstieg"): ParamDef[] => [
  { key: "ausstieg", label: "Ausstieg", typ: "auswahl", standard: "verkauf", optionen: [{ wert: "verkauf", label: "Verkauf" }, { wert: "bestand", label: "Halten (Bewertung)" }], gruppe },
  { key: "verkaufspreisQm", label: "Verkaufspreis", typ: "euro", einheit: "€/m²", standard: (o) => Math.round((o.vergleichspreisQm ?? 4500) / 50) * 50, min: 500, max: 20000, schritt: 50, gruppe },
  { key: "vertriebQuote", label: "Vertriebskosten", typ: "prozent", standard: 0.04, min: 0, max: 0.1, schritt: 0.005, gruppe },
  { key: "mieteQm", label: "Miete nach Fertigstellung", typ: "euro", einheit: "€/m²", standard: (o) => o.marktmieteQm ?? 13, min: 4, max: 60, schritt: 0.1, gruppe },
  { key: "bewirtschaftung", label: "Bewirtschaftung und Leerstand", typ: "prozent", standard: 0.2, min: 0, max: 0.5, schritt: 0.01, gruppe, hilfe: "Anteil der Miete für nicht umlagefähige Kosten und Mietausfall" },
  { key: "exitRendite", label: "Bewertungsrendite (Netto)", typ: "prozent", standard: 0.04, min: 0.02, max: 0.1, schritt: 0.0025, gruppe, hilfe: "Nettomiete geteilt durch Wert" },
];
const finanzParams = (ek = 0.25, zins = 0.055): ParamDef[] => [
  { key: "ekQuote", label: "Eigenkapitalanteil", typ: "prozent", standard: ek, min: 0, max: 1, schritt: 0.05, gruppe: "Finanzierung" },
  { key: "zins", label: "Zins Zwischen- bzw. Bauzeitfinanzierung", typ: "prozent", standard: zins, min: 0.01, max: 0.12, schritt: 0.0025, gruppe: "Finanzierung" },
];
const zeitParams = (pl = 9, bau = 12, ver = 6): ParamDef[] => [
  { key: "planungMonate", label: "Planung und Genehmigung", typ: "zahl", einheit: "Monate", standard: pl, min: 0, max: 48, schritt: 1, gruppe: "Zeit" },
  { key: "bauMonate", label: "Bauzeit", typ: "zahl", einheit: "Monate", standard: bau, min: 0, max: 48, schritt: 1, gruppe: "Zeit" },
  { key: "vermarktungMonate", label: "Vermarktung bzw. Vermietung", typ: "zahl", einheit: "Monate", standard: ver, min: 0, max: 36, schritt: 1, gruppe: "Zeit" },
];
function ausstiegErloes(w: W, wohnflaeche: number) {
  if (str(w, "ausstieg") === "bestand") {
    const noi = num(w, "mieteQm") * wohnflaeche * 12 * (1 - num(w, "bewirtschaftung"));
    return { erloes: noi / num(w, "exitRendite"), noi };
  }
  return { erloes: num(w, "verkaufspreisQm") * wohnflaeche * (1 - num(w, "vertriebQuote")), noi: null as number | null };
}
/** Erwarteter Gewinn mit Genehmigungsrisiko: bei Scheitern gehen Planungskosten und Haltezinsen verloren. */
function risikoAngepasst(r: Projektergebnis, wahrscheinlichkeit: number, verlustBeiScheitern: number) {
  return wahrscheinlichkeit * r.gewinn - (1 - wahrscheinlichkeit) * verlustBeiScheitern;
}

export const MODULE: Modul[] = [
  {
    id: "umnutzung", name: "Umnutzung, z. B. Gewerbe zu Wohnen", kurz: "Gewerbe- oder Büroflächen in Wohnungen (oder eine andere Nutzung) umbauen und verkaufen oder halten.",
    experten: ["projektentwickler", "recht", "bank"],
    huerden: ["Zulässigkeit der Zielnutzung im Baugebiet (BauNVO) bzw. Befreiung nach Bau-Turbo (§ 31 Abs. 3, § 34 Abs. 3b, § 246e BauGB, befristet bis Ende 2030)", "Baugenehmigung für die Nutzungsänderung nach Landesbauordnung", "Stellplatznachweis oder Ablöse", "Brandschutz und zweiter Rettungsweg", "Schallschutz, Belichtung, Raumhöhen", "Energiestandard nach GEG"],
    parameter: [
      { key: "zielnutzung", label: "Zielnutzung", typ: "auswahl", standard: "wohnen", optionen: [{ wert: "wohnen", label: "Wohnen" }, { wert: "praxis", label: "Praxis / Büro" }, { wert: "gastro", label: "Gastronomie" }, { wert: "studios", label: "Studios / Lager" }], gruppe: "Objekt" },
      { key: "bgf", label: "Bruttogeschossfläche", typ: "zahl", einheit: "m²", standard: (o) => Math.round((o.wohnflaeche ?? 600) / 0.8), min: 20, max: 50000, schritt: 10, gruppe: "Objekt" },
      { key: "effizienz", label: "Flächeneffizienz (Nutzfläche / BGF)", typ: "prozent", standard: 0.8, min: 0.5, max: 0.95, schritt: 0.01, gruppe: "Objekt" },
      { key: "baukostenQm", label: "Umbaukosten je m² BGF", typ: "euro", einheit: "€/m²", standard: 1600, min: 200, max: 6000, schritt: 50, gruppe: "Kosten" },
      { key: "baunebenkostenQuote", label: "Baunebenkosten", typ: "prozent", standard: 0.18, min: 0.05, max: 0.35, schritt: 0.01, gruppe: "Kosten", hilfe: "Planung, Gutachten, Genehmigung" },
      { key: "puffer", label: "Puffer für Unvorhergesehenes", typ: "prozent", standard: 0.1, min: 0, max: 0.3, schritt: 0.01, gruppe: "Kosten" },
      { key: "stellplaetzeFehlend", label: "Fehlende Stellplätze", typ: "zahl", standard: 0, min: 0, max: 200, schritt: 1, gruppe: "Kosten" },
      { key: "abloeseJeStellplatz", label: "Ablöse je Stellplatz", typ: "euro", einheit: "€", standard: 10000, min: 0, max: 40000, schritt: 500, gruppe: "Kosten" },
      ...zeitParams(9, 12, 6), ...ausstiegParams(), ...finanzParams(0.3, 0.055),
      { key: "genehmigung", label: "Wahrscheinlichkeit der Genehmigung", typ: "prozent", standard: 0.7, min: 0.1, max: 1, schritt: 0.05, gruppe: "Risiko" },
    ],
    rechne(w, o, p) {
      const kp = o.kaufpreis ?? 0; const nf = num(w, "bgf") * num(w, "effizienz");
      const bau = num(w, "bgf") * num(w, "baukostenQm");
      const nebenk = bau * num(w, "baunebenkostenQuote"); const puffer = (bau + nebenk) * num(w, "puffer");
      const ablose = num(w, "stellplaetzeFehlend") * num(w, "abloeseJeStellplatz");
      const pl = num(w, "planungMonate"), bm = num(w, "bauMonate"), vm = num(w, "vermarktungMonate");
      const { erloes, noi } = ausstiegErloes(w, nf);
      const r = projektrechnung({ ankauf: kp * (1 + nebenkostenSatz(p)), ekQuote: num(w, "ekQuote"), zins: num(w, "zins"), exitMonat: pl + bm + vm, erloes,
        kosten: [{ name: "Planung", betrag: nebenk * 0.4, startMonat: 0, dauerMonate: Math.max(1, pl) }, { name: "Bau", betrag: bau + nebenk * 0.6 + puffer, startMonat: pl, dauerMonate: Math.max(1, bm) }, { name: "Stellplatzablöse", betrag: ablose, startMonat: pl, dauerMonate: 1 }] });
      const pw = num(w, "genehmigung");
      const verlust = nebenk * 0.4 + kp * nebenkostenSatz(p) + kp * num(w, "zins") * pl / 12;
      const hinweise: Hinweis[] = [];
      if (r.margeAufKosten < 0.15) hinweise.push({ art: "warn", text: `Marge ${de(r.margeAufKosten * 100, 1)} % liegt unter der üblichen Entwicklermarge von 15–20 %.` });
      if (pw < 0.6) hinweise.push({ art: "crit", text: "Genehmigung unsicher: Bauvoranfrage vor Ankauf oder Kaufvertrag mit Rücktrittsrecht prüfen lassen." });
      if (str(w, "zielnutzung") === "wohnen") hinweise.push({ art: "info", text: "Für Wohnen kann der Bau-Turbo Befreiungen erleichtern; die Zustimmung der Gemeinde und eine Baugenehmigung bleiben nötig." });
      return { projekt: r, hinweise, details: { nutzflaeche: nf, noi, kostenJeQmNutzflaeche: r.gesamtkostenInklZinsen / nf },
        kennzahlen: [...projektKennzahlen(r), kz("nutzflaeche", "Neue Nutzfläche", nf, "m²"), kz("kostenQm", "Gesamtkosten je m² Nutzfläche", r.gesamtkostenInklZinsen / nf, "€/m²"), kz("erwartet", "Erwarteter Gewinn mit Genehmigungsrisiko", risikoAngepasst(r, pw, verlust), "€"), ...(noi != null ? [kz("yoc", "Rendite auf Kosten (Yield on Cost)", noi / r.gesamtkostenInklZinsen, "%")] : [])] };
    },
  },
  {
    id: "moebliert", name: "Möbliertes Wohnen", kurz: "Wohnungen möbliert vermieten, auch als Mikroapartments für Pendler, Studierende oder Projektkräfte.",
    experten: ["makler", "verwalter", "steuer", "recht"],
    huerden: ["Mietpreisbremse (bis 2029 verlängert): Vergleichsmiete + 10 % plus angemessener Möblierungszuschlag", "Regierungsentwurf Mietrecht II (29.04.2026): Zuschlag gesondert ausweisen, Pauschale 10 % bei Vollmöblierung, Kurzzeitverträge höchstens sechs Monate", "Abgrenzung zur gewerblichen Vermietung bei hotelähnlichen Leistungen"],
    parameter: [
      { key: "einheiten", label: "Einheiten", typ: "zahl", standard: 1, min: 1, max: 500, schritt: 1, gruppe: "Objekt" },
      { key: "flaecheJeEinheit", label: "Fläche je Einheit", typ: "zahl", einheit: "m²", standard: (o) => o.wohnflaeche ?? 30, min: 12, max: 200, schritt: 1, gruppe: "Objekt" },
      { key: "mieteUnmoebliertQm", label: "Kaltmiete unmöbliert (Vergleich)", typ: "euro", einheit: "€/m²", standard: (o) => o.marktmieteQm ?? (o.miete && o.wohnflaeche ? Math.round(o.miete / o.wohnflaeche * 10) / 10 : 12), min: 4, max: 40, schritt: 0.1, gruppe: "Miete" },
      { key: "mieteMoebliertQm", label: "Kaltmiete möbliert, angestrebt", typ: "euro", einheit: "€/m²", standard: 19, min: 4, max: 60, schritt: 0.1, gruppe: "Miete" },
      { key: "mietpreisbremse", label: "Mietpreisbremse gilt", typ: "jaNein", standard: true, gruppe: "Recht" },
      { key: "vergleichsmieteQm", label: "Ortsübliche Vergleichsmiete", typ: "euro", einheit: "€/m²", standard: (o) => o.marktmieteQm ?? 12, min: 4, max: 40, schritt: 0.1, gruppe: "Recht" },
      { key: "zuschlagQuote", label: "Möblierungszuschlag", typ: "prozent", standard: 0.1, min: 0, max: 0.4, schritt: 0.01, gruppe: "Recht", hilfe: "Entwurf Mietrecht II: Pauschale 10 % der Nettokaltmiete" },
      { key: "moebelJeEinheit", label: "Möblierung je Einheit", typ: "euro", einheit: "€", standard: 9000, min: 1000, max: 40000, schritt: 500, gruppe: "Kosten" },
      { key: "ersatzJahre", label: "Nutzungsdauer der Möbel", typ: "zahl", einheit: "Jahre", standard: 7, min: 3, max: 15, schritt: 1, gruppe: "Kosten" },
      { key: "auslastung", label: "Auslastung", typ: "prozent", standard: 0.93, min: 0.5, max: 1, schritt: 0.01, gruppe: "Betrieb" },
      { key: "wechselJahr", label: "Mieterwechsel je Einheit und Jahr", typ: "zahl", standard: 2, min: 0, max: 12, schritt: 0.5, gruppe: "Betrieb" },
      { key: "kostenJeWechsel", label: "Kosten je Wechsel", typ: "euro", einheit: "€", standard: 400, min: 0, max: 3000, schritt: 50, gruppe: "Betrieb", hilfe: "Reinigung, Übergabe, Inserat" },
      { key: "verwaltungQuote", label: "Verwaltung möbliert", typ: "prozent", standard: 0.08, min: 0, max: 0.3, schritt: 0.01, gruppe: "Betrieb" },
    ],
    rechne(w, o, p) {
      const n = num(w, "einheiten"), fl = num(w, "flaecheJeEinheit"), qm = n * fl;
      const zulaessig = bool(w, "mietpreisbremse") ? num(w, "vergleichsmieteQm") * 1.1 * (1 + num(w, "zuschlagQuote")) : Infinity;
      const mieteQm = Math.min(num(w, "mieteMoebliertQm"), zulaessig);
      const jahrM = mieteQm * qm * 12 * num(w, "auslastung");
      const kostenM = jahrM * num(w, "verwaltungQuote") + n * num(w, "wechselJahr") * num(w, "kostenJeWechsel") + n * num(w, "moebelJeEinheit") / num(w, "ersatzJahre");
      const jahrU = num(w, "mieteUnmoebliertQm") * qm * 12 * (1 - p.mietausfall);
      const mehr = jahrM - kostenM - jahrU;
      const invest = n * num(w, "moebelJeEinheit");
      const hinweise: Hinweis[] = [];
      if (num(w, "mieteMoebliertQm") > zulaessig) hinweise.push({ art: "warn", text: `Angestrebte Miete über dem zulässigen Rahmen: höchstens ${de(zulaessig, 2)} €/m² bei Mietpreisbremse. Gerechnet wird mit dem zulässigen Wert.` });
      if (mehr <= 0) hinweise.push({ art: "crit", text: "Möbliert lohnt sich mit diesen Annahmen nicht gegenüber der unmöblierten Vermietung." });
      hinweise.push({ art: "info", text: "Der Regierungsentwurf Mietrecht II ist noch kein Gesetz. Das Modul rechnet mit dem eingestellten Zuschlag; ohne gesonderten Ausweis gälte die Wohnung künftig als unmöbliert." });
      return { hinweise, details: { zulaessigQm: Number.isFinite(zulaessig) ? zulaessig : null, mieteQm },
        kennzahlen: [kz("mieteQm", "Gerechnete Kaltmiete möbliert", mieteQm, "€/m²"), kz("ertragMoebliert", "Jahresertrag möbliert nach Kosten", jahrM - kostenM, "€"), kz("ertragUnmoebliert", "Jahresertrag unmöbliert", jahrU, "€"), kz("mehrertrag", "Mehrertrag pro Jahr", mehr, "€"), kz("invest", "Investition Möblierung", invest, "€"), kz("rendite", "Rendite auf die Möblierung", invest > 0 ? mehr / invest : null, "%"), kz("amortisation", "Amortisation", mehr > 0 ? invest / mehr : null, "Jahre")] };
    },
  },
  {
    id: "kurzzeit", name: "Kurzzeit- und Serviced Apartments", kurz: "Vermietung nach Tagen oder Wochen über Plattformen oder an Firmen.",
    experten: ["recht", "steuer", "verwalter"],
    huerden: ["Zweckentfremdungssatzung der Stadt (Genehmigung, Registrierungsnummer, Höchsttage)", "Gewerblichkeit bei hotelähnlichen Leistungen: Gewerbesteuer, Umsatzsteuer (7 % auf Beherbergung), Verlust der erweiterten Kürzung in der GmbH", "Teilungserklärung und Beschlüsse der WEG", "Beherbergungs- bzw. Bettensteuer der Stadt"],
    parameter: [
      { key: "einheiten", label: "Einheiten", typ: "zahl", standard: 1, min: 1, max: 200, schritt: 1, gruppe: "Objekt" },
      { key: "tagesrate", label: "Durchschnittliche Tagesrate", typ: "euro", einheit: "€", standard: 95, min: 20, max: 600, schritt: 5, gruppe: "Ertrag" },
      { key: "auslastung", label: "Auslastung", typ: "prozent", standard: 0.7, min: 0.2, max: 1, schritt: 0.01, gruppe: "Ertrag" },
      { key: "aufenthaltNaechte", label: "Durchschnittliche Aufenthaltsdauer", typ: "zahl", einheit: "Nächte", standard: 4, min: 1, max: 60, schritt: 1, gruppe: "Ertrag" },
      { key: "plattformQuote", label: "Plattform- und Vertriebsgebühren", typ: "prozent", standard: 0.15, min: 0, max: 0.35, schritt: 0.01, gruppe: "Kosten" },
      { key: "reinigungJeAufenthalt", label: "Reinigung und Wäsche je Aufenthalt", typ: "euro", einheit: "€", standard: 55, min: 0, max: 300, schritt: 5, gruppe: "Kosten" },
      { key: "nebenkostenMonat", label: "Strom, Internet, Verbrauch je Einheit und Monat", typ: "euro", einheit: "€", standard: 180, min: 0, max: 800, schritt: 10, gruppe: "Kosten" },
      { key: "betreiberQuote", label: "Betreiber bzw. Verwaltung", typ: "prozent", standard: 0.2, min: 0, max: 0.4, schritt: 0.01, gruppe: "Kosten" },
      { key: "ausstattungJeEinheit", label: "Ausstattung je Einheit", typ: "euro", einheit: "€", standard: 12000, min: 0, max: 50000, schritt: 500, gruppe: "Kosten" },
      { key: "genehmigt", label: "Zweckentfremdungsgenehmigung liegt vor oder nicht nötig", typ: "jaNein", standard: false, gruppe: "Recht" },
      { key: "mieteLangfristMonat", label: "Vergleich: Kaltmiete langfristig je Einheit", typ: "euro", einheit: "€", standard: (o) => o.miete ?? 700, min: 100, max: 10000, schritt: 10, gruppe: "Vergleich" },
    ],
    rechne(w) {
      const n = num(w, "einheiten"); const naechte = 365 * num(w, "auslastung");
      const umsatz = n * naechte * num(w, "tagesrate");
      const aufenthalte = n * naechte / Math.max(1, num(w, "aufenthaltNaechte"));
      const kosten = umsatz * (num(w, "plattformQuote") + num(w, "betreiberQuote")) + aufenthalte * num(w, "reinigungJeAufenthalt") + n * 12 * num(w, "nebenkostenMonat") + n * num(w, "ausstattungJeEinheit") / 7;
      const netto = umsatz - kosten; const lang = n * 12 * num(w, "mieteLangfristMonat");
      const hinweise: Hinweis[] = [];
      if (!bool(w, "genehmigt")) hinweise.push({ art: "crit", text: "Ohne Zweckentfremdungsgenehmigung drohen in vielen Städten Bußgelder; vor Start mit der Stadt klären." });
      hinweise.push({ art: "info", text: "Hotelähnliche Leistungen machen die Vermietung gewerblich. In einer vermögensverwaltenden GmbH entfällt dann die erweiterte Kürzung; mit dem Steuerberater klären." });
      if (netto <= lang) hinweise.push({ art: "warn", text: "Nach Kosten bleibt nicht mehr als bei langfristiger Vermietung." });
      return { hinweise, kennzahlen: [kz("umsatz", "Umsatz pro Jahr", umsatz, "€"), kz("kosten", "Betriebskosten pro Jahr", kosten, "€"), kz("netto", "Ertrag nach Kosten", netto, "€"), kz("langfrist", "Vergleich langfristige Miete", lang, "€"), kz("mehr", "Mehrertrag", netto - lang, "€"), kz("breakEvenAuslastung", "Auslastung für Gleichstand mit Langfristmiete", breakEvenAuslastung(w, lang), "%")] };
    },
  },
  {
    id: "entwicklung", name: "Grundstück & Neubau", kurz: "Grundstück kaufen, Baurecht nutzen, bauen und verkaufen oder halten; mit Residualwert.",
    experten: ["projektentwickler", "bank", "recht", "steuer"],
    huerden: ["Bebauungsplan oder Einfügen nach § 34 BauGB; Abweichungen über Bau-Turbo nur mit Zustimmung der Gemeinde", "Erschließung, Baugrund, Altlasten, Kampfmittel", "Baugenehmigung, Stellplätze, Abstandsflächen", "Gewerblicher Grundstückshandel beim Verkauf binnen kurzer Frist (mit Steuerberater klären)"],
    parameter: [
      { key: "grundstueckQm", label: "Grundstücksfläche", typ: "zahl", einheit: "m²", standard: 800, min: 50, max: 100000, schritt: 10, gruppe: "Grundstück" },
      { key: "kaufpreisGrundstueck", label: "Kaufpreis Grundstück", typ: "euro", einheit: "€", standard: (o) => o.kaufpreis ?? 800 * (o.bodenrichtwert ?? 600), min: 0, max: 50000000, schritt: 5000, gruppe: "Grundstück" },
      { key: "gfz", label: "Geschossflächenzahl (GFZ)", typ: "zahl", standard: 1.2, min: 0.2, max: 5, schritt: 0.05, gruppe: "Baurecht" },
      { key: "effizienz", label: "Wohnfläche / BGF", typ: "prozent", standard: 0.78, min: 0.6, max: 0.9, schritt: 0.01, gruppe: "Baurecht" },
      { key: "baukostenQm", label: "Baukosten je m² BGF (KG 300 + 400)", typ: "euro", einheit: "€/m²", standard: 2800, min: 1200, max: 6000, schritt: 50, gruppe: "Kosten" },
      { key: "baunebenkostenQuote", label: "Baunebenkosten", typ: "prozent", standard: 0.2, min: 0.1, max: 0.35, schritt: 0.01, gruppe: "Kosten" },
      { key: "erschliessung", label: "Erschließung, Außenanlagen", typ: "euro", einheit: "€", standard: 60000, min: 0, max: 5000000, schritt: 5000, gruppe: "Kosten" },
      { key: "abrissAltlasten", label: "Abriss, Altlasten, Baugrund", typ: "euro", einheit: "€", standard: 0, min: 0, max: 5000000, schritt: 5000, gruppe: "Kosten" },
      { key: "puffer", label: "Puffer", typ: "prozent", standard: 0.08, min: 0, max: 0.3, schritt: 0.01, gruppe: "Kosten" },
      ...zeitParams(12, 18, 6), ...ausstiegParams(), ...finanzParams(0.25, 0.06),
      { key: "zielMarge", label: "Zielmarge für den Residualwert", typ: "prozent", standard: 0.15, min: 0, max: 0.4, schritt: 0.01, gruppe: "Risiko" },
      { key: "genehmigung", label: "Wahrscheinlichkeit des Baurechts", typ: "prozent", standard: 0.8, min: 0.1, max: 1, schritt: 0.05, gruppe: "Risiko" },
    ],
    rechne(w, _o, p) {
      const rechneMit = (gp: number) => {
        const bgf = num(w, "grundstueckQm") * num(w, "gfz"); const wfl = bgf * num(w, "effizienz");
        const bau = bgf * num(w, "baukostenQm"); const nebenk = bau * num(w, "baunebenkostenQuote");
        const puffer = (bau + nebenk + num(w, "erschliessung") + num(w, "abrissAltlasten")) * num(w, "puffer");
        const pl = num(w, "planungMonate"), bm = num(w, "bauMonate"), vm = num(w, "vermarktungMonate");
        const { erloes, noi } = ausstiegErloes(w, wfl);
        const r = projektrechnung({ ankauf: gp * (1 + nebenkostenSatz(p)), ekQuote: num(w, "ekQuote"), zins: num(w, "zins"), exitMonat: pl + bm + vm, erloes,
          kosten: [{ name: "Planung", betrag: nebenk * 0.4 + num(w, "abrissAltlasten"), startMonat: 0, dauerMonate: Math.max(1, pl) }, { name: "Erschließung", betrag: num(w, "erschliessung"), startMonat: pl, dauerMonate: Math.max(1, Math.min(6, bm)) }, { name: "Bau", betrag: bau + nebenk * 0.6 + puffer, startMonat: pl, dauerMonate: Math.max(1, bm) }] });
        return { r, bgf, wfl, noi, nebenk };
      };
      const gp = num(w, "kaufpreisGrundstueck"); const { r, bgf, wfl, noi, nebenk } = rechneMit(gp);
      const ziel = num(w, "zielMarge");
      let residual: number | null = null;
      if (rechneMit(0).r.margeAufKosten >= ziel) {
        let lo = 0, hi = Math.max(gp * 3, 1e6);
        while (rechneMit(hi).r.margeAufKosten >= ziel && hi < 1e10) hi *= 2;
        for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (rechneMit(m).r.margeAufKosten >= ziel) lo = m; else hi = m; }
        residual = lo;
      }
      const pw = num(w, "genehmigung"); const verlust = nebenk * 0.4 + gp * nebenkostenSatz(p) + gp * num(w, "zins") * num(w, "planungMonate") / 12;
      const hinweise: Hinweis[] = [];
      if (residual == null) hinweise.push({ art: "crit", text: `Selbst ohne Grundstückskosten wird die Zielmarge von ${de(ziel * 100, 0)} % nicht erreicht: Verkaufspreis, Baukosten oder Dichte passen nicht zusammen.` });
      else hinweise.push(gp > residual ? { art: "crit", text: `Für ${de(ziel * 100, 0)} % Marge dürfte das Grundstück höchstens ${Math.round(residual).toLocaleString("de-DE")} € kosten.` } : { art: "good", text: `Der Grundstückspreis liegt unter dem Residualwert von ${Math.round(residual).toLocaleString("de-DE")} €.` });
      return { projekt: r, hinweise, details: { bgf, wohnflaeche: wfl, noi, residualwert: residual },
        kennzahlen: [...projektKennzahlen(r), kz("bgf", "Bruttogeschossfläche", bgf, "m²"), kz("wfl", "Wohnfläche", wfl, "m²"), kz("residual", "Residualwert Grundstück bei Zielmarge", residual, "€"), kz("residualQm", "Residualwert je m² Grundstück", residual == null ? null : residual / num(w, "grundstueckQm"), "€/m²"), kz("erwartet", "Erwarteter Gewinn mit Baurechtsrisiko", risikoAngepasst(r, pw, verlust), "€")] };
    },
  },
  {
    id: "aufteilung", name: "Aufteilung in Eigentumswohnungen", kurz: "Mehrfamilienhaus aufteilen und Wohnungen einzeln verkaufen.",
    experten: ["recht", "steuer", "makler"],
    huerden: ["Genehmigungsvorbehalt in Gebieten mit angespanntem Wohnungsmarkt (§ 250 BauGB, Ermächtigung bis Ende 2030)", "Milieuschutzsatzungen (§ 172 BauGB)", "Vorkaufsrecht der Mieter bei Erstverkauf", "Abgeschlossenheitsbescheinigung und Teilungserklärung", "Gewerblicher Grundstückshandel (Drei-Objekt-Grenze) mit Steuerberater klären"],
    parameter: [
      { key: "einheiten", label: "Wohnungen", typ: "zahl", standard: 6, min: 2, max: 300, schritt: 1, gruppe: "Objekt" },
      { key: "wohnflaeche", label: "Wohnfläche gesamt", typ: "zahl", einheit: "m²", standard: (o) => o.wohnflaeche ?? 450, min: 50, max: 50000, schritt: 5, gruppe: "Objekt" },
      { key: "einzelpreisQm", label: "Verkaufspreis je m² (frei)", typ: "euro", einheit: "€/m²", standard: (o) => o.vergleichspreisQm ?? 4200, min: 500, max: 20000, schritt: 50, gruppe: "Erlös" },
      { key: "anteilVermietet", label: "Anteil vermietet verkauft", typ: "prozent", standard: 0.8, min: 0, max: 1, schritt: 0.05, gruppe: "Erlös" },
      { key: "abschlagVermietet", label: "Abschlag für vermietete Wohnungen", typ: "prozent", standard: 0.15, min: 0, max: 0.4, schritt: 0.01, gruppe: "Erlös" },
      { key: "vertriebQuote", label: "Vertriebskosten", typ: "prozent", standard: 0.05, min: 0, max: 0.12, schritt: 0.005, gruppe: "Erlös" },
      { key: "teilungskosten", label: "Teilung, Gutachten, Notar", typ: "euro", einheit: "€", standard: 15000, min: 0, max: 500000, schritt: 1000, gruppe: "Kosten" },
      { key: "instandsetzung", label: "Instandsetzung vor Verkauf", typ: "euro", einheit: "€", standard: 60000, min: 0, max: 5000000, schritt: 5000, gruppe: "Kosten" },
      { key: "verkaufsMonate", label: "Verkaufsdauer", typ: "zahl", einheit: "Monate", standard: 24, min: 3, max: 120, schritt: 1, gruppe: "Zeit" },
      { key: "genehmigungNoetig", label: "Umwandlung genehmigungspflichtig", typ: "jaNein", standard: false, gruppe: "Recht" },
      { key: "verkaeufeFuenfJahre", label: "Weitere Objektverkäufe binnen 5 Jahren", typ: "zahl", standard: 0, min: 0, max: 50, schritt: 1, gruppe: "Recht" },
      ...finanzParams(0.3, 0.05),
    ],
    rechne(w, o, p) {
      const wf = num(w, "wohnflaeche"), pq = num(w, "einzelpreisQm");
      const brutto = wf * pq * (1 - num(w, "anteilVermietet") * num(w, "abschlagVermietet"));
      const erloes = brutto * (1 - num(w, "vertriebQuote"));
      const vm = num(w, "verkaufsMonate"); const kp = o.kaufpreis ?? 0;
      const mieteJahr = (o.miete ?? 0) * 12 * (1 - p.mietausfall);
      const r = projektrechnung({ ankauf: kp * (1 + nebenkostenSatz(p)), ekQuote: num(w, "ekQuote"), zins: num(w, "zins"), exitMonat: vm, erloes,
        kosten: [{ name: "Teilung", betrag: num(w, "teilungskosten"), startMonat: 0, dauerMonate: 3 }, { name: "Instandsetzung", betrag: num(w, "instandsetzung"), startMonat: 1, dauerMonate: 6 }],
        ertragMonat: m => m > 0 && m <= vm ? mieteJahr / 12 * (1 - m / vm) : 0 });
      const hinweise: Hinweis[] = [];
      if (bool(w, "genehmigungNoetig")) hinweise.push({ art: "crit", text: "Umwandlung ist genehmigungspflichtig. Ohne Genehmigung keine Aufteilung; Ausnahmen (z. B. Verkauf an Mieter) prüfen lassen." });
      if (num(w, "verkaeufeFuenfJahre") + 1 > 3 || num(w, "einheiten") > 3) hinweise.push({ art: "warn", text: "Verkauf von mehr als drei Objekten binnen fünf Jahren kann gewerblichen Grundstückshandel auslösen. Das gilt auch für einzelne Wohnungen; vorab mit dem Steuerberater klären." });
      return { projekt: r, hinweise, details: { bruttoerloes: brutto, erloesJeQm: erloes / wf },
        kennzahlen: [...projektKennzahlen(r), kz("aufteilungsgewinnQm", "Gewinn je m²", r.gewinn / wf, "€/m²"), kz("paketQm", "Ankauf je m²", kp / wf, "€/m²"), kz("verkaufQm", "Netto-Verkauf je m²", erloes / wf, "€/m²")] };
    },
  },
  {
    id: "aufstockung", name: "Aufstockung, Dachausbau, Nachverdichtung", kurz: "Zusätzliche Wohnfläche auf dem vorhandenen Grundstück schaffen.",
    experten: ["projektentwickler", "verwalter", "recht"],
    huerden: ["Statik und Tragwerk", "Befreiungen über Bau-Turbo (§ 31 Abs. 3, § 34 Abs. 3b BauGB) mit Zustimmung der Gemeinde", "Abstandsflächen, Brandschutz, Aufzug", "Bei WEG: Beschluss bzw. Zustimmung der Eigentümer und Regelung der Sondernutzung"],
    parameter: [
      { key: "neueFlaeche", label: "Neue Wohnfläche", typ: "zahl", einheit: "m²", standard: 120, min: 10, max: 10000, schritt: 5, gruppe: "Objekt" },
      { key: "baukostenQm", label: "Baukosten je m² Wohnfläche", typ: "euro", einheit: "€/m²", standard: 3600, min: 1500, max: 8000, schritt: 50, gruppe: "Kosten" },
      { key: "statik", label: "Statik, Gutachten, Vermessung", typ: "euro", einheit: "€", standard: 20000, min: 0, max: 500000, schritt: 1000, gruppe: "Kosten" },
      { key: "baunebenkostenQuote", label: "Baunebenkosten", typ: "prozent", standard: 0.2, min: 0.05, max: 0.35, schritt: 0.01, gruppe: "Kosten" },
      { key: "luftrecht", label: "Kaufpreis Luftrecht bzw. Sondernutzung (WEG)", typ: "euro", einheit: "€", standard: 0, min: 0, max: 5000000, schritt: 5000, gruppe: "Kosten" },
      ...zeitParams(8, 10, 3), ...ausstiegParams(), ...finanzParams(0.3, 0.055),
      { key: "genehmigung", label: "Wahrscheinlichkeit der Genehmigung", typ: "prozent", standard: 0.75, min: 0.1, max: 1, schritt: 0.05, gruppe: "Risiko" },
    ],
    rechne(w) {
      const fl = num(w, "neueFlaeche"); const bau = fl * num(w, "baukostenQm"); const nebenk = bau * num(w, "baunebenkostenQuote");
      const pl = num(w, "planungMonate"), bm = num(w, "bauMonate"), vm = num(w, "vermarktungMonate");
      const { erloes, noi } = ausstiegErloes(w, fl);
      const r = projektrechnung({ ankauf: num(w, "luftrecht"), ekQuote: num(w, "ekQuote"), zins: num(w, "zins"), exitMonat: pl + bm + vm, erloes,
        kosten: [{ name: "Planung", betrag: nebenk * 0.4 + num(w, "statik"), startMonat: 0, dauerMonate: Math.max(1, pl) }, { name: "Bau", betrag: bau + nebenk * 0.6, startMonat: pl, dauerMonate: Math.max(1, bm) }] });
      const pw = num(w, "genehmigung"); const verlust = nebenk * 0.4 + num(w, "statik") + num(w, "luftrecht");
      return { projekt: r, hinweise: [], details: { noi },
        kennzahlen: [...projektKennzahlen(r), kz("kostenQm", "Gesamtkosten je m²", r.gesamtkostenInklZinsen / fl, "€/m²"), kz("erwartet", "Erwarteter Gewinn mit Genehmigungsrisiko", risikoAngepasst(r, pw, verlust), "€"), ...(noi != null ? [kz("yoc", "Rendite auf Kosten (Yield on Cost)", noi / r.gesamtkostenInklZinsen, "%")] : [])] };
    },
  },
  {
    id: "sanierung", name: "Energetische Sanierung & Modernisierung", kurz: "Modernisieren, Miete nach § 559 BGB anpassen, Wert und Energieklasse verbessern.",
    experten: ["verwalter", "bank", "steuer"],
    huerden: ["Modernisierungsumlage 8 % der umlagefähigen Kosten p. a., Kappung 3 €/m² in sechs Jahren (2 €/m² bei Miete unter 7 €/m²)", "Ankündigungsfristen und Härteeinwände der Mieter", "Förderbedingungen (Antrag vor Beauftragung)", "Bei WEG: Beschluss der Gemeinschaft"],
    parameter: [
      { key: "kosten", label: "Kosten der Maßnahmen", typ: "euro", einheit: "€", standard: 60000, min: 0, max: 10000000, schritt: 1000, gruppe: "Kosten" },
      { key: "anteilModernisierung", label: "Davon Modernisierung (umlagefähig)", typ: "prozent", standard: 0.7, min: 0, max: 1, schritt: 0.05, gruppe: "Kosten", hilfe: "Rest ist Erhaltung" },
      { key: "foerderQuote", label: "Zuschüsse", typ: "prozent", standard: 0.15, min: 0, max: 0.7, schritt: 0.01, gruppe: "Kosten" },
      { key: "wohnflaeche", label: "Wohnfläche", typ: "zahl", einheit: "m²", standard: (o) => o.wohnflaeche ?? 60, min: 10, max: 50000, schritt: 1, gruppe: "Objekt" },
      { key: "mieteQm", label: "Aktuelle Kaltmiete", typ: "euro", einheit: "€/m²", standard: (o) => (o.miete && o.wohnflaeche ? Math.round(o.miete / o.wohnflaeche * 100) / 100 : 10), min: 2, max: 40, schritt: 0.1, gruppe: "Objekt" },
      { key: "wertsteigerung", label: "Wertsteigerung durch die Maßnahme", typ: "prozent", standard: 0.06, min: 0, max: 0.3, schritt: 0.01, gruppe: "Wirkung" },
    ],
    rechne(w, o) {
      const k = num(w, "kosten"), netto = k * (1 - num(w, "foerderQuote"));
      const umlagefaehig = k * num(w, "anteilModernisierung") * (1 - num(w, "foerderQuote"));
      const fl = num(w, "wohnflaeche"); const kappeQm = num(w, "mieteQm") < 7 ? 2 : 3;
      const umlageJahr = Math.min(umlagefaehig * 0.08, kappeQm * fl * 12);
      const wert = (o.kaufpreis ?? 0) * num(w, "wertsteigerung");
      const hinweise: Hinweis[] = [];
      if (umlagefaehig * 0.08 > kappeQm * fl * 12) hinweise.push({ art: "warn", text: `Kappungsgrenze greift: höchstens ${kappeQm} €/m² Mieterhöhung in sechs Jahren.` });
      return { hinweise, kennzahlen: [kz("netto", "Kosten nach Zuschüssen", netto, "€"), kz("umlageJahr", "Mieterhöhung pro Jahr", umlageJahr, "€"), kz("umlageQm", "Mieterhöhung je m² und Monat", umlageJahr / fl / 12, "€/m²"), kz("renditeUmlage", "Rendite über die Umlage", netto > 0 ? umlageJahr / netto : null, "%"), kz("wertzuwachs", "Wertzuwachs", wert, "€"), kz("wertMinusKosten", "Wertzuwachs minus Kosten", wert - netto, "€")] };
    },
  },
  {
    id: "flaechenertraege", name: "Zusatzerträge: Werbung, Mobilfunk, PV, Laden, Stellplätze", kurz: "Fassade, Dach und Freiflächen vermarkten.",
    experten: ["recht", "steuer"],
    huerden: ["Werbeanlagen brauchen eine Baugenehmigung nach Landesbauordnung; Ortsgestaltungssatzungen beachten", "Gestattungsverträge: Laufzeit, Rückbau, Haftung, Zugang", "Bei WEG: Beschluss über Gemeinschaftseigentum", "In der vermögensverwaltenden GmbH: PV und Ladepunkte bis 10 %, übrige Nebentätigkeiten mit Mietern bis 5 % der Mieteinnahmen ohne Verlust der erweiterten Kürzung; Werbeflächen und Mobilfunk mit dem Steuerberater klären"],
    parameter: [
      { key: "werbungJahr", label: "Werbefläche: Pacht pro Jahr", typ: "euro", einheit: "€", standard: 0, min: 0, max: 200000, schritt: 100, gruppe: "Werbung" },
      { key: "werbungInvest", label: "Werbefläche: Investition", typ: "euro", einheit: "€", standard: 0, min: 0, max: 500000, schritt: 500, gruppe: "Werbung" },
      { key: "mobilfunkJahr", label: "Mobilfunk: Pacht pro Jahr", typ: "euro", einheit: "€", standard: 0, min: 0, max: 100000, schritt: 100, gruppe: "Mobilfunk" },
      { key: "pvInvest", label: "PV: Investition", typ: "euro", einheit: "€", standard: 0, min: 0, max: 2000000, schritt: 500, gruppe: "PV" },
      { key: "pvJahr", label: "PV: Ertrag pro Jahr", typ: "euro", einheit: "€", standard: 0, min: 0, max: 500000, schritt: 100, gruppe: "PV" },
      { key: "ladeInvest", label: "Ladepunkte: Investition", typ: "euro", einheit: "€", standard: 0, min: 0, max: 500000, schritt: 500, gruppe: "Laden" },
      { key: "ladeJahr", label: "Ladepunkte: Ertrag pro Jahr", typ: "euro", einheit: "€", standard: 0, min: 0, max: 200000, schritt: 100, gruppe: "Laden" },
      { key: "stellplaetze", label: "Vermietbare Stellplätze", typ: "zahl", standard: 0, min: 0, max: 1000, schritt: 1, gruppe: "Stellplätze" },
      { key: "stellplatzMiete", label: "Miete je Stellplatz und Monat", typ: "euro", einheit: "€", standard: 60, min: 0, max: 500, schritt: 5, gruppe: "Stellplätze" },
      { key: "laufzeit", label: "Betrachtungszeitraum", typ: "zahl", einheit: "Jahre", standard: 10, min: 1, max: 30, schritt: 1, gruppe: "Rechnung" },
    ],
    rechne(w, o, p) {
      const st = num(w, "stellplaetze") * num(w, "stellplatzMiete") * 12;
      const jahr = num(w, "werbungJahr") + num(w, "mobilfunkJahr") + num(w, "pvJahr") + num(w, "ladeJahr") + st;
      const invest = num(w, "werbungInvest") + num(w, "pvInvest") + num(w, "ladeInvest");
      const mieteJahr = (o.miete ?? (o.marktmieteQm && o.wohnflaeche ? o.marktmieteQm * o.wohnflaeche : 0)) * 12;
      const energie = num(w, "pvJahr") + num(w, "ladeJahr"), uebrige = num(w, "werbungJahr") + num(w, "mobilfunkJahr");
      const hinweise: Hinweis[] = [];
      if (p.struktur === "gmbh" || p.struktur === "offen") {
        if (mieteJahr > 0 && energie / mieteJahr > 0.1) hinweise.push({ art: "crit", text: `PV und Ladepunkte machen ${de(energie / mieteJahr * 100, 0)} % der Mieteinnahmen aus; über 10 % gefährdet die erweiterte Kürzung in der GmbH.` });
        if (uebrige > 0) hinweise.push({ art: "warn", text: `Werbung und Mobilfunk: ${de(mieteJahr > 0 ? uebrige / mieteJahr * 100 : 0, 1)} % der Mieteinnahmen. Ob das die erweiterte Kürzung berührt, mit dem Steuerberater klären.` });
      }
      return { hinweise, kennzahlen: [kz("jahr", "Zusatzertrag pro Jahr", jahr, "€"), kz("invest", "Investition", invest, "€"), kz("summe", `Ertrag über ${num(w, "laufzeit")} Jahre nach Investition`, jahr * num(w, "laufzeit") - invest, "€"), kz("amortisation", "Amortisation", jahr > 0 && invest > 0 ? invest / jahr : null, "Jahre"), kz("anteil", "Anteil an den Mieteinnahmen", mieteJahr > 0 ? jahr / mieteJahr : null, "%")] };
    },
  },
];

function breakEvenAuslastung(w: W, lang: number): number | null {
  const n = num(w, "einheiten");
  const f = (a: number) => { const naechte = 365 * a; const u = n * naechte * num(w, "tagesrate"); const auf = n * naechte / Math.max(1, num(w, "aufenthaltNaechte")); return u - (u * (num(w, "plattformQuote") + num(w, "betreiberQuote")) + auf * num(w, "reinigungJeAufenthalt") + n * 12 * num(w, "nebenkostenMonat") + n * num(w, "ausstattungJeEinheit") / 7) - lang; };
  if (f(1) < 0) return null;
  let lo = 0, hi = 1; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (f(m) >= 0) hi = m; else lo = m; }
  return hi;
}

export const modulById = (id: string) => MODULE.find(m => m.id === id);
/** Standardwerte eines Moduls für ein Objekt. */
export function standardwerte(m: Modul, o: Objekt, p: Params): Record<string, number | string | boolean> {
  return Object.fromEntries(m.parameter.map(d => [d.key, typeof d.standard === "function" ? d.standard(o, p) : d.standard]));
}
export function rechneModul(id: string, werte: Record<string, number | string | boolean> | undefined, o: Objekt, p: Params): Modulergebnis {
  const m = modulById(id); if (!m) throw new Error(`Unbekanntes Modul: ${id}`);
  return m.rechne({ ...standardwerte(m, o, p), ...(werte ?? {}) }, o, p);
}
