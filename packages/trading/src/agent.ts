import type { Broker } from "./broker";
import { STRATEGIEN } from "./strategien";
import type { AgentEinstellungen, Agentzustand, Gefuehrt, Logeintrag, OrderAntrag, Signal, StrategieWerte, Vorschlag } from "./types";

/**
 * Ein Takt des Agenten (jede Minute während der Handelszeit):
 * Tagesstand prüfen (Ziel, Verlustlimit, Schlusszeit), geführte Positionen gegen Stopp und Ziel prüfen,
 * dann neue Signale suchen. Der Risikomanager hat immer Vorrang vor der Strategie.
 */
export const leererZustand = (): Agentzustand => ({ aktiv: false, tag: null, verlauf: [], gefuehrt: [], vorschlaege: [], log: [], letzterTakt: null });
const vid = () => `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const eur = (v: number) => `${v.toLocaleString("de-DE", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

export function protokoll(z: Agentzustand, art: Logeintrag["art"], text: string, zeit: string) {
  z.log.unshift({ zeit, art, text }); if (z.log.length > 400) z.log.length = 400;
}

/** Stückzahl aus Risiko je Trade, begrenzt durch Positionsgröße und Guthaben */
export function stueckzahl(e: AgentEinstellungen, s: Signal, equity: number, cash: number, bruchstuecke: boolean): number {
  const risikoJeStueck = Math.abs(s.kurs - s.stopp); if (risikoJeStueck <= 0 || s.kurs <= 0) return 0;
  const nachRisiko = (equity * e.risikoProTrade) / risikoJeStueck;
  const nachGroesse = (equity * e.maxPosition) / s.kurs;
  const nachGeld = (s.richtung === "long" ? cash : equity * e.maxPosition) / s.kurs;
  const q = Math.max(0, Math.min(nachRisiko, nachGroesse, nachGeld));
  return bruchstuecke && s.richtung === "long" ? Math.floor(q * 1000) / 1000 : Math.floor(q);
}

export interface Taktergebnis { gehandelt: number; vorgeschlagen: number; status: string }

export async function takt(e: AgentEinstellungen, z: Agentzustand, b: Broker, jetzt = new Date()): Promise<Taktergebnis> {
  const erg: Taktergebnis = { gehandelt: 0, vorgeschlagen: 0, status: "" };
  const uhr = await b.uhr(); const zeit = uhr.zeit; z.letzterTakt = jetzt.toISOString();
  const log = (art: Logeintrag["art"], text: string) => protokoll(z, art, text, zeit);

  if (!uhr.offen) {
    if (z.tag && z.tag.status === "laeuft") { z.tag.ende = (await b.konto()).equity; z.tag.status = "beendet"; log("info", `Handelstag beendet: ${eur(z.tag.ende - z.tag.start)} €`); }
    erg.status = "Markt geschlossen"; return erg;
  }
  // Neuer Handelstag
  if (!z.tag || z.tag.datum !== uhr.datum) {
    if (z.tag) { if (z.tag.ende == null) z.tag.ende = (await b.konto()).equity; z.verlauf.unshift(z.tag); z.verlauf = z.verlauf.slice(0, 250); }
    const k = await b.konto(); z.tag = { datum: uhr.datum, start: k.equity, ende: null, trades: 0, status: "laeuft" };
    z.vorschlaege.forEach(v => { if (v.status === "offen") v.status = "verfallen"; });
    log("info", `Neuer Handelstag, Konto ${eur(k.equity)} €`);
  }
  const tag = z.tag!;
  const [konto, positionen] = await Promise.all([b.konto(), b.positionen()]);
  // geführte Positionen mit dem Bestand abgleichen
  z.gefuehrt = z.gefuehrt.filter(g => positionen.some(p => p.symbol === g.symbol && Math.sign(p.qty) === (g.richtung === "long" ? 1 : -1)));
  const tagesGV = konto.equity - tag.start;

  const allesSchliessen = async (grund: string, status: typeof tag.status) => {
    if (positionen.length) {
      if (b.nurZettel) { for (const p of positionen) zettel({ symbol: p.symbol, seite: p.qty > 0 ? "verkauf" : "kauf", qty: Math.abs(p.qty), grund }, "ausstieg"); }
      else { const r = await b.schliesseAlle(grund); erg.gehandelt += r.length; z.gefuehrt = []; }
    }
    tag.status = status; log("schluss", `${grund}: alle Positionen ${b.nurZettel ? "zum Schließen vorgelegt" : "geschlossen"}`);
  };
  const zettel = (antrag: OrderAntrag, art: Vorschlag["art"], signal?: Signal) => {
    if (z.vorschlaege.some(v => v.status === "offen" && v.antrag.symbol === antrag.symbol && v.art === art)) return;
    z.vorschlaege.unshift({ id: vid(), zeit, antrag, signal, art, status: "offen" }); z.vorschlaege = z.vorschlaege.slice(0, 100); erg.vorgeschlagen++;
    log("order", `Vorschlag: ${antrag.seite === "kauf" ? "Kauf" : "Verkauf"} ${antrag.qty} ${antrag.symbol} (${antrag.grund})`);
  };

  if (tag.status !== "laeuft") { erg.status = { ziel: "Tagesziel erreicht, Pause bis morgen", limit: "Verlustlimit erreicht, Stopp für heute", notaus: "Not-Aus", beendet: "Tag beendet" }[tag.status] ?? tag.status; return erg; }
  if (tagesGV >= e.tagesziel) { await allesSchliessen(`Tagesziel erreicht (+${eur(tagesGV)} €)`, "ziel"); erg.status = "Tagesziel erreicht"; return erg; }
  if (tagesGV <= -e.tagesverlust) { await allesSchliessen(`Verlustlimit erreicht (${eur(tagesGV)} €)`, "limit"); erg.status = "Verlustlimit erreicht"; return erg; }
  if (uhr.minutenBisSchluss <= e.schlussVorEnde) { await allesSchliessen(`${e.schlussVorEnde} Minuten vor Handelsschluss`, "beendet"); erg.status = "Schluss für heute"; return erg; }

  const bars = await b.bars([...new Set([...e.symbole, ...positionen.map(p => p.symbol)])]);
  const ausfuehren = async (antrag: OrderAntrag, art: Vorschlag["art"], signal?: Signal) => {
    // Ausstiege immer sofort (Schutz), Einstiege nur im Automatik-Modus; manuelle Broker bekommen Zettel
    if (b.nurZettel || (art === "einstieg" && e.modus === "vorschlag")) { zettel(antrag, art, signal); return; }
    const r = await b.sende(antrag);
    if (r.status === "abgelehnt") { log("fehler", `${antrag.symbol}: Order abgelehnt (${r.meldung ?? ""})`); return; }
    erg.gehandelt++; tag.trades += art === "einstieg" ? 1 : 0;
    log("order", `${antrag.seite === "kauf" ? "Kauf" : "Verkauf"} ${antrag.qty} ${antrag.symbol}${r.preis ? ` zu ${eur(r.preis)}` : ""}: ${antrag.grund}`);
    if (art === "einstieg" && signal) z.gefuehrt.push({ symbol: signal.symbol, richtung: signal.richtung, qty: antrag.qty, einstieg: r.preis ?? signal.kurs, stopp: signal.stopp, ziel: signal.ziel, seit: zeit, grund: signal.grund });
    if (art === "ausstieg") z.gefuehrt = z.gefuehrt.filter(g => g.symbol !== antrag.symbol);
  };

  // 1. Geführte Positionen: Stopp und Ziel
  for (const g of [...z.gefuehrt]) {
    const k = bars[g.symbol]?.at(-1)?.c; if (k == null) continue;
    const long = g.richtung === "long";
    const grund = long ? (k <= g.stopp ? `Stopp ${eur(g.stopp)} erreicht` : k >= g.ziel ? `Ziel ${eur(g.ziel)} erreicht` : null) : (k >= g.stopp ? `Stopp ${eur(g.stopp)} erreicht` : k <= g.ziel ? `Ziel ${eur(g.ziel)} erreicht` : null);
    if (grund) { log("ausstieg", `${g.symbol}: ${grund}`); await ausfuehren({ symbol: g.symbol, seite: long ? "verkauf" : "kauf", qty: g.qty, grund }, "ausstieg"); }
  }

  // 2. Neue Signale
  const offen = new Set([...positionen.map(p => p.symbol), ...z.gefuehrt.map(g => g.symbol), ...z.vorschlaege.filter(v => v.status === "offen").map(v => v.antrag.symbol)]);
  if (tag.trades >= e.maxTradesTag) { erg.status = "Handelslimit für heute erreicht"; return erg; }
  if (offen.size >= e.maxPositionen) { erg.status = "Höchstzahl Positionen erreicht"; return erg; }
  const fn = STRATEGIEN[e.strategie].fn;
  const signale = e.symbole.filter(s => !offen.has(s)).map(s => bars[s]?.length ? fn(s, bars[s]!, e.werte, e.richtung === "long-short") : null).filter((x): x is Signal => !!x).sort((a, c) => c.staerke - a.staerke);
  for (const s of signale.slice(0, Math.max(0, e.maxPositionen - offen.size))) {
    log("signal", `${s.symbol} ${s.richtung === "long" ? "Long" : "Short"}: ${s.grund}. Stopp ${eur(s.stopp)}, Ziel ${eur(s.ziel)}`);
    if (s.richtung === "short" && b.art === "manuell") { log("sperre", `${s.symbol}: Short über die App nicht vorgesehen`); continue; }
    const q = stueckzahl(e, s, konto.equity, konto.cash, b.bruchstuecke);
    if (q <= 0) { log("sperre", `${s.symbol}: Positionsgröße unter einer handelbaren Einheit bei ${eur(e.risikoProTrade * 100)} % Risiko`); continue; }
    await ausfuehren({ symbol: s.symbol, seite: s.richtung === "long" ? "kauf" : "verkauf", qty: q, grund: s.grund }, "einstieg", s);
  }
  erg.status = signale.length ? `${signale.length} Signal(e)` : "keine Signale";
  return erg;
}

/** Not-Aus: alles schließen und Agent anhalten */
export async function notaus(z: Agentzustand, b: Broker, grund = "Not-Aus") {
  const uhr = await b.uhr().catch(() => null); const zeit = uhr?.zeit ?? new Date().toISOString();
  if (!b.nurZettel) { await b.schliesseAlle(grund).catch(err => protokoll(z, "fehler", `Schließen fehlgeschlagen: ${(err as Error).message}`, zeit)); z.gefuehrt = []; }
  z.aktiv = false; if (z.tag && z.tag.status === "laeuft") z.tag.status = "notaus";
  protokoll(z, "schluss", `${grund}: Agent angehalten${b.nurZettel ? "; bitte offene Positionen in der App schließen" : ", alle Positionen geschlossen"}`, zeit);
}

export const STANDARD_WERTE: StrategieWerte = { spanneMin: 15, volumenFaktor: 1.5, z: 2, fenster: 30, zielR: 2 };

/** Vorschläge zum Einstellen: Grenzen relativ zum Startkapital */
export const VORLAGEN: { id: string; name: string; text: string; werte: (k: number) => Partial<AgentEinstellungen> }[] = [
  { id: "vorsichtig", name: "Vorsichtig", text: "Wenige Trades, kleines Risiko, früh Schluss", werte: k => ({ tagesziel: Math.round(k * 0.01), tagesverlust: Math.round(k * 0.01), risikoProTrade: 0.0025, maxPosition: 0.2, maxTradesTag: 3, maxPositionen: 2, richtung: "long", schlussVorEnde: 30, strategie: "ausbruch", werte: { ...STANDARD_WERTE, volumenFaktor: 2 } }) },
  { id: "ausgewogen", name: "Ausgewogen", text: "Moderates Risiko, Long und Short", werte: k => ({ tagesziel: Math.round(k * 0.02), tagesverlust: Math.round(k * 0.015), risikoProTrade: 0.005, maxPosition: 0.3, maxTradesTag: 6, maxPositionen: 3, richtung: "long-short", schlussVorEnde: 15, strategie: "ausbruch", werte: STANDARD_WERTE }) },
  { id: "aktiv", name: "Aktiv", text: "Mehr Trades, größere Ausschläge, Auffälligkeiten", werte: k => ({ tagesziel: Math.round(k * 0.04), tagesverlust: Math.round(k * 0.025), risikoProTrade: 0.01, maxPosition: 0.4, maxTradesTag: 12, maxPositionen: 4, richtung: "long-short", schlussVorEnde: 10, strategie: "anomalie", werte: { ...STANDARD_WERTE, z: 2.5 } }) },
];
export const neueEinstellungen = (k = 500): AgentEinstellungen => ({ name: "Mein Trading-Agent", broker: "simulation", startkapital: k, symbole: ["AAPL", "MSFT", "NVDA", "AMD", "TSLA", "META"], modus: "vorschlag", ...VORLAGEN[0]!.werte(k) } as AgentEinstellungen);

/** Plausibilität der Einstellungen, mit ehrlichen Hinweisen */
export function hinweise(e: AgentEinstellungen): { art: "warn" | "crit" | "info"; text: string }[] {
  const h: { art: "warn" | "crit" | "info"; text: string }[] = [];
  const zielQuote = e.tagesziel / Math.max(1, e.startkapital);
  if (zielQuote > 0.05) h.push({ art: "crit", text: `Tagesziel ${(zielQuote * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} % des Kapitals: das ist als Dauerrendite nicht erreichbar und verleitet zu großen Risiken. Als Ausstiegsregel („bei Erreichen aufhören“) ist es in Ordnung.` });
  if (e.tagesverlust > e.startkapital * 0.05) h.push({ art: "warn", text: "Verlustlimit über 5 % des Kapitals pro Tag: wenige schlechte Tage reichen für einen großen Teil des Kapitals." });
  if (e.risikoProTrade > 0.02) h.push({ art: "warn", text: "Mehr als 2 % Risiko je Trade ist für Daytrading hoch." });
  if (e.startkapital < 2000) h.push({ art: "info", text: "Bei kleinem Kapital fressen Kursspannen und Gebühren einen großen Teil jedes Gewinns. Erst mit der Simulation und dem Paper-Konto üben." });
  if (e.richtung === "long-short" && e.broker === "manuell") h.push({ art: "info", text: "Short-Positionen über Apps wie Trade Republic sind nicht vorgesehen; der Agent schlägt nur Long-Trades vor." });
  if (e.modus === "auto" && (e.broker === "alpaca-live")) h.push({ art: "crit", text: "Automatik mit echtem Geld: erst nach mehreren Wochen Paper-Trading mit stabilen Ergebnissen." });
  return h;
}
