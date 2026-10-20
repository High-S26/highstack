"use client";
import { analyse } from "@highstack/engine";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/App";
import { Expertenzeile, FACHEXPERTEN, Kurzurteilpanel, Teamtafel } from "@/components/Experten";
import { Daten, Durchspielen, Ergebnisbereich, Gestaltung, Steuern } from "@/components/objekt/Teile";
import { Unterlagen } from "@/components/objekt/Unterlagen";
import { api } from "@/lib/client";
import { EINSTUFUNG } from "@/lib/format";
import type { Objektdatensatz } from "@/lib/typen";

const leer = (x: Objektdatensatz) => !x.objekt.kaufpreis && !x.objekt.wohnflaeche && !x.objekt.miete && !x.objekt.ort?.trim() && (!x.objekt.titel?.trim() || x.objekt.titel === "Neues Objekt") && !x.expose?.trim() && !x.dokumente.some(d => d.dateiId) && !Object.keys(x.experten).length;

const TABS = [["daten", "Daten"], ["ergebnis", "Ergebnis"], ["spielen", "Durchspielen"], ["gestaltung", "Gestaltung"], ["steuern", "Steuern & Struktur"], ["unterlagen", "Unterlagen"], ["experten", "Experten"]] as const;
type Tab = (typeof TABS)[number][0];

