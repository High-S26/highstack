"use client";
import { DAX_ETF_ISIN, FAKTOREN, produktplan, type DaxRueckblick, type ScDerivat, type ScVorschau, type Tagessignal } from "@highstack/trading";
import { useEffect, useMemo, useState } from "react";
import { Zahl } from "../Felder";

type Daten = Record<string, { tage: number; bis: string | null; quelle: string | null; am: number | null } | { fehler: string }>;
interface Stand { datum: string; heute: string; daten: Daten; signal: Tagessignal | null; rueckblick: DaxRueckblick | null; dax: number | null; kursQuelle: string | null; scalable: { an: boolean; darf: boolean; echtgeld: boolean }; fehler?: string }
interface ScStand { an: boolean; darf?: boolean; echtgeld?: boolean; angemeldet?: boolean; konto?: string | null; fehler?: string; hinweis?: string; geld?: { guthaben: number | null; kaufkraft: number | null } | null; sperre?: { grund: string } | null }
type Vorschau = ScVorschau & { id: string; zweck?: string };

const eur = (v: number | null | undefined, d = 2) => v == null ? "–" : `${v.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d })} €`;
const pkt = (v: number | null | undefined) => v == null ? "–" : Math.round(v).toLocaleString("de-DE");
const pct = (v: number | null | undefined, d = 1, vz = false) => v == null ? "–" : `${vz && v > 0 ? "+" : vz && v < 0 ? "−" : ""}${Math.abs(v * 100).toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d })} %`;
const RICHTUNG = { long: "Long: steigender DAX", short: "Short: fallender DAX", keine: "Kein Trade" } as const;
const lies = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : d; } catch { return d; } };
const merke = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ohne Speicher */ } };
const post = async (url: string, body: unknown) => { const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.fehler ?? `Fehler ${r.status}`); return j; };

