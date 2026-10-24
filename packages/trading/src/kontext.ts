import type { AlpacaZugang } from "./broker";

/**
 * Kontext je Wert aus frei verfügbaren Quellen:
 * - Nachrichten über die Alpaca-Nachrichten-API (Benzinga), eingeordnet nach Art und Richtung
 * - Insider-Käufe und -Verkäufe aus den SEC-Meldungen (Form 4), gehäufte Käufe als Signal
 * - Short-Anteil am Tagesvolumen aus den FINRA-Dateien, als Filter (Squeeze-Gefahr)
 * Der Agent nutzt den Kontext als Filter: keine Käufe gegen frische schlechte Nachrichten, keine Shorts gegen
 * gute oder bei sehr hohem Short-Anteil. Ob das hilft, zeigt die Treffsicherheit; es ist bewusst abschaltbar.
 */
export type Nachrichtenart = "hochstufung" | "herabstufung" | "zahlen-gut" | "zahlen-schlecht" | "prognose-hoch" | "prognose-runter" | "uebernahme" | "rechtlich" | "sonstiges";
export interface Nachricht { id: string; zeit: string; symbole: string[]; titel: string; quelle: string; url?: string; art: Nachrichtenart; richtung: 1 | -1 | 0 }
export interface Insidergeschaeft { symbol: string; datum: string; person: string; rolle: string; art: "kauf" | "verkauf"; stueck: number; preis: number; wert: number }
export interface Kontextlage {
  symbol: string;
  /** Summe der Richtungen frischer Nachrichten (letzte 24 Stunden) */
  nachrichten: number;
  letzte?: Nachricht;
  /** Anzahl verschiedener Insider mit Käufen über die Börse in 30 Tagen */
  insiderKaeufer: number;
  insiderWert: number;
  /** Short-Volumen / Gesamtvolumen am letzten verfügbaren Tag */
  shortAnteil: number | null;
  gruende: string[];
}

const MUSTER: [RegExp, Nachrichtenart, 1 | -1][] = [
  [/\b(downgrade[sd]?|cuts? .{0,20}(to|price target)|to (sell|underperform|underweight)|herabgestuft|abgestuft)\b/i, "herabstufung", -1],
  [/\b(upgrade[sd]?|raises? .{0,20}price target|to (buy|outperform|overweight)|hochgestuft|kaufempfehlung)\b/i, "hochstufung", 1],
  [/\b(miss(es|ed)?|below (estimates|expectations|consensus)|falls short|verfehlt)\b/i, "zahlen-schlecht", -1],
  [/\b(beats?|tops|above (estimates|expectations|consensus)|übertrifft|record (revenue|quarter))\b/i, "zahlen-gut", 1],
  [/\b(lowers?|cuts?|withdraws?) .{0,25}(guidance|outlook|forecast)|profit warning|gewinnwarnung|senkt .{0,20}prognose\b/i, "prognose-runter", -1],
  [/\b(raises?|lifts?|boosts?) .{0,25}(guidance|outlook|forecast)|hebt .{0,20}prognose\b/i, "prognose-hoch", 1],
  [/\b(to (acquire|be acquired)|takeover|buyout|übernahme(angebot)?)\b/i, "uebernahme", 1],
  [/\b(lawsuit|sues|sued|probe|investigation|subpoena|recall|klage|ermittlung)\b/i, "rechtlich", -1],
];
/** Schlagzeile einordnen (regelbasiert; eine KI-Einordnung kann das später ersetzen) */
export function einordnen(titel: string): { art: Nachrichtenart; richtung: 1 | -1 | 0 } {
  for (const [re, art, richtung] of MUSTER) if (re.test(titel)) return { art, richtung };
  return { art: "sonstiges", richtung: 0 };
}

