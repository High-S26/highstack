import { lookup } from "node:dns/promises";
import { request as http } from "node:http";
import { request as https } from "node:https";
import { isIP } from "node:net";

/**
 * Öffentliche Seite abrufen, ohne interne Ziele zu erreichen (SSRF-Schutz):
 * - jede Adresse wird aufgelöst und gegen private, lokale und reservierte Bereiche geprüft,
 * - die Verbindung geht genau an die geprüfte IP (kein DNS-Rebinding zwischen Prüfung und Abruf),
 * - Weiterleitungen werden einzeln verfolgt und jedes Ziel erneut geprüft (höchstens 5).
 */
export function istIntern(ip: string): boolean {
  let a = ip.toLowerCase();
  const gemappt = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/); if (gemappt) a = gemappt[1]!;
  if (isIP(a) === 4) {
    const [p, q] = a.split(".").map(Number) as [number, number];
    return p === 0 || p === 10 || p === 127 || p >= 224 || (p === 100 && q >= 64 && q <= 127) || (p === 169 && q === 254) || (p === 172 && q >= 16 && q <= 31) || (p === 192 && q === 168) || (p === 192 && q === 0) || (p === 198 && (q === 18 || q === 19));
  }
  return a === "::" || a === "::1" || /^(fc|fd|fe[89ab]|ff)/.test(a) || a.startsWith("::ffff:") || a.startsWith("64:ff9b:");
}

export class Gesperrt extends Error {}

async function pruefeZiel(url: URL): Promise<{ ip: string; family: 4 | 6 }> {
  if (!/^https?:$/.test(url.protocol)) throw new Gesperrt("Nur Links mit http oder https.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) throw new Gesperrt("Diese Adresse ist nicht erreichbar.");
  const ips = isIP(host) ? [{ address: host, family: isIP(host) as 4 | 6 }] : await lookup(host, { all: true }).catch(() => []);
  if (!ips.length || ips.some(x => istIntern(x.address))) throw new Gesperrt("Diese Adresse ist nicht erreichbar.");
  return { ip: ips[0]!.address, family: ips[0]!.family as 4 | 6 };
}

export interface Antwort { status: number; typ: string; inhalt: Uint8Array; url: string }

export async function holeSicher(roh: string, opts: { maxBytes?: number; timeoutMs?: number; kopf?: Record<string, string> } = {}): Promise<Antwort> {
  const max = opts.maxBytes ?? 3_000_000; const ende = Date.now() + (opts.timeoutMs ?? 12_000);
  let url = new URL(roh);
  for (let sprung = 0; sprung <= 5; sprung++) {
    const ziel = await pruefeZiel(url);
    const r = await new Promise<{ status: number; headers: Record<string, string | string[] | undefined>; inhalt: Uint8Array }>((ok, fehler) => {
      const req = (url.protocol === "https:" ? https : http)(url, {
        method: "GET", headers: opts.kopf, timeout: Math.max(1000, ende - Date.now()),
        // genau die geprüfte Adresse verwenden
        lookup: (_h: string, o: { all?: boolean }, cb: (e: Error | null, a: string | { address: string; family: number }[], f?: number) => void) => o?.all ? cb(null, [{ address: ziel.ip, family: ziel.family }]) : cb(null, ziel.ip, ziel.family),
      }, res => {
        const teile: Buffer[] = []; let n = 0;
        res.on("data", (c: Buffer) => { n += c.length; if (n <= max) teile.push(c); else res.destroy(); });
        res.on("end", () => ok({ status: res.statusCode ?? 0, headers: res.headers, inhalt: new Uint8Array(Buffer.concat(teile)) }));
        res.on("close", () => ok({ status: res.statusCode ?? 0, headers: res.headers, inhalt: new Uint8Array(Buffer.concat(teile)) }));
        res.on("error", fehler); res.on("aborted", () => fehler(new Error("Zeitüberschreitung")));
      });
      req.on("timeout", () => req.destroy(new Error("Zeitüberschreitung"))); req.on("error", fehler);
      // Gesamtzeitlimit: auch wenn die Seite Byte für Byte tröpfelt, wird nach Ablauf abgebrochen (INV-036)
      const uhr = setTimeout(() => req.destroy(new Error("Zeitüberschreitung")), Math.max(1, ende - Date.now()));
      req.on("close", () => clearTimeout(uhr)); req.end();
    });
    const loc = r.headers.location;
    if (r.status >= 300 && r.status < 400 && typeof loc === "string") { url = new URL(loc, url); continue; }
    return { status: r.status, typ: String(r.headers["content-type"] ?? ""), inhalt: r.inhalt, url: url.toString() };
  }
  throw new Gesperrt("Zu viele Weiterleitungen.");
}
