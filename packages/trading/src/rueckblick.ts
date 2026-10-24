import { leererZustand, takt, trefferbilanz } from "./agent";
import { kuenstlicherTag, simBroker, type AlpacaZugang } from "./broker";
import type { Abschluss, AgentEinstellungen, Bar, Umfeld } from "./types";

/**
 * Rückblick (Backtest) für Trading-Agenten: Der unveränderte Agent handelt Tag für Tag und Minute für Minute
 * auf historischen Kursen. Jeder Takt sieht nur die Kerzen bis zur aktuellen Minute (kein Blick in die Zukunft).
 * Kennzahlen wie im Kapitalmarkt-Mastermodell: CAGR, Sharpe, Sortino, maximaler Verlust, Calmar, Trefferquote,
 * Gewinnfaktor, Umschlag, Erholungszeit, CVaR; Vergleich mit Buy & Hold und „Kurs über 200-Tage-Linie“.
 */
export interface Historie {
  /** Handelstage aufsteigend (YYYY-MM-DD) */
  tage: string[];
  /** je Tag und Wert genau 390 Minutenkerzen (9:30 bis 16:00 New York), Lücken vorwärts aufgefüllt */
  bars: Record<string, Record<string, Bar[]>>;
  quelle: "alpaca" | "simulation";
  waehrung: string;
}

export interface Kennzahlen {
  tage: number; endwert: number; rendite: number; cagr: number | null; sharpe: number | null; sortino: number | null;
  maxVerlust: number; calmar: number | null; erholungTage: number; cvar5: number | null;
  trades: number; trefferquote: number | null; gewinnfaktor: number | null; mittelR: number | null; umschlag: number | null;
}
export interface Rueckblickergebnis {
  von: string; bis: string; quelle: Historie["quelle"]; waehrung: string;
  kurve: { datum: string; wert: number }[];
  kennzahlen: Kennzahlen;
  vergleich: { name: string; kurve: { datum: string; wert: number }[]; kennzahlen: Kennzahlen }[];
  abschluesse: Abschluss[];
  hinweise: string[];
}

const mittel = (x: number[]) => (x.length ? x.reduce((a, b) => a + b, 0) / x.length : 0);
const std = (x: number[]) => { if (x.length < 2) return 0; const m = mittel(x); return Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / (x.length - 1)); };
const r4 = (v: number) => Math.round(v * 10000) / 10000;

export function kennzahlen(kurve: { datum: string; wert: number }[], start: number, abschluesse: Abschluss[] = []): Kennzahlen {
  const werte = [start, ...kurve.map(k => k.wert)]; const r = werte.slice(1).map((w, i) => w / werte[i]! - 1);
  const n = kurve.length; const ende = werte.at(-1)!; const rendite = ende / start - 1;
  const cagr = n >= 20 && ende > 0 ? Math.pow(ende / start, 252 / n) - 1 : null;
  const s = std(r); const unten = Math.sqrt(mittel(r.map(x => Math.min(0, x) ** 2)));
  let hoch = start, dd = 0, unterWasser = 0, laengste = 0;
  for (const w of werte) { if (w >= hoch) { hoch = w; unterWasser = 0; } else { unterWasser++; laengste = Math.max(laengste, unterWasser); dd = Math.min(dd, w / hoch - 1); } }
  const sortiert = [...r].sort((a, b) => a - b); const k = Math.max(1, Math.floor(r.length * 0.05));
  const t = trefferbilanz(abschluesse).gesamt;
  const volumen = abschluesse.reduce((a, x) => a + 2 * Math.abs(x.qty * x.einstieg), 0);
  return {
    tage: n, endwert: Math.round(ende * 100) / 100, rendite: r4(rendite), cagr: cagr == null ? null : r4(cagr),
    sharpe: s > 0 ? Math.round((mittel(r) / s) * Math.sqrt(252) * 100) / 100 : null,
    sortino: unten > 0 ? Math.round((mittel(r) / unten) * Math.sqrt(252) * 100) / 100 : null,
    maxVerlust: r4(dd), calmar: cagr != null && dd < 0 ? Math.round((cagr / -dd) * 100) / 100 : null, erholungTage: laengste,
    cvar5: r.length >= 20 ? r4(mittel(sortiert.slice(0, k))) : null,
    trades: t.n, trefferquote: t.trefferquote, gewinnfaktor: t.gewinnfaktor, mittelR: t.mittelR,
    umschlag: n ? Math.round((volumen / mittel(werte)) * (252 / n) * 10) / 10 : null,
  };
}

