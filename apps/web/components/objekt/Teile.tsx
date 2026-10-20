"use client";
import { MODULE, standardSzenario, standardwerte, VORLAGEN, type Analyse, type ParamDef, type Simulation, type Szenario } from "@highstack/engine";
import { useState } from "react";
import { EINSTUFUNG, eur, kennzahl, num, pct, STRUKTUR, teur, vorzeichen } from "@/lib/format";
import type { Objektdatensatz } from "@/lib/typen";
import { Auswahl, Haken, Kacheln, Text, Zahl } from "../Felder";
import { expertMeta } from "../Experten";

type Setze = (patch: Partial<Objektdatensatz>) => void;

export function Daten({ o, a, setze }: { o: Objektdatensatz; a: Analyse; setze: Setze }) {
  const ob = o.objekt; const set = (p: Partial<typeof ob>) => setze({ objekt: { ...ob, ...p } });
  const pruef: [unknown, string, string][] = [[ob.kaufpreis, "Kaufpreis", ""], [ob.wohnflaeche, "Wohnfläche", ""], [a.bewertung.miete, "Miete", "Ist-Miete oder Marktmiete"], [ob.hausgeldNichtUmlagefaehig, "Nicht umlagefähige Kosten", "WEG-Abrechnung"], [ob.vergleichspreisQm, "Vergleichspreis", "z. B. Capital-Immobilienkompass"], [ob.marktmieteQm, "Marktmiete", "Mietspiegel"], [ob.energieklasse, "Energieklasse", "Energieausweis"], [ob.baujahr, "Baujahr", "Exposé"]];
  const vorhanden = pruef.filter(x => x[0] != null && x[0] !== "").length; const q = vorhanden / pruef.length;
  return (
    <section className="panel">
      <div className="ph"><h2>Objektdaten</h2></div>
      <details open={!ob.kaufpreis}><summary>Exposé-Text (für die Experten)</summary><textarea value={o.expose} onChange={e => setze({ expose: e.target.value })} placeholder="Text aus Exposé, Inserat oder Newsletter …" aria-label="Exposé-Text" /></details>
      <div className="grp">Das Wichtigste</div>
      <div className="fields">
        <Text voll label="Titel" wert={ob.titel} onChange={v => set({ titel: v })} />
        <Text label="Ort / Stadtteil" wert={ob.ort} onChange={v => set({ ort: v })} />
        <Auswahl label="Assetklasse" wert={ob.asset} optionen={[["ETW", "ETW"], ["MFH", "MFH"], ["EFH/ZFH", "EFH/ZFH"], ["Gewerbe", "Gewerbe"]]} onChange={v => set({ asset: v })} />
        <Zahl label="Kaufpreis" einheit="€" wert={ob.kaufpreis} onChange={v => set({ kaufpreis: v })} schritt={1000} />
        <Zahl label={ob.asset === "Gewerbe" ? "Nutzfläche" : "Wohnfläche"} einheit="m²" wert={ob.wohnflaeche} onChange={v => set({ wohnflaeche: v })} />
        <Auswahl label="Vermietung" wert={ob.leer ? "l" : "v"} optionen={[["v", "vermietet"], ["l", "leer / bezugsfrei"]]} onChange={v => set({ leer: v === "l" })} />
        {!ob.leer && <Zahl label="Ist-Kaltmiete" einheit="€/Monat" wert={ob.miete} onChange={v => set({ miete: v })} schritt={10} />}
        <Zahl voll label={ob.asset === "ETW" ? "Hausgeld, nicht umlagefähig inkl. Rücklage" : "Nicht umlagefähige Kosten"} einheit="€/Monat" wert={ob.hausgeldNichtUmlagefaehig} onChange={v => set({ hausgeldNichtUmlagefaehig: v })} schritt={5} />
      </div>
      <div className="meter"><div className="ph"><span className="note">Datenqualität</span><span className="note">{Math.round(q * 100)} %</span></div><div className="track"><div className="fill" style={{ width: `${q * 100}%`, background: q >= 0.85 ? "var(--good)" : q >= 0.5 ? "var(--warn)" : "var(--crit)" }} /></div>
        <ul className="missing">{pruef.filter(x => x[0] == null || x[0] === "").slice(0, 4).map(([, l, h]) => <li key={l}><b>{l}</b>{h && ` · ${h}`}</li>)}</ul></div>
      <details><summary>Genauer werden: Markt, Substanz, Steuern</summary>
        <div className="fields">
          <Zahl label="Marktmiete laut Mietspiegel" einheit="€/m²" wert={ob.marktmieteQm} onChange={v => set({ marktmieteQm: v })} schritt={0.1} />
          <Zahl label="Vergleichspreis Kauf" einheit="€/m²" wert={ob.vergleichspreisQm} onChange={v => set({ vergleichspreisQm: v })} schritt={50} />
          <Zahl label="Baujahr" wert={ob.baujahr} onChange={v => set({ baujahr: v })} schritt={1} />
          <Auswahl label="Energieklasse" wert={ob.energieklasse ?? ""} optionen={[["", "unbekannt"], ...["A+", "A", "B", "C", "D", "E", "F", "G", "H"].map(x => [x, x] as [string, string])]} onChange={v => set({ energieklasse: v || null })} />
          {ob.asset === "ETW" && <Zahl label="Rücklage, Ihr Anteil" einheit="€" wert={ob.ruecklageAnteil} onChange={v => set({ ruecklageAnteil: v })} schritt={500} />}
          <Zahl label="Bodenrichtwert (BORIS)" einheit="€/m²" wert={ob.bodenrichtwert} onChange={v => set({ bodenrichtwert: v })} schritt={10} />
          <Zahl voll label="Gebäudeanteil am Kaufpreis" prozent hinweis="für die Abschreibung" wert={ob.gebaeudeanteil} onChange={v => set({ gebaeudeanteil: v ?? 0.75 })} />
          <Haken label="Erbbaurecht" wert={ob.erbbaurecht} onChange={v => set({ erbbaurecht: v })} />
          <Haken label="Sonderumlage offen oder beschlossen" wert={ob.sonderumlage} onChange={v => set({ sonderumlage: v })} />
        </div>
      </details>
    </section>
  );
}

