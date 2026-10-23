import { authAktiv, MANDANT_HEADER, NUTZER_HEADER } from "./auth";
import type { Speicher } from "./speicher";

/**
 * Plattform-Admin: ohne Anmeldung (lokal) jeder; sonst ADMIN_EMAIL oder Nutzer mit plattformAdmin.
 * Admins pflegen Datenbasis und Marktwissen und sehen Konten mit Kennzahlen, nicht deren Objekte und Unterlagen.
 */
export async function istAdmin(req: Request, s: Speicher): Promise<boolean> {
  if (!authAktiv()) return true;
  const email = req.headers.get(NUTZER_HEADER)?.toLowerCase().trim(); if (!email) return false;
  if (email === (process.env.ADMIN_EMAIL ?? "").toLowerCase().trim()) return true;
  const n = await s.nutzer(email); return !!n?.plattformAdmin && !n.gesperrt;
}
export const werIst = (req: Request) => req.headers.get(NUTZER_HEADER) ?? "lokal";
export const keinAdmin = () => Response.json({ fehler: "Nur für Plattform-Admins." }, { status: 403 });

export interface Protokolleintrag { id: string; am: number; wer: string; was: string; ziel?: string; details?: string }
/** Änderungsprotokoll: wer hat wann was an Datenbasis, Konten oder Einstellungen geändert */
export async function protokolliere(s: Speicher, req: Request, was: string, ziel?: string, details?: string) {
  const e: Protokolleintrag = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, am: Date.now(), wer: werIst(req), was, ziel, details };
  try { await s.speichereGlobal("protokoll", e.id, e); } catch { /* Protokoll darf nichts blockieren */ }
}

export interface Verbrauchsmonat { id: string; tenant: string; monat: string; aufrufe: number; inputTokens: number; outputTokens: number; laeufe: Record<string, number> }
/** KI-Verbrauch je Konto und Monat aufsummieren */
export async function bucheVerbrauch(s: Speicher, req: Request | string, art: string, v: { aufrufe: number; inputTokens: number; outputTokens: number }) {
  if (!v.aufrufe) return;
  try {
    const tenant = typeof req === "string" ? req : req.headers.get(MANDANT_HEADER) ?? process.env.HIGHSTACK_TENANT ?? "lokal";
    const monat = new Date().toISOString().slice(0, 7); const id = `${tenant}:${monat}`;
    const alt = (await s.globalEins<Verbrauchsmonat>("verbrauch", id)) ?? { id, tenant, monat, aufrufe: 0, inputTokens: 0, outputTokens: 0, laeufe: {} };
    await s.speichereGlobal("verbrauch", id, { ...alt, aufrufe: alt.aufrufe + v.aufrufe, inputTokens: alt.inputTokens + v.inputTokens, outputTokens: alt.outputTokens + v.outputTokens, laeufe: { ...alt.laeufe, [art]: (alt.laeufe[art] ?? 0) + 1 } });
  } catch { /* Zählung darf nichts blockieren */ }
}

export interface Einstellungen { ankuendigung?: { text: string; art: "info" | "warn"; aktiv: boolean; am: number }; preisInputMio?: number; preisOutputMio?: number }
export const einstellungen = async (s: Speicher) => (await s.globalEins<Einstellungen>("einstellungen", "plattform")) ?? {};
