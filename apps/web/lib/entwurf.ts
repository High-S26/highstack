"use client";
import { useEffect, useRef } from "react";

const MAX_ALTER_MS = 30 * 60_000;

/**
 * Entwurf eines Assistenten über ein Neuladen retten (sessionStorage, nur dieser Tab).
 * Beim Verlassen des Assistenten (Abbrechen, Anlegen, anderer Link) wird der Entwurf verworfen;
 * beim Neuladen der Seite bleibt er erhalten. Geheimnisse (Schlüssel, Passwörter) nie übergeben.
 */
export function useEntwurf<T>(schluessel: string, daten: T, wiederherstellen: (d: T) => void) {
  const k = `hs_entwurf_${schluessel}`; const bereit = useRef(false); const zurueck = useRef(wiederherstellen); zurueck.current = wiederherstellen;
  useEffect(() => {
    // nur frische Entwürfe (Neuladen), nicht einen alten Stand beim späteren Aufruf über die Adresszeile (TRD-047)
    try { const r = sessionStorage.getItem(k); if (r) { const x = JSON.parse(r) as { am?: number; d?: T }; if (x && typeof x === "object" && "d" in x && Date.now() - (x.am ?? 0) < MAX_ALTER_MS) zurueck.current(x.d as T); else sessionStorage.removeItem(k); } } catch { /* ohne Speicher */ }
    bereit.current = true;
    // Verlassen innerhalb der App (kein Neuladen): Entwurf verwerfen
    return () => { try { sessionStorage.removeItem(k); } catch { /* ohne Speicher */ } };
  }, [k]);
  const json = JSON.stringify(daten);
  useEffect(() => { if (!bereit.current) return; try { sessionStorage.setItem(k, `{"am":${Date.now()},"d":${json}}`); } catch { /* ohne Speicher */ } }, [k, json]);
}
