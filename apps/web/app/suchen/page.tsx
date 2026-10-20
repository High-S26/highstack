"use client";
import { useState } from "react";
import { useApp } from "@/components/App";
import { Ergebnis } from "@/components/Experten";
import { Objektliste } from "@/components/Objektliste";
import { Anlageprofilformular } from "@/components/Profilteile";
import { api } from "@/lib/client";

const QUELLEN: [string, string][] = [["Inserate, Suchagent-Mails, Newsletter einfügen", "aktiv"], ["Suchagenten von ImmoScout24 und Immowelt automatisch lesen", "geplant"], ["Makler-Newsletter automatisch lesen", "geplant"], ["Zwangsversteigerungen (ZVG-Portal)", "geplant"], ["Lizenzierte Marktdaten über mehrere Märkte", "geplant"]];

export default function Suchen() {
  const { profil, setzeProfil, objekte, setzeObjekt, anlageprofil, meldung, testmodus } = useApp();
  const ap = anlageprofil();
  const [text, setText] = useState(""); const [laeuft, setLaeuft] = useState(false); const [status, setStatus] = useState("");
  const [region, setRegion] = useState(ap.regionen[0] ?? ""); const [asset, setAsset] = useState(ap.assetklassen[0] ?? "ETW");
  const [mbLaeuft, setMbLaeuft] = useState(false); const [mbAktiv, setMbAktiv] = useState<string | null>(null);
  const treffer = objekte.filter(o => o.status === "kandidat" && o.anlageprofilId === ap.id);
  const sichten = async () => {
    if (!text.trim()) { setStatus("Bitte zuerst Inserattexte einfügen."); return; }
    setLaeuft(true); setStatus("Der Daten-Analyst erkennt die Objekte …");
    try { const r = await api.sichten(text, ap.id); r.angelegt.forEach(setzeObjekt); setText(""); setStatus(`${r.angelegt.length} Objekt(e) erkannt und nach Passung sortiert.`); }
    catch (e) { setStatus((e as Error).message); } finally { setLaeuft(false); }
  };
  const briefing = async () => {
    if (!region.trim()) return; setMbLaeuft(true);
    try { const r = await api.markt(region, asset, ap.id); const key = `${r.region}|${r.asset}`; setzeProfil({ ...profil!, research: { ...(profil!.research ?? {}), [key]: r } }); setMbAktiv(key); }
    catch (e) { meldung((e as Error).message); } finally { setMbLaeuft(false); }
  };
  const research = Object.entries(profil!.research ?? {}).sort((a, b) => b[1].am - a[1].am);
  const aktiv = mbAktiv ? profil!.research?.[mbAktiv] : research[0]?.[1];
  return (
    <div className="view">
      <div className="ph"><h1>Investment-Suche</h1><div className="chips">{profil!.anlageprofile.map(a => <button key={a.id} className="chip" type="button" aria-pressed={a.id === ap.id} onClick={() => setzeProfil({ ...profil!, aktivesAnlageprofil: a.id })}>{a.name}</button>)}</div></div>
      <div className="two">
        <div className="col">
          <Anlageprofilformular apId={ap.id} kompakt />
          <section className="panel">
            <div className="ph"><h2>Inserate sichten</h2><span className="tag">ein oder mehrere</span></div>
            <p className="note">Fügen Sie Texte aus Inseraten, Suchagent-Mails oder Makler-Newslettern ein, auch mehrere hintereinander. Jedes Objekt wird erkannt, gerechnet und nach Passung zu Ihrem Anlageprofil sortiert.</p>
            <textarea style={{ minHeight: 140 }} value={text} onChange={e => setText(e.target.value)} placeholder="Inserattexte hier einfügen …" aria-label="Inserattexte" />
            <div className="row"><button className="btn" type="button" disabled={laeuft || testmodus} onClick={sichten}>{laeuft ? "Sichtet …" : "Sichten und ranken"}</button><span className="status">{testmodus ? "Sichten braucht einen API-Key." : status}</span></div>
          </section>
          <section className="panel"><h2>Quellen</h2><div className="src">{QUELLEN.map(([t, s]) => <div key={t}><span>{t}</span><span className={`badge ${s === "aktiv" ? "b-on" : "b-plan"}`}>{s}</span></div>)}</div></section>
        </div>
        <div className="col">
          <section className="panel"><div className="ph"><h2>Treffer</h2><span className="tag">{treffer.length ? `${treffer.length} Kandidaten · ${ap.name}` : ""}</span></div><Objektliste kandidat objekte={treffer} leer="Noch keine Treffer für dieses Anlageprofil. Fügen Sie links Inserate ein." /></section>
          <section className="panel">
            <div className="ph"><h2>Markt-Briefing</h2><span className="tag">Markt &amp; Research</span></div>
            <div className="fields"><label>Region<input value={region} onChange={e => setRegion(e.target.value)} placeholder="z. B. Düsseldorf-Bilk" /></label><label>Assetklasse<select value={asset} onChange={e => setAsset(e.target.value as typeof asset)}>{["ETW", "MFH", "EFH/ZFH", "Gewerbe"].map(a => <option key={a}>{a}</option>)}</select></label></div>
            <div className="row"><button className="btn ghost" type="button" disabled={mbLaeuft} onClick={briefing}>{mbLaeuft ? "Research läuft …" : "Briefing erstellen"}</button></div>
            {research.length > 0 && <div className="chips">{research.map(([k, r]) => <button key={k} type="button" className="chip" aria-pressed={aktiv === r} onClick={() => setMbAktiv(k)}>{r.region} · {r.asset}</button>)}</div>}
            {aktiv && <Ergebnis id="markt" ergebnis={aktiv.ergebnis} />}
          </section>
        </div>
      </div>
    </div>
  );
}
