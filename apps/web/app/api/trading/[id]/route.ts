import type { AgentEinstellungen } from "@highstack/trading";
import { mandant, speicher } from "@/lib/speicher";
import { agent, ansicht, brokerFuer, exklusiv, speichere } from "@/lib/trading";
export const dynamic = "force-dynamic";

/** Agent mit Live-Kontostand und Positionen vom Broker */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const s = await speicher(req); const a = await agent(s, mandant(req), params.id); if (!a) return Response.json({ fehler: "Nicht gefunden" }, { status: 404 });
  let konto = null, positionen: unknown[] = [], uhr = null, fehler: string | null = null;
  try { const b = await brokerFuer(a); [konto, positionen, uhr] = await Promise.all([b.konto(), b.positionen(), b.uhr()]); } catch (e) { fehler = (e as Error).message; }
  return Response.json({ ...ansicht(a), live: { konto, positionen, uhr, fehler } });
}
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const s = await speicher(req); const t = mandant(req);
  return exklusiv(params.id, async () => {
    const a = await agent(s, t, params.id); if (!a) return Response.json({ fehler: "Nicht gefunden" }, { status: 404 });
    const b = (await req.json()) as Partial<AgentEinstellungen>;
    if (b.broker && b.broker !== a.einstellungen.broker && a.zustand.aktiv) return Response.json({ fehler: "Broker nur bei angehaltenem Agenten wechseln." }, { status: 409 });
    a.einstellungen = { ...a.einstellungen, ...b }; if (a.einstellungen.broker === "manuell") a.einstellungen.modus = "vorschlag";
    a.zustand.log.unshift({ zeit: new Date().toISOString(), art: "info", text: "Einstellungen geändert" });
    await speichere(s, a); return Response.json(ansicht(a));
  });
}
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const s = await speicher(req); const a = await agent(s, mandant(req), params.id); if (!a) return Response.json({ fehler: "Nicht gefunden" }, { status: 404 });
  if (a.zustand.aktiv) return Response.json({ fehler: "Bitte den Agenten zuerst anhalten." }, { status: 409 });
  await s.loescheGlobal("trading", a.id); return Response.json({ ok: true });
}
