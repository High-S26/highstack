import { extractText, getDocumentProxy } from "unpdf";
import { mandant, speicher } from "@/lib/speicher";
import { id as neueId, unterlagenFuer } from "@/lib/vorgaben";
import type { Dokument, Unterlagendatei } from "@/lib/typen";
import { erkenneArt, grundrissSeiten, istBild, mitDateien, textAus } from "@/lib/unterlagen";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Upload einer oder mehrerer Unterlagen (multipart, Feld "dateien", optional "schluessel").
 * PDFs werden in Text umgewandelt und nach Name und Inhalt zugeordnet. Grundriss-Seiten in
 * einem Exposé werden zusätzlich unter „Grundrisse & Pläne“ verlinkt. Bilder werden als Grundriss oder Foto abgelegt.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const s = await speicher(req); const t = mandant(req);
  const o = await s.objekt(t, params.id); if (!o) return Response.json({ fehler: "Nicht gefunden" }, { status: 404 });
  const form = await req.formData();
  const fest = form.get("schluessel")?.toString();
  const katalog = unterlagenFuer(o.objekt.asset); const erlaubt = new Set(katalog.map(x => x[0]));
  const titel = (k: string) => katalog.find(x => x[0] === k)?.[1] ?? k;
  o.dokumente = o.dokumente.map(mitDateien);
  const punkt = (k: string): Dokument => o.dokumente.find(x => x.schluessel === k) ?? (() => { const neu: Dokument = { schluessel: k, titel: titel(k), status: "offen" }; o.dokumente.push(neu); return neu; })();
  const ablegen = (k: string, datei: Unterlagendatei) => {
    const d = punkt(k); d.dateien = [...(d.dateien ?? []), datei];
    if (!datei.aus) { d.dateiId = datei.id; d.dateiname = datei.name; }
    else if (!d.dateiId) { d.dateiId = datei.id; d.dateiname = datei.name; }
    d.text = textAus(d);
    if (d.status === "offen" || d.status === "angefordert") d.status = "erhalten";
  };
  const ergebnis: { datei: string; schluessel: string; titel: string; zeichen: number; sicher: boolean; grundriss?: number[] }[] = [];
  for (const f of form.getAll("dateien")) {
    if (!(f instanceof File)) continue;
    if (f.size > 20 * 1024 * 1024) return Response.json({ fehler: `${f.name}: größer als 20 MB` }, { status: 413 });
    const pdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"); const bild = istBild(f.type, f.name);
    if (!pdf && !bild) return Response.json({ fehler: `${f.name}: nur PDF oder Bilder (PNG, JPG, WebP)` }, { status: 415 });
    const bytes = new Uint8Array(await f.arrayBuffer());
    let seiten: string[] = [];
    if (pdf) { try { const doc = await getDocumentProxy(bytes.slice()); seiten = (await extractText(doc, { mergePages: false })).text as string[]; } catch { seiten = []; } }
    const text = seiten.map((s2, i) => `[${f.name}, Seite ${i + 1}] ${s2}`).join("\n").slice(0, 120000);
    const mime = f.type || (pdf ? "application/pdf" : "image/jpeg");
    const art = fest && erlaubt.has(fest) ? { schluessel: fest, sicher: true, grund: "von Ihnen zugeordnet" } : erkenneArt(f.name, mime, text, erlaubt);
    const dateiId = neueId();
    await s.speichereDatei(t, o.id, dateiId, f.name, mime, bytes);
    ablegen(art.schluessel, { id: dateiId, name: f.name, mime, text: text || undefined, erkannt: { sicher: art.sicher, grund: art.grund }, am: Date.now() });
    // Grundriss im Exposé oder in anderen PDFs: Seiten zusätzlich verlinken
    const gs = pdf && art.schluessel !== "grundriss" ? grundrissSeiten(seiten) : [];
    if (gs.length) ablegen("grundriss", { id: dateiId, name: f.name, mime, seiten: gs, aus: art.schluessel, erkannt: { sicher: false, grund: `Seite ${gs.join(", ")} sieht nach Grundriss aus` }, am: Date.now() });
    ergebnis.push({ datei: f.name, schluessel: art.schluessel, titel: titel(art.schluessel), zeichen: text.length, sicher: art.sicher, grundriss: gs.length ? gs : undefined });
  }
  o.geaendert = Date.now();
  await s.speichereObjekt(t, o);
  return Response.json({ ergebnis, dokumente: o.dokumente });
}

/** Datei entfernen: aus allen Punkten (auch verlinkte Grundriss-Seiten) und aus dem Speicher */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const s = await speicher(req); const t = mandant(req);
  const o = await s.objekt(t, params.id); if (!o) return Response.json({ fehler: "Nicht gefunden" }, { status: 404 });
  const id = new URL(req.url).searchParams.get("datei"); if (!id) return Response.json({ fehler: "datei fehlt" }, { status: 400 });
  let gefunden = false;
  o.dokumente = o.dokumente.map(mitDateien).map(d => {
    if (!d.dateien?.some(x => x.id === id)) return d; gefunden = true;
    const dateien = d.dateien.filter(x => x.id !== id); const letzte = dateien.filter(x => !x.aus).at(-1) ?? dateien.at(-1);
    return { ...d, dateien, dateiId: letzte?.id, dateiname: letzte?.name, text: textAus({ dateien }), status: dateien.length ? d.status : "offen" };
  });
  if (!gefunden) return Response.json({ fehler: "Datei gehört nicht zu diesem Objekt" }, { status: 404 });
  await s.loescheDatei(t, id); o.geaendert = Date.now(); await s.speichereObjekt(t, o);
  return Response.json({ dokumente: o.dokumente });
}
