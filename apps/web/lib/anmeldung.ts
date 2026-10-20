import { randomUUID } from "node:crypto";
import { LINK_MINUTEN, signiere, type Linktoken } from "./auth";
import { sendeLink } from "./mail";

/** Basis-URL für Links: APP_URL, sonst aus der Anfrage */
export const basisUrl = (req: Request) => process.env.APP_URL?.replace(/\/$/, "") || new URL(req.url).origin;

/** Einfache Bremse gegen Massenanfragen (Einzelserver) */
const versuche = new Map<string, number[]>();
export function gebremst(schluessel: string, max = 5, fensterMin = 15) {
  const jetzt = Date.now(); const l = (versuche.get(schluessel) ?? []).filter(t => jetzt - t < fensterMin * 60000);
  l.push(jetzt); versuche.set(schluessel, l); return l.length > max;
}
/** Jeder Link gilt nur einmal (Einzelserver; nach Neustart verfallen sie ohnehin nach 20 Minuten) */
const benutzt = new Set<string>();
export const einmalig = (n: string) => { if (benutzt.has(n)) return false; benutzt.add(n); return true; };

export async function verschickeLink(req: Request, email: string, art: "login" | "einladung", von?: string) {
  const token = await signiere({ e: email, exp: Date.now() + LINK_MINUTEN * 60000, k: "login", n: randomUUID() } satisfies Linktoken);
  const link = `${basisUrl(req)}/api/auth/bestaetigen?token=${encodeURIComponent(token)}`;
  const r = await sendeLink(email, link, art, von);
  return { ...r, link };
}
