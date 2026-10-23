import { umfeld } from "@/lib/konjunktur";
import { speicher } from "@/lib/speicher";
export const dynamic = "force-dynamic";

/** Marktumfeld, wie es der Agent für die Positionsgröße nutzt */
export async function GET(req: Request) { return Response.json(await umfeld(await speicher(req))); }
