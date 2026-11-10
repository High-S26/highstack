"use client";
import { DAX_ETF_ISIN, FAKTOREN, ideeEinordnung, istIsin, ideeVarianten, positionsstand, stoppKurs, zielKurs, type DaxRueckblick, type Ideevariante, type Journaleintrag, type ScDerivat, type ScVorschau, type Tagessignal } from "@highstack/trading";
import { useEffect, useMemo, useRef, useState } from "react";
import { Zahl } from "../Felder";

type Daten = Record<string, { tage: number; bis: string | null; quelle: string | null; am: number | null } | { fehler: string }>;
interface Stand { datum: string; heute: string; daten: Daten; signal: Tagessignal | null; rueckblick: DaxRueckblick | null; dax: number | null; kursQuelle: string | null; scalable: { an: boolean; darf: boolean; echtgeld: boolean }; fehler?: string }
export interface ScStand { an: boolean; darf?: boolean; echtgeld?: boolean; angemeldet?: boolean; konto?: string | null; fehler?: string; hinweis?: string; geld?: { guthaben: number | null; kaufkraft: number | null } | null; sperre?: { grund: string } | null }
type Vorschau = ScVorschau & { id: string; zweck?: string };
interface Bilanzteil { trades: number; treffer: number | null; summe: number }
export interface Journal { eintraege: Journaleintrag[]; bilanz: { gesamt: Bilanzteil; eigene: Bilanzteil; modell: Bilanzteil } }
const berlinMin = () => { const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()).split(":").map(Number); return h! * 60 + m!; };

const eur = (v: number | null | undefined, d = 2) => v == null ? "–" : `${v.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d })} €`;
const pkt = (v: number | null | undefined) => v == null ? "–" : Math.round(v).toLocaleString("de-DE");
const pct = (v: number | null | undefined, d = 1, vz = false) => v == null ? "–" : `${vz && v > 0 ? "+" : vz && v < 0 ? "−" : ""}${Math.abs(v * 100).toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d })} %`;
const RICHTUNG = { long: "Long: steigender DAX", short: "Short: fallender DAX", keine: "Kein Trade" } as const;
const lies = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : d; } catch { return d; } };
const merke = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ohne Speicher */ } };
const post = async (url: string, body: unknown) => { const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.fehler ?? `Fehler ${r.status}`); return j; };

