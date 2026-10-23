import type { Assetklasse, Objekt } from "@highstack/engine";

/**
 * Marktwissen aus Marktberichten (z. B. Maklerhäuser, Institute). Gespeichert werden einzelne
 * Fakten mit Quelle, Stichtag und Seite, nicht der Bericht selbst. Kernaussagen werden in eigenen
 * Worten zusammengefasst. Nutzer sehen nur freigegebene Fakten, passend zu Ort und Objektart.
 */
export type Thema = "zins" | "makro" | "rendite" | "miete" | "kaufpreis" | "transaktion" | "leerstand" | "flaechenumsatz" | "prognose";
export type Segment = "wohnen" | "buero" | "logistik" | "einzelhandel" | "gewerbe" | "gesamt";
export interface Fakt {
  id: string;
  thema: Thema;
  segment: Segment;
  /** Deutschland, Top 7, Top 8 oder eine Stadt */
  region: string;
  kennzahl: string;
  wert: number | null;
  /** für Spannen oder Text, z. B. „3,20–3,70“ */
  wertText?: string;
  einheit: string;
  /** Veränderung gegenüber Vorjahr, z. B. „+3,5 %“ */
  veraenderung?: string;
  stichtag: string;
  seite?: number;
}
export interface Marktbericht {
  id: string;
  titel: string;
  herausgeber: string;
  stand: string;
  datum: string | null;
  quelleUrl: string;
  lizenz: string;
  kernaussagen: string[];
  fakten: Fakt[];
  status: "entwurf" | "geprueft";
  herkunft: "ki" | "import" | "manuell";
  erfasst: number;
  geaendert: number;
  geprueftVon?: string;
}

export const THEMEN: Record<Thema, string> = { zins: "Zinsen", makro: "Konjunktur", rendite: "Renditen", miete: "Mieten", kaufpreis: "Kaufpreise", transaktion: "Transaktionen", leerstand: "Leerstand", flaechenumsatz: "Flächenumsatz", prognose: "Ausblick" };
export const SEGMENTE: Record<Segment, string> = { wohnen: "Wohnen", buero: "Büro", logistik: "Logistik", einzelhandel: "Einzelhandel", gewerbe: "Gewerbe", gesamt: "Gesamtmarkt" };
const TOP7 = ["berlin", "hamburg", "münchen", "muenchen", "köln", "koeln", "frankfurt", "düsseldorf", "duesseldorf", "stuttgart"];
const norm = (s: string) => s.toLowerCase().normalize("NFC").trim();

const segmentFuer = (a: Assetklasse): Segment[] => a === "Gewerbe" ? ["buero", "einzelhandel", "gewerbe", "logistik"] : ["wohnen"];

export interface Marktfakt extends Fakt { quelle: string; stand: string; berichtId: string; rang: number }
/**
 * Fakten für ein Objekt: Stadt zuerst, dann Top 7 (wenn die Stadt dazugehört), dann Deutschland.
 * Je Kennzahl und Region nur der neueste Stand. Zinsen und Konjunktur gelten immer.
 */
export function faktenFuer(berichte: Marktbericht[], o: Pick<Objekt, "ort" | "titel" | "asset">, max = 8): Marktfakt[] {
  const text = norm(`${o.ort ?? ""} ${o.titel ?? ""}`);
  const stadt = (r: string) => { const n = norm(r); return n.length > 2 && !/^(deutschland|top \d)/.test(n) && text.includes(n); };
  const inTop7 = TOP7.some(s => text.includes(s));
  const segs = segmentFuer(o.asset);
  const alle: Marktfakt[] = [];
  for (const b of berichte.filter(x => x.status === "geprueft")) for (const f of b.fakten) {
    const r = norm(f.region);
    const regionRang = stadt(f.region) ? 3 : r.startsWith("top") ? (inTop7 ? 2 : 0) : r === "deutschland" ? 1 : 0;
    if (!regionRang) continue;
    const allgemein = f.thema === "zins" || f.thema === "makro";
    if (!allgemein && !segs.includes(f.segment)) continue;
    const themaRang = f.thema === "miete" || f.thema === "rendite" ? 3 : f.thema === "zins" ? 2.5 : f.thema === "kaufpreis" || f.thema === "prognose" ? 2 : 1;
    alle.push({ ...f, quelle: `${b.herausgeber} ${b.titel}`, stand: b.stand, berichtId: b.id, rang: regionRang * 10 + themaRang + (b.datum ? Date.parse(b.datum) / 1e13 : 0) });
  }
  // je Kennzahl+Region den neuesten Bericht
  const best = new Map<string, Marktfakt>();
  for (const f of alle) { const k = `${norm(f.kennzahl)}|${norm(f.region)}`; const da = best.get(k); if (!da || f.rang > da.rang) best.set(k, f); }
  return [...best.values()].sort((a, b) => b.rang - a.rang).slice(0, max);
}

export const zeigeWert = (f: Pick<Fakt, "wert" | "wertText" | "einheit">) => `${f.wertText ?? (f.wert == null ? "–" : f.wert.toLocaleString("de-DE", { maximumFractionDigits: 2 }))}${f.einheit ? ` ${f.einheit}` : ""}`;

export function pruefeBericht(b: Marktbericht): string[] {
  const f: string[] = [];
  if (!b.titel.trim()) f.push("Titel fehlt"); if (!b.herausgeber.trim()) f.push("Herausgeber fehlt"); if (!b.stand.trim()) f.push("Stand fehlt");
  if (!b.fakten.length) f.push("Keine Fakten");
  b.fakten.forEach(x => { if (x.wert == null && !x.wertText) f.push(`${x.kennzahl}: Wert fehlt`); if (!x.region.trim()) f.push(`${x.kennzahl}: Region fehlt`); });
  return [...new Set(f)];
}