/** Nachrichten der letzten Stunden zu den Werten (Alpaca, kostenloses Konto) */
export async function alpacaNachrichten(zugang: AlpacaZugang, symbole: string[], seit: string, holen: typeof fetch = fetch): Promise<Nachricht[]> {
  const q = new URLSearchParams({ symbols: symbole.join(","), start: seit, limit: "50", sort: "desc" });
  const r = await holen(`https://data.alpaca.markets/v1beta1/news?${q}`, { headers: { "APCA-API-KEY-ID": zugang.keyId, "APCA-API-SECRET-KEY": zugang.secret } });
  if (!r.ok) throw new Error(`Alpaca-Nachrichten ${r.status}`);
  const j = (await r.json()) as { news?: { id: number; headline: string; created_at: string; symbols: string[]; source: string; url?: string }[] };
  return (j.news ?? []).map(n => ({ id: String(n.id), zeit: n.created_at, symbole: n.symbols, titel: n.headline, quelle: n.source, url: n.url, ...einordnen(n.headline) }));
}

// ---------- SEC Form 4 ----------
const SEC = "https://www.sec.gov"; const SEC_DATEN = "https://data.sec.gov";
/** Kennung (CIK) je Börsenkürzel aus der SEC-Liste */
export async function cikListe(holen: typeof fetch, agent: string): Promise<Record<string, string>> {
  const r = await holen(`${SEC}/files/company_tickers.json`, { headers: { "user-agent": agent } }); if (!r.ok) throw new Error(`SEC ${r.status}`);
  const j = (await r.json()) as Record<string, { cik_str: number; ticker: string }>;
  return Object.fromEntries(Object.values(j).map(x => [x.ticker.toUpperCase(), String(x.cik_str).padStart(10, "0")]));
}
const tagWert = (xml: string, name: string) => xml.match(new RegExp(`<${name}>\\s*(?:<value>)?\\s*([^<]*)`, "i"))?.[1]?.trim() ?? "";
/** Eine Form-4-Meldung (XML) lesen: Käufe (Code P) und Verkäufe (Code S) über die Börse */
export function leseForm4(xml: string, symbol: string): Insidergeschaeft[] {
  const person = tagWert(xml, "rptOwnerName"); const titel = tagWert(xml, "officerTitle");
  const rolle = titel || (/<isDirector>\s*(1|true)/i.test(xml) ? "Director" : /<isTenPercentOwner>\s*(1|true)/i.test(xml) ? "10 %-Eigentümer" : "Insider");
  const out: Insidergeschaeft[] = [];
  for (const t of xml.split(/<nonDerivativeTransaction>/i).slice(1)) {
    const code = tagWert(t, "transactionCode"); if (code !== "P" && code !== "S") continue;
    const stueck = Number(tagWert(t, "transactionShares")); const preis = Number(tagWert(t, "transactionPricePerShare")); const datum = tagWert(t, "transactionDate").slice(0, 10);
    if (!Number.isFinite(stueck) || !Number.isFinite(preis) || !datum) continue;
    out.push({ symbol, datum, person, rolle, art: code === "P" ? "kauf" : "verkauf", stueck, preis, wert: Math.round(stueck * preis) });
  }
  return out;
}
/** Insidergeschäfte eines Werts seit einem Datum (höchstens 20 Meldungen; SEC verlangt einen User-Agent mit Kontakt) */
export async function secInsider(symbol: string, cik: string, seit: string, holen: typeof fetch, agent: string): Promise<Insidergeschaeft[]> {
  const r = await holen(`${SEC_DATEN}/submissions/CIK${cik}.json`, { headers: { "user-agent": agent } }); if (!r.ok) throw new Error(`SEC ${r.status}`);
  const j = (await r.json()) as { filings: { recent: { form: string[]; accessionNumber: string[]; filingDate: string[]; primaryDocument: string[] } } };
  const f = j.filings.recent; const out: Insidergeschaeft[] = [];
  const idx = f.form.map((x, i) => i).filter(i => f.form[i] === "4" && f.filingDate[i]! >= seit).slice(0, 20);
  for (const i of idx) {
    const pfad = `${SEC}/Archives/edgar/data/${Number(cik)}/${f.accessionNumber[i]!.replace(/-/g, "")}/${f.primaryDocument[i]!.replace(/^xsl[^/]+\//, "")}`;
    const x = await holen(pfad, { headers: { "user-agent": agent } }); if (x.ok) out.push(...leseForm4(await x.text(), symbol));
  }
  return out;
}

