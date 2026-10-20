"use client";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";

const FEHLER: Record<string, string> = { link: "Der Link ist abgelaufen oder wurde schon benutzt. Fordern Sie einfach einen neuen an.", zugang: "Für diese Adresse gibt es keinen Zugang. Bitten Sie den Inhaber des Kontos um eine Einladung." };

export default function Login() {
  const [email, setEmail] = useState(""); const [zustand, setZustand] = useState<"frei" | "sendet" | "gesendet">("frei");
  const [meldung, setMeldung] = useState(""); const [devLink, setDevLink] = useState<string | null>(null);
  useEffect(() => { const f = new URLSearchParams(location.search).get("fehler"); if (f) setMeldung(FEHLER[f] ?? ""); }, []);
  const senden = async (e: React.FormEvent) => {
    e.preventDefault(); setZustand("sendet"); setMeldung("");
    try {
      const r = await fetch("/api/auth/anfordern", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      const d = await r.json(); if (!r.ok) { setMeldung(d.fehler ?? "Das hat nicht geklappt."); setZustand("frei"); return; }
      setDevLink(d.devLink ?? null); setZustand("gesendet");
    } catch { setMeldung("Keine Verbindung. Bitte erneut versuchen."); setZustand("frei"); }
  };
  return (
    <div className="login">
      <div className="login-card">
        <div className="brand"><Logo zusatz /></div>
        <h1>Anmelden</h1>
        {zustand !== "gesendet" ? <form onSubmit={senden} className="login-f">
          <p className="lead">Sie bekommen einen Link per E-Mail. Kein Passwort nötig.</p>
          <div className="fld"><label htmlFor="mail">E-Mail-Adresse</label><input id="mail" type="email" autoComplete="email" inputMode="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@beispiel.de" /></div>
          <button className="btn" disabled={zustand === "sendet"}>{zustand === "sendet" ? "Sendet …" : "Anmelde-Link senden"}</button>
          {meldung && <p className="hint bad" role="alert">{meldung}</p>}
        </form> : <div className="login-f">
          <p className="lead">Wenn <b>{email}</b> Zugang hat, ist ein Link unterwegs. Er gilt 20 Minuten. Schauen Sie auch im Spam-Ordner nach.</p>
          {devLink && <p className="hint">Entwicklung ohne Mailversand: <a href={devLink}>Hier anmelden</a></p>}
          <button type="button" className="btn ghost" onClick={() => setZustand("frei")}>Andere Adresse</button>
        </div>}
        <p className="note">Zugang nur auf Einladung. highstack dient der Information, nicht der Beratung.</p>
      </div>
    </div>
  );
}
