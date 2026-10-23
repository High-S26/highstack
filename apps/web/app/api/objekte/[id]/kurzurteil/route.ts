import { kurzurteil, neuerVerbrauch } from "@highstack/agents";
import { laufoptionen, marktwissenFuer } from "@/lib/agenten";
import { mandant, speicher } from "@/lib/speicher";
import { bucheVerbrauch } from "@/lib/admin";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Stufe 1: ein Modellaufruf auf Basis der gerechneten Zahlen. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { neu } = (await req.json().catch(() => ({}))) as { neu?: boolean };
  const s = await speicher(req); const t = mandant(req);
  const o = await s.objekt(t, params.id); if (!o) return Response.json({ fehler: "Nicht gefunden" }, { status: 404 });
  const p = await s.profil(t);
  const verbrauch = neuerVerbrauch(); const t0 = Date.now();
  try {
    const r = await kurzurteil({ ...laufoptionen(p, o, req.signal, await marktwissenFuer(s, o)), verbrauch }, neu ? undefined : o.experten.kurzurteil);
    if (!r.ausSpeicher) {
      const frisch = (await s.objekt(t, params.id)) ?? o;
      frisch.experten.kurzurteil = { ergebnis: r.ergebnis, schritte: r.schritte, am: Date.now(), verlauf: [], hash: r.hash };
      frisch.geaendert = Date.now(); await s.speichereObjekt(t, frisch);
    }
    await bucheVerbrauch(s, t, "kurzurteil", verbrauch);
    return Response.json({ ergebnis: r.ergebnis, ausSpeicher: r.ausSpeicher, verbrauch: { ...verbrauch, ms: Date.now() - t0 } });
  } catch (e) { return Response.json({ fehler: (e as Error).message }, { status: 500 }); }
}
