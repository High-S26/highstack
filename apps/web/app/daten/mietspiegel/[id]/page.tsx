"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/App";
import { Marken, Text, Zahl } from "@/components/Felder";
import { api } from "@/lib/client";
import { abfrage, pruefe, WOHNLAGEN, type Feld, type Klasse, type Merkmal, type MerkmalKey, type Mietspiegel } from "@/lib/mietspiegel";

const MERKMAL_NAMEN: Record<MerkmalKey, string> = { baujahr: "Baujahr", flaeche: "Wohnfläche", lage: "Wohnlage", ausstattung: "Ausstattung" };
const kombis = (dims: Merkmal[]): number[][] => dims.reduce<number[][]>((acc, m) => acc.flatMap(a => m.klassen.map((_, i) => [...a, i])), [[]]);
const zahl = (s: string) => { const t = s.trim().replace(/\./g, "").replace(",", "."); if (!t) return null; const n = Number(t); return Number.isFinite(n) ? n : null; };
const zeig = (v: number | null) => v == null ? "" : v.toLocaleString("de-DE", { maximumFractionDigits: 2 });

/** Ein Wert in der Tabelle: freie Eingabe mit Komma, übernimmt beim Verlassen */
function Zelle({ wert, setze, label }: { wert: number | null; setze: (v: number | null) => void; label: string }) {
  const [roh, setRoh] = useState(zeig(wert)); const fokus = useRef(false);
  useEffect(() => { if (!fokus.current) setRoh(zeig(wert)); }, [wert]);
  return <input className="ms-zelle" inputMode="decimal" aria-label={label} value={roh} onFocus={e => { fokus.current = true; e.target.select(); }} onChange={e => setRoh(e.target.value)} onBlur={() => { fokus.current = false; const n = zahl(roh); setze(n); setRoh(zeig(n)); }} />;
}

