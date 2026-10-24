"use client";
import { geld, type Kennzahlen } from "@highstack/trading";
import { useState } from "react";
import { useApp } from "@/components/App";
import { Info } from "@/components/Info";
import type { GespeicherterRueckblick } from "@/lib/trading";

const pz = (v: number | null, n = 1) => v == null ? "–" : `${(v * 100).toLocaleString("de-DE", { minimumFractionDigits: n, maximumFractionDigits: n })} %`;
const z = (v: number | null, n = 2) => v == null ? "–" : v.toLocaleString("de-DE", { minimumFractionDigits: n, maximumFractionDigits: n });
const tag = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("de-DE");
const vor = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

const ZEILEN: [keyof Kennzahlen, string, (k: Kennzahlen) => string, string?][] = [
  ["rendite", "Rendite im Zeitraum", k => pz(k.rendite)],
  ["cagr", "Rendite aufs Jahr gerechnet", k => pz(k.cagr), "Nur ab 20 Handelstagen; kurze Zeiträume hochzurechnen übertreibt stark."],
  ["sharpe", "Sharpe", k => z(k.sharpe), "Rendite je Einheit Schwankung, aufs Jahr gerechnet. Über 1 ist gut, über 2 bei kurzen Zeiträumen verdächtig."],
  ["sortino", "Sortino", k => z(k.sortino), "Wie Sharpe, zählt aber nur Schwankung nach unten."],
  ["maxVerlust", "Größter Verlust vom Hoch", k => pz(k.maxVerlust)],
  ["calmar", "Calmar", k => z(k.calmar), "Jahresrendite geteilt durch größten Verlust."],
  ["erholungTage", "Längste Zeit unter dem Hoch", k => `${k.erholungTage} Tage`],
  ["cvar5", "Ø der schlechtesten 5 % Tage", k => pz(k.cvar5, 2)],
  ["trades", "Trades", k => String(k.trades)],
  ["trefferquote", "Trefferquote", k => pz(k.trefferquote, 0)],
  ["gewinnfaktor", "Gewinnfaktor", k => z(k.gewinnfaktor), "Summe der Gewinne geteilt durch Summe der Verluste. Unter 1 verliert die Strategie."],
  ["mittelR", "Ø Ergebnis je Trade", k => k.mittelR == null ? "–" : `${z(k.mittelR)} R`],
  ["umschlag", "Umschlag pro Jahr", k => k.umschlag == null ? "–" : `${z(k.umschlag, 0)} ×`, "Gehandeltes Volumen im Verhältnis zum Kapital; hoch heißt: Kosten fallen stark ins Gewicht."],
];

/** Verlauf des Kontos gegen den Vergleich, als schlichte Linien */
function Kurve({ reihen, start }: { reihen: { name: string; werte: number[]; klasse: string }[]; start: number }) {
  const alle = reihen.flatMap(r => r.werte).concat(start); const lo = Math.min(...alle), hi = Math.max(...alle); const n = Math.max(...reihen.map(r => r.werte.length));
  const W = 600, H = 160, x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W), y = (v: number) => H - ((v - lo) / (hi - lo || 1)) * (H - 8) - 4;
  return (
    <figure className="rb-kurve">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Kontoverlauf im Rückblick">
        <line x1="0" x2={W} y1={y(start)} y2={y(start)} className="rb-null" />
        {reihen.map(r => <polyline key={r.name} className={r.klasse} fill="none" points={r.werte.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />)}
      </svg>
      <figcaption>{reihen.map(r => <span key={r.name} className={`rb-leg ${r.klasse}`}>{r.name}</span>)}</figcaption>
    </figure>
  );
}

