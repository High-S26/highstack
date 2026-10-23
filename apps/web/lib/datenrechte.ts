import { NUTZER_HEADER, authAktiv } from "./auth";

/**
 * Wer die gemeinsame Datenbasis (Mietspiegel) pflegen darf: ohne Anmeldung (lokal) jeder,
 * sonst die Adressen aus ADMIN_EMAIL und DATEN_EMAILS (kommagetrennt). Lesen dürfen alle.
 */
export function darfDatenPflegen(req: Request): boolean {
  if (!authAktiv()) return true;
  const email = req.headers.get(NUTZER_HEADER)?.toLowerCase().trim(); if (!email) return false;
  const erlaubt = [process.env.ADMIN_EMAIL, ...(process.env.DATEN_EMAILS ?? "").split(",")].map(x => x?.toLowerCase().trim()).filter(Boolean);
  return erlaubt.includes(email);
}
export const nutzerVon = (req: Request) => req.headers.get(NUTZER_HEADER) ?? "lokal";