export default function MietspiegelSeite({ params }: { params: { id: string } }) {
  const { frage, meldung } = useApp(); const router = useRouter();
  const [m, setM] = useState<Mietspiegel | null>(null); const [darf, setDarf] = useState(false); const [stand, setStand] = useState("");
  const [tab, setTab] = useState(0); const [test, setTest] = useState<{ baujahr: number | null; flaeche: number | null; lage: string }>({ baujahr: 1998, flaeche: 70, lage: "" });
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => { Promise.all([api.mietspiegel(params.id), api.mietspiegelListe()]).then(([x, l]) => { setM(x); setDarf(l.darfPflegen); }).catch(e => meldung((e as Error).message)); }, [params.id, meldung]);
  const aendere = (p: Partial<Mietspiegel>) => {
    if (!m || !darf) return; const neu = { ...m, ...p }; setM(neu); setStand("Ungespeichert …"); clearTimeout(timer.current);
    timer.current = setTimeout(async () => { try { const r = await api.speichereMietspiegel(neu); setM(x => x && { ...x, status: r.status, geprueftVon: r.geprueftVon }); setStand("Gespeichert"); } catch (e) { setStand((e as Error).message); } }, 700);
  };
  const ri = m ? Math.max(0, m.merkmale.findIndex(x => x.key === "baujahr")) : 0;
  const ci = m ? (() => { const i = m.merkmale.findIndex((x, n) => x.key === "flaeche" && n !== ri); return i >= 0 ? i : m.merkmale.findIndex((_, n) => n !== ri); })() : -1;
  const tabDims = m ? m.merkmale.map((x, i) => ({ x, i })).filter(d => d.i !== ri && d.i !== ci) : [];
  const tabs = useMemo(() => kombis(tabDims.map(d => d.x)), [JSON.stringify(tabDims.map(d => d.x.klassen.length))]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!m) return <p className="note">Lädt …</p>;

  const schluessel = (r: number, c: number, t: number[]) => { const k = new Array(m.merkmale.length).fill(0); k[ri] = r; if (ci >= 0) k[ci] = c; tabDims.forEach((d, n) => { k[d.i] = t[n]!; }); return k as number[]; };
  const feld = (k: number[]) => m.felder.find(f => f.k.length === k.length && f.k.every((v, i) => v === k[i]));
  const setzeFeld = (k: number[], p: Partial<Feld>) => { const da = feld(k); const neu = { ...(da ?? { k, von: null, mittel: null, bis: null }), ...p }; const leer = neu.von == null && neu.mittel == null && neu.bis == null; aendere({ felder: [...m.felder.filter(f => f !== da), ...(leer ? [] : [neu])] }); };
  // Merkmale bearbeiten: Klassen ändern verschiebt Indizes, daher Felder mit ungültigen Indizes entfernen
  const setzeMerkmal = (i: number, mk: Merkmal) => { const merkmale = m.merkmale.map((x, n) => n === i ? mk : x); aendere({ merkmale, felder: m.felder.filter(f => f.k[i]! < mk.klassen.length) }); };
  const neuesMerkmal = (key: MerkmalKey) => aendere({ merkmale: [...m.merkmale, { key, label: MERKMAL_NAMEN[key], klassen: key === "lage" || key === "ausstattung" ? WOHNLAGEN.slice(0, 3).map(([v]) => ({ label: v, wert: v })) : [{ label: "Klasse 1" }] }], felder: m.felder.map(f => ({ ...f, k: [...f.k, 0] })) });
  const entferneMerkmal = async (i: number) => { if (!await frage({ titel: `${m.merkmale[i]!.label} entfernen?`, text: "Werte, die nicht zur ersten Klasse gehören, werden gelöscht.", ja: "Entfernen", gefahr: true })) return; aendere({ merkmale: m.merkmale.filter((_, n) => n !== i), felder: m.felder.filter(f => f.k[i] === 0).map(f => ({ ...f, k: f.k.filter((_, n) => n !== i) })) }); setTab(0); };
  const fehler = pruefe(m); const ergebnis = abfrage(m, { baujahr: test.baujahr, flaeche: test.flaeche, lage: test.lage || null });
  const zeilen = m.merkmale[ri]?.klassen ?? []; const spalten = ci >= 0 ? m.merkmale[ci]!.klassen : [{ label: "Wert" }];
  const freigeben = async () => { clearTimeout(timer.current); try { const r = await api.speichereMietspiegel({ ...m, status: "geprueft" }); setM(r); meldung(`Mietspiegel ${m.stadt} freigegeben`); } catch (e) { meldung((e as Error).message); } };
  const loeschen = async () => { if (!await frage({ titel: `Mietspiegel ${m.stadt} löschen?`, text: "Die erfasste Tabelle wird gelöscht. Objekte behalten bereits übernommene Werte.", ja: "Löschen", gefahr: true })) return; await api.loescheMietspiegel(m.id); router.push("/daten"); };

  return (
    <div className="view">
      <div className="objbar"><Link className="btn ghost sm" href="/daten">← Datenbasis</Link><h1>Mietspiegel {m.stadt}</h1>
        <span className={`badge ${m.status === "geprueft" ? "b-on" : "b-warn"}`}>{m.status === "geprueft" ? `geprüft${m.geprueftVon ? ` von ${m.geprueftVon}` : ""}` : "Entwurf"}</span>{m.herkunft === "ki" && <span className="tag">von der KI ausgelesen</span>}
        <span className="note">{stand}</span>{darf && <button type="button" className="btn sm danger" onClick={loeschen}>Löschen</button>}</div>
      {!darf && <p className="note">Nur lesen: Pflegen dürfen Datenverantwortliche.</p>}
      <fieldset className="ms-grid" disabled={!darf}>
        <section className="panel">
          <h2>Quelle und Gültigkeit</h2>
          <div className="fields">
            <Text label="Stadt" wert={m.stadt} onChange={v => aendere({ stadt: v })} />
            <div className="fld"><span className="flabel">Art</span><div className="chips">{(["qualifiziert", "einfach", "unbekannt"] as const).map(a => <button key={a} type="button" className="chip" aria-pressed={m.art === a} onClick={() => aendere({ art: a })}>{a}</button>)}</div></div>
            <div className="fld"><label htmlFor="ms-ab">gültig ab</label><input id="ms-ab" type="date" value={m.gueltigAb ?? ""} onChange={e => aendere({ gueltigAb: e.target.value || null })} /></div>
            <div className="fld"><label htmlFor="ms-bis">gültig bis</label><input id="ms-bis" type="date" value={m.gueltigBis ?? ""} onChange={e => aendere({ gueltigBis: e.target.value || null })} /></div>
            <Text label="Quelle (Name)" wert={m.quelleName} onChange={v => aendere({ quelleName: v })} platzhalter="z. B. Mietspiegel 2025, Amt für Wohnungswesen" />
            <Text label="Quelle (Link)" wert={m.quelleUrl} onChange={v => aendere({ quelleUrl: v })} platzhalter="https://…" />
            <Marken voll label="Weitere Ortsnamen" hinweis="Stadtteile oder Schreibweisen, unter denen Objekte dieser Stadt erscheinen" werte={m.aliase ?? []} onChange={v => aendere({ aliase: v })} />
            <div className="fld full"><label htmlFor="ms-h">Hinweise</label><textarea id="ms-h" value={m.hinweise ?? ""} onChange={e => aendere({ hinweise: e.target.value })} placeholder="Besonderheiten, Zu- und Abschläge, Punktemodell …" /></div>
          </div>
        </section>
        <section className="panel">
          <h2>Merkmale</h2>
          <p className="note">So ist die Tabelle aufgebaut. Grenzen: Baujahr von–bis, Fläche bis einschließlich.</p>
          {m.merkmale.map((mk, i) => (
            <div key={mk.key} className="ms-merkmal">
              <div className="ph"><b>{mk.label}</b>{m.merkmale.length > 1 && <button type="button" className="linkbtn" onClick={() => entferneMerkmal(i)}>entfernen</button>}</div>
              <div className="ms-klassen">{mk.klassen.map((k, j) => (
                <div key={j} className="ms-klasse">
                  <input aria-label={`${mk.label} Klasse ${j + 1}`} value={k.label} onChange={e => setzeMerkmal(i, { ...mk, klassen: mk.klassen.map((x, n) => n === j ? { ...x, label: e.target.value, ...(x.wert != null ? { wert: e.target.value.toLowerCase() } : {}) } : x) })} />
                  {(mk.key === "baujahr" || mk.key === "flaeche") && <><input aria-label="von" placeholder="von" inputMode="decimal" value={k.von ?? ""} onChange={e => setzeMerkmal(i, { ...mk, klassen: mk.klassen.map((x, n) => n === j ? { ...x, von: zahl(e.target.value) } : x) })} /><input aria-label="bis" placeholder="bis" inputMode="decimal" value={k.bis ?? ""} onChange={e => setzeMerkmal(i, { ...mk, klassen: mk.klassen.map((x, n) => n === j ? { ...x, bis: zahl(e.target.value) } : x) })} /></>}
                  <button type="button" className="icon" aria-label="Klasse entfernen" onClick={() => setzeMerkmal(i, { ...mk, klassen: mk.klassen.filter((_, n) => n !== j) })}>×</button>
                </div>))}
                <button type="button" className="btn ghost sm" onClick={() => setzeMerkmal(i, { ...mk, klassen: [...mk.klassen, { label: `Klasse ${mk.klassen.length + 1}`, ...(mk.key === "lage" || mk.key === "ausstattung" ? { wert: "" } : {}) } as Klasse] })}>+ Klasse</button>
              </div>
            </div>))}
          <div className="chips">{(Object.keys(MERKMAL_NAMEN) as MerkmalKey[]).filter(k => !m.merkmale.some(x => x.key === k)).map(k => <button key={k} type="button" className="chip" onClick={() => neuesMerkmal(k)}>+ {MERKMAL_NAMEN[k]}</button>)}</div>
        </section>
      </fieldset>
      <section className="panel">
        <div className="ph"><h2>Tabelle</h2><span className="tag">€/m² Nettokaltmiete · von / Mittel / bis</span></div>
        {tabs.length > 1 && <div className="chips" role="tablist">{tabs.map((t, n) => <button key={n} type="button" role="tab" className="chip" aria-pressed={tab === n} aria-selected={tab === n} onClick={() => setTab(n)}>{t.map((c, d) => `${tabDims[d]!.x.label} ${tabDims[d]!.x.klassen[c]?.label}`).join(" · ")}</button>)}</div>}
        <fieldset className="ms-tab" disabled={!darf}><div className="tbl"><table><thead><tr><th>{m.merkmale[ri]?.label} ↓ {ci >= 0 ? `· ${m.merkmale[ci]!.label} →` : ""}</th>{spalten.map((s, c) => <th key={c}>{s.label}</th>)}</tr></thead>
          <tbody>{zeilen.map((z, r) => <tr key={r}><th>{z.label}</th>{spalten.map((s, c) => { const k = schluessel(r, c, tabs[tab] ?? []); const f = feld(k); return <td key={c}><div className="ms-dreier">
            <Zelle label={`${z.label} ${s.label} von`} wert={f?.von ?? null} setze={v => setzeFeld(k, { von: v })} /><Zelle label={`${z.label} ${s.label} Mittel`} wert={f?.mittel ?? null} setze={v => setzeFeld(k, { mittel: v })} /><Zelle label={`${z.label} ${s.label} bis`} wert={f?.bis ?? null} setze={v => setzeFeld(k, { bis: v })} />
          </div></td>; })}</tr>)}</tbody></table></div></fieldset>
      </section>
      <div className="two">
        <section className="panel">
          <h2>Probe</h2>
          <div className="fields">
            <Zahl label="Baujahr" wert={test.baujahr} onChange={v => setTest(t => ({ ...t, baujahr: v }))} />
            <Zahl label="Wohnfläche" einheit="m²" wert={test.flaeche} onChange={v => setTest(t => ({ ...t, flaeche: v }))} />
            <div className="fld full"><span className="flabel">Wohnlage</span><div className="chips"><button type="button" className="chip" aria-pressed={!test.lage} onClick={() => setTest(t => ({ ...t, lage: "" }))}>unbekannt</button>{(m.merkmale.find(x => x.key === "lage")?.klassen ?? []).map(k => <button key={k.label} type="button" className="chip" aria-pressed={test.lage === (k.wert ?? k.label)} onClick={() => setTest(t => ({ ...t, lage: k.wert ?? k.label }))}>{k.label}</button>)}</div></div>
          </div>
          {ergebnis ? <p className="ms-ergebnis"><b>{zeig(ergebnis.mittel)} €/m²</b> <span className="note">Spanne {zeig(ergebnis.von)} bis {zeig(ergebnis.bis)} € · {ergebnis.beschreibung || "alle Felder"}{ergebnis.offen.length ? ` · offen: ${ergebnis.offen.join(", ")}` : ""}</span></p> : <p className="note">Kein passendes Feld mit Werten.</p>}
        </section>
        <section className="panel">
          <h2>Prüfung und Freigabe</h2>
          {fehler.length ? <ul className="flags">{fehler.map(f => <li key={f} className={f.startsWith("Nur ") ? "" : "crit"}>{f}</li>)}</ul> : <p className="note">Keine Auffälligkeiten. Vergleichen Sie vor der Freigabe einige Felder mit dem Original.</p>}
          {darf && (m.status === "geprueft" ? <button type="button" className="btn ghost" onClick={() => aendere({ status: "entwurf" })}>Zurück auf Entwurf</button>
            : <button type="button" className="btn" disabled={fehler.some(f => !f.startsWith("Nur "))} onClick={freigeben}>Als geprüft freigeben</button>)}
          <p className="note">Entwürfe nutzt „Ermitteln“ mit Hinweis; geprüfte Mietspiegel ohne.</p>
        </section>
      </div>
    </div>
  );
}