/** DAX-Tagestrade: Prüfliste, Signal, eigene Idee mit drei Umsetzungen, Order über Scalable, Positionen und Journal */
export function DaxTag() {
  const [d, setD] = useState<Stand | null>(null); const [laedt, setLaedt] = useState(false); const [fehler, setFehler] = useState<string | null>(null);
  const [eroeffnung, setEroeffnung] = useState<number | null>(null);
  const [cfg, setCfg] = useState({ gebuehr: 0.99, maxHebel: 20, betrag: 500 });
  const [modus, setModus] = useState<"modell" | "long" | "short">("modell"); const [notiz, setNotiz] = useState(""); const [variante, setVariante] = useState<Ideevariante["id"]>("ko-gleich");
  const [st, setSt] = useState<ScStand | null>(null); const [jr, setJr] = useState<Journal | null>(null);
  useEffect(() => { setCfg(c => ({ ...c, ...lies("hs_dax_cfg2", {}) })); }, []);
  const setze = (p: Partial<typeof cfg>) => setCfg(c => { const n = { ...c, ...p }; merke("hs_dax_cfg2", n); return n; });
  const laden = async (erzwingen = false) => {
    setLaedt(true); setFehler(null);
    try { const r = await fetch(`/api/trading/dax?${new URLSearchParams({ ...(eroeffnung ? { eroeffnung: String(eroeffnung) } : {}), ...(erzwingen ? { erzwingen: "1" } : {}) })}`); const j = await r.json(); if (!r.ok) throw new Error(j.fehler); setD(j); }
    catch (e) { setFehler((e as Error).message); } finally { setLaedt(false); }
  };
  const ladeSc = () => fetch("/api/trading/scalable").then(r => r.json()).then(setSt).catch(() => setSt({ an: false, fehler: "nicht erreichbar" }));
  const ladeJr = () => fetch("/api/trading/journal").then(r => r.json()).then(setJr).catch(() => null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { laden(); ladeSc(); ladeJr(); }, []);
  const s = d?.signal;
  const richtung: "long" | "short" | null = modus === "modell" ? (s && s.richtung !== "keine" ? s.richtung : null) : modus;
  const varianten = useMemo(() => richtung && s?.atr && d?.dax ? ideeVarianten({ dax: d.dax, richtung, atr: s.atr, betrag: cfg.betrag, gebuehrJeOrder: cfg.gebuehr, maxHebel: cfg.maxHebel }) : null, [richtung, s?.atr, d?.dax, cfg]);
  const einordnung = richtung ? ideeEinordnung(richtung, s ?? null, d?.rueckblick ?? null) : null;
  const gewaehlt = varianten?.find(v => v.id === variante) ?? null;

  return (
    <section className="panel dax">
      <div className="ph"><h2>DAX heute: Zahlen und Signal</h2><span className="tag">Tagestrade zur Eröffnung · {d?.datum ? `${d.datum.slice(8, 10)}.${d.datum.slice(5, 7)}.` : ""}</span></div>
      {fehler && <p className="note warn-t">{fehler}</p>}
      {!d && !fehler && <p className="note">Lädt Kurse …</p>}
      {d && <Startklar d={d} st={st} neu={() => { ladeSc(); laden(true); }} />}
      {d && !s && <Datenstand d={d} neu={() => laden(true)} />}
      {d && s && <>
        <div className="dax-kopf">
          <span className="note">Modell:</span>
          <span className={`pill ${s.richtung === "long" ? "p-opp" : s.richtung === "short" ? "p-pass" : ""}`}>{RICHTUNG[s.richtung]}</span>
          {s.richtung !== "keine" && <span className="dax-staerke" aria-label={`Stärke ${Math.round(s.staerke * 100)} %`}><i style={{ width: `${Math.round(s.staerke * 100)}%` }} /></span>}
          <span className="note">DAX {pkt(d.dax)}{d.kursQuelle ? ` (${d.kursQuelle})` : s.bezug && !eroeffnung ? " (Vortagesschluss)" : ""} · Tagesspanne Ø {pkt(s.atr)} Punkte</span>
        </div>
        <ul className="flags">{s.gruende.map(g => <li key={g} className={s.richtung === "keine" ? "" : "good"}>{g}</li>)}{s.gegen.map(g => <li key={g}>{g}</li>)}</ul>
        {s.termine.length > 0 && <p className="note warn-t">Heute wichtig: {s.termine.join(" · ")}. Um die Uhrzeit keine neuen Einstiege.</p>}
        <div className="fields">
          <Zahl label="DAX zur Eröffnung" einheit="Punkte" min={1000} max={200000} wert={eroeffnung} onChange={setEroeffnung} hinweis={d.scalable.darf ? "leer: ab 9:00 live von Scalable" : "leer: Vortagesschluss; ab 9:00 den Eröffnungsstand eintragen"} />
          <div className="fld"><span className="flabel">&nbsp;</span><button type="button" className="btn ghost" disabled={laedt} onClick={() => laden()}>{laedt ? "Rechnet …" : "Signal neu rechnen"}</button></div>
        </div>

        <div className="lbl">Ihre Idee</div>
        <div className="dax-seg" role="radiogroup" aria-label="Richtung">
          {([["modell", "Dem Modell folgen"], ["long", "DAX steigt"], ["short", "DAX fällt"]] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={modus === k} className={modus === k ? "on" : ""} onClick={() => setModus(k)}>{l}</button>)}
        </div>
        <div className="fields">
          <Zahl label="Betrag" einheit="€" min={10} max={1e6} wert={cfg.betrag} onChange={v => v && setze({ betrag: v })} hinweis="Wie viel Geld Sie für diese Idee einsetzen wollen" />
          <div className="fld"><div className="lrow"><label htmlFor="dax-notiz">Begründung (fürs Journal)</label></div><input id="dax-notiz" value={notiz} maxLength={300} placeholder="z. B. starke US-Vorgaben, Rekordhoch in Reichweite" onChange={e => setNotiz(e.target.value)} /></div>
        </div>
        {!richtung && <p className="note">Das Modell sieht heute keine Richtung. Wählen Sie „DAX steigt“ oder „DAX fällt“, wenn Sie eine eigene Idee haben, oder lassen Sie den Tag aus.</p>}
        {einordnung && <p className={`note${einordnung.modell === "dagegen" ? " warn-t" : ""}`}>{einordnung.text}{einordnung.grundrate != null ? ` Grundrate: An ${pct(einordnung.grundrate, 0)} der Tage lief der DAX von Eröffnung bis Schluss in Ihre Richtung` : ""}{einordnung.modellTreffer != null ? `, an Tagen mit diesem Modellsignal in ${pct(einordnung.modellTreffer, 0)}` : ""}{einordnung.grundrate != null ? "." : ""}</p>}
        {varianten && <>
          <div className="tbl"><table><thead><tr><th></th>{varianten.map(v => <th key={v.id} className="num"><label className="sc-radio" style={{ justifyContent: "flex-end" }}><input type="radio" name="dax-var" checked={variante === v.id} onChange={() => setVariante(v.id)} /> {v.titel}</label></th>)}</tr></thead><tbody>
            <tr><td>Einsatz</td>{varianten.map(v => <td key={v.id} className="num">{eur(v.einsatz)}</td>)}</tr>
            <tr><td>Am Ziel <span className="note">(eine Tagesspanne)</span></td>{varianten.map(v => <td key={v.id} className="num">{eur(v.amZiel)}</td>)}</tr>
            <tr><td>Am Stopp <span className="note">(halbe Tagesspanne)</span></td>{varianten.map(v => <td key={v.id} className="num neg">{eur(v.amStopp)}</td>)}</tr>
            <tr><td>DAX ±1 %</td>{varianten.map(v => <td key={v.id} className="num">{eur(v.beiPlus1)} / <span className="neg">{eur(v.beiMinus1)}</span></td>)}</tr>
            <tr><td>Totalverlust ab</td>{varianten.map(v => <td key={v.id} className="num">{v.totalverlustBei ? `DAX ${richtung === "long" ? "−" : "+"}${pct(v.totalverlustBei)} (${pkt(v.barriere)})` : "–"}</td>)}</tr>
          </tbody></table></div>
          <p className="note">{gewaehlt?.text} Werte inkl. {eur(cfg.gebuehr * 2)} Gebühren; Knock-out-Werte sind Näherungen, der Hebel ändert sich mit dem Kurs.{gewaehlt && cfg.gebuehr * 2 / Math.max(1, gewaehlt.einsatz) > 0.05 ? ` Achtung: Die Gebühren sind ${Math.round(cfg.gebuehr * 2 / gewaehlt.einsatz * 100)} % des Einsatzes.` : ""}</p>
          {d.scalable.darf && gewaehlt && richtung ? <ScalableOrder st={st} variante={gewaehlt} richtung={richtung} kontext={{ basis: "DAX", richtung, quelle: modus === "modell" ? "modell" : "eigene", idee: notiz || null, modell: { richtung: s.richtung, punkte: s.punkte } }} neu={() => { ladeJr(); ladeSc(); }} /> :
            <p className="note">{d.scalable.an ? "Order über Scalable ist nur für Admins dieses Servers freigeschaltet." : "Order direkt bei Scalable: mit der offiziellen Scalable CLI möglich (siehe Prüfliste oben). Sonst Order von Hand in der App."}</p>}
        </>}
        <details><summary>Einstellungen</summary><div className="fields">
          <Zahl label="Ordergebühr" einheit="€" min={0} max={50} wert={cfg.gebuehr} onChange={v => setze({ gebuehr: v ?? 0 })} hinweis="je Kauf und Verkauf; Scalable FREE 0,99 €, PRIME+ ab 250 € frei" />
          <Zahl label="Höchster Hebel" min={1} max={50} wert={cfg.maxHebel} onChange={v => v && setze({ maxHebel: v })} />
        </div></details>
        {d.rueckblick && <Rueckblick r={d.rueckblick} />}
        {jr && jr.eintraege.some(e => e.status === "geschlossen") && <JournalListe jr={jr} />}
        <details><summary>Datenstand</summary><Datenstand d={d} neu={() => laden(true)} /></details>
      </>}
      <p className="note">Rechnerisches Signal aus historischen Zusammenhängen, keine Anlageberatung. Hebelprodukte können bis zum Totalverlust führen.</p>
    </section>
  );
}

