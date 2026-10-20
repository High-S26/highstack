"use client";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/App";
import { Expertenzeile, expertMeta, FACHEXPERTEN, Teamtafel } from "@/components/Experten";

const LIEFERT: Record<string, string[]> = {
  makler: ["Zielpreis und Schmerzgrenze", "Argumente aus Ihren Daten", "Entwurf für das Gegenangebot"],
  verwalter: ["Kosten, Rücklage, Sanierungsrisiken mit Spannen", "Liest Protokolle und Abrechnungen", "Fragenkatalog an den Verwalter"],
  bank: ["Beleihung, Kapitaldienst im Stress", "Auflagen und Unterlagenliste", "Entwurf der Finanzierungsanfrage"],
  vermoegen: ["Passung zu Strategie und Risiko", "Stärkste Hebel, Exit", "Portfolio-Wirkung"],
  steuer: ["Steuerbild in Ihrer Struktur", "Vergleich ohne Empfehlung", "Fragen an den Steuerberater"],
  recht: ["Auffälligkeiten mit Fundstelle", "Genehmigungslage bei Gestaltung", "Fragen an Notar oder Anwalt"],
  projektentwickler: ["Gestaltungsvarianten gerechnet", "Genehmigungsweg und Risiko", "Was vor Ankauf zu klären ist"],
  dokumentpruefer: ["Abgleich Unterlagen und Exposé", "Befunde nach Schwere", "Fehlende Unterlagen"],
  komitee: ["Urteil aus vier Perspektiven", "Widersprüche zwischen den Experten", "Nächste Schritte, Verhandlungsansatz"],
};

export default function ExpertenSeite() {
  const { objekte, setzeObjekt, profil, setzeProfil } = useApp();
  const an = (id: string) => profil!.experten?.[id] !== false;
  const schalte = (id: string, v: boolean) => setzeProfil({ ...profil!, experten: { ...(profil!.experten ?? {}), [id]: v } });
  const [objId, setObjId] = useState(objekte.find(o => o.status === "pruefung")?.id ?? objekte[0]?.id ?? "");
  const [offen, setOffen] = useState<string | null>(null);
  const objekt = objekte.find(o => o.id === objId);
  return (
    <div className="view">
      <h1>Experten</h1>
      <p className="lead">Mit dem Schalter legen Sie fest, wer im Team mitarbeitet. Ausgeschaltete Experten laufen im Teamlauf nicht mit und kosten nichts; einzeln beauftragen können Sie sie trotzdem. Die Compliance-Prüfung bleibt immer an. Jeder Experte ist ein eigenes Werkzeug mit festem Auftrag, eigener Prüfliste und eigenen Rechenwerkzeugen. Zahlen liefert immer das Rechenwerk; die Experten deuten sie, rechnen Varianten, lesen Unterlagen und liefern Ergebnisse, die Sie direkt verwenden können.</p>
      {objekte.length ? <section className="panel">
        <div className="ph"><h2>Objekt wählen</h2><Link className="btn ghost sm" href={`/objekt/${objId}`}>Objekt öffnen</Link></div>
        <label>Objekt<select value={objId} onChange={e => setObjId(e.target.value)}>{objekte.map(o => <option key={o.id} value={o.id}>{o.objekt.titel} · {{ kandidat: "Kandidat", pruefung: "In Prüfung", bestand: "Bestand" }[o.status]}</option>)}</select></label>
        {objekt && <Teamtafel key={objekt.id + objekt.geaendert} objekt={objekt} onNeu={setzeObjekt} />}
      </section> : <div className="empty"><span>Noch keine Objekte. Legen Sie unter Prüfen ein Objekt an oder sichten Sie Inserate.</span></div>}
      {offen && objekt && <section className="panel"><div className="ph"><h2>{expertMeta(offen).rolle}: {expertMeta(offen).titel}</h2><button className="btn ghost sm" type="button" onClick={() => setOffen(null)}>Schließen</button></div><Expertenzeile key={objekt.id + offen} objekt={objekt} id={offen} onNeu={setzeObjekt} /></section>}
      <div className="xgal">{FACHEXPERTEN.map(id => { const m = expertMeta(id); return (
        <article key={id} className={`xcard${an(id) ? "" : " off"}`}>
          <div className="hd"><span>{m.rolle}</span><b>{m.titel}</b><label className="switch hdsw"><input type="checkbox" role="switch" checked={an(id)} onChange={e => schalte(id, e.target.checked)} aria-label={`${m.titel} im Team ${an(id) ? "ausschalten" : "einschalten"}`} /><span className="track-s" aria-hidden="true" /><span>{an(id) ? "im Team" : "aus"}</span></label></div>
          <div className="bd"><div>{m.beschreibung}</div><ul>{LIEFERT[id]?.map(l => <li key={l}>{l}</li>)}</ul></div>
          <div className="ft"><span className="note">{m.werkzeuge.length ? `${m.werkzeuge.length} ${m.werkzeuge.length === 1 ? "Werkzeug" : "Werkzeuge"}` : "ohne Werkzeuge"}</span><button className="btn sm" type="button" disabled={!objekt} onClick={() => setOffen(id)}>Öffnen</button></div>
        </article>); })}
        <article className="xcard"><div className="hd"><span>Markt &amp; Research</span><b>Markt-Briefing</b></div><div className="bd"><div>{expertMeta("markt").beschreibung}</div></div><div className="ft"><span className="note">für eine Region</span><Link className="btn sm" href="/suchen">In der Suche</Link></div></article>
      </div>
      <p className="note">Information und Vorbereitung auf Spezialistenniveau. Keine Anlage-, Steuer- oder Rechtsberatung im Einzelfall; dafür übergeben die Experten vorbereitete Fragen an Steuerberater, Notar, Anwalt oder Architekt.</p>
    </div>
  );
}
