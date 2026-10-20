import { mandant, speicher } from "@/lib/speicher";
export const dynamic = "force-dynamic";
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const d = await (await speicher()).datei(mandant(req), params.id);
  if (!d) return new Response("Nicht gefunden", { status: 404 });
  return new Response(Buffer.from(d.inhalt), { headers: { "content-type": d.mime, "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(d.name)}` } });
}
