"use client";
import { useState } from "react";
import { useApp } from "@/components/App";
import { Anlageprofilformular, Investorformular, Spielraum } from "@/components/Profilteile";
import { Paketvergleich } from "@/components/Quellen";
import { neuesAnlageprofil } from "@/lib/vorgaben";
import { pct } from "@/lib/format";


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
      <Paketvergleich />
    </div>
  );
}
