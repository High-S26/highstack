import { describe, expect, it } from "vitest";
import { istIsin, leseAntwort, orderArgs, scalable, ScFehler, type ScAusfuehrer } from "../src/scalable";

const ok = (data: unknown) => ({ stdout: JSON.stringify({ ok: true, command: "x", data }), code: 0 });
const vorschauAntwort = { result: { intent: { isin: "DE0005933931" }, market_quote: { mid_price: "212.40", bid_price: "212.38", ask_price: "212.42", currency: "EUR" }, calculation: { shares: "2", estimated_order_volume: "424.84" }, tradability: { tradable: true, selected_venue_label: "gettex" }, price_warnings: { items: [] }, ex_ante_costs: { total: "0.99" }, suitability: { requires_appropriateness_warning_acknowledgement: false }, order_submission: { submitted: false, reason: "phase_1_preview_only" } }, confirmation: { id: "conf-1" }, next_step: "confirm_with_id" };

describe("Scalable CLI", () => {
  it("ISIN mit Prüfziffer", () => { expect(istIsin("DE0005933931")).toBe(true); expect(istIsin("DE0008469008")).toBe(true); expect(istIsin("US0378331005")).toBe(true); expect(istIsin("US0378331006")).toBe(false); expect(istIsin("AAPL")).toBe(false); });
  it("Order-Argumente streng", () => {
    expect(orderArgs({ seite: "kauf", isin: "DE0005933931", betrag: 250, art: "market" })).toEqual(["broker", "trade", "buy", "--isin", "DE0005933931", "--amount", "250", "--order-type", "market"]);
    expect(orderArgs({ seite: "verkauf", isin: "DE0005933931", stueck: 2, art: "stop", stopp: 200.5, boerse: "xetra" })).toEqual(["broker", "trade", "sell", "--isin", "DE0005933931", "--shares", "2", "--order-type", "stop", "--stop-price", "200.5", "--venue", "xetra"]);
    expect(() => orderArgs({ seite: "kauf", isin: "DE0005933931", betrag: 100, stueck: 1, art: "market" })).toThrow(/entweder/);
    expect(() => orderArgs({ seite: "kauf", isin: "DE0005933931", stueck: 1.5, art: "market" })).toThrow(/ganze/);
    expect(() => orderArgs({ seite: "verkauf", isin: "DE0005933931", stueck: 1, art: "stop-limit", stopp: 10 })).toThrow(/Limit/);
    expect(() => orderArgs({ seite: "kauf", isin: "DE0005933931; rm -rf", betrag: 1, art: "market" })).toThrow(/ISIN/);
  });
  it("Fehler mit verständlichem Text", () => {
    expect(() => leseAntwort(JSON.stringify({ ok: false, error: { code: "no_session", message: "x" } }))).toThrow(/sc login/);
    try { leseAntwort(JSON.stringify({ ok: false, error: { code: "order_submission_failed", message: "x" } })); } catch (e) { expect((e as ScFehler).ausgangUnbekannt).toBe(true); }
    expect(() => leseAntwort("", 127)).toThrow(/nicht gefunden/);
  });
  it("zwei Schritte: Ausführen wiederholt exakt die Vorschau mit --confirm", async () => {
    const aufrufe: string[][] = [];
    const sc: ScAusfuehrer = async a => { aufrufe.push(a); return a.includes("--confirm") ? ok({ result: { order_submission: { submitted: true, order_id: "ord-9" } }, confirmation: { id: "conf-1", consumed: true }, next_step: "completed" }) : ok(vorschauAntwort); };
    const s = scalable(sc);
    const v = await s.vorschau({ seite: "kauf", isin: "DE0005933931", betrag: 425, art: "market" }, 1000);
    expect(v.bestaetigungsId).toBe("conf-1"); expect(v.kurs.mid).toBe(212.4); expect(v.stueck).toBe(2); expect(v.volumen).toBe(424.84); expect(v.boerse).toBe("gettex");
    const r = await s.ausfuehren(v, {}, 2000);
    expect(r).toEqual({ orderId: "ord-9", uebermittelt: true });
    expect(aufrufe[1]).toEqual([...aufrufe[0]!.slice(0, -1), "--confirm", "conf-1", "--json"]);
  });
  it("abgelaufene Vorschau und Angemessenheit werden vor dem Ausführen geprüft", async () => {
    const s = scalable(async () => ok({ ...vorschauAntwort, result: { ...vorschauAntwort.result, suitability: { requires_appropriateness_warning_acknowledgement: true } } }));
    const v = await s.vorschau({ seite: "kauf", isin: "DE0005933931", betrag: 100, art: "market" }, 0);
    await expect(s.ausfuehren(v, {}, 1000)).rejects.toThrow(/Angemessenheit/);
    await expect(s.ausfuehren(v, { angemessenheitBestaetigt: true }, 20 * 60_000)).rejects.toThrow(/abgelaufen/);
  });
  it("Knock-outs lesen", async () => {
    const s = scalable(async () => ok({ items: [{ isin: "DE000HS0AAA0", issuer: "HSBC", strategy: "LONG", leverage: "19.8", knockout_barrier: { kind: "point", value: "22850" }, distance_to_knockout: "0.05", expiry_is_open_end: true }, { isin: "kaputt" }] }));
    const l = await s.derivate({ basis: "DE0008469008", richtung: "long", barriereMax: 22900 });
    expect(l.length).toBeLessThanOrEqual(1);
  });
});
