"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/App";
import { Kacheln } from "@/components/Felder";
import { api } from "@/lib/client";
import { eur, teur } from "@/lib/format";
import { Netz } from "@/components/grafik/Netz";
import { matchAchsen } from "@/lib/match";
import { fortschritt } from "@/lib/fortschritt";

export default function Uebersicht() {
  const { profil, objekte, analyseVon, setzeObjekt, setzeProfil } = useApp(); const router = useRouter();
  if (!profil?.onboarded) return null;
  const kandidaten = objekte.filter(o => o.status === "kandidat"), pruefung = objekte.filter(o => o.status === "pruefung"), bestand = objekte.filter(o => o.status === "bestand");
  const neu = async (beispiel: boolean) => { const da = beispiel && objekte.find(x => x.objekt.titel?.startsWith("Beispiel:")); if (da) { router.push(`/objekt/${da.id}`); return; } const o = await api.neuesObjekt({ beispiel }); setzeObjekt(o); router.push(`/objekt/${o.id}`); };
  const aufgaben: { text: string; href: string; label: string }[] = [];
  kandidaten.map(o => [o, analyseVon(o)] as const).filter(([, a]) => a.bewertung.einstufung !== "pass").sort((a, b) => (b[1].bewertung.score ?? -1) - (a[1].bewertung.score ?? -1)).slice(0, 3).forEach(([o, a]) => aufgaben.push({ text: `Treffer prüfen: ${o.objekt.titel} (${Math.round(a.bewertung.score ?? 0)})`, href: `/objekt/${o.id}`, label: "Öffnen" }));
  pruefung.map(o => [o, fortschritt(o, analyseVon(o))] as const).filter(([, f]) => f.naechster).sort((x, y) => y[0].geaendert - x[0].geaendert).slice(0, 5)
    .forEach(([o, f]) => aufgaben.push({ text: `${o.objekt.titel}: ${f.schritt[f.naechster!].tun} (${f.erledigt}/${f.schritte.length})`, href: `/objekt/${o.id}?tab=${f.naechster}`, label: "Weiter" }));
  // Erste Schritte: kleine Checkliste, bis alles einmal gemacht ist
  const erste: [string, string, string, boolean][] = [
    ["Profil einrichten", "Kapital, Erwerb und Suche festgelegt", "/profil", true],
    ["Erstes Objekt prüfen", "Exposé, Link oder Text einfügen", "/neu", objekte.some(o => o.status !== "kandidat" && !o.objekt.titel?.startsWith("Beispiel:"))],
    ["Suchauftrag einrichten", "Was und wo, Treffer werden gerankt", "/suchen/neu", (profil.suchen ?? []).some(s => s.gesichtet || s.hintergrund?.aktiv) || kandidaten.length > 0 || (profil.suchen?.length ?? 0) > profil.anlageprofile.length],
    ["Annahmen durchspielen", "Preis, Zins, Miete: was trägt sich?", pruefung[0] ? `/objekt/${pruefung[0].id}?tab=spielen` : "/neu", objekte.some(o => !!o.besucht?.spielen)],
    ["Experten fragen", "Kurzurteil oder ganzes Team", pruefung[0] ? `/objekt/${pruefung[0].id}?tab=experten` : "/experten", objekte.some(o => Object.keys(o.experten).length > 0)],
  ];
  const ersteFertig = erste.filter(x => x[3]).length;
  const zeigeErste = !profil.ersteSchritteAus && ersteFertig < erste.length;
  return (
    <div className="view">
      <div className="start-kopf"><h1>Investments</h1><p className="lead">Immobilien finden, prüfen und halten.</p></div>
      <div className="einstiege">
        <Link href="/suchen/neu" className="einstieg dunkel">
          <span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5.5 5.5M10.5 7.5v6M7.5 10.5h6" /></svg></span>
          <h2>Auftrag anlegen</h2>
          <p>Eckpfeiler festlegen: Region, Objektart, Preis, Rendite. highstack sucht in Ihren Quellen und rankt die Treffer nach Passung.</p>
          <span className="los">Suchauftrag anlegen →</span>
          {(profil.suchen?.length ?? 0) > 0 && <span className="zahl">{profil.suchen!.length} aktiv · {kandidaten.length} Treffer</span>}
        </Link>
        <Link href="/neu" className="einstieg">
          <span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M6.5 3.5h7l5 5v12h-12zM13.5 3.5v5h5M9 14l2 2 4-4.5" /></svg></span>
          <h2>Prüfung starten</h2>
          <p>Exposé hochladen, Link oder Text einfügen, oder den Concierge fragen lassen. Ergebnis, Playbook und Passung in einer Minute.</p>
          <span className="los">Objekt prüfen →</span>
          {pruefung.length > 0 && <span className="zahl">{pruefung.length} in Prüfung</span>}
        </Link>
      </div>
      {zeigeErste && <section className="panel erste">
        <div className="ph"><div className="erste-k"><div className="ring sm" style={{ ["--p" as string]: `${(ersteFertig / erste.length) * 100}` }}><b>{ersteFertig}/{erste.length}</b></div><h2>Erste Schritte</h2></div><button type="button" className="linkbtn" onClick={() => setzeProfil({ ...profil, ersteSchritteAus: true })}>Ausblenden</button></div>
        <ol className="erste-l">{erste.map(([t, x, href, ok]) => <li key={t} className={ok ? "ok" : ""}><span className={`st st-${ok ? "erledigt" : "offen"}`} aria-hidden="true" /><div><b>{t}</b><span>{x}</span></div>{!ok && <Link className="btn ghost sm" href={href}>Los</Link>}</li>)}</ol>
      </section>}
      <Kacheln eintraege={[["Treffer", kandidaten.length], ["In Prüfung", pruefung.length], ["davon Opportunity", pruefung.filter(o => analyseVon(o).bewertung.einstufung === "opp").length], ["Bestand", bestand.length], ["EK eingesetzt", bestand.length ? teur(bestand.reduce((s, o) => { const m = analyseVon(o).simulation; return s + (m ? m.ekEinsatz - Math.min(0, m.beimKauf) : 0); }, 0)) : "–"]]} />
      <div className="two">
        <section className="panel"><h2>Als Nächstes</h2>
          <div className="todo">{aufgaben.length ? aufgaben.map(a => <div key={a.text}><span>{a.text}</span><Link className="btn ghost sm" href={a.href}>{a.label}</Link></div>) : <div><span className="note">Nichts offen. Neue Inserate sichten Sie in einem Suchauftrag.</span></div>}</div>
        </section>
        <section className="panel"><div className="ph"><h2>Zuletzt geprüft</h2><Link className="linkbtn" href="/pruefen">alle</Link></div>
          {pruefung.length ? <div className="zuletzt">{[...pruefung].sort((x, y) => y.geaendert - x.geaendert).slice(0, 4).map(o => { const a = analyseVon(o); const e = a.bewertung.einstufung; return <Link key={o.id} href={`/objekt/${o.id}`} className="zl"><Netz reihen={[{ name: o.objekt.titel, achsen: matchAchsen(o.objekt, a) }]} groesse={44} klein /><span><b>{o.objekt.titel || "Objekt"}</b><small>{[o.objekt.ort, o.objekt.kaufpreis ? eur(o.objekt.kaufpreis) : null].filter(Boolean).join(" · ")}</small></span>{e && <span className={`pill p-${e}`}>{Math.round(a.bewertung.score ?? 0)}</span>}</Link>; })}</div>
            : <p className="note">Noch nichts in Prüfung. <button type="button" className="linkbtn" onClick={() => neu(true)}>Beispielobjekt ansehen</button></p>}
        </section>
      </div>
    </div>
  );
}
