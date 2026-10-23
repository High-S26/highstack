import { speicher } from "@/lib/speicher";
import { pruefe, type Mietspiegel } from "@/lib/mietspiegel";
import { darfDatenPflegen, nutzerVon } from "@/lib/datenrechte";
export const dynamic = "force-dynamic";

const finde = async (req: Request, id: string) => (await (await speicher(req)).mietspiegel()).find(m => m.id === id) ?? null;

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const m = await finde(req, params.id); return m ? Response.json(m) : Response.json({ fehler: "Nicht gefunden" }, { status: 404 });
}

/** Speichern; status "geprueft" nur ohne Prüffehler, jede inhaltliche Änderung setzt auf Entwurf zurück */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  if (!darfDatenPflegen(req)) return Response.json({ fehler: "Keine Berechtigung" }, { status: 403 });
  const alt = await finde(req, params.id); if (!alt) return Response.json({ fehler: "Nicht gefunden" }, { status: 404 });
  const b = (await req.json()) as Partial<Mietspiegel>;
  const neu: Mietspiegel = { ...alt, ...b, id: alt.id, erfasst: alt.erfasst, geaendert: Date.now() };
  const inhaltGeaendert = JSON.stringify([alt.merkmale, alt.felder, alt.zuschlaege, alt.stadt]) !== JSON.stringify([neu.merkmale, neu.felder, neu.zuschlaege, neu.stadt]);
  if (b.status === "geprueft") {
    const f = pruefe(neu).filter(x => !x.startsWith("Nur "));
    if (f.length) return Response.json({ fehler: `Noch nicht freigebbar: ${f.join(", ")}` }, { status: 400 });
    neu.geprueftVon = nutzerVon(req);
  } else if (inhaltGeaendert && alt.status === "geprueft") { neu.status = "entwurf"; neu.geprueftVon = undefined; }
  await (await speicher(req)).speichereMietspiegel(neu);
  return Response.json(neu);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  if (!darfDatenPflegen(req)) return Response.json({ fehler: "Keine Berechtigung" }, { status: 403 });
  await (await speicher(req)).loescheMietspiegel(params.id);
  return Response.json({ ok: true });
}
