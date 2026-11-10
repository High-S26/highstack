"use client";
import { useEffect, useState } from "react";
import { Zahl } from "../Felder";

interface Wahl { ollamaUrl: string; kontext: number; denken: boolean; standardFast: string; standardExpert: string; jeExperte: Record<string, string>; rueckfallClaude: boolean }
interface Vergleich { id: string; am: number; experte: string; ziel: string; modell: string; objekt: string; ms: number; aufrufe: number; inputTokens: number; outputTokens: number; fehler: string | null; schemaFehler: string[]; ok: boolean; termine?: number; termineErwartet?: number; ergebnis: unknown }
interface Daten {
  wahl: Wahl; claude: boolean; rueckfaelle: { am: number; experte: string; grund: string }[];
  lokal: { ok: boolean; modelle: { name: string; groesseGb: number; parameter: string | null; quantisierung: string | null }[]; fehler?: string };
  experten: { id: string; titel: string; klasse: "expert" | "fast"; vergleichbar: boolean }[];
  objekte: { id: string; titel: string }[]; vergleiche: Vergleich[];
}
const KLASSE = { fast: "schnell", expert: "gründlich" } as const;
const sek = (ms: number) => `${(ms / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} s`;
const name = (z: string) => z === "claude" ? "Claude" : z.replace(/^ollama:/, "");
const kurz = (e: unknown) => { const x = e as Record<string, unknown> | null; if (!x) return "–"; return String(x.kernaussage ?? x.zusammenfassung ?? (Array.isArray(x.termine) ? `${x.termine.length} Termine` : JSON.stringify(x).slice(0, 160))); };

