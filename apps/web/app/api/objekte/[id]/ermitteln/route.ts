import { ausUmgebung, fuehreAus, type Marktwerte } from "@highstack/agents";
import { mandant, speicher } from "@/lib/speicher";
import { orientierung } from "@/lib/marktwerte";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Vergleichswerte für ein Objekt ermitteln: mit API-Key per Markt-Analyst, sonst grobe Orientierung. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const s = await speicher(req); const t = mandant(req);
  const o = await s.objekt(t, params.id); if (!o) return Response.json({ fehler: "Nicht gefunden" }, { status: 404 });
  if (!o.objekt.ort?.trim() && !o.objekt.titel?.trim()) return Response.json({ fehler: "Bitte zuerst Ort oder Stadtteil eintragen." }, { status: 400 });
  const { client, modelle, testmodus } = ausUmgebung();
  if (testmodus) return Response.json({ ...orientierung(o.objekt), quelle: "orientierung" });
  try {
    const p = await s.profil(t); const ap = p.anlageprofile.find(a => a.id === o.anlageprofilId) ?? p.anlageprofile[0]!;
    const r = await fuehreAus<Marktwerte>("marktwerte", { client, modelle, eingabe: { investor: p.investor, anlageprofil: ap, objekt: o.objekt }, signal: req.signal, maxRunden: 2 },
      `Schätze die Vergleichswerte für dieses Objekt: ${o.objekt.titel}, ${o.objekt.ort}, ${o.objekt.asset}, ${o.objekt.wohnflaeche ?? "?"} m², Baujahr ${o.objekt.baujahr ?? "?"}, Energieklasse ${o.objekt.energieklasse ?? "?"}.`);
    return Response.json({ ...r.ergebnis, quelle: "ki" });
  } catch { return Response.json({ ...orientierung(o.objekt), quelle: "orientierung" }); }
}
