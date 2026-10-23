"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/App";
import { Text } from "@/components/Felder";
import { pruefeBericht, SEGMENTE, THEMEN, type Fakt, type Marktbericht, type Segment, type Thema } from "@/lib/marktwissen";

/** Marktbericht prüfen: Fakten mit Seite gegen das Original abgleichen, korrigieren, freigeben */
export default function MarktberichtSeite({ params }: { params: { id: string } }) {
  const { frage, meldung, admin } = useApp(); const router = useRouter();
  const [b, setB] = useState<Marktbericht | null>(null); const [stand, setStand] = useState(""); const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => { fetch(`/api/admin/marktberichte/${params.id}`).then(r => r.json()).then(d => d.fehler ? meldung(d.fehler) : setB(d)); }, [params.id, meldung]);
  if (!admin) return <p className="note">Nur für Plattform-Admins.</p>;
  if (!b) return <p className="note">Lädt …</p>;
  const sende = async (x: Marktbericht) => { const r = await fetch(`/api/admin/marktberichte/${x.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(x) }); const d = await r.json(); if (!r.ok) throw new Error(d.fehler); return d as Marktbericht; };
  const aendere = (p: Partial<Marktbericht>) => { const n = { ...b, ...p }; setB(n); setStand("Ungespeichert …"); clearTimeout(timer.current); timer.current = setTimeout(async () => { try { const d = await sende(n); setB(x => x && { ...x, status: d.status }); setStand("Gespeichert"); } catch (e) { setStand((e as Error).message); } }, 700); };
  const fakt = (i: number, p: Partial<Fakt>) => aendere({ fakten: b.fakten.map((f, n) => n === i ? { ...f, ...p } : f) });
  const fehler = pruefeBericht(b);
  const freigeben = async () => { clearTimeout(timer.current); try { setB(await sende({ ...b, status: "geprueft" })); meldung("Freigegeben: fließt jetzt in Marktszenarien und Wertentwicklung ein"); } catch (e) { meldung((e as Error).message); } };
  return (
    <div className="view">
      <div className="objbar"><Link className="btn ghost sm" href="/admin?tab=berichte">← Marktberichte</Link><h1>{b.herausgeber} {b.titel}</h1>
        <span className={`badge ${b.status === "geprueft" ? "b-on" : "b-warn"}`}>{b.status === "geprueft" ? "freigegeben" : "Entwurf"}</span><span className="note">{stand}</span>
        <button type="button" className="btn sm danger" onClick={async () => { if (await frage({ titel: "Marktbericht löschen?", text: "Die Fakten fließen nicht mehr in Marktszenarien ein.", ja: "Löschen", gefahr: true })) { await fetch(`/api/admin/marktberichte/${b.id}`, { method: "DELETE" }); router.push("/admin?tab=berichte"); } }}>Löschen</button></div>
      <div className="two">
        <section className="panel"><h2>Angaben</h2><div className="fields">
          <Text label="Herausgeber" wert={b.herausgeber} onChange={v => aendere({ herausgeber: v })} /><Text label="Titel" wert={b.titel} onChange={v => aendere({ titel: v })} />
          <Text label="Stand" wert={b.stand} onChange={v => aendere({ stand: v })} platzhalter="Q3 2026" />
          <div className="fld"><label htmlFor="mb-d">Datum</label><input id="mb-d" type="date" value={b.datum ?? ""} onChange={e => aendere({ datum: e.target.value || null })} /></div>
          <Text label="Link" wert={b.quelleUrl} onChange={v => aendere({ quelleUrl: v })} /><Text label="Nutzungsrecht" wert={b.lizenz} onChange={v => aendere({ lizenz: v })} />
          <div className="fld full"><label htmlFor="mb-k">Kernaussagen (eigene Worte, eine je Zeile)</label><textarea id="mb-k" value={b.kernaussagen.join("\n")} onChange={e => aendere({ kernaussagen: e.target.value.split("\n").filter(x => x.trim()) })} /></div>
        </div></section>
        <section className="panel"><h2>Prüfung und Freigabe</h2>
          {fehler.length ? <ul className="flags">{fehler.slice(0, 8).map(f => <li key={f} className="crit">{f}</li>)}</ul> : <p className="note">Keine Lücken. Gleichen Sie einige Fakten anhand der Seitenzahl mit dem Original ab.</p>}
          {b.status === "geprueft" ? <button type="button" className="btn ghost" onClick={() => aendere({ status: "entwurf" })}>Zurück auf Entwurf</button> : <button type="button" className="btn" disabled={fehler.length > 0} onClick={freigeben}>Freigeben</button>}
        </section>
      </div>
      <section className="panel">
        <div className="ph"><h2>Fakten</h2><span className="tag">{b.fakten.length}</span></div>
        <div className="tbl"><table className="mb-tab"><thead><tr><th>Thema</th><th>Segment</th><th>Region</th><th>Kennzahl</th><th>Wert</th><th>Einheit</th><th>Vj.</th><th>Stichtag</th><th>S.</th><th /></tr></thead><tbody>
          {b.fakten.map((f, i) => <tr key={f.id}>
            <td><select value={f.thema} onChange={e => fakt(i, { thema: e.target.value as Thema })}>{Object.entries(THEMEN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
            <td><select value={f.segment} onChange={e => fakt(i, { segment: e.target.value as Segment })}>{Object.entries(SEGMENTE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
            <td><input value={f.region} onChange={e => fakt(i, { region: e.target.value })} /></td>
            <td><input value={f.kennzahl} onChange={e => fakt(i, { kennzahl: e.target.value })} /></td>
            <td><input className="kurz" value={f.wertText ?? (f.wert == null ? "" : String(f.wert).replace(".", ","))} onChange={e => { const t = e.target.value; const n = Number(t.replace(/\./g, "").replace(",", ".")); fakt(i, /^[\d.,-]+$/.test(t.trim()) && Number.isFinite(n) ? { wert: n, wertText: undefined } : { wert: null, wertText: t }); }} /></td>
            <td><input className="kurz" value={f.einheit} onChange={e => fakt(i, { einheit: e.target.value })} /></td>
            <td><input className="kurz" value={f.veraenderung ?? ""} onChange={e => fakt(i, { veraenderung: e.target.value || undefined })} /></td>
            <td><input className="kurz" value={f.stichtag} onChange={e => fakt(i, { stichtag: e.target.value })} /></td>
            <td><input className="mini" value={f.seite ?? ""} onChange={e => fakt(i, { seite: Number(e.target.value) || undefined })} /></td>
            <td><button type="button" className="icon" aria-label="Fakt entfernen" onClick={() => aendere({ fakten: b.fakten.filter((_, n) => n !== i) })}>×</button></td>
          </tr>)}
        </tbody></table></div>
        <button type="button" className="btn ghost sm" onClick={() => aendere({ fakten: [...b.fakten, { id: `f${Date.now()}`, thema: "miete", segment: "wohnen", region: "", kennzahl: "", wert: null, einheit: "", stichtag: b.stand }] })}>+ Fakt</button>
      </section>
    </div>
  );
}
