"use client";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { Suchauftrag } from "@/lib/typen";
import { useApp } from "./App";

export const ASSETS = ["ETW", "MFH", "EFH/ZFH", "Gewerbe", "Grundstück", "Ferienimmobilie"] as const;
/** Vorschläge für Ferien- und Inselregionen; Ausland ist vorbereitet, Steuern und Recht vor Ort sind dort noch nicht abgebildet. */
export const URLAUBSREGIONEN: { gruppe: string; regionen: string[] }[] = [
  { gruppe: "Nordsee-Inseln", regionen: ["Sylt", "Föhr", "Amrum", "Norderney", "Borkum", "Juist", "Langeoog", "Spiekeroog"] },
  { gruppe: "Ostsee", regionen: ["Usedom", "Rügen", "Fehmarn", "Timmendorfer Strand", "Fischland-Darß-Zingst"] },
  { gruppe: "Berge & Seen", regionen: ["Allgäu", "Garmisch-Partenkirchen", "Berchtesgadener Land", "Bodensee", "Chiemsee", "Schwarzwald"] },
  { gruppe: "Ausland (vorbereitet)", regionen: ["Mallorca", "Ibiza", "Kanaren", "Algarve", "Côte d’Azur", "Gardasee", "Kroatische Küste"] },
];

/** Suchaufträge anlegen, ändern und löschen (mit Rückgängig, Treffer werden mitgelöscht). */
export function useSuchen() {
  const { profil, setzeProfil, objekte, setzeObjekt, entferneObjekt, meldungMitAktion, frage } = useApp();
  const router = useRouter();
  const suchen = profil?.suchen ?? [];
  const treffer = useCallback((id: string) => objekte.filter(o => o.status === "kandidat" && o.suchId === id), [objekte]);
  const neu = () => router.push("/suchen/neu");
  const aendere = (id: string, patch: Partial<Suchauftrag>) => setzeProfil({ ...profil!, suchen: suchen.map(s => s.id === id ? { ...s, ...patch } : s) });
  const loesche = async (id: string, danach?: () => void) => {
    const s = suchen.find(x => x.id === id); if (!s) return;
    const weg = treffer(id); const vorher = profil!;
    if (!await frage({ titel: "Suchauftrag löschen?", text: `„${s.name}“${weg.length ? ` und seine ${weg.length} Treffer werden` : " wird"} gelöscht. Objekte, die schon in Prüfung sind, bleiben.`, ja: "Löschen", gefahr: true })) return;
    setzeProfil({ ...vorher, suchen: suchen.filter(x => x.id !== id) }); weg.forEach(o => entferneObjekt(o.id)); danach?.();
    meldungMitAktion(`Suchauftrag „${s.name}“${weg.length ? ` und ${weg.length} Treffer` : ""} gelöscht`, "Rückgängig",
      () => { setzeProfil(vorher); weg.forEach(setzeObjekt); },
      () => { for (const o of weg) fetch(`/api/objekte/${o.id}`, { method: "DELETE", keepalive: true }); });
  };
  return { suchen, treffer, neu, aendere, loesche };
}
