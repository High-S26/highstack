"use client";
import { useEffect, useState } from "react";

type Thema = "system" | "hell" | "dunkel";
const SCHLUESSEL = "hs_thema";
const anwenden = (t: Thema) => { const r = document.documentElement; if (t === "system") r.removeAttribute("data-theme"); else r.setAttribute("data-theme", t === "hell" ? "light" : "dark"); };
const ICON: Record<Thema, string> = {
  hell: "M10 6.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4",
  dunkel: "M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8",
  system: "M3 4.5h14v9H3zM7 17h6M10 13.5V17",
};
const LABEL: Record<Thema, string> = { system: "wie Gerät", hell: "hell", dunkel: "dunkel" };

/** Hell, Dunkel oder wie das Gerät. Gemerkt pro Browser. */
export function Themaschalter() {
  const [t, setT] = useState<Thema>("system");
  useEffect(() => { try { const x = localStorage.getItem(SCHLUESSEL) as Thema | null; if (x === "hell" || x === "dunkel") setT(x); } catch { /* ohne Speicher */ } }, []);
  const waehle = (x: Thema) => { setT(x); anwenden(x); try { if (x === "system") localStorage.removeItem(SCHLUESSEL); else localStorage.setItem(SCHLUESSEL, x); } catch { /* ohne Speicher */ } };
  return (
    <div className="thema" role="radiogroup" aria-label="Darstellung">
      {(["hell", "dunkel", "system"] as Thema[]).map(x => (
        <button key={x} type="button" role="radio" aria-checked={t === x} title={`Darstellung: ${LABEL[x]}`} aria-label={`Darstellung ${LABEL[x]}`} onClick={() => waehle(x)}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICON[x]} /></svg>
        </button>
      ))}
    </div>
  );
}

/** Läuft vor dem ersten Zeichnen, damit nichts aufblitzt */
export const THEMA_SKRIPT = `try{var t=localStorage.getItem("${SCHLUESSEL}");if(t==="hell")document.documentElement.setAttribute("data-theme","light");else if(t==="dunkel")document.documentElement.setAttribute("data-theme","dark")}catch(e){}`;