export default function ObjektSeite({ params }: { params: { id: string } }) {
  const { objekte, profil, anlageprofil, setzeObjekt, entferneObjekt, meldung, loesche } = useApp(); const router = useRouter();
  const [o, setO] = useState<Objektdatensatz | null>(objekte.find(x => x.id === params.id) ?? null);
  const [tab, setTab] = useState<Tab>("ergebnis");
  const [gespeichert, setGespeichert] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(); const offen = useRef<Partial<Objektdatensatz>>({});

  useEffect(() => { api.objekt(params.id).then(x => { setO(x); setTab(x.objekt.kaufpreis ? "ergebnis" : "daten"); const t = new URLSearchParams(window.location.search).get("tab"); if (t && TABS.some(([k]) => k === t)) setTab(t as Tab); }).catch(() => meldung("Objekt nicht gefunden.")); }, [params.id, meldung]);
  const aktuell = useRef<Objektdatensatz | null>(null); aktuell.current = o;
  const aktiv = useRef(false);
  useEffect(() => {
    aktiv.current = true;
    return () => {
      aktiv.current = false;
      // kurz warten: React mountet im Entwicklungsmodus doppelt; nur echtes Verlassen zählt
      setTimeout(() => {
        if (aktiv.current) return;
        clearTimeout(timer.current); const x = aktuell.current;
        // Leerer Entwurf (nichts eingetragen, nichts hochgeladen) wird beim Verlassen nicht behalten.
        if (x && leer(x)) { offen.current = {}; entferneObjekt(x.id); api.loescheObjekt(x.id); return; }
        if (Object.keys(offen.current).length) { api.aendereObjekt(params.id, offen.current); offen.current = {}; }
      }, 0);
    };
  }, [params.id, entferneObjekt]);

  const a = useMemo(() => o && profil ? analyse({ investor: profil.investor, anlageprofil: anlageprofil(o.anlageprofilId), objekt: o.objekt, szenario: o.szenario, module: o.module }) : null, [o, profil, anlageprofil]);
  if (!o || !a || !profil) return <p className="note">Lädt …</p>;

  const setze = (patch: Partial<Objektdatensatz>) => {
    const neu = { ...o, ...patch, geaendert: Date.now() }; setO(neu); setzeObjekt(neu);
    offen.current = { ...offen.current, ...patch }; setGespeichert("Ungespeichert …"); clearTimeout(timer.current);
    timer.current = setTimeout(async () => { const p = offen.current; offen.current = {}; try { await api.aendereObjekt(o.id, p); setGespeichert("Gespeichert"); } catch { setGespeichert("Nicht gespeichert"); } }, 600);
  };
  const neuVomServer = (x: Objektdatensatz) => { setO(x); setzeObjekt(x); };
  const b = a.bewertung;
  // Stand je Reiter statt Nummern: die Reiter sind eine empfohlene, keine feste Reihenfolge
  const nMod = Object.keys(o.module).length, nDok = o.dokumente.filter(d => d.dateiId).length, nExp = Object.keys(o.experten).filter(k => k !== "kurzurteil").length;
  const stand: Partial<Record<Tab, { text: string; titel: string }>> = {
    spielen: Object.keys(o.szenario).length ? { text: "✓", titel: "eigene Annahmen gesetzt" } : undefined,
    gestaltung: nMod ? { text: String(nMod), titel: `${nMod} Gestaltung aktiv` } : undefined,
    unterlagen: nDok ? { text: String(nDok), titel: `${nDok} Unterlagen hochgeladen` } : undefined,
    experten: nExp ? { text: String(nExp), titel: `${nExp} Expertenergebnisse` } : undefined,
  };
  return (
    <div className="view">
      <div className="objbar">
        {o.status === "kandidat" && o.suchId ? <Link className="btn ghost sm" href={`/suchen/${o.suchId}`}>← Suchauftrag</Link> : <Link className="btn ghost sm" href={o.status === "bestand" ? "/portfolio" : "/pruefen"}>← {o.status === "bestand" ? "Portfolio" : "Prüfen"}</Link>}
        <h1>{o.objekt.titel || "Objekt"}</h1>
        <label>Anlageprofil<select value={o.anlageprofilId} onChange={e => setze({ anlageprofilId: e.target.value })}>{profil.anlageprofile.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label>Status<select value={o.status} onChange={e => setze({ status: e.target.value as Objektdatensatz["status"] })}><option value="kandidat">Kandidat</option><option value="pruefung">In Prüfung</option><option value="bestand">Bestand</option></select></label>
        <span className="note">{gespeichert}</span>
        <button type="button" className="btn sm danger" onClick={() => { offen.current = {}; aktuell.current = null; const ziel = o.status === "kandidat" && o.suchId ? `/suchen/${o.suchId}` : o.status === "bestand" ? "/portfolio" : "/pruefen"; loesche([o.id], `„${o.objekt.titel || "Objekt"}“ gelöscht`, () => router.push(ziel)); }}>Löschen</button>
      </div>
      <nav className="tabs" role="tablist" aria-label="Schritte">
        {TABS.map(([k, l]) => { const z = stand[k]; return <button key={k} type="button" role="tab" className={`tab${k === "daten" ? " only-m" : ""}`} aria-selected={tab === k} onClick={() => setTab(k)}>{l}{z && <span className="tz" title={z.titel}>{z.text}</span>}</button>; })}
        <div className="mini" aria-live="polite"><span>{b.score == null ? "–" : Math.round(b.score)}</span><span className={`pill ${b.einstufung ? "p-" + b.einstufung : ""}`}>{b.einstufung ? EINSTUFUNG[b.einstufung] : "–"}</span></div>
      </nav>
      <div className="grid">
        <div className="col" data-mobil-versteckt={tab !== "daten" ? "ja" : undefined}><Daten o={o} a={a} setze={setze} /></div>
        <div className="col">
          {tab === "ergebnis" || tab === "daten" ? <><Ergebnisbereich a={a} apName={anlageprofil(o.anlageprofilId).name} />{o.objekt.kaufpreis ? <Kurzurteilpanel objekt={o} onNeu={neuVomServer} /> : null}</> : null}
          {tab === "spielen" && <Durchspielen o={o} a={a} setze={setze} />}
          {tab === "gestaltung" && <Gestaltung o={o} a={a} setze={setze} />}
          {tab === "steuern" && <Steuern a={a} />}
          {tab === "unterlagen" && <Unterlagen o={o} setze={setze} onNeu={neuVomServer} />}
          {tab === "experten" && <>
            <section className="panel"><div className="ph"><h2>Team beauftragen</h2><span className="tag">Stufe 3 · Fachexperten, Komitee, Compliance</span></div><Teamtafel objekt={o} onNeu={neuVomServer} /></section>
            <section className="panel"><div className="ph"><h2>Einzelne Experten</h2><span className="tag">Stufe 2 · gezielt einzeln</span></div>{FACHEXPERTEN.map(id => <Expertenzeile key={id} objekt={o} id={id} onNeu={neuVomServer} />)}</section>
          </>}
        </div>
      </div>
    </div>
  );
}
