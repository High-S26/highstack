"use client";
import { AUSSENART, flaechen, regulierung, type Analyse, type Aussenart, type Objekt } from "@highstack/engine";
import { useId } from "react";
import { eur, num, pct, vorzeichen } from "@/lib/format";
import { Auswahl, Text, Zahl } from "../Felder";

type Set = (p: Partial<Objekt>) => void;

/** Eingaben: Außenfläche und Mietvertrag (Art, letzte Erhöhung, Mieterwechsel, Regulierung am Ort) */
export function MietFelder({ ob, set }: { ob: Objekt; set: Set }) {
  const au = ob.aussenflaeche; const mv = ob.mietvertrag ?? { art: "standard" as const };
  const fl = flaechen(ob); const reg = regulierung(ob);
  const setAu = (p: Partial<NonNullable<Objekt["aussenflaeche"]>>) => set({ aussenflaeche: { art: "balkon", qm: null, anrechnung: 0.25, inWohnflaeche: false, ausrichtung: null, ...(au ?? {}), ...p } });
  const setMv = (p: Partial<NonNullable<Objekt["mietvertrag"]>>) => set({ mietvertrag: { art: "standard", ...(ob.mietvertrag ?? {}), ...p } });
  const monatId = useId();
  return (
    <>
      <div className="grp">Außenfläche</div>
      <div className="fields">
        <Auswahl liste label="Balkon, Terrasse, Garten" wert={au?.art ?? ""} optionen={[["", "keine"], ...(Object.entries(AUSSENART) as [Aussenart, { label: string }][]).map(([k, v]) => [k, v.label] as [string, string])]}
          onChange={v => v ? setAu({ art: v as Aussenart, anrechnung: AUSSENART[v as Aussenart].anrechnung }) : set({ aussenflaeche: null })} />
        {au && <>
          <Zahl label="Größe" einheit="m²" wert={au.qm} onChange={v => setAu({ qm: v })} />
          {au.art !== "garten" && <Auswahl label="In der Wohnfläche enthalten?" wert={au.inWohnflaeche ? "j" : "n"} optionen={[["n", "nein, zusätzlich"], ["j", "ja, schon drin"]]} onChange={v => setAu({ inWohnflaeche: v === "j" })} />}
          {au.art !== "garten" && !au.inWohnflaeche && <Auswahl label="Anrechnung auf die Wohnfläche" wert={au.anrechnung >= 0.5 ? "h" : "v"} optionen={[["v", "ein Viertel (Regelfall)"], ["h", "die Hälfte (höchstens)"]]} onChange={v => setAu({ anrechnung: v === "h" ? 0.5 : 0.25 })} />}
          <Text label="Ausrichtung" wert={au.ausrichtung ?? ""} platzhalter="z. B. Süd" onChange={v => setAu({ ausrichtung: v || null })} />
          {fl.angerechnet > 0 && <p className="note full">Gerechnet wird mit {num(fl.gesamt, 1)} m² ({num(ob.wohnflaeche, 1)} m² + {num(fl.angerechnet, 1)} m² {AUSSENART[au.art].label}). Das wirkt auf Marktmiete und Preis je m².</p>}
        </>}
      </div>
      {!ob.leer && <>
        <div className="grp">Mietvertrag</div>
        <div className="fields">
          <Auswahl label="Art der Miete" wert={mv.art} optionen={[["standard", "normal"], ["staffel", "Staffel"], ["index", "Index"]]} onChange={v => setMv({ art: v })} />
          <div className="fld">
            <div className="lrow"><label htmlFor={monatId}>Letzte Mieterhöhung</label></div>
            <input id={monatId} type="month" value={mv.letzteErhoehung ?? ""} max={new Date().toISOString().slice(0, 7)} onChange={e => setMv({ letzteErhoehung: e.target.value || null })} />
            <div className="hint">{mv.letzteErhoehung ? "Ab diesem Monat galt die letzte Erhöhung (oder der Mietbeginn)." : "Unbekannt: gerechnet wird, als sei gerade erhöht worden."}</div>
          </div>
          {mv.art === "staffel" && <Zahl label="Staffel pro Jahr" prozent wert={mv.staffelProzent ?? null} onChange={v => setMv({ staffelProzent: v })} min={-20} max={20} />}
          <Zahl label="Mieterwechsel angenommen im Jahr" wert={mv.mieterwechselJahr ?? null} onChange={v => setMv({ mieterwechselJahr: v })} min={1} max={60} hinweis="leer lassen: kein Wechsel eingeplant" />
        </div>
      </>}
      <div className="fields">
        <Auswahl liste label="Mietpreisbremse und Kappungsgrenze am Ort" wert={ob.mietregulierung ?? ""} optionen={[["", "nach Ort bestimmen"], ["angespannt", "gelten (15 %, Bremse)"], ["normal", "gelten nicht (20 %)"]]} onChange={v => set({ mietregulierung: (v || null) as Objekt["mietregulierung"] })} />
        <Zahl label="Ziel bei Neuvermietung" einheit="€/m²" wert={ob.neuvermietungQm ?? null} onChange={v => set({ neuvermietungQm: v })} min={0} max={200} hinweis="leer: ortsübliche Vergleichsmiete" />
        <p className={`note full${reg.geprueft ? "" : " warn-t"}`}>{reg.text}</p>
      </div>
    </>
  );
}

