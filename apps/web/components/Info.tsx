"use client";
import { useEffect, useId, useRef, useState } from "react";

/** Info-Symbol: Klick oder Tastatur öffnet eine kurze Erklärung, Escape oder Klick daneben schließt. */
export function Info({ text, label }: { text: string; label?: string }) {
  const [offen, setOffen] = useState(false); const id = useId(); const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!offen) return;
    const zu = (e: MouseEvent | KeyboardEvent) => { if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOffen(false); };
    document.addEventListener("mousedown", zu); document.addEventListener("keydown", zu);
    return () => { document.removeEventListener("mousedown", zu); document.removeEventListener("keydown", zu); };
  }, [offen]);
  return (
    <span className="info" ref={ref}>
      <button type="button" className="info-b" aria-label={`Erklärung${label ? `: ${label}` : ""}`} aria-expanded={offen} aria-controls={id} onClick={e => { e.preventDefault(); e.stopPropagation(); setOffen(o => !o); }}>i</button>
      {offen && <span id={id} role="note" className="info-p">{text}</span>}
    </span>
  );
}