/** DAX-Tagestrade: Signal zur Eröffnung, Produkt mit Einsatz aus dem Risiko, Order über Scalable mit Freigabe, Rückblick */
export function DaxTag() {
  const [d, setD] = useState<Stand | null>(null); const [laedt, setLaedt] = useState(false); const [fehler, setFehler] = useState<string | null>(null);
  const [eroeffnung, setEroeffnung] = useState<number | null>(null);
  const [cfg, setCfg] = useState({ budget: 1000, risiko: 0.01, gebuehr: 0.99, maxHebel: 20 });
  useEffect(() => { setCfg(c => lies("hs_dax_cfg", c)); }, []);
  const setze = (p: Partial<typeof cfg>) => setCfg(c => { const n = { ...c, ...p }; merke("hs_dax_cfg", n); return n; });
  const laden = async (erzwingen = false) => {
    setLaedt(true); setFehler(null);
    try { const r = await fetch(`/api/trading/dax?${new URLSearchParams({ ...(eroeffnung ? { eroeffnung: String(eroeffnung) } : {}), ...(erzwingen ? { erzwingen: "1" } : {}) })}`); const j = await r.json(); if (!r.ok) throw new Error(j.fehler); setD(j); }
    catch (e) { setFehler((e as Error).message); } finally { setLaedt(false); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { laden(); }, []);
  const s = d?.signal;
  const plan = useMemo(() => s && s.richtung !== "keine" && s.atr && d?.dax ? produktplan({ dax: d.dax, richtung: s.richtung, atr: s.atr, budget: cfg.budget, risikoProzent: cfg.risiko, gebuehrJeOrder: cfg.gebuehr, maxHebel: cfg.maxHebel, risikoFaktor: s.risikoFaktor }) : null, [s, d?.dax, cfg]);

  return (
    <section className="panel dax">
      <div className="ph"><h2>DAX heute</h2><span className="tag">Tagestrade zur Eröffnung · {d?.datum ? `${d.datum.slice(8, 10)}.${d.datum.slice(5, 7)}.` : ""}</span></div>
      {fehler && <p className="note warn-t">{fehler}</p>}
      {!d && !fehler && <p className="note">Lädt Kurse …</p>}
      {d && !s && <Datenstand d={d} neu={() => laden(true)} />}
      {d && s && <>
        <div className="dax-kopf">
          <span className={`pill ${s.richtung === "long" ? "p-opp" : s.richtung === "short" ? "p-pass" : ""}`}>{RICHTUNG[s.richtung]}</span>
          {s.richtung !== "keine" && <span className="dax-staerke" aria-label={`Stärke ${Math.round(s.staerke * 100)} %`}><i style={{ width: `${Math.round(s.staerke * 100)}%` }} /></span>}
          <span className="note">DAX {pkt(d.dax)}{d.kursQuelle ? ` (${d.kursQuelle})` : s.bezug && !eroeffnung ? " (Vortagesschluss)" : ""} · Tagesspanne Ø {pkt(s.atr)} Punkte</span>
        </div>
        <ul className="flags">{s.gruende.map(g => <li key={g} className={s.richtung === "keine" ? "" : "good"}>{g}</li>)}{s.gegen.map(g => <li key={g}>{g}</li>)}</ul>
        {s.termine.length > 0 && <p className="note warn-t">Heute wichtig: {s.termine.join(" · ")}. Risiko je Trade halbiert; um die Uhrzeit keine neuen Einstiege.</p>}
        <div className="fields">
          <Zahl label="DAX zur Eröffnung" einheit="Punkte" min={1000} max={200000} wert={eroeffnung} onChange={setEroeffnung} hinweis={d.scalable.darf ? "leer: ab 9:00 live von Scalable" : "leer: Vortagesschluss; ab 9:00 den Eröffnungsstand eintragen"} />
          <div className="fld"><span className="flabel">&nbsp;</span><button type="button" className="btn ghost" disabled={laedt} onClick={() => laden()}>{laedt ? "Rechnet …" : "Signal neu rechnen"}</button></div>
        </div>
        {s.richtung !== "keine" && s.stopp && <p className="note">Einstieg zur Eröffnung, Stopp bei {pkt(s.stopp)} ({pkt(s.stoppPunkte)} Punkte, eine halbe Tagesspanne), Ausstieg spätestens zum Schluss um 17:30.</p>}

        <details className="dax-plan" open={!!plan}>
          <summary>Produkt und Einsatz</summary>
          <div className="fields">
            <Zahl label="Budget" einheit="€" min={10} max={1e7} wert={cfg.budget} onChange={v => v && setze({ budget: v })} />
            <Zahl label="Risiko je Trade" prozent min={0.1} max={10} wert={cfg.risiko} onChange={v => v && setze({ risiko: v })} hinweis="Verlust am Stopp in % des Budgets" />
            <Zahl label="Ordergebühr" einheit="€" min={0} max={50} wert={cfg.gebuehr} onChange={v => setze({ gebuehr: v ?? 0 })} hinweis="je Kauf und Verkauf; Scalable FREE 0,99 €" />
            <Zahl label="Höchster Hebel" min={1} max={50} wert={cfg.maxHebel} onChange={v => v && setze({ maxHebel: v })} />
          </div>
          {!plan ? <p className="note">Ohne Signal kein Einsatz. Ein Tag ohne Trade ist auch ein Ergebnis.</p> : <>
            <div className="tbl"><table><thead><tr><th></th><th className="num">DAX-ETF</th><th className="num">Knock-out {s.richtung}</th></tr></thead><tbody>
              <tr><td>Hebel</td><td className="num">1</td><td className="num">{plan.ko.hebel.toLocaleString("de-DE")}</td></tr>
              <tr><td>Knock-out-Barriere</td><td className="num">–</td><td className="num">{pkt(plan.ko.barriere)} ({pct(plan.ko.abstandProzent)} weg)</td></tr>
              <tr><td>Einsatz</td><td className="num">{eur(plan.etf.einsatz)}</td><td className="num">{eur(plan.ko.einsatz)}</td></tr>
              <tr><td>Verlust am Stopp <span className="note">inkl. Gebühren</span></td><td className="num neg">{eur(-plan.etf.verlustBeiStopp)}</td><td className="num neg">{eur(-plan.ko.verlustBeiStopp)}</td></tr>
              {plan.szenarien.map(x => <tr key={x.dax}><td>DAX {pct(x.dax, 2, true)}{Math.abs(Math.abs(x.dax) - plan.stoppProzent) < 1e-9 ? " (Stopp)" : ""}</td><td className={`num${x.etf < 0 ? " neg" : ""}`}>{eur(x.etf)}</td><td className={`num${x.ko < 0 ? " neg" : ""}`}>{eur(x.ko)}</td></tr>)}
            </tbody></table></div>
            <ul className="flags">{plan.hinweise.map(h => <li key={h}>{h}</li>)}</ul>
            {d.scalable.darf ? <ScalableOrder plan={plan} richtung={s.richtung as "long" | "short"} /> :
              <p className="note">{d.scalable.an ? "Order über Scalable ist nur für Admins dieses Servers freigeschaltet." : "Order direkt bei Scalable: mit der offiziellen Scalable CLI möglich (SCALABLE_CLI=1 in .env, `sc login` im Terminal). Sonst Order von Hand in der App."}</p>}
          </>}
        </details>
        {d.rueckblick && <Rueckblick r={d.rueckblick} />}
        <details><summary>Datenstand</summary><Datenstand d={d} neu={() => laden(true)} /></details>
      </>}
      <p className="note">Rechnerisches Signal aus historischen Zusammenhängen, keine Anlageberatung. Hebelprodukte können bis zum Totalverlust führen.</p>
    </section>
  );
}

function Rueckblick({ r }: { r: DaxRueckblick }) {
  return (
    <details className="dax-rb">
      <summary>Wie gut war das Signal bisher? ({r.trades} Trades seit {r.von.slice(0, 4)})</summary>
      <p className="note">Jeder Tag nur mit dem Wissen bis zum Vortag entschieden (Gewichte alle 20 Tage neu gelernt), Ausstieg am Stopp oder zum Schluss, Kosten {pct(r.kosten, 2)} je Runde. Prozent beziehen sich auf den DAX, mit Hebel entsprechend mehr.</p>
      <div className="tbl"><table><thead><tr><th></th><th className="num">Signal</th><th className="num">Jeden Tag long</th></tr></thead><tbody>
        <tr><td>Trades</td><td className="num">{r.trades} von {r.tage} Tagen</td><td className="num">{r.immerLong.trades}</td></tr>
        <tr><td>Trefferquote</td><td className="num">{pct(r.trefferquote, 0)}</td><td className="num">{pct(r.immerLong.trefferquote, 0)}</td></tr>
        <tr><td>Ø je Trade</td><td className={`num${r.schnitt < 0 ? " neg" : ""}`}>{pct(r.schnitt, 3, true)}</td><td className={`num${r.immerLong.schnitt < 0 ? " neg" : ""}`}>{pct(r.immerLong.schnitt, 3, true)}</td></tr>
        <tr><td>Summe</td><td className={`num${r.summe < 0 ? " neg" : ""}`}>{pct(r.summe, 1, true)}</td><td className={`num${r.immerLong.summe < 0 ? " neg" : ""}`}>{pct(r.immerLong.summe, 1, true)}</td></tr>
        <tr><td>Gewinnfaktor</td><td className="num">{r.gewinnfaktor?.toLocaleString("de-DE", { maximumFractionDigits: 2 }) ?? "–"}</td><td /></tr>
        <tr><td>Größter Rückgang</td><td className="num neg">{pct(-r.maxRueckgang, 1)}</td><td /></tr>
      </tbody></table></div>
      <div className="lbl">Faktoren über die ganze Historie</div>
      <div className="tbl"><table><thead><tr><th>Faktor</th><th className="num">Tage</th><th className="num">Treffer</th><th className="num">Ø Tag</th><th className="num">Gewicht</th></tr></thead><tbody>
        {r.faktoren.map(f => <tr key={f.id}><td>{FAKTOREN[f.id].name}<div className="note">{FAKTOREN[f.id].text}</div></td><td className="num">{f.n}</td><td className="num">{pct(f.treffer, 0)}</td><td className="num">{pct(f.schnitt, 3, true)}</td><td className="num">{f.gewicht === 0 ? "kein Vorteil" : f.gewicht.toLocaleString("de-DE", { maximumFractionDigits: 2 })}</td></tr>)}
      </tbody></table></div>
      <p className="note">Gewicht 0 heißt: kein statistisch belegter Vorteil (t-Wert unter 2); der Faktor zählt dann nicht. Ein negatives Gewicht heißt: Der Markt lief bisher eher gegen diese Richtung.</p>
      {r.letzte.length > 0 && <><div className="lbl">Letzte Signale</div><ul className="sr-liste">{r.letzte.slice(0, 8).map(x => <li key={x.d}><span /><span>{x.d.slice(8, 10)}.{x.d.slice(5, 7)}. {x.richtung}{x.gestoppt ? " · gestoppt" : ""}</span><b className={x.ergebnis < 0 ? "neg" : ""}>{pct(x.ergebnis, 2, true)}</b><span /></li>)}</ul></>}
    </details>
  );
}

function Datenstand({ d, neu }: { d: Stand; neu: () => void }) {
  const [id, setId] = useState("dax"); const [msg, setMsg] = useState<string | null>(null);
  const hoch = async (f: File | undefined) => { if (!f) return; try { const r = await post("/api/trading/dax", { aktion: "upload", id, csv: await f.text() }); setMsg(`${r.tage} Tage bis ${r.bis} übernommen.`); neu(); } catch (e) { setMsg((e as Error).message); } };
  const namen: Record<string, string> = { dax: "DAX", spx: "S&P 500", nikkei: "Nikkei 225" };
  return (
    <div className="dax-daten">
      <ul className="sr-liste">{Object.entries(d.daten).map(([k, v]) => <li key={k}><span /><span>{namen[k] ?? k}</span><b>{"fehler" in v ? <span className="warn-t">{v.fehler}</span> : `${v.tage} Tage bis ${v.bis ?? "–"}`}</b><span className="note">{"fehler" in v ? "" : v.quelle}</span></li>)}</ul>
      <div className="row"><button type="button" className="btn sm ghost" onClick={neu}>Neu laden</button>
        <select value={id} onChange={e => setId(e.target.value)} aria-label="Reihe für den Upload">{Object.entries(namen).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
        <label className="btn sm ghost">CSV hochladen<input type="file" accept=".csv,text/csv" hidden onChange={e => hoch(e.target.files?.[0])} /></label></div>
      {msg && <p className="note">{msg}</p>}
      <p className="note">Tageskurse von Stooq (frei), zwischengespeichert. Ohne Internetzugang: CSV mit Date, Open, High, Low, Close hochladen.</p>
    </div>
  );
}

/** Order über Scalable: Produkt wählen, Vorschau holen, mit Klick freigeben; danach Stopp-Order und Schließen */
function ScalableOrder({ plan, richtung }: { plan: NonNullable<ReturnType<typeof produktplan>>; richtung: "long" | "short" }) {
  const [st, setSt] = useState<ScStand | null>(null); const [kos, setKos] = useState<ScDerivat[] | null>(null); const [wahl, setWahl] = useState<string>("ko");
  const [v, setV] = useState<Vorschau | null>(null); const [ok, setOk] = useState(false); const [msg, setMsg] = useState<string | null>(null); const [laeuft, setLaeuft] = useState(false);
  const [ausgefuehrt, setAusgefuehrt] = useState<{ isin: string; orderId: string | null; zweck?: string }[]>([]);
  const lade = () => fetch("/api/trading/scalable").then(r => r.json()).then(setSt).catch(() => setSt({ an: false, fehler: "nicht erreichbar" }));
  useEffect(() => { lade(); }, []);
  const tu = async (f: () => Promise<void>) => { setLaeuft(true); setMsg(null); try { await f(); } catch (e) { setMsg((e as Error).message); lade(); } finally { setLaeuft(false); } };
  const isin = wahl === "etf" ? DAX_ETF_ISIN : wahl;
  const einsatz = wahl === "etf" ? plan.etf.einsatz : plan.ko.einsatz;
  const suche = () => tu(async () => { const b = plan.ko.barriere; const r = await post("/api/trading/scalable", { aktion: "derivate", richtung, ...(richtung === "long" ? { barriereMin: Math.round(b * 0.97), barriereMax: b } : { barriereMin: b, barriereMax: Math.round(b * 1.03) }) }); setKos(r.items); if (r.items[0]) setWahl(r.items[0].isin); else setMsg("Kein Knock-out mit passender Barriere gefunden. Barriere oder Hebel anpassen."); });
  const vorbereiten = (order: Record<string, unknown>, zweck: string) => tu(async () => { setOk(false); setV(await post("/api/trading/scalable", { aktion: "vorschau", order, zweck })); });
  const stueckIm = async (i: string) => { const r = await post("/api/trading/scalable", { aktion: "bestand" }); return (r.items as { isin: string; stueck: number }[]).find(x => x.isin === i)?.stueck ?? 0; };
  const stoppVorbereiten = (i: string) => tu(async () => {
    const n = await stueckIm(i); if (!n) throw new Error("Noch kein Bestand: Die Kauf-Order ist wohl noch nicht ausgeführt. Gleich noch einmal versuchen.");
    const k = await post("/api/trading/scalable", { aktion: "kurs", isin: i }); const preis = k.bid ?? k.mid; if (!preis) throw new Error("Kein Kurs für die Stopp-Berechnung.");
    const abstand = i === DAX_ETF_ISIN ? plan.stoppProzent : Math.min(0.9, plan.ko.stoppImProdukt);
    setV(await post("/api/trading/scalable", { aktion: "vorschau", order: { seite: "verkauf", isin: i, stueck: n, art: "stop", stopp: Math.round(preis * (1 - abstand) * 100) / 100 }, zweck: "Schutz-Stopp" }));
  });
  const schliessen = (i: string) => tu(async () => { const n = await stueckIm(i); if (!n) throw new Error("Kein Bestand in diesem Papier."); setV(await post("/api/trading/scalable", { aktion: "vorschau", order: { seite: "verkauf", isin: i, stueck: n, art: "market" }, zweck: "Schließen" })); });
  const freigeben = () => v && tu(async () => { const r = await post("/api/trading/scalable", { aktion: "freigeben", id: v.id, angemessenheit: ok }); setAusgefuehrt(a => [{ isin: v.order.isin, orderId: r.orderId, zweck: v.zweck }, ...a]); setMsg(`Übermittelt${r.orderId ? ` (Order ${r.orderId})` : ""}. Status in der Scalable-App.`); setV(null); lade(); });
  const verwerfen = () => v && tu(async () => { await post("/api/trading/scalable", { aktion: "verwerfen", id: v.id }); setV(null); });

  if (!st) return <p className="note">Verbindung zu Scalable wird geprüft …</p>;
  if (!st.an || st.darf === false) return <p className="note">{st.hinweis}</p>;
  if (!st.angemeldet) return <div className="sc-box"><b>Scalable nicht angemeldet</b><p className="note">{st.fehler}</p><p className="note">Einmalig: im Scalable-Web unter Profil → Sicherheit → Agentic Investing die CLI freischalten, dann im Terminal <code>sc login</code>. Die Sitzung hält höchstens sieben Tage.</p><button type="button" className="btn sm ghost" onClick={lade}>Erneut prüfen</button></div>;
  const ablauf = v ? Math.max(0, Math.round((v.gueltigBis - Date.now()) / 60000)) : 0;
  return (
    <div className="sc-box">
      <div className="row"><b>Scalable</b><span className="note">angemeldet{st.konto ? ` · ${st.konto}` : ""}{st.geld?.kaufkraft != null ? ` · Kaufkraft ${eur(st.geld.kaufkraft)}` : ""}</span>{!st.echtgeld && <span className="tag">nur Vorschau (TRADING_LIVE aus)</span>}</div>
      {st.sperre && <p className="note warn-t">{st.sperre.grund} Bitte in der Scalable-App prüfen. <button type="button" className="linkbtn" onClick={() => tu(async () => { await post("/api/trading/scalable", { aktion: "entsperren" }); await lade(); })}>Geprüft, weiter</button></p>}
      <div className="row">
        <label className="sc-radio"><input type="radio" name="sc-prod" checked={wahl === "etf"} onChange={() => setWahl("etf")} /> DAX-ETF (iShares Core DAX) · Einsatz {eur(plan.etf.einsatz)}</label>
        <button type="button" className="btn sm ghost" disabled={laeuft} onClick={suche}>Knock-outs {richtung} suchen</button>
      </div>
      {kos && kos.length > 0 && <div className="tbl"><table><thead><tr><th></th><th>Emittent</th><th className="num">Hebel</th><th className="num">Barriere</th><th className="num">Abstand</th></tr></thead><tbody>
        {kos.slice(0, 6).map(k => <tr key={k.isin}><td><input type="radio" name="sc-prod" aria-label={k.isin} checked={wahl === k.isin} onChange={() => setWahl(k.isin)} /></td><td>{k.emittent ?? "–"}<div className="note">{k.isin}</div></td><td className="num">{k.hebel?.toLocaleString("de-DE", { maximumFractionDigits: 1 }) ?? "–"}</td><td className="num">{pkt(k.barriere)}</td><td className="num">{k.abstandKo != null ? pct(k.abstandKo > 1 ? k.abstandKo / 100 : k.abstandKo) : "–"}</td></tr>)}
      </tbody></table></div>}
      {!v && (wahl === "etf" || kos?.some(k => k.isin === wahl)) && <button type="button" className="btn" disabled={laeuft || !!st.sperre || einsatz < 1} onClick={() => vorbereiten({ seite: "kauf", isin, betrag: Math.floor(einsatz), art: "market" }, "DAX-Einstieg")}>Kauf über {eur(Math.floor(einsatz), 0)} vorbereiten</button>}
      {v && <div className="sc-vorschau" role="region" aria-label="Order-Vorschau">
        <b>{v.order.seite === "kauf" ? "Kauf" : "Verkauf"} {v.name ?? v.order.isin}{v.zweck ? ` · ${v.zweck}` : ""}</b>
        <ul className="sr-liste">
          <li><span /><span>Kurs (Geld / Brief)</span><b>{v.kurs.bid ?? "–"} / {v.kurs.ask ?? "–"} {v.kurs.waehrung ?? ""}</b><span /></li>
          <li><span /><span>Stück · Volumen (geschätzt)</span><b>{v.stueck ?? "–"} · {eur(v.volumen)}</b><span /></li>
          <li><span /><span>Ordertyp</span><b>{v.order.art}{v.order.stopp ? ` · Stopp ${v.order.stopp}` : ""}{v.order.limit ? ` · Limit ${v.order.limit}` : ""}</b><span /></li>
          <li><span /><span>Handelsplatz</span><b>{v.boerse ?? "–"}</b><span /></li>
        </ul>
        {v.hinweise.length > 0 && <ul className="flags">{v.hinweise.map(h => <li key={h}>{h}</li>)}</ul>}
        {v.kosten != null && <details><summary>Kosteninformation von Scalable</summary><pre className="sc-kosten">{JSON.stringify(v.kosten, null, 2)}</pre></details>}
        {v.angemessenheit && <label className="sc-ok"><input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} /> Scalable weist darauf hin, dass dieses Produkt nicht zu den Angaben in Ihrem Profil passen könnte. Ich habe den Hinweis gelesen und möchte trotzdem handeln.</label>}
        <div className="row">
          <button type="button" className="btn" disabled={laeuft || !st.echtgeld || (v.angemessenheit && !ok) || ablauf <= 0} onClick={freigeben}>Freigeben und an Scalable senden</button>
          <button type="button" className="btn ghost" disabled={laeuft} onClick={verwerfen}>Verwerfen</button>
          <span className="note">{ablauf > 0 ? `gültig noch ${ablauf} Min.` : "abgelaufen, bitte neu vorbereiten"}</span>
        </div>
        {!st.echtgeld && <p className="note">Ausführen ist auf diesem Server aus. Zum Einschalten TRADING_LIVE=1 in .env setzen.</p>}
      </div>}
      {ausgefuehrt.map(a => <div key={`${a.isin}-${a.orderId}`} className="row"><span className="note">{a.zweck ?? "Order"} {a.isin}{a.orderId ? ` · ${a.orderId}` : ""}</span>
        {a.zweck === "DAX-Einstieg" && <><button type="button" className="btn sm ghost" disabled={laeuft} onClick={() => stoppVorbereiten(a.isin)}>Schutz-Stopp vorbereiten</button><button type="button" className="btn sm ghost" disabled={laeuft} onClick={() => schliessen(a.isin)}>Schließen vorbereiten</button></>}
        {a.orderId && <button type="button" className="linkbtn" disabled={laeuft} onClick={() => tu(async () => { await post("/api/trading/scalable", { aktion: "stornieren", orderId: a.orderId }); setMsg("Storno gesendet; Status in der App."); })}>stornieren</button>}</div>)}
      {msg && <p className="note" role="status">{msg}</p>}
      <p className="note">Jede Order läuft in zwei Schritten: Vorschau von Scalable, dann Ihre Freigabe mit Klick. Ohne Freigabe geht nichts raus; eine Vorschau gilt 15 Minuten.</p>
    </div>
  );
}
