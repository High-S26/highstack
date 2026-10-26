import { Gesperrt, holeSicher, type Antwort } from "./sicherHolen";
import type { Assetklasse, Aussenart, Aussenflaeche, Mietvertrag, Objekt, Stellplatz } from "@highstack/engine";

/** Ergebnis des Auslesens: gefundene Felder und woher sie stammen */
export interface Erfassung { felder: Partial<Objekt>; gefunden: (keyof Objekt)[]; quelle: "ki" | "muster" | "keine"; text: string; hinweis?: string }

export async function textAusPdf(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  try { const pdf = await getDocumentProxy(bytes.slice()); const r = await extractText(pdf, { mergePages: true }); return String(r.text).slice(0, 120000); } catch { return ""; }
}

/** Eine öffentliche Seite abrufen, die der Nutzer selbst angibt. Keine internen Adressen (auch nicht über Weiterleitungen), max. 3 MB, 12 s. */
export async function textAusUrl(roh: string): Promise<{ text: string; titel?: string; hinweis?: string }> {
  try { new URL(roh.trim()); } catch { return { text: "", hinweis: "Das ist kein gültiger Link." }; }
  try {
    let r: Antwort;
    try { r = await holeSicher(roh.trim(), { kopf: { "user-agent": "Mozilla/5.0 (highstack Exposé-Leser)", accept: "text/html,application/pdf", "accept-encoding": "identity" } }); }
    catch (x) { if (x instanceof Gesperrt) return { text: "", hinweis: x.message }; throw x; }
    if (r.status < 200 || r.status >= 300) return { text: "", hinweis: `Die Seite antwortet mit ${r.status}. Viele Portale sperren das automatische Lesen: kopieren Sie den Text der Anzeige oder laden Sie das Exposé als PDF hoch.` };
    const typ = r.typ; const buf = r.inhalt;
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

/**
 * Betrag nach einer Bezeichnung finden, robust gegen typische Exposé-Schreibweisen:
 * „Hausgeld: 310 €“, „Wohngeld mtl. ca. € 310,-“, „Hausgeld (inkl. Rücklage) 310,00 EUR“,
 * „Hausgeld 2025: 310 Euro“, Tabellen mit Zeilenumbruch zwischen Bezeichnung und Wert.
 * Ein Betrag zählt nur mit Währung davor oder danach; Jahreszahlen werden übersprungen.
 */
export function betragNach(text: string, bezeichnung: RegExp, weite = 90): number | null {
  const re = new RegExp(bezeichnung.source, "gi"); let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const rest = text.slice(m.index + m[0].length, m.index + m[0].length + weite);
    const geld = /(€|EUR|Euro)?\s*(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)(\s*,-)?\s*(€|EUR|Euro)?/gi; let g: RegExpExecArray | null;
    while ((g = geld.exec(rest))) {
      if (!g[2]) { geld.lastIndex++; continue; }
      const vorher = rest.slice(0, g.index);
      if (/[.!?]\s/.test(vorher.replace(/\b(?:inkl|ca|mtl|monatl|zzgl|bzw|lt|gem|ggf|z\.\s?B)\./gi, ""))) break; // nächster Satz
      if (g[1] || g[4] || g[3]) { const n = zahl(g[2]); if (n) return n; }
    }
  }
  return null;
}

const STADTNAMEN = ["Düsseldorf", "Köln", "Bonn", "Neuss", "Duisburg", "Essen", "Dortmund", "Bochum", "Wuppertal", "Krefeld", "Mönchengladbach", "Aachen", "Münster", "Hamburg", "Berlin", "München", "Frankfurt", "Stuttgart", "Leipzig", "Dresden", "Hannover", "Bremen", "Nürnberg", "Mainz", "Wiesbaden", "Ratingen", "Mettmann", "Leverkusen", "Solingen", "Gelsenkirchen", "Oberhausen", "Mülheim"];

// ---------- Sätze und Verneinungen ----------
const ABK = /\b(inkl|ca|mtl|monatl|zzgl|bzw|lt|gem|ggf|Nr|Str|Tel|z\.\s?B|u\.\s?a|d\.\s?h)\./gi;
/** Text in Sätze bzw. Zeilen teilen (Abkürzungen beenden keinen Satz) */
export function saetze(t: string): string[] {
  return t.replace(ABK, m => m.replace(/\./g, "\u2024")).split(/(?<=[.!?])\s+|\n+/).map(x => x.replace(/\u2024/g, ".").trim()).filter(Boolean);
}
const VERNEINUNG = /\b(kein|keine|keinen|keinem|keiner|nicht|ohne|weder|nein)\b/i;
/** Erwähnungen eines Merkmals: bejaht, verneint oder gar nicht (Verneinung im selben Satz) */
/** Verneinung in der Nähe des Worts (bis 30 Zeichen davor oder danach), nicht irgendwo im Satz */
export function verneintBei(satz: string, wort: RegExp): boolean {
  const m = new RegExp(wort.source, wort.flags.replace("g", "")).exec(satz); if (!m) return false;
  // davor: bis 25 Zeichen, aber nicht über ein Komma hinweg; danach: bis 15 Zeichen bis zum nächsten Komma
  const vor = satz.slice(Math.max(0, m.index - 25), m.index).split(/[,;:]/).at(-1) ?? "";
  const nach = satz.slice(m.index + m[0].length, m.index + m[0].length + 15).replace(/^\s*:/, "").split(/[,;:]/)[0] ?? "";
  return VERNEINUNG.test(vor) || VERNEINUNG.test(nach);
}
export function merkmal(t: string, wort: RegExp): "ja" | "nein" | null {
  const s = saetze(t).filter(x => wort.test(x)); if (!s.length) return null;
  return s.some(x => !verneintBei(x, wort)) ? "ja" : "nein";
}
/** Stellplatz verneint: „kein Stellplatz“, „ohne Garage“, „Stellplatz nicht vorhanden“ (nicht: „nicht im Preis enthalten“) */
const stellplatzVerneint = (x: string) => /\b(kein\w*|ohne)\s+(\w+\s+)?(Tiefgaragen)?(Stellpl|Garage|Parkpl|Carport|Tiefgarage)/i.test(x) || /(Stellpl\w*|Garage|Parkpl\w*|Carport|Tiefgarage)[^.]{0,40}\bnicht\s+(vorhanden|verfügbar|dabei)/i.test(x);
const KONTAKT = /GmbH|\bAG\b|\bKG\b|Immobilien(?!\w*wohnung)|Makler|\bTel\b\.?|Telefon|\bFax\b|E-?Mail|www\.|https?:|\bBüro\b|Ansprechpartner|Impressum/i;

/** Ohne KI: typische Angaben aus Exposés per Muster erkennen */
export function musterErkennung(text: string, titel?: string): Erfassung {
  const t = text.replace(/ /g, " ");
  const f: Partial<Objekt> = {};
  // Kaufpreis: zuerst über die robuste Betragserkennung („289.000,- €“, „EUR 289.000“), sonst die alten Muster
  // „1,25 Mio. €“ / „1,25 Millionen Euro“
  const mio = t.match(/(?:Kauf)?[Pp]reis[^\d\n]{0,20}(\d{1,3}(?:[.,]\d{1,3})?)\s*(?:Mio\.?|Millionen)\s*(?:€|EUR|Euro)?/i);
  const kp = (mio ? Math.round(Number(mio[1]!.replace(",", ".")) * 1_000_000) : null) ?? betragNach(t, /Kaufpreis/) ?? zahl(finde(t, [/([\d.]{6,})\s*(?:€|EUR)\s*Kaufpreis/i, /Preis[^\d€]{0,15}([\d.,]{5,})\s*(?:€|EUR)/i]));
  if (kp && kp > 10000) f.kaufpreis = Math.round(kp);
  const qm = zahl(finde(t, [/Wohnfl(?:ä|ae)che[^\d]{0,20}([\d.,]+)\s*m/i, /Nutzfl(?:ä|ae)che[^\d]{0,20}([\d.,]+)\s*m/i, /([\d.,]+)\s*m²\s*Wohnfl/i, /ca\.\s*([\d.,]+)\s*m²/i]));
  if (qm && qm > 10 && qm < 20000) f.wohnflaeche = Math.round(qm * 10) / 10;
  const miete = zahl(finde(t, [/(?:Ist-?|Netto-?|Kalt)miete[^\d€]{0,30}([\d.,]+)\s*(?:€|EUR)/i, /Mieteinnahmen[^\d€]{0,30}([\d.,]+)\s*(?:€|EUR)/i]));
  if (miete && miete < 1e6) f.miete = /p\.?\s*a\.?|jährlich|pro Jahr/i.test(t.slice(t.search(/miete/i), t.search(/miete/i) + 80)) && miete > 3000 ? Math.round(miete / 12) : miete;
  // Hausgeld (auch „Wohngeld“): nicht umlagefähigen Anteil direkt nehmen, sonst 40 % des Gesamtbetrags
  const nu = betragNach(t, /(?:davon\s+)?nicht\s+umlage(?:f(?:ä|ae)hig|bar)(?:er\s+Anteil)?/);
  const hg = betragNach(t, /(?:Haus|Wohn)geld/);
  if (hg && hg < 5000) { f.hausgeldGesamt = hg; f.hausgeldNichtUmlagefaehig = nu && nu < hg ? nu : Math.round(hg * 0.4); }
  else if (nu && nu < 3000) f.hausgeldNichtUmlagefaehig = nu;
  const bj = finde(t, [/Baujahr[^\d]{0,10}(1[89]\d\d|20\d\d)/i]); if (bj) f.baujahr = Number(bj);
  const ek = finde(t, [/Energieeffizienzklasse[^A-H]{0,10}([A-H]\+?)\b/i, /Effizienzklasse[^A-H]{0,10}([A-H]\+?)\b/i]); if (ek) f.energieklasse = ek.toUpperCase();
  // Ort: Postleitzahl mit Ort, aber nicht aus Briefkopf oder Kontaktdaten des Maklers
  const zeilen = t.split("\n"); let bester: { ort: string; punkte: number; pos: number } | null = null;
  zeilen.forEach((z, n) => { for (const m of z.matchAll(/\b(\d{5})\s+([A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ][a-zäöüß]+|\s(?:am|an der|im|ob der|bei)\s[A-ZÄÖÜ][a-zäöüß]+)?)/g)) {
    const punkte = (KONTAKT.test(z) ? -3 : 0) + (/\b(in|Lage|Objekt|Wohnung|Haus)\b/i.test(z.slice(0, m.index)) ? 2 : 0);
    if (!bester || punkte > bester.punkte) bester = { ort: m[2]!, punkte, pos: n };
  } });
  if (bester && (bester as { punkte: number }).punkte > -3) f.ort = (bester as { ort: string }).ort;
  // ohne Postleitzahl: „in Düsseldorf-Mitte“, „von Düsseldorf“ bei bekannten Städten
  if (!f.ort) {
    const treffer = [...t.matchAll(new RegExp(`\\b(in|von|nach)\\s+(${STADTNAMEN.join("|")})(-[A-ZÄÖÜ][a-zäöüß]+)?\\b`, "gi"))];
    // bevorzugt „in Stadt-Stadtteil“, dann „in Stadt“, dann „von Stadt“
    const m = treffer.sort((a, b) => (b[3] ? 2 : 0) + (/^in$/i.test(b[1]!) ? 1 : 0) - ((a[3] ? 2 : 0) + (/^in$/i.test(a[1]!) ? 1 : 0)))[0];
    if (m) f.ort = STADTNAMEN.find(n => n.toLowerCase() === m[2]!.toLowerCase())! + (m[3] ?? "");
  }
  const asset: Assetklasse = /Mehrfamilienhaus|Zinshaus|Wohn- und Geschäftshaus/i.test(t) ? "MFH" : /Einfamilienhaus|Doppelhaush|Reihenhaus|Zweifamilienhaus/i.test(t) ? "EFH/ZFH" : /Gewerbe|Büro|Ladenlokal|Praxis/i.test(t) && !/Wohnung/i.test(t) ? "Gewerbe" : "ETW";
  f.asset = asset;
  // Vermietung, Erbbaurecht, Sonderumlage: Verneinungen im selben Satz beachten („unvermietet“, „kein Erbbaurecht“)
  const vermietet = merkmal(t.replace(/\bunvermietet\b/gi, "nicht vermietet"), /\bvermietet\b/i);
  if (/bezugsfrei|leerstehend|sofort frei|\bunvermietet\b/i.test(t) || vermietet === "nein") f.leer = true; else if (vermietet === "ja") f.leer = false;
  const erb = merkmal(t, /Erbbaurecht/i); if (erb) f.erbbaurecht = erb === "ja";
  const su = merkmal(t, /Sonderumlage/i); if (su) f.sonderumlage = su === "ja";
  const au = aussenflaecheAusText(t, f.wohnflaeche ?? null); if (au) f.aussenflaeche = au;
  const mv = mietvertragAusText(t, f.miete ?? null); if (mv && !f.leer) f.mietvertrag = mv;
  // Käuferprovision: „provisionsfrei“, „von Privat“, „ohne Makler“ → 0; „Käuferprovision 3,57 %“ → Satz (INV-062)
  const prov = t.match(/(?:Käufer)?(?:provision|courtage)[^.\d%]{0,30}(\d{1,2}(?:,\d{1,2})?)\s*%/i);
  if (/provisionsfrei|courtagefrei|ohne\s+Makler|keine\s+(?:Käufer)?provision|von\s+Privat|privat\s+zu\s+verkaufen/i.test(t)) f.maklerProvision = 0;
  else if (prov) { const v = Number(prov[1]!.replace(",", ".")) / 100; if (v >= 0 && v <= 0.15) f.maklerProvision = v; }
  const sp = stellplatzAusText(t, [f.kaufpreis, hg, nu, f.miete].filter((x): x is number => !!x));
  if (sp.length) { f.stellplaetze = sp; f.gefragt = { stellplatz: "ja", "sp-art": "ja" }; }
  else if (saetze(t).some(stellplatzVerneint)) f.gefragt = { stellplatz: "nein" };
  const zimmer = finde(t, [/(\d(?:[.,]5)?)\s*-?\s*Zimmer/i]);
  const kandidaten = t.split("\n").map(z => z.trim()).filter(z => z.length > 12 && z.length < 120 && !KONTAKT.test(z) && !/^\d{5}\s/.test(z));
  const tit = (titel ?? kandidaten.find(z => /Wohnung|Haus|Apartment|Appartement|Zimmer|ETW|Penthouse|Loft|Maisonette|m²/i.test(z)) ?? kandidaten[0])?.replace(/\s*[|–-]\s*(ImmoScout24|Immowelt|Kleinanzeigen|immonet).*$/i, "").replace(/^(Exposé|Expose|Objekt|Angebot)\s*[:\-–]\s*/i, "").trim();
  f.titel = tit || [zimmer ? `${zimmer}-Zi.-${asset}` : asset, f.ort].filter(Boolean).join(", ");
  const gefunden = (Object.keys(f) as (keyof Objekt)[]).filter(k => !["asset", "titel", "gefragt", "hausgeldGesamt"].includes(k));
  return { felder: f, gefunden, quelle: gefunden.length ? "muster" : "keine", text };
}

