import type { Objekt, Stellplatz } from "@highstack/engine";

/**
 * Fragenkatalog des Concierge: fehlende Angaben, wichtigste zuerst.
 * Eine Frage ist offen, wenn das Feld leer ist und noch nicht beantwortet oder übersprungen wurde.
 * „Weiß ich nicht“ setzt, wo es sinnvoll ist, eine vorsichtige Annahme ein und sagt welche.
 */
export type Wahl = [string, string, string?];
export interface Frage {
  id: string;
  thema: string;
  frage: string;
  warum: string;
  wo: string;
  typ: "zahl" | "wahl";
  einheit?: string;
  optionen?: Wahl[];
  /** Vorschlag im Eingabefeld */
  vorschlag?: number | null;
  antwort: (v: number | string) => Partial<Objekt>;
  /** Annahme bei „Weiß ich nicht“: Felder plus kurzer Text, oder null = nur merken */
  unbekannt?: () => { patch: Partial<Objekt>; text: string } | null;
  /** Wert lässt sich ermitteln (Vergleichswerte) */
  ermitteln?: boolean;
}

const neuerStellplatz = (preis: Stellplatz["preis"]): Stellplatz => ({ id: `sp-${Math.random().toString(36).slice(2, 8)}`, art: "tiefgarage", preis, kaufpreis: null, recht: "unbekannt", nutzung: "mieter", miete: null, hausgeld: null, erwerben: true });
const mitSp = (o: Objekt, p: Partial<Stellplatz>): Partial<Objekt> => { const l = [...(o.stellplaetze ?? [])]; l[0] = { ...l[0]!, ...p }; return { stellplaetze: l }; };
const g = (o: Objekt, id: string, w: "ja" | "nein" | "unbekannt" = "ja"): Partial<Objekt> => ({ gefragt: { ...(o.gefragt ?? {}), [id]: w } });

export const SP_ART: Wahl[] = [["tiefgarage", "Tiefgarage"], ["aussen", "Außenstellplatz"], ["garage", "Garage"], ["carport", "Carport"], ["duplex", "Duplex"]];
export const SP_RECHT: Wahl[] = [["teileigentum", "Eigenes Grundbuch", "Teileigentum: einzeln verkauf- und vermietbar"], ["sondernutzung", "Sondernutzungsrecht", "Gehört zur Wohnung, nur in der Gemeinschaft übertragbar"], ["unbekannt", "Weiß ich nicht", "Steht im Exposé, in der Teilungserklärung oder im Grundbuch"]];
export const SP_NUTZUNG: Wahl[] = [["mieter", "Mieter der Wohnung", "Miete ist in der Wohnungsmiete enthalten"], ["fremd", "Extra vermietet", "Eigene Stellplatzmiete"], ["selbst", "Nutze ich selbst", ""], ["leer", "Steht leer", ""]];

