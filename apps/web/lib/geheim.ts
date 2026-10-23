import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import { join } from "node:path";

/**
 * Zugangsdaten (z. B. Broker-Schlüssel) verschlüsselt ablegen: AES-256-GCM, Schlüssel aus TRADING_SECRET
 * oder AUTH_SECRET; lokal ohne beides ein zufälliger Schlüssel in .data/schluessel.
 */
let schluessel: Buffer | null = null;
async function hole(): Promise<Buffer> {
  if (schluessel) return schluessel;
  const quelle = process.env.TRADING_SECRET || process.env.AUTH_SECRET;
  if (quelle) return (schluessel = createHash("sha256").update(`highstack-trading:${quelle}`).digest());
  const datei = join(process.cwd(), ".data", "schluessel");
  try { schluessel = Buffer.from((await fs.readFile(datei, "utf8")).trim(), "hex"); }
  catch { schluessel = randomBytes(32); await fs.mkdir(join(process.cwd(), ".data"), { recursive: true }); await fs.writeFile(datei, schluessel.toString("hex"), { mode: 0o600 }); }
  return schluessel;
}
export async function verschluessele(text: string): Promise<string> {
  const iv = randomBytes(12); const c = createCipheriv("aes-256-gcm", await hole(), iv);
  const enc = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map(b => b.toString("base64")).join(".");
}
export async function entschluessele(paket: string): Promise<string> {
  const [iv, tag, enc] = paket.split(".").map(x => Buffer.from(x, "base64"));
  const d = createDecipheriv("aes-256-gcm", await hole(), iv!); d.setAuthTag(tag!);
  return Buffer.concat([d.update(enc!), d.final()]).toString("utf8");
}
