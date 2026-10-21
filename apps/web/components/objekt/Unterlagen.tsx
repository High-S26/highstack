"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import type { Dokument, Objektdatensatz, Unterlagendatei } from "@/lib/typen";
import { istBild, mitDateien, verschiebe } from "@/lib/unterlagen";
import { ANGEBOT_KEYS, unterlagenFuer } from "@/lib/vorgaben";
import { useApp } from "../App";
import { Expertenzeile } from "../Experten";
import { Ansicht, dateiUrl } from "./Ansicht";

const STATUS: [Dokument["status"], string][] = [["offen", "offen"], ["angefordert", "angefordert"], ["erhalten", "erhalten"], ["geprueft", "geprüft"], ["auffaellig", "auffällig"]];
const ANNEHMEN = "application/pdf,image/png,image/jpeg,image/webp";

export function Unterlagen({ o, setze, onNeu }: { o: Objektdatensatz; setze: (p: Partial<Objektdatensatz>) => void; onNeu: (o: Objektdatensatz) => void }) {
  const { frage } = useApp();
  const [laeuft, setLaeuft] = useState<string | null>(null); const [ueber, setUeber] = useState(false); const [meldung, setMeldung] = useState<string[]>([]);
  const [ansicht, setAnsicht] = useState<Unterlagendatei | null>(null);
  const katalog = unterlagenFuer(o.objekt.asset); const titel = (k: string) => katalog.find(x => x[0] === k)?.[1] ?? k;
  const liste = katalog.map(([k, t, h]) => ({ ...mitDateien(o.dokumente.find(d => d.schluessel === k) ?? { schluessel: k, titel: t, status: "offen" as const }), hinweis: h }));
  const hoch = async (dateien: File[], schluessel?: string) => {
    if (!dateien.length) return; setLaeuft(schluessel ?? "alle"); setMeldung([`${dateien.length === 1 ? "Datei wird" : `${dateien.length} Dateien werden`} gelesen und eingeordnet …`]);
    try {
      const r = await api.hochladen(o.id, dateien, schluessel); onNeu({ ...o, dokumente: r.dokumente });
      setMeldung(r.ergebnis.map(x => `${x.datei} → ${x.titel}${x.sicher ? "" : " (bitte prüfen)"}${x.grundriss ? ` · Grundriss auf Seite ${x.grundriss.join(", ")} erkannt` : ""}${x.zeichen || istBild("", x.datei) ? "" : " · kein Text lesbar"}`));
    } catch (e) { setMeldung([(e as Error).message]); } finally { setLaeuft(null); }
  };
  const status = (k: string, s: Dokument["status"]) => setze({ dokumente: liste.map(({ hinweis: _h, ...d }) => d.schluessel === k ? { ...d, status: s } : d) });
  const ordne = (datei: string, nach: string) => setze({ dokumente: verschiebe(liste.map(({ hinweis: _h, ...d }) => d), datei, nach, titel) });
  const entferne = async (f: Unterlagendatei) => {
    if (!await frage({ titel: "Datei entfernen?", text: `„${f.name}“ wird gelöscht${f.aus ? "" : ", auch verlinkte Grundriss-Seiten"}.`, ja: "Entfernen", gefahr: true })) return;
    try { const r = await api.entferneDatei(o.id, f.id); onNeu({ ...o, dokumente: r.dokumente }); } catch (e) { setMeldung([(e as Error).message]); }
  };
  const vorhanden = liste.filter(d => !ANGEBOT_KEYS.has(d.schluessel) && d.schluessel !== "sonst" && d.dateien?.length).length;
  const ddAnzahl = liste.filter(d => !ANGEBOT_KEYS.has(d.schluessel) && d.schluessel !== "sonst").length;

  const Datei = ({ f, d }: { f: Unterlagendatei; d: Dokument }) => (
    <li className="datei">
      {istBild(f.mime, f.name) ? <button type="button" className="mini-bild" onClick={() => setAnsicht(f)} aria-label={`${f.name} ansehen`}><img src={dateiUrl(f)} alt="" loading="lazy" /></button> : <span className="mini-typ" aria-hidden="true">PDF</span>}
      <div className="dt">
        <button type="button" className="linkbtn" onClick={() => setAnsicht(f)}>{f.name}</button>
        <span className="note">{f.aus ? `aus ${titel(f.aus)}, Seite ${f.seiten?.join(", ")}` : f.erkannt ? `${f.erkannt.sicher ? "erkannt" : "vermutet"}: ${f.erkannt.grund}` : ""}{!f.aus && !f.text && !istBild(f.mime, f.name) ? " · kein Text lesbar" : ""}</span>
      </div>
      {f.erkannt && !f.erkannt.sicher && !f.aus && <span className="tag warnt">bitte prüfen</span>}
      {!f.aus && <select aria-label={`${f.name} einordnen`} value={d.schluessel} onChange={e => ordne(f.id, e.target.value)}>{katalog.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>}
      <button type="button" className="icon danger" onClick={() => entferne(f)} aria-label={`${f.name} entfernen`} title="Entfernen"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg></button>
    </li>
  );
  const Punkt = ({ d, statusWahl }: { d: (typeof liste)[number]; statusWahl: boolean }) => (
    <div className="ddi">
      <div>
        <div className="nm">{d.titel}</div><div className="note">{d.hinweis}</div>
        {!!d.dateien?.length && <ul className="dateien">{d.dateien.map(f => <Datei key={`${f.id}-${f.aus ?? ""}`} f={f} d={d} />)}</ul>}
      </div>
      <div className="ac">
        {statusWahl && <select aria-label={`Status ${d.titel}`} value={d.status} onChange={e => status(d.schluessel, e.target.value as Dokument["status"])}>{STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>}
        <label className="btn ghost sm upl">{laeuft === d.schluessel ? "lädt …" : d.dateien?.length ? "Ergänzen" : "Hochladen"}<input type="file" multiple accept={ANNEHMEN} onChange={e => hoch([...(e.target.files ?? [])], d.schluessel)} /></label>
      </div>
    </div>
  );
  const fotos = liste.find(d => d.schluessel === "fotos")?.dateien ?? [];
  return (
    <>
      <section className="panel">
        <div className="ph"><h2>Unterlagen</h2><span className="tag">Zuordnung automatisch, jederzeit änderbar</span></div>
        <div className={`drop${ueber ? " over" : ""}`} onDragOver={e => { e.preventDefault(); setUeber(true); }} onDragLeave={() => setUeber(false)} onDrop={e => { e.preventDefault(); setUeber(false); hoch([...e.dataTransfer.files]); }}>
          <b>Alles hier ablegen: Exposé, Pläne, Fotos, Protokolle …</b>
          <span className="note">{laeuft === "alle" ? "Wird verarbeitet …" : "Wir erkennen die Art jeder Datei am Namen und Inhalt. Grundrisse im Exposé werden zusätzlich als Plan verlinkt. PDF, PNG, JPG bis 20 MB."}</span>
          <label className="btn sm upl">Dateien auswählen<input type="file" multiple accept={ANNEHMEN} onChange={e => hoch([...(e.target.files ?? [])])} /></label>
        </div>
        {meldung.length > 0 && <ul className="hochgeladen" aria-live="polite">{meldung.map(m => <li key={m}>{m}</li>)}</ul>}
      </section>
      <section className="panel">
        <div className="ph"><h2>Angebot</h2><span className="tag">vom Verkäufer oder Makler</span></div>
        {fotos.some(f => istBild(f.mime, f.name)) && <div className="galerie">{fotos.filter(f => istBild(f.mime, f.name)).map(f => <button key={f.id} type="button" onClick={() => setAnsicht(f)} aria-label={`${f.name} ansehen`}><img src={dateiUrl(f)} alt="" loading="lazy" /></button>)}</div>}
        <div className="dd">{liste.filter(d => ANGEBOT_KEYS.has(d.schluessel)).map(d => <Punkt key={d.schluessel} d={d} statusWahl={false} />)}</div>
      </section>
      <section className="panel">
        <div className="ph"><h2>Due Diligence</h2><span className="tag">{vorhanden} von {ddAnzahl} vorhanden</span></div>
        <div className="explain">
          <div><b>Was geprüft wird</b><ul><li>Abgleich mit dem Exposé: Fläche, Miete, Hausgeld, Rücklage</li><li>Warnsignale: Sonderumlagen, Rückstände, Beschlüsse, Lasten</li><li>Verwalter, Bank und Recht lesen mit</li></ul></div>
          <div><b>Was nicht geprüft wird</b><ul><li>Keine rechtliche Würdigung von Verträgen</li><li>Kein Abruf bei Grundbuchamt oder Behörden</li><li>Ersetzt nicht Notar, Anwalt oder Gutachter</li></ul></div>
        </div>
        <div className="dd">{liste.filter(d => !ANGEBOT_KEYS.has(d.schluessel)).map(d => <Punkt key={d.schluessel} d={d} statusWahl />)}</div>
      </section>
      <section className="panel"><h2>Dokumentprüfer</h2><Expertenzeile objekt={o} id="dokumentpruefer" onNeu={onNeu} /></section>
      <Ansicht datei={ansicht} zu={() => setAnsicht(null)} />
    </>
  );
}