export function Ergebnisbereich({ a, apName }: { a: Analyse; apName: string }) {
  const b = a.bewertung; const k = b.kennzahlen; const p = a.params; const ap = p.anlageprofil;
  const reihenfolge = { crit: 0, warn: 1, good: 2, info: 3 } as const;
  const h = [...b.hinweise].sort((x, y) => reihenfolge[x.art] - reihenfolge[y.art]);
  const st = (ok: boolean | null, warn: boolean) => ok == null ? "na" : ok ? "good" : warn ? "warn" : "crit";
  const zeilen: [string, string, string, string][] = [
    ["Bruttorendite", pct(k.bruttorendite, 2), `≥ ${pct(ap.minBruttorendite)}`, st(k.bruttorendite == null ? null : k.bruttorendite >= ap.minBruttorendite, (k.bruttorendite ?? 0) >= ap.minBruttorendite * 0.85)],
    ["Kaufpreisfaktor", num(k.faktor, 1), ap.maxFaktor ? `≤ ${num(ap.maxFaktor, 1)}` : "–", st(k.faktor == null || !ap.maxFaktor ? null : k.faktor <= ap.maxFaktor, (k.faktor ?? 0) <= (ap.maxFaktor ?? 0) * 1.1)],
    ["Nettomietrendite", pct(k.nettomietrendite, 2), "auf Gesamtinvest", st(k.nettomietrendite == null ? null : k.nettomietrendite >= p.sollzins, false)],
    ["Cashflow / Monat", eur(k.cashflowMonat), `≥ ${eur(ap.minCashflow)}`, st(k.cashflowMonat == null ? null : k.cashflowMonat >= ap.minCashflow, (k.cashflowMonat ?? 0) >= ap.minCashflow - 100)],
    ["DSCR", num(k.dscr), `≥ ${num(p.minDscr)}`, st(k.dscr == null ? null : k.dscr >= p.minDscr, (k.dscr ?? 0) >= p.minDscr * 0.9)],
    ["Beleihungsauslauf", pct(k.beleihungsauslauf, 0), `≤ ${pct(p.maxBeleihungsauslauf, 0)}`, st(k.beleihungsauslauf == null ? null : k.beleihungsauslauf <= p.maxBeleihungsauslauf, false)],
    ["Preis vs. Markt", k.preisVsMarkt == null ? "–" : vorzeichen(k.preisVsMarkt, x => pct(x, 0)), "Vergleichspreis", st(k.preisVsMarkt == null ? null : k.preisVsMarkt <= 0.05, (k.preisVsMarkt ?? 1) <= 0.15)],
    ["Mietpotenzial", k.mietpotenzial == null ? "–" : vorzeichen(k.mietpotenzial, x => pct(x, 0)), "vs. Mietspiegel", st(k.mietpotenzial == null ? null : k.mietpotenzial >= 0, false)],
  ];
  return (
    <>
      <section className="panel">
        <div className="ph"><h2>Ergebnis zum Angebotspreis</h2><span className="tag">Anlageprofil: {apName}</span></div>
        <div className="verdict"><div className="score">{b.score == null ? "–" : Math.round(b.score)}<small>/100</small></div>
          <div style={{ display: "grid", gap: 6 }}><div><span className={`pill ${b.einstufung ? "p-" + b.einstufung : ""}`}>{b.einstufung ? EINSTUFUNG[b.einstufung] : "Daten fehlen"}</span></div>
            <div className="note">{b.ko.length ? "Durch ein K.O.-Kriterium ausgeschlossen." : b.einstufung === "opp" ? "Passt zum Anlageprofil. Nächste Schritte: Unterlagen und Experten." : b.einstufung === "watch" ? "Passt teilweise. Durchspielen und Gestaltung zeigen, was sich ändern müsste." : b.einstufung === "pass" ? "Passt zum Angebotspreis nicht. Durchspielen und Gestaltung zeigen, unter welchen Bedingungen doch." : "Bitte Kaufpreis, Fläche und Miete eintragen."}</div></div></div>
        <div className="lbl">Die wichtigsten Gründe</div>
        <ul className="flags">{h.slice(0, 3).map(x => <li key={x.text} className={x.art === "warn" ? "" : x.art}>{x.text}</li>)}</ul>
        {h.length > 3 && <details><summary>{h.length - 3} weitere Hinweise</summary><ul className="flags">{h.slice(3).map(x => <li key={x.text} className={x.art === "warn" ? "" : x.art}>{x.text}</li>)}</ul></details>}
      </section>
      <section className="panel"><h2>Budget &amp; Finanzierung</h2><Kacheln eintraege={[["Kaufpreis bis", eur(k.kpMax)], ["Nebenkosten", `${eur(k.nebenkosten)} · ${pct(k.nebenkostenSatz)}`], ["Gesamtinvestition", eur(k.gesamtinvestition)], ["Darlehen", eur(k.darlehen)], ["Rate / Monat", eur(k.rateMonat)], ["Finanzierungslücke", (k.finanzierungsluecke ?? 0) > 0 ? eur(k.finanzierungsluecke) : "keine"]]} /></section>
      <section className="panel"><details><summary>Alle Kennzahlen</summary>
        <div className="tbl"><table><thead><tr><th>Kennzahl</th><th className="num">Wert</th><th>Schwelle</th></tr></thead><tbody>{zeilen.map(([l, v, s, c]) => <tr key={l}><td><span className={`dot d-${c}`} />{l}</td><td className="num">{v}</td><td className="note">{s}</td></tr>)}</tbody></table></div>
      </details></section>
    </>
  );
}

