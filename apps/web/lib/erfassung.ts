import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { Assetklasse, Objekt } from "@highstack/engine";

/** Ergebnis des Auslesens: gefundene Felder und woher sie stammen */
export interface Erfassung { felder: Partial<Objekt>; gefunden: (keyof Objekt)[]; quelle: "ki" | "muster" | "keine"; text: string; hinweis?: string }

export async function textAusPdf(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  try { const pdf = await getDocumentProxy(bytes.slice()); const r = await extractText(pdf, { mergePages: true }); return String(r.text).slice(0, 120000); } catch { return ""; }
}

const privat = (ip: string) => /^(127\.|10\.|192\.168\.|169\.254\.|0\.|::1$|fc|fd|fe80)/i.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
/** Eine öffentliche Seite abrufen, die der Nutzer selbst angibt. Keine internen Adressen, max. 3 MB, 12 s. */
export async function textAusUrl(roh: string): Promise<{ text: string; titel?: string; hinweis?: string }> {
  let url: URL; try { url = new URL(roh.trim()); } catch { return { text: "", hinweis: "Das ist kein gültiger Link." }; }
  if (!/^https?:$/.test(url.protocol)) return { text: "", hinweis: "Nur Links mit http oder https." };
  const host = url.hostname; const ips = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map(x => x.address);
  if (!ips.length || ips.some(privat) || host === "localhost") return { text: "", hinweis: "Diese Adresse ist nicht erreichbar." };
  try {
    const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(12000), headers: { "user-agent": "Mozilla/5.0 (highstack Exposé-Leser)", accept: "text/html,application/pdf" } });
    if (!r.ok) return { text: "", hinweis: `Die Seite antwortet mit ${r.status}. Viele Portale sperren das automatische Lesen: kopieren Sie den Text der Anzeige oder laden Sie das Exposé als PDF hoch.` };
    const typ = r.headers.get("content-type") ?? ""; const buf = new Uint8Array(await r.arrayBuffer()).slice(0, 3_000_000);
    if (typ.includes("pdf")) return { text: await textAusPdf(buf) };
    const html = new TextDecoder().decode(buf);
    const titel = html.match(/<title[^>]*>([^<]{3,200})<\/title>/i)?.[1]?.trim();
    const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, "\n").replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&euro;/g, "€").replace(/&sup2;/g, "²").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
    if (text.length < 200) return { text, titel, hinweis: "Auf der Seite stand kaum Text. Vermutlich lädt das Portal die Anzeige erst im Browser: kopieren Sie den Text oder laden Sie das Exposé hoch." };
    return { text: text.slice(0, 120000), titel };
  } catch { return { text: "", hinweis: "Die Seite war nicht erreichbar. Kopieren Sie den Text der Anzeige oder laden Sie das Exposé hoch." }; }
}

