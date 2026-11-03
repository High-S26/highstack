import { DAX_ISIN } from "@highstack/trading";
import { berlinDatum, berlinMinute, daxStand, hochladen, KERZEN, type KerzenId } from "@/lib/dax";
import { speicher } from "@/lib/speicher";
import { darfScalable, echtgeldAn, sc, scalableAn } from "@/lib/scalable";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** DAX-Tagestrade: Signal, Rückblick, Datenstand (?eroeffnung=24123&erzwingen=1) */
export async function GET(req: Request) {
  const s = await speicher(req); const q = new URL(req.url).searchParams;
  const roh = Number((q.get("eroeffnung") ?? "").replace(/\./g, "").replace(",", "."));
  let eroeffnung: number | null = Number.isFinite(roh) && roh > 1000 && roh < 200_000 ? roh : null; let kursQuelle: string | null = eroeffnung ? "Ihre Eingabe" : null;
  const darf = await darfScalable(req, s);
  // Ab 9:00 an Werktagen: DAX-Stand live von Scalable, wenn verbunden
  const tag = new Date().getDay();
  if (!eroeffnung && darf && tag > 0 && tag < 6 && berlinMinute() >= 9 * 60) {
    try { const k = await sc().kurs(DAX_ISIN); if (k.mid && !k.veraltet) { eroeffnung = k.mid; kursQuelle = `Scalable ${k.zeit ? new Date(k.zeit).toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }) : ""}`.trim(); } } catch { /* ohne Live-Kurs weiter */ }
  }
  try {
    const st = await daxStand(s, { eroeffnung, erzwingen: q.get("erzwingen") === "1" });
    return Response.json({ ...st, kursQuelle, heute: berlinDatum(), scalable: { an: scalableAn(), darf, echtgeld: echtgeldAn() } });
  } catch (e) { return Response.json({ fehler: (e as Error).message }, { status: 500 }); }
}
/** Tageskurse als CSV hochladen: { aktion: "upload", id: "dax" | "spx" | "nikkei", csv } */
export async function POST(req: Request) {
  const s = await speicher(req); const b = await req.json().catch(() => null) as { aktion?: string; id?: string; csv?: string } | null;
  if (b?.aktion !== "upload" || !b.id || !(b.id in KERZEN) || typeof b.csv !== "string") return Response.json({ fehler: "Ungültige Anfrage" }, { status: 400 });
  if (b.csv.length > 5_000_000) return Response.json({ fehler: "Datei zu groß (höchstens 5 MB)." }, { status: 400 });
  try { const k = await hochladen(s, b.id as KerzenId, b.csv); return Response.json({ tage: k.kerzen.length, bis: k.kerzen.at(-1)?.d }); }
  catch (e) { return Response.json({ fehler: (e as Error).message }, { status: 400 }); }
}
