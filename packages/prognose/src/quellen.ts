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

export interface Importfehler { zeile: number; inhalt: string; text: string }

/**
 * Eingefügte Tabelle oder CSV lesen und prüfen. Je Zeile: Datum in der ersten Spalte, Wert in der zweiten.
 * Trennzeichen je Zeile: Semikolon, Tabulator oder Komma. Versteht 2026-10-01, 01.10.2026, 2026-10 und 2026-Q3,
 * Komma oder Punkt als Dezimalzeichen; beim EZB-CSV TIME_PERIOD und OBS_VALUE.
 * Abgewiesen (mit Grund) werden: mehrdeutige Kommas, ungültige oder zukünftige Daten, Werte außerhalb der Grenzen.
 */
export function leseTabelle(text: string, opts: { grenzen?: [number, number]; heute?: string } = {}): { punkte: Punkt[]; fehler: Importfehler[] } {
  const heute = opts.heute ?? new Date().toISOString().slice(0, 10);
  const zeilen = text.split(/\r?\n/); const fehler: Importfehler[] = []; const out: Punkt[] = [];
  const trennerVon = (z: string) => (z.includes(";") ? ";" : z.includes("\t") ? "\t" : ",");
  const ersteZeile = zeilen.findIndex(z => z.trim());
  const kopf = ersteZeile >= 0 ? zeilen[ersteZeile]!.split(trennerVon(zeilen[ersteZeile]!)).map(x => x.replace(/"/g, "").trim()) : [];
  const iT = kopf.indexOf("TIME_PERIOD"), iV = kopf.indexOf("OBS_VALUE"); const ezb = iT >= 0 && iV >= 0;
  zeilen.forEach((roh, n) => {
    const z = roh.trim(); if (!z) return;
    const nr = n + 1; const fail = (t: string) => fehler.push({ zeile: nr, inhalt: z.slice(0, 80), text: t });
    const tr = ezb ? trennerVon(zeilen[ersteZeile]!) : trennerVon(z);
    const f = z.split(tr).map(x => x.replace(/"/g, "").trim());
    const dRoh = ezb ? f[iT] ?? "" : f[0] ?? ""; const d = datum(dRoh);
    if (!d) { if (n === ersteZeile) return; /* Kopfzeile */ return fail(datumFormatOk(dRoh) ? "Ungültiges Datum (Monat oder Tag gibt es nicht)." : "Kein Datum erkannt (z. B. 2026-10-01, 01.10.2026, 2026-10, 2026-Q3)."); }
    if (d > heute) return fail("Datum liegt in der Zukunft.");
    if (d < "1900-01-01") return fail("Datum vor 1900.");
    if (!ezb && tr === "," && f.length === 3 && /^-?\d+$/.test(f[1]!) && /^\d+$/.test(f[2]!)) return fail("Mehrdeutig: Komma als Trennzeichen und als Dezimalzeichen. Bitte Semikolon oder Tabulator als Trenner verwenden.");
    const wRoh = ezb ? f[iV] : f[1];
    if (wRoh === "." || wRoh === "" || wRoh == null) return; // fehlender Wert (FRED schreibt „.“): still überspringen
    const w = zahl(wRoh); if (w == null) return fail(`„${wRoh}“ ist keine Zahl.`);
    if (opts.grenzen && (w < opts.grenzen[0] || w > opts.grenzen[1])) return fail(`Wert ${w.toLocaleString("de-DE")} liegt außerhalb des plausiblen Bereichs (${opts.grenzen[0].toLocaleString("de-DE")} bis ${opts.grenzen[1].toLocaleString("de-DE")}).`);
    out.push({ d, w });
  });
  return { punkte: ordne(out), fehler };
}

/** Für den automatischen Abruf: nur die gültigen Punkte */
export const leseCsv = (text: string): Punkt[] => leseTabelle(text).punkte;

function gueltig(j: number, m: number, t: number) { const x = new Date(Date.UTC(j, m - 1, t)); return x.getUTCFullYear() === j && x.getUTCMonth() === m - 1 && x.getUTCDate() === t; }
const iso = (j: number, m: number, t: number) => `${j}-${String(m).padStart(2, "0")}-${String(t).padStart(2, "0")}`;
function datumFormatOk(s: string) { return /^\d{4}-\d{1,2}(-\d{1,2})?$|^\d{1,2}\.\d{1,2}\.\d{4}$/.test(s); }
function datum(s: string): string | null {
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/); if (m) { const [j, mo, t] = [Number(m[1]), Number(m[2]), Number(m[3])]; return gueltig(j, mo, t) ? iso(j, mo, t) : null; }
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); if (m) { const [t, mo, j] = [Number(m[1]), Number(m[2]), Number(m[3])]; return gueltig(j, mo, t) ? iso(j, mo, t) : null; }
  m = s.match(/^(\d{4})-(\d{1,2})$/); if (m) { const [j, mo] = [Number(m[1]), Number(m[2])]; return mo >= 1 && mo <= 12 ? iso(j, mo, 1) : null; }
  m = s.match(/^(\d{4})-?Q([1-4])$/i); if (m) return iso(Number(m[1]), (Number(m[2]) - 1) * 3 + 1, 1);
  return null;
}
function zahl(s: string | undefined): number | null {
  if (!s) return null; let t = s.replace(/\s/g, "");
  if (/e/i.test(t)) return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) || /^-?\d+,\d+$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, "");
  const v = Number(t); return t !== "" && Number.isFinite(v) ? v : null;
}
