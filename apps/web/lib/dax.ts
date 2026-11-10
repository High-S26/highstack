import { DAX_ISIN, gewichte, leseKerzenCsv, leseYahooChart, lerntage, rueckblickDax, tagessignal, type DaxRueckblick, type Morgenlage, type Tageskerze } from "@highstack/trading";
import { ereignisse } from "./konjunktur";
import type { Speicher } from "./speicher";

/**
 * Tageskerzen für DAX, S&P 500 und Nikkei mit Zwischenspeicher.
 * Quellen der Reihe nach: Yahoo Finance (Chart-Schnittstelle, frei, inoffiziell, nur für den Eigengebrauch),
 * dann Stooq (verlangt seit 2026 einen Schlüssel bzw. sperrt Bots; wird nicht umgangen).
 * Fällt alles aus, bleibt der letzte Stand, oder die Daten werden als CSV hochgeladen.
 */
export const KERZEN = {
  dax: { name: "DAX", stooq: "^dax", yahoo: "^GDAXI" },
  spx: { name: "S&P 500", stooq: "^spx", yahoo: "^GSPC" },
  nikkei: { name: "Nikkei 225", stooq: "^nkx", yahoo: "^N225" },
} as const;
export type KerzenId = keyof typeof KERZEN;
interface Kerzensatz { id: KerzenId; am: number; quelle: string; kerzen: Tageskerze[] }
const ART = "kerzen"; const ALTER = 6 * 3600_000;

export const berlinDatum = (d = new Date()) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(d);
export const berlinMinute = (d = new Date()) => { const t = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false }).format(d).split(":").map(Number); return t[0]! * 60 + t[1]!; };

async function yahoo(id: KerzenId): Promise<Tageskerze[]> {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(KERZEN[id].yahoo)}?range=15y&interval=1d&includePrePost=false`, { signal: AbortSignal.timeout(20_000), headers: { "user-agent": "Mozilla/5.0 (highstack)", accept: "application/json" } });
  if (!r.ok) throw new Error(`Yahoo ${KERZEN[id].name}: HTTP ${r.status}`);
  const k = leseYahooChart(await r.json()); if (k.length < 100) throw new Error(`Yahoo ${KERZEN[id].name}: keine verwertbaren Daten`);
  return k.slice(-4000);
}
async function stooq(id: KerzenId): Promise<Tageskerze[]> {
  const r = await fetch(`https://stooq.com/q/d/l/?s=${encodeURIComponent(KERZEN[id].stooq)}&i=d`, { signal: AbortSignal.timeout(20_000), headers: { "user-agent": "highstack" } });
  if (!r.ok) throw new Error(`Stooq ${KERZEN[id].name}: HTTP ${r.status}`);
  const k = leseKerzenCsv(await r.text()); if (k.length < 100) throw new Error(`Stooq ${KERZEN[id].name}: keine verwertbaren Daten`);
  return k.slice(-4000);
}
export async function kerzen(s: Speicher, id: KerzenId, erzwingen = false): Promise<Kerzensatz | null> {
  const alt = await s.globalEins<Kerzensatz>(ART, id);
  if (alt && !erzwingen && Date.now() - alt.am < ALTER) return alt;
  const fehler: string[] = [];
  for (const [name, f] of [["Yahoo Finance", yahoo], ["Stooq", stooq]] as const) {
    try { const k = await f(id); const neu: Kerzensatz = { id, am: Date.now(), quelle: name, kerzen: k }; await s.speichereGlobal(ART, id, neu); return neu; }
    catch (e) { fehler.push((e as Error).message); }
  }
  if (alt) return alt;
  throw new Error(`${fehler.join("; ")}. Alternativ die Tageskurse als CSV hochladen (Spalten Date, Open, High, Low, Close).`);
}
export async function hochladen(s: Speicher, id: KerzenId, csv: string) {
  const k = leseKerzenCsv(csv); if (k.length < 100) throw new Error(`Zu wenige Tage in der Datei (${k.length}); für den Rückblick braucht es mindestens 100, besser mehrere Jahre.`);
  const neu: Kerzensatz = { id, am: Date.now(), quelle: "Upload", kerzen: k.slice(-4000) }; await s.speichereGlobal(ART, id, neu); return neu;
}

export interface DaxStand {
  datum: string; daten: Record<KerzenId, { tage: number; bis: string | null; quelle: string | null; am: number | null } | { fehler: string }>;
  signal: ReturnType<typeof tagessignal> | null; rueckblick: DaxRueckblick | null; dax: number | null;
}
let rbCache: { schluessel: string; wert: DaxRueckblick | null } | null = null;

/** Signal für heute (oder `datum`) und Rückblick; `eroeffnung` aus Scalable-Kurs oder Eingabe */
export async function daxStand(s: Speicher, opts: { datum?: string; eroeffnung?: number | null; erzwingen?: boolean } = {}): Promise<DaxStand> {
  const datum = opts.datum ?? berlinDatum();
  const daten = {} as DaxStand["daten"]; const k = {} as Record<KerzenId, Tageskerze[]>;
  for (const id of Object.keys(KERZEN) as KerzenId[]) {
    try { const x = await kerzen(s, id, opts.erzwingen); k[id] = x?.kerzen ?? []; daten[id] = { tage: k[id].length, bis: k[id].at(-1)?.d ?? null, quelle: x?.quelle ?? null, am: x?.am ?? null }; }
    catch (e) { k[id] = []; daten[id] = { fehler: (e as Error).message }; }
  }
  const dax = k.dax.filter(x => x.d < datum);
  if (dax.length < 120) return { datum, daten, signal: null, rueckblick: null, dax: dax.at(-1)?.c ?? null };
  const schluessel = `${dax.at(-1)!.d}|${k.spx.at(-1)?.d}|${k.nikkei.at(-1)?.d}|${dax.length}`;
  if (rbCache?.schluessel !== schluessel) rbCache = { schluessel, wert: rueckblickDax(dax, k.spx.filter(x => x.d < datum), k.nikkei.filter(x => x.d < datum)) };
  const g = gewichte(lerntage(dax, k.spx.filter(x => x.d < datum), k.nikkei.filter(x => x.d < datum)));
  // Eröffnung heute: aus der Historie, wenn der Tag schon als Kerze vorliegt, sonst übergeben
  const heute = k.dax.find(x => x.d === datum);
  const m: Morgenlage = { datum, dax, spx: k.spx, nikkei: k.nikkei, eroeffnung: opts.eroeffnung ?? heute?.o ?? null };
  const termine = (await ereignisse(s)).filter(e => e.datum === datum && e.wichtig !== false && e.art !== "feiertag" && e.art !== "verfall").map(e => ({ titel: e.titel, zeit: e.zeit ?? null, wichtig: true }));
  return { datum, daten, signal: tagessignal(m, g, termine), rueckblick: rbCache.wert, dax: m.eroeffnung ?? dax.at(-1)!.c };
}
export { DAX_ISIN };