export function Rueckblick({ id, rueckblick, startkapital, alpacaMoeglich, onNeu }: { id: string; rueckblick?: GespeicherterRueckblick; startkapital: number; alpacaMoeglich: boolean; onNeu: () => void }) {
  const { meldung } = useApp();
  const [f, setF] = useState({ von: vor(120), bis: vor(1), quelle: (alpacaMoeglich ? "alpaca" : "simulation") as "alpaca" | "simulation", varianten: true });
  const [laeuft, setLaeuft] = useState(false);
  const rechnen = async () => {
    setLaeuft(true);
    try { const r = await fetch(`/api/trading/${id}/rueckblick`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) }); const d = await r.json(); if (!r.ok) throw new Error(d.fehler); meldung("Rückblick gerechnet"); onNeu(); }
    catch (e) { meldung((e as Error).message); } finally { setLaeuft(false); }
  };
  const r = rueckblick; const g = (v: number) => geld(v, r?.waehrung ?? "EUR");
  return (
    <section className="panel">
      <div className="ph"><h2>Rückblick</h2><Info label="Rückblick" text="Der Agent handelt mit genau Ihren Einstellungen Minute für Minute auf vergangenen Kursen und sieht dabei nur, was zu dem Zeitpunkt bekannt war. Verglichen wird mit Kaufen und Halten und mit der einfachen Regel „nur über der 200-Tage-Linie investiert“. Eine Strategie lohnt nur, wenn sie diese einfachen Regeln nach Kosten schlägt." /></div>
      <div className="fields">
        <div className="fld"><label htmlFor="rb-von">von</label><input id="rb-von" type="date" value={f.von} onChange={e => setF({ ...f, von: e.target.value })} /></div>
        <div className="fld"><label htmlFor="rb-bis">bis</label><input id="rb-bis" type="date" value={f.bis} onChange={e => setF({ ...f, bis: e.target.value })} /></div>
        <div className="fld"><label htmlFor="rb-q">Kurse</label><select id="rb-q" value={f.quelle} onChange={e => setF({ ...f, quelle: e.target.value as typeof f.quelle })}><option value="alpaca" disabled={!alpacaMoeglich}>Echte Kurse (Alpaca){alpacaMoeglich ? "" : ": Zugang fehlt"}</option><option value="simulation">Künstliche Kurse (Probe)</option></select></div>
      </div>
      <label className="chk"><input type="checkbox" checked={f.varianten} onChange={e => setF({ ...f, varianten: e.target.checked })} /> Varianten mitrechnen: andere Strategien, ohne Marktumfeld, andere Richtung</label>
      <button type="button" className="btn ghost" disabled={laeuft} onClick={rechnen}>{laeuft ? "Rechnet … (kann eine Minute dauern)" : "Rückblick rechnen"}</button>
      {r && <>
        <p className="note">Gerechnet am {new Date(r.am).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}: {tag(r.von)} bis {tag(r.bis)}, {r.kennzahlen.tage} Handelstage, {r.quelle === "alpaca" ? "echte Kurse" : "künstliche Kurse"}, Endwert {g(r.kennzahlen.endwert)}.</p>
        <Kurve start={startkapital} reihen={[{ name: "Agent", werte: r.kurve.map(k => k.wert), klasse: "rb-a" }, ...r.vergleich.slice(0, 1).map(v => ({ name: v.name, werte: v.kurve.map(k => k.wert), klasse: "rb-v" }))]} />
        <div className="tbl"><table><thead><tr><th>Kennzahl</th><th className="num">Agent</th>{r.vergleich.map(v => <th key={v.name} className="num">{v.name}</th>)}</tr></thead><tbody>
          {ZEILEN.map(([k, l, fmt, info]) => <tr key={k}><td>{l}{info && <> <Info label={l} text={info} /></>}</td><td className="num"><b>{fmt(r.kennzahlen)}</b></td>{r.vergleich.map(v => <td key={v.name} className="num">{["trades", "trefferquote", "gewinnfaktor", "mittelR"].includes(k) ? "–" : fmt(v.kennzahlen)}</td>)}</tr>)}
        </tbody></table></div>
        {r.varianten && r.varianten.length > 0 && <>
          <h3>Varianten (gleicher Zeitraum)</h3>
          <div className="tbl"><table><thead><tr><th>Variante</th><th className="num">Rendite</th><th className="num">Sharpe</th><th className="num">größter Verlust</th><th className="num">Trades</th><th className="num">Gewinnfaktor</th></tr></thead><tbody>
            <tr><td><b>Ihre Einstellungen</b></td><td className="num"><b>{pz(r.kennzahlen.rendite)}</b></td><td className="num">{z(r.kennzahlen.sharpe)}</td><td className="num">{pz(r.kennzahlen.maxVerlust)}</td><td className="num">{r.kennzahlen.trades}</td><td className="num">{z(r.kennzahlen.gewinnfaktor)}</td></tr>
            {r.varianten.map(v => <tr key={v.name}><td>{v.name}</td><td className="num">{pz(v.kennzahlen.rendite)}</td><td className="num">{z(v.kennzahlen.sharpe)}</td><td className="num">{pz(v.kennzahlen.maxVerlust)}</td><td className="num">{v.kennzahlen.trades}</td><td className="num">{z(v.kennzahlen.gewinnfaktor)}</td></tr>)}
          </tbody></table></div>
          <p className="note">Wer im Rückblick die beste Variante auswählt, passt sie an die Vergangenheit an. Belastbar ist erst, was danach in einem neuen Zeitraum ebenfalls besser abschneidet.</p>
        </>}
        <ul className="flags">{r.hinweise.map(h => <li key={h} className="info">{h}</li>)}</ul>
      </>}
    </section>
  );
}
