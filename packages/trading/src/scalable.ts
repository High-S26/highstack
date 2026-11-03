/**
 * Scalable Capital über die offizielle Scalable CLI (`sc`, github.com/ScalableCapital/scalable-cli).
 * Kein inoffizieller Zugang: Anmeldung macht der Nutzer selbst im Terminal (`sc login`, OAuth-Gerätecode),
 * highstack ruft nur Befehle mit `--json` auf.
 *
 * Orders laufen wie von Scalable vorgegeben in zwei Schritten:
 * 1. Vorschau (Phase 1): Kurs, geschätztes Volumen, Kosten, Hinweise und eine Bestätigungs-ID (15 Minuten gültig).
 * 2. Ausführen (Phase 2): erst nach ausdrücklicher Freigabe durch den Nutzer in einer eigenen Handlung,
 *    mit exakt denselben Angaben und `--confirm <ID>`.
 * Ein fehlgeschlagenes Ausführen kann einen unbekannten Ausgang haben: dann keine neue Order, bis die Umsätze geprüft sind.
 */

/** Führt `sc` mit Argumenten aus und liefert die Standardausgabe (eine JSON-Zeile). Wird von der App gestellt. */
export type ScAusfuehrer = (args: string[]) => Promise<{ stdout: string; code: number }>;

export class ScFehler extends Error {
  constructor(public code: string, message: string, public exitCode?: number) { super(message); }
  /** Ausgang einer Order unbekannt (Zeitüberschreitung, Verbindungsabbruch) */
  get ausgangUnbekannt() { return ["timeout", "network_error", "order_submission_failed", "internal_error", "keine_antwort"].includes(this.code); }
}

const zahl = (v: unknown): number | null => { if (v == null || v === "") return null; const n = typeof v === "number" ? v : Number(String(v).replace(",", ".")); return Number.isFinite(n) ? n : null; };
const text = (v: unknown): string | null => typeof v === "string" && v.trim() ? v : null;

/** Antwort von `sc … --json` lesen: { ok, command, data } oder { ok: false, error: { code, message } } */
export function leseAntwort(stdout: string, code = 0): unknown {
  const zeile = stdout.trim().split("\n").filter(Boolean).at(-1) ?? "";
  let j: { ok?: boolean; data?: unknown; error?: { code?: string; message?: string } };
  try { j = JSON.parse(zeile); } catch { throw new ScFehler("keine_antwort", code === 127 ? "Scalable CLI (sc) nicht gefunden. Installation: github.com/ScalableCapital/scalable-cli" : "Antwort der Scalable CLI nicht lesbar.", code); }
  if (j.ok === false || j.error) {
    const c = j.error?.code ?? "fehler"; const m = j.error?.message ?? "Unbekannter Fehler";
    const klar: Record<string, string> = {
      no_session: "Nicht bei Scalable angemeldet. Bitte im Terminal `sc login` ausführen (Freischaltung vorher im Web unter Profil → Sicherheit → Agentic Investing).",
      refresh_relogin_required: "Scalable-Sitzung abgelaufen (spätestens nach sieben Tagen oder 24 Stunden ohne Abfrage). Bitte im Terminal `sc login` ausführen.",
      rate_limited: "Scalable begrenzt gerade die Abfragen. Bitte kurz warten.",
      refresh_retryable: "Scalable-Sitzung wird erneuert. Bitte noch einmal versuchen.",
      local_read_only: "Die Scalable CLI ist auf „nur lesen“ angemeldet (sc login --local-read-only). Für Orders ohne diese Option anmelden.",
      confirmation_expired: "Die Vorschau ist abgelaufen (15 Minuten). Bitte neu vorbereiten.",
      confirmation_already_used: "Diese Freigabe wurde schon verwendet. Bitte die Umsätze in der Scalable-App prüfen.",
      trade_not_tradable: "Das Wertpapier ist an diesem Handelsplatz gerade nicht handelbar.",
      trade_control_order_notional_exceeded: "Die Order überschreitet die Obergrenze aus Ihrer CLI-Einstellung (max_order_notional).",
      order_submission_failed: "Übermittlung fehlgeschlagen; der Ausgang ist unklar. Bitte in der Scalable-App prüfen, ob die Order existiert, bevor Sie eine neue anlegen.",
    };
    throw new ScFehler(c, klar[c] ?? m, code);
  }
  return j.data ?? j;
}