const REGLER: { key: keyof Szenario; label: string; min: number; max: number; schritt: number; fmt: (v: number, a: Analyse) => string; prozent?: boolean; relativ?: boolean }[] = [
  { key: "kaufpreisAenderung", label: "Kaufpreis nach Verhandlung", min: -0.25, max: 0.1, schritt: 0.01, fmt: (v, a) => `${eur((a.simulation?.kaufpreis ?? 0))} (${vorzeichen(v, x => pct(x, 0))})` },
  { key: "eigenkapital", label: "Eigenkapital-Einsatz", min: 0, max: 1, schritt: 0.01, relativ: true, fmt: v => eur(v) },
  { key: "sollzins", label: "Sollzins", min: 0.01, max: 0.07, schritt: 0.0005, fmt: v => pct(v, 2) },
  { key: "tilgung", label: "Anfangstilgung", min: 0.005, max: 0.05, schritt: 0.001, fmt: v => pct(v, 1) },
  { key: "anschlusszinsAufschlag", label: "Anschlusszins nach Zinsbindung", min: -0.01, max: 0.04, schritt: 0.0025, fmt: v => `${vorzeichen(v, x => num(x * 100, 2))} %-Pkt.` },
  { key: "mietFaktor", label: "Miete gegenüber heute", min: 0.8, max: 1.4, schritt: 0.01, fmt: v => vorzeichen(v - 1, x => pct(x, 0)) },
  { key: "mietsteigerung", label: "Mietsteigerung p. a.", min: 0, max: 0.05, schritt: 0.0025, fmt: v => pct(v, 2) },
  { key: "kostensteigerung", label: "Kostensteigerung p. a.", min: 0, max: 0.05, schritt: 0.0025, fmt: v => pct(v, 2) },
  { key: "leerstandZusatz", label: "Leerstand zusätzlich", min: 0, max: 0.15, schritt: 0.005, fmt: v => pct(v, 1) },
  { key: "wertentwicklung", label: "Wertentwicklung p. a.", min: -0.02, max: 0.05, schritt: 0.0025, fmt: v => vorzeichen(v, x => pct(x, 2)) },
  { key: "haltedauer", label: "Haltedauer", min: 3, max: 30, schritt: 1, fmt: v => `${v} Jahre` },
];

