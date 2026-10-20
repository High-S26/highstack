/**
 * Anmeldung per E-Mail-Link. Läuft in Middleware (Edge) und Node: nur Web Crypto.
 * Ohne AUTH_SECRET ist die Anmeldung aus (lokale Entwicklung, ein Mandant „lokal“).
 */
export const SITZUNG_COOKIE = "hs_sitzung";
export const MANDANT_HEADER = "x-hs-mandant";
export const NUTZER_HEADER = "x-hs-nutzer";
export const ROLLE_HEADER = "x-hs-rolle";
export const SITZUNG_TAGE = 30;
export const LINK_MINUTEN = 20;

export type Rolle = "inhaber" | "mitglied";
export interface Sitzung { e: string; t: string; r: Rolle; exp: number; k: "sitzung" }
export interface Linktoken { e: string; exp: number; k: "login"; n: string }

export const authAktiv = () => !!process.env.AUTH_SECRET;
const enc = new TextEncoder();
const b64 = (b: ArrayBuffer | Uint8Array) => { const u = b instanceof Uint8Array ? b : new Uint8Array(b); let s = ""; u.forEach(x => { s += String.fromCharCode(x); }); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const unb64 = (s: string) => { const t = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)); return Uint8Array.from(t, c => c.charCodeAt(0)); };
async function schluessel(secret: string) { return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]); }

export async function signiere(daten: object, secret = process.env.AUTH_SECRET!): Promise<string> {
  const teil = b64(enc.encode(JSON.stringify(daten)));
  const sig = await crypto.subtle.sign("HMAC", await schluessel(secret), enc.encode(teil));
  return `${teil}.${b64(sig)}`;
}
export async function pruefe<T extends { exp: number; k: string }>(token: string | undefined | null, art: T["k"], secret = process.env.AUTH_SECRET): Promise<T | null> {
  if (!token || !secret) return null;
  const [teil, sig] = token.split("."); if (!teil || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await schluessel(secret), unb64(sig), enc.encode(teil));
    if (!ok) return null;
    const d = JSON.parse(new TextDecoder().decode(unb64(teil))) as T;
    return d.k === art && d.exp > Date.now() ? d : null;
  } catch { return null; }
}
export const normiere = (e: string) => e.trim().toLowerCase();
export const gueltigeMail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
