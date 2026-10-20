import { experte, mitSpeicher, neuerVerbrauch } from "@highstack/agents";
import { ereignisstrom, laufoptionen } from "@/lib/agenten";
import { mandant, speicher } from "@/lib/speicher";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Einzelexperte. Unveränderte Eingaben → gespeichertes Ergebnis, außer neu: true. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { experte: expId, neu } = (await req.json()) as { experte: string; neu?: boolean };
  try { experte(expId); } catch { return Response.json({ fehler: "Unbekannter Experte" }, { status: 400 }); }
  const s = await speicher(); const t = mandant(req);
  const o = await s.objekt(t, params.id); if (!o) return Response.json({ fehler: "Nicht gefunden" }, { status: 404 });
  const p = await s.profil(t);
  return ereignisstrom(async (senden, signal) => {
    const opts = laufoptionen(p, o, signal); const verbrauch = neuerVerbrauch(); const t0 = Date.now();
    const zusatz = expId === "vermoegen" ? { portfolio: (await s.objekte(t)).filter(x => x.status === "bestand" && x.id !== o.id).map(x => ({ titel: x.objekt.titel, ort: x.objekt.ort, kaufpreis: x.objekt.kaufpreis })) } : undefined;
    const r = await mitSpeicher(expId, { ...opts, zusatz, verbrauch, onEreignis: senden }, neu ? undefined : o.experten[expId]);
    if (!r.ausSpeicher) {
      const frisch = (await s.objekt(t, params.id)) ?? o;
      frisch.experten[expId] = { ergebnis: r.ergebnis, schritte: r.schritte, am: Date.now(), verlauf: [], hash: r.hash };
      frisch.geaendert = Date.now();
      await s.speichereObjekt(t, frisch);
    }
    senden({ typ: "verbrauch", ...verbrauch, ms: Date.now() - t0, ausSpeicher: r.ausSpeicher ? 1 : 0 });
  }, req);
}
