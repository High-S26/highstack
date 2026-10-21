import type { Speicher } from "./speicher";
export const LOESCH_FRIST_TAGE = 7;
/** Fällige Löschung ausführen. Liefert true, wenn der Mandant gelöscht wurde. */
export async function faelligeLoeschung(s: Speicher, t: string): Promise<boolean> {
  const p = await s.profil(t);
  if (p.loeschung && p.loeschung.ausfuehrung <= Date.now()) { await s.loescheMandant(t); return true; }
  return false;
}