const zahl = (s?: string) => { if (!s) return null; const t = s.replace(/\s/g, ""); const n = Number(/,\d{1,2}$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t.replace(/[.,](?=\d{3}\b)/g, "").replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : null; };
const finde = (text: string, muster: RegExp[]) => { for (const m of muster) { const r = text.match(m); if (r?.[1]) return r[1]; } return undefined; };

/** Ohne KI: typische Angaben aus Exposés per Muster erkennen */
export function musterErkennung(text: string, titel?: string): Erfassung {
  const t = text.replace(/ /g, " ");
  const f: Partial<Objekt> = {};
  const kp = zahl(finde(t, [/Kaufpreis[^\d€]{0,30}([\d.,]{4,})\s*(?:€|EUR|Euro)/i, /([\d.]{6,})\s*(?:€|EUR)\s*Kaufpreis/i, /Preis[^\d€]{0,15}([\d.,]{5,})\s*(?:€|EUR)/i]));
  if (kp && kp > 10000) f.kaufpreis = Math.round(kp);
  const qm = zahl(finde(t, [/Wohnfl(?:ä|ae)che[^\d]{0,20}([\d.,]+)\s*m/i, /Nutzfl(?:ä|ae)che[^\d]{0,20}([\d.,]+)\s*m/i, /([\d.,]+)\s*m²\s*Wohnfl/i, /ca\.\s*([\d.,]+)\s*m²/i]));
  if (qm && qm > 10 && qm < 20000) f.wohnflaeche = Math.round(qm * 10) / 10;
  const miete = zahl(finde(t, [/(?:Ist-?|Netto-?|Kalt)miete[^\d€]{0,30}([\d.,]+)\s*(?:€|EUR)/i, /Mieteinnahmen[^\d€]{0,30}([\d.,]+)\s*(?:€|EUR)/i]));
  if (miete && miete < 1e6) f.miete = /p\.?\s*a\.?|jährlich|pro Jahr/i.test(t.slice(t.search(/miete/i), t.search(/miete/i) + 80)) && miete > 3000 ? Math.round(miete / 12) : miete;
  const hg = zahl(finde(t, [/Hausgeld[^\d€]{0,30}([\d.,]+)\s*(?:€|EUR)/i]));
  if (hg && hg < 5000) f.hausgeldNichtUmlagefaehig = Math.round(hg * 0.4);
  const bj = finde(t, [/Baujahr[^\d]{0,10}(1[89]\d\d|20\d\d)/i]); if (bj) f.baujahr = Number(bj);
  const ek = finde(t, [/Energieeffizienzklasse[^A-H]{0,10}([A-H]\+?)\b/i, /Effizienzklasse[^A-H]{0,10}([A-H]\+?)\b/i]); if (ek) f.energieklasse = ek.toUpperCase();
  const ort = t.match(/\b(\d{5})\s+([A-ZÄÖÜ][a-zäöüß]+(?:[- ][A-ZÄÖÜ][a-zäöüß]+)?)/); if (ort) f.ort = ort[2];
  const asset: Assetklasse = /Mehrfamilienhaus|Zinshaus|Wohn- und Geschäftshaus/i.test(t) ? "MFH" : /Einfamilienhaus|Doppelhaush|Reihenhaus|Zweifamilienhaus/i.test(t) ? "EFH/ZFH" : /Gewerbe|Büro|Ladenlokal|Praxis/i.test(t) && !/Wohnung/i.test(t) ? "Gewerbe" : "ETW";
  f.asset = asset;
  if (/bezugsfrei|leerstehend|sofort frei/i.test(t)) f.leer = true; else if (/vermietet/i.test(t)) f.leer = false;
  if (/Erbbaurecht/i.test(t)) f.erbbaurecht = true;
  if (/Sonderumlage/i.test(t)) f.sonderumlage = true;
  const zimmer = finde(t, [/(\d(?:[.,]5)?)\s*-?\s*Zimmer/i]);
  const tit = (titel ?? t.split("\n").find(z => z.trim().length > 12 && z.trim().length < 120))?.replace(/\s*[|–-]\s*(ImmoScout24|Immowelt|Kleinanzeigen|immonet).*$/i, "").replace(/^(Exposé|Expose|Objekt|Angebot)\s*[:\-–]\s*/i, "").trim();
  f.titel = tit || [zimmer ? `${zimmer}-Zi.-${asset}` : asset, f.ort].filter(Boolean).join(", ");
  const gefunden = (Object.keys(f) as (keyof Objekt)[]).filter(k => !["asset", "titel"].includes(k));
  return { felder: f, gefunden, quelle: gefunden.length ? "muster" : "keine", text };
}

/** Ausgabe des Daten-Analysten in Objektfelder übersetzen */
export interface Extrakt { titel: string; ort: string; asset: Assetklasse; kaufpreis: number | null; wohnflaeche: number | null; vermietet?: boolean | null; kaltmieteMonat?: number | null; hausgeldNichtUmlagefaehig?: number | null; hausgeldGesamt?: number | null; ruecklageAnteil?: number | null; baujahr?: number | null; energieklasse?: string | null; erbbaurecht?: boolean | null; sonderumlage?: boolean | null }
export function ausExtrakt(x: Extrakt): Partial<Objekt> {
  const f: Partial<Objekt> = { titel: x.titel || undefined, ort: x.ort || undefined, asset: x.asset || "ETW" };
  if (x.kaufpreis) f.kaufpreis = x.kaufpreis; if (x.wohnflaeche) f.wohnflaeche = x.wohnflaeche;
  if (x.vermietet != null) f.leer = !x.vermietet; if (x.kaltmieteMonat) f.miete = x.kaltmieteMonat;
  const hg = x.hausgeldNichtUmlagefaehig ?? (x.hausgeldGesamt != null ? Math.round(x.hausgeldGesamt * 0.4) : null); if (hg) f.hausgeldNichtUmlagefaehig = hg;
  if (x.ruecklageAnteil) f.ruecklageAnteil = x.ruecklageAnteil; if (x.baujahr) f.baujahr = x.baujahr; if (x.energieklasse) f.energieklasse = x.energieklasse;
  if (x.erbbaurecht) f.erbbaurecht = true; if (x.sonderumlage) f.sonderumlage = true;
  return Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined));
}
