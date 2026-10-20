"use client";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/App";
import { Kacheln } from "@/components/Felder";
import { Objektliste } from "@/components/Objektliste";
import { eur, teur } from "@/lib/format";
import { paketName, type PaketId } from "@/lib/quellen";

type Bereich = "bestand" | "weg" | "grund";
const BEREICHE: [Bereich, string][] = [["bestand", "Bestand"], ["weg", "WEG & Verwaltung"], ["grund", "Grundstücke"]];

/** Vorbereitete Funktionen je Bereich: was kommt, in welchem Paket */
const VORBEREITET: Record<Bereich, { titel: string; punkte: string[]; paket: PaketId }[]> = {
  bestand: [
    { titel: "Mieten & Kosten", punkte: ["Zahlungseingänge und Rückstände", "Mieterhöhungen mit Fristen, Mietspiegel und Kappungsgrenze", "Nebenkostenabrechnung prüfen"], paket: "familyoffice" },
    { titel: "Finanzierung", punkte: ["Restschuld und Zinsbindungsende je Darlehen", "Anschlussfinanzierung rechtzeitig planen", "Sondertilgung und Umschuldung durchrechnen"], paket: "familyoffice" },
    { titel: "Vermögen & Fristen", punkte: ["Nettovermögen und Rendite des Portfolios", "Versicherungen, Grundsteuer, Steuererklärung", "Hinweise aufs Smartphone"], paket: "familyoffice" },
    { titel: "Verkauf & Exit", punkte: ["Wert heute und Verkaufszeitpunkt (Spekulationsfrist)", "Aufteilung oder Paketverkauf", "Rückfluss in neue Suchaufträge"], paket: "familyoffice" },
  ],
  weg: [
    { titel: "Eigentümerversammlung", punkte: ["Einladung und Tagesordnung lesen lassen", "Beschlussvorschläge einordnen: Kosten, Rücklage, Sonderumlage", "Stimmverhalten vorbereiten, Vollmacht"], paket: "familyoffice" },
    { titel: "Abrechnung & Wirtschaftsplan", punkte: ["Hausgeldabrechnung prüfen, umlagefähig oder nicht", "Wirtschaftsplan gegen Vorjahr", "Erhaltungsrücklage je m² im Blick"], paket: "familyoffice" },
    { titel: "Verwalter & Mieter", punkte: ["Schreiben an Verwalter und Mieter entwerfen", "Mängel und Reparaturen nachhalten", "Mietverwaltung für vermietete Einheiten"], paket: "familyoffice" },
    { titel: "Facility Services", punkte: ["Hausmeister und Handwerker beauftragen und koordinieren", "Angebote einholen und vergleichen", "Termine und Abnahmen nachhalten"], paket: "familyoffice" },
  ],
  grund: [
    { titel: "Grundstück erfassen", punkte: ["Lage, Fläche, Bodenrichtwert (BORIS)", "Baurecht: Bebauungsplan, § 34, Bau-Turbo", "Lasten und Baulasten"], paket: "familyoffice" },
    { titel: "Entwicklung rechnen", punkte: ["Residualwert und Marge mit dem Modul Grundstück & Neubau", "Bauen und halten oder verkaufen", "Zeitplan und Finanzierung"], paket: "familyoffice" },
    { titel: "Grundstücke finden", punkte: ["Suchauftrag mit Klasse Grundstück", "Grundstücksbörsen der Kommunen", "Off-Market über Netzwerk"], paket: "familyoffice" },
  ],
};

export default function Portfolio() {
  const { objekte, analyseVon, profil } = useApp(); const [bereich, setBereich] = useState<Bereich>("bestand");
  const bestand = objekte.filter(o => o.status === "bestand"); const a = bestand.map(analyseVon);
  const etw = bestand.filter(o => o.objekt.asset === "ETW");
  const zyklus: [string, number | string, string][] = [
    ["Suchen", (profil?.suchen ?? []).length, "/suchen"], ["Treffer", objekte.filter(o => o.status === "kandidat").length, "/pruefen"],
    ["Prüfen", objekte.filter(o => o.status === "pruefung").length, "/pruefen"], ["Bestand", bestand.length, "/portfolio"], ["Verwalten", etw.length ? `${etw.length} WEG` : "–", "/portfolio"], ["Verkauf", "–", "/portfolio"],
  ];
  return (
    <div className="view">
      <h1>Bestand</h1>
      <nav className="zyklus" aria-label="Investment-Zyklus">{zyklus.map(([l, n, href], i) => <Link key={l} href={href} className={i >= 3 ? "z-on" : ""}><b>{n}</b><span>{l}</span></Link>)}</nav>
      <div className="seg seg-tabs" role="tablist">{BEREICHE.map(([k, l]) => <label key={k} className="segi"><input type="radio" name="bereich" checked={bereich === k} onChange={() => setBereich(k)} /><span>{l}</span></label>)}</div>
      {bereich === "bestand" && <>
        <Kacheln eintraege={[["Objekte", bestand.length], ["Kaufpreise gesamt", teur(bestand.reduce((s, o) => s + (o.objekt.kaufpreis ?? 0), 0))], ["Cashflow im Monat", eur(a.reduce((s, x) => s + (x.bewertung.kennzahlen.cashflowMonat ?? 0), 0))], ["Eigenkapital im Bestand", teur(a.reduce((s, x) => s + (x.simulation?.nettovermoegenStart ?? 0), 0))]]} />
        <section className="panel"><h2>Objekte im Bestand</h2><Objektliste objekte={bestand} leer={<><b>Noch kein Bestand</b><span>Gekaufte Objekte stellen Sie am Objekt auf „Bestand“. Dann erscheinen sie hier mit Cashflow und Fristen.</span></>} /></section>
      </>}
      {bereich === "weg" && <section className="panel"><div className="ph"><h2>WEG & Verwaltung</h2><span className="tag">{etw.length ? `${etw.length} Eigentumswohnungen im Bestand` : "für Eigentumswohnungen und Mietverwaltung"}</span></div><p className="lead">Der WEG-Verwalter-Experte begleitet heute schon die Prüfung. Im Bestand übernimmt er Versammlung, Abrechnung und Schriftverkehr, und eine Koordination für Hausmeister und Handwerker kommt dazu.</p></section>}
      {bereich === "grund" && <section className="panel"><div className="ph"><h2>Grundstücke</h2><span className="tag">kaufen, entwickeln, halten</span></div><p className="lead">Grundstücke lassen sich schon heute suchen (Suchauftrag mit Klasse Grundstück) und mit dem Modul „Grundstück & Neubau“ rechnen. Hier entsteht die Verwaltung bis zur Bebauung.</p></section>}
      <div className="vorb">{VORBEREITET[bereich].map(v => (
        <article key={v.titel}><div className="ph"><h3>{v.titel}</h3><span className="badge b-plan">in Vorbereitung · {paketName(v.paket)}</span></div><ul>{v.punkte.map(p => <li key={p}>{p}</li>)}</ul></article>
      ))}</div>
    </div>
  );
}
