"use client";
import type { Bilanz, Ereignis, Indikator, Prognose, Punkt, Regime, Risikolage, Wirkung } from "@highstack/prognose";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/App";
import { Info } from "@/components/Info";

type Daten = {
  indikatoren: (Indikator & { anzahl: number; letzter: Punkt | null; aktualisiert: number | null; fehler: string | null })[];
  weitere: { id: string; anzahl: number; letzter: Punkt | null }[];
  lage: { regime: { regime: Regime; text: string }; risiko: { lage: Risikolage; faktor: number; gruende: string[] }; wirkungen: Wirkung[]; fehlend: { mechanismus: string; name: string; braucht: string[] }[] };
  mechanismen: { id: string; name: string; theorie: string; gewicht: number; aktuell: number }[];
  prognosen: Prognose[]; bilanz: Bilanz; ereignisse: Ereignis[]; fredSchluessel: boolean;
  rueckblick: { am: number; von: string; bis: string; schrittTage: number; anzahl: number; bilanz: Bilanz; gewichte: Record<string, number>; beispiele: Prognose[] } | null;
  stand: { letzterLauf: string | null; letzterAbruf?: number };
};
const ZIEL: Record<string, string> = { "aktien-us": "Aktien USA", "aktien-eu": "Aktien DE", "zins-lang": "Zins lang", "immo-wert": "Wohnimmobilien", volatilitaet: "Schwankung", einzelwert: "Einzelwert" };
const REGIME: Record<Regime, string> = { erholung: "Erholung", ueberhitzung: "Überhitzung", stagflation: "Stagflation", abschwung: "Abschwung", unklar: "unklar" };
const RISIKO: Record<Risikolage, string> = { "risk-on": "Risikobereitschaft", neutral: "neutral", "risk-off": "Vorsicht" };
const pz = (v: number | null | undefined, d = 0) => v == null ? "–" : `${(v * 100).toLocaleString("de-DE", { maximumFractionDigits: d })} %`;
const zahl = (v: number | null | undefined, d = 2) => v == null ? "–" : v.toLocaleString("de-DE", { maximumFractionDigits: d });
const datum = (d: string) => new Date(d).toLocaleDateString("de-DE");
/** Einzahl/Mehrzahl: „1 Wert“, „3 Werte“ */
const anz = (n: number, eins: string, mehr: string) => `${n.toLocaleString("de-DE")} ${n === 1 ? eins : mehr}`;
const ART: Ereignis["art"][] = ["zinsentscheid", "inflation", "arbeitsmarkt", "zahlen", "index-aufnahme", "lockup-ende", "ipo", "sonstiges"];
const ART_NAME: Record<Ereignis["art"], string> = { zinsentscheid: "Zinsentscheid", inflation: "Inflationsdaten", arbeitsmarkt: "Arbeitsmarkt", zahlen: "Quartalszahlen", "index-aufnahme": "Indexaufnahme", "lockup-ende": "Lockup-Ende", ipo: "Börsengang", sonstiges: "Sonstiges" };

/**
 * Konjunktur und Prognosen: Datenstand, Wirkungsketten, laufende Prognosen und ihre Überprüfung.
 * Nutzer sehen davon nur die Wirkung (Marktszenarien, Positionsgröße im Trading).
 */
