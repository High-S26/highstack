import { dateiKopf } from "@/lib/dateityp";
import { mandant, speicher } from "@/lib/speicher";
export const dynamic = "force-dynamic";
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const d = await (await speicher(req)).datei(mandant(req), params.id);
  if (!d) return new Response("Nicht gefunden", { status: 404 });
  const inhalt = new Uint8Array(d.inhalt);
  return new Response(Buffer.from(inhalt), { headers: dateiKopf(inhalt, d.name) });
}
