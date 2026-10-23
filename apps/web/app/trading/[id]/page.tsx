"use client";
import { STRATEGIEN, trefferbilanz, type Konto, type Position } from "@highstack/trading";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/App";
import { eur } from "@/lib/format";
import type { Agentansicht } from "@/lib/trading";
import { BROKER_NAMEN } from "@/lib/tradingTexte";

type Live = { konto: Konto | null; positionen: Position[]; uhr: { offen: boolean; minutenBisSchluss: number; zeit: string } | null; fehler: string | null };
const LOGART: Record<string, string> = { signal: "Signal", order: "Order", sperre: "Gesperrt", ausstieg: "Ausstieg", schluss: "Schluss", info: "Info", fehler: "Fehler" };

/** Cockpit eines Trading-Agenten: Stand, Grenzen, Positionen, Vorschläge, Protokoll, Not-Aus */
export default function Cockpit({ params }: { params: { id: string } }) {
  const { frage, meldung } = useApp(); const router = useRouter();
  const [a, setA] = useState<(Agentansicht & { live: Live }) | null>(null); const [laeuft, setLaeuft] = useState<string | null>(null);
  const [preise, setPreise] = useState<Record<string, string>>({}); const [zugang, setZugang] = useState({ keyId: "", secret: "" });
  const lade = useCallback(() => fetch(`/api/trading/${params.id}`).then(r => r.json()).then(d => d.fehler ? meldung(d.fehler) : setA(d)), [params.id, meldung]);
  useEffect(() => { lade(); const t = setInterval(lade, 5000); return () => clearInterval(t); }, [lade]);
  const [umfeld, setUmfeld] = useState<{ lage: string; faktor: number; gruende: string[] } | null>(null);
  useEffect(() => { fetch("/api/trading/umfeld").then(r => r.ok ? r.json() : null).then(setUmfeld).catch(() => null); }, []);
  const setzeMarktlage = async (an: boolean) => { const r = await fetch(`/api/trading/${params.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ marktlage: an }) }); if (r.ok) { meldung(an ? "Marktumfeld wird berücksichtigt" : "Marktumfeld wird ignoriert"); lade(); } };
  const aktion = async (b: object, text?: string) => {
    setLaeuft(JSON.stringify(b));
    try { const r = await fetch(`/api/trading/${params.id}/aktion`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }); const d = await r.json(); if (!r.ok) throw new Error(d.fehler); if (d.meldung || text) meldung(d.meldung ?? text); await lade(); }
    catch (e) { meldung((e as Error).message); } finally { setLaeuft(null); }
  };
  if (!a) return <p className="note">Lädt …</p>;
  const e = a.einstellungen; const z = a.zustand; const t = z.tag; const k = a.live.konto;
  const tagesGV = t && k ? k.equity - t.start : 0;
  const offen = z.vorschlaege.filter(v => v.status === "offen");
  const sim = e.broker === "simulation"; const manuell = e.broker === "manuell";
  const bil = trefferbilanz(z.abschluesse ?? []); const g = bil.gesamt;
  const zahl = (v: number | null, d = 2) => v == null ? "–" : v.toLocaleString("de-DE", { maximumFractionDigits: d, minimumFractionDigits: d });
  const balken = (wert: number, max: number) => `${Math.min(100, Math.max(0, (wert / max) * 100))}%`;
  const notaus = async () => { if (await frage({ titel: "Not-Aus auslösen?", text: manuell ? "Der Agent hält an. Offene Positionen schließen Sie in Ihrer App." : "Alle Positionen werden sofort zum Marktpreis geschlossen und der Agent hält an.", ja: "Not-Aus", gefahr: true })) aktion({ aktion: "notaus" }); };
  return (
    <div className="view">
      <div className="objbar"><Link className="btn ghost sm" href="/trading">← Trading</Link><h1>{e.name}</h1>
        <span className={`badge ${z.aktiv ? "b-on" : "b-plan"}`}>{z.aktiv ? (e.modus === "auto" ? "handelt" : "schlägt vor") : "angehalten"}</span>
        <span className="note">{BROKER_NAMEN[e.broker]}{e.brokerApp ? ` · ${e.brokerApp}` : ""} · {a.live.uhr ? `${a.live.uhr.zeit}, Markt ${a.live.uhr.offen ? `offen, noch ${a.live.uhr.minutenBisSchluss} Min.` : "geschlossen"}` : ""}</span>
        {z.aktiv ? <button type="button" className="btn sm ghost" onClick={() => aktion({ aktion: "stopp" }, "Agent angehalten")}>Anhalten</button> : <button type="button" className="btn sm" onClick={() => aktion({ aktion: "start" }, "Agent gestartet")}>Starten</button>}
        <button type="button" className="btn sm gefahr" onClick={notaus}>Not-Aus</button>
      </div>
      {a.live.fehler && <p className="hint">{a.live.fehler}</p>}
      {sim && <div className="testband">Simulation mit künstlichen Kursen: läuft der Agent, vergeht alle 5 Sekunden eine Handelsminute. {z.aktiv ? <button type="button" className="linkbtn" disabled={!!laeuft} onClick={() => aktion({ aktion: "tag" }, "Handelstag durchgespielt")}>{laeuft?.includes("tag") ? "spielt …" : "Rest des Tages sofort durchspielen"}</button> : <span>Zum Durchspielen den Agenten starten.</span>} · <button type="button" className="linkbtn" onClick={async () => { if (await frage({ titel: "Simulation zurücksetzen?", text: "Kontostand, Verlauf und Protokoll der Simulation werden gelöscht.", ja: "Zurücksetzen", gefahr: true })) aktion({ aktion: "zuruecksetzen" }, "Zurückgesetzt"); }}>zurücksetzen</button></div>}
      <div className="tiles">{([["Konto", k ? `${eur(k.equity)}` : "–"], ["heute", t ? `${tagesGV >= 0 ? "+" : ""}${eur(tagesGV)}` : "–"], ["Trades heute", t ? `${t.trades} / ${e.maxTradesTag}` : "–"], ["seit Start", k ? `${k.equity - e.startkapital >= 0 ? "+" : ""}${eur(k.equity - e.startkapital)}` : "–"]] as const).map(([l, v]) => <div key={l}><span>{l}</span><strong className={l !== "Konto" && l !== "Trades heute" && v.startsWith("-") ? "dn" : ""}>{v}</strong></div>)}</div>
      {t && <section className="panel tr-grenzen">
        <div className="ph"><h2>Heute</h2><span className="tag">{({ laeuft: "läuft", ziel: "Tagesziel erreicht", limit: "Verlustlimit erreicht", notaus: "Not-Aus", beendet: "beendet" } as Record<string, string>)[t.status]}</span></div>
        <div className="tr-balken"><span>Verlustlimit −{eur(e.tagesverlust)}</span><div className="tr-spur"><i className="neg" style={{ width: balken(-tagesGV, e.tagesverlust) }} /></div><div className="tr-spur"><i style={{ width: balken(tagesGV, e.tagesziel) }} /></div><span>Tagesziel +{eur(e.tagesziel)}</span></div>
      </section>}
      {umfeld && <div className={`tr-umfeld ${e.marktlage === false ? "" : umfeld.lage}`}>
        <b>Marktumfeld: {({ "risk-on": "Risikobereitschaft", neutral: "neutral", "risk-off": "Vorsicht" } as Record<string, string>)[umfeld.lage]}</b>
        <span>{e.marktlage === false ? "wird ignoriert, volle Positionsgröße" : `Positionsgröße ${Math.round(umfeld.faktor * 100)} %`}</span>
        <span className="note">{umfeld.gruende.join(" · ")}</span>
        <button type="button" className="linkbtn" onClick={() => setzeMarktlage(e.marktlage === false)}>{e.marktlage === false ? "berücksichtigen" : "ignorieren"}</button>
      </div>}
      {offen.length > 0 && <section className="panel">
        <div className="ph"><h2>{manuell ? "Order-Zettel" : "Vorschläge"}</h2><span className="tag">{offen.length} offen</span></div>
        {manuell && <p className="note">In {e.brokerApp || "Ihrer App"} ausführen, dann den tatsächlichen Kurs eintragen und bestätigen.</p>}
        <div className="tr-vorschlaege">{offen.map(v => (
          <div key={v.id} className={`tr-v ${v.antrag.seite}`}>
            <div><b>{v.antrag.seite === "kauf" ? "Kauf" : "Verkauf"} {v.antrag.qty} × {v.antrag.symbol}</b><span className="note">{v.zeit} · {v.art === "ausstieg" ? "Ausstieg" : "Einstieg"}</span></div>
            <p>{v.antrag.grund}{v.signal && <> · Stopp {eur(v.signal.stopp)}, Ziel {eur(v.signal.ziel)}, Kurs {eur(v.signal.kurs)}</>}</p>
            <div className="row">
              {manuell && <input aria-label="Ausführungskurs" inputMode="decimal" placeholder="Kurs" value={preise[v.id] ?? ""} onChange={x => setPreise(p => ({ ...p, [v.id]: x.target.value }))} style={{ width: 110 }} />}
              <button type="button" className="btn sm" disabled={!!laeuft || (manuell && !Number(preise[v.id]?.replace(",", ".")))} onClick={() => aktion({ aktion: "vorschlag", id: v.id, ok: true, preis: manuell ? Number(preise[v.id]!.replace(",", ".")) : undefined }, "Ausgeführt")}>{manuell ? "Ausgeführt" : "Ausführen"}</button>
              <button type="button" className="btn sm ghost" onClick={() => aktion({ aktion: "vorschlag", id: v.id, ok: false })}>Ablehnen</button>
            </div>
          </div>))}</div>
      </section>}
      <div className="two">
        <section className="panel"><h2>Positionen</h2>
          {a.live.positionen.length ? <div className="tbl"><table><thead><tr><th>Wert</th><th className="num">Stück</th><th className="num">Einstand</th><th className="num">Kurs</th><th className="num">G/V</th><th>Stopp / Ziel</th></tr></thead><tbody>
            {a.live.positionen.map(p => { const g = z.gefuehrt.find(x => x.symbol === p.symbol); return <tr key={p.symbol}><td><b>{p.symbol}</b>{p.qty < 0 && <span className="tag"> short</span>}</td><td className="num">{p.qty.toLocaleString("de-DE")}</td><td className="num">{eur(p.einstand)}</td><td className="num">{eur(p.kurs)}</td><td className={`num ${p.gv < 0 ? "dn" : "up"}`}>{eur(p.gv)}</td><td>{g ? `${eur(g.stopp)} / ${eur(g.ziel)}` : "–"}</td></tr>; })}
          </tbody></table></div> : <p className="note">Keine offenen Positionen.</p>}
          <p className="note">Strategie: {STRATEGIEN[e.strategie].name} · {e.symbole.join(", ")} · {e.richtung === "long" ? "nur Long" : "Long und Short"} · Risiko {(e.risikoProTrade * 100).toLocaleString("de-DE")} % je Trade</p>
        </section>
        <section className="panel"><h2>Verlauf</h2>
          {z.verlauf.length ? <div className="tbl"><table><thead><tr><th>Tag</th><th className="num">Ergebnis</th><th className="num">Trades</th><th>Ende</th></tr></thead><tbody>
            {z.verlauf.slice(0, 12).map(d => <tr key={d.datum}><td>{new Date(d.datum).toLocaleDateString("de-DE")}</td><td className={`num ${(d.ende ?? d.start) - d.start < 0 ? "dn" : "up"}`}>{eur((d.ende ?? d.start) - d.start)}</td><td className="num">{d.trades}</td><td>{({ ziel: "Ziel", limit: "Limit", notaus: "Not-Aus", beendet: "Schluss", laeuft: "–" } as Record<string, string>)[d.status]}</td></tr>)}
          </tbody></table></div> : <p className="note">Noch kein abgeschlossener Handelstag.</p>}
        </section>
      </div>
      <section className="panel">
        <div className="ph"><h2>Treffsicherheit der Signale</h2><span className="tag">{g.n} abgeschlossene Trades</span></div>
        <p className="note">Jedes Signal ist eine Prognose mit Stopp und Ziel. Hier steht, was daraus wurde. R ist das Ergebnis in Vielfachen des eingegangenen Risikos: +2 R heißt, das Ziel brachte das Doppelte dessen, was der Stopp gekostet hätte.</p>
        {g.n ? <>
          <div className="sys">{([["Trefferquote", g.trefferquote == null ? "–" : `${Math.round(g.trefferquote * 100)} %`], ["Ø Ergebnis je Trade", `${zahl(g.mittelR)} R`], ["Gewinnfaktor", zahl(g.gewinnfaktor)], ["Summe", eur(g.ergebnis)], ["Ziel / Stopp / Schluss", `${g.zielErreicht} / ${g.stoppErreicht} / ${g.n - g.zielErreicht - g.stoppErreicht}`]] as const).map(([l, v]) => <div key={l} className={(l === "Ø Ergebnis je Trade" && (g.mittelR ?? 0) < 0) || (l === "Summe" && g.ergebnis < 0) ? "warn" : ""}><span>{l}</span><b>{v}</b></div>)}</div>
          {bil.jeStaerke.length > 1 && <div className="tbl"><table><thead><tr><th>Signalstärke</th><th className="num">Trades</th><th className="num">Treffer</th><th className="num">Ø R</th></tr></thead><tbody>{bil.jeStaerke.map(x => <tr key={x.von}><td>{x.bis === Infinity ? `ab ${x.von.toLocaleString("de-DE")}` : `${x.von.toLocaleString("de-DE")} bis ${x.bis.toLocaleString("de-DE")}`}</td><td className="num">{x.n}</td><td className="num">{x.trefferquote == null ? "–" : `${Math.round(x.trefferquote * 100)} %`}</td><td className="num">{zahl(x.mittelR)}</td></tr>)}</tbody></table></div>}
          {g.n < 30 && <p className="note">Unter 30 Trades ist das noch Zufall. Aussagekräftig wird es ab etwa 100.</p>}
          <details><summary>Letzte Trades</summary><div className="tbl"><table><thead><tr><th>Wert</th><th className="num">Einstieg → Ausstieg</th><th className="num">Ergebnis</th><th>Ausstieg</th></tr></thead><tbody>{(z.abschluesse ?? []).slice(0, 15).map((x, i) => <tr key={i}><td><b>{x.symbol}</b> {x.richtung === "short" ? "short" : "long"}</td><td className="num">{eur(x.einstieg)} → {eur(x.ausstieg)}</td><td className={`num ${x.gv < 0 ? "dn" : "up"}`}>{eur(x.gv)} · {zahl(x.r)} R</td><td>{x.ausstiegGrund}</td></tr>)}</tbody></table></div></details>
        </> : <p className="note">Noch kein abgeschlossener Trade.</p>}
      </section>
      <section className="panel">
        <div className="ph"><h2>Protokoll</h2><button type="button" className="btn sm ghost" disabled={!!laeuft || !z.aktiv} title={z.aktiv ? undefined : "Agent ist angehalten"} onClick={() => aktion({ aktion: "takt" })}>Jetzt prüfen</button></div>
        <ol className="tr-log">{z.log.slice(0, 80).map((l, i) => <li key={i} className={`l-${l.art}`}><span className="tr-lz">{l.zeit.includes("T") ? new Date(l.zeit).toLocaleTimeString("de-DE") : l.zeit}</span><span className="tr-la">{LOGART[l.art]}</span><span>{l.text}</span></li>)}</ol>
      </section>
      {(e.broker === "alpaca-paper" || manuell) && <section className="panel"><h2>Alpaca-Zugang</h2>
        <p className="note">{a.zugangHinterlegt ? "Hinterlegt (verschlüsselt). Neu eintragen ersetzt ihn." : "Noch nicht hinterlegt."} {manuell ? "Dient nur als Kursquelle." : ""}</p>
        <div className="fields"><div className="fld"><label htmlFor="kid">API Key ID</label><input id="kid" value={zugang.keyId} onChange={x => setZugang(v => ({ ...v, keyId: x.target.value }))} /></div><div className="fld"><label htmlFor="ksec">Secret Key</label><input id="ksec" type="password" autoComplete="off" value={zugang.secret} onChange={x => setZugang(v => ({ ...v, secret: x.target.value }))} /></div></div>
        <button type="button" className="btn sm ghost" disabled={!zugang.keyId || !zugang.secret} onClick={() => { aktion({ aktion: "zugang", ...zugang }, "Zugang gespeichert"); setZugang({ keyId: "", secret: "" }); }}>Speichern</button>
      </section>}
      <div className="row"><button type="button" className="btn sm danger" onClick={async () => { if (z.aktiv) { meldung("Bitte den Agenten zuerst anhalten."); return; } if (await frage({ titel: "Agent löschen?", text: "Einstellungen, Verlauf und Protokoll werden gelöscht. Positionen beim Broker bleiben unberührt.", ja: "Löschen", gefahr: true })) { await fetch(`/api/trading/${a.id}`, { method: "DELETE" }); router.push("/trading"); } }}>Agent löschen</button></div>
    </div>
  );
}
