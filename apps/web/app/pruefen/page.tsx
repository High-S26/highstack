"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/App";
import { Objektliste } from "@/components/Objektliste";
import { api } from "@/lib/client";

export default function Pruefen() {
  const { objekte, setzeObjekt } = useApp(); const router = useRouter();
  const neu = async (beispiel: boolean) => { const da = beispiel && objekte.find(x => x.objekt.titel?.startsWith("Beispiel:")); if (da) { router.push(`/objekt/${da.id}`); return; } const o = await api.neuesObjekt({ beispiel }); setzeObjekt(o); router.push(`/objekt/${o.id}`); };
  return (
    <div className="view">
      <div className="ph"><h1>Prüfen</h1><div className="row"><button className="btn" type="button" onClick={() => neu(false)}>+ Neues Objekt</button><button className="btn ghost" type="button" onClick={() => neu(true)}>Beispielobjekt</button></div></div>
      <div className="two">
        <section className="panel"><div className="ph"><h2>In Prüfung</h2><span className="tag">nach Score</span></div><Objektliste objekte={objekte.filter(o => o.status === "pruefung")} leer="Noch nichts in Prüfung. Prüfen Sie ein Objekt oder übernehmen Sie einen Kandidaten aus der Suche." /></section>
        <section className="panel"><div className="ph"><h2>Kandidaten aus der Suche</h2><Link className="btn ghost sm" href="/suchen">Zur Suche</Link></div><Objektliste kandidat objekte={objekte.filter(o => o.status === "kandidat")} leer="Keine Kandidaten. In der Suche können Sie Inserate sichten." /></section>
      </div>
    </div>
  );
}