const AUSSEN: [RegExp, Aussenart][] = [[/Dachterrasse|Dachgarten/i, "dachterrasse"], [/Wintergarten/i, "wintergarten"], [/Loggia/i, "loggia"], [/Terrasse/i, "terrasse"], [/Balkon/i, "balkon"], [/Garten(?!anteil)|Gartenanteil/i, "garten"]];
const AUSSEN_WORT = /Dachterrasse|Dachgarten|Wintergarten|Loggia|Terrasse|Balkon|Garten/i;
const RICHTUNG: [RegExp, string][] = [[/S(ü|ue)dwest/i, "Südwest"], [/S(ü|ue)dost/i, "Südost"], [/Nordwest/i, "Nordwest"], [/Nordost/i, "Nordost"], [/S(ü|ue)d/i, "Süd"], [/West/i, "West"], [/Ost(?!er)/i, "Ost"], [/Nord/i, "Nord"]];
const qmZahl = (s: string) => { const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s); return Number.isFinite(n) && n > 0 && n < 2000 ? Math.round(n * 10) / 10 : null; };

/**
 * Außenfläche aus dem Text: Art, Größe, Ausrichtung und ob sie in der Wohnfläche steckt.
 * „Wohnfläche 33,5 m² zzgl. 15,6 m² Dachterrasse“ → nicht enthalten; „inkl. Balkon“ → enthalten.
 * Nennt das Inserat eine Gesamtfläche (z. B. „ca. 41,3 m²“), wird daraus der Anrechnungsanteil abgeleitet.
 */
