"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { EINSTUFUNG, eur, num, pct } from "@/lib/format";
import type { Objektdatensatz } from "@/lib/typen";
import { useApp } from "./App";

function Zeile({ o, kandidat }: { o: Objektdatensatz; kandidat?: boolean }) {
  const { analyseVon, anlageprofil, setzeObjekt, entferneObjekt, meldung } = useApp();
  const router = useRouter(); const [sicher, setSicher] = useState(false);
  const a = analyseVon(o); const k = a.bewertung.kennzahlen; const cls = a.bewertung.einstufung;
  const pruefen = async () => { const n = await api.aendereObjekt(o.id, { status: "pruefung" }); setzeObjekt(n); router.push(`/objekt/${o.id}`); };
  const loeschen = async () => { if (!sicher) { setSicher(true); setTimeout(() => setSicher(false), 4000); return; } await api.loescheObjekt(o.id); entferneObjekt(o.id); meldung(kandidat ? "Kandidat verworfen." : "Objekt gelöscht."); };
  return (
    <div className="orow">
      <div>
        <Link className="t" href={`/objekt/${o.id}`}>{o.objekt.titel || "Ohne Titel"}</Link>
        <div className="m">{[o.objekt.ort, o.objekt.kaufpreis ? eur(o.objekt.kaufpreis) : null, o.objekt.wohnflaeche ? `${o.objekt.wohnflaeche} m²` : null, anlageprofil(o.anlageprofilId).name].filter(Boolean).join(" · ")}</div>
        <div className="k">
          {k.bruttorendite != null && <span>Rendite {pct(k.bruttorendite)}</span>}
          {k.faktor != null && <span>Faktor {num(k.faktor, 1)}</span>}
          {k.cashflowMonat != null && <span className={k.cashflowMonat < 0 ? "dn" : "up"}>CF {eur(k.cashflowMonat)}/M.</span>}
          {Object.keys(o.module).length > 0 && <span>{Object.keys(o.module).length} Gestaltung</span>}
        </div>
        {!a.bewertung.regionOk && <div className="note">außerhalb Ihrer Regionen</div>}
      </div>
      <div className="a">
        {cls && <span className={`pill p-${cls}`}>{a.bewertung.score != null ? `${Math.round(a.bewertung.score)} · ` : ""}{EINSTUFUNG[cls]}</span>}
        {kandidat && <button type="button" className="btn sm" onClick={pruefen}>Prüfen</button>}
        <button type="button" className="btn danger sm" onClick={loeschen}>{sicher ? "Sicher?" : kandidat ? "Verwerfen" : "Löschen"}</button>
      </div>
    </div>
  );
}

export function Objektliste({ objekte, leer, kandidat }: { objekte: Objektdatensatz[]; leer: string; kandidat?: boolean }) {
  const { analyseVon } = useApp();
  if (!objekte.length) return <div className="empty"><span>{leer}</span></div>;
  const sortiert = [...objekte].map(o => [o, analyseVon(o).bewertung.score ?? -1] as const).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  return <div className="olist">{sortiert.map(o => <Zeile key={o.id} o={o} kandidat={kandidat} />)}</div>;
}
