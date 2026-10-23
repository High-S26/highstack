import type { Speicher } from "./speicher";

/**
 * Nachfrage nach Daten, die in der Datenbasis fehlen. Entsteht automatisch (z. B. „Ermitteln“ in einer
 * Stadt ohne Mietspiegel); Nutzer müssen nichts tun. Admins sehen die Liste nach Häufigkeit.
 */
export interface Anfrage { id: string; art: "mietspiegel" | "marktbericht"; ziel: string; anzahl: number; konten: string[]; erste: number; letzte: number; erledigt?: number }
const schluessel = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export async function vermerkeAnfrage(s: Speicher, art: Anfrage["art"], ziel: string, tenant: string) {
  const z = ziel.trim(); if (z.length < 3) return;
  try {
    const id = `${art}:${schluessel(z)}`; const alt = await s.globalEins<Anfrage>("anfrage", id);
    const konten = [...new Set([...(alt?.konten ?? []), tenant])].slice(-50);
    await s.speichereGlobal("anfrage", id, { id, art, ziel: alt?.ziel ?? z, anzahl: (alt?.anzahl ?? 0) + 1, konten, erste: alt?.erste ?? Date.now(), letzte: Date.now(), erledigt: undefined });
  } catch { /* darf nichts blockieren */ }
}
/** Stadt aus einer Ortsangabe wie „Düsseldorf-Bilk“ oder „40225 Düsseldorf“ */
export const stadtAus = (ort: string) => ort.replace(/\b\d{5}\b/g, "").split(/[-,/(]/)[0]!.trim();