export interface ScStatus { angemeldet: boolean; konto?: string | null; nurLesen?: boolean; fehler?: string; version?: string | null }
export interface ScKurs { isin: string; name: string | null; mid: number | null; bid: number | null; ask: number | null; waehrung: string | null; zeit: string | null; veraltet: boolean }
export interface ScKerze { zeit: string; kurs: number }
export interface ScDerivat { isin: string; emittent: string | null; richtung: string | null; hebel: number | null; barriere: number | null; abstandKo: number | null; basispreis: number | null; laufzeit: string | null; openEnd: boolean }
export interface ScBestand { isin: string; name: string | null; stueck: number; wert: number | null; einstand: number | null }
export interface ScGeld { guthaben: number | null; kaufkraft: number | null; kaufkraftOhneKredit: number | null }

/** Order wie bei `sc broker trade buy|sell` */
export interface ScOrder {
  seite: "kauf" | "verkauf";
  isin: string;
  /** Kauf: entweder Betrag in Euro oder ganze Stück; Verkauf: Stück */
  betrag?: number | null;
  stueck?: number | null;
  art: "market" | "limit" | "stop" | "stop-limit";
  limit?: number | null;
  stopp?: number | null;
  /** gettex, xetra oder eix; leer = Scalable wählt */
  boerse?: "gettex" | "xetra" | "eix" | null;
}
export interface ScVorschau {
  bestaetigungsId: string;
  order: ScOrder;
  /** genau diese Argumente müssen beim Ausführen wiederholt werden */
  args: string[];
  name: string | null;
  kurs: { mid: number | null; bid: number | null; ask: number | null; waehrung: string | null };
  stueck: number | null;
  volumen: number | null;
  handelbar: boolean;
  boerse: string | null;
  kosten: unknown;
  hinweise: string[];
  /** Angemessenheitshinweis (z. B. Hebelprodukte), muss vor der Freigabe bestätigt werden */
  angemessenheit: boolean;
  erstellt: number;
  gueltigBis: number;
}
export interface ScAusfuehrung { orderId: string | null; uebermittelt: boolean }

const fix = (n: number) => String(Math.round(n * 10000) / 10000);
/** ISIN mit Prüfziffer (wie die CLI) */
export function istIsin(s: string): boolean {
  if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(s)) return false;
  const ziffern = [...s.slice(0, 11)].map(c => /\d/.test(c) ? c : String(c.charCodeAt(0) - 55)).join("");
  let summe = 0; const umgekehrt = [...ziffern].reverse();
  umgekehrt.forEach((c, i) => { let d = Number(c); if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9; } summe += d; });
  return (10 - (summe % 10)) % 10 === Number(s[11]);
}

/** Argumente für Phase 1 (ohne --confirm), streng geprüft */
export function orderArgs(o: ScOrder): string[] {
  if (!istIsin(o.isin)) throw new ScFehler("invalid_input", `Ungültige ISIN: ${o.isin}`);
  const a = ["broker", "trade", o.seite === "kauf" ? "buy" : "sell", "--isin", o.isin];
  if (o.seite === "kauf") {
    if ((o.betrag == null) === (o.stueck == null)) throw new ScFehler("invalid_input", "Kauf: entweder Betrag oder Stückzahl angeben.");
    if (o.betrag != null) { if (!(o.betrag > 0)) throw new ScFehler("invalid_input", "Betrag muss größer als 0 sein."); a.push("--amount", fix(o.betrag)); }
    else { if (!Number.isInteger(o.stueck) || o.stueck! <= 0) throw new ScFehler("invalid_input", "Beim Kauf nur ganze Stück."); a.push("--shares", String(o.stueck)); }
  } else {
    if (!(o.stueck != null && o.stueck > 0)) throw new ScFehler("invalid_input", "Verkauf: Stückzahl angeben."); a.push("--shares", fix(o.stueck));
  }
  a.push("--order-type", o.art);
  if (o.art === "limit" || o.art === "stop-limit") { if (!(o.limit != null && o.limit > 0)) throw new ScFehler("invalid_input", "Limit fehlt."); a.push("--limit-price", fix(o.limit)); }
  if (o.art === "stop" || o.art === "stop-limit") { if (!(o.stopp != null && o.stopp > 0)) throw new ScFehler("invalid_input", "Stopp-Kurs fehlt."); a.push("--stop-price", fix(o.stopp)); }
  if (o.boerse) a.push("--venue", o.boerse);
  return a;
}