/** Was für den ersten echten Trade erledigt sein muss */
function Startklar({ d, st, neu }: { d: Stand; st: ScStand | null; neu: () => void }) {
  const datenOk = Object.values(d.daten).every(v => !("fehler" in v) && v.tage > 100);
  const punkte: [boolean, string, string][] = [
    [datenOk, "Kursdaten geladen", "Unten unter „Datenstand“ neu laden oder CSV hochladen."],
    [!!d.rueckblick, "Rückblick gerechnet", "Braucht mehrere Jahre Tageskurse von DAX, S&P 500 und Nikkei."],
    [d.scalable.an, "Scalable eingeschaltet", "In .env: SCALABLE_CLI=1, dann highstack neu starten."],
    [!!st?.angemeldet, "Bei Scalable angemeldet", "Scalable CLI installieren (brew tap ScalableCapital/tap && brew install scalable-cli), im Scalable-Web Profil → Sicherheit → Agentic Investing freischalten, im Terminal: sc login"],
    [d.scalable.echtgeld, "Ausführen erlaubt", "In .env: TRADING_LIVE=1. Ohne das sind nur Vorschauen möglich."],
    [typeof Notification !== "undefined" && Notification.permission === "granted", "Benachrichtigungen erlaubt", "Damit Ziel und Stopp melden, solange dieser Tab offen ist."],
  ];
  const fertig = punkte.filter(p => p[0]).length;
  return (
    <details className="startklar" open={fertig < punkte.length}>
      <summary>Startklar: {fertig} von {punkte.length}{fertig === punkte.length ? " ✓" : ""}</summary>
      <ul className="startklar-l">{punkte.map(([ok, t, h]) => <li key={t} className={ok ? "ok" : ""}><b>{ok ? "✓" : "○"} {t}</b>{!ok && <span className="note">{h}</span>}</li>)}</ul>
      <div className="row"><button type="button" className="btn sm ghost" onClick={neu}>Erneut prüfen</button>
        {typeof Notification !== "undefined" && Notification.permission !== "granted" && <button type="button" className="btn sm ghost" onClick={() => Notification.requestPermission().then(neu)}>Benachrichtigungen erlauben</button>}</div>
    </details>
  );
}