function Verlauf({ a }: { a: Analyse }) {
  const reihen = [["konservativ", a.vorlagen.konservativ, "var(--s-k)", 1.25], ["optimistisch", a.vorlagen.optimistisch, "var(--s-o)", 1.25], ["ihre", a.simulation, "var(--accent)", 2.5]].filter(r => r[1]) as [string, Simulation, string, number][];
  if (!reihen.length) return null;
  const H = a.szenario.haltedauer, W = 400, Hh = 210, L = 48, R = 56, T = 14, B = 26;
  const pts = (s: Simulation) => [{ t: 0, v: s.nettovermoegenStart }, ...s.jahre.map(j => ({ t: j.jahr, v: j.nettovermoegen }))];
  const alle = reihen.flatMap(r => pts(r[1]).map(x => x.v));
  const schritt = (() => { const raw = (Math.max(...alle) - Math.min(0, ...alle)) / 4 || 1000; const q = Math.pow(10, Math.floor(Math.log10(raw))); const f = raw / q; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * q; })();
  const lo = Math.floor(Math.min(0, ...alle) / schritt) * schritt, hi = Math.ceil(Math.max(...alle) / schritt) * schritt;
  const X = (t: number) => L + (t / H) * (W - L - R), Y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (Hh - T - B);
  const ticks: number[] = []; for (let v = lo; v <= hi + 1e-6; v += schritt) ticks.push(v);
  const xt = H <= 10 ? 2 : H <= 20 ? 5 : 10; const xs: number[] = []; for (let t = 0; t <= H; t += xt) xs.push(t);
  const enden = reihen.map(([k, s, c]) => ({ k, c, v: s.nettovermoegenEnde, y: Y(s.nettovermoegenEnde) })).sort((x, y) => x.y - y.y);
  for (let i = 1; i < enden.length; i++) if (enden[i]!.y - enden[i - 1]!.y < 12) enden[i]!.y = enden[i - 1]!.y + 12;
  const zb = a.params.zinsbindung;
  return (
    <div className="chart"><svg viewBox={`0 0 ${W} ${Hh}`} role="img" aria-label="Nettovermögen über die Haltedauer">
      {ticks.map(v => <g key={v}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke={Math.abs(v) < 1e-6 ? "var(--muted)" : "var(--line)"} /><text x={L - 6} y={Y(v) + 3.5} textAnchor="end" fontSize="10" fill="var(--muted)" fontFamily="var(--f-mono)">{teur(v)}</text></g>)}
      {xs.map(t => <text key={t} x={X(t)} y={Hh - 8} textAnchor="middle" fontSize="10" fill="var(--muted)" fontFamily="var(--f-mono)">{t === 0 ? "Kauf" : `J${t}`}</text>)}
      {zb < H && <><line x1={X(zb)} x2={X(zb)} y1={T} y2={Hh - B} stroke="var(--muted)" strokeDasharray="3 3" /><text x={X(zb) + 4} y={T + 9} fontSize="9.5" fill="var(--muted)">Ende Zinsbindung</text></>}
      {reihen.map(([k, s, c, w]) => <polyline key={k} points={pts(s).map(x => `${X(x.t).toFixed(1)},${Y(x.v).toFixed(1)}`).join(" ")} fill="none" stroke={c} strokeWidth={w} strokeLinejoin="round" />)}
      {enden.map(e => <text key={e.k} x={W - R + 6} y={e.y + 3.5} fontSize="10" fill={e.c} fontFamily="var(--f-mono)">{teur(e.v)}</text>)}
    </svg></div>
  );
}