/** Ergebnis der Vorschau lesen */
export function leseVorschau(d: unknown, order: ScOrder, args: string[], jetzt = Date.now()): ScVorschau {
  const x = d as { result?: Record<string, any>; confirmation?: { id?: string }; next_step?: string };
  const r = x.result ?? {}; const id = text(x.confirmation?.id);
  if (!id) throw new ScFehler("keine_bestaetigung", "Scalable hat keine Bestätigungs-ID geliefert; die Order ist nicht freigebbar.");
  const hinweise: string[] = [];
  for (const w of (r.price_warnings?.items ?? []) as { message?: string; text?: string }[]) { const t = text(w.message) ?? text(w.text); if (t) hinweise.push(t); }
  const warnung = r.warning; if (warnung && typeof warnung === "object") { const t = text((warnung as any).message) ?? text((warnung as any).text); if (t) hinweise.push(t); }
  if (r.tradability?.selected_venue_unavailability_reason) hinweise.push(String(r.tradability.selected_venue_unavailability_reason));
  return {
    bestaetigungsId: id, order, args,
    name: text(r.security_name) ?? text(r.intent?.name) ?? null,
    kurs: { mid: zahl(r.market_quote?.mid_price), bid: zahl(r.market_quote?.bid_price), ask: zahl(r.market_quote?.ask_price), waehrung: text(r.market_quote?.currency) },
    stueck: zahl(r.calculation?.shares), volumen: zahl(r.calculation?.estimated_order_volume),
    handelbar: r.tradability?.tradable !== false, boerse: text(r.tradability?.selected_venue_label) ?? text(r.tradability?.selected_venue),
    kosten: r.ex_ante_costs ?? null, hinweise,
    angemessenheit: r.suitability?.requires_appropriateness_warning_acknowledgement === true,
    erstellt: jetzt, gueltigBis: jetzt + 14 * 60_000,
  };
}
export function leseAusfuehrung(d: unknown): ScAusfuehrung {
  const x = d as { result?: { order_submission?: { submitted?: boolean; order_id?: string } }; next_step?: string };
  const s = x.result?.order_submission; return { orderId: text(s?.order_id), uebermittelt: s?.submitted === true || x.next_step === "completed" };
}
export const leseKurs = (d: unknown): ScKurs => {
  const x = d as Record<string, unknown>;
  return { isin: String(x.isin ?? ""), name: text(x.name), mid: zahl(x.quote_mid_price), bid: zahl(x.quote_bid_price), ask: zahl(x.quote_ask_price), waehrung: text(x.quote_currency), zeit: text(x.quote_timestamp_utc), veraltet: x.quote_is_outdated === true };
};
export const leseChart = (d: unknown): ScKerze[] => ((d as { data_points?: { mid_price?: unknown; timestamp_utc?: unknown }[] }).data_points ?? [])
  .map(p => ({ zeit: String(p.timestamp_utc ?? ""), kurs: zahl(p.mid_price) })).filter((p): p is ScKerze => p.kurs != null && !!p.zeit);
const preisWert = (p: unknown) => zahl((p as { value?: unknown } | null)?.value);
export const leseDerivate = (d: unknown): ScDerivat[] => ((d as { items?: Record<string, unknown>[] }).items ?? []).map(i => ({
  isin: String(i.isin ?? ""), emittent: text(i.issuer), richtung: text(i.strategy), hebel: zahl(i.leverage), barriere: preisWert(i.knockout_barrier), abstandKo: zahl(i.distance_to_knockout),
  basispreis: preisWert(i.strike), laufzeit: text(i.expiry_date), openEnd: i.expiry_is_open_end === true,
})).filter(x => istIsin(x.isin));
export const leseBestand = (d: unknown): ScBestand[] => ((d as { items?: Record<string, unknown>[] }).items ?? []).map(i => ({
  isin: String(i.isin ?? ""), name: text(i.name), stueck: zahl(i.quantity) ?? 0, wert: zahl(i.valuation), einstand: zahl(i.fifo_price),
}));
export const leseGeld = (d: unknown): ScGeld => { const x = d as Record<string, unknown>; return { guthaben: zahl(x.cash_balance), kaufkraft: zahl(x.buying_power), kaufkraftOhneKredit: zahl(x.buying_power_without_credit) }; };

