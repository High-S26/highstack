"use client";
import { strategieVorschlag, VORLAGEN, type Analyse, type Strategievorschlag, type Szenario } from "@highstack/engine";
import { useState } from "react";
import { eur, pct } from "@/lib/format";
import type { Objektdatensatz, Strategie } from "@/lib/typen";
import { id } from "@/lib/vorgaben";
import { useApp } from "../App";

/** Strategien: Vorlagen, eigene gespeicherte und ein gerechneter Vorschlag der Vermögensverwaltung. */
export function Strategien({ o, a, setze, vorlage }: { o: Objektdatensatz; a: Analyse; setze: (p: Partial<Objektdatensatz>) => void; vorlage: (n: keyof typeof VORLAGEN) => void }) {
  const { profil, setzeProfil, anlageprofil, meldung, frage } = useApp();
  const eigene = profil!.strategien ?? [];
  const [name, setName] = useState(""); const [speichern, setSpeichern] = useState(false);
  const [vorschlag, setVorschlag] = useState<Strategievorschlag | null>(null);
  const anwenden = (sz: Partial<Szenario>) => setze({ szenario: { ...o.szenario, ...sz } });
  const sichere = (n: string, sz: Partial<Szenario>, quelle: Strategie["quelle"], notiz?: string) => {
    const t = n.trim() || `Strategie ${eigene.length + 1}`;
    setzeProfil({ ...profil!, strategien: [...eigene, { id: id(), name: t, szenario: sz, quelle, notiz, erstellt: Date.now() }] });
    meldung(`Strategie „${t}“ gespeichert`); setSpeichern(false); setName("");
  };
  const aktuell: Partial<Szenario> = Object.fromEntries((["kaufpreisAenderung", "eigenkapital", "sollzins", "tilgung", "anschlusszinsAufschlag", "mietFaktor", "mietsteigerung", "kostensteigerung", "leerstandZusatz", "wertentwicklung", "haltedauer"] as const).map(k => [k, a.szenario[k]]));
  const vorschlagen = () => setVorschlag(strategieVorschlag({ investor: profil!.investor, anlageprofil: anlageprofil(o.anlageprofilId), objekt: o.objekt, szenario: o.szenario, module: o.module }));
  return (
    <div className="strat">
      <div className="strat-row">
        <span className="flabel">Vorlagen</span>
        <div className="chips">{(Object.keys(VORLAGEN) as (keyof typeof VORLAGEN)[]).map(n => <button key={n} type="button" className="chip" onClick={() => vorlage(n)}>{n[0]!.toUpperCase() + n.slice(1)}</button>)}</div>
      </div>
      <div className="strat-row">
        <span className="flabel">Ihre Strategien</span>
        <div className="chips">
          {eigene.map(st => <span key={st.id} className="chip chipx" title={st.notiz}><button type="button" onClick={() => anwenden(st.szenario)}>{st.quelle === "vermoegen" ? "◆ " : ""}{st.name}</button><button type="button" className="x" aria-label={`${st.name} löschen`} onClick={async () => { if (await frage({ titel: "Strategie löschen?", text: `„${st.name}“ wird aus Ihren Strategien entfernt.`, ja: "Löschen", gefahr: true })) setzeProfil({ ...profil!, strategien: eigene.filter(x => x.id !== st.id) }); }}>×</button></span>)}
          {!speichern ? <button type="button" className="chip add" onClick={() => setSpeichern(true)}>+ Aktuelle Einstellung speichern</button>
            : <form className="inl" onSubmit={e => { e.preventDefault(); sichere(name, aktuell, "eigen"); }}><input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Name, z. B. Mehr EK, schnell tilgen" aria-label="Name der Strategie" /><button className="btn sm">Speichern</button><button type="button" className="btn sm ghost" onClick={() => setSpeichern(false)}>Abbrechen</button></form>}
        </div>
      </div>
      <div className="strat-row">
        <span className="flabel">Vermögensverwaltung</span>
        <div className="row"><button type="button" className="btn sm ghost" onClick={vorschlagen}>Strategie vorschlagen lassen</button><span className="note">gerechnet aus Risikoneigung, Ziel-Cashflow, Mietspiegel und Steuerfrist</span></div>
      </div>
      {vorschlag && <div className="vorschlag">
        <div className="ph"><b>{vorschlag.name}</b><span className="note">Cashflow {vorschlag.cashflowMonat != null ? `${eur(vorschlag.cashflowMonat)} im Monat` : "–"} · Rendite auf EK {vorschlag.irr != null ? pct(vorschlag.irr) : "–"}</span></div>
        <ul>{vorschlag.gruende.map(g => <li key={g}>{g}</li>)}</ul>
        {o.experten.vermoegen && <p className="note">Einschätzung des Vermögensverwalters zum Objekt: {String((o.experten.vermoegen.ergebnis as { kernaussage?: string })?.kernaussage ?? "")}</p>}
        <div className="row"><button type="button" className="btn sm" onClick={() => { anwenden(vorschlag.szenario); setVorschlag(null); }}>Übernehmen</button><button type="button" className="btn sm ghost" onClick={() => { sichere(`Vorschlag ${o.objekt.titel?.slice(0, 24) || ""}`.trim(), vorschlag.szenario, "vermoegen", vorschlag.gruende.join(" ")); setVorschlag(null); }}>Als Strategie speichern</button><button type="button" className="btn sm ghost" onClick={() => setVorschlag(null)}>Schließen</button></div>
      </div>}
    </div>
  );
}