export function fragen(o: Objekt): Frage[] {
  const f: Frage[] = []; const q = o.gefragt ?? {}; const offen = (id: string) => !q[id];
  const etw = o.asset === "ETW";
  if (o.kaufpreis == null && offen("kaufpreis")) f.push({ id: "kaufpreis", thema: "Preis", frage: "Was soll das Objekt kosten?", warum: "Ohne Kaufpreis lassen sich weder Rendite noch Finanzierung rechnen.", wo: "Steht ganz oben im Exposé oder Inserat.", typ: "zahl", einheit: "€", antwort: v => ({ kaufpreis: Number(v) }) });
  if (o.wohnflaeche == null && offen("wohnflaeche")) f.push({ id: "wohnflaeche", thema: "Fläche", frage: o.asset === "Gewerbe" ? "Wie groß ist die Nutzfläche?" : "Wie groß ist die Wohnfläche?", warum: "Daraus werden Preis pro m², Marktmiete und Kosten abgeleitet.", wo: "Exposé, Grundriss oder Wohnflächenberechnung.", typ: "zahl", einheit: "m²", antwort: v => ({ wohnflaeche: Number(v) }) });
  if (offen("vermietung") && o.miete == null && !o.leer) f.push({ id: "vermietung", thema: "Vermietung", frage: "Ist das Objekt vermietet?", warum: "Vermietet zählt die Ist-Miete, bezugsfrei rechnen wir mit der Marktmiete.", wo: "Exposé: „vermietet“, „bezugsfrei“ oder „frei ab“.", typ: "wahl", optionen: [["v", "Ja, vermietet"], ["l", "Nein, bezugsfrei"]], antwort: v => ({ leer: v === "l", ...g(o, "vermietung") }) });
  if (!o.leer && o.miete == null && q.vermietung && offen("miete")) f.push({ id: "miete", thema: "Miete", frage: "Wie hoch ist die Kaltmiete im Monat?", warum: "Die Miete ist der größte Hebel für Rendite und Cashflow.", wo: "Mietvertrag, Mieterliste oder Exposé („Ist-Miete“, „Nettokaltmiete“).", typ: "zahl", einheit: "€/Monat", antwort: v => ({ miete: Number(v) }), unbekannt: () => null });
  if ((o.leer || (q.miete === "unbekannt")) && o.marktmieteQm == null && offen("marktmiete")) f.push({ id: "marktmiete", thema: "Marktmiete", frage: "Welche Miete pro m² ist dort üblich?", warum: "Ohne Ist-Miete rechnen wir mit der ortsüblichen Miete.", wo: "Mietspiegel der Stadt oder vergleichbare Inserate.", typ: "zahl", einheit: "€/m²", ermitteln: true, antwort: v => ({ marktmieteQm: Number(v) }) });
  if (o.hausgeldNichtUmlagefaehig == null && offen("hausgeld")) f.push({ id: "hausgeld", thema: "Kosten", frage: etw ? "Wie hoch ist das Hausgeld im Monat?" : "Welche Kosten tragen Sie selbst im Monat?", warum: etw ? "Etwa 40 % des Hausgelds (Verwaltung, Rücklage, Instandhaltung) bleiben bei Ihnen und schmälern den Cashflow." : "Verwaltung, Instandhaltung und nicht umlegbare Kosten schmälern den Cashflow.", wo: etw ? "Exposé, Wirtschaftsplan oder Hausgeldabrechnung." : "Nebenkostenabrechnung oder Angaben des Verkäufers.", typ: "zahl", einheit: "€/Monat",
    antwort: v => ({ hausgeldNichtUmlagefaehig: etw ? Math.round(Number(v) * 0.4) : Number(v), ...g(o, "hausgeld") }),
    unbekannt: () => o.wohnflaeche ? { patch: { hausgeldNichtUmlagefaehig: Math.round(o.wohnflaeche * 1.3) }, text: `Annahme: ${Math.round(o.wohnflaeche * 1.3)} € nicht umlagefähig (1,30 € pro m²)` } : null });
  // Stellplatz: Kette von kurzen Fragen
  const sp = o.stellplaetze?.[0];
  if (!sp && offen("stellplatz") && o.asset !== "Gewerbe") f.push({ id: "stellplatz", thema: "Stellplatz", frage: "Gehört ein Stellplatz dazu?", warum: "Stellplätze werden oft separat verkauft, haben manchmal ein eigenes Grundbuch und bringen eigene Miete. Das verändert Preis, Rendite und spätere Optionen.", wo: "Exposé unter „Stellplatz“, „TG“ oder „zzgl.“.", typ: "wahl",
    optionen: [["inklusive", "Ja, im Preis", "Kein eigener Preis"], ["separat", "Ja, separat", "Mit eigenem Preis, „zzgl.“"], ["nein", "Nein"]],
    antwort: v => v === "nein" ? g(o, "stellplatz", "nein") : { stellplaetze: [neuerStellplatz(v as Stellplatz["preis"])], ...g(o, "stellplatz") }, unbekannt: () => null });
  if (sp) {
    if (offen("sp-art")) f.push({ id: "sp-art", thema: "Stellplatz", frage: "Welche Art Stellplatz?", warum: "Tiefgarage und Garage erzielen höhere Mieten und Preise als ein Außenplatz.", wo: "Exposé oder Teilungserklärung.", typ: "wahl", optionen: SP_ART, antwort: v => ({ ...mitSp(o, { art: v as Stellplatz["art"] }), ...g(o, "sp-art") }) });
    if (sp.preis === "separat" && sp.kaufpreis == null && offen("sp-preis")) f.push({ id: "sp-preis", thema: "Stellplatz", frage: "Was kostet der Stellplatz extra?", warum: "Wir rechnen ihn in Gesamtpreis und Rendite ein und zeigen, was er für sich bringt.", wo: "Exposé: „zzgl. Stellplatz“.", typ: "zahl", einheit: "€", antwort: v => mitSp(o, { kaufpreis: Number(v) }) });
    if (sp.recht === "unbekannt" && offen("sp-recht")) f.push({ id: "sp-recht", thema: "Stellplatz", frage: "Hat der Stellplatz ein eigenes Grundbuch?", warum: "Als Teileigentum können Sie ihn später einzeln verkaufen oder an Dritte vermieten. Ein Sondernutzungsrecht bleibt an die Gemeinschaft gebunden.", wo: "Grundbuchauszug oder Teilungserklärung; im Zweifel den Makler fragen.", typ: "wahl", optionen: SP_RECHT.slice(0, 2), antwort: v => ({ ...mitSp(o, { recht: v as Stellplatz["recht"] }), ...g(o, "sp-recht") }), unbekannt: () => null });
    if (offen("sp-nutzung")) f.push({ id: "sp-nutzung", thema: "Stellplatz", frage: "Wer nutzt den Stellplatz?", warum: "Ist er extra vermietet, kommt seine Miete zur Wohnungsmiete hinzu.", wo: "Mieterliste oder Mietvertrag.", typ: "wahl", optionen: SP_NUTZUNG, antwort: v => ({ ...mitSp(o, { nutzung: v as Stellplatz["nutzung"] }), ...g(o, "sp-nutzung") }) });
    if (sp.nutzung === "fremd" && sp.miete == null && offen("sp-miete")) f.push({ id: "sp-miete", thema: "Stellplatz", frage: "Wie viel Miete bringt der Stellplatz?", warum: "Stellplatzmieten liegen je nach Lage meist zwischen 30 und 150 € im Monat.", wo: "Mietvertrag oder Mieterliste.", typ: "zahl", einheit: "€/Monat", antwort: v => mitSp(o, { miete: Number(v) }),
      unbekannt: () => ({ patch: mitSp(o, { miete: sp.art === "aussen" ? 35 : 70 }), text: `Annahme: ${sp.art === "aussen" ? 35 : 70} € Miete im Monat` }) });
  }
  if (o.baujahr == null && offen("baujahr")) f.push({ id: "baujahr", thema: "Substanz", frage: "Aus welchem Baujahr stammt das Gebäude?", warum: "Baujahr und Zustand bestimmen Instandhaltung, Abschreibung und Sanierungsrisiko.", wo: "Exposé oder Energieausweis.", typ: "zahl", antwort: v => ({ baujahr: Number(v) }), unbekannt: () => null });
  if (o.energieklasse == null && offen("energie")) f.push({ id: "energie", thema: "Substanz", frage: "Welche Energieklasse hat das Gebäude?", warum: "Schlechte Klassen (F bis H) bedeuten oft Sanierungspflichten und weniger Nachfrage.", wo: "Energieausweis, Pflichtangabe im Inserat.", typ: "wahl", optionen: ["A+", "A", "B", "C", "D", "E", "F", "G", "H"].map(x => [x, x] as Wahl), antwort: v => ({ energieklasse: String(v), ...g(o, "energie") }), unbekannt: () => null });
  if (etw && o.ruecklageAnteil == null && offen("ruecklage")) f.push({ id: "ruecklage", thema: "WEG", frage: "Wie hoch ist die Rücklage, Ihr Anteil?", warum: "Eine dünne Rücklage macht Sonderumlagen wahrscheinlicher.", wo: "Wirtschaftsplan oder Jahresabrechnung der WEG.", typ: "zahl", einheit: "€", antwort: v => ({ ruecklageAnteil: Number(v) }), unbekannt: () => null });
  if (etw && !o.sonderumlage && offen("sonderumlage")) f.push({ id: "sonderumlage", thema: "WEG", frage: "Ist eine Sonderumlage beschlossen oder im Gespräch?", warum: "Sonderumlagen kommen zum Kaufpreis hinzu und sollten verhandelt werden.", wo: "Protokolle der letzten drei Eigentümerversammlungen.", typ: "wahl", optionen: [["ja", "Ja"], ["nein", "Nein"]], antwort: v => ({ sonderumlage: v === "ja", ...g(o, "sonderumlage") }), unbekannt: () => null });
  if (!o.erbbaurecht && offen("erbbau")) f.push({ id: "erbbau", thema: "Recht", frage: "Steht das Objekt auf Erbbaurecht?", warum: "Erbbaurecht heißt laufender Erbbauzins und schwierigere Finanzierung.", wo: "Exposé oder Grundbuch, Abteilung II.", typ: "wahl", optionen: [["nein", "Nein, Volleigentum"], ["ja", "Ja, Erbbaurecht"]], antwort: v => ({ erbbaurecht: v === "ja", ...g(o, "erbbau") }), unbekannt: () => null });
  return f;
}

/** Anteil geklärter Fragen für die Fortschrittsanzeige */
export function conciergeStand(o: Objekt) {
  const offen = fragen(o).length; const beantwortet = Object.keys(o.gefragt ?? {}).length + ["kaufpreis", "wohnflaeche", "miete", "baujahr"].filter(k => o[k as keyof Objekt] != null).length;
  return { offen, beantwortet, gesamt: offen + beantwortet };
}
