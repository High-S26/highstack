"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/App";
import { Objektliste } from "@/components/Objektliste";
import { api } from "@/lib/client";

export default function Pruefen() {
  const { objekte, setzeObjekt, profil } = useApp(); const router = useRouter();
  const neu = async (beispiel: boolean) => { const da = beispiel && objekte.find(x => x.objekt.titel?.startsWith("Beispiel:")); if (da) { router.push(`/objekt/${da.id}`); return; } const o = await api.neuesObjekt({ beispiel }); setzeObjekt(o); router.push(`/objekt/${o.id}`); };
  const kandidaten = objekte.filter(o => o.status === "kandidat");
  const suchName = (id?: string) => profil?.suchen?.find(s => s.id === id)?.name;
  const gruppen = [...new Set(kandidaten.map(o => o.suchId))];
  return (
    <div className="view">
      <div className="ph"><h1>Prüfen</h1><div className="row"><button className="btn" type="button" onClick={() => neu(false)}>+ Neues Objekt</button><button className="btn ghost" type="button" onClick={() => neu(true)}>Beispielobjekt</button></div></div>
      <div className="two">
        <section className="panel"><div className="ph"><h2>In Prüfung</h2><span className="tag">{(n => `${n} ${n === 1 ? "Objekt" : "Objekte"}`)(objekte.filter(o => o.status === "pruefung").length)}</span></div>
          <Objektliste objekte={objekte.filter(o => o.status === "pruefung")} leer={<><b>Noch nichts in Prüfung</b><span>Legen Sie ein Objekt an oder übernehmen Sie einen Treffer aus einem Suchauftrag.</span></>} />
        </section>
        <section className="panel"><div className="ph"><h2>Treffer aus Suchaufträgen</h2><Link className="btn ghost sm" href="/suchen">Suchaufträge</Link></div>
          {kandidaten.length === 0 ? <div className="empty"><b>Keine offenen Treffer</b><span>In einem Suchauftrag fügen Sie Inserate ein. Die Treffer erscheinen hier und dort.</span></div>
            : gruppen.map(g => <div key={g ?? "ohne"} className="grpblock"><div className="grp">{g && suchName(g) ? <Link href={`/suchen/${g}`}>{suchName(g)}</Link> : "Ohne Suchauftrag"}</div><Objektliste kandidat objekte={kandidaten.filter(o => o.suchId === g)} leer="" /></div>)}
        </section>
      </div>
    </div>
  );
}