/** Buy & Hold: Startkapital am ersten Tag zur Eröffnung gleich verteilt kaufen, zum Schlusskurs bewerten */
export function kaufenHalten(h: Historie, symbole: string[], start: number) {
  const s = symbole.filter(x => h.tage.every(d => h.bars[d]?.[x]?.length)); if (!s.length) return null;
  const erster = h.tage[0]!; const stueck = Object.fromEntries(s.map(x => [x, start / s.length / h.bars[erster]![x]![0]!.o]));
  return h.tage.map(d => ({ datum: d, wert: Math.round(s.reduce((a, x) => a + stueck[x]! * h.bars[d]![x]!.at(-1)!.c, 0) * 100) / 100 }));
}

/** Trendregel: investiert (Buy & Hold) nur an Tagen, an denen der Vortagesschluss über dem Durchschnitt der letzten n Tage liegt */
export function trendRegel(h: Historie, symbol: string, start: number, n = 200) {
  const tage = h.tage.filter(d => h.bars[d]?.[symbol]?.length); if (tage.length <= n) return null;
  const schluss = tage.map(d => h.bars[d]![symbol]!.at(-1)!.c); let wert = start; const kurve: { datum: string; wert: number }[] = [];
  for (let i = n; i < tage.length; i++) {
    const sma = mittel(schluss.slice(i - n, i)); const drin = schluss[i - 1]! > sma;
    if (drin) wert *= schluss[i]! / schluss[i - 1]!;
    kurve.push({ datum: tage[i]!, wert: Math.round(wert * 100) / 100 });
  }
  return kurve;
}

/**
 * Rückblick rechnen. Vorschlags-Agenten werden wie Automatik gerechnet (jeder Vorschlag gilt als bestätigt).
 * `umfeld` liefert je Tag das damalige Marktumfeld (aus den Konjunkturdaten), sonst ohne.
 */
export async function rueckblickTrading(e: AgentEinstellungen, h: Historie, opts: { umfeld?: (datum: string) => Umfeld | undefined; benchmark?: string } = {}): Promise<Rueckblickergebnis> {
  const ee: AgentEinstellungen = { ...e, modus: "auto", broker: "simulation" };
  const z = leererZustand(); z.aktiv = true; z.simUhr = { datum: h.tage[0]!, minute: 0 };
  const b = simBroker(z, e.startkapital, { quelle: (s, d) => h.bars[d]?.[s] ?? [], waehrung: h.waehrung });
  const kurve: { datum: string; wert: number }[] = [];
  for (const d of h.tage) {
    // die Uhr-Instanz bleibt dieselbe, der Broker liest sie bei jedem Takt
    z.simUhr!.datum = d; z.simUhr!.minute = 0; const u = opts.umfeld?.(d);
    for (let m = 0; m <= 390; m++) { z.simUhr.minute = m; await takt(ee, z, b, new Date(), u); }
    kurve.push({ datum: d, wert: (await b.konto()).equity });
  }
  const hinweise: string[] = [];
  if (h.quelle === "simulation") hinweise.push("Künstliche Kurse: zeigt, ob die Regeln technisch greifen, sagt aber nichts über echte Märkte.");
  if (h.tage.length < 60) hinweise.push(`Nur ${h.tage.length} Handelstage: Ergebnisse unter etwa 100 Trades und 6 Monaten sind weitgehend Zufall.`);
  hinweise.push("Kosten: Spanne 0,05 % je Seite eingerechnet; Gebühren, Steuern und Teilausführungen nicht.");
  const vergleich: Rueckblickergebnis["vergleich"] = [];
  const bm = opts.benchmark && h.tage.every(d => h.bars[d]?.[opts.benchmark!]?.length) ? opts.benchmark : null;
  const kh = kaufenHalten(h, bm ? [bm] : e.symbole, e.startkapital); if (kh) vergleich.push({ name: `Kaufen und halten (${bm ?? "gleich gewichtet"})`, kurve: kh, kennzahlen: kennzahlen(kh, e.startkapital) });
  const tr = bm ? trendRegel(h, bm, e.startkapital) : null;
  if (tr) vergleich.push({ name: `${bm} nur über der 200-Tage-Linie`, kurve: tr, kennzahlen: kennzahlen(tr, e.startkapital) });
  else hinweise.push("Vergleich „Kurs über 200-Tage-Linie“ braucht mehr als 200 Handelstage mit Vergleichswert.");
  return { von: h.tage[0]!, bis: h.tage.at(-1)!, quelle: h.quelle, waehrung: h.waehrung, kurve, kennzahlen: kennzahlen(kurve, e.startkapital, z.abschluesse ?? []), vergleich, abschluesse: (z.abschluesse ?? []).slice(0, 200), hinweise };
}