export function Durchspielen({ o, a, setze }: { o: Objektdatensatz; a: Analyse; setze: Setze }) {
  const s = a.szenario; const p = a.params; const m = a.simulation;
  const [metrik, setMetrik] = useState<"cf" | "irr" | "nv">("cf");
  const setzeWert = (k: keyof Szenario, v: number) => setze({ szenario: { ...o.szenario, [k]: v } });
  const vorlage = (n: keyof typeof VORLAGEN) => setze({ szenario: { ...o.szenario, ...VORLAGEN[n] } });
  const angebot = m ? (() => { const st = standardSzenario(p); return { ...st }; })() : null; void angebot;
  const get = (x: Simulation | null) => !x ? null : metrik === "cf" ? x.cashflowJahr1Monat : metrik === "irr" ? x.irr : x.nettovermoegenEnde;
  const fmt = (v: number | null) => v == null ? "–" : metrik === "irr" ? pct(v) : metrik === "cf" ? eur(v) : teur(v);
  const basis = get(m);
  const tor = a.sensitivitaet.map(x => ({ label: x.label, sa: get(x.schlechter), sb: get(x.besser) })).map(x => ({ ...x, spanne: Math.max(Math.abs((x.sa ?? basis ?? 0) - (basis ?? 0)), Math.abs((x.sb ?? basis ?? 0) - (basis ?? 0))) })).sort((x, y) => y.spanne - x.spanne);
  const maxD = Math.max(...tor.map(x => x.spanne), 1e-9);
  const netM = m ? m.miete0 * (1 - m.ausfall) - m.hausgeld : 0;
  return (
    <>
      <section className="panel">
        <div className="ph"><h2>Durchspielen</h2><button className="btn ghost sm" type="button" onClick={() => setze({ szenario: {} })}>Zurücksetzen</button></div>
        <div className="chips">{(Object.keys(VORLAGEN) as (keyof typeof VORLAGEN)[]).map(n => <button key={n} type="button" className="chip" onClick={() => vorlage(n)}>{n[0]!.toUpperCase() + n.slice(1)}</button>)}</div>
        <div className="simgrid">
          <div className="sliders">{REGLER.map(r => { const v = r.relativ ? (s.eigenkapital / Math.max(1, p.eigenkapital)) : (s[r.key] as number); return (
            <div key={r.key} className="sl"><span>{r.label}</span><output>{r.fmt(r.relativ ? s.eigenkapital : v, a)}</output>
              <input type="range" min={r.min} max={r.max} step={r.schritt} value={v} aria-label={r.label} onChange={e => { const x = Number(e.target.value); setzeWert(r.key, r.relativ ? x * p.eigenkapital : x); }} />
              {r.key === "mietFaktor" && m && <span className="hint">{eur(m.miete0)} pro Monat{o.objekt.marktmieteQm && o.objekt.wohnflaeche ? ` · Mietspiegel ${eur(o.objekt.marktmieteQm * o.objekt.wohnflaeche)}` : ""}</span>}
            </div>); })}</div>
          <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
            {m ? <div className="res">{([["Cashflow Jahr 1 / Monat", eur(m.cashflowJahr1Monat)], ["Ø Cashflow / Monat", eur(m.cashflowSchnittMonat)], ["Zuzahlung gesamt", m.cashflowSumme < 0 ? eur(-m.cashflowSumme) : "keine"], ["Nettovermögen am Ende", teur(m.nettovermoegenEnde)], ["Eigenkapitalrendite vor Steuern", pct(m.irr)], ["DSCR Jahr 1", num(m.dscrJahr1)]] as const).map(([l, v]) => <div key={l}><span>{l}</span><strong>{v}</strong></div>)}</div> : <div className="empty">Für das Durchspielen fehlen Kaufpreis oder Miete.</div>}
            <Verlauf a={a} />
            <div className="legend"><span><i style={{ background: "var(--accent)" }} />Ihre Einstellung</span><span><i style={{ background: "var(--s-k)" }} />Konservativ</span><span><i style={{ background: "var(--s-o)" }} />Optimistisch</span></div>
          </div>
        </div>
        {m && <details><summary>Forecast Jahr für Jahr</summary><div className="tbl"><table><thead><tr>{["Jahr", "Miete", "Kosten", "Zins", "Tilgung", "Cashflow", "Restschuld", "Wert", "Nettovermögen"].map(h => <th key={h} className="num">{h}</th>)}</tr></thead><tbody>{m.jahre.map(j => <tr key={j.jahr}>{[j.jahr, eur(j.miete), eur(j.kosten), eur(j.zins), eur(j.tilgung), eur(j.cashflow), eur(j.restschuld), eur(j.wert), eur(j.nettovermoegen)].map((v, i) => <td key={i} className={`num${i === 5 && j.cashflow < 0 ? " neg" : ""}`}>{v}</td>)}</tr>)}</tbody></table></div></details>}
      </section>
      {m && <section className="panel">
        <div className="ph"><h2>Was bewegt das Ergebnis am stärksten?</h2><label style={{ gridAutoFlow: "column", alignItems: "center", gap: 8 }}>Messgröße<select style={{ width: "auto" }} value={metrik} onChange={e => setMetrik(e.target.value as typeof metrik)}><option value="cf">Cashflow Jahr 1</option><option value="irr">Eigenkapitalrendite</option><option value="nv">Nettovermögen am Ende</option></select></label></div>
        <p className="note">Ihre Einstellung: {fmt(basis)}. Jeweils ein Faktor wird verändert; rot schlechter, grün besser.</p>
        <div className="tornado">{tor.map(t => <div key={t.label} className="tr"><div>{t.label}</div><div><div className="tt"><div className="mid" />{[t.sa, t.sb].map((v, i) => v == null || basis == null || Math.abs(v - basis) < 1e-9 ? null : <div key={i} className={`seg ${v < basis ? "lo" : "hi"}`} style={{ left: `${50 + Math.min(0, (v - basis) / maxD * 48)}%`, width: `${Math.abs((v - basis) / maxD * 48)}%` }} />)}</div><div className="tv"><span>{fmt(Math.min(...[t.sa, t.sb, basis].filter((x): x is number => x != null)))}</span><span>{fmt(Math.max(...[t.sa, t.sb, basis].filter((x): x is number => x != null)))}</span></div></div></div>)}</div>
      </section>}
      {m && <section className="panel">
        <h2>Schwellen &amp; Zielpreise</h2>
        <div className="tbl"><table><thead><tr><th>Damit der Cashflow ± 0 ist …</th><th className="num">nötig</th><th>bei Ihrer Einstellung</th></tr></thead><tbody>
          <tr><td>… Miete pro Monat</td><td className="num">{eur((m.hausgeld + m.rateMonat) / (1 - m.ausfall))}</td><td className="note">{eur(m.miete0)}</td></tr>
          <tr><td>… Sollzins höchstens</td><td className="num">{m.darlehen > 0 ? pct(netM * 12 / m.darlehen - s.tilgung, 2) : "–"}</td><td className="note">{pct(s.sollzins, 2)}</td></tr>
          <tr><td>… Eigenkapital mindestens</td><td className="num">{eur(Math.max(0, m.gesamtinvestition - netM * 12 / (s.sollzins + s.tilgung)))}</td><td className="note">{eur(s.eigenkapital)}</td></tr>
        </tbody></table></div>
        <div className="tiles">{([["Kaufpreis für Cashflow ± 0", a.zielpreise.cashflowNull], [`Kaufpreis für ${pct(p.anlageprofil.minBruttorendite)} Rendite`, a.zielpreise.mindestrendite], [`Kaufpreis für Faktor ${num(p.anlageprofil.maxFaktor, 0)}`, a.zielpreise.maxFaktor], [`Kaufpreis für DSCR ${num(p.minDscr)}`, a.zielpreise.dscr]] as const).map(([l, v]) => <div key={l}><span>{l}</span><strong>{eur(v)}</strong>{v != null && o.objekt.kaufpreis ? <span className="note">{vorzeichen(v / o.objekt.kaufpreis - 1, x => pct(x, 0))} zum Angebot</span> : null}</div>)}</div>
      </section>}
    </>
  );
}

