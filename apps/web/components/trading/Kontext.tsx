"use client";
import type { Kontextstand } from "@/lib/kontext";
import { useEffect, useState } from "react";
import { Info } from "@/components/Info";

const ART: Record<string, string> = { hochstufung: "Hochstufung", herabstufung: "Herabstufung", "zahlen-gut": "Zahlen gut", "zahlen-schlecht": "Zahlen schwach", "prognose-hoch": "Prognose erhöht", "prognose-runter": "Prognose gesenkt", uebernahme: "Übernahme", rechtlich: "Rechtliches", sonstiges: "Meldung" };

/** Nachrichten, Insider-Käufe und Short-Anteil zu den Werten des Agenten, als Filter genutzt */
export function Kontext({ id, an, umschalten }: { id: string; an: boolean; umschalten: (an: boolean) => void }) {
  const [k, setK] = useState<(Kontextstand & { simulation?: boolean }) | null>(null);
  useEffect(() => { const hole = () => fetch(`/api/trading/${id}/kontext`).then(r => r.ok ? r.json() : null).then(setK).catch(() => null); hole(); const t = setInterval(hole, 5 * 60_000); return () => clearInterval(t); }, [id]);
  if (!k) return null;
  if (k.simulation) return null;
  const lagen = Object.values(k.lage);
  return (
    <section className="panel">
      <div className="ph"><h2>Nachrichten und Insider</h2><Info label="Nachrichten und Insider" text="Frische Nachrichten (Alpaca/Benzinga), Insider-Käufe über die Börse (SEC Form 4) und der Short-Anteil am Tagesvolumen (FINRA). Der Agent kauft nicht gegen eine frische schlechte Nachricht und shortet nicht gegen gute Nachrichten, gehäufte Insider-Käufe oder sehr hohen Short-Anteil. Ob das hilft, zeigt die Treffsicherheit." /><button type="button" className="linkbtn" onClick={() => umschalten(!an)}>{an ? "als Filter ignorieren" : "als Filter nutzen"}</button></div>
      <p className="note">{Object.entries(k.quellen).map(([q, t]) => `${q === "nachrichten" ? "Nachrichten" : q === "insider" ? "Insider" : "Short-Anteil"}: ${t}`).join(" · ")}</p>
      <div className="tbl"><table><thead><tr><th>Wert</th><th className="num">Nachrichten 24 h</th><th className="num">Insider-Käufer 30 T.</th><th className="num">Short-Anteil</th><th>Wirkung</th></tr></thead><tbody>
        {lagen.map(l => <tr key={l.symbol}><td><b>{l.symbol}</b></td><td className={`num ${l.nachrichten < 0 ? "dn" : l.nachrichten > 0 ? "up" : ""}`}>{l.nachrichten > 0 ? "+" : ""}{l.nachrichten}</td><td className="num">{l.insiderKaeufer}</td><td className="num">{l.shortAnteil == null ? "–" : `${Math.round(l.shortAnteil * 100)} %`}</td><td className="note">{l.gruende.join(" · ") || "keine"}</td></tr>)}
      </tbody></table></div>
      {k.nachrichten.length > 0 && <details><summary>Letzte Meldungen</summary><ul className="kj-wirk">{k.nachrichten.slice(0, 12).map(n => <li key={n.id}><span className={n.richtung > 0 ? "up" : n.richtung < 0 ? "dn" : ""}>{n.richtung > 0 ? "▲" : n.richtung < 0 ? "▼" : "•"}</span> <b>{n.symbole.join(", ")}</b> {ART[n.art]}: {n.url ? <a href={n.url} target="_blank" rel="noreferrer">{n.titel}</a> : n.titel} <span className="note">({new Date(n.zeit).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}, {n.quelle})</span></li>)}</ul></details>}
      {k.insider.length > 0 && <details><summary>Insidergeschäfte</summary><div className="tbl"><table><thead><tr><th>Datum</th><th>Wert</th><th>Person</th><th>Art</th><th className="num">Volumen</th></tr></thead><tbody>{k.insider.slice(0, 20).map((x, i) => <tr key={i}><td>{new Date(x.datum + "T12:00:00Z").toLocaleDateString("de-DE")}</td><td>{x.symbol}</td><td>{x.person} <span className="note">{x.rolle}</span></td><td className={x.art === "kauf" ? "up" : "dn"}>{x.art === "kauf" ? "Kauf" : "Verkauf"}</td><td className="num">{x.wert.toLocaleString("de-DE")} $</td></tr>)}</tbody></table></div></details>}
    </section>
  );
}
