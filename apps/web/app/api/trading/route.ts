import { pruefeEinstellungen } from "@highstack/trading";
import { mandant, speicher } from "@/lib/speicher";
import { agenten, ansicht, erlaubteBroker, neuerAgent, speichere } from "@/lib/trading";
import { verschluessele } from "@/lib/geheim";
import { id as neueId } from "@/lib/vorgaben";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = await speicher(req); return Response.json((await agenten(s, mandant(req))).map(ansicht).sort((a, b) => b.geaendert - a.geaendert));
}

/** Anlegen: Einstellungen werden vollständig geprüft; ungültige Eingaben werden abgewiesen, nicht still ersetzt */
export async function POST(req: Request) {
  const s = await speicher(req); const t = mandant(req);
  let b: { einstellungen?: unknown; zugang?: { keyId?: unknown; secret?: unknown } };
  try { b = await req.json(); } catch { return Response.json({ fehler: "Ungültige Anfrage (kein JSON)." }, { status: 400 }); }
  if (!b || typeof b !== "object" || !b.einstellungen) return Response.json({ fehler: "Einstellungen fehlen." }, { status: 400 });
  const { e, fehler } = pruefeEinstellungen(b.einstellungen, { erlaubteBroker: erlaubteBroker() });
  if (fehler.length) return Response.json({ fehler: fehler.map(f => f.text).join(" "), felder: fehler }, { status: 400 });
  const a = neuerAgent(neueId(), t, e);
  const keyId = typeof b.zugang?.keyId === "string" ? b.zugang.keyId.trim() : ""; const secret = typeof b.zugang?.secret === "string" ? b.zugang.secret.trim() : "";
  if (keyId && secret) a.zugang = { keyId, secret: await verschluessele(secret) };
  a.zustand.log.unshift({ zeit: new Date().toISOString(), art: "info", text: "Agent angelegt" });
  await speichere(s, a); return Response.json(ansicht(a));
}