export function Steuern({ a }: { a: Analyse }) {
  const t = a.steuern; const p = a.params; const [vergleich, setVergleich] = useState(p.struktur === "offen");
  if (!t) return <section className="panel"><h2>Steuern</h2><div className="empty">Für die Steuerrechnung fehlen Kaufpreis oder Miete.</div></section>;
  const f = p.struktur === "gbr" ? p.gbrAnteil : 1;
  const zeile = (l: string, xs: (string)[]) => <tr key={l}><td>{l}</td>{xs.map((x, i) => <td key={i} className="num">{x}</td>)}</tr>;
  const sign = (v: number) => v < 0 ? `Erstattung ${eur(-v)}` : eur(v);
  return (
    <section className="panel">
      <div className="ph"><h2>Nach Steuern: {STRUKTUR[p.struktur]}{p.struktur === "gbr" ? ` (Ihr Anteil ${pct(p.gbrAnteil, 0)})` : ""}</h2><span className="tag">auf Basis Ihrer Einstellung im Durchspielen</span></div>
      {p.struktur === "privat" || p.struktur === "gbr" ? <Kacheln eintraege={[["Cashflow nach Steuern, Jahr 1 / Monat", eur(t.privat.cashflowJahr1Monat * f)], ["Ø Cashflow nach Steuern / Monat", eur(t.privat.cashflowSchnittMonat * f)], ["Steuern laufend (Summe)", sign(t.privat.steuernLaufend * f)], ["Steuer auf Verkauf", eur(t.privat.steuerVerkauf * f)], ["Vermögenszuwachs nach Steuern", eur(t.privat.zuwachsNachSteuern * f)], ["Eigenkapitalrendite nach Steuern", pct(t.privat.irr)]]} />
        : p.struktur === "gmbh" ? <Kacheln eintraege={[["Cashflow nach Steuern, Jahr 1 / Monat", eur(t.gmbh.cashflowJahr1Monat)], ["Steuer auf Verkauf", eur(t.gmbh.steuerVerkauf)], ["Steuer bei Ausschüttung", eur(t.gmbhAusgeschuettet.steuerAusschuettung)], ["Zuwachs in der GmbH", eur(t.gmbh.zuwachsNachSteuern)], ["Zuwachs nach Ausschüttung", eur(t.gmbhAusgeschuettet.zuwachsNachSteuern)], ["Eigenkapitalrendite nach Ausschüttung", pct(t.gmbhAusgeschuettet.irr)]]} />
        : <p className="note">Sie haben die Struktur offen gelassen; unten sehen Sie alle Varianten nebeneinander. Das ist keine Empfehlung, sondern Grundlage für das Gespräch mit Ihrem Steuerberater.</p>}
      <ul className="flags"><li className="info">Abschreibung {pct(t.afaSatz)} auf den Gebäudeanteil: {eur(t.afaJahr)} pro Jahr.</li>{p.struktur !== "gmbh" && <li className={a.szenario.haltedauer >= 10 ? "good" : ""}>{a.szenario.haltedauer >= 10 ? `Haltedauer ${a.szenario.haltedauer} Jahre: Verkauf im Privatvermögen steuerfrei.` : "Haltedauer unter 10 Jahren: Der Veräußerungsgewinn ist steuerpflichtig."}</li>}</ul>
      <div className="row"><button type="button" className="btn ghost" onClick={() => setVergleich(v => !v)}>{vergleich ? "Vergleich ausblenden" : "Mit anderen Strukturen vergleichen"}</button></div>
      {vergleich && <div className="tbl"><table><thead><tr><th>Über die Haltedauer</th><th className="num">Privat</th><th className="num">GbR (gesamt)</th><th className="num">GmbH, im Mantel</th><th className="num">GmbH, ausgeschüttet</th></tr></thead><tbody>
        {zeile("Ø Cashflow nach Steuern / Monat", [eur(t.privat.cashflowSchnittMonat), eur(t.privat.cashflowSchnittMonat), eur(t.gmbh.cashflowSchnittMonat), eur(t.gmbh.cashflowSchnittMonat)])}
        {zeile("Steuern laufend (Summe)", [sign(t.privat.steuernLaufend), sign(t.privat.steuernLaufend), sign(t.gmbh.steuernLaufend), sign(t.gmbh.steuernLaufend)])}
        {zeile("Steuer auf Verkauf", [eur(t.privat.steuerVerkauf), eur(t.privat.steuerVerkauf), eur(t.gmbh.steuerVerkauf), eur(t.gmbh.steuerVerkauf)])}
        {zeile("Steuer auf Ausschüttung", ["–", "–", "–", eur(t.gmbhAusgeschuettet.steuerAusschuettung)])}
        {zeile("Vermögenszuwachs nach Steuern", [eur(t.privat.zuwachsNachSteuern), eur(t.privat.zuwachsNachSteuern), eur(t.gmbh.zuwachsNachSteuern), eur(t.gmbhAusgeschuettet.zuwachsNachSteuern)])}
        {zeile("Eigenkapitalrendite nach Steuern", [pct(t.privat.irr), pct(t.privat.irr), pct(t.gmbh.irr), pct(t.gmbhAusgeschuettet.irr)])}
      </tbody></table></div>}
      <details><summary>Steuerliche Annahmen</summary><p className="note">Körperschaftsteuer inkl. Soli 15,825 % mit erweiterter Gewerbesteuerkürzung, Abgeltungsteuer inkl. Soli 26,375 % bei Ausschüttung. Abschreibung nach Baujahr: vor 1925 2,5 %, bis 2022 2 %, ab 2023 3 % auf den Gebäudeanteil inkl. Kaufnebenkosten. Ohne Kirchensteuer, Teileinkünfteverfahren, Erhaltungsaufwand, Verkaufskosten und Sonderfälle wie gewerblichen Grundstückshandel. Nur zur Information, bitte mit Steuerberater klären.</p></details>
    </section>
  );
}

