import type { Broker } from "./broker";
import { geld, geldPm, kurs as kf, stueck, zahl } from "./format";
import { kontextSperre, type Kontextlage } from "./kontext";
import { STRATEGIEN } from "./strategien";
import type { Abschluss, AgentEinstellungen, Agentzustand, Gefuehrt, Logeintrag, OrderAntrag, Signal, StrategieTyp, StrategieWerte, Umfeld, Vorschlag } from "./types";

/**
 * Ein Takt des Agenten (jede Minute während der Handelszeit):
 * Tagesstand prüfen (Ziel, Verlustlimit, Schlusszeit), geführte Positionen gegen Stopp und Ziel prüfen,
 * dann neue Signale suchen. Der Risikomanager hat immer Vorrang vor der Strategie.
 */
export const leererZustand = (): Agentzustand => ({ aktiv: false, tag: null, verlauf: [], gefuehrt: [], vorschlaege: [], log: [], letzterTakt: null });
const vid = () => `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
/** Einstiegs-Vorschläge gelten so viele Takte (Minuten); danach ist das Signal veraltet */
export const VORSCHLAG_GUELTIG = 15;
/** Geschätzte Kosten je Seite (Spanne), für Verlustlimit und Mindest-Chance */
const SPANNE = 0.0005;

export function protokoll(z: Agentzustand, art: Logeintrag["art"], text: string, zeit: string) {
  z.log.unshift({ zeit, art, text }); if (z.log.length > 400) z.log.length = 400;
}

/** Trade abschließen und als überprüfte Prognose ablegen: Ergebnis in Euro und in Vielfachen des Risikos (R) */
export function abschluss(z: Agentzustand, g: Gefuehrt, preis: number, ausstiegGrund: string, zeit: string): Abschluss {
  const dir = g.richtung === "long" ? 1 : -1; const risiko = Math.abs(g.einstieg - g.stopp) || g.einstieg * 0.01;
  const a: Abschluss = { symbol: g.symbol, richtung: g.richtung, qty: g.qty, einstieg: g.einstieg, ausstieg: preis, stopp: g.stopp, ziel: g.ziel, seit: g.seit, bis: zeit, grund: g.grund, ausstiegGrund, gv: Math.round((preis - g.einstieg) * dir * g.qty * 100) / 100, r: Math.round(((preis - g.einstieg) * dir / risiko) * 100) / 100, ...(g.staerke != null ? { staerke: g.staerke } : {}), ...(g.strategie ? { strategie: g.strategie } : {}) };
  (z.abschluesse ??= []).unshift(a); if (z.abschluesse.length > 500) z.abschluesse.length = 500; return a;
}

/**
 * Trefferbilanz der Signale: Trefferquote, durchschnittliches R, Erwartungswert, Gewinnfaktor,
 * je Strategie und nach Signalstärke (ist ein „starkes“ Signal wirklich häufiger richtig?).
 */
export function trefferbilanz(liste: Abschluss[]) {
  const auswerten = (l: Abschluss[]) => {
    const n = l.length; const gew = l.filter(a => a.gv > 0); const verl = l.filter(a => a.gv < 0);
    const sum = (x: number[]) => x.reduce((a, b) => a + b, 0); const r2 = (v: number) => Math.round(v * 100) / 100;
    return { n, trefferquote: n ? r2(gew.length / n) : null, mittelR: n ? r2(sum(l.map(a => a.r)) / n) : null, ergebnis: r2(sum(l.map(a => a.gv))), gewinnfaktor: verl.length ? r2(sum(gew.map(a => a.gv)) / -sum(verl.map(a => a.gv))) : null, zielErreicht: l.filter(a => /Ziel/.test(a.ausstiegGrund)).length, stoppErreicht: l.filter(a => /Stopp/.test(a.ausstiegGrund)).length };
  };
  const strategien = [...new Set(liste.map(a => a.strategie).filter(Boolean))] as StrategieTyp[];
  const stufen = [[0, 0.5], [0.5, 1], [1, 2], [2, Infinity]] as const;
  return {
    gesamt: auswerten(liste),
    jeStrategie: strategien.map(s => ({ strategie: s, ...auswerten(liste.filter(a => a.strategie === s)) })),
    jeStaerke: stufen.map(([von, bis]) => ({ von, bis, ...auswerten(liste.filter(a => a.staerke != null && a.staerke >= von && a.staerke < bis)) })).filter(x => x.n),
  };
}

/** Korrelation der Minutenrenditen zweier Werte über die letzten n Minuten */
export function korrelation(a: { c: number }[], b: { c: number }[], n = 60): number | null {
  const m = Math.min(a.length, b.length, n + 1); if (m < 21) return null;
  const ra = a.slice(-m).map((x, i, l) => (i ? x.c / l[i - 1]!.c - 1 : 0)).slice(1); const rb = b.slice(-m).map((x, i, l) => (i ? x.c / l[i - 1]!.c - 1 : 0)).slice(1);
  const ma = ra.reduce((x, y) => x + y, 0) / ra.length, mb = rb.reduce((x, y) => x + y, 0) / rb.length;
  let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < ra.length; i++) { const da = ra[i]! - ma, db = rb[i]! - mb; sab += da * db; saa += da * da; sbb += db * db; }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : null;
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

export async function takt(e: AgentEinstellungen, z: Agentzustand, b: Broker, jetzt = new Date(), umfeld?: Umfeld, kontext?: Record<string, Kontextlage>): Promise<Taktergebnis> {
  const erg: Taktergebnis = { gehandelt: 0, vorgeschlagen: 0, status: "" };
  const uhr = await b.uhr(); const zeit = uhr.zeit; z.letzterTakt = jetzt.toISOString();
  const log = (art: Logeintrag["art"], text: string) => protokoll(z, art, text, zeit);

  if (!uhr.offen) {
    if (z.tag && z.tag.status === "laeuft") { z.tag.ende = (await b.konto()).equity; z.tag.status = "beendet"; log("info", `Handelstag beendet: ${geldPm(z.tag.ende - z.tag.start, (await b.konto()).waehrung)}`); }
    erg.status = "Markt geschlossen"; return erg;
  }
  // Neuer Handelstag
  if (!z.tag || z.tag.datum !== uhr.datum) {
    if (z.tag) { if (z.tag.ende == null) z.tag.ende = (await b.konto()).equity; z.verlauf.unshift(z.tag); z.verlauf = z.verlauf.slice(0, 250); }
    const k = await b.konto(); z.tag = { datum: uhr.datum, start: k.equity, ende: null, trades: 0, status: "laeuft" };
    z.vorschlaege.forEach(v => { if (v.status === "offen") v.status = "verfallen"; });
    log("info", `Neuer Handelstag, Konto ${geld(k.equity, k.waehrung)}`);
  }
  const tag = z.tag!;
  const [konto, positionen] = await Promise.all([b.konto(), b.positionen()]);
  // geführte Positionen mit dem Bestand abgleichen
  z.gefuehrt = z.gefuehrt.filter(g => positionen.some(p => p.symbol === g.symbol && Math.sign(p.qty) === (g.richtung === "long" ? 1 : -1)));
  const w = konto.waehrung;
  const tagesGV = konto.equity - tag.start;
  // Kosten, um alles zu schließen (Spanne): das Verlustlimit greift schon, bevor diese Kosten es überschreiten würden
  const schliessKosten = positionen.reduce((a, p) => a + Math.abs(p.wert) * SPANNE, 0);

  const allesSchliessen = async (grund: string, status: typeof tag.status) => {
    verfalleEinstiege(z, grund);
    if (positionen.length) {
      if (b.nurZettel) { for (const p of positionen) zettel({ symbol: p.symbol, seite: p.qty > 0 ? "verkauf" : "kauf", qty: Math.abs(p.qty), grund }, "ausstieg"); }
      else { const r = await b.schliesseAlle(grund); erg.gehandelt += r.length;
        for (const x of r) log("order", `${x.seite === "kauf" ? "Kauf" : "Verkauf"} ${stueck(x.qty)} ${x.symbol}${x.preis != null ? ` zu ${kf(x.preis)}` : ` (${x.meldung ?? x.status})`}: ${grund}`);
        for (const g of z.gefuehrt) { const x = r.find(q => q.symbol === g.symbol); const k = x?.preis ?? positionen.find(p => p.symbol === g.symbol)?.kurs; if (k != null) abschluss(z, g, k, grund, zeit); } z.gefuehrt = []; }
    }
    tag.status = status; log("schluss", `${grund}: alle Positionen ${b.nurZettel ? "zum Schließen vorgelegt" : "geschlossen"}`);
    // Tagesergebnis sofort festhalten, damit Liste und Startseite es zeigen (TRD-018)
    if (!b.nurZettel) { try { tag.ende = (await b.konto()).equity; } catch { /* beim nächsten Takt */ } }
  };
  const zettel = (antrag: OrderAntrag, art: Vorschlag["art"], signal?: Signal) => {
    if (z.vorschlaege.some(v => v.status === "offen" && v.antrag.symbol === antrag.symbol && v.art === art)) return;
    z.vorschlaege.unshift({ id: vid(), zeit, antrag, signal, art, status: "offen", minute: uhr.minutenSeitOeffnung }); z.vorschlaege = z.vorschlaege.slice(0, 100); erg.vorgeschlagen++;
    log("order", `Vorschlag: ${antrag.seite === "kauf" ? "Kauf" : "Verkauf"} ${stueck(antrag.qty)} ${antrag.symbol} (${antrag.grund})`);
  };

  if (tag.status !== "laeuft") {
    // Positionen, die nach dem Stopp noch offen sind, nicht über Nacht liegen lassen
    if (positionen.length && !b.nurZettel) await allesSchliessen("Nach Handelsstopp noch offene Positionen", tag.status);
    erg.status = { ziel: "Tagesziel erreicht, Pause bis morgen", limit: "Verlustlimit erreicht, Stopp für heute", notaus: "Not-Aus", beendet: "Tag beendet" }[tag.status] ?? tag.status; return erg; }
  if (tagesGV - schliessKosten >= e.tagesziel) { await allesSchliessen(`Tagesziel erreicht (${geldPm(tagesGV, w)})`, "ziel"); erg.status = "Tagesziel erreicht"; return erg; }
  if (tagesGV - schliessKosten <= -e.tagesverlust) { await allesSchliessen(`Verlustlimit erreicht (${geldPm(tagesGV, w)}, mit Schließkosten ${geldPm(tagesGV - schliessKosten, w)})`, "limit"); erg.status = "Verlustlimit erreicht"; return erg; }
  if (uhr.minutenBisSchluss <= e.schlussVorEnde) { await allesSchliessen(`${e.schlussVorEnde} Minuten vor Handelsschluss`, "beendet"); erg.status = "Schluss für heute"; return erg; }

  const referenz = STRATEGIEN[e.strategie].braucht === "markt" ? (e.werte.referenz ?? "SPY") : null;
  const bars = await b.bars([...new Set([...e.symbole, ...positionen.map(p => p.symbol), ...(referenz ? [referenz] : [])])]);
  const ausfuehren = async (antrag: OrderAntrag, art: Vorschlag["art"], signal?: Signal) => {
    // Ausstiege immer sofort (Schutz), Einstiege nur im Automatik-Modus; manuelle Broker bekommen Zettel
    if (b.nurZettel || (art === "einstieg" && e.modus === "vorschlag")) { zettel(antrag, art, signal); return; }
    const r = await b.sende(antrag);
    if (r.status === "abgelehnt") { log("fehler", `${antrag.symbol}: Order abgelehnt (${r.meldung ?? ""})`); return; }
    erg.gehandelt++; tag.trades += art === "einstieg" ? 1 : 0;
    log("order", `${antrag.seite === "kauf" ? "Kauf" : "Verkauf"} ${stueck(antrag.qty)} ${antrag.symbol}${r.preis ? ` zu ${kf(r.preis)}` : ""}: ${antrag.grund}`);
    if (art === "einstieg" && signal) z.gefuehrt.push({ symbol: signal.symbol, richtung: signal.richtung, qty: antrag.qty, einstieg: r.preis ?? signal.kurs, stopp: signal.stopp, ziel: signal.ziel, seit: zeit, grund: signal.grund, staerke: signal.staerke, strategie: e.strategie });
    if (art === "ausstieg") { const g = z.gefuehrt.find(x => x.symbol === antrag.symbol); const k = r.preis ?? bars[antrag.symbol]?.at(-1)?.c; if (g && k != null) abschluss(z, g, k, antrag.grund, zeit); z.gefuehrt = z.gefuehrt.filter(x => x.symbol !== antrag.symbol); }
  };

  // 1. Geführte Positionen: Stopp und Ziel
  for (const g of [...z.gefuehrt]) {
    const bar = bars[g.symbol]?.at(-1); if (!bar) continue;
    const long = g.richtung === "long";
    // Stopp und Ziel gegen Tief und Hoch der Minute prüfen, nicht nur gegen den Schlusskurs; der Stopp hat Vorrang
    const grund = long ? (bar.l <= g.stopp ? `Stopp ${kf(g.stopp)} erreicht` : bar.h >= g.ziel ? `Ziel ${kf(g.ziel)} erreicht` : null) : (bar.h >= g.stopp ? `Stopp ${kf(g.stopp)} erreicht` : bar.l <= g.ziel ? `Ziel ${kf(g.ziel)} erreicht` : null);
    if (grund) { log("ausstieg", `${g.symbol}: ${grund}`); await ausfuehren({ symbol: g.symbol, seite: long ? "verkauf" : "kauf", qty: g.qty, grund, ...(grund.startsWith("Stopp") && b.art === "simulation" ? { stoppKurs: g.stopp } : {}) }, "ausstieg"); }
  }

  // 2. Veraltete Einstiegs-Vorschläge verfallen lassen: zu alt, oder der Kurs ist schon jenseits von Stopp oder Ziel
  for (const v of z.vorschlaege) {
    if (v.status !== "offen" || v.art !== "einstieg") continue;
    v.alter = (v.alter ?? 0) + 1; const k = bars[v.antrag.symbol]?.at(-1)?.c; const sg = v.signal;
    const minuten = v.minute != null ? uhr.minutenSeitOeffnung - v.minute : v.alter;
    const jenseits = sg && k != null && (sg.richtung === "long" ? k <= sg.stopp || k >= sg.ziel : k >= sg.stopp || k <= sg.ziel);
    if (minuten > VORSCHLAG_GUELTIG || jenseits) { v.status = "verfallen"; v.meldung = jenseits ? "Kurs schon jenseits von Stopp oder Ziel" : `nach ${VORSCHLAG_GUELTIG} Minuten veraltet`; log("info", `Vorschlag ${v.antrag.symbol} verfallen (${v.meldung})`); }
  }

  // 3. Neue Signale
  const offen = new Set([...positionen.map(p => p.symbol), ...z.gefuehrt.map(g => g.symbol), ...z.vorschlaege.filter(v => v.status === "offen").map(v => v.antrag.symbol)]);
  const offeneEinstiege = z.vorschlaege.filter(v => v.status === "offen" && v.art === "einstieg").length;
  if (tag.trades + offeneEinstiege >= e.maxTradesTag) { erg.status = "Handelslimit für heute erreicht"; return erg; }
  if (offen.size >= e.maxPositionen) { erg.status = "Höchstzahl Positionen erreicht"; return erg; }
  // Marktumfeld: Risikolage und wichtige Termine skalieren das Risiko je Trade
  const faktor = e.marktlage === false || !umfeld ? 1 : umfeld.faktor;
  if (umfeld && e.marktlage !== false && z.umfeld !== umfeld.text) { z.umfeld = umfeld.text; log("info", `Marktumfeld: ${umfeld.text}`); }
  if (faktor <= 0) { erg.status = "Keine neuen Einstiege (Marktumfeld)"; return erg; }
  const fn = STRATEGIEN[e.strategie].fn;
  const signale = e.symbole.filter(s => !offen.has(s)).map(s => bars[s]?.length ? fn(s, bars[s]!, e.werte, e.richtung === "long-short", { markt: referenz ? bars[referenz] : undefined }) : null).filter((x): x is Signal => !!x).sort((a, c) => c.staerke - a.staerke);
  const frei = Math.max(0, Math.min(e.maxPositionen - offen.size, e.maxTradesTag - tag.trades - offeneEinstiege));
  for (const s of signale.slice(0, frei)) {
    if (tag.trades + z.vorschlaege.filter(v => v.status === "offen" && v.art === "einstieg").length >= e.maxTradesTag) break;
    log("signal", `${s.symbol} ${s.richtung === "long" ? "Long" : "Short"}: ${s.grund}. Stopp ${kf(s.stopp)}, Ziel ${kf(s.ziel)}`);
    // Mindest-Chance: nach Kosten muss das Ziel mindestens so weit weg sein wie der Stopp
    const chance = Math.abs(s.ziel - s.kurs) - 2 * SPANNE * s.kurs; const risiko = Math.abs(s.kurs - s.stopp) + 2 * SPANNE * s.kurs;
    if (chance < risiko) { log("sperre", `${s.symbol}: Chance nach Kosten (${zahl(Math.max(0, chance), 3)}) kleiner als Risiko mit Kosten (${zahl(risiko, 3)})`); continue; }
    if (s.richtung === "short" && b.art === "manuell") { log("sperre", `${s.symbol}: Short über die App nicht vorgesehen`); continue; }
    const sperre = e.kontext === false ? null : kontextSperre(s.richtung, kontext?.[s.symbol]);
    if (sperre) { log("sperre", `${s.symbol}: ${s.richtung === "long" ? "Kein Kauf" : "Kein Short"} wegen ${sperre}`); continue; }
    // Korrelationsgruppen: läuft der Wert fast gleich wie eine offene Position in derselben Richtung, ist es im Kern
    // derselbe Trade (z. B. NVDA und AMD). Eine solche Position: halbe Größe; zwei oder mehr: kein weiterer Einstieg
    const gleich = z.gefuehrt.filter(g => g.richtung === s.richtung && (korrelation(bars[s.symbol] ?? [], bars[g.symbol] ?? []) ?? 0) > 0.7).map(g => g.symbol);
    if (gleich.length >= 2) { log("sperre", `${s.symbol}: läuft fast gleich wie ${gleich.join(" und ")} (Korrelation über 0,7), kein weiteres Risiko in dieselbe Richtung`); continue; }
    const korrFaktor = gleich.length ? 0.5 : 1;
    if (gleich.length) log("info", `${s.symbol}: läuft fast gleich wie ${gleich[0]} (Korrelation über 0,7), halbe Positionsgröße`);
    // Marktumfeld verkleinert die fertige Stückzahl, egal ob Risiko oder Höchstposition sie begrenzt
    const voll = stueckzahl(e, s, konto.equity, konto.cash, b.bruchstuecke); const f = faktor * korrFaktor;
    const q = f >= 1 ? voll : b.bruchstuecke && s.richtung === "long" ? Math.floor(voll * f * 1000) / 1000 : Math.floor(voll * f);
    if (q <= 0) { log("sperre", `${s.symbol}: Positionsgröße unter einer handelbaren Einheit (Grenzen: ${zahl(e.risikoProTrade * 100)} % Risiko, höchstens ${zahl(e.maxPosition * 100, 0)} % je Position${f < 1 ? `, Faktor ${zahl(f * 100, 0)} % aus Marktumfeld/Korrelation` : ""})`); continue; }
    await ausfuehren({ symbol: s.symbol, seite: s.richtung === "long" ? "kauf" : "verkauf", qty: q, grund: s.grund }, "einstieg", s);
  }
  erg.status = signale.length ? `${signale.length} Signal(e)` : "keine Signale";
  return erg;
}

/** Offene Einstiegs-Vorschläge verfallen lassen (bei Tagesziel, Limit, Schluss, Not-Aus) */
export function verfalleEinstiege(z: Agentzustand, grund: string) {
  for (const v of z.vorschlaege) if (v.status === "offen" && v.art === "einstieg") { v.status = "verfallen"; v.meldung = grund; }
}

/**
 * Not-Aus: Agent sofort anhalten, dann alles schließen. Der Agent hält immer an, auch wenn der Broker
 * nicht erreichbar ist; die Meldung sagt ehrlich, ob das Schließen geklappt hat.
 */
export async function notaus(z: Agentzustand, b: Broker | null, grund = "Not-Aus", brokerFehler?: string): Promise<{ geschlossen: boolean; text: string }> {
  z.aktiv = false; if (z.tag && z.tag.status === "laeuft") z.tag.status = "notaus"; verfalleEinstiege(z, grund);
  const uhr = b ? await b.uhr().catch(() => null) : null; const zeit = uhr?.zeit ?? new Date().toISOString();
  let text: string; let geschlossen = false;
  if (!b && !z.gefuehrt.length && !z.tag) text = `${grund}: Agent angehalten. Er hatte noch nicht gehandelt, es sind keine Positionen bekannt.`;
  else if (!b && !z.gefuehrt.length && !z.tag?.trades) text = `${grund}: Agent angehalten. Ohne Verbindung zum Broker wurden keine Orders gesendet; der Agent führte keine offenen Positionen.`;
  else if (!b) text = `${grund}: Agent angehalten. Positionen konnten nicht geschlossen werden (${brokerFehler ?? "Broker nicht verfügbar"}); bitte direkt beim Broker prüfen.`;
  else if (b.nurZettel) text = `${grund}: Agent angehalten; bitte offene Positionen in der App schließen.`;
  else {
    const r = await b.schliesseAlle(grund).catch(err => { protokoll(z, "fehler", `Schließen fehlgeschlagen: ${(err as Error).message}`, zeit); return null; });
    if (r) {
      for (const x of r) protokoll(z, "order", `${x.seite === "kauf" ? "Kauf" : "Verkauf"} ${stueck(x.qty)} ${x.symbol}${x.preis != null ? ` zu ${kf(x.preis)}` : ` (${x.meldung ?? x.status})`}: ${grund}`, zeit);
      for (const g of z.gefuehrt) { const x = r.find(q => q.symbol === g.symbol); if (x?.preis != null) abschluss(z, g, x.preis, grund, zeit); }
      z.gefuehrt = []; geschlossen = true; if (z.tag && z.tag.ende == null) { try { z.tag.ende = (await b.konto()).equity; } catch { /* später */ } } text = `${grund}: Agent angehalten, ${r.length ? `${r.length} Position(en) geschlossen` : "keine Positionen offen"}.`;
    } else text = `${grund}: Agent angehalten. Schließen beim Broker fehlgeschlagen; Positionen bitte direkt beim Broker prüfen.`;
  }
  protokoll(z, "schluss", text, zeit); return { geschlossen, text };
}

export const STANDARD_WERTE: StrategieWerte = { spanneMin: 15, volumenFaktor: 1.5, z: 2, fenster: 30, zielR: 2 };

/** Vorschläge zum Einstellen: Grenzen relativ zum Startkapital */
export const VORLAGEN: { id: string; name: string; text: string; werte: (k: number) => Partial<AgentEinstellungen> }[] = [
  { id: "vorsichtig", name: "Vorsichtig", text: "Wenige Trades, kleines Risiko, früh Schluss", werte: k => ({ tagesziel: Math.round(k * 0.01), tagesverlust: Math.round(k * 0.01), risikoProTrade: 0.0025, maxPosition: 0.2, maxTradesTag: 3, maxPositionen: 2, richtung: "long", schlussVorEnde: 30, strategie: "ausbruch", werte: { ...STANDARD_WERTE, volumenFaktor: 2 } }) },
  { id: "ausgewogen", name: "Ausgewogen", text: "Moderates Risiko, Long und Short", werte: k => ({ tagesziel: Math.round(k * 0.02), tagesverlust: Math.round(k * 0.015), risikoProTrade: 0.005, maxPosition: 0.3, maxTradesTag: 6, maxPositionen: 3, richtung: "long-short", schlussVorEnde: 15, strategie: "ausbruch", werte: STANDARD_WERTE }) },
  { id: "aktiv", name: "Aktiv", text: "Mehr Trades, größere Ausschläge, Auffälligkeiten", werte: k => ({ tagesziel: Math.round(k * 0.04), tagesverlust: Math.round(k * 0.025), risikoProTrade: 0.01, maxPosition: 0.4, maxTradesTag: 12, maxPositionen: 4, richtung: "long-short", schlussVorEnde: 10, strategie: "anomalie", werte: { ...STANDARD_WERTE, z: 2.5 } }) },
];
export const neueEinstellungen = (k = 500): AgentEinstellungen => ({ name: "Mein Trading-Agent", broker: "simulation", startkapital: k, symbole: ["AAPL", "MSFT", "NVDA", "AMD", "TSLA", "META"], modus: "vorschlag", marktlage: true, kontext: true, ...VORLAGEN[0]!.werte(k) } as AgentEinstellungen);

/** Plausibilität der Einstellungen, mit ehrlichen Hinweisen */
export function hinweise(e: AgentEinstellungen): { art: "warn" | "crit" | "info"; text: string }[] {
  const h: { art: "warn" | "crit" | "info"; text: string }[] = [];
  const zielQuote = e.tagesziel / Math.max(1, e.startkapital);
  if (zielQuote > 0.05) h.push({ art: "crit", text: `Tagesziel ${(zielQuote * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} % des Kapitals: das ist als Dauerrendite nicht erreichbar und verleitet zu großen Risiken. Als Ausstiegsregel („bei Erreichen aufhören“) ist es in Ordnung.` });
  if (e.tagesverlust > e.startkapital * 0.05) h.push({ art: "warn", text: "Verlustlimit über 5 % des Kapitals pro Tag: wenige schlechte Tage reichen für einen großen Teil des Kapitals." });
  if (e.risikoProTrade > 0.02) h.push({ art: "warn", text: "Mehr als 2 % Risiko je Trade ist für Daytrading hoch." });
  if (e.startkapital * e.risikoProTrade > e.tagesverlust) h.push({ art: "warn", text: `Ein einzelner Trade riskiert ${Math.round(e.startkapital * e.risikoProTrade).toLocaleString("de-DE")}, mehr als das Verlustlimit des Tages (${e.tagesverlust.toLocaleString("de-DE")}). Ein Stopp kann das Limit dann deutlich überschreiten.` });
  if (e.startkapital < 2000) h.push({ art: "info", text: "Bei kleinem Kapital fressen Kursspannen und Gebühren einen großen Teil jedes Gewinns. Erst mit der Simulation und dem Paper-Konto üben." });
  if (e.richtung === "long-short" && e.broker === "manuell") h.push({ art: "info", text: "Short-Positionen über Apps wie Trade Republic sind nicht vorgesehen; der Agent schlägt nur Long-Trades vor." });
  if (e.modus === "auto" && (e.broker === "alpaca-live")) h.push({ art: "crit", text: "Automatik mit echtem Geld: erst nach mehreren Wochen Paper-Trading mit stabilen Ergebnissen." });
  return h;
}
