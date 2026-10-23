"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/App";
import type { Marktbericht } from "@/lib/marktwissen";

/** Marktberichte: PDF auslesen lassen oder Import-Datei einspielen; erst nach Freigabe sehen Nutzer die Fakten */
export function Marktberichte() {
  const { meldung } = useApp(); const router = useRouter();
  const [l, setL] = useState<Marktbericht[] | null>(null); const [url, setUrl] = useState(""); const [lizenz, setLizenz] = useState(""); const [laeuft, setLaeuft] = useState(false);
  const pdf = useRef<HTMLInputElement>(null); const json = useRef<HTMLInputElement>(null);
  useEffect(() => { fetch("/api/admin/marktberichte").then(r => r.json()).then(setL).catch(() => setL([])); }, []);
  const fertig = async (r: Response) => { const d = await r.json(); if (!r.ok) throw new Error(d.fehler ?? `Fehler ${r.status}`); meldung(`${d.fakten.length} Fakten übernommen, bitte prüfen`); router.push(`/admin/marktberichte/${d.id}`); };
  const auslesen = async (f?: File) => { if (!f) return; setLaeuft(true); const fd = new FormData(); fd.append("datei", f); fd.append("quelleUrl", url); fd.append("lizenz", lizenz); try { await fertig(await fetch("/api/admin/marktberichte/lesen", { method: "POST", body: fd })); } catch (e) { meldung((e as Error).message); } finally { setLaeuft(false); if (pdf.current) pdf.current.value = ""; } };
  const importieren = async (f?: File) => { if (!f) return; try { const d = JSON.parse(await f.text()); await fertig(await fetch("/api/admin/marktberichte", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...d, quelleUrl: d.quelleUrl || url, lizenz: d.lizenz || lizenz }) })); } catch (e) { meldung(`Import fehlgeschlagen: ${(e as Error).message}`); } finally { if (json.current) json.current.value = ""; } };
  return (
    <section className="panel">
      <div className="ph"><h2>Marktberichte</h2><span className="tag">{l ? `${l.filter(b => b.status === "geprueft").length} freigegeben · ${l.filter(b => b.status === "entwurf").length} Entwurf` : "lädt …"}</span></div>
      <p className="note">Gespeichert werden einzelne Kennzahlen mit Quelle, Stichtag und Seite sowie Kernaussagen in eigenen Worten, nicht der Bericht. Freigegebene Fakten fließen in die Marktszenarien und die Wertentwicklung im Durchspielen ein und dienen den Experten als Kontext; als Bericht angezeigt werden sie nicht.</p>
      <div className="ds-neu">
        <div className="fields">
          <div className="fld"><label htmlFor="mb-url">Link zum Bericht</label><input id="mb-url" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" /></div>
          <div className="fld"><label htmlFor="mb-liz">Nutzungsrecht</label><input id="mb-liz" value={lizenz} onChange={e => setLizenz(e.target.value)} placeholder="z. B. öffentlich, Fakten mit Quellenangabe" /></div>
        </div>
        <div className="row">
          <label className="btn upl">{laeuft ? "Liest aus …" : "PDF auslesen lassen"}<input ref={pdf} type="file" accept="application/pdf" disabled={laeuft} onChange={e => auslesen(e.target.files?.[0])} /></label>
          <label className="btn ghost upl">Import-Datei (JSON)<input ref={json} type="file" accept="application/json,.json" onChange={e => importieren(e.target.files?.[0])} /></label>
        </div>
      </div>
      {l && (l.length ? <div className="tbl"><table><thead><tr><th>Bericht</th><th>Stand</th><th className="num">Fakten</th><th>Status</th></tr></thead><tbody>
        {l.map(b => <tr key={b.id}><td><Link href={`/admin/marktberichte/${b.id}`}><b>{b.herausgeber} {b.titel}</b></Link></td><td>{b.stand}</td><td className="num">{b.fakten.length}</td><td><span className={`badge ${b.status === "geprueft" ? "b-on" : "b-warn"}`}>{b.status === "geprueft" ? "freigegeben" : "Entwurf"}</span>{b.herkunft === "ki" && <span className="note"> · KI</span>}</td></tr>)}
      </tbody></table></div> : <div className="empty">Noch kein Marktbericht.</div>)}
    </section>
  );
}
