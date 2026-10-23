"use client";
import { useEffect, useState } from "react";
import { SEGMENTE, THEMEN, zeigeWert, type Marktfakt } from "@/lib/marktwissen";

type Antwort = { fakten: Marktfakt[]; quellen: { id: string; titel: string; stand: string; url: string; kernaussagen: string[] }[] };
/** Marktlage: erscheint von selbst, sobald für Ort und Objektart freigegebenes Marktwissen vorliegt */
export function Marktlage({ id, ort, asset }: { id: string; ort: string; asset: string }) {
  const [d, setD] = useState<Antwort | null>(null);
  useEffect(() => { fetch(`/api/objekte/${id}/marktlage`).then(r => r.ok ? r.json() : null).then(setD).catch(() => setD(null)); }, [id, ort, asset]);
  if (!d?.fakten.length) return null;
  return (
    <section className="panel marktlage">
      <div className="ph"><h2>Marktlage</h2><span className="tag">{d.quellen.map(q => `${q.titel} (${q.stand})`).join(" · ")}</span></div>
      <div className="ml-kacheln">{d.fakten.map(f => (
        <div key={f.id} className="ml-k" title={`${THEMEN[f.thema]} · ${SEGMENTE[f.segment]} · ${f.stichtag}${f.seite ? ` · S. ${f.seite}` : ""}`}>
          <span className="ml-r">{f.region}</span>
          <b>{zeigeWert(f)}</b>
          <span>{f.kennzahl}</span>
          {f.veraenderung && <span className={`ml-v ${f.veraenderung.trim().startsWith("−") || f.veraenderung.trim().startsWith("-") ? "dn" : "up"}`}>{f.veraenderung} z. Vj.</span>}
        </div>))}</div>
      {d.quellen[0]?.kernaussagen.length ? <ul className="ml-aussagen">{d.quellen[0].kernaussagen.map(k => <li key={k}>{k}</li>)}</ul> : null}
      <p className="note">Marktdaten Dritter, regelmäßig aktualisiert. Information, keine Bewertung dieses Objekts.</p>
    </section>
  );
}
