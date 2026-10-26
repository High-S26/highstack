"use client";
import type { Terminlage } from "@highstack/trading";
import { useEffect, useState } from "react";

const uhrNy = (m: number) => { const x = 9 * 60 + 30 + m; return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(((x % 60) + 60) % 60).padStart(2, "0")}`; };

/** Cockpit: Wirtschaftskalender des Handelstags mit Pausen, Regeln je Wert und Ideen */
export function Termine({ symbole, datum, an, umschalten }: { symbole: string[]; datum?: string; an: boolean; umschalten: (an: boolean) => void }) {
  const [l, setL] = useState<Terminlage | null>(null); const [fehler, setFehler] = useState(false);
  const schluessel = `${symbole.join(",")}|${datum ?? ""}`;
  useEffect(() => {
    const hole = () => fetch(`/api/trading/termine?symbole=${encodeURIComponent(symbole.join(","))}${datum ? `&datum=${datum}` : ""}`).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(d => { setL(d); setFehler(false); }).catch(() => setFehler(true));
    hole(); const t = setInterval(hole, 60_000); return () => clearInterval(t);
  }, [schluessel]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!l) return fehler ? <section className="panel"><h2>Termine</h2><p className="note">Der Kalender konnte nicht geladen werden.</p></section> : null;
  const tag = new Date(l.datum + "T12:00:00Z").toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" });
  const beobachtet = new Set(symbole);
  return (
    <section className="panel tr-termine">
      <div className="ph"><h2>Termine {tag}</h2><span className="tag">{an ? "werden berücksichtigt" : "ignoriert"} · <button type="button" className="linkbtn" onClick={() => umschalten(!an)}>{an ? "ignorieren" : "berücksichtigen"}</button></span></div>
      {!l.heute.length ? <p className="note">Für diesen Tag sind keine Termine hinterlegt. Admins pflegen den Wirtschaftskalender unter Admin › Konjunktur &amp; Prognosen › Termine.</p> :
        <ul className="tr-tliste">{l.heute.map((t, i) => <li key={i} className={t.wichtig ? "wichtig" : ""}>
          <span className="tr-tz">{t.zeit ?? "ganztags"}{t.zeitNy && <small>{t.zeitNy} NY</small>}</span>
          <span><b>{t.land ? `${t.land} · ` : ""}{t.titel}</b>{t.symbol && <span className={`tag${beobachtet.has(t.symbol) ? " on" : ""}`}>{t.symbol}{beobachtet.has(t.symbol) ? " · beobachtet" : ""}</span>}{(t.prognose || t.vorwert) && <span className="note"> Prognose {t.prognose ?? "–"}{t.vorwert ? `, zuvor ${t.vorwert}` : ""}</span>}</span>
        </li>)}</ul>}
      {an && (l.pausen.length > 0 || Object.keys(l.werte).length > 0) && <>
        <div className="lbl">Regeln für den Agenten</div>
        <ul className="flags">
          {l.pausen.map((p, i) => <li key={`p${i}`} className="warn">Keine neuen Einstiege {uhrNy(p.von)}–{uhrNy(p.bis)} New York: {p.titel}</li>)}
          {Object.entries(l.werte).map(([s, r]) => <li key={s} className="info"><b>{s}</b>: {r.text}</li>)}
        </ul>
      </>}
      {l.ideen.length > 0 && <><div className="lbl">Ideen und Einordnung</div>
        <ul className="tr-ideen">{l.ideen.map((x, i) => <li key={i}><b>{x.titel}</b><span>{x.text}</span></li>)}</ul>
        <p className="note">Erfahrungswerte zur Einordnung, keine Empfehlung. Uhrzeiten in deutscher Zeit, „NY“ = New York.</p></>}
    </section>
  );
}