function ParamFeld({ d, wert, onChange }: { d: ParamDef; wert: number | string | boolean; onChange: (v: number | string | boolean) => void }) {
  if (d.typ === "auswahl") return <Auswahl label={d.label} wert={String(wert)} optionen={(d.optionen ?? []).map(x => [x.wert, x.label] as [string, string])} onChange={onChange} />;
  if (d.typ === "jaNein") return <Haken label={d.label} wert={wert === true || wert === "true"} onChange={onChange} />;
  return <Zahl label={d.label} prozent={d.typ === "prozent"} einheit={d.typ === "prozent" ? undefined : d.einheit} hinweis={d.hilfe} wert={Number(wert)} schritt={d.typ === "prozent" ? (d.schritt ?? 0.01) * 100 : d.schritt} onChange={v => onChange(v ?? 0)} />;
}

export function Gestaltung({ o, a, setze }: { o: Objektdatensatz; a: Analyse; setze: Setze }) {
  const an = (id: string, on: boolean) => { const m = { ...o.module }; if (on) m[id] = {}; else delete m[id]; setze({ module: m }); };
  const setzeWert = (id: string, k: string, v: number | string | boolean) => setze({ module: { ...o.module, [id]: { ...(o.module[id] ?? {}), [k]: v } } });
  return (
    <section className="panel">
      <div className="ph"><h2>Gestaltung</h2><span className="tag">was aus dem Objekt werden kann</span></div>
      <p className="note">Jedes Modul rechnet eine Variante neben dem Ist-Fall: Kosten, Zeit, Erlös, Marge, Eigenkapitalrendite und Genehmigungsrisiko. Aktive Module prüft der Projektentwickler im Teamlauf mit.</p>
      <div className="gest">{MODULE.map(m => { const aktiv = m.id in o.module; const werte = { ...standardwerte(m, o.objekt, a.params), ...(o.module[m.id] ?? {}) }; const r = a.module[m.id];
        const gruppen = [...new Set(m.parameter.map(p => p.gruppe))];
        return (
          <details key={m.id} className={`mod${aktiv ? " on" : ""}`} open={aktiv}>
            <summary><span><b>{m.name}</b><br /><span className="note">{m.kurz}</span></span><label className="switch" onClick={e => e.stopPropagation()}><input type="checkbox" role="switch" checked={aktiv} onChange={e => an(m.id, e.target.checked)} aria-label={`${m.name} aktiv`} /><span className="track-s" aria-hidden="true" /><span>{aktiv ? "aktiv" : "aus"}</span></label></summary>
            <div className="body">
              {!aktiv && <p className="note">Aktivieren, um mit Ihren Werten zu rechnen. Hürden: {m.huerden.slice(0, 2).join("; ")} …</p>}
              {aktiv && <>
                {gruppen.map(g => <div key={g} style={{ display: "grid", gap: 8 }}><div className="grp">{g}</div><div className="fields">{m.parameter.filter(p => p.gruppe === g).map(d => <ParamFeld key={d.key} d={d} wert={werte[d.key]!} onChange={v => setzeWert(m.id, d.key, v)} />)}</div></div>)}
                {r && <><div className="tiles">{r.kennzahlen.map(k => <div key={k.key}><span>{k.label}</span><strong>{kennzahl(k.wert, k.einheit)}</strong></div>)}</div>
                  {r.hinweise.length > 0 && <ul className="flags">{r.hinweise.map(h => <li key={h.text} className={h.art === "warn" ? "" : h.art}>{h.text}</li>)}</ul>}</>}
                <div><div className="lbl">Hürden und Rechtsstand</div><ul className="huerden">{m.huerden.map(h => <li key={h}>{h}</li>)}</ul></div>
                <p className="note">Prüfen im Team: {m.experten.map(e => expertMeta(e)?.rolle ?? e).join(", ")}</p>
              </>}
            </div>
          </details>); })}</div>
    </section>
  );
}

export const STANDARD_SZENARIO = standardSzenario;