export function aussenflaecheAusText(t: string, wohnflaeche: number | null): Aussenflaeche | null {
  const s = saetze(t).filter(x => AUSSEN_WORT.test(x) && !/Gartenstadt|Gartenstra|Terrassenstra|Balkonien/i.test(x));
  const bejaht = s.filter(x => !verneintBei(x, AUSSEN_WORT));
  if (!bejaht.length) return null;
  // bevorzugt der Satz mit Größe
  const mitQm = bejaht.map(x => { const m = x.match(/(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:m²|qm|m2)\s*(?:große?r?\s*)?(?:[A-ZÄÖÜ][a-zäöüß]+-)?(Dachterrasse|Dachgarten|Wintergarten|Loggia|Terrasse|Balkon|Garten)/i) ?? x.match(/(Dachterrasse|Dachgarten|Wintergarten|Loggia|Terrasse|Balkon|Garten)[^.\d]{0,30}?(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:m²|qm|m2)/i); return m ? { x, qm: qmZahl(/\d/.test(m[1]!) ? m[1]! : m[2]!), wort: /\d/.test(m[1]!) ? m[2]! : m[1]! } : null; }).find(Boolean);
  const satz = mitQm?.x ?? bejaht[0]!;
  const wort = mitQm?.wort ?? satz.match(AUSSEN_WORT)![0];
  const art = AUSSEN.find(([r]) => r.test(wort))?.[1] ?? "balkon";
  const qm = mitQm?.qm ?? null;
  const umfeld = bejaht.join(" ");
  const ri = umfeld.match(/(S(?:ü|ue)d(?:west|ost)?|Nord(?:west|ost)?|West|Ost)(?:-|\s)?(?:ausrichtung|ausgerichtet|seite|lage|balkon|terrasse|loggia)|nach\s+(S(?:ü|ue)d(?:west|ost)?en|Westen|Osten|Norden)|(S(?:ü|ue)d(?:west|ost)?|West)(?:balkon|terrasse|loggia)/i);
  const ausrichtung = ri ? RICHTUNG.find(([r]) => r.test(ri[0]))?.[1] ?? null : null;
  // in der Wohnfläche enthalten? „zzgl.“ / „zusätzlich“ → nein; „inkl.“ / „davon“ → ja; ohne Hinweis: ja (vorsichtig, keine Fläche doppelt)
  const zus = /\b(zzgl|zuzüglich|zusätzlich|plus|außerdem)\b\.?[^.]{0,40}(Dachterrasse|Dachgarten|Wintergarten|Loggia|Terrasse|Balkon)/i.test(satz) || /(Dachterrasse|Terrasse|Balkon|Loggia)[^.]{0,20}\b(zusätzlich|nicht (in der|enthalten))/i.test(satz);
  const inkl = /\b(inkl|inklusive|davon|einschließlich)\b\.?[^.]{0,30}(Dachterrasse|Dachgarten|Wintergarten|Loggia|Terrasse|Balkon)/i.test(satz);
  const inWohnflaeche = art === "garten" ? false : zus ? false : inkl ? true : true;
  // gerechnet wird mit dem Regelfall (ein Viertel); setzt der Anbieter mehr an, steht das als Hinweis dabei
  const anrechnung = art === "garten" ? 0 : art === "wintergarten" ? 0.5 : 0.25; let anbieterAnrechnung: number | undefined;
  // Gesamtfläche im Inserat („ca. 41,3 m² (Wohnfläche 33,5 m² zzgl. 15,6 m² Dachterrasse)“) verrät den Anteil
  if (qm && wohnflaeche && !inWohnflaeche && art !== "garten") {
    const gesamt = [...t.matchAll(/(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:m²|qm)/gi)].map(m => qmZahl(m[1]!)).filter((v): v is number => v != null && v > wohnflaeche && v <= wohnflaeche + qm);
    const g = gesamt.find(v => Math.abs(v - (wohnflaeche + qm / 2)) <= 0.15 || Math.abs(v - (wohnflaeche + qm / 4)) <= 0.15);
    if (g != null) anbieterAnrechnung = Math.abs(g - (wohnflaeche + qm / 2)) <= 0.15 ? 0.5 : 0.25;
  }
  return { art, qm, anrechnung, inWohnflaeche, ausrichtung, ...(anbieterAnrechnung != null && anbieterAnrechnung !== anrechnung ? { anbieterAnrechnung } : {}) };
}

