import { mandant, speicher } from "@/lib/speicher";
import { faktenFuer, type Marktbericht } from "@/lib/marktwissen";
export const dynamic = "force-dynamic";

/** Marktlage zum Objekt: freigegebene Fakten passend zu Ort und Objektart, mit Quelle */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const s = await speicher(req); const o = await s.objekt(mandant(req), params.id); if (!o) return Response.json({ fehler: "Nicht gefunden" }, { status: 404 });
  const berichte = (await s.global<Marktbericht>("marktbericht")).filter(b => b.status === "geprueft");
  const fakten = faktenFuer(berichte, o.objekt, 8);
  const quellen = [...new Set(fakten.map(f => f.berichtId))].map(id => berichte.find(b => b.id === id)!).map(b => ({ id: b.id, titel: `${b.herausgeber} ${b.titel}`, stand: b.stand, url: b.quelleUrl, kernaussagen: b.kernaussagen.slice(0, 3) }));
  return Response.json({ fakten, quellen });
}
