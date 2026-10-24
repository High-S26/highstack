import { kontextFuer } from "@/lib/kontext";
import { mandant, speicher } from "@/lib/speicher";
import { agent } from "@/lib/trading";
export const dynamic = "force-dynamic";

/** Nachrichten, Insidergeschäfte und Short-Anteil zu den Werten des Agenten */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const s = await speicher(req); const a = await agent(s, mandant(req), params.id); if (!a) return Response.json({ fehler: "Nicht gefunden" }, { status: 404 });
  if (a.einstellungen.broker === "simulation") return Response.json({ simulation: true });
  return Response.json(await kontextFuer(a));
}
