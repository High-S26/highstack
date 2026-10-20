"use client";
import Link from "next/link";
import { useApp } from "@/components/App";
import { useSuchen } from "@/components/Suchen";
import { EINSTUFUNG } from "@/lib/format";

const QUELLEN: [string, string][] = [["Inserate, Suchagent-Mails und Newsletter einfügen", "aktiv"], ["Suchagenten von ImmoScout24 und Immowelt automatisch lesen", "geplant"], ["Makler-Newsletter automatisch lesen", "geplant"], ["Zwangsversteigerungen (ZVG-Portal)", "geplant"], ["Lizenzierte Marktdaten über mehrere Märkte", "geplant"]];
const datum = (t?: number) => t ? new Date(t).toLocaleDateString("de-DE", { day: "numeric", month: "short" }) : "noch nie";

export default function Suchauftraege() {
  const { anlageprofil, analyseVon } = useApp();
  const { suchen, treffer, neu, aendere, loesche } = useSuchen();
  return (
    <div className="view">
      <div className="ph"><h1>Suchaufträge</h1><button type="button" className="btn" onClick={neu}>+ Neuer Suchauftrag</button></div>
      <p className="lead">Ein Suchauftrag verbindet Ihr Anlageprofil mit einer Region und einer Assetklasse. Treffer aus Inseraten landen dort und werden nach Passung gerankt.</p>
      {suchen.length === 0 ? (
        <div className="empty"><b>Noch kein Suchauftrag</b><span>Legen Sie fest, was und wo Sie suchen. Danach fügen Sie Inserate ein und sehen die besten Treffer zuerst.</span><button type="button" className="btn" onClick={neu}>Ersten Suchauftrag anlegen</button></div>
      ) : (
        <div className="slist">
          {suchen.map(s => {
            const t = treffer(s.id).map(o => analyseVon(o)); const opp = t.filter(a => a.bewertung.einstufung === "opp").length;
            const beste = t.reduce<number | null>((m, a) => a.bewertung.score != null && (m == null || a.bewertung.score > m) ? a.bewertung.score : m, null);
            const besteKl = t.find(a => a.bewertung.score === beste)?.bewertung.einstufung;
            return (
              <article key={s.id} className={`scard${s.aktiv ? "" : " paused"}`}>
                <div className="sc-head">
                  <Link href={`/suchen/${s.id}`} className="sc-name">{s.name}</Link>
                  <span className={`badge ${s.aktiv ? "b-on" : "b-plan"}`}>{s.aktiv ? "Aktiv" : "Pausiert"}</span>
                </div>
                <div className="sc-meta">{[s.asset, s.region || "alle Regionen", anlageprofil(s.anlageprofilId).name].join(", ")}</div>
                <dl className="sc-stats">
                  <div><dt>Treffer</dt><dd>{t.length}</dd></div>
                  <div><dt>Opportunities</dt><dd>{opp}</dd></div>
                  <div><dt>Beste Passung</dt><dd>{beste != null ? <span className={`pill p-${besteKl}`}><b>{Math.round(beste)}</b>{besteKl ? EINSTUFUNG[besteKl] : ""}</span> : "–"}</dd></div>
                  <div><dt>Zuletzt gesichtet</dt><dd>{datum(s.gesichtet)}</dd></div>
                </dl>
                <div className="sc-act">
                  <Link href={`/suchen/${s.id}`} className="btn sm">Öffnen</Link>
                  <button type="button" className="btn sm ghost" onClick={() => aendere(s.id, { aktiv: !s.aktiv })}>{s.aktiv ? "Pausieren" : "Fortsetzen"}</button>
                  <button type="button" className="btn sm danger" onClick={() => loesche(s.id)}>Löschen</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <section className="panel"><div className="ph"><h2>Quellen</h2><span className="tag">woher Treffer kommen</span></div><div className="src">{QUELLEN.map(([t, s]) => <div key={t}><span>{t}</span><span className={`badge ${s === "aktiv" ? "b-on" : "b-plan"}`}>{s}</span></div>)}</div></section>
    </div>
  );
}
