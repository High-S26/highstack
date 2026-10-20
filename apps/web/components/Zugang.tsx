"use client";
import { useEffect, useState } from "react";
import { useApp } from "./App";

type Eintrag = { email: string; rolle: "inhaber" | "mitglied"; erstellt: number; letzterLogin?: number };
const datum = (t?: number) => t ? new Date(t).toLocaleDateString("de-DE") : "noch nie";

/** Zugang: wer dieses Konto nutzen darf. Einladen und Entfernen nur als Inhaber. */
export function Zugang() {
  const { meldung } = useApp();
  const [d, setD] = useState<{ aktiv: boolean; ich?: string; nutzer: Eintrag[] } | null>(null);
  const [email, setEmail] = useState(""); const [rolle, setRolle] = useState<"mitglied" | "inhaber">("mitglied"); const [laeuft, setLaeuft] = useState(false); const [link, setLink] = useState<string | null>(null);
  const lade = () => fetch("/api/zugang").then(r => r.json()).then(setD).catch(() => undefined);
  useEffect(() => { lade(); }, []);
  if (!d) return null;
  if (!d.aktiv) return <section className="panel"><div className="ph"><h2>Zugang</h2><span className="badge b-plan">lokal ohne Anmeldung</span></div><p className="note">Die Anmeldung ist ausgeschaltet, bis der Server eingerichtet ist. Lokal ausprobieren: in der .env AUTH_SECRET (beliebiger Text) und ADMIN_EMAIL (Ihre Adresse) setzen und die App neu starten. Ohne Mailversand erscheint der Anmelde-Link dann direkt auf der Anmeldeseite.</p></section>;
  const ichInhaber = d.nutzer.find(n => n.email === d.ich)?.rolle === "inhaber";
  const einladen = async (e: React.FormEvent) => {
    e.preventDefault(); setLaeuft(true); setLink(null);
    const r = await fetch("/api/zugang", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, rolle }) }); const x = await r.json();
    setLaeuft(false); if (!r.ok) { meldung(x.fehler ?? "Einladung fehlgeschlagen"); return; }
    meldung(x.versendet ? `Einladung an ${email} verschickt` : `${email} eingeladen`); setLink(x.devLink ?? null); setEmail(""); lade();
  };
  const entfernen = async (m: string) => { const r = await fetch(`/api/zugang?email=${encodeURIComponent(m)}`, { method: "DELETE" }); const x = await r.json(); meldung(r.ok ? `Zugang für ${m} entfernt` : x.fehler); lade(); };
  return (
    <section className="panel" id="zugang">
      <div className="ph"><h2>Zugang</h2><span className="tag">wer dieses Konto nutzt</span></div>
      <div className="olist">{d.nutzer.map(n => (
        <div key={n.email} className="orow plain">
          <div><div className="t">{n.email}{n.email === d.ich ? " (Sie)" : ""}</div><div className="m">{n.rolle === "inhaber" ? "Inhaber" : "Mitglied"} · zuletzt angemeldet {datum(n.letzterLogin)}</div></div>
          <div className="a">{ichInhaber && n.email !== d.ich && <button type="button" className="btn sm danger" onClick={() => entfernen(n.email)}>Entfernen</button>}</div>
        </div>))}</div>
      {ichInhaber ? <form className="einladen" onSubmit={einladen}>
        <div className="fld"><label htmlFor="einl">Person einladen</label><input id="einl" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@beispiel.de" /></div>
        <div className="seg" role="radiogroup" aria-label="Rolle">{(["mitglied", "inhaber"] as const).map(r => <label key={r} className="segi"><input type="radio" name="rolle" checked={rolle === r} onChange={() => setRolle(r)} /><span>{r === "inhaber" ? "Inhaber" : "Mitglied"}</span></label>)}</div>
        <button className="btn" disabled={laeuft}>{laeuft ? "Lädt ein …" : "Einladen"}</button>
        <p className="hint">Mitglieder sehen und bearbeiten alle Objekte dieses Kontos. Inhaber können zusätzlich einladen und Zugänge entfernen.</p>
        {link && <p className="hint">Ohne Mailversand (Entwicklung): <a href={link}>Einladungslink</a></p>}
      </form> : <p className="note">Einladen kann nur der Inhaber des Kontos.</p>}
    </section>
  );
}
