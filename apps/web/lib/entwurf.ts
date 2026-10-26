"use client";
import { useEffect, useRef } from "react";

/**
 * Entwurf eines Assistenten über ein Neuladen retten (sessionStorage, nur dieser Tab).
 * Beim Verlassen des Assistenten (Abbrechen, Anlegen, anderer Link) wird der Entwurf verworfen;
 * beim Neuladen der Seite bleibt er erhalten. Geheimnisse (Schlüssel, Passwörter) nie übergeben.
 */
export function useEntwurf<T>(schluessel: string, daten: T, wiederherstellen: (d: T) => void) {
  const k = `hs_entwurf_${schluessel}`; const bereit = useRef(false); const zurueck = useRef(wiederherstellen); zurueck.current = wiederherstellen;
  useEffect(() => {
    try { const r = sessionStorage.getItem(k); if (r) zurueck.current(JSON.parse(r) as T); } catch { /* ohne Speicher */ }
    bereit.current = true;
    // Verlassen innerhalb der App (kein Neuladen): Entwurf verwerfen
    return () => { try { sessionStorage.removeItem(k); } catch { /* ohne Speicher */ } };
  }, [k]);
  const json = JSON.stringify(daten);
  useEffect(() => { if (!bereit.current) return; try { sessionStorage.setItem(k, json); } catch { /* ohne Speicher */ } }, [k, json]);
}