/** Offene Positionen: Kurs alle 30 Sekunden, Meldung an Ziel und Stopp, Verkauf vorbereiten */
export function Positionen({ eintraege, st, neu }: { eintraege: Journaleintrag[]; st: ScStand | null; neu: () => void }) {
  const [kurse, setKurse] = useState<Record<string, number | null>>({}); const [v, setV] = useState<Vorschau | null>(null); const [msg, setMsg] = useState<string | null>(null); const [laeuft, setLaeuft] = useState(false);
  const [hand, setHand] = useState<{ id: string; kurs: number | null } | null>(null);
  const gemeldet = useRef<Record<string, string>>({});
  // Kurse automatisch nur bei Scalable-Verbindung und echter ISIN (von Hand erfasste WKN: Kurs eintippen)
  const autoFuer = (e: Journaleintrag) => !!st?.angemeldet && istIsin(e.produkt.isin);
  const auto = eintraege.some(autoFuer);
  useEffect(() => {
    let aus = false; if (!auto) return;
    const hole = async () => {
      if (document.hidden) return;
      for (const e of eintraege.filter(autoFuer)) {
        try { const k = await post("/api/trading/scalable", { aktion: "kurs", isin: e.produkt.isin }); if (aus) return; const geld = k.bid ?? k.mid ?? null; setKurse(x => ({ ...x, [e.id]: geld }));
          const z = positionsstand(e, geld).zustand;
          if ((z === "ziel" || z === "stopp") && gemeldet.current[e.id] !== z) { gemeldet.current[e.id] = z; try { if (Notification.permission === "granted") new Notification(z === "ziel" ? "highstack: Ziel erreicht" : "highstack: Stopp erreicht", { body: `${e.produkt.name ?? e.produkt.isin}: ${z === "ziel" ? "Gewinnmitnahme" : "Verkauf"} freigeben?` }); } catch { /* ohne Meldung */ } }
        } catch { /* nächster Versuch */ }
      }
    };
    hole(); const t = setInterval(hole, 30_000); return () => { aus = true; clearInterval(t); };
  }, [eintraege, auto]);
  const tu = async (f: () => Promise<void>) => { setLaeuft(true); setMsg(null); try { await f(); } catch (e) { setMsg((e as Error).message); } finally { setLaeuft(false); } };
  const stueck = async (e: Journaleintrag) => { const r = await post("/api/trading/scalable", { aktion: "bestand" }); return (r.items as { isin: string; stueck: number }[]).find(x => x.isin === e.produkt.isin)?.stueck ?? e.einstieg.stueck ?? 0; };
  const verkaufen = (e: Journaleintrag, grund: string) => tu(async () => { const n = await stueck(e); if (!n) throw new Error("Kein Bestand gefunden. Schon verkauft? Dann „von Hand schließen“."); setV(await post("/api/trading/scalable", { aktion: "vorschau", order: { seite: "verkauf", isin: e.produkt.isin, stueck: n, art: "market" }, zweck: grund, kontext: { journalId: e.id, rolle: "schliessen" } })); });
  const stopp = (e: Journaleintrag) => tu(async () => { const n = await stueck(e); const k = stoppKurs(e); if (!n || !k) throw new Error("Bestand oder Einstiegskurs fehlt."); setV(await post("/api/trading/scalable", { aktion: "vorschau", order: { seite: "verkauf", isin: e.produkt.isin, stueck: n, art: "stop", stopp: k }, zweck: "Schutz-Stopp", kontext: { journalId: e.id, rolle: "stopp" } })); });
  const m = berlinMin(); const spaet = m >= 17 * 60 + 10 && m < 17 * 60 + 30; const zu = m >= 17 * 60 + 30 || m < 9 * 60;
  const k2 = (v: number | null | undefined) => v == null ? "–" : `${v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} €`;
  return (
    <div className="sc-box positionen">
      <b>Offene Positionen</b>
      {spaet && <p className="note warn-t">Xetra schließt um 17:30. Tagestrades jetzt schließen oder bewusst über Nacht halten (Kurslücke möglich).</p>}
      {zu && <p className="note">Xetra ist geschlossen. Knock-outs und ETFs laufen auf gettex und LS Exchange meist bis 22 bzw. 23 Uhr weiter, mit breiteren Spannen.</p>}
      {eintraege.map(e => { const k = kurse[e.id] ?? null; const p = positionsstand(e, k); return (
        <div key={e.id} className={`pos pos-${p.zustand}`}>
          <div className="row"><b>{e.produkt.name ?? e.produkt.isin}</b><span className="note">{e.richtung} · Hebel {e.produkt.hebel} · {e.einstieg.stueck ?? "?"} Stück zu {k2(e.einstieg.kurs)}</span></div>
          <ul className="sr-liste">
            {!autoFuer(e) && <li><span /><span>Aktueller Geldkurs in Ihrer App</span><b><input className="pos-kurs" inputMode="decimal" aria-label="Aktueller Geldkurs" placeholder="z. B. 8,42" onChange={x => { const n = Number(x.target.value.replace(",", ".")); setKurse(k2 => ({ ...k2, [e.id]: n > 0 ? n : null })); }} /></b><span /></li>}
            <li><span /><span>Jetzt (Geldkurs)</span><b className={(p.ergebnis ?? 0) < 0 ? "neg" : ""}>{k2(k)} · {p.ergebnis != null ? eur(p.ergebnis) : "–"} ({p.prozent != null ? pct(p.prozent, 1, true) : "–"})</b><span /></li>
            <li><span /><span>Ziel · Stopp im Produkt</span><b>{k2(zielKurs(e))} · {k2(stoppKurs(e))}{e.stopp ? " (Stopp-Order liegt)" : ""}</b><span /></li>
          </ul>
          {p.zustand === "ziel" && <p className="note good-t">Ziel erreicht. Gewinn mitnehmen?</p>}
          {p.zustand === "stopp" && <p className="note warn-t">Stopp unterschritten{e.stopp ? "; die Stopp-Order sollte ausgelöst haben. Bestand prüfen." : ". Verkauf freigeben?"}</p>}
          {!autoFuer(e) && <p className="note">In Ihrer App: Stop-Loss-Verkauf über {e.einstieg.stueck ?? "?"} Stück bei {k2(stoppKurs(e))} setzen. Am Ziel ({k2(zielKurs(e))}) oder spätestens 17:25 verkaufen, dann hier „von Hand schließen“.</p>}
          <div className="row">
            {autoFuer(e) && <button type="button" className="btn sm" disabled={laeuft || !!v} onClick={() => verkaufen(e, p.zustand === "ziel" ? "Gewinnmitnahme" : p.zustand === "stopp" ? "Stopp" : "Schließen")}>{p.zustand === "ziel" ? "Gewinn mitnehmen" : "Verkauf vorbereiten"}</button>}
            {autoFuer(e) && !e.stopp && <button type="button" className="btn sm ghost" disabled={laeuft || !!v} onClick={() => stopp(e)}>Schutz-Stopp setzen</button>}
            <button type="button" className="linkbtn" onClick={() => setHand({ id: e.id, kurs: k })}>von Hand schließen</button>
          </div>
          {hand?.id === e.id && <div className="row"><Zahl label="Verkaufskurs" einheit="€" min={0} max={1e6} wert={hand.kurs} onChange={x => setHand({ id: e.id, kurs: x })} /><button type="button" className="btn sm" disabled={!hand.kurs} onClick={() => tu(async () => { await post("/api/trading/journal", { aktion: "schliessen", id: e.id, kurs: hand.kurs, grund: "von Hand" }); setHand(null); neu(); })}>Ins Journal</button></div>}
        </div>); })}
      {v && st && <VorschauKarte v={v} st={st} fertig={r => { setV(null); setMsg(`Übermittelt${r.orderId ? ` (Order ${r.orderId})` : ""}.`); neu(); }} weg={() => setV(null)} />}
      {msg && <p className="note" role="status">{msg}</p>}
      <p className="note">{auto ? "Kurs alle 30 Sekunden von Scalable, solange dieser Tab offen ist. Jede Order braucht Ihre Freigabe." : "Ohne Scalable-Verbindung: Kurs aus Ihrer App eintragen, highstack zeigt, ob Ziel oder Stopp erreicht sind."}</p>
    </div>
  );
}