/** Zugriff auf Scalable über die CLI */
export function scalable(sc: ScAusfuehrer) {
  const run = async (args: string[]) => { const r = await sc([...args, "--json"]); return leseAntwort(r.stdout, r.code); };
  return {
    async status(): Promise<ScStatus> {
      try { const d = await run(["whoami"]) as Record<string, unknown>; return { angemeldet: true, konto: text(d.email) ?? text(d.user_id) ?? text(d.subject) ?? null, nurLesen: d.local_read_only === true }; }
      catch (e) { return { angemeldet: false, fehler: (e as Error).message }; }
    },
    kurs: async (isin: string) => { if (!istIsin(isin)) throw new ScFehler("invalid_input", `Ungültige ISIN: ${isin}`); return leseKurs(await run(["broker", "quote", "--isin", isin])); },
    chart: async (isin: string, zeitraum: "1d" | "7d" | "1m" | "3m" | "6m" | "ytd" | "1y" | "max" = "1d") => leseChart(await run(["broker", "chart", "--isin", isin, "--timeframe", zeitraum])),
    suche: async (q: string) => ((await run(["broker", "search", q.slice(0, 80)])) as { items?: { isin?: string; name?: string }[] }).items ?? [],
    derivate: async (p: { basis: string; richtung: "long" | "short"; hebelMin?: number; hebelMax?: number; barriereMin?: number; barriereMax?: number; anzahl?: number }) => {
      if (!istIsin(p.basis)) throw new ScFehler("invalid_input", `Ungültige ISIN: ${p.basis}`);
      const a = ["broker", "derivatives", "search", "--underlying", p.basis, "--type", "knockout", "--strategy", p.richtung, "--limit", String(p.anzahl ?? 20), "--sort-field", "leverage", "--sort-order", "desc"];
      if (p.hebelMin != null) a.push("--leverage-min", fix(p.hebelMin)); if (p.hebelMax != null) a.push("--leverage-max", fix(p.hebelMax));
      if (p.barriereMin != null) a.push("--knockout-barrier-min", fix(p.barriereMin)); if (p.barriereMax != null) a.push("--knockout-barrier-max", fix(p.barriereMax));
      return leseDerivate(await run(a));
    },
    geld: async () => leseGeld(await run(["broker", "cash-breakdown"])),
    bestand: async () => leseBestand(await run(["broker", "holdings"])),
    umsaetze: async () => ((await run(["broker", "transactions"])) as { items?: Record<string, unknown>[] }).items ?? [],
    /** Phase 1: nur Vorschau, es wird nichts ausgeführt */
    async vorschau(o: ScOrder, jetzt = Date.now()): Promise<ScVorschau> { const args = orderArgs(o); return leseVorschau(await run(args), o, args, jetzt); },
    /** Phase 2: nur nach Freigabe durch den Nutzer; wiederholt exakt die Argumente der Vorschau */
    async ausfuehren(v: ScVorschau, opts: { angemessenheitBestaetigt?: boolean } = {}, jetzt = Date.now()): Promise<ScAusfuehrung> {
      if (jetzt > v.gueltigBis) throw new ScFehler("expired", "Die Vorschau ist abgelaufen (15 Minuten). Bitte neu vorbereiten.");
      if (v.angemessenheit && !opts.angemessenheitBestaetigt) throw new ScFehler("acknowledgement_required", "Bitte zuerst den Angemessenheitshinweis bestätigen.");
      const args = [...v.args, ...(v.angemessenheit ? ["--acknowledge-appropriateness-warning"] : []), "--confirm", v.bestaetigungsId];
      return leseAusfuehrung(await run(args));
    },
    stornieren: async (orderId: string) => { if (!/^[\w-]{4,80}$/.test(orderId)) throw new ScFehler("invalid_input", "Ungültige Order-ID"); return run(["broker", "trade", "cancel", "--order-id", orderId]); },
  };
}
export type Scalable = ReturnType<typeof scalable>;
