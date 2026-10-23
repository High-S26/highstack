/** JSON-Schemas für die Abgabe der Ergebnisse. Die Agenten geben über das Werkzeug `abgabe` ab. */
const str = { type: "string" } as const;
const strArr = { type: "array", items: str } as const;

export const BERICHT_SCHEMA = {
  type: "object",
  properties: {
    kernaussage: { ...str, description: "Die Kernaussage in einem Satz" },
    bewertung: { type: "string", enum: ["positiv", "neutral", "kritisch"] },
    kennzahlen: { type: "array", items: { type: "object", properties: { label: str, wert: str, hinweis: str }, required: ["label", "wert"] }, description: "3–6 entscheidende Werte" },
    abschnitte: { type: "array", items: { type: "object", properties: { titel: str, punkte: strArr }, required: ["titel", "punkte"] }, description: "3–5 Abschnitte mit je 2–6 präzisen Punkten" },
    fragen: { type: "array", items: { type: "object", properties: { an: str, frage: str }, required: ["an", "frage"] } },
    entwurf: { type: "object", properties: { titel: str, text: str }, description: "Optional: Entwurf einer Nachricht, sonst weglassen" },
    naechste_schritte: strArr,
    grenzen: { ...str, description: "Ein Satz, was diese Einschätzung nicht leistet" },
  },
  required: ["kernaussage", "bewertung", "kennzahlen", "abschnitte", "fragen", "naechste_schritte", "grenzen"],
} as const;

export const KOMITEE_SCHEMA = {
  type: "object",
  properties: {
    rollen: { type: "array", items: { type: "object", properties: {
      rolle: { type: "string", enum: ["Makler", "WEG-Verwalter", "Vermögensverwalter", "Bankentscheider"] },
      urteil: { type: "string", enum: ["positiv", "neutral", "negativ"] },
      konfidenz: { type: "string", enum: ["hoch", "mittel", "niedrig"] },
      begruendungen: strArr, warnsignale: strArr, fragen: strArr,
    }, required: ["rolle", "urteil", "konfidenz", "begruendungen"] } },
    synthese: { type: "object", properties: {
      urteil: { type: "string", enum: ["Opportunity", "Watch", "Pass"] },
      zusammenfassung: str, widersprueche: strArr, naechste_schritte: strArr, verhandlung: str,
    }, required: ["urteil", "zusammenfassung", "naechste_schritte"] },
  },
  required: ["rollen", "synthese"],
} as const;

export const COMPLIANCE_SCHEMA = {
  type: "object",
  properties: {
    freigabe: { type: "boolean" },
    beanstandungen: { type: "array", items: { type: "object", properties: { experte: str, stelle: str, problem: str, korrektur: str }, required: ["experte", "problem", "korrektur"] } },
  },
  required: ["freigabe", "beanstandungen"],
} as const;

export const EXTRAKTION_SCHEMA = {
  type: "object",
  properties: {
    objekte: { type: "array", items: { type: "object", properties: {
      titel: str, ort: str, asset: { type: "string", enum: ["ETW", "MFH", "EFH/ZFH", "Gewerbe"] },
      kaufpreis: { type: ["number", "null"] }, wohnflaeche: { type: ["number", "null"] }, vermietet: { type: ["boolean", "null"] },
      kaltmieteMonat: { type: ["number", "null"] }, hausgeldNichtUmlagefaehig: { type: ["number", "null"] }, hausgeldGesamt: { type: ["number", "null"] },
      ruecklageAnteil: { type: ["number", "null"] }, baujahr: { type: ["number", "null"] }, energieklasse: { type: ["string", "null"] },
      erbbaurecht: { type: ["boolean", "null"] }, sonderumlage: { type: ["boolean", "null"] }, provisionProzent: { type: ["number", "null"] }, auszug: str,
      stellplaetze: { type: "array", items: { type: "object", properties: {
        art: { type: "string", enum: ["tiefgarage", "aussen", "garage", "carport", "duplex"] },
        preis: { type: "string", enum: ["inklusive", "separat", "unbekannt"] }, kaufpreis: { type: ["number", "null"] },
        recht: { type: "string", enum: ["teileigentum", "sondernutzung", "unbekannt"] }, miete: { type: ["number", "null"] },
      }, required: ["art", "preis"] } },
    }, required: ["titel", "ort", "asset", "kaufpreis", "wohnflaeche"] } },
  },
  required: ["objekte"],
} as const;

export const KURZURTEIL_SCHEMA = {
  type: "object",
  properties: {
    kernaussage: { ...str, description: "Ein Satz mit der entscheidenden Zahl" },
    einstufung: { type: "string", enum: ["Opportunity", "Watch", "Pass"] },
    fragen: { type: "array", items: { type: "object", properties: { an: str, frage: str }, required: ["an", "frage"] }, description: "Die drei wichtigsten offenen Fragen" },
    verhandlungsansatz: str,
    naechster_schritt: str,
  },
  required: ["kernaussage", "einstufung", "fragen", "verhandlungsansatz", "naechster_schritt"],
} as const;

