import { experte, fuehreAus } from "@highstack/agents";
import { ereignisstrom, laufoptionen } from "@/lib/agenten";
import { mandant, speicher } from "@/lib/speicher";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { experte: expId } = (await req.json()) as { experte: string };
  try { experte(expId); } catch { return Response.json({ fehler: "Unbekannter Experte" }, { status: 400 }); }
  const s = await speicher(); const t = mandant(req);
  const o = await s.objekt(t, params.id); if (!o) return Response.json({ fehler: "Nicht gefunden" }, { status: 404 });
  const p = await s.profil(t);
  return ereignisstrom(async (senden, signal) => {
    const opts = laufoptionen(p, o, signal);
    const zusatz = expId === "vermoegen" ? { portfolio: (await s.objekte(t)).filter(x => x.status === "bestand" && x.id !== o.id).map(x => ({ titel: x.objekt.titel, ort: x.objekt.ort, kaufpreis: x.objekt.kaufpreis })) } : undefined;
    const r = await fuehreAus(expId, { ...opts, zusatz, onEreignis: senden });
    const frisch = (await s.objekt(t, params.id)) ?? o;
    frisch.experten[expId] = { ergebnis: r.ergebnis, schritte: r.schritte, am: Date.now(), verlauf: [] };
    frisch.geaendert = Date.now();
    await s.speichereObjekt(t, frisch);
  }, req);
}
