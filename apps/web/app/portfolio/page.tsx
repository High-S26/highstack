"use client";
import { useApp } from "@/components/App";
import { Kacheln } from "@/components/Felder";
import { Objektliste } from "@/components/Objektliste";
import { eur, teur } from "@/lib/format";

export default function Portfolio() {
  const { objekte, analyseVon } = useApp();
  const bestand = objekte.filter(o => o.status === "bestand"); const a = bestand.map(analyseVon);
  return (
    <div className="view">
      <h1>Portfolio</h1>
      <Kacheln eintraege={[["Objekte", bestand.length], ["Kaufpreise gesamt", teur(bestand.reduce((s, o) => s + (o.objekt.kaufpreis ?? 0), 0))], ["Cashflow pro Monat", eur(a.reduce((s, x) => s + (x.bewertung.kennzahlen.cashflowMonat ?? 0), 0))], ["EK im Bestand", teur(a.reduce((s, x) => s + (x.simulation?.nettovermoegenStart ?? 0), 0))]]} />
      <section className="panel"><h2>Bestand</h2><Objektliste objekte={bestand} leer="Noch kein Bestand. Gekaufte Objekte stellen Sie am Objekt auf „Bestand“." /></section>
      <section className="panel">
        <div className="ph"><h2>Bestand steuern</h2><span className="badge b-plan">in Vorbereitung</span></div>
        <div className="explain">
          <div><b>Mieten &amp; Kosten</b><ul><li>Zahlungseingänge und Rückstände</li><li>Mieterhöhungen mit Fristen und Kappungsgrenze</li><li>Nebenkosten- und WEG-Abrechnungen</li></ul></div>
          <div><b>Finanzierung</b><ul><li>Restschuld und Zinsbindungsende je Darlehen</li><li>Anschlussfinanzierung rechtzeitig planen</li><li>Sondertilgungen und Umschuldung</li></ul></div>
          <div><b>Vermögen &amp; Fristen</b><ul><li>Nettovermögen und Rendite des Portfolios</li><li>Eigentümerversammlungen, Versicherungen, Steuern</li><li>Hinweise aufs Smartphone</li></ul></div>
        </div>
      </section>
    </div>
  );
}
