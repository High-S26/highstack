import type { Agentzustand, Ausfuehrung, Bar, BrokerArt, Konto, OrderAntrag, Position } from "./types";

/**
 * Broker-Schnittstelle. Jeder Broker ist ein austauschbarer Baustein; der Agent kennt nur diese Methoden.
 * Neu anschließbar: Interactive Brokers (Web API), Krypto-Börsen. Apps ohne Schnittstelle
 * (Trade Republic, Scalable) laufen als „manuell“: Order-Zettel, Ausführung und Bestätigung durch Sie.
 */
export interface Uhr { offen: boolean; minutenBisSchluss: number; minutenSeitOeffnung: number; datum: string; zeit: string }
export interface Broker {
  art: BrokerArt;
  /** true: Orders gehen nicht automatisch raus, sondern werden als Zettel vorgelegt */
  nurZettel: boolean;
  bruchstuecke: boolean;
  uhr(): Promise<Uhr>;
  konto(): Promise<Konto>;
  positionen(): Promise<Position[]>;
  /** Minutenkerzen des laufenden Handelstags */
  bars(symbole: string[]): Promise<Record<string, Bar[]>>;
  sende(a: OrderAntrag): Promise<Ausfuehrung>;
  schliesseAlle(grund: string): Promise<Ausfuehrung[]>;
}

const id = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** US-Handelszeit (NYSE 9:30 bis 16:00 New York), Feiertage nicht berücksichtigt */
export function usUhr(jetzt: Date): Uhr {
  const teile = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false }).formatToParts(jetzt).map(p => [p.type, p.value]));
  const min = Number(teile.hour) % 24 * 60 + Number(teile.minute); const werktag = !["Sat", "Sun"].includes(teile.weekday!);
  const auf = 9 * 60 + 30, zu = 16 * 60;
  return { offen: werktag && min >= auf && min < zu, minutenBisSchluss: zu - min, minutenSeitOeffnung: min - auf, datum: `${teile.year}-${teile.month}-${teile.day}`, zeit: `${teile.hour}:${teile.minute} New York` };
}

