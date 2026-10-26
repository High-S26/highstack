import { istAdmin, keinAdmin } from "@/lib/admin";
import { typAusInhalt } from "@/lib/dateityp";
import { textAusDokument } from "@/lib/ocr";
import { speicher } from "@/lib/speicher";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Terminliste oder Artikel als Datei (PDF, auch „Drucken als PDF“ ohne Text, oder Screenshot) in Text umwandeln.
 * Der Text kommt zurück ins Importfeld und wird dort wie eingefügter Text geprüft.
 */
export async function POST(req: Request) {
  const s = await speicher(req); if (!await istAdmin(req, s)) return keinAdmin();
  const form = await req.formData().catch(() => null); const f = form?.get("datei");
  if (!(f instanceof File)) return Response.json({ fehler: "Bitte eine Datei wählen." }, { status: 400 });
  if (f.size > 25 * 1024 * 1024) return Response.json({ fehler: "Die Datei ist größer als 25 MB." }, { status: 413 });
  const bytes = new Uint8Array(await f.arrayBuffer()); const typ = typAusInhalt(bytes);
  if (!typ) return Response.json({ fehler: "Bitte ein PDF oder ein Bild (PNG, JPG, WebP) wählen." }, { status: 415 });
  try {
    const r = await textAusDokument(bytes, typ, { maxSeiten: 15 });
    if (r.text.replace(/\s/g, "").length < 40) return Response.json({ fehler: "In der Datei war kein Text lesbar." }, { status: 422 });
    return Response.json({ text: r.text.slice(0, 200_000), seiten: r.seiten, ocr: r.ocr });
  } catch (e) { console.error("Termine lesen:", e); return Response.json({ fehler: "Die Datei ließ sich nicht lesen (beschädigt oder verschlüsselt)." }, { status: 422 }); }
}