/** Mietvertrag aus dem Text: Staffel- oder Indexmiete, letzte Mieterhöhung */
export function mietvertragAusText(t: string, miete?: number | null): Mietvertrag | null {
  const art: Mietvertrag["art"] | null = /Indexmiet|indexiert|Index-Miet|Indexmietvertrag/i.test(t) ? "index" : /Staffelmiet/i.test(t) ? "staffel" : null;
  // „03/2024“, „01.03.2024“, „März 2024“, „zuletzt im Juni 2025 erhöht“; nur ein Jahr: Dezember (vorsichtig, INV-059)
  const MON = ["januar", "februar", "märz", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "dezember"];
  const DATUM = "(?:(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4})|(\\d{1,2})[./](\\d{4})|(januar|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember)\\s+(\\d{4})|(\\d{4}))";
  const e = t.match(new RegExp(`(?:letzte\\s+)?Mieterh(?:ö|oe)hung[^.\\d]{0,30}?${DATUM}`, "i")) ?? t.match(new RegExp(`Miete\\s+wurde\\s+zuletzt[^.\\d]{0,20}?${DATUM}[^.]{0,15}erh(?:ö|oe)ht`, "i"));
  const zwei = (n: string | number) => String(n).padStart(2, "0");
  const letzteErhoehung = !e ? null : e[3] ? `${e[3]}-${zwei(e[2]!)}` : e[5] ? `${e[5]}-${zwei(e[4]!)}` : e[7] ? `${e[7]}-${zwei(MON.indexOf(e[6]!.toLowerCase().replace("maerz", "märz")) + 1)}` : `${e[8]}-12`;
  const staffel = art === "staffel" ? t.match(/Staffel[^.]{0,40}?(\d(?:[.,]\d+)?)\s*%/i) : null;
  // Staffel in Euro („jährlich + 15 € pro Monat“): in Prozent der Miete umrechnen
  const staffelEur = art === "staffel" && !staffel && miete ? t.match(/(?:Staffel|jährlich|pro Jahr)[^.]{0,40}?\+?\s*(\d{1,4}(?:,\d{1,2})?)\s*(?:€|EUR|Euro)/i) : null;
  if (!art && !letzteErhoehung) return null;
  return { art: art ?? "standard", letzteErhoehung: letzteErhoehung && /^(19|20)\d\d-(0[1-9]|1[0-2])$/.test(letzteErhoehung) ? letzteErhoehung : null, ...(staffel ? { staffelProzent: Number(staffel[1]!.replace(",", ".")) / 100 } : staffelEur && miete ? { staffelProzent: Math.round(Number(staffelEur[1]!.replace(",", ".")) / miete * 10000) / 10000 } : {}) };
}