// ---------- FINRA Short-Volumen ----------
/** Tagesdatei der FINRA (frei): Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market */
export function leseFinra(text: string, symbole: string[]): Record<string, number> {
  const out: Record<string, number> = {}; const gesucht = new Set(symbole);
  for (const z of text.split(/\r?\n/).slice(1)) { const f = z.split("|"); if (f.length < 5 || !gesucht.has(f[1]!)) continue; const ges = Number(f[4]); if (ges > 0) out[f[1]!] = Math.round((Number(f[2]) / ges) * 1000) / 1000; }
  return out;
}
export async function finraShort(datum: string, symbole: string[], holen: typeof fetch): Promise<Record<string, number>> {
  const r = await holen(`https://cdn.finra.org/equity/regsho/daily/CNMSshvol${datum.replace(/-/g, "")}.txt`); if (!r.ok) throw new Error(`FINRA ${r.status}`);
  return leseFinra(await r.text(), symbole);
}

/** Kontext je Wert zusammenfassen */
export function kontextlage(symbol: string, nachrichten: Nachricht[], insider: Insidergeschaeft[], shortAnteil: number | null, jetzt: Date): Kontextlage {
  const frisch = nachrichten.filter(n => n.symbole.includes(symbol) && jetzt.getTime() - Date.parse(n.zeit) < 24 * 3600_000).sort((a, b) => b.zeit.localeCompare(a.zeit));
  const seit30 = new Date(jetzt.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
  const kaeufe = insider.filter(x => x.symbol === symbol && x.art === "kauf" && x.datum >= seit30);
  const kaeufer = new Set(kaeufe.map(x => x.person)).size; const wert = kaeufe.reduce((a, x) => a + x.wert, 0);
  const summe = frisch.reduce((a, n) => a + n.richtung, 0); const gruende: string[] = [];
  const letzte = frisch.find(n => n.richtung !== 0);
  if (letzte) gruende.push(`${letzte.richtung > 0 ? "Gute" : "Schlechte"} Nachricht: ${letzte.titel}`);
  if (kaeufer >= 2) gruende.push(`${kaeufer} Insider haben in 30 Tagen über die Börse gekauft (${Math.round(wert / 1000).toLocaleString("de-DE")} Tsd. $)`);
  if (shortAnteil != null && shortAnteil >= 0.6) gruende.push(`Short-Anteil am Volumen ${Math.round(shortAnteil * 100)} %: Squeeze-Gefahr für Shorts`);
  return { symbol, nachrichten: summe, ...(letzte ? { letzte } : {}), insiderKaeufer: kaeufer, insiderWert: wert, shortAnteil, gruende };
}

/** Filter für ein Signal: null = erlaubt, sonst Begründung der Sperre */
export function kontextSperre(richtung: "long" | "short", k: Kontextlage | undefined): string | null {
  if (!k) return null;
  if (richtung === "long" && k.nachrichten < 0) return k.gruende.find(g => g.startsWith("Schlechte")) ?? "Schlechte Nachricht";
  if (richtung === "short" && k.nachrichten > 0) return k.gruende.find(g => g.startsWith("Gute")) ?? "Gute Nachricht";
  if (richtung === "short" && k.insiderKaeufer >= 2) return "Gehäufte Insider-Käufe";
  if (richtung === "short" && k.shortAnteil != null && k.shortAnteil >= 0.6) return `Short-Anteil ${Math.round(k.shortAnteil * 100)} %`;
  return null;
}
