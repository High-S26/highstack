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
    }, required: ["titel", "ort", "asset", "kaufpreis", "wohnflaeche"] } },
  },
  required: ["objekte"],
} as const;

export const SCHEMA_JE_AUSGABE: Record<string, object> = { bericht: BERICHT_SCHEMA, komitee: KOMITEE_SCHEMA, compliance: COMPLIANCE_SCHEMA, extraktion: EXTRAKTION_SCHEMA };

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
