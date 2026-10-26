"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/App";
import { eur } from "@/lib/format";
import { geldPm } from "@highstack/trading";

type Agent = { id: string; einstellungen: { name: string; broker: string }; zustand: { aktiv: boolean; tag: { start: number; ende: number | null; status: string; trades?: number } | null; verlauf?: { datum: string; start: number; ende: number | null }[] } };
/** Startbildschirm: Investments oder Trading */
export default function Start() {
  const { profil, objekte } = useApp(); const [agenten, setAgenten] = useState<Agent[] | null>(null);
  useEffect(() => { fetch("/api/trading").then(r => r.ok ? r.json() : []).then(setAgenten).catch(() => setAgenten([])); }, []);
  if (!profil?.onboarded) return null;
  const pruefung = objekte.filter(o => o.status === "pruefung").length, bestand = objekte.filter(o => o.status === "bestand").length;
  const aktiv = (agenten ?? []).filter(a => a.zustand.aktiv).length;
  const h = new Date().getHours();
  return (
    <div className="view">
      <div className="start-kopf"><h1>Guten {h < 11 ? "Morgen" : h < 18 ? "Tag" : "Abend"}</h1><p className="lead">Wo möchten Sie weitermachen?</p></div>
      <div className="einstiege">
        <Link href="/investments" className="einstieg dunkel">
          <span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3.5 11 12 4l8.5 7M5.5 9.5V20h13V9.5M10 20v-5h4v5" /></svg></span>
          <h2>Investments</h2>
          <p>Immobilien finden, prüfen und halten: Suchaufträge, Objekt-Check, Experten-Team, Portfolio.</p>
          <span className="los">Zu den Investments →</span>
          <span className="zahl">{pruefung} in Prüfung · {bestand} im Bestand</span>
        </Link>
        <Link href="/trading" className="einstieg">
          <span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3.5 17.5 9 12l3.5 3.5L20.5 7.5M15 7.5h5.5V13" /></svg></span>
          <h2>Trading</h2>
          <p>Einen Agenten einstellen, der Märkte beobachtet, Signale begründet und innerhalb Ihrer Grenzen handelt oder vorschlägt.</p>
          <span className="los">Zum Trading →</span>
          <span className="zahl">{agenten == null ? "" : agenten.length ? `${agenten.length} Agent${agenten.length === 1 ? "" : "en"} · ${aktiv} aktiv` : "neu"}</span>
        </Link>
      </div>
      {agenten && agenten.some(a => a.zustand.tag) && <section className="panel"><h2>Trading heute</h2>
        <div className="todo">{agenten.filter(a => a.zustand.tag).map(a => { const t = a.zustand.tag!; return <div key={a.id}><span>{a.einstellungen.name}</span><Link className="btn ghost sm" href={`/trading/${a.id}`}>{(() => { const W = a.einstellungen.broker.startsWith("alpaca") ? "USD" : "EUR"; const v = a.zustand.verlauf?.[0]; if (t.status === "laeuft" && !t.trades && v?.ende != null) return `zuletzt ${geldPm(v.ende - v.start, W)}`; return t.ende != null ? geldPm(t.ende - t.start, W) : t.status === "laeuft" ? "läuft" : "–"; })()}</Link></div>; })}</div></section>}
    </div>
  );
}