/** KI-Modelle: Claude oder lokal (Ollama) je Experte, mit Vergleichslauf */
export function Modelle() {
  const [d, setD] = useState<Daten | null>(null); const [w, setW] = useState<Wahl | null>(null); const [msg, setMsg] = useState<string | null>(null);
  const [auswahl, setAuswahl] = useState<string[]>(["kurzurteil", "terminleser"]); const [objektId, setObjektId] = useState(""); const [lokalZiel, setLokalZiel] = useState("");
  const [laeuft, setLaeuft] = useState<string | null>(null); const [offen, setOffen] = useState<string | null>(null);
  const laden = () => fetch("/api/admin/modelle").then(r => r.json()).then((j: Daten) => { setD(j); setW(j.wahl); setLokalZiel(z => z || (j.lokal.modelle[0] ? `ollama:${j.lokal.modelle[0].name}` : "")); });
  useEffect(() => { laden(); }, []);
  if (!d || !w) return <p className="note">Lädt …</p>;
  const ziele: [string, string][] = [["claude", `Claude${d.claude ? "" : " (Schlüssel fehlt)"}`], ...d.lokal.modelle.map(m => [`ollama:${m.name}`, `${m.name} · lokal${m.parameter ? `, ${m.parameter}` : ""}${m.groesseGb ? `, ${m.groesseGb.toLocaleString("de-DE")} GB` : ""}`] as [string, string])];
  // eingestellte, aber nicht installierte Modelle trotzdem anzeigen
  for (const z of [w.standardFast, w.standardExpert, ...Object.values(w.jeExperte)]) if (z && !ziele.some(([k]) => k === z)) ziele.push([z, `${name(z)} (nicht gefunden)`]);
  const speichern = async () => { setMsg(null); const r = await fetch("/api/admin/modelle", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ aktion: "speichern", wahl: w }) }); const j = await r.json(); if (!r.ok) setMsg(j.fehler); else { setW(j.wahl); setMsg("✓ Gespeichert. Gilt ab dem nächsten Lauf."); } };
  const vergleichen = async () => {
    setMsg(null);
    for (const ex of auswahl) for (const ziel of ["claude", lokalZiel].filter(Boolean)) {
      setLaeuft(`${d.experten.find(e => e.id === ex)?.titel ?? ex} mit ${name(ziel)} …`);
      const r = await fetch("/api/admin/modelle", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ aktion: "vergleich", experte: ex, ziel, objektId: objektId || undefined }) });
      const j = await r.json().catch(() => ({ fehler: `HTTP ${r.status}` })); if (!r.ok) { setMsg(`${name(ziel)}: ${j.fehler}`); continue; }
      setD(x => x ? { ...x, vergleiche: [j, ...x.vergleiche] } : x);
    }
    setLaeuft(null);
  };
  const auswahlSel = (id: string, wert: string, onChange: (v: string) => void, leer?: string) => (
    <select id={id} value={wert} onChange={e => onChange(e.target.value)}>{leer && <option value="">{leer}</option>}{ziele.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
  );
  // Vergleiche paarweise nach Experte gruppieren (neueste zuerst)
  const reihen = d.vergleiche.slice(0, 24);
  return (
    <>
      <section className="panel">
        <div className="ph"><h2>Lokales Modell (Ollama)</h2><span className={`pill ${d.lokal.ok ? "p-opp" : "p-watch"}`}>{d.lokal.ok ? `erreichbar · ${d.lokal.modelle.length} Modell${d.lokal.modelle.length === 1 ? "" : "e"}` : "nicht erreichbar"}</span></div>
        {!d.lokal.ok && <p className="note warn-t">{d.lokal.fehler}</p>}
        {d.lokal.ok && !d.lokal.modelle.length && <p className="note warn-t">Ollama läuft, aber es ist noch kein Modell geladen. Im Terminal: <code>ollama pull qwen3.5:9b</code></p>}
        <p className="note">Läuft auf dem Rechner dieses Servers; Daten verlassen ihn nicht. Für 16 GB Arbeitsspeicher passt Qwen 3.5 9B (ca. 5 GB). Einrichtung: Ollama installieren (ollama.com), dann <code>ollama pull qwen3.5:9b</code>.</p>
        <div className="fields">
          <div className="fld"><div className="lrow"><label htmlFor="ol-url">Adresse</label></div><input id="ol-url" value={w.ollamaUrl} onChange={e => setW({ ...w, ollamaUrl: e.target.value })} /></div>
          <Zahl label="Kontextlänge" einheit="Tokens" min={2048} max={131072} wert={w.kontext} onChange={v => v && setW({ ...w, kontext: v })} hinweis="16.384 reicht für Objektdaten; mehr braucht mehr Arbeitsspeicher" />
          <label className="sc-radio"><input type="checkbox" checked={w.denken} onChange={e => setW({ ...w, denken: e.target.checked })} /> Denkmodus (gründlicher, deutlich langsamer)</label>
          <label className="sc-radio"><input type="checkbox" checked={w.rueckfallClaude} onChange={e => setW({ ...w, rueckfallClaude: e.target.checked })} /> Bei Ausfall oder unbrauchbarer Antwort mit Claude weiter</label>
        </div>
      </section>

      <section className="panel">
        <div className="ph"><h2>Welches Modell für welchen Experten</h2></div>
        <div className="fields">
          <div className="fld"><div className="lrow"><label htmlFor="m-fast">Standard für schnelle Aufgaben</label></div>{auswahlSel("m-fast", w.standardFast, v => setW({ ...w, standardFast: v }))}</div>
          <div className="fld"><div className="lrow"><label htmlFor="m-exp">Standard für gründliche Aufgaben</label></div>{auswahlSel("m-exp", w.standardExpert, v => setW({ ...w, standardExpert: v }))}</div>
        </div>
        <div className="tbl"><table><thead><tr><th>Experte</th><th>Art</th><th>Modell</th></tr></thead><tbody>
          {d.experten.map(e => <tr key={e.id}><td>{e.titel}</td><td className="note">{KLASSE[e.klasse]}</td><td>{auswahlSel(`m-${e.id}`, w.jeExperte[e.id] ?? "", v => { const j = { ...w.jeExperte }; if (v) j[e.id] = v; else delete j[e.id]; setW({ ...w, jeExperte: j }); }, `Standard (${name(e.klasse === "fast" ? w.standardFast : w.standardExpert)})`)}</td></tr>)}
        </tbody></table></div>
        <div className="row"><button type="button" className="btn" onClick={speichern}>Speichern</button>{msg && <span className="note" role="status">{msg}</span>}</div>
        <p className="note">Empfehlung für 16 GB: lokal für Datenanalyst, Terminleser, Dokumentprüfer und Kurzurteil; Claude für Komitee, Recht, Projektentwicklung und das Lesen von Mietspiegeln und Marktberichten. Erst mit dem Vergleich unten prüfen.</p>
        {d.rueckfaelle.length > 0 && <><div className="lbl">Letzte Rückfälle auf Claude</div><ul className="flags">{d.rueckfaelle.map(r => <li key={r.am}>{new Date(r.am).toLocaleString("de-DE")} · {r.experte}: {r.grund}</li>)}</ul></>}
      </section>

      <section className="panel">
        <div className="ph"><h2>Vergleichslauf</h2><span className="tag">gleiche Aufgabe, beide Modelle</span></div>
        <div className="m-wahl">{d.experten.filter(e => e.vergleichbar).map(e => <label key={e.id} className="sc-radio"><input type="checkbox" checked={auswahl.includes(e.id)} onChange={x => setAuswahl(a => x.target.checked ? [...a, e.id] : a.filter(y => y !== e.id))} /> {e.titel}</label>)}</div>
        <div className="fields">
          <div className="fld"><div className="lrow"><label htmlFor="v-obj">Objekt</label></div><select id="v-obj" value={objektId} onChange={e => setObjektId(e.target.value)}><option value="">Beispielobjekt</option>{d.objekte.map(o => <option key={o.id} value={o.id}>{o.titel}</option>)}</select></div>
          <div className="fld"><div className="lrow"><label htmlFor="v-lok">Lokales Modell</label></div><select id="v-lok" value={lokalZiel} onChange={e => setLokalZiel(e.target.value)}><option value="">nur Claude</option>{ziele.filter(([k]) => k.startsWith("ollama:")).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        </div>
        <div className="row"><button type="button" className="btn" disabled={!!laeuft || !auswahl.length} onClick={vergleichen}>{laeuft ? "Läuft …" : "Vergleich starten"}</button>{laeuft && <span className="note" role="status">{laeuft}</span>}</div>
        <p className="note">Lokal auf einem MacBook Air dauert ein Experte je nach Kontext 30 Sekunden bis wenige Minuten. Bewertet wird: hält das Ergebnis das Ausgabeschema ein, Dauer, Tokens; beim Terminleser zusätzlich, wie viele der {13} Termine erkannt wurden.</p>
        {reihen.length > 0 && <div className="tbl"><table><thead><tr><th>Experte · Objekt</th><th>Modell</th><th className="num">Dauer</th><th className="num">Tokens</th><th>Ergebnis</th></tr></thead><tbody>
          {reihen.map(v => <tr key={v.id} onClick={() => setOffen(o => o === v.id ? null : v.id)} style={{ cursor: "pointer" }}>
            <td>{d.experten.find(e => e.id === v.experte)?.titel ?? v.experte}<div className="note">{v.objekt} · {new Date(v.am).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</div></td>
            <td>{name(v.ziel)}<div className="note">{v.modell}</div></td>
            <td className="num">{sek(v.ms)}</td><td className="num">{(v.inputTokens + v.outputTokens).toLocaleString("de-DE")}</td>
            <td><span className={`pill ${v.ok ? "p-opp" : "p-pass"}`}>{v.fehler ? "Fehler" : v.schemaFehler.length ? `${v.schemaFehler.length} Schemafehler` : "✓ schemakonform"}</span>{v.termine != null && <span className="note"> {v.termine}/{v.termineErwartet} Termine</span>}
              <div className="note">{v.fehler ?? kurz(v.ergebnis)}</div>
              {offen === v.id && <pre className="sc-kosten">{v.schemaFehler.length ? v.schemaFehler.join("\n") + "\n\n" : ""}{JSON.stringify(v.ergebnis, null, 2)}</pre>}</td>
          </tr>)}
        </tbody></table></div>}
      </section>
    </>
  );
}