function JournalListe({ jr }: { jr: Journal }) {
  const zu = jr.eintraege.filter(e => e.status === "geschlossen").slice(0, 12); const b = jr.bilanz;
  return (
    <details className="journal">
      <summary>Journal: {b.gesamt.trades} Trades, {eur(b.gesamt.summe)}{b.gesamt.treffer != null ? `, ${pct(b.gesamt.treffer, 0)} Treffer` : ""}</summary>
      <div className="tbl"><table><thead><tr><th>Trade</th><th>Quelle</th><th className="num">Ergebnis</th></tr></thead><tbody>
        {zu.map(e => <tr key={e.id}><td>{new Date(e.am).toLocaleDateString("de-DE")} · {e.basis} {e.richtung} · {e.produkt.art === "ko" ? `KO ×${e.produkt.hebel}` : e.produkt.art.toUpperCase()}<div className="note">{e.idee ?? ""}{e.ausstieg ? ` · ${e.ausstieg.grund}` : ""}</div></td><td>{e.quelle === "eigene" ? "eigene Idee" : "Modell"}</td><td className={`num${(e.ergebnis ?? 0) < 0 ? " neg" : ""}`}>{eur(e.ergebnis)}</td></tr>)}
      </tbody></table></div>
      <p className="note">Eigene Ideen: {b.eigene.trades} Trades, {eur(b.eigene.summe)}{b.eigene.treffer != null ? `, ${pct(b.eigene.treffer, 0)} Treffer` : ""} · Modell: {b.modell.trades} Trades, {eur(b.modell.summe)}{b.modell.treffer != null ? `, ${pct(b.modell.treffer, 0)} Treffer` : ""}. Ergebnisse vor Gebühren.</p>
    </details>
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

/** Freigabe-Karte für eine Vorschau von Scalable */
export function VorschauKarte({ v, st, fertig, weg }: { v: Vorschau; st: ScStand; fertig: (r: { orderId: string | null }) => void; weg: () => void }) {
  const [ok, setOk] = useState(false); const [laeuft, setLaeuft] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  const ablauf = Math.max(0, Math.round((v.gueltigBis - Date.now()) / 60000));
  const tu = async (f: () => Promise<void>) => { setLaeuft(true); setMsg(null); try { await f(); } catch (e) { setMsg((e as Error).message); } finally { setLaeuft(false); } };
  return (
    <div className="sc-vorschau" role="region" aria-label="Order-Vorschau">
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
        <button type="button" className="btn" disabled={laeuft || !st.echtgeld || (v.angemessenheit && !ok) || ablauf <= 0} onClick={() => tu(async () => fertig(await post("/api/trading/scalable", { aktion: "freigeben", id: v.id, angemessenheit: ok })))}>Freigeben und an Scalable senden</button>
        <button type="button" className="btn ghost" disabled={laeuft} onClick={() => tu(async () => { await post("/api/trading/scalable", { aktion: "verwerfen", id: v.id }); weg(); })}>Verwerfen</button>
        <span className="note">{ablauf > 0 ? `gültig noch ${ablauf} Min.` : "abgelaufen, bitte neu vorbereiten"}</span>
      </div>
      {!st.echtgeld && <p className="note">Ausführen ist auf diesem Server aus. Zum Einschalten TRADING_LIVE=1 in .env setzen.</p>}
      {msg && <p className="note warn-t" role="alert">{msg}</p>}
    </div>
  );
}

export type Kontext = { basis: string; richtung: "long" | "short"; quelle: "eigene" | "modell"; idee: string | null; modell: { richtung: string; punkte: number } };
/** Einstieg über Scalable: ETF direkt, Knock-out aus der Suche; Vorschau, Freigabe, danach Position im Journal */
export function ScalableOrder({ st, variante, richtung, kontext, neu }: { st: ScStand | null; variante: Ideevariante; richtung: "long" | "short"; kontext: Kontext; neu: () => void }) {
  const [kos, setKos] = useState<ScDerivat[] | null>(null); const [wahl, setWahl] = useState<string | null>(null);
  const [v, setV] = useState<Vorschau | null>(null); const [msg, setMsg] = useState<string | null>(null); const [laeuft, setLaeuft] = useState(false);
  useEffect(() => { setKos(null); setWahl(null); setV(null); }, [variante.id, richtung]);
  const tu = async (f: () => Promise<void>) => { setLaeuft(true); setMsg(null); try { await f(); } catch (e) { setMsg((e as Error).message); } finally { setLaeuft(false); } };
  const istEtf = variante.id === "etf";
  const ko = kos?.find(k => k.isin === wahl) ?? null;
  const hebel = istEtf ? 1 : ko?.hebel ?? variante.hebel;
  // gleiche Marktgröße: Einsatz an den echten Hebel des gewählten Knock-outs anpassen
  const einsatz = variante.id === "ko-gleich" && ko?.hebel ? variante.einsatz * variante.hebel / ko.hebel : variante.einsatz;
  const suche = () => tu(async () => { const b = variante.barriere!; const r = await post("/api/trading/scalable", { aktion: "derivate", richtung, ...(richtung === "long" ? { barriereMin: Math.round(b * 0.97), barriereMax: b } : { barriereMin: b, barriereMax: Math.round(b * 1.03) }) }); setKos(r.items); setWahl(r.items[0]?.isin ?? null); if (!r.items.length) setMsg("Kein Knock-out mit passender Barriere gefunden. Höchsten Hebel unter „Einstellungen“ ändern."); });
  const vorbereiten = () => tu(async () => {
    const isin = istEtf ? DAX_ETF_ISIN : wahl!; let order: Record<string, unknown>;
    if (istEtf) order = { seite: "kauf", isin, betrag: Math.floor(einsatz), art: "market" };
    else { const k = await post("/api/trading/scalable", { aktion: "kurs", isin }); const brief = k.ask ?? k.mid; if (!brief) throw new Error("Kein Kurs für den Knock-out."); const n = Math.floor(einsatz / brief); if (n < 1) throw new Error(`Für ${eur(einsatz)} reicht es bei ${brief} € nicht für ein Stück.`); order = { seite: "kauf", isin, stueck: n, art: "market" }; }
    const stoppProdukt = Math.min(0.95, variante.stoppProdukt / variante.hebel * hebel), zielProdukt = variante.zielProdukt / variante.hebel * hebel;
    setV(await post("/api/trading/scalable", { aktion: "vorschau", order, zweck: "DAX-Einstieg", kontext: { neu: { ...kontext, art: istEtf ? "etf" : "ko", hebel, einsatz, stoppProdukt, zielProdukt } } }));
  });
  if (!st) return <p className="note">Verbindung zu Scalable wird geprüft …</p>;
  if (!st.an || st.darf === false) return <p className="note">{st.hinweis}</p>;
  if (!st.angemeldet) return <p className="note warn-t">Scalable ist nicht angemeldet: {st.fehler} (siehe Prüfliste oben)</p>;
  return (
    <div className="sc-box">
      <div className="row"><b>Umsetzen: {variante.titel}</b><span className="note">Scalable{st.konto ? ` · ${st.konto}` : ""}{st.geld?.kaufkraft != null ? ` · Kaufkraft ${eur(st.geld.kaufkraft)}` : ""}</span>{!st.echtgeld && <span className="tag">nur Vorschau</span>}</div>
      {st.sperre && <p className="note warn-t">{st.sperre.grund} Bitte in der Scalable-App prüfen. <button type="button" className="linkbtn" onClick={() => tu(async () => { await post("/api/trading/scalable", { aktion: "entsperren" }); neu(); })}>Geprüft, weiter</button></p>}
      {!istEtf && <button type="button" className="btn sm ghost" disabled={laeuft} onClick={suche}>Passende Knock-outs {richtung} suchen (Barriere um {pkt(variante.barriere)})</button>}
      {!istEtf && kos && kos.length > 0 && <div className="tbl"><table><thead><tr><th></th><th>Emittent</th><th className="num">Hebel</th><th className="num">Barriere</th><th className="num">Abstand</th></tr></thead><tbody>
        {kos.slice(0, 6).map(k => <tr key={k.isin}><td><input type="radio" name="sc-ko" aria-label={k.isin} checked={wahl === k.isin} onChange={() => setWahl(k.isin)} /></td><td>{k.emittent ?? "–"}<div className="note">{k.isin}</div></td><td className="num">{k.hebel?.toLocaleString("de-DE", { maximumFractionDigits: 1 }) ?? "–"}</td><td className="num">{pkt(k.barriere)}</td><td className="num">{k.abstandKo != null ? pct(k.abstandKo > 1 ? k.abstandKo / 100 : k.abstandKo) : "–"}</td></tr>)}
      </tbody></table></div>}
      {!v && (istEtf || ko) && <button type="button" className="btn" disabled={laeuft || !!st.sperre || einsatz < 1} onClick={vorbereiten}>Kauf über {eur(einsatz, 0)} vorbereiten</button>}
      {v && <VorschauKarte v={v} st={st} fertig={r => { setV(null); setMsg(`Übermittelt${r.orderId ? ` (Order ${r.orderId})` : ""}. Die Position steht oben unter „Offene Positionen“; dort Schutz-Stopp setzen.`); neu(); }} weg={() => setV(null)} />}
      {msg && <p className="note" role="status">{msg}</p>}
      <p className="note">Zwei Schritte: Vorschau von Scalable, dann Ihre Freigabe. Ohne Freigabe geht nichts raus; eine Vorschau gilt 15 Minuten.</p>
    </div>
  );
}