// ---------- Simulation: künstliche Kurse, ein Handelstag im Zeitraffer ----------
function zufall(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hash = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
/** Künstlicher Handelstag: zufällige Bewegung mit gelegentlichen Sprüngen, reproduzierbar je Symbol und Tag */
export function kuenstlicherTag(symbol: string, datum: string, minuten = 390): Bar[] {
  const r = zufall(hash(symbol + datum)); const n = () => Math.sqrt(-2 * Math.log(Math.max(1e-12, r()))) * Math.cos(2 * Math.PI * r());
  let p = 20 + (hash(symbol) % 380); const trend = (r() - 0.5) * 0.0004; const bars: Bar[] = [];
  const basisVol = 2000 + (hash(symbol) % 8000);
  for (let i = 0; i < minuten; i++) {
    const sprung = r() < 0.012 ? (r() < 0.5 ? -1 : 1) * (0.006 + r() * 0.012) : 0;
    const o = p; const c = Math.max(1, o * (1 + trend + n() * 0.0016 + sprung));
    const h = Math.max(o, c) * (1 + Math.abs(n()) * 0.0006); const l = Math.min(o, c) * (1 - Math.abs(n()) * 0.0006);
    const v = Math.round(basisVol * Math.exp(n() * 0.35) * (i < 20 || i > 370 ? 2.2 : 1) * (sprung ? 4 + r() * 4 : 1));
    const t = new Date(Date.UTC(2000, 0, 1, 14, 30 + i)).toISOString();
    bars.push({ t, o: rd(o), h: rd(h), l: rd(l), c: rd(c), v }); p = c;
  }
  return bars;
}
const rd = (v: number) => Math.round(v * 100) / 100;

/**
 * Simulation: künstliche Kurse oder, für den Rückblick, echte historische Minutenkerzen (`quelle`).
 * Die Uhr läuft in z.simUhr; jeder Takt sieht nur die Kerzen bis zur aktuellen Minute.
 */
export function simBroker(z: Agentzustand, startkapital: number, opts: { quelle?: (symbol: string, datum: string) => Bar[]; waehrung?: string } = {}): Broker {
  z.sim ??= { cash: startkapital, positionen: {} };
  const uhr = z.simUhr ??= { datum: new Date().toISOString().slice(0, 10), minute: 0 };
  const quelle = opts.quelle ?? kuenstlicherTag;
  const tag = (s: string) => quelle(s, uhr.datum).slice(0, Math.max(1, uhr.minute + 1));
  const kurs = (s: string) => { const k = tag(s).at(-1)?.c; if (k == null) throw new Error(`Keine Kurse für ${s} am ${uhr.datum}`); return k; };
  const positionen = async (): Promise<Position[]> => Object.entries(z.sim!.positionen).filter(([, p]) => p.qty !== 0).map(([s, p]) => { const k = kurs(s); return { symbol: s, qty: p.qty, einstand: p.einstand, kurs: k, wert: p.qty * k, gv: (k - p.einstand) * p.qty }; });
  const sende = async (a: OrderAntrag): Promise<Ausfuehrung> => {
    // Stopp-Ausstieg zum Stopp-Kurs (wie eine Stopp-Order), bei einer Kurslücke darüber hinaus zum Eröffnungskurs der Minute
    const b0 = tag(a.symbol).at(-1)!; const roh = a.stoppKurs == null ? kurs(a.symbol) : a.seite === "verkauf" ? (b0.o < a.stoppKurs ? b0.o : Math.min(a.stoppKurs, b0.h)) : (b0.o > a.stoppKurs ? b0.o : Math.max(a.stoppKurs, b0.l));
    const k = rd(roh * (a.seite === "kauf" ? 1.0005 : 0.9995)); const delta = a.seite === "kauf" ? a.qty : -a.qty;
    const p = z.sim!.positionen[a.symbol] ?? { qty: 0, einstand: 0 }; const neu = p.qty + delta;
    if (a.seite === "kauf" && p.qty >= 0 && a.qty * k > z.sim!.cash + 1e-6) return { id: id(), symbol: a.symbol, seite: a.seite, qty: a.qty, preis: null, status: "abgelehnt", meldung: "Nicht genug Guthaben", zeit: `Minute ${uhr.minute}` };
    z.sim!.cash -= delta * k;
    z.sim!.positionen[a.symbol] = { qty: Math.round(neu * 1e6) / 1e6, einstand: Math.abs(neu) < 1e-9 ? 0 : (Math.sign(neu) === Math.sign(p.qty) || p.qty === 0) && Math.abs(neu) > Math.abs(p.qty) ? (p.einstand * p.qty + k * delta) / neu : p.einstand };
    if (Math.abs(neu) < 1e-9) delete z.sim!.positionen[a.symbol];
    return { id: id(), symbol: a.symbol, seite: a.seite, qty: a.qty, preis: rd(k), status: "ausgefuehrt", zeit: `Minute ${uhr.minute}` };
  };
  return {
    art: "simulation", nurZettel: false, bruchstuecke: true,
    async uhr() { const m = uhr.minute; const s = 9 * 60 + 30 + m; return { offen: m < 390, minutenBisSchluss: 390 - m, minutenSeitOeffnung: m, datum: uhr.datum, zeit: `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")} (Simulation)` }; },
    async konto() { const pos = await positionen(); const equity = z.sim!.cash + pos.reduce((a, p) => a + p.wert, 0); return { equity: rd(equity), cash: rd(z.sim!.cash), waehrung: opts.waehrung ?? "EUR" }; },
    positionen,
    async bars(symbole) { return Object.fromEntries(symbole.map(s => [s, opts.quelle ? (quelle(s, uhr.datum).length ? tag(s) : []) : tag(s)])); },
    sende,
    async schliesseAlle() { const pos = await positionen(); const r: Ausfuehrung[] = []; for (const p of pos) r.push(await sende({ symbol: p.symbol, seite: p.qty > 0 ? "verkauf" : "kauf", qty: Math.abs(p.qty), grund: "alle schließen" })); return r; },
  };
}
/** Simulation eine Minute weiterdrehen; nach Handelsschluss beginnt der nächste Werktag */
export function simWeiter(z: Agentzustand) {
  const u = z.simUhr; if (!u) return;
  if (u.minute < 390) { u.minute++; return; }
  const d = new Date(u.datum + "T12:00:00Z"); do d.setUTCDate(d.getUTCDate() + 1); while ([0, 6].includes(d.getUTCDay()));
  u.datum = d.toISOString().slice(0, 10); u.minute = 0;
}

// ---------- Alpaca (Paper oder Live) ----------
export interface AlpacaZugang { keyId: string; secret: string }
export function alpacaBroker(zugang: AlpacaZugang, live = false, holen: typeof fetch = fetch): Broker {
  const basis = live ? "https://api.alpaca.markets" : "https://paper-api.alpaca.markets"; const daten = "https://data.alpaca.markets";
  const kopf = { "APCA-API-KEY-ID": zugang.keyId, "APCA-API-SECRET-KEY": zugang.secret, "content-type": "application/json" };
  const rufe = async <T>(url: string, init?: RequestInit): Promise<T> => {
    const r = await holen(url, { ...init, headers: { ...kopf, ...(init?.headers ?? {}) } });
    if (!r.ok) { const t = await r.text().catch(() => ""); throw new Error(`Alpaca ${r.status}: ${t.slice(0, 200)}`); }
    return r.status === 204 ? (undefined as T) : (await r.json()) as T;
  };
  const zuPos = (p: { symbol: string; qty: string; avg_entry_price: string; current_price: string; market_value: string; unrealized_pl: string }): Position => ({ symbol: p.symbol, qty: Number(p.qty), einstand: Number(p.avg_entry_price), kurs: Number(p.current_price), wert: Number(p.market_value), gv: Number(p.unrealized_pl) });
  type AOrder = { id: string; symbol: string; side: "buy" | "sell"; qty: string; filled_avg_price: string | null; status: string; submitted_at: string };
  const zuAusf = (o: AOrder): Ausfuehrung => ({ id: o.id, symbol: o.symbol, seite: o.side === "buy" ? "kauf" : "verkauf", qty: Number(o.qty), preis: o.filled_avg_price ? Number(o.filled_avg_price) : null, status: o.status === "filled" ? "ausgefuehrt" : ["rejected", "canceled", "expired"].includes(o.status) ? "abgelehnt" : "offen", meldung: o.status, zeit: o.submitted_at });
  return {
    art: live ? "alpaca-live" : "alpaca-paper", nurZettel: false, bruchstuecke: true,
    async uhr() { const c = await rufe<{ is_open: boolean; next_close: string; timestamp: string }>(`${basis}/v2/clock`); const u = usUhr(new Date(c.timestamp)); return { ...u, offen: c.is_open, minutenBisSchluss: c.is_open ? Math.round((Date.parse(c.next_close) - Date.parse(c.timestamp)) / 60000) : u.minutenBisSchluss }; },
    async konto() { const a = await rufe<{ equity: string; cash: string; currency: string }>(`${basis}/v2/account`); return { equity: Number(a.equity), cash: Number(a.cash), waehrung: a.currency }; },
    async positionen() { return (await rufe<Parameters<typeof zuPos>[0][]>(`${basis}/v2/positions`)).map(zuPos); },
    async bars(symbole) {
      const u = usUhr(new Date()); const start = new Date(Date.now() - Math.max(0, u.minutenSeitOeffnung) * 60000).toISOString();
      const aus: Record<string, Bar[]> = Object.fromEntries(symbole.map(s => [s, []])); let token: string | null = null;
      do {
        const q = new URLSearchParams({ symbols: symbole.join(","), timeframe: "1Min", start, feed: "iex", limit: "10000", ...(token ? { page_token: token } : {}) });
        const r: { bars: Record<string, { t: string; o: number; h: number; l: number; c: number; v: number }[]>; next_page_token: string | null } = await rufe(`${daten}/v2/stocks/bars?${q}`);
        for (const [s, l] of Object.entries(r.bars ?? {})) aus[s] = [...(aus[s] ?? []), ...l.map(b => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v }))];
        token = r.next_page_token;
      } while (token);
      return aus;
    },
    async sende(a) {
      const o = await rufe<AOrder>(`${basis}/v2/orders`, { method: "POST", body: JSON.stringify({ symbol: a.symbol, qty: String(a.qty), side: a.seite === "kauf" ? "buy" : "sell", type: "market", time_in_force: "day", client_order_id: `hs-${id()}` }) });
      // kurz auf die Ausführung warten
      for (let i = 0; i < 5 && o.status !== "filled"; i++) { await new Promise(r => setTimeout(r, 600)); Object.assign(o, await rufe<AOrder>(`${basis}/v2/orders/${o.id}`)); }
      return zuAusf(o);
    },
    async schliesseAlle() { await rufe(`${basis}/v2/orders`, { method: "DELETE" }); const r = await rufe<{ body?: AOrder }[]>(`${basis}/v2/positions?cancel_orders=true`, { method: "DELETE" }); return (r ?? []).filter(x => x.body).map(x => zuAusf(x.body!)); },
  };
}

