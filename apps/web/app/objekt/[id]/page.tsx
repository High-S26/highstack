"use client";
import { analyse } from "@highstack/engine";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/App";
import { Expertenzeile, FACHEXPERTEN, Kurzurteilpanel, Teamtafel } from "@/components/Experten";
import { Daten, Playbook, Durchspielen, Ergebnisbereich, Gestaltung, Steuern } from "@/components/objekt/Teile";
import { Unterlagen } from "@/components/objekt/Unterlagen";
import { Concierge } from "@/components/objekt/Concierge";
import { Passung } from "@/components/grafik/Netz";
import { Marktlage } from "@/components/objekt/Marktlage";
import { api } from "@/lib/client";
import { EINSTUFUNG } from "@/lib/format";
import { Info } from "@/components/Info";
import { fortschritt, REITER, type Reiter } from "@/lib/fortschritt";
import type { Objektdatensatz } from "@/lib/typen";

const leer = (x: Objektdatensatz) => !x.objekt.kaufpreis && !x.objekt.wohnflaeche && !x.objekt.miete && !x.objekt.ort?.trim() && (!x.objekt.titel?.trim() || x.objekt.titel === "Neues Objekt") && !x.expose?.trim() && !x.dokumente.some(d => d.dateiId) && !Object.keys(x.experten).length;

const TABS = REITER;
type Tab = Reiter;