// ---------- Daten ----------
/** Werktage zwischen zwei Daten (ohne Feiertage) */
export function werktage(von: string, bis: string): string[] {
  const out: string[] = []; const d = new Date(von + "T12:00:00Z"); const e = new Date(bis + "T12:00:00Z");
  while (d <= e) { if (![0, 6].includes(d.getUTCDay())) out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}

/** Künstliche Historie (ohne Datenzugang): dieselben Kurse wie die Simulation */
export function kuenstlicheHistorie(symbole: string[], von: string, bis: string): Historie {
  const tage = werktage(von, bis); const bars: Historie["bars"] = {};
  // Tage aneinanderreihen: jeder Tag beginnt beim Schlusskurs des Vortags (wie an der Börse, ohne Kurslücke)
  const letzter: Record<string, number> = {};
  for (const d of tage) bars[d] = Object.fromEntries(symbole.map(s => {
    const roh = kuenstlicherTag(s, d); const f = letzter[s] ? letzter[s]! / roh[0]!.o : 1; const r = (v: number) => Math.round(v * f * 100) / 100;
    const l = roh.map(b => ({ ...b, o: r(b.o), h: r(b.h), l: r(b.l), c: r(b.c) })); letzter[s] = l.at(-1)!.c; return [s, l];
  }));
  return { tage, bars, quelle: "simulation", waehrung: "EUR" };
}

/** Minute seit 9:30 New York für einen UTC-Zeitstempel */
export function minuteNY(t: string): { datum: string; minute: number } {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(t)).map(x => [x.type, x.value]));
  return { datum: `${p.year}-${p.month}-${p.day}`, minute: (Number(p.hour) % 24) * 60 + Number(p.minute) - 570 };
}

/** Rohe Minutenkerzen je Wert in Tage mit genau 390 Minuten ordnen; Lücken mit dem letzten Kurs (Volumen 0) füllen */
export function aufbereiten(roh: Record<string, Bar[]>, waehrung = "USD"): Historie {
  const bars: Historie["bars"] = {};
  for (const [s, liste] of Object.entries(roh)) for (const b of liste) {
    const { datum, minute } = minuteNY(b.t); if (minute < 0 || minute >= 390) continue;
    ((bars[datum] ??= {})[s] ??= new Array<Bar>(390))[minute] = b;
  }
  const tage = Object.keys(bars).sort();
  for (const d of tage) for (const s of Object.keys(bars[d]!)) {
    const l = bars[d]![s]!; let letzte: Bar | undefined = undefined;
    const erste = l.find(Boolean); if (!erste) { delete bars[d]![s]; continue; }
    for (let i = 0; i < 390; i++) { if (l[i]) letzte = l[i]; else { const k = (letzte ?? erste).c; l[i] = { t: "", o: k, h: k, l: k, c: k, v: 0 }; } }
  }
  // nur Tage, an denen alle Werte Kurse haben (halbe Handelstage und Lücken fallen heraus)
  const alle = Object.keys(roh); const voll = tage.filter(d => alle.every(s => bars[d]?.[s]?.length === 390) && bars[d]![alle[0]!]!.filter(b => b.v > 0).length > 300);
  return { tage: voll, bars: Object.fromEntries(voll.map(d => [d, bars[d]!])), quelle: "alpaca", waehrung };
}

/** Historische Minutenkerzen über die Alpaca-Daten-API (kostenloses Konto genügt; historische SIP-Daten, sonst IEX) */
export async function alpacaHistorie(zugang: AlpacaZugang, symbole: string[], von: string, bis: string, holen: typeof fetch = fetch): Promise<Historie> {
  const kopf = { "APCA-API-KEY-ID": zugang.keyId, "APCA-API-SECRET-KEY": zugang.secret };
  const lade = async (feed: "sip" | "iex") => {
    const aus: Record<string, Bar[]> = Object.fromEntries(symbole.map(s => [s, []])); let token: string | null = null; let seiten = 0;
    do {
      const q = new URLSearchParams({ symbols: symbole.join(","), timeframe: "1Min", start: `${von}T13:00:00Z`, end: `${bis}T21:00:00Z`, feed, limit: "10000", adjustment: "split", ...(token ? { page_token: token } : {}) });
      const r = await holen(`https://data.alpaca.markets/v2/stocks/bars?${q}`, { headers: kopf });
      if (!r.ok) { const t = await r.text().catch(() => ""); throw Object.assign(new Error(`Alpaca-Daten ${r.status}: ${t.slice(0, 160)}`), { status: r.status }); }
      const j = (await r.json()) as { bars?: Record<string, Bar[]>; next_page_token: string | null };
      for (const [s, l] of Object.entries(j.bars ?? {})) aus[s] = [...(aus[s] ?? []), ...l.map(b => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v }))];
      token = j.next_page_token; if (++seiten > 200) throw new Error("Zu viele Datenseiten: Zeitraum oder Zahl der Werte verkleinern.");
    } while (token);
    return aus;
  };
  let roh: Record<string, Bar[]>;
  try { roh = await lade("sip"); } catch (e) { if ((e as { status?: number }).status === 403 || (e as { status?: number }).status === 422) roh = await lade("iex"); else throw e; }
  return aufbereiten(roh, "USD");
}
