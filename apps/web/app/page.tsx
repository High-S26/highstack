"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/App";
import { Kacheln } from "@/components/Felder";
import { Spielraum } from "@/components/Profilteile";
import { api } from "@/lib/client";
import { teur } from "@/lib/format";

export default function Uebersicht() {
  const { profil, objekte, analyseVon, setzeObjekt } = useApp(); const router = useRouter();
  if (!profil?.onboarded) return null;
  const kandidaten = objekte.filter(o => o.status === "kandidat"), pruefung = objekte.filter(o => o.status === "pruefung"), bestand = objekte.filter(o => o.status === "bestand");
  const neu = async (beispiel: boolean) => { const o = await api.neuesObjekt({ beispiel }); setzeObjekt(o); router.push(`/objekt/${o.id}`); };
  const aufgaben: { text: string; href: string; label: string }[] = [];
  kandidaten.map(o => [o, analyseVon(o)] as const).filter(([, a]) => a.bewertung.einstufung !== "pass").sort((a, b) => (b[1].bewertung.score ?? -1) - (a[1].bewertung.score ?? -1)).slice(0, 3).forEach(([o, a]) => aufgaben.push({ text: `Kandidat prüfen: ${o.objekt.titel} (${Math.round(a.bewertung.score ?? 0)})`, href: `/objekt/${o.id}`, label: "Öffnen" }));
  pruefung.forEach(o => {
    if (!o.objekt.kaufpreis || (!o.objekt.miete && !o.objekt.marktmieteQm)) aufgaben.push({ text: `Daten ergänzen: ${o.objekt.titel}`, href: `/objekt/${o.id}`, label: "Öffnen" });
    else if (!o.dokumente.some(d => d.text)) aufgaben.push({ text: `Unterlagen hochladen: ${o.objekt.titel}`, href: `/objekt/${o.id}?tab=unterlagen`, label: "Öffnen" });
    else if (!o.experten.komitee) aufgaben.push({ text: `Team beauftragen: ${o.objekt.titel}`, href: `/objekt/${o.id}?tab=experten`, label: "Öffnen" });
  });
  return (
    <div className="view">
      <h1>Übersicht</h1>
      <Spielraum apId={profil.aktivesAnlageprofil} />
      <Kacheln eintraege={[["Kandidaten", kandidaten.length], ["In Prüfung", pruefung.length], ["davon Opportunity", pruefung.filter(o => analyseVon(o).bewertung.einstufung === "opp").length], ["Bestand", bestand.length], ["EK im Bestand", bestand.length ? teur(bestand.reduce((s, o) => s + (analyseVon(o).simulation?.nettovermoegenStart ?? 0), 0)) : "–"]]} />
      <div className="two">
        <section className="panel"><h2>Als Nächstes</h2>
          <div className="todo">{aufgaben.length ? aufgaben.map(a => <div key={a.text}><span>{a.text}</span><Link className="btn ghost sm" href={a.href}>{a.label}</Link></div>) : <div><span className="note">Nichts offen. Sichten Sie neue Inserate in der Suche.</span></div>}</div>
        </section>
        <section className="panel"><h2>Schnellstart</h2>
          <div className="row"><Link className="btn" href="/suchen">Inserate sichten</Link><button className="btn ghost" type="button" onClick={() => neu(false)}>Einzelnes Objekt prüfen</button><button className="btn ghost" type="button" onClick={() => neu(true)}>Beispielobjekt</button></div>
          <p className="note">Suchen findet und rankt Kandidaten nach Ihrem Anlageprofil. Prüfen geht bei einem Objekt in die Tiefe, bis zu Gestaltungsvarianten und dem Urteil des Teams.</p>
        </section>
      </div>
    </div>
  );
}
