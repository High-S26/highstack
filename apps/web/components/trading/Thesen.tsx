"use client";
import type { These } from "@highstack/prognose";
import { useEffect, useState } from "react";

const tagDe = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;
const ART: Record<These["art"], string> = { vorsicht: "Vorsicht", chance: "Chance", einordnung: "Einordnung" };

/** Ideen und Thesen: Termine und Marktdaten zu begründeten Aussagen verdichtet (wie ein guter Marktbericht) */
export function Thesen({ datum, symbole, max = 4 }: { datum?: string; symbole?: string[]; max?: number }) {
  const [t, setT] = useState<These[] | null>(null); const [alle, setAlle] = useState(false);
  useEffect(() => { fetch(`/api/trading/thesen${datum ? `?datum=${datum}` : ""}`).then(r => r.ok ? r.json() : []).then(setT).catch(() => setT([])); }, [datum]);
  if (!t) return null;
  const eigene = new Set(symbole ?? []);
  const liste = alle ? t : t.slice(0, max);
  return (
    <section className="panel thesen">
      <div className="ph"><h2>Ideen &amp; Thesen</h2><span className="tag">aus Terminen und Marktdaten</span></div>
      {!t.length ? <p className="note">Gerade verdichten sich keine Termine und Marktdaten zu einer These. Grundlage sind der Wirtschaftskalender und die Konjunkturdaten im Admin-Bereich.</p> :
        <div className="th-liste">{liste.map(x => { const betrifft = x.maerkte.some(m => eigene.has(m)); return (
          <details key={x.id} className={`th th-${x.art}`}>
            <summary><span className={`th-art th-${x.art}`}>{ART[x.art]}</span><b>{x.titel}</b>{betrifft && <span className="tag">betrifft Ihre Werte</span>}<span className="th-staerke" aria-label={`Stärke ${Math.round(x.staerke * 100)} %`}><i style={{ width: `${Math.round(x.staerke * 100)}%` }} /></span></summary>
            <p>{x.kern}</p>
            <div className="lbl">Fakten</div><ul>{x.fakten.map((f, i) => <li key={i}>{f.text}{f.stand ? ` (Stand ${tagDe(f.stand)})` : ""}</li>)}</ul>
            <div className="lbl">Umsetzung</div><ul>{x.umsetzung.map((u, i) => <li key={i}>{u}</li>)}</ul>
            <div className="lbl">Dagegen spricht</div><ul>{x.gegen.map((g, i) => <li key={i}>{g}</li>)}</ul>
            {x.widerlegt !== "—" && <p className="note"><b>Widerlegt, wenn:</b> {x.widerlegt}</p>}
            <p className="note">Zeitfenster {tagDe(x.von)} bis {tagDe(x.bis)} · {x.maerkte.join(", ")}</p>
          </details>); })}</div>}
      {t.length > max && <button type="button" className="linkbtn" onClick={() => setAlle(!alle)}>{alle ? "weniger zeigen" : `alle ${t.length} zeigen`}</button>}
      <p className="note">Erfahrungswerte und Denkanstöße zur Einordnung, keine Anlageberatung.</p>
    </section>
  );
}
