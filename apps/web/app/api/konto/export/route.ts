import { mandant, speicher } from "@/lib/speicher";
export const dynamic = "force-dynamic";
/** Datenauskunft und Übertragbarkeit (Art. 15, 20 DSGVO): alle Daten des Kontos als JSON. Dateien als Liste; einzeln abrufbar. */
export async function GET(req: Request) {
  const s = await speicher(req); const t = mandant(req);
  const [profil, objekte, nutzer] = await Promise.all([s.profil(t), s.objekte(t), s.nutzerVon(t)]);
  const daten = { export: { erstellt: new Date().toISOString(), format: "highstack-export-1" }, profil, nutzer: nutzer.map(n => ({ email: n.email, rolle: n.rolle, erstellt: n.erstellt, letzterLogin: n.letzterLogin })), objekte: objekte.map(o => ({ ...o, dokumente: o.dokumente.map(d => ({ ...d, datei: d.dateiId ? `/api/dateien/${d.dateiId}` : undefined })) })) };
  return new Response(JSON.stringify(daten, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="highstack-export-${new Date().toISOString().slice(0, 10)}.json"` } });
}
