"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/App";
import { api } from "@/lib/client";
import { findeMietspiegel, type Mietspiegel } from "@/lib/mietspiegel";
import type { Anfrage } from "@/lib/anfragen";

const datum = (d: string | null) => d ? new Date(d).toLocaleDateString("de-DE", { month: "2-digit", year: "numeric" }) : "–";

/** Datenbasis: gemeinsame Marktdaten mit Quelle und Stand. Zuerst Mietspiegel. */
export function Datenbasis() {
  const { objekte, profil, meldung } = useApp(); const router = useRouter();
  const [liste, setListe] = useState<Mietspiegel[] | null>(null); const [darf, setDarf] = useState(false);
  const [stadt, setStadt] = useState(""); const [url, setUrl] = useState(""); const [laeuft, setLaeuft] = useState(false); const datei = useRef<HTMLInputElement>(null);
  useEffect(() => { api.mietspiegelListe().then(r => { setListe(r.liste); setDarf(r.darfPflegen); }).catch(e => meldung((e as Error).message)); }, [meldung]);
  // Städte aus Objekten und Anlageprofilen, für die noch kein Mietspiegel erfasst ist
  const fehlend = useMemo(() => {
    if (!liste) return [];
    const orte = [...objekte.map(o => o.objekt.ort?.split(/[-,]/)[0]?.trim() ?? ""), ...(profil?.anlageprofile.flatMap(a => a.regionen) ?? [])].filter(x => x && x.length > 2);
    return [...new Set(orte)].filter(o => !findeMietspiegel(liste, o)).slice(0, 12);
  }, [liste, objekte, profil]);
  const anlegen = async (s: string) => { if (!s.trim()) return; const m = await api.neuerMietspiegel({ stadt: s.trim(), quelleUrl: url.trim() }); router.push(`/admin/mietspiegel/${m.id}`); };
  const auslesen = async (f: File | undefined) => {
    if (!f) return; setLaeuft(true);
    try { const m = await api.mietspiegelLesen(f, url.trim()); meldung(`${m.stadt}: ${m.felder.length} Felder ausgelesen, bitte prüfen`); router.push(`/admin/mietspiegel/${m.id}`); }
    catch (e) { meldung((e as Error).message); } finally { setLaeuft(false); if (datei.current) datei.current.value = ""; }
  };
  return (
    <>
      <Anfragen />
      <section className="panel">
        <div className="ph"><h2>Mietspiegel</h2><span className="tag">{liste ? `${liste.filter(m => m.status === "geprueft").length} geprüft · ${liste.filter(m => m.status === "entwurf").length} Entwurf` : "lädt …"}</span></div>
        <p className="note">Städte ab 50.000 Einwohnern müssen einen Mietspiegel haben und ihn kostenfrei zugänglich machen. Gespeichert wird die Tabelle mit Quelle und Gültigkeit; der Link führt zum Original.</p>
        {darf && <div className="ds-neu">
          <div className="fld"><label htmlFor="ds-url">Link zum Mietspiegel (Quelle)</label><input id="ds-url" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.stadt.de/mietspiegel" /></div>
          <div className="row">
            <label className="btn upl">{laeuft ? "Liest aus …" : "PDF auslesen lassen"}<input ref={datei} type="file" accept="application/pdf" disabled={laeuft} onChange={e => auslesen(e.target.files?.[0])} /></label>
            <span className="note">oder</span>
            <input aria-label="Stadt" value={stadt} onChange={e => setStadt(e.target.value)} placeholder="Stadt" style={{ width: 180 }} onKeyDown={e => { if (e.key === "Enter") anlegen(stadt); }} />
            <button type="button" className="btn ghost" disabled={!stadt.trim()} onClick={() => anlegen(stadt)}>Von Hand erfassen</button>
          </div>
        </div>}
        {fehlend.length > 0 && <div className="ds-fehlt"><span className="note">Für Ihre Objekte und Regionen fehlt noch:</span><div className="chips">{fehlend.map(f => <button key={f} type="button" className="chip" disabled={!darf} onClick={() => anlegen(f)}>+ {f}</button>)}</div></div>}
        {liste && (liste.length ? <div className="tbl"><table><thead><tr><th>Stadt</th><th>gültig ab</th><th>Art</th><th className="num">Felder</th><th>Status</th><th>Quelle</th></tr></thead><tbody>
          {liste.map(m => <tr key={m.id}><td><Link href={`/admin/mietspiegel/${m.id}`}><b>{m.stadt || "Ohne Stadt"}</b></Link></td><td>{datum(m.gueltigAb)}{m.gueltigBis && new Date(m.gueltigBis) < new Date() && <span className="tag warnt"> abgelaufen</span>}</td><td>{m.art}</td><td className="num">{m.felder.length}</td>
            <td><span className={`badge ${m.status === "geprueft" ? "b-on" : "b-warn"}`}>{m.status === "geprueft" ? "geprüft" : "Entwurf"}</span>{m.herkunft === "ki" && <span className="note"> · KI</span>}</td>
            <td>{m.quelleUrl ? <a href={m.quelleUrl} target="_blank" rel="noopener noreferrer">{m.quelleName || "Original"}</a> : m.quelleName || "–"}</td></tr>)}
        </tbody></table></div> : <div className="empty">Noch kein Mietspiegel erfasst.{darf ? " Laden Sie das PDF einer Stadt hoch oder erfassen Sie die Tabelle von Hand." : ""}</div>)}
        {!darf && <p className="note">Nur lesen.</p>}
      </section>
      <section className="panel">
        <div className="ph"><h2>Weitere Quellen</h2><span className="tag">in Vorbereitung</span></div>
        <ul className="ds-quellen">
          <li><b>Bodenrichtwerte (BORIS)</b><span>Amtlich, je Adresse. NRW frei nutzbar (Datenlizenz Deutschland Zero).</span></li>
          <li><b>Immobilienrichtwerte</b><span>Amtliche Vergleichspreise je m² für Wohnungen und Häuser, wo veröffentlicht.</span></li>
          <li><b>Marktberichte</b><span>Eigene, lizenzierte Berichte hochladen; Werte nur für Ihr Konto.</span></li>
        </ul>
      </section>
    </>
  );
}

/** Nachfrage aus der Nutzung: Städte, in denen „Ermitteln“ keinen Mietspiegel fand */
function Anfragen() {
  const [l, setL] = useState<Anfrage[] | null>(null);
  const lade = () => fetch("/api/admin/anfragen").then(r => r.json()).then(setL).catch(() => setL([]));
  useEffect(() => { lade(); }, []);
  const offen = (l ?? []).filter(a => !a.erledigt);
  if (!offen.length) return null;
  const setze = async (id: string, erledigt: boolean) => { await fetch("/api/admin/anfragen", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, erledigt }) }); lade(); };
  return (
    <section className="panel">
      <div className="ph"><h2>Nachfrage</h2><span className="tag">automatisch aus der Nutzung · {offen.length} offen</span></div>
      <div className="tbl"><table><thead><tr><th>Was fehlt</th><th className="num">Konten</th><th className="num">Abrufe</th><th>zuletzt</th><th /></tr></thead><tbody>
        {offen.map(a => <tr key={a.id}><td><b>{a.art === "mietspiegel" ? "Mietspiegel" : "Marktbericht"} {a.ziel}</b></td><td className="num">{a.konten.length}</td><td className="num">{a.anzahl}</td><td>{new Date(a.letzte).toLocaleDateString("de-DE")}</td><td><button type="button" className="linkbtn" onClick={() => setze(a.id, true)}>erledigt</button></td></tr>)}
      </tbody></table></div>
    </section>
  );
}
