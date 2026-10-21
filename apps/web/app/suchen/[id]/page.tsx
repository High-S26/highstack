"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/App";
import { Ergebnis } from "@/components/Experten";
import { Objektliste } from "@/components/Objektliste";
import { Anlageprofilformular } from "@/components/Profilteile";
import { Hintergrundsuche } from "@/components/Quellen";
import { ASSETS, URLAUBSREGIONEN, useSuchen } from "@/components/Suchen";
import { api } from "@/lib/client";
import type { Suchauftrag } from "@/lib/typen";

export default function Suchauftrag({ params }: { params: { id: string } }) {
  const { profil, setzeProfil, setzeObjekt, meldung, testmodus, anlageprofil, analyseVon } = useApp();
  const { suchen, treffer, aendere, loesche } = useSuchen(); const router = useRouter();
  const s = suchen.find(x => x.id === params.id);
  const [text, setText] = useState(""); const [laeuft, setLaeuft] = useState(false); const [status, setStatus] = useState(""); const [fund, setFund] = useState<{ n: number; beste: string | null } | null>(null);
  const [mbLaeuft, setMbLaeuft] = useState(false);
  if (!s) return <div className="view"><div className="empty"><b>Suchauftrag nicht gefunden</b><span>Er wurde gelöscht oder der Link ist veraltet.</span><Link className="btn" href="/suchen">Zu den Suchaufträgen</Link></div></div>;
  const ap = anlageprofil(s.anlageprofilId); const liste = treffer(s.id);
  const setze = (p: Partial<Suchauftrag>) => aendere(s.id, p);
  const sichten = async () => {
    if (!text.trim()) { setStatus("Fügen Sie zuerst Inserattexte ein."); return; }
    setLaeuft(true); setStatus("Der Daten-Analyst erkennt die Objekte …");
    try { const r = await api.sichten(text, ap.id, s.id); r.angelegt.forEach(setzeObjekt); setze({ gesichtet: Date.now() }); setText(""); setStatus("");
      const best = r.angelegt.map(o => ({ o, a: analyseVon(o) })).sort((x, y) => (y.a.bewertung.score ?? -1) - (x.a.bewertung.score ?? -1))[0];
      setFund({ n: r.angelegt.length, beste: best && best.a.bewertung.score != null ? `${best.o.objekt.titel} mit ${Math.round(best.a.bewertung.score)} Punkten` : null }); }
    catch (e) { setStatus((e as Error).message); } finally { setLaeuft(false); }
  };
  const key = `${s.region}|${s.asset}`; const briefing = profil!.research?.[key];
  const holeBriefing = async () => {
    if (!s.region.trim()) { meldung("Tragen Sie zuerst eine Region ein."); return; }
    setMbLaeuft(true);
    try { const r = await api.markt(s.region, s.asset, ap.id); setzeProfil({ ...profil!, research: { ...(profil!.research ?? {}), [`${r.region}|${r.asset}`]: r } }); }
    catch (e) { meldung((e as Error).message); } finally { setMbLaeuft(false); }
  };
  return (
    <div className="view">
      <div className="objbar">
        <Link className="btn ghost sm" href="/suchen">← Suchaufträge</Link>
        <input className="titleinput" value={s.name} onChange={e => setze({ name: e.target.value })} aria-label="Name des Suchauftrags" />
        <span className={`badge ${s.aktiv ? "b-on" : "b-plan"}`}>{s.aktiv ? "Aktiv" : "Pausiert"}</span>
        <button type="button" className="btn sm ghost" onClick={() => setze({ aktiv: !s.aktiv })}>{s.aktiv ? "Pausieren" : "Fortsetzen"}</button>
        <button type="button" className="btn sm danger" onClick={() => loesche(s.id, () => router.push("/suchen"))}>Löschen</button>
      </div>
      <div className="grid">
        <div className="col">
          <section className="panel">
            <h2>Was und wo</h2>
            <div className="fields">
              <label>Region<input value={s.region} onChange={e => setze({ region: e.target.value })} placeholder="z. B. Düsseldorf-Bilk" /></label>
              <label>Assetklasse<select value={s.asset} onChange={e => setze({ asset: e.target.value as Suchauftrag["asset"] })}>{ASSETS.map(a => <option key={a}>{a}</option>)}</select></label>
              {s.asset === "Ferienimmobilie" && <div className="full regvor"><span className="flabel">Ferien- und Inselregionen</span>{URLAUBSREGIONEN.map(g => <div key={g.gruppe} className="regg"><span className="note">{g.gruppe}</span><div className="chips">{g.regionen.map(r => <button key={r} type="button" className="chip" aria-pressed={s.region === r} onClick={() => setze({ region: r, name: s.name.startsWith("Ferienimmobilie") || s.name === "Neue Suche" ? `Ferienimmobilie ${r}` : s.name })}>{r}</button>)}</div></div>)}<div className="hint">Für Ferienimmobilien rechnet das Modul „Kurzzeit- und Serviced Apartments“ Auslastung und Tagespreise. Im Ausland sind Steuern und Recht vor Ort noch nicht abgebildet.</div></div>}
              <label className="full">Anlageprofil<select value={s.anlageprofilId} onChange={e => setze({ anlageprofilId: e.target.value })}>{profil!.anlageprofile.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
              <label className="full">Notiz<textarea style={{ minHeight: 60 }} value={s.notiz ?? ""} onChange={e => setze({ notiz: e.target.value })} placeholder="z. B. nur Altbau, Nähe U-Bahn" /></label>
            </div>
            <details><summary>Kriterien von „{ap.name}“ anpassen</summary><Anlageprofilformular apId={ap.id} kompakt /></details>
          </section>
          <section className="panel">
            <div className="ph"><h2>Inserate sichten</h2><span className="tag">eines oder mehrere</span></div>
            <p className="note">Texte aus Inseraten, Suchagent-Mails oder Makler-Newslettern einfügen, gern mehrere hintereinander. Jedes Objekt wird erkannt, gerechnet und diesem Suchauftrag zugeordnet.</p>
            <textarea style={{ minHeight: 140 }} value={text} onChange={e => setText(e.target.value)} placeholder="Inserattexte hier einfügen" aria-label="Inserattexte" />
            <div className="row"><button className="btn" type="button" disabled={laeuft || testmodus} onClick={sichten}>{laeuft ? "Sichtet …" : "Sichten und ranken"}</button><span className="status">{testmodus ? "Sichten braucht einen API-Key. Einzelne Exposés lesen Sie auch ohne Key über „+ Neues Objekt“ ein." : status}</span></div>
            {fund && <div className="fundkarte" role="status"><b>{fund.n === 1 ? "1 Objekt erkannt" : `${fund.n} Objekte erkannt`}</b><span>{fund.beste ? `Beste Passung: ${fund.beste}` : "Nach Passung sortiert"}</span><button type="button" className="btn sm" onClick={() => { document.getElementById("treffer")?.scrollIntoView({ behavior: "smooth" }); setFund(null); }}>Treffer ansehen</button></div>}
          </section>
        </div>
        <div className="col">
          <section className="panel" id="treffer"><div className="ph"><h2>Treffer</h2><span className="tag">{liste.length ? `${liste.length} Kandidaten` : "noch keine"}</span></div>
            <Objektliste kandidat objekte={liste} leer={<><b>Noch keine Treffer</b><span>Fügen Sie links Inserate ein. Die besten Treffer stehen oben, mit „Prüfen“ geht ein Objekt in die Tiefe.</span></>} />
          </section>
          <Hintergrundsuche s={s} setze={setze} />
          <section className="panel">
            <div className="ph"><h2>Markt-Briefing</h2><span className="tag">{s.region ? `${s.asset} in ${s.region}` : "Region fehlt"}</span></div>
            {!briefing && <p className="note">Lage, Mieten, Preise und Entwicklung der Region, mit Quellen. Grundlage für die Lagebewertung der Treffer.</p>}
            <div className="row"><button className="btn ghost" type="button" disabled={mbLaeuft} onClick={holeBriefing}>{mbLaeuft ? "Research läuft …" : briefing ? "Briefing aktualisieren" : "Briefing erstellen"}</button>{briefing && <span className="note">Stand {new Date(briefing.am).toLocaleDateString("de-DE")}</span>}</div>
            {briefing && <Ergebnis id="markt" ergebnis={briefing.ergebnis} />}
          </section>
        </div>
      </div>
    </div>
  );
}