/** Playbook: Mietpotenzial nach Mietrecht und was es für die Kalkulation bedeutet */
export function MietpfadPanel({ o, a }: { o: Objekt; a: Analyse }) {
  const w = a.mietrecht;
  if (!w) {
    if (!o.marktmieteQm && (o.miete || o.leer)) return <div className="mp"><h3>Mietpotenzial</h3><p className="note">Für den Mietpfad fehlt die ortsübliche Vergleichsmiete. Unter Objektdaten → Markt ermitteln lassen oder aus dem Mietspiegel eintragen.</p></div>;
    return null;
  }
  const p = w.pfad; const leer = p.vertrag === "leer";
  const schritte = p.schritte.filter(x => x.art !== "leerstand").slice(0, 5);
  const z = a.zielpreise.cashflowNull; const angebot = a.simulation?.kaufpreis ?? null;
  return (
    <div className="mp">
      <h3>Mietpotenzial nach Mietrecht</h3>
      <div className="tiles">
        <div><span>{leer ? "Miete bei Vermietung" : "Ist-Miete"}</span><strong>{eur(p.start)}</strong><span className="note">{num(p.istQm, 2)} €/m² auf {num(p.flaeche, 1)} m²</span></div>
        <div><span>Ortsübliche Vergleichsmiete</span><strong>{eur(p.vergleichsmiete)}</strong><span className="note">{num(p.vergleichsmieteQm, 2)} €/m²{!leer ? ` · Ist ${vorzeichen(p.abstand, x => pct(x, 0))}` : ""}</span></div>
        {!leer && <div><span>Potenzial im Bestand</span><strong>{p.potenzialMonat > 0 ? `+${eur(p.potenzialMonat)}` : "keins"}</strong><span className="note">{p.vergleichErreicht && p.potenzialMonat > 0 ? `erreicht ${p.vergleichErreicht}` : p.potenzialMonat > 0 ? "in der Haltedauer nicht ganz erreicht" : "Miete auf oder über Vergleichsmiete"}</span></div>}
        <div><span>Bei Neuvermietung höchstens</span><strong>{p.zulaessigNeuvermietung ? eur(p.zulaessigNeuvermietung) : "frei"}</strong><span className="note">{p.regulierung.bremse ? "Vergleichsmiete + 10 % oder Vormiete" : "keine Mietpreisbremse"}</span></div>
      </div>
      {schritte.length > 0 && <ol className="mp-schritte">{schritte.map(x => <li key={`${x.monat}-${x.art}`}><span className="mp-d">{x.datum}</span><span>{x.grund}</span><b>{x.vorher > 0 ? `${eur(x.vorher)} → ` : ""}{eur(x.miete)}</b></li>)}</ol>}
      <div className="lbl">Was das für die Kalkulation bedeutet</div>
      <div className="tbl"><table><thead><tr><th>Cashflow / Monat</th>{w.cashflow.map(c => <th key={c.jahr} className="num">Jahr {c.jahr}</th>)}</tr></thead><tbody>
        <tr><td>mit Anpassung nach Mietrecht</td>{w.cashflow.map(c => <td key={c.jahr} className={`num${c.mit < 0 ? " neg" : ""}`}>{eur(c.mit)}</td>)}</tr>
        <tr><td className="note">Miete eingefroren</td>{w.cashflow.map(c => <td key={c.jahr} className={`num note${c.ohne < 0 ? " neg" : ""}`}>{eur(c.ohne)}</td>)}</tr>
      </tbody></table></div>
      <ul className="sr-liste">
        <li><span /><span>Eigenkapitalrendite mit / ohne Anpassung</span><b>{pct(w.irrMit)} / {pct(w.irrOhne)}</b><span /></li>
        <li><span /><span>Mehr Miete über die Haltedauer</span><b>{eur(w.mehrMieteSumme)}</b><span /></li>
        {z != null && <li><span /><span>Kaufpreis für Cashflow ± 0 mit heutiger Miete</span><b>{eur(z)}</b><span className={angebot && z >= angebot ? "up" : "dn"}>{angebot ? vorzeichen(z / angebot - 1, x => pct(x, 0)) : ""}</span></li>}
        {w.zielpreisVergleichsmiete != null && <li><span /><span>… sobald die Vergleichsmiete erreicht ist{p.vergleichErreicht && !leer ? ` (${p.vergleichErreicht})` : ""}</span><b>{eur(w.zielpreisVergleichsmiete)}</b><span className={angebot && w.zielpreisVergleichsmiete >= angebot ? "up" : "dn"}>{angebot ? vorzeichen(w.zielpreisVergleichsmiete / angebot - 1, x => pct(x, 0)) : ""}</span></li>}
        {w.zielpreisNeuvermietung != null && w.zielpreisNeuvermietung !== w.zielpreisVergleichsmiete && <li><span /><span>… bei Neuvermietung zum zulässigen Höchstwert</span><b>{eur(w.zielpreisNeuvermietung)}</b><span className={angebot && w.zielpreisNeuvermietung >= angebot ? "up" : "dn"}>{angebot ? vorzeichen(w.zielpreisNeuvermietung / angebot - 1, x => pct(x, 0)) : ""}</span></li>}
      </ul>
      {p.hinweise.length > 0 && <ul className="flags">{p.hinweise.map(h => <li key={h}>{h}</li>)}</ul>}
      <p className="note">{p.regulierung.text.replace(/\.$/, "")}. Informationsmodell, keine Rechtsberatung; Modernisierungsumlagen (§ 559) sind nicht enthalten.{a.szenario.mietentwicklung === "pauschal" ? " Im Durchspielen ist gerade „pauschal“ eingestellt: Cashflow und Rendite dort rechnen ohne diesen Pfad." : ""}</p>
    </div>
  );
}
