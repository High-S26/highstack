"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import type { Dokument, Objektdatensatz } from "@/lib/typen";
import { unterlagenFuer } from "@/lib/vorgaben";
import { Expertenzeile } from "../Experten";

const STATUS: [Dokument["status"], string][] = [["offen", "offen"], ["angefordert", "angefordert"], ["erhalten", "erhalten"], ["geprueft", "geprüft"], ["auffaellig", "auffällig"]];

export function Unterlagen({ o, setze, onNeu }: { o: Objektdatensatz; setze: (p: Partial<Objektdatensatz>) => void; onNeu: (o: Objektdatensatz) => void }) {
  const [laeuft, setLaeuft] = useState<string | null>(null); const [ueber, setUeber] = useState(false); const [meldung, setMeldung] = useState("");
  const liste = unterlagenFuer(o.objekt.asset).map(([k, t, h]) => ({ ...(o.dokumente.find(d => d.schluessel === k) ?? { schluessel: k, titel: t, status: "offen" as const }), hinweis: h }));
  const hoch = async (dateien: File[], schluessel?: string) => {
    if (!dateien.length) return; setLaeuft(schluessel ?? "alle"); setMeldung(`Lade ${dateien.length} Datei(en) hoch und lese den Text …`);
    try { const r = await api.hochladen(o.id, dateien, schluessel); onNeu({ ...o, dokumente: r.dokumente }); setMeldung(r.ergebnis.map(x => `${x.datei} → ${unterlagenFuer(o.objekt.asset).find(u => u[0] === x.schluessel)?.[1] ?? x.schluessel}${x.zeichen ? "" : " (kein Text lesbar)"}`).join(" · ")); }
    catch (e) { setMeldung((e as Error).message); } finally { setLaeuft(null); }
  };
  const status = (k: string, s: Dokument["status"]) => setze({ dokumente: liste.map(({ hinweis: _h, ...d }) => d.schluessel === k ? { ...d, status: s } : d) });
  const gelesen = liste.filter(d => d.text).length;
  return (
    <>
      <section className="panel">
        <div className="ph"><h2>Unterlagen &amp; Due Diligence</h2><span className="tag">{gelesen} von {liste.length - 1} vorhanden</span></div>
        <div className="explain">
          <div><b>Was Sie hochladen können</b><ul><li>PDFs mit Textebene (eingescannte PDFs folgen)</li><li>bis 20 MB je Datei, mehrere auf einmal</li><li>Zuordnung automatisch nach Name und Inhalt</li></ul></div>
          <div><b>Was geprüft wird</b><ul><li>Abgleich mit dem Exposé: Fläche, Miete, Hausgeld, Rücklage</li><li>Warnsignale: Sonderumlagen, Rückstände, Beschlüsse, Lasten</li><li>Verwalter, Bank und Recht lesen mit</li></ul></div>
          <div><b>Was nicht geprüft wird</b><ul><li>Keine rechtliche Würdigung von Verträgen</li><li>Kein Abruf bei Grundbuchamt oder Behörden</li><li>Ersetzt nicht Notar, Anwalt oder Gutachter</li></ul></div>
        </div>
        <div className={`drop${ueber ? " over" : ""}`} onDragOver={e => { e.preventDefault(); setUeber(true); }} onDragLeave={() => setUeber(false)} onDrop={e => { e.preventDefault(); setUeber(false); hoch([...e.dataTransfer.files]); }}>
          <b>Unterlagen hier ablegen oder auswählen</b>
          <span className="note">{laeuft === "alle" ? "Wird verarbeitet …" : meldung || "Mehrere Dateien werden automatisch den Punkten der Checkliste zugeordnet."}</span>
          <label className="btn sm upl">Dateien auswählen<input type="file" multiple accept="application/pdf" onChange={e => hoch([...(e.target.files ?? [])])} /></label>
        </div>
        <div className="dd">{liste.map(d => (
          <div key={d.schluessel} className="ddi">
            <div><div className="nm">{d.titel}</div><div className="note">Worauf geachtet wird: {d.hinweis}</div>{d.dateiId && <a className="file" href={`/api/dateien/${d.dateiId}`} target="_blank" rel="noopener">{d.dateiname}{d.text ? "" : " (kein Text lesbar)"}</a>}</div>
            <div className="ac">
              <select aria-label={`Status ${d.titel}`} value={d.status} onChange={e => status(d.schluessel, e.target.value as Dokument["status"])}>{STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              <label className="btn ghost sm upl">{laeuft === d.schluessel ? "lädt …" : d.dateiId ? "Ergänzen" : "Hochladen"}<input type="file" multiple accept="application/pdf" onChange={e => hoch([...(e.target.files ?? [])], d.schluessel)} /></label>
            </div>
          </div>))}</div>
      </section>
      <section className="panel"><h2>Dokumentprüfer</h2><Expertenzeile objekt={o} id="dokumentpruefer" onNeu={onNeu} /></section>
    </>
  );
}