export default function ObjektSeite({ params }: { params: { id: string } }) {
  const { objekte, profil, anlageprofil, setzeObjekt, entferneObjekt, meldung, loesche, frage, setzeProfil } = useApp(); const router = useRouter();
  const [o, setO] = useState<Objektdatensatz | null>(objekte.find(x => x.id === params.id) ?? null);
  const [tab, setTab] = useState<Tab>("ergebnis");
  const [gespeichert, setGespeichert] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(); const offen = useRef<Partial<Objektdatensatz>>({});

  useEffect(() => { api.objekt(params.id).then(x => { setO(x); setTab(x.objekt.kaufpreis ? "ergebnis" : "daten"); const t = new URLSearchParams(window.location.search).get("tab"); if (t && TABS.some(([k]) => k === t)) setTab(t as Tab); }).catch(() => meldung("Objekt nicht gefunden.")); }, [params.id, meldung]);
  const [datenZu, setDatenZu] = useState(false);
  useEffect(() => { try { setDatenZu(localStorage.getItem("hs_daten_zu") === "1"); } catch { /* ohne Speicher */ } }, []);
  const schalteDaten = () => setDatenZu(z => { try { localStorage.setItem("hs_daten_zu", z ? "0" : "1"); } catch { /* ohne Speicher */ } if (!z && tab === "daten") setTab("ergebnis"); return !z; });
  // Erfolgsmomente: kurze Rückmeldung, wenn ein Schritt neu erledigt ist
  const vorher = useRef<number | null>(null);
  const stand = useMemo(() => o && profil ? fortschritt(o, analyse({ investor: profil.investor, anlageprofil: anlageprofil(o.anlageprofilId), objekt: o.objekt, szenario: o.szenario, module: o.module })) : null, [o, profil, anlageprofil]);
  useEffect(() => {
    if (!stand) return; const n = stand.erledigt;
    if (vorher.current != null && n > vorher.current) meldung(n === stand.schritte.length ? "Objekt-Check vollständig. Alles geprüft." : `Schritt erledigt · ${n} von ${stand.schritte.length}`);
    vorher.current = n;
  }, [stand, meldung]);
  // Angesehene Reiter merken (Fortschritt)
  useEffect(() => {
    if (!o || o.besucht?.[tab]) return;
    const besucht = { ...(o.besucht ?? {}), [tab]: Date.now() }; const neu = { ...o, besucht };
    setO(neu); setzeObjekt(neu); api.aendereObjekt(o.id, { besucht }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, o?.id, o?.besucht?.[tab]]);
  const aktuell = useRef<Objektdatensatz | null>(null); aktuell.current = o;
  // Neu laden oder Tab schließen: offene Änderungen noch absenden
  useEffect(() => {
    const weg = () => { if (!Object.keys(offen.current).length) return; fetch(`/api/objekte/${params.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(offen.current), keepalive: true }); offen.current = {}; };
    window.addEventListener("pagehide", weg); return () => window.removeEventListener("pagehide", weg);
  }, [params.id]);
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
  const { schritt: SCHRITT, schritte, erledigt, naechster } = fortschritt(o, a);
  const begleitet = (profil.modus ?? "unterstuetzt") === "unterstuetzt";
  const setzeModus = (m: "selbst" | "unterstuetzt") => { setzeProfil({ ...profil, modus: m }); meldung(m === "selbst" ? "Concierge ausgeblendet. Über „Concierge“ oben holen Sie ihn zurück." : "Concierge ist da und fragt, was noch fehlt."); };
  const zeige = (t: Tab) => { setTab(t); if (typeof window !== "undefined" && window.innerWidth <= 900 && t === "daten") window.scrollTo({ top: 0 }); };
  return (
    <div className="view">
      <div className="objbar">
        {o.status === "kandidat" && o.suchId ? <Link className="btn ghost sm" href={`/suchen/${o.suchId}`}>← Suchauftrag</Link> : <Link className="btn ghost sm" href={o.status === "bestand" ? "/portfolio" : "/pruefen"}>← {o.status === "bestand" ? "Portfolio" : "Prüfen"}</Link>}
        <h1>{o.objekt.titel || "Objekt"}</h1>
        <label>Anlageprofil<select value={o.anlageprofilId} onChange={e => setze({ anlageprofilId: e.target.value })}>{profil.anlageprofile.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label>Status<select value={o.status} onChange={e => setze({ status: e.target.value as Objektdatensatz["status"] })}><option value="kandidat">Treffer</option><option value="pruefung">In Prüfung</option><option value="bestand">Bestand</option></select></label>
        <div className="check" title="Objekt-Check">
          <div className="ring sm" style={{ ["--p" as string]: `${(erledigt / schritte.length) * 100}` }}><b>{erledigt}/{schritte.length}</b></div>
          <div className="check-t"><span className="lrow"><b>Objekt-Check</b><Info label="Objekt-Check" text="Ein grüner Haken heißt erledigt: Ergebnis, Durchspielen, Gestaltung und Steuern, sobald Sie sie angesehen haben; Unterlagen, sobald eine hochgeladen ist; Experten, sobald das Komitee geurteilt hat. Ein halber Kreis heißt begonnen. Die Reihenfolge ist eine Empfehlung." /></span>{naechster ? <button type="button" className="linkbtn" onClick={() => zeige(naechster)}>Weiter: {SCHRITT[naechster].tun}</button> : <span className="note">Alles geprüft</span>}</div>
        </div>
        <button type="button" className={`btn sm ${begleitet ? "" : "ghost"}`} aria-pressed={begleitet} onClick={() => setzeModus(begleitet ? "selbst" : "unterstuetzt")} title="Unterstützter Modus: Ein Concierge fragt fehlende Angaben einzeln ab">Concierge</button>
        <span className="note">{gespeichert}</span>
        <button type="button" className="btn sm danger" onClick={async () => { if (!await frage({ titel: "Objekt löschen?", text: (() => { const nd = o.dokumente.filter(d => d.dateiId).length, ne = Object.keys(o.experten).length; const mit = [nd ? `${nd} ${nd === 1 ? "Unterlage" : "Unterlagen"}` : "", ne ? `${ne} ${ne === 1 ? "Expertenergebnis" : "Expertenergebnissen"}` : ""].filter(Boolean).join(" und "); return `„${o.objekt.titel || "Objekt"}“ wird${mit ? ` mit ${mit}` : ""} gelöscht. Direkt danach können Sie es noch rückgängig machen.`; })(), ja: "Löschen", gefahr: true })) return; offen.current = {}; aktuell.current = null; const ziel = o.status === "kandidat" && o.suchId ? `/suchen/${o.suchId}` : o.status === "bestand" ? "/portfolio" : "/pruefen"; loesche([o.id], `„${o.objekt.titel || "Objekt"}“ gelöscht`, () => router.push(ziel)); }}>Löschen</button>
      </div>
      <nav className="tabs" role="tablist" aria-label="Schritte">
        {TABS.map(([k, l]) => { const z = SCHRITT[k]; return <button key={k} type="button" role="tab" className={`tab${k === "daten" && !datenZu ? " only-m" : ""}`} aria-selected={tab === k} onClick={() => zeige(k)} title={`${z.was}: ${z.z}`}><span className={`st st-${z.z}`} aria-label={z.z === "erledigt" ? "erledigt" : z.z === "begonnen" ? "begonnen" : "offen"} />{l}</button>; })}
        <button type="button" className="btn ghost sm einklapp" onClick={schalteDaten} aria-pressed={!datenZu} title="Objektdaten links ein- oder ausblenden">{datenZu ? "Daten einblenden" : "Daten ausblenden"}</button>
        <div className="mini" aria-live="polite"><span>{b.score == null ? "–" : Math.round(b.score)}</span><span className={`pill ${b.einstufung ? "p-" + b.einstufung : ""}`}>{b.einstufung ? EINSTUFUNG[b.einstufung] : "–"}</span></div>
      </nav>
      <div className={`grid${datenZu ? " zu" : ""}`}>
        {(!datenZu || tab === "daten") && <div className="col" data-mobil-versteckt={tab !== "daten" ? "ja" : undefined}><Daten o={o} a={a} setze={setze} zuUnterlagen={() => zeige("unterlagen")} /></div>}
        <div className="col">
          {begleitet && (tab === "ergebnis" || tab === "daten") && <Concierge o={o} a={a} setze={setze} zuUnterlagen={() => zeige("unterlagen")} aus={() => setzeModus("selbst")} />}
          {tab === "ergebnis" || (tab === "daten" && !datenZu) ? <>{o.objekt.kaufpreis ? <Kurzurteilpanel objekt={o} onNeu={neuVomServer} /> : null}<Ergebnisbereich a={a} apName={anlageprofil(o.anlageprofilId).name} spielraum={<Playbook o={o} a={a} zuDurchspielen={() => zeige("spielen")} />} passung={<><Passung o={o.objekt} a={a} /><Marktlage id={o.id} ort={o.objekt.ort} asset={o.objekt.asset} /></>} /></> : null}
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
