"use client";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { Suchauftrag } from "@/lib/typen";
import { neueSuche } from "@/lib/vorgaben";
import { useApp } from "./App";

export const ASSETS = ["ETW", "MFH", "EFH/ZFH", "Gewerbe"] as const;

/** Suchaufträge anlegen, ändern und löschen (mit Rückgängig, Treffer werden mitgelöscht). */
export function useSuchen() {
  const { profil, setzeProfil, objekte, setzeObjekt, entferneObjekt, meldungMitAktion } = useApp();
  const router = useRouter();
  const suchen = profil?.suchen ?? [];
  const treffer = useCallback((id: string) => objekte.filter(o => o.status === "kandidat" && o.suchId === id), [objekte]);
  const neu = () => { const s = neueSuche(profil!); setzeProfil({ ...profil!, suchen: [s, ...suchen] }); router.push(`/suchen/${s.id}`); };
  const aendere = (id: string, patch: Partial<Suchauftrag>) => setzeProfil({ ...profil!, suchen: suchen.map(s => s.id === id ? { ...s, ...patch } : s) });
  const loesche = (id: string, danach?: () => void) => {
    const s = suchen.find(x => x.id === id); if (!s) return;
    const weg = treffer(id); const vorher = profil!;
    setzeProfil({ ...vorher, suchen: suchen.filter(x => x.id !== id) }); weg.forEach(o => entferneObjekt(o.id)); danach?.();
    meldungMitAktion(`Suchauftrag „${s.name}“${weg.length ? ` und ${weg.length} Treffer` : ""} gelöscht`, "Rückgängig",
      () => { setzeProfil(vorher); weg.forEach(setzeObjekt); },
      () => { for (const o of weg) fetch(`/api/objekte/${o.id}`, { method: "DELETE", keepalive: true }); });
  };
  return { suchen, treffer, neu, aendere, loesche };
}
