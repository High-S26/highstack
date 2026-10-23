import { speicher } from "@/lib/speicher";
import { istAdmin, keinAdmin, protokolliere } from "@/lib/admin";
import type { Marktbericht } from "@/lib/marktwissen";
import { id as neueId } from "@/lib/vorgaben";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = await speicher(req); if (!await istAdmin(req, s)) return keinAdmin();
  return Response.json((await s.global<Marktbericht>("marktbericht")).sort((a, b) => (b.datum ?? "").localeCompare(a.datum ?? "")));
}

/** Anlegen oder importieren (JSON eines Berichts); landet immer als Entwurf */
export async function POST(req: Request) {
  const s = await speicher(req); if (!await istAdmin(req, s)) return keinAdmin();
  const b = (await req.json().catch(() => ({}))) as Partial<Marktbericht>;
  const m: Marktbericht = { titel: "", herausgeber: "", stand: "", datum: null, quelleUrl: "", lizenz: "", kernaussagen: [], fakten: [], ...b, id: neueId(), status: "entwurf", herkunft: b.fakten?.length ? "import" : "manuell", erfasst: Date.now(), geaendert: Date.now() };
  m.fakten = m.fakten.map(f => ({ ...f, id: f.id || neueId() }));
  await s.speichereGlobal("marktbericht", m.id, m); await protokolliere(s, req, m.herkunft === "import" ? "Marktbericht importiert" : "Marktbericht angelegt", `${m.herausgeber} ${m.titel}`, `${m.fakten.length} Fakten`);
  return Response.json(m);
}
