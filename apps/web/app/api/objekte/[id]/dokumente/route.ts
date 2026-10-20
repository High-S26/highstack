import { extractText, getDocumentProxy } from "unpdf";
import { mandant, speicher } from "@/lib/speicher";
import { id as neueId, unterlagenFuer } from "@/lib/vorgaben";
import type { Dokument } from "@/lib/typen";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MUSTER: [string, RegExp][] = [["kaufvertrag", /kaufvertrag|urkunde|notar/i], ["grundbuch", /grundbuch/i], ["teilung", /teilung|aufteilung/i], ["protokolle", /protokoll|versammlung|etv/i], ["wirtschaft", /wirtschaftsplan|hausgeld|jahresabrechnung/i], ["ruecklage", /r(ü|ue)cklage/i], ["energie", /energie/i], ["mieter", /mieterliste/i], ["vertraege", /mietvertr/i], ["miete", /miete|zahlungs/i], ["bk", /betriebskosten|nebenkosten/i], ["instand", /instandhalt|sanierung/i], ["flaeche", /fl(ä|ae)che|grundriss/i], ["baulast", /baulast/i], ["bauakte", /bauakte|baugenehmigung/i]];

/** Upload einer oder mehrerer Unterlagen (multipart, Feld "dateien", optional "schluessel"). PDFs werden serverseitig in Text umgewandelt. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const s = await speicher(); const t = mandant(req);
  const o = await s.objekt(t, params.id); if (!o) return Response.json({ fehler: "Nicht gefunden" }, { status: 404 });
  const form = await req.formData();
  const fest = form.get("schluessel")?.toString();
  const erlaubt = new Set(unterlagenFuer(o.objekt.asset).map(x => x[0]));
  const ergebnis: { datei: string; schluessel: string; zeichen: number }[] = [];
  for (const f of form.getAll("dateien")) {
    if (!(f instanceof File)) continue;
    if (f.size > 20 * 1024 * 1024) return Response.json({ fehler: `${f.name}: größer als 20 MB` }, { status: 413 });
    const bytes = new Uint8Array(await f.arrayBuffer());
    let text = "";
    if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) {
      try { const pdf = await getDocumentProxy(bytes.slice()); const r = await extractText(pdf, { mergePages: false }); text = (r.text as string[]).map((s2, i) => `[${f.name}, Seite ${i + 1}] ${s2}`).join("\n").slice(0, 120000); } catch { text = ""; }
    }
    const key = fest && erlaubt.has(fest) ? fest : (MUSTER.find(([k, re]) => erlaubt.has(k) && (re.test(f.name) || re.test(text.slice(0, 2000))))?.[0] ?? "sonst");
    const dateiId = neueId();
    await s.speichereDatei(t, o.id, dateiId, f.name, f.type || "application/octet-stream", bytes);
    const d: Dokument = o.dokumente.find(x => x.schluessel === key) ?? (() => { const neu: Dokument = { schluessel: key, titel: unterlagenFuer(o.objekt.asset).find(x => x[0] === key)?.[1] ?? key, status: "offen" }; o.dokumente.push(neu); return neu; })();
    d.dateiId = dateiId; d.dateiname = f.name; d.text = [d.text, text].filter(Boolean).join("\n").slice(0, 150000) || undefined;
    if (d.status === "offen" || d.status === "angefordert") d.status = "erhalten";
    ergebnis.push({ datei: f.name, schluessel: key, zeichen: text.length });
  }
  o.geaendert = Date.now();
  await s.speichereObjekt(t, o);
  return Response.json({ ergebnis, dokumente: o.dokumente });
}