export function Konjunktur() {
  const { meldung, frage } = useApp(); const [d, setD] = useState<Daten | null>(null); const [laeuft, setLaeuft] = useState<string | null>(null);
  const [imp, setImp] = useState({ id: "pmi-us", text: "" }); const [ev, setEv] = useState<Omit<Ereignis, "id">>({ datum: "", art: "zinsentscheid", titel: "", symbol: "", wichtig: true });
  const [rb, setRb] = useState({ von: "2015-01-01", bis: new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10), schrittTage: 30 }); const [vorschau, setVorschau] = useState<{ anzahl: number; erste: Punkt | null; letzte: Punkt | null; fehler: { zeile: number; inhalt: string; text: string }[]; fehlerAnzahl: number } | null>(null);
  const [loeschen, setLoeschen] = useState({ von: "", bis: "" });
  const lade = useCallback(() => fetch("/api/admin/konjunktur").then(r => r.json()).then(setD), []);
  useEffect(() => { lade(); }, [lade]);
  const aktion = async (b: object, art: string) => {
    setLaeuft(art);
    try { const r = await fetch("/api/admin/konjunktur", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }); const x = await r.json(); if (!r.ok) throw new Error(x.fehler); await lade(); return x; }
    catch (e) { meldung((e as Error).message); return null; } finally { setLaeuft(null); }
  };
  if (!d) return <p className="note">Lädt …</p>;
  const b = d.bilanz; const neueste = d.prognosen.filter(p => p.erstellt === d.prognosen[0]?.erstellt);
  const bewertet = d.prognosen.filter(p => p.ergebnis).slice(0, 12);
  return (
    <>
      <div className="tiles">{([
        ["Konjunkturphase", REGIME[d.lage.regime.regime]],
        ["Risikolage", `${RISIKO[d.lage.risiko.lage]}`],
        ["Positionsgröße Trading", pz(d.lage.risiko.faktor)],
        ["Prognosen offen / geprüft", `${b.offen} / ${b.n}`],
        ["Trefferquote", pz(b.trefferquote)],
        ["Skill ggü. Grundhäufigkeit", b.skill == null ? "–" : zahl(b.skill, 2)],
      ] as const).map(([l, v]) => <div key={l}><span>{l}</span><strong>{v}</strong></div>)}</div>

      <div className="two">
        <section className="panel">
          <div className="ph"><h2>Lage</h2><span className="tag">Stand {d.stand.letzterLauf ? datum(d.stand.letzterLauf) : "noch kein Lauf"}</span></div>
          <p>{d.lage.regime.text}</p>
          <p className="note">Risikolage: {d.lage.risiko.gruende.join("; ")}.</p>
          <h3>Wirkungsketten, die gerade greifen</h3>
          {d.lage.wirkungen.length ? <ul className="kj-wirk">{d.lage.wirkungen.map((w, i) => <li key={i}><span className={w.richtung > 0 ? "up" : "dn"}>{w.richtung > 0 ? "▲" : "▼"}</span> <b>{ZIEL[w.ziel]}{w.symbol ? ` ${w.symbol}` : ""}</b> {w.grund} <span className="note">({d.mechanismen.find(m => m.id === w.mechanismus)?.name}, {w.horizontTage} Tage)</span></li>)}</ul> : <p className="note">Keine. Entweder fehlen Daten oder kein Auslöser ist erfüllt.</p>}
          {d.lage.fehlend.length > 0 && <p className="hint">Ohne Daten: {d.lage.fehlend.map(f => `${f.name} (${f.braucht.join(" oder ")})`).join(", ")}.</p>}
        </section>
        <section className="panel">
          <div className="ph"><h2>Aktuelle Prognosen</h2><button type="button" className="btn sm ghost" disabled={!!laeuft} onClick={async () => { const r = await aktion({ aktion: "lauf" }, "lauf"); if (r) meldung(`${anz(r.bewertet, "fällige Prognose", "fällige Prognosen")} geprüft, ${anz(r.neu, "neue Prognose", "neue Prognosen")}${r.vorhanden ? `, ${r.vorhanden === 1 ? "eine war" : `${r.vorhanden} waren`} heute schon da` : ""}`); }}>{laeuft === "lauf" ? "Läuft …" : "Lauf jetzt"}</button></div>
          {neueste.length ? <div className="tbl"><table className="kj-prog"><thead><tr><th>Ziel</th><th className="num">Tage</th><th className="num">steigt</th><th className="num">Spanne 80 %</th></tr></thead><tbody>
            {neueste.map(p => <tr key={p.id} title={p.beitraege.map(x => x.grund).join("\n")}><td>{ZIEL[p.ziel]}{p.symbol ? ` ${p.symbol}` : ""}<div className="note">{p.beitraege.length ? p.beitraege.map(x => x.grund).join("; ") : "nur Grundhäufigkeit"}</div></td><td className="num" data-l="Tage">{p.horizontTage}</td><td className="num" data-l="steigt"><b>{pz(p.pHoch)}</b></td><td className="num" data-l="Spanne 80 %">{p.spanne ? `${zahl(p.spanne.p10)} – ${zahl(p.spanne.p90)}` : "–"}</td></tr>)}
          </tbody></table></div> : <p className="note">Noch keine Prognosen. Sie entstehen täglich, sobald Daten da sind.</p>}
        </section>
      </div>

      <section className="panel">
        <div className="ph"><h2>Überprüfung</h2><Info label="Überprüfung" text="Jede Prognose wird bei Fälligkeit mit dem eingetretenen Wert verglichen. Brier-Score: mittlerer quadrierter Fehler der Wahrscheinlichkeit (0 perfekt, 0,25 Münzwurf). Skill über 0 heißt: besser als stur die langfristige Häufigkeit vorherzusagen. Kalibriert ist das Modell, wenn „70 %“ in etwa 70 % der Fälle eintritt. Gewichte der Wirkungsketten werden ab 20 geprüften Fällen nachgeschärft." /></div>
        {b.n ? <>
          <div className="sys">{([["Brier", zahl(b.brier, 3)], ["Brier Grundhäufigkeit", zahl(b.brierBasis, 3)], ["Spanne getroffen (Soll 80 %)", pz(b.bandAbdeckung)]] as const).map(([l, v]) => <div key={l}><span>{l}</span><b>{v}</b></div>)}</div>
          <div className="two">
            <div className="tbl"><table><thead><tr><th>Vorhergesagt</th><th className="num">Fälle</th><th className="num">Ø gesagt</th><th className="num">eingetreten</th></tr></thead><tbody>{b.kalibrierung.map(k => <tr key={k.von}><td>{pz(k.von)} – {pz(k.bis)}</td><td className="num">{k.n}</td><td className="num">{pz(k.vorhergesagt)}</td><td className="num">{pz(k.eingetreten)}</td></tr>)}</tbody></table></div>
            <div className="tbl"><table><thead><tr><th>Ziel</th><th className="num">Tage</th><th className="num">Fälle</th><th className="num">Treffer</th><th className="num">Brier</th></tr></thead><tbody>{b.jeZiel.map(z => <tr key={z.ziel + z.horizontTage}><td>{ZIEL[z.ziel]}</td><td className="num">{z.horizontTage}</td><td className="num">{z.n}</td><td className="num">{pz(z.trefferquote)}</td><td className="num">{zahl(z.brier, 3)}</td></tr>)}</tbody></table></div>
          </div>
          {bewertet.length > 0 && <details><summary>Zuletzt geprüft</summary><div className="tbl"><table><thead><tr><th>Erstellt</th><th>Ziel</th><th className="num">steigt</th><th className="num">Ausgang → Ergebnis</th><th>Treffer</th></tr></thead><tbody>{bewertet.map(p => <tr key={p.id}><td>{datum(p.erstellt)}</td><td>{ZIEL[p.ziel]} {p.horizontTage} T.</td><td className="num">{pz(p.pHoch)}</td><td className="num">{zahl(p.ausgang)} → {zahl(p.ergebnis!.wert)}</td><td>{p.pHoch === 0.5 ? "–" : (p.pHoch > 0.5) === p.ergebnis!.hoch ? "ja" : "nein"}</td></tr>)}</tbody></table></div></details>}
        </> : <p className="note">Noch keine fällige Live-Prognose. Wie das Modell in der Vergangenheit abgeschnitten hätte, zeigt der gespeicherte Rückblick unten.</p>}
        <h3>Wirkungsketten</h3>
        <div className="tbl"><table><thead><tr><th>Kette</th><th className="num">Fälle</th><th className="num">richtig</th><th className="num">Gewicht</th></tr></thead><tbody>{d.mechanismen.map(m => { const j = b.jeMechanismus.find(x => x.id === m.id); return <tr key={m.id}><td><b>{m.name}</b><div className="note">{m.theorie}</div></td><td className="num">{j?.n ?? 0}</td><td className="num">{pz(j?.quote)}</td><td className="num">{zahl(m.gewicht)}{m.aktuell !== m.gewicht ? ` → ${zahl(m.aktuell)}` : ""}</td></tr>; })}</tbody></table></div>
      </section>

      <section className="panel">
        <div className="ph"><h2>Daten</h2><button type="button" className="btn sm" disabled={!!laeuft} onClick={async () => { const r = await aktion({ aktion: "abruf" }, "abruf"); if (r) { const f = Object.values(r as Record<string, string>).filter(v => v.startsWith("Fehler")).length; meldung(f ? `${f} Reihen nicht abrufbar, siehe Tabelle` : "Alle frei verfügbaren Reihen aktualisiert"); } }}>{laeuft === "abruf" ? "Ruft ab …" : "Jetzt abrufen"}</button></div>
        <p className="note">FRED (St. Louis Fed) und EZB-Datenportal werden alle 12 Stunden automatisch geholt{d.fredSchluessel ? " (FRED über API-Schlüssel)" : " (FRED ohne Schlüssel über den öffentlichen CSV-Export)"}. Einkaufsmanager, ifo, DAX, Bauzins und Immobilienpreise bitte hier einfügen; die Lizenz des Anbieters beachten.</p>
        <div className="tbl"><table><thead><tr><th>Reihe</th><th>Quelle</th><th className="num">zuletzt</th><th className="num">Werte</th><th /></tr></thead><tbody>
          {d.indikatoren.map(i => <tr key={i.id}><td><b>{i.name}</b><div className="note">{i.text}</div></td><td>{i.quelle.text}{i.fehler && <div className="note dn">{i.fehler}</div>}</td><td className="num">{i.letzter ? <>{zahl(i.letzter.w)} {i.einheit}<div className="note">{datum(i.letzter.d)}</div></> : "–"}</td><td className="num">{i.anzahl}</td><td><button type="button" className="linkbtn" onClick={() => setImp({ id: i.id, text: "" })}>Einfügen</button></td></tr>)}
          {d.weitere.map(w => <tr key={w.id}><td><b>{w.id}</b></td><td>Import</td><td className="num">{w.letzter ? `${zahl(w.letzter.w)} (${datum(w.letzter.d)})` : "–"}</td><td className="num">{w.anzahl}</td><td><button type="button" className="linkbtn" onClick={async () => { if (await frage({ titel: `Reihe ${w.id} löschen?`, text: "Prognosen dazu bleiben erhalten, werden aber nicht mehr geprüft.", ja: "Löschen", gefahr: true })) aktion({ aktion: "reihe-loeschen", id: w.id }, "x"); }}>Löschen</button></td></tr>)}
        </tbody></table></div>
        <div className="ds-neu">
          <div className="fields">
            <div className="fld"><label htmlFor="kj-id">Reihe</label><input id="kj-id" list="kj-ids" value={imp.id} onChange={e => setImp({ ...imp, id: e.target.value.trim() })} /><datalist id="kj-ids">{d.indikatoren.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</datalist></div>
          </div>
          <div className="fld"><label htmlFor="kj-text">Werte: je Zeile Datum und Wert (Einzelwerte als Reihe kurs:NVDA)</label><textarea id="kj-text" rows={5} value={imp.text} onChange={e => setImp({ ...imp, text: e.target.value })} placeholder={"2026-08-01;49,1\n2026-09-01;48,7\n01.10.2026;50,2"} /></div>
          <div className="row">
            <button type="button" className="btn ghost" disabled={!imp.text.trim() || !!laeuft} onClick={async () => setVorschau(await aktion({ aktion: "import", vorschau: true, ...imp }, "vorschau"))}>Prüfen</button>
            {vorschau && vorschau.anzahl > 0 && <button type="button" className="btn" disabled={!!laeuft} onClick={async () => { const r = await aktion({ aktion: "import", nurGueltige: vorschau.fehlerAnzahl > 0, ...imp }, "import"); if (r) { meldung(`${anz(r.anzahl, "Wert", "Werte")} übernommen${r.abgewiesen ? `, ${r.abgewiesen} abgewiesen` : ""}`); setImp({ ...imp, text: "" }); setVorschau(null); } }}>{vorschau.fehlerAnzahl ? `Nur die ${vorschau.anzahl} gültigen übernehmen` : `${anz(vorschau.anzahl, "Wert", "Werte")} übernehmen`}</button>}
          </div>
          {vorschau && <div className="kj-vorschau">
            <p className="note">{anz(vorschau.anzahl, "gültiger Wert", "gültige Werte")}{vorschau.erste && vorschau.letzte ? ` von ${datum(vorschau.erste.d)} (${zahl(vorschau.erste.w, 4)}) bis ${datum(vorschau.letzte.d)} (${zahl(vorschau.letzte.w, 4)})` : ""}.</p>
            {vorschau.fehlerAnzahl > 0 && <ul className="flags">{vorschau.fehler.map(f => <li key={f.zeile} className="crit">Zeile {f.zeile} „{f.inhalt}“: {f.text}</li>)}{vorschau.fehlerAnzahl > vorschau.fehler.length && <li className="info">… und {vorschau.fehlerAnzahl - vorschau.fehler.length} weitere</li>}</ul>}
          </div>}
          <details><summary>Werte einer Reihe löschen</summary>
            <div className="fields">
              <div className="fld"><label htmlFor="kl-v">von</label><input id="kl-v" type="date" value={loeschen.von} onChange={e => setLoeschen({ ...loeschen, von: e.target.value })} /></div>
              <div className="fld"><label htmlFor="kl-b">bis</label><input id="kl-b" type="date" value={loeschen.bis} onChange={e => setLoeschen({ ...loeschen, bis: e.target.value })} /></div>
            </div>
            <button type="button" className="btn sm danger" disabled={!loeschen.von || !loeschen.bis || !!laeuft} onClick={async () => { if (await frage({ titel: `Werte von ${imp.id} löschen?`, text: `Alle Werte vom ${datum(loeschen.von)} bis ${datum(loeschen.bis)} werden entfernt.`, ja: "Löschen", gefahr: true })) { const r = await aktion({ aktion: "werte-loeschen", id: imp.id, ...loeschen }, "x"); if (r) meldung(`${anz(r.geloescht, "Wert", "Werte")} gelöscht`); } }}>Werte der Reihe „{imp.id}“ löschen</button>
          </details>
        </div>
      </section>

      <div className="two">
        <section className="panel">
          <div className="ph"><h2>Termine</h2><Info label="Termine" text="Zinsentscheide und Inflationsdaten erhöhen die Schwankung: am Tag davor halbiert der Trading-Agent die Positionsgröße. Indexaufnahmen, Lockup-Enden, Börsengänge und Quartalszahlen erzeugen Prognosen für den einzelnen Wert (erzwungene Käufe, zusätzliches Angebot, „Buy the rumor, sell the news“)." /></div>
          {d.ereignisse.length ? <div className="todo">{d.ereignisse.map(e => <div key={e.id}><span><b>{datum(e.datum)}</b> {ART_NAME[e.art]}: {e.titel}{e.symbol ? ` (${e.symbol})` : ""}{e.wichtig ? " · wichtig" : ""}</span><button type="button" className="linkbtn" onClick={async () => { if (await frage({ titel: "Termin entfernen?", text: `${e.titel} am ${datum(e.datum)}`, ja: "Entfernen", gefahr: true }) && await aktion({ aktion: "ereignis-loeschen", id: e.id }, "x")) meldung("Termin entfernt"); }}>Entfernen</button></div>)}</div> : <p className="note">Keine Termine.</p>}
          <div className="fields">
            <div className="fld"><label htmlFor="ev-d">Datum</label><input id="ev-d" type="date" value={ev.datum} onChange={e => setEv({ ...ev, datum: e.target.value })} /></div>
            <div className="fld"><label htmlFor="ev-a">Art</label><select id="ev-a" value={ev.art} onChange={e => setEv({ ...ev, art: e.target.value as Ereignis["art"] })}>{ART.map(a => <option key={a} value={a}>{ART_NAME[a]}</option>)}</select></div>
            <div className="fld"><label htmlFor="ev-t">Titel</label><input id="ev-t" value={ev.titel} onChange={e => setEv({ ...ev, titel: e.target.value })} placeholder="z. B. Fed-Zinsentscheid" /></div>
            <div className="fld"><label htmlFor="ev-s">Wert (optional)</label><input id="ev-s" value={ev.symbol ?? ""} onChange={e => setEv({ ...ev, symbol: e.target.value.toUpperCase() })} placeholder="z. B. NVDA" /></div>
          </div>
          <label className="chk"><input type="checkbox" checked={!!ev.wichtig} onChange={e => setEv({ ...ev, wichtig: e.target.checked })} /> wichtig für den Gesamtmarkt</label>
          <button type="button" className="btn ghost" disabled={!ev.datum || !ev.titel.trim()} onClick={async () => { if (await aktion({ aktion: "ereignis", ereignis: { ...ev, symbol: ev.symbol || undefined } }, "ev")) { meldung(`Termin „${ev.titel}“ angelegt${ev.datum < new Date().toISOString().slice(0, 10) ? ". Das Datum liegt in der Vergangenheit und wirkt nur auf Rückblicke." : ""}`); setEv({ ...ev, titel: "", symbol: "" }); } }}>Termin anlegen</button>
        </section>
        <section className="panel">
          <div className="ph"><h2>Rückblick</h2><Info label="Rückblick" text="Rechnet die Historie Schritt für Schritt durch, jeweils nur mit den Daten, die am Stichtag veröffentlicht waren, und prüft jede Prognose gegen das später Eingetretene. So zeigt sich, ob die Wirkungsketten tragen, bevor man ihnen vertraut." /></div>
          <div className="fields">
            <div className="fld"><label htmlFor="rb-v">von</label><input id="rb-v" type="date" value={rb.von} onChange={e => setRb({ ...rb, von: e.target.value })} /></div>
            <div className="fld"><label htmlFor="rb-b">bis</label><input id="rb-b" type="date" value={rb.bis} onChange={e => setRb({ ...rb, bis: e.target.value })} /></div>
            <div className="fld"><label htmlFor="rb-s">alle … Tage</label><input id="rb-s" type="number" min={7} value={rb.schrittTage} onChange={e => setRb({ ...rb, schrittTage: Number(e.target.value) || 30 })} />{rb.schrittTage < 7 && <span className="note dn">mindestens 7</span>}</div>
          </div>
          <button type="button" className="btn ghost" disabled={!!laeuft} onClick={async () => { const r = await aktion({ aktion: "rueckblick", ...rb }, "rb"); if (r) meldung(`Rückblick gespeichert: ${anz(r.bilanz.n, "Prognose", "Prognosen")} geprüft`); }}>{laeuft === "rb" ? "Rechnet …" : "Rückblick rechnen"}</button>
          {d.rueckblick && <RueckblickKarte r={d.rueckblick} uebernehmen={async () => { if (await aktion({ aktion: "gewichte-uebernehmen" }, "gw")) meldung("Gewichte übernommen; sie gelten für die nächsten Prognosen"); }} laeuft={!!laeuft} />}
        </section>
      </div>
    </>
  );
}

