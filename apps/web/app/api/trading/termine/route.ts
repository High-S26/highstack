import { usUhr } from "@highstack/trading";
import { terminlageFuer } from "@/lib/konjunktur";
import { speicher } from "@/lib/speicher";
export const dynamic = "force-dynamic";

/** Wirtschaftskalender für einen Handelstag: Pausen, Regeln je Wert und Ideen (?datum=JJJJ-MM-TT&symbole=AAPL,MSFT) */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const datum = /^\d{4}-\d{2}-\d{2}$/.test(q.get("datum") ?? "") ? q.get("datum")! : usUhr(new Date()).datum;
  const symbole = (q.get("symbole") ?? "").split(",").map(x => x.trim().toUpperCase()).filter(x => /^[A-Z]{1,5}(\.[A-Z])?$/.test(x)).slice(0, 50);
  return Response.json(await terminlageFuer(await speicher(req), datum, symbole));
}
