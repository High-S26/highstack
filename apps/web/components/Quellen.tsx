"use client";
import Link from "next/link";
import { GRUPPEN, PAKETE, paketName, QUELLEN, STATUS_TEXT, verfuegbar, type PaketId } from "@/lib/quellen";
import type { Suchauftrag } from "@/lib/typen";
import { useApp } from "./App";
import { Auswahl, Haken, Zahl } from "./Felder";

export const STANDARD_HINTERGRUND: NonNullable<Suchauftrag["hintergrund"]> = { aktiv: false, takt: "taeglich", umkreisKm: 15, quellen: ["einfuegen"] };
const TAKT: [NonNullable<Suchauftrag["hintergrund"]>["takt"], string][] = [["taeglich", "Täglich"], ["mehrmals", "3× täglich"], ["stuendlich", "Stündlich"]];
const TAKT_PAKET: Record<string, PaketId> = { taeglich: "lokal", mehrmals: "portale", stuendlich: "familyoffice" };

/** Hintergrundsuche eines Suchauftrags: was, wo, wie oft. Freigeschaltet ist, was das Paket enthält. */
export function Hintergrundsuche({ s, setze }: { s: Suchauftrag; setze: (p: Partial<Suchauftrag>) => void }) {
  const { profil } = useApp(); const paket = profil!.paket ?? "basis";
  const h = { ...STANDARD_HINTERGRUND, ...(s.hintergrund ?? {}) };
  const set = (p: Partial<typeof h>) => setze({ hintergrund: { ...h, ...p } });
  const darf = paket !== "basis";
  const umschalten = (id: string, an: boolean) => set({ quellen: an ? [...h.quellen, id] : h.quellen.filter(x => x !== id) });
  const gewaehlt = QUELLEN.filter(q => h.quellen.includes(q.id) && verfuegbar(q, paket));
  return (
    <section className="panel">
      <div className="ph"><h2>Hintergrundsuche</h2><span className={`badge ${h.aktiv && darf ? "b-on" : "b-plan"}`}>{h.aktiv && darf ? "eingeschaltet" : "aus"}</span></div>
      <p className="note">Der Suchauftrag sucht selbstständig nach Ihren Eckpfeilern und legt neue Treffer gerankt ab. Welche Quellen einbezogen werden, hängt vom Paket ab.</p>
      {!darf && <div className="upsell"><b>Im Paket Basis fügen Sie Inserate selbst ein.</b><span>Ab „Lokal“ sucht der Auftrag im Hintergrund.</span><Link className="btn sm" href="/profil#pakete">Pakete ansehen</Link></div>}
      <div className="fields" aria-disabled={!darf}>
        <Haken label="Im Hintergrund suchen" wert={h.aktiv && darf} onChange={v => darf && set({ aktiv: v })} />
        <Auswahl label="Wie oft" wert={h.takt} optionen={TAKT.map(([v, l]) => [v, PAKETE_RANG_OK(paket, TAKT_PAKET[v]!) ? l : `${l} 🔒`] as [typeof v, string])} onChange={v => PAKETE_RANG_OK(paket, TAKT_PAKET[v]!) && set({ takt: v })} />
        <Zahl label="Umkreis um die Region" einheit="km" wert={h.umkreisKm} onChange={v => set({ umkreisKm: v })} hinweis="Gilt für lokale Quellen. Leer = ganze Region." min={0} max={200} />
      </div>
      <div className="qgrid">
        {GRUPPEN.map(g => (
          <fieldset key={g} className="qgroup">
            <legend>{g}</legend>
            {QUELLEN.filter(q => q.gruppe === g).map(q => {
              const frei = verfuegbar(q, paket);
              return (
                <label key={q.id} className={`qitem${frei ? "" : " locked"}`}>
                  <input type="checkbox" disabled={!frei || q.id === "einfuegen"} checked={frei && h.quellen.includes(q.id)} onChange={e => umschalten(q.id, e.target.checked)} />
                  <span className="qn">{q.name}{q.lokal && h.umkreisKm ? <em> · {h.umkreisKm} km</em> : null}</span>
                  <span className="qz">{q.zugang}</span>
                  <span className={`badge ${frei ? (q.status === "aktiv" ? "b-on" : "b-tier") : "b-plan"}`}>{frei ? STATUS_TEXT[q.status] : `ab ${paketName(q.paket)}`}</span>
                </label>
              );
            })}
          </fieldset>
        ))}
      </div>
      <p className="note">{gewaehlt.length} Quellen gewählt. „Vorbereitet“ heißt: im Suchauftrag einstellbar, der automatische Abruf wird gerade angebunden. Bis dahin leiten Sie Suchagent-Mails weiter oder fügen Inserate ein.</p>
    </section>
  );
}
const PAKETE_RANG_OK = (hat: PaketId, braucht: PaketId) => PAKETE.findIndex(p => p.id === hat) >= PAKETE.findIndex(p => p.id === braucht);

/** Alle Quellen auf einen Blick, gruppiert, mit Paket */
export function Quellenuebersicht() {
  const { profil } = useApp(); const paket = profil!.paket ?? "basis";
  return (
    <section className="panel">
      <div className="ph"><h2>Quellen</h2><Link className="btn ghost sm" href="/profil#pakete">Ihr Paket: {paketName(paket)}</Link></div>
      <div className="qsum">{GRUPPEN.map(g => { const l = QUELLEN.filter(q => q.gruppe === g); const frei = l.filter(q => verfuegbar(q, paket)).length; return (
        <div key={g} className={frei ? "" : "off"}><b>{g}</b><span>{l.map(q => q.name).join(", ")}</span><em>{frei ? `${frei} von ${l.length} in Ihrem Paket` : `ab ${paketName(l[0]!.paket)}`}</em></div>
      ); })}</div>
    </section>
  );
}

/** Paketvergleich; bis die Abrechnung aktiv ist, lässt sich ein Paket zum Ausprobieren wählen. */
export function Paketvergleich() {
  const { profil, setzeProfil } = useApp(); const paket = profil!.paket ?? "basis";
  return (
    <section className="panel" id="pakete">
      <div className="ph"><h2>Pakete</h2><span className="tag">Abrechnung noch nicht aktiv, zum Ausprobieren frei wählbar</span></div>
      <div className="pakete">{PAKETE.map(p => (
        <article key={p.id} className={`paket${p.id === paket ? " on" : ""}`}>
          <div className="pk-h"><b>{p.name}</b><span>{p.fuer}</span></div>
          <ul>{p.umfang.map(u => <li key={u}>{u}</li>)}</ul>
          <div className="pk-q">{QUELLEN.filter(q => q.paket === p.id).map(q => q.name).join(", ")}</div>
          <div className="pk-f"><span className="note">{p.preis}</span>{p.id === paket ? <span className="badge b-on">Gewählt</span> : <button type="button" className="btn sm ghost" onClick={() => setzeProfil({ ...profil!, paket: p.id })}>Wählen</button>}</div>
        </article>
      ))}</div>
    </section>
  );
}