const SP_ART: [RegExp, Stellplatz["art"]][] = [[/Duplex/i, "duplex"], [/Tiefgarage|TG-(?:Stell)?platz/i, "tiefgarage"], [/Carport/i, "carport"], [/\bGarage\b/i, "garage"], [/(?:Au(?:ß|ss)en|Frei)?[Ss]tellplatz|Parkplatz/i, "aussen"]];
/**
 * Stellplatz aus Inseratstext: Art, eigener Preis („zzgl.“), Rechtsform, Miete.
 * Beträge zählen nur aus demselben Satz wie das Stellplatzwort; Beträge, die schon Kaufpreis, Hausgeld oder Miete
 * der Wohnung sind, werden nie als Stellplatzpreis oder -miete übernommen. Verneinte Erwähnungen zählen nicht.
 */
export function stellplatzAusText(t: string, ausschliessen: number[] = []): Stellplatz[] {
  const WORT = /Tiefgarage|Stellplatz|Stellpl(?:ä|ae)tze|Garage|Carport|Parkplatz|Duplex|TG-(?:Stell)?platz/i;
  const saetzeMit = saetze(t).filter(x => WORT.test(x) && !stellplatzVerneint(x));
  if (!saetzeMit.length) return [];
  const betraege = (x: string) => [...x.matchAll(/(?:€|EUR|Euro)?\s*(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?)(?:\s*,-)?\s*(?:€|EUR|Euro)/gi)].map(m => zahl(m[1])).filter((v): v is number => v != null && !ausschliessen.some(a => Math.abs(a - v) < 0.5));
  // bevorzugt der Satz mit eigenem Preis, sonst die erste Erwähnung
  // eigener Preis: „zzgl.“, „Kaufpreis“ … oder ein Betrag direkt am Stellplatzwort („Tiefgaragenstellplatz: 18.000 €“, INV-064)
  const amWort = (x: string) => /(?:Tiefgarage\w*|Stellpl\w*|Garage|Carport|Duplex\w*|TG-\w*)\s*:?\s*(?:€|EUR)?\s*\d{1,3}(?:\.\d{3})+/i.test(x);
  const mitPreis = saetzeMit.find(x => (/zzgl\.?|zuzüglich|Kaufpreis|Preis|separat|optional|erworben/i.test(x) || amWort(x)) && betraege(x).some(v => v >= 3000 && v < 150000));
  const satz = mitPreis ?? saetzeMit[0]!;
  const art = SP_ART.find(([r]) => r.test(satz))?.[1] ?? SP_ART.find(([r]) => saetzeMit.some(x => r.test(x)))?.[1] ?? "aussen";
  const preisZahl = mitPreis ? betraege(mitPreis).find(v => v >= 3000 && v < 150000) ?? null : null;
  const separat = !!preisZahl || (/zzgl\.?|zuzüglich|optional|separat|kann (?:dazu|zusätzlich) erworben/i.test(satz) && !/inkl\.?|inklusive/i.test(satz));
  const mieteSatz = saetzeMit.find(x => /vermietet|Miete/i.test(x) && !/Haus|Wohngeld|Hausgeld/i.test(x));
  const miete = mieteSatz ? betraege(mieteSatz).find(v => v > 5 && v < 400) ?? null : null;
  return [{ id: `sp-${Math.random().toString(36).slice(2, 8)}`, art, preis: separat ? "separat" : "inklusive", kaufpreis: preisZahl ? Math.round(preisZahl) : null,
    recht: /Teileigentum|eigene[ms]? Grundbuch/i.test(t) ? "teileigentum" : /Sondernutzung/i.test(t) ? "sondernutzung" : "unbekannt",
    nutzung: miete ? "fremd" : "mieter", miete, hausgeld: null, erwerben: true }];
}

