"use client";
import { PREISLAGE, type Analyse, type Objekt, type Preislage } from "@highstack/engine";
import { eur, num, pct, vorzeichen } from "@/lib/format";
import type { Objektdatensatz } from "@/lib/typen";
import { Zahl } from "../Felder";

const PILL: Record<Preislage, string> = { guenstig: "p-opp", markt: "", teuer: "p-watch", "deutlich-teuer": "p-pass" };
/** Skala für die Abweichung des Faktors vom Markt: −30 % bis +40 % */
const LO = -0.3, HI = 0.4; const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - LO) / (HI - LO)) * 100))}%`;

/** Kaufpreis-Check: Faktor gegen Markt, Ursache, marktübliche Preise und Ertragswert als Gegenprobe */
export function Kaufpreischeck({ o, a, setze }: { o: Objektdatensatz; a: Analyse; setze: (p: Partial<Objektdatensatz>) => void }) {
  const c = a.kaufpreis; const ob = o.objekt;
  const set = (p: Partial<Objekt>) => setze({ objekt: { ...ob, ...p } });
  if (!c) return null;
  const ew = c.ertragswert; const angebot = c.kaufpreis;
  const gegen = (preis: number | null) => preis ? <span className={angebot <= preis ? "up" : "dn"}>{vorzeichen(angebot / preis - 1, x => pct(x, 0))}</span> : <span />;
  return (
    <section className="panel kpc">
      <div className="ph"><h2>Kaufpreis-Check</h2>{c.lage ? <span className={`pill ${PILL[c.lage]}`}>{PREISLAGE[c.lage]}{c.lage !== "markt" && c.ursache ? ` · ${c.ursache === "miete" ? (c.lage === "guenstig" ? "hohe Miete" : "niedrige Miete") : c.ursache === "preis" ? "Preis" : "Preis und Miete"}` : ""}</span> : <span className="tag">Marktwerte fehlen</span>}</div>

      {c.faktorAbw != null && <div className="kpc-skala" role="img" aria-label={`Faktor ${vorzeichen(c.faktorAbw, x => pct(x, 0))} gegenüber dem Markt: ${PREISLAGE[c.lage!]}`}>
        <div className="kpc-band"><span className="z-g" style={{ width: pos(-0.1) }} /><span className="z-m" style={{ width: `calc(${pos(0.1)} - ${pos(-0.1)})` }} /><span className="z-t" style={{ width: `calc(${pos(0.25)} - ${pos(0.1)})` }} /><span className="z-d" /></div>
        <span className="kpc-mark" style={{ left: pos(c.faktorAbw) }}><b>{vorzeichen(c.faktorAbw, x => pct(x, 0))}</b></span>
        <div className="kpc-lbl" aria-hidden="true"><span>günstig</span><span>marktüblich</span><span>teuer</span><span>deutlich teuer</span></div>
      </div>}

      <div className="tiles kpc-tiles">
        {c.faktorIst != null && <div><span>Faktor heute</span><strong>{num(c.faktorIst, 1)}</strong><span className="note">auf die Ist-Miete</span></div>}
        <div><span>Faktor am Markt</span><strong>{num(c.marktfaktor, 1)}</strong><span className="note">{c.marktfaktor ? "Vergleichspreis ÷ Vergleichsmiete" : "Vergleichswerte fehlen"}</span></div>
        {c.faktorVergleich != null && <div><span>Faktor nachhaltig</span><strong>{num(c.faktorVergleich, 1)}</strong><span className="note">auf die Vergleichsmiete</span></div>}
        {c.faktorNachAnpassung && <div><span>Faktor nach Mietanpassung</span><strong>{num(c.faktorNachAnpassung.faktor, 1)}</strong><span className="note">{c.faktorNachAnpassung.wann}</span></div>}
        {c.faktorGesamt != null && <div><span>Faktor auf Gesamtinvestition</span><strong>{num(c.faktorGesamt, 1)}</strong><span className="note">mit Nebenkosten{(ob.stellplaetze ?? []).some(x => x.erwerben && x.preis === "separat") ? " und Stellplatz" : ""}</span></div>}
      </div>

      {c.aussagen.length > 0 && <ul className="flags kpc-aussagen">{c.aussagen.map(t => <li key={t} className={c.lage === "guenstig" ? "good" : ""}>{t}</li>)}</ul>}

      {(c.vergleichspreisQm || c.vergleichsmiete) && <div className="tbl"><table><thead><tr><th>Vergleich je m²</th><th className="num">Objekt</th><th className="num">Markt</th><th className="num">Abweichung</th></tr></thead><tbody>
        <tr><td>Kaufpreis</td><td className="num">{eur(c.preisQm)}</td><td className="num">{eur(c.vergleichspreisQm)}</td><td className="num">{c.preisAbw == null ? "–" : vorzeichen(c.preisAbw, x => pct(x, 0))}</td></tr>
        {c.istMiete != null && <tr><td>Kaltmiete</td><td className="num">{num(c.istMiete / c.flaeche, 2)} €</td><td className="num">{c.vergleichsmiete ? `${num(c.vergleichsmiete / c.flaeche, 2)} €` : "–"}</td><td className="num">{c.mietAbw == null ? "–" : vorzeichen(c.mietAbw, x => pct(x, 0))}</td></tr>}
      </tbody></table></div>}

      <div className="lbl">Was der Preis sein dürfte</div>
      <ul className="sr-liste">
        <li><span /><span>Angebot</span><b>{eur(angebot)}</b><span /></li>
        {c.preisMarktfaktor != null && <li><span /><span>Marktfaktor × {c.istMiete ? "heutige Miete" : "Vergleichsmiete"}</span><b>{eur(c.preisMarktfaktor)}</b>{gegen(c.preisMarktfaktor)}</li>}
        {c.preisVergleich != null && <li><span /><span>Vergleichspreis × {num(c.flaeche, 1)} m²</span><b>{eur(c.preisVergleich)}</b>{gegen(c.preisVergleich)}</li>}
        {ew && <li><span /><span>Ertragswert <span className="note">({eur(ew.von)} bis {eur(ew.bis)})</span></span><b>{eur(ew.wert)}</b>{gegen(ew.wert)}</li>}
      </ul>
      <p className="note">Abweichung: Angebot gegenüber dem jeweiligen Wert, grün = Angebot darunter.</p>

      {ew && <details className="kpc-ew"><summary>Ertragswert: Rechnung und Annahmen</summary>
        <div className="tbl"><table><tbody>
          <tr><td>Rohertrag im Jahr</td><td className="num">{eur(ew.rohertrag)}</td></tr>
          <tr><td>− Bewirtschaftungskosten</td><td className="num">{eur(ew.bewirtschaftung)}</td></tr>
          <tr><td>= Reinertrag</td><td className="num">{eur(ew.reinertrag)}</td></tr>
          <tr><td>× Barwertfaktor ({pct(ew.liegenschaftszins, 2)}, {ew.restnutzungsdauer} Jahre)</td><td className="num">{num(ew.barwertfaktor, 2)}</td></tr>
          <tr><td>+ abgezinster Bodenwert ({eur(ew.bodenwert)})</td><td className="num">{eur(ew.wert - ew.reinertrag * ew.barwertfaktor)}</td></tr>
          <tr><td><b>Ertragswert</b></td><td className="num"><b>{eur(ew.wert)}</b></td></tr>
        </tbody></table></div>
        <ul className="kpc-annahmen">{ew.annahmen.map(t => <li key={t} className="note">{t}</li>)}</ul>
        <div className="fields">
          <Zahl label="Liegenschaftszins" prozent min={0.1} max={15} wert={ob.liegenschaftszins ?? null} onChange={v => set({ liegenschaftszins: v })} hinweis={ew.lzEigen ? "Ihre Angabe; leer lassen für den Standard" : `leer: ${pct(ew.liegenschaftszins, 2)}, Standard für ${ob.asset}`} />
          <Zahl label="Restnutzungsdauer" einheit="Jahre" min={1} max={100} wert={ob.restnutzungsdauer ?? null} onChange={v => set({ restnutzungsdauer: v })} hinweis={ew.rndEigen ? undefined : `leer: ${ew.restnutzungsdauer} Jahre aus dem Baujahr`} />
          <Zahl label="Bodenrichtwert" einheit="€/m²" wert={ob.bodenrichtwert} onChange={v => set({ bodenrichtwert: v })} hinweis="BORIS (Bodenrichtwertportal des Landes)" />
          <Zahl label="Grundstücksanteil" einheit="m²" wert={ob.grundstueckAnteilQm ?? null} onChange={v => set({ grundstueckAnteilQm: v })} hinweis={ob.asset === "ETW" ? "Grundstücksfläche × Miteigentumsanteil (Teilungserklärung, Grundbuch)" : "Grundstücksfläche laut Grundbuch"} />
        </div>
      </details>}

      {c.fehlt.length > 0 && <p className="note warn-t">Für einen belastbaren Vergleich fehlen: {c.fehlt.join(", ")}. Unter Objektdaten → Markt ermitteln lassen oder eintragen.</p>}
      <p className="note">Marktfaktor und Vergleichswerte gelten für eine durchschnittliche Wohnung am Ort; Zustand, Etage und Ausstattung können Abweichungen rechtfertigen. Der Ertragswert ist eine vereinfachte Gegenprobe, kein Gutachten; Banken setzen den Beleihungswert meist noch darunter an.</p>
    </section>
  );
}
