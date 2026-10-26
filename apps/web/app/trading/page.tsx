"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Agentansicht } from "@/lib/trading";
import { BROKER_NAMEN } from "@/lib/tradingTexte";
import { eur } from "@/lib/format";
import { geld, geldPm } from "@highstack/trading";

/** Trading: Übersicht der Agenten */
export default function Trading() {
  const [l, setL] = useState<Agentansicht[] | null>(null); const [fehler, setFehler] = useState<string | null>(null);
  // Bei Netz- oder Serverfehler die bisherige Liste behalten und das sagen, statt „keine Agenten“ zu zeigen (TRD-045)
  useEffect(() => { const lade = () => fetch("/api/trading").then(async r => { if (!r.ok) throw new Error(`Fehler ${r.status}`); return r.json(); }).then(d => { setL(d); setFehler(null); }).catch(() => setFehler("Keine Verbindung zum Server: die Liste ist eventuell nicht aktuell.")); lade(); const t = setInterval(lade, 10000); return () => clearInterval(t); }, []);
  return (
    <div className="view">
      <div className="start-kopf"><h1>Trading</h1><p className="lead">Agenten, die Märkte beobachten, Signale begründen und innerhalb Ihrer Grenzen handeln oder vorschlagen.</p></div>
      {fehler && <p className="hint bad" role="status">{fehler}</p>}
      {!l && fehler && <p className="note">Agenten konnten nicht geladen werden.</p>}
      {l && !l.length && <section className="panel tr-leer">
        <h2>Ersten Agenten einstellen</h2>
        <p>Starten Sie in der Simulation mit künstlichen Kursen: ein Handelstag läuft im Zeitraffer, ohne Risiko. Danach mit dem Alpaca-Paper-Konto (echte Kurse, Spielgeld), erst dann mit echtem Geld.</p>
        <div className="tr-stufen"><span><b>1</b> Simulation</span><span><b>2</b> Paper-Konto</span><span><b>3</b> Eigenes Konto</span></div>
        <Link href="/trading/neu" className="btn">Agent einstellen</Link>
      </section>}
      {l && l.length > 0 && <div className="tr-karten">{l.map(a => { const t = a.zustand.tag; const gv = t ? (t.ende ?? null) : null; const offen = a.zustand.vorschlaege.filter(v => v.status === "offen").length; return (
        <Link key={a.id} href={`/trading/${a.id}`} className="tr-karte">
          <div className="ph"><b>{a.einstellungen.name}</b><span className={`badge ${a.zustand.aktiv ? "b-on" : "b-plan"}`}>{a.zustand.aktiv ? "aktiv" : "angehalten"}</span></div>
          <span className="note">{BROKER_NAMEN[a.einstellungen.broker]}{a.einstellungen.brokerApp ? ` (${a.einstellungen.brokerApp})` : ""} · {a.einstellungen.modus === "auto" ? "Automatik" : "Vorschläge"} · {a.einstellungen.symbole.length} Werte</span>
          <div className="tr-k"><div><span>Startkapital</span><strong>{geld(a.einstellungen.startkapital, a.einstellungen.broker.startsWith("alpaca") ? "USD" : "EUR")}</strong></div>{(() => { const W = a.einstellungen.broker.startsWith("alpaca") ? "USD" : "EUR"; const v = a.zustand.verlauf[0];
            // Gerade begonnener Tag ohne Trades: das Ergebnis des letzten Tages zeigen statt „läuft“ (TRD-018)
            const zuletzt = t && t.status === "laeuft" && !t.trades && v && v.ende != null;
            return <div><span>{zuletzt ? `zuletzt ${new Date(v.datum).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}` : "heute"}</span><strong>{zuletzt ? geldPm(v.ende! - v.start, W) : t ? (gv != null ? geldPm(gv - t.start, W) : t.status === "laeuft" ? "läuft" : "–") : "–"}</strong></div>; })()}<div><span>Tage</span><strong>{a.zustand.verlauf.length + (t ? 1 : 0)}</strong></div></div>
          {offen > 0 && <span className="tag warnt">{offen} Vorschlag{offen === 1 ? "" : "e"} offen</span>}
        </Link>); })}</div>}
      <p className="note">Information und Werkzeug, keine Anlageberatung. Trading mit Hebel und Short-Positionen kann zu Verlusten über den Einsatz hinaus führen. Die Mehrheit privater Daytrader verliert Geld.</p>
    </div>
  );
}