/** Ausgabe des Daten-Analysten in Objektfelder übersetzen */
export interface Extrakt { titel: string; ort: string; asset: Assetklasse; kaufpreis: number | null; wohnflaeche: number | null; vermietet?: boolean | null; kaltmieteMonat?: number | null; hausgeldNichtUmlagefaehig?: number | null; hausgeldGesamt?: number | null; ruecklageAnteil?: number | null; baujahr?: number | null; energieklasse?: string | null; erbbaurecht?: boolean | null; sonderumlage?: boolean | null; provisionProzent?: number | null; aussenflaeche?: { art: Aussenart; qm?: number | null; inWohnflaeche?: boolean | null; ausrichtung?: string | null } | null; mietvertragArt?: Mietvertrag["art"] | null; letzteMieterhoehung?: string | null; stellplaetze?: { art: Stellplatz["art"]; preis: "inklusive" | "separat" | "unbekannt"; kaufpreis?: number | null; recht?: Stellplatz["recht"]; miete?: number | null }[] }
export function ausExtrakt(x: Extrakt): Partial<Objekt> {
  const f: Partial<Objekt> = { titel: x.titel || undefined, ort: x.ort || undefined, asset: x.asset || "ETW" };
  if (x.kaufpreis) f.kaufpreis = x.kaufpreis; if (x.wohnflaeche) f.wohnflaeche = x.wohnflaeche;
  if (x.vermietet != null) f.leer = !x.vermietet; if (x.kaltmieteMonat) f.miete = x.kaltmieteMonat;
  const hg = x.hausgeldNichtUmlagefaehig ?? (x.hausgeldGesamt != null ? Math.round(x.hausgeldGesamt * 0.4) : null); if (hg) f.hausgeldNichtUmlagefaehig = hg;
  if (x.hausgeldGesamt) f.hausgeldGesamt = x.hausgeldGesamt;
  if (x.ruecklageAnteil) f.ruecklageAnteil = x.ruecklageAnteil; if (x.baujahr) f.baujahr = x.baujahr; if (x.energieklasse) f.energieklasse = x.energieklasse;
  if (x.erbbaurecht) f.erbbaurecht = true; if (x.sonderumlage) f.sonderumlage = true;
  if (x.provisionProzent != null && x.provisionProzent >= 0 && x.provisionProzent <= 15) f.maklerProvision = x.provisionProzent / 100;
  if (x.aussenflaeche?.art) f.aussenflaeche = { art: x.aussenflaeche.art, qm: x.aussenflaeche.qm ?? null, inWohnflaeche: x.aussenflaeche.inWohnflaeche ?? true, anrechnung: x.aussenflaeche.art === "garten" ? 0 : x.aussenflaeche.art === "wintergarten" ? 0.5 : 0.25, ausrichtung: x.aussenflaeche.ausrichtung ?? null };
  if (x.vermietet !== false && (x.mietvertragArt || x.letzteMieterhoehung)) f.mietvertrag = { art: x.mietvertragArt ?? "standard", letzteErhoehung: x.letzteMieterhoehung && /^\d{4}-\d{2}$/.test(x.letzteMieterhoehung) ? x.letzteMieterhoehung : null };
  if (x.stellplaetze?.length) { f.stellplaetze = stellplaetzeAusExtrakt(x.stellplaetze); f.gefragt = { stellplatz: "ja", "sp-art": "ja" }; }
  return Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined));
}

export function stellplaetzeAusExtrakt(l: NonNullable<Extrakt["stellplaetze"]>): Stellplatz[] {
  return l.map((y, n) => ({ id: `sp-${n}-${Math.random().toString(36).slice(2, 6)}`, art: y.art, preis: y.preis === "separat" || (y.kaufpreis ?? 0) > 0 ? "separat" : "inklusive", kaufpreis: y.kaufpreis ?? null, recht: y.recht ?? "unbekannt", nutzung: y.miete ? "fremd" : "mieter", miete: y.miete ?? null, hausgeld: null, erwerben: true }));
}