const spanne = { type: "object", properties: { wert: { type: "number" }, von: { type: "number" }, bis: { type: "number" } }, required: ["wert", "von", "bis"] } as const;
export const MARKTWERTE_SCHEMA = {
  type: "object",
  properties: {
    marktmieteQm: spanne, vergleichspreisQm: spanne, bodenrichtwert: { ...spanne, type: ["object", "null"] },
    grundlage: { type: "string" }, stand: { type: "string" }, sicherheit: { type: "string", enum: ["niedrig", "mittel", "hoch"] },
    hinweise: { type: "array", items: { type: "string" } },
  },
  required: ["marktmieteQm", "vergleichspreisQm", "grundlage", "stand", "sicherheit"],
} as const;
export interface Marktwerte { marktmieteQm: Spanne; vergleichspreisQm: Spanne; bodenrichtwert?: Spanne | null; grundlage: string; stand: string; sicherheit: "niedrig" | "mittel" | "hoch"; hinweise?: string[] }
export interface Spanne { wert: number; von: number; bis: number }

const zahlOderNull = { type: ["number", "null"] } as const;
export const MIETSPIEGEL_SCHEMA = {
  type: "object",
  properties: {
    stadt: { type: "string" }, art: { type: "string", enum: ["qualifiziert", "einfach", "unbekannt"] },
    gueltigAb: { type: ["string", "null"] }, gueltigBis: { type: ["string", "null"] }, quelleName: { type: "string" },
    merkmale: { type: "array", items: { type: "object", properties: {
      key: { type: "string", enum: ["baujahr", "flaeche", "lage", "ausstattung"] }, label: { type: "string" },
      klassen: { type: "array", items: { type: "object", properties: { label: { type: "string" }, von: zahlOderNull, bis: zahlOderNull, wert: { type: "string" } }, required: ["label"] } },
    }, required: ["key", "label", "klassen"] } },
    felder: { type: "array", items: { type: "object", properties: { k: { type: "array", items: { type: "integer" } }, von: zahlOderNull, mittel: zahlOderNull, bis: zahlOderNull }, required: ["k"] } },
    zuschlaege: { type: "array", items: { type: "object", properties: { text: { type: "string" }, wert: { type: "number" }, einheit: { type: "string", enum: ["€/m²", "%"] } }, required: ["text", "wert", "einheit"] } },
    hinweise: { type: "string" },
  },
  required: ["stadt", "art", "merkmale", "felder"],
} as const;

export const MARKTBERICHT_SCHEMA = {
  type: "object",
  properties: {
    titel: { type: "string" }, herausgeber: { type: "string" }, stand: { type: "string" }, datum: { type: ["string", "null"] },
    kernaussagen: { type: "array", items: { type: "string" } },
    fakten: { type: "array", items: { type: "object", properties: {
      thema: { type: "string", enum: ["zins", "makro", "rendite", "miete", "kaufpreis", "transaktion", "leerstand", "flaechenumsatz", "prognose"] },
      segment: { type: "string", enum: ["wohnen", "buero", "logistik", "einzelhandel", "gewerbe", "gesamt"] },
      region: { type: "string" }, kennzahl: { type: "string" }, wert: zahlOderNull, wertText: { type: "string" }, einheit: { type: "string" },
      veraenderung: { type: "string" }, stichtag: { type: "string" }, seite: { type: "integer" },
    }, required: ["thema", "segment", "region", "kennzahl", "einheit", "stichtag"] } },
  },
  required: ["titel", "herausgeber", "stand", "fakten", "kernaussagen"],
} as const;

export const SCHEMA_JE_AUSGABE: Record<string, object> = { mietspiegel: MIETSPIEGEL_SCHEMA, marktbericht: MARKTBERICHT_SCHEMA, kurzurteil: KURZURTEIL_SCHEMA, bericht: BERICHT_SCHEMA, komitee: KOMITEE_SCHEMA, compliance: COMPLIANCE_SCHEMA, extraktion: EXTRAKTION_SCHEMA, marktwerte: MARKTWERTE_SCHEMA };

export interface Bericht {
  kernaussage: string; bewertung: "positiv" | "neutral" | "kritisch";
  kennzahlen: { label: string; wert: string; hinweis?: string }[];
  abschnitte: { titel: string; punkte: string[] }[];
  fragen: { an: string; frage: string }[];
  entwurf?: { titel: string; text: string };
  naechste_schritte: string[]; grenzen: string;
}
export interface Komiteeurteil {
  rollen: { rolle: string; urteil: "positiv" | "neutral" | "negativ"; konfidenz: string; begruendungen: string[]; warnsignale?: string[]; fragen?: string[] }[];
  synthese: { urteil: "Opportunity" | "Watch" | "Pass"; zusammenfassung: string; widersprueche?: string[]; naechste_schritte: string[]; verhandlung?: string };
}
export interface Compliancebefund { freigabe: boolean; beanstandungen: { experte: string; stelle?: string; problem: string; korrektur: string }[] }
export interface Kurzurteil { kernaussage: string; einstufung: "Opportunity" | "Watch" | "Pass"; fragen: { an: string; frage: string }[]; verhandlungsansatz: string; naechster_schritt: string }
