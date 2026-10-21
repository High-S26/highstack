"use client";
import { useEffect, useRef, useState } from "react";
import type { Objektdatensatz, Unterlagendatei } from "@/lib/typen";
import { istBild, mitDateien } from "@/lib/unterlagen";

export const dateiUrl = (d: Pick<Unterlagendatei, "id">, seite?: number) => `/api/dateien/${d.id}${seite ? `#page=${seite}&view=FitH` : ""}`;

/** Betrachter für Bilder und PDFs (bei PDFs direkt auf die relevante Seite) */
export function Ansicht({ datei, zu }: { datei: Unterlagendatei | null; zu: () => void }) {
  const ref = useRef<HTMLDialogElement>(null); const [seite, setSeite] = useState<number | undefined>();
  useEffect(() => { const d = ref.current; if (!d) return; if (datei) { setSeite(datei.seiten?.[0]); if (!d.open) d.showModal(); } else if (d.open) d.close(); }, [datei]);
  return (
    <dialog ref={ref} className="ansicht" onClose={zu} onClick={e => { if (e.target === ref.current) zu(); }} aria-label={datei?.name ?? "Ansicht"}>
      {datei && <>
        <div className="ansicht-kopf">
          <b>{datei.name}</b>
          {datei.seiten && datei.seiten.length > 0 && <span className="chips">{datei.seiten.map(n => <button key={n} type="button" className="chip" aria-pressed={seite === n} onClick={() => setSeite(n)}>Seite {n}</button>)}</span>}
          <a className="btn sm ghost" href={dateiUrl(datei)} target="_blank" rel="noopener">In neuem Tab</a>
          <button type="button" className="btn sm" onClick={zu} autoFocus>Schließen</button>
        </div>
        <div className="ansicht-inhalt">
          {istBild(datei.mime, datei.name) ? <img src={dateiUrl(datei)} alt={datei.name} /> : <iframe key={seite} src={dateiUrl(datei, seite)} title={datei.name} />}
        </div>
      </>}
    </dialog>
  );
}

/** Erster Grundriss eines Objekts als Vorschau (Bild direkt, PDF-Seite im Betrachter) */
export function Grundrissvorschau({ o, zuUnterlagen }: { o: Objektdatensatz; zuUnterlagen: () => void }) {
  const g = o.dokumente.map(mitDateien).find(d => d.schluessel === "grundriss")?.dateien ?? [];
  const [offen, setOffen] = useState<Unterlagendatei | null>(null);
  if (!g.length) return (
    <div className="gr-leer"><span className="note">Noch kein Grundriss. Laden Sie ein Exposé oder einen Plan hoch, Grundriss-Seiten werden erkannt.</span><button type="button" className="linkbtn" onClick={zuUnterlagen}>Hochladen</button></div>
  );
  const bild = g.find(x => istBild(x.mime, x.name)); const erst = bild ?? g[0]!;
  return (
    <div className="gr">
      <button type="button" className="gr-bild" onClick={() => setOffen(erst)} aria-label={`Grundriss ansehen: ${erst.name}`}>
        {bild ? <img src={dateiUrl(bild)} alt="" /> : <span className="gr-pdf"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M3 3h14v14H3zM3 10h6M9 3v9M13 10v7M13 13h4" /></svg><b>Grundriss ansehen</b><span className="note">{erst.aus ? `aus ${erst.name}, Seite ${erst.seiten?.join(", ")}` : erst.name}</span></span>}
      </button>
      {g.length > 1 && <span className="note">{g.length} Pläne · <button type="button" className="linkbtn" onClick={zuUnterlagen}>alle</button></span>}
      <Ansicht datei={offen} zu={() => setOffen(null)} />
    </div>
  );
}