/** Gespeicherter Rückblick mit Kennzahlen, Beispielen und der Möglichkeit, die gelernten Gewichte zu übernehmen */
function RueckblickKarte({ r, uebernehmen, laeuft }: { r: NonNullable<Daten["rueckblick"]>; uebernehmen: () => void; laeuft: boolean }) {
  const b = r.bilanz;
  return (
    <div className="kj-rb">
      <p className="note">Gespeichert am {new Date(r.am).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}: {datum(r.von)} bis {datum(r.bis)}, alle {r.schrittTage} Tage, {r.anzahl} Prognosen.</p>
      <div className="sys">{([["geprüft", String(b.n)], ["Trefferquote", pz(b.trefferquote)], ["Brier", zahl(b.brier, 3)], ["Brier Grundhäufigkeit", zahl(b.brierBasis, 3)], ["Skill", zahl(b.skill, 2)], ["Spanne getroffen", pz(b.bandAbdeckung)]] as const).map(([l, v]) => <div key={l} className={l === "Skill" && (b.skill ?? 0) <= 0 ? "warn" : ""}><span>{l}</span><b>{v}</b></div>)}</div>
      {b.n === 0 && <p className="hint">Keine Prognose ließ sich prüfen: Für den Zeitraum fehlen Daten der Zielreihen (S&P 500, DAX, US 10J, VIX, Immobilienpreise).</p>}
      {r.beispiele.length > 0 && <details><summary>Beispiele aus dem Rückblick</summary><div className="tbl"><table><thead><tr><th>Erstellt</th><th>Ziel</th><th className="num">steigt</th><th className="num">Ausgang → Ergebnis</th><th>Treffer</th></tr></thead><tbody>{r.beispiele.map(p => <tr key={p.id}><td>{datum(p.erstellt)}</td><td>{ZIEL[p.ziel]} {p.horizontTage} T.</td><td className="num">{pz(p.pHoch)}</td><td className="num">{zahl(p.ausgang)} → {zahl(p.ergebnis!.wert)}</td><td>{p.pHoch === 0.5 ? "–" : (p.pHoch > 0.5) === p.ergebnis!.hoch ? "ja" : "nein"}</td></tr>)}</tbody></table></div></details>}
      {b.n >= 20 && <button type="button" className="btn sm ghost" disabled={laeuft} onClick={uebernehmen}>Gelernte Gewichte übernehmen</button>}
    </div>
  );
}

