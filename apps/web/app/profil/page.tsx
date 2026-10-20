"use client";
import { useState } from "react";
import { useApp } from "@/components/App";
import { Anlageprofilformular, Investorformular, Spielraum } from "@/components/Profilteile";
import { neuesAnlageprofil } from "@/lib/vorgaben";
import { pct } from "@/lib/format";

const FUNKTIONEN: [string, string, string, string][] = [
  ["Plattform", "Investorenprofil & mehrere Anlageprofile", "Live", "Alle"], ["Suchen", "Inserate sichten und ranken", "Live", "Basis"], ["Suchen", "Markt-Briefing", "Live", "Pro"],
  ["Prüfen", "Ergebnis, Durchspielen, Sensitivität", "Live", "Basis"], ["Prüfen", "Steuern in eigener Struktur & Vergleich", "Live", "Pro"], ["Prüfen", "Unterlagen mit Upload & Prüfung", "Live", "Pro"],
  ["Gestaltung", "Umnutzung, möbliert, Kurzzeit, Grundstück, Aufteilung, Aufstockung, Sanierung, Zusatzerträge", "Live", "Pro"],
  ["Experten", "Team aus acht Fachexperten, Komitee, Compliance", "Live", "Pro"], ["Experten", "Rückfragen mit Rechenwerkzeugen", "Live", "Pro"],
  ["Suchen", "Suchagenten & Newsletter automatisch", "Geplant", "Family Office"], ["Portfolio", "Bestand: Mieten, Darlehen, Fristen", "Geplant", "Family Office"],
  ["Plattform", "Anmeldung per Magic Link / Passkey, mehrere Nutzer je Mandant", "Geplant", "Family Office"], ["Plattform", "Tarife & Abrechnung", "Geplant", "Alle"],
];

export default function ProfilSeite() {
  const { profil, setzeProfil } = useApp();
  const [aktiv, setAktiv] = useState(profil!.aktivesAnlageprofil);
  const hinzu = () => { const a = neuesAnlageprofil(); setzeProfil({ ...profil!, anlageprofile: [...profil!.anlageprofile, a] }); setAktiv(a.id); };
  const loeschen = () => { if (profil!.anlageprofile.length < 2) return; const rest = profil!.anlageprofile.filter(a => a.id !== aktiv); setzeProfil({ ...profil!, anlageprofile: rest, aktivesAnlageprofil: rest[0]!.id }); setAktiv(rest[0]!.id); };
  return (
    <div className="view">
      <h1>Profil</h1>
      <div className="two">
        <Investorformular />
        <div className="col">
          <section className="panel">
            <div className="ph"><h2>Anlageprofile</h2><span className="tag">was Sie suchen</span></div>
            <div className="olist">{profil!.anlageprofile.map(a => <div key={a.id} className="orow plain"><div><button type="button" className="t" onClick={() => setAktiv(a.id)}>{a.name}</button><div className="m">{[a.strategie, a.assetklassen.join("/"), a.regionen.join(", ") || "alle Regionen", `≥ ${pct(a.minBruttorendite)}`].join(" · ")}</div></div><div className="a">{a.id === aktiv && <span className="badge b-tier">wird bearbeitet</span>}</div></div>)}</div>
            <div className="row"><button type="button" className="btn ghost sm" onClick={hinzu}>Anlageprofil hinzufügen</button>{profil!.anlageprofile.length > 1 && <button type="button" className="btn danger sm" onClick={loeschen}>Ausgewähltes löschen</button>}</div>
          </section>
          <Anlageprofilformular apId={aktiv} />
        </div>
      </div>
      <Spielraum apId={aktiv} />
      <section className="panel"><details><summary>Funktionen &amp; Tarife</summary>
        <p className="note">Tarife sind je Funktion hinterlegt; Bezahlung ist noch nicht aktiv.</p>
        <div className="flist">{FUNKTIONEN.map(([s, n, st, t]) => <div key={n} className="frow"><div><div>{n}</div><div className="note">{s}</div></div><span className={`badge ${st === "Live" ? "b-on" : "b-plan"}`}>{st}</span><span className="badge b-tier">{t}</span></div>)}</div>
      </details></section>
    </div>
  );
}
