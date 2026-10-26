import { thesenFuer } from "@/lib/konjunktur";
import { speicher } from "@/lib/speicher";
export const dynamic = "force-dynamic";

/** Ideen und Thesen aus Terminen und Marktdaten (?datum=JJJJ-MM-TT, Standard heute) */
export async function GET(req: Request) {
  const d = new URL(req.url).searchParams.get("datum");
  return Response.json(await thesenFuer(await speicher(req), d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined));
}
