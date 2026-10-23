import { INDIKATOREN, ordne, vorjahr } from "./indikatoren";
import type { Punkt } from "./types";

/**
 * Abruf frei verfügbarer Reihen: FRED mit kostenlosem Schlüssel (FRED_API_KEY) über die API,
 * sonst über den öffentlichen CSV-Export; das EZB-Datenportal braucht keinen Schlüssel. Alles andere pflegt der Admin per Import.
 */
export async function abrufen(id: string, opts: { fredKey?: string; seit?: string; fetcher?: typeof fetch } = {}): Promise<Punkt[]> {
  const ind = INDIKATOREN.find(i => i.id === id); if (!ind) throw new Error(`Unbekannter Indikator ${id}`);
  const f = opts.fetcher ?? fetch; const seit = opts.seit ?? "2000-01-01";
  let punkte: Punkt[];
  if (ind.quelle.art === "fred") {
    const start = ind.umrechnung === "vorjahr" ? "1999-01-01" : seit;
    if (!opts.fredKey) {
      // ohne Schlüssel: öffentlicher CSV-Export der FRED-Grafik
      const r = await f(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${ind.quelle.serie}&cosd=${start}`); if (!r.ok) throw new Error(`FRED ${ind.quelle.serie}: HTTP ${r.status}`);
      punkte = leseCsv(await r.text());
    } else {
    const u = `https://api.stlouisfed.org/fred/series/observations?series_id=${ind.quelle.serie}&api_key=${opts.fredKey}&file_type=json&observation_start=${ind.umrechnung === "vorjahr" ? "1999-01-01" : seit}`;
    const r = await f(u); if (!r.ok) throw new Error(`FRED ${ind.quelle.serie}: HTTP ${r.status}`);
    const j = (await r.json()) as { observations?: { date: string; value: string }[] };
    punkte = (j.observations ?? []).filter(o => o.value !== ".").map(o => ({ d: o.date, w: Number(o.value) }));
    }
  } else if (ind.quelle.art === "ezb") {
    const [fluss, schluessel] = ind.quelle.serie!.split("/");
    const r = await f(`https://data-api.ecb.europa.eu/service/data/${fluss}/${schluessel}?format=csvdata&startPeriod=${seit.slice(0, 7)}`); if (!r.ok) throw new Error(`EZB ${ind.quelle.serie}: HTTP ${r.status}`);
    punkte = leseCsv(await r.text());
  } else throw new Error(`${ind.name} wird im Admin-Bereich gepflegt (${ind.quelle.text}).`);
  const o = ordne(punkte);
  return ind.umrechnung === "vorjahr" ? vorjahr(o).filter(p => p.d >= seit) : o;
}

/**
 * CSV oder eingefügte Tabelle lesen: erste Spalte Datum, letzte Zahl der Zeile als Wert.
 * Versteht 2026-10-01, 01.10.2026, 2026-10 und 2026-Q3, Komma oder Punkt als Dezimalzeichen.
 * Beim EZB-CSV werden TIME_PERIOD und OBS_VALUE erkannt.
 */
export function leseCsv(text: string): Punkt[] {
  const zeilen = text.split(/\r?\n/).map(z => z.trim()).filter(Boolean); if (!zeilen.length) return [];
  const trenner = zeilen[0]!.includes(";") ? ";" : zeilen[0]!.includes("\t") ? "\t" : ",";
  const kopf = zeilen[0]!.split(trenner).map(x => x.replace(/"/g, "").trim());
  const iT = kopf.indexOf("TIME_PERIOD"), iV = kopf.indexOf("OBS_VALUE");
  const out: Punkt[] = [];
  for (const z of zeilen) {
    const f = z.split(trenner).map(x => x.replace(/"/g, "").trim());
    const roh = iT >= 0 ? f[iT] : f[0]; const d = datum(roh ?? ""); if (!d) continue;
    const kand = iV >= 0 ? [f[iV]] : f.slice(1).reverse();
    const w = kand.map(zahl).find(x => x != null); if (w != null) out.push({ d, w });
  }
  return ordne(out);
}
function datum(s: string): string | null {
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  m = s.match(/^(\d{4})-(\d{2})$/); if (m) return `${m[1]}-${m[2]}-01`;
  m = s.match(/^(\d{4})-?Q([1-4])$/i); if (m) return `${m[1]}-${String((Number(m[2]) - 1) * 3 + 1).padStart(2, "0")}-01`;
  return null;
}
function zahl(s: string | undefined): number | null {
  if (!s) return null; let t = s.replace(/\s/g, "");
  if (/^-?[\d.]+,\d+$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  const v = Number(t); return t !== "" && Number.isFinite(v) ? v : null;
}