// ---------- Manuell: App ohne Schnittstelle (Trade Republic, Scalable …) ----------
/** Marktdaten kommen aus einer Datenquelle (z. B. Alpaca-Daten), Orders werden als Zettel vorgelegt und von Ihnen bestätigt */
export function manuellerBroker(z: Agentzustand, startkapital: number, daten: Pick<Broker, "bars"> | null, uhrQuelle: () => Promise<Uhr> = async () => usUhr(new Date())): Broker {
  z.manuell ??= { cash: startkapital, positionen: {} };
  const kurse = async (s: string[]) => { if (!daten) return {} as Record<string, number>; const b = await daten.bars(s); return Object.fromEntries(Object.entries(b).map(([k, l]) => [k, l.at(-1)?.c ?? 0])); };
  return {
    art: "manuell", nurZettel: true, bruchstuecke: false,
    uhr: uhrQuelle,
    async konto() { const pos = await this.positionen(); return { equity: rd(z.manuell!.cash + pos.reduce((a, p) => a + p.wert, 0)), cash: rd(z.manuell!.cash), waehrung: "EUR" }; },
    async positionen() { const e = Object.entries(z.manuell!.positionen); const k = await kurse(e.map(([s]) => s)); return e.map(([s, p]) => { const kurs = k[s] || p.einstand; return { symbol: s, qty: p.qty, einstand: p.einstand, kurs, wert: p.qty * kurs, gv: (kurs - p.einstand) * p.qty }; }); },
    async bars(s) { if (!daten) throw new Error("Für Marktdaten bitte einen Datenzugang (Alpaca, kostenlos) hinterlegen."); return daten.bars(s); },
    async sende(a) { return { id: id(), symbol: a.symbol, seite: a.seite, qty: a.qty, preis: null, status: "offen", meldung: "als Zettel vorgelegt", zeit: new Date().toISOString() }; },
    async schliesseAlle() { return Object.entries(z.manuell!.positionen).map(([s, p]) => ({ id: id(), symbol: s, seite: p.qty > 0 ? "verkauf" as const : "kauf" as const, qty: Math.abs(p.qty), preis: null, status: "offen" as const, meldung: "als Zettel vorgelegt", zeit: new Date().toISOString() })); },
  };
}
/** Bestätigte Ausführung eines Zettels in den manuellen Bestand buchen */
export function bucheManuell(z: Agentzustand, symbol: string, seite: "kauf" | "verkauf", qty: number, preis: number) {
  const m = z.manuell!; const p = m.positionen[symbol] ?? { qty: 0, einstand: 0 }; const d = seite === "kauf" ? qty : -qty; const neu = p.qty + d;
  m.cash -= d * preis;
  if (Math.abs(neu) < 1e-9) delete m.positionen[symbol]; else m.positionen[symbol] = { qty: neu, einstand: Math.abs(neu) > Math.abs(p.qty) ? (p.einstand * p.qty + preis * d) / neu : p.einstand };
}
