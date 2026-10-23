import { neueEinstellungen, type AgentEinstellungen } from "@highstack/trading";
import { mandant, speicher } from "@/lib/speicher";
import { agenten, ansicht, neuerAgent, speichere } from "@/lib/trading";
import { verschluessele } from "@/lib/geheim";
import { id as neueId } from "@/lib/vorgaben";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = await speicher(req); return Response.json((await agenten(s, mandant(req))).map(ansicht).sort((a, b) => b.geaendert - a.geaendert));
}
export async function POST(req: Request) {
  const s = await speicher(req); const t = mandant(req);
  const b = (await req.json().catch(() => ({}))) as { einstellungen?: Partial<AgentEinstellungen>; zugang?: { keyId: string; secret: string } };
  const e = { ...neueEinstellungen(b.einstellungen?.startkapital ?? 500), ...(b.einstellungen ?? {}) } as AgentEinstellungen;
  if (e.broker === "manuell") e.modus = "vorschlag";
  const a = neuerAgent(neueId(), t, e);
  if (b.zugang?.keyId && b.zugang.secret) a.zugang = { keyId: b.zugang.keyId.trim(), secret: await verschluessele(b.zugang.secret.trim()) };
  a.zustand.log.unshift({ zeit: new Date().toISOString(), art: "info", text: "Agent angelegt" });
  await speichere(s, a); return Response.json(ansicht(a));
}
