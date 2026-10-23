import { extractText, getDocumentProxy } from "unpdf";
import { ausUmgebung, fuehreAus, neuerVerbrauch } from "@highstack/agents";
import { BEISPIEL_ANLAGEPROFIL, BEISPIEL_INVESTOR } from "@highstack/engine";
import { speicher } from "@/lib/speicher";
import { leererMietspiegel, type Mietspiegel } from "@/lib/mietspiegel";
import { bucheVerbrauch, istAdmin, keinAdmin, protokolliere, werIst as nutzerVon } from "@/lib/admin";
import { id as neueId, LEERES_OBJEKT } from "@/lib/vorgaben";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Mietspiegel-PDF auslesen lassen: legt einen Entwurf an, der vor der Nutzung geprüft wird. */
export async function POST(req: Request) {
  if (!await istAdmin(req, await speicher(req))) return keinAdmin();
  const form = await req.formData(); const f = form.get("datei"); const url = form.get("quelleUrl")?.toString() ?? "";
  if (!(f instanceof File)) return Response.json({ fehler: "Bitte ein PDF auswählen." }, { status: 400 });
  if (f.size > 30 * 1024 * 1024) return Response.json({ fehler: "Datei größer als 30 MB" }, { status: 413 });
  let text = "";
  try { const doc = await getDocumentProxy(new Uint8Array(await f.arrayBuffer())); text = ((await extractText(doc, { mergePages: false })).text as string[]).map((t, i) => `[Seite ${i + 1}] ${t}`).join("\n"); } catch { /* unten */ }
  if (text.replace(/\s/g, "").length < 200) return Response.json({ fehler: "Im PDF ist kaum Text lesbar (eingescannt?). Bitte die Tabelle von Hand erfassen." }, { status: 422 });
  const { client, modelle, testmodus } = ausUmgebung();
  if (testmodus) return Response.json({ fehler: "Auslesen braucht den API-Key (Testmodus). Legen Sie den Mietspiegel an und erfassen Sie die Tabelle von Hand." }, { status: 409 });
  const verbrauch = neuerVerbrauch();
  const r = await fuehreAus<Partial<Mietspiegel>>("mietspiegelleser", { verbrauch, client, modelle, eingabe: { investor: BEISPIEL_INVESTOR, anlageprofil: BEISPIEL_ANLAGEPROFIL, objekt: { ...LEERES_OBJEKT, titel: "Mietspiegel" } }, signal: req.signal, maxRunden: 2, maxTokens: 32000 },
    `Übertrage diesen Mietspiegel (Datei ${f.name}) in die Tabelle. Text:\n"""${text.slice(0, 150000)}"""`);
  const m: Mietspiegel = { ...leererMietspiegel(neueId()), ...r.ergebnis, id: neueId(), quelleUrl: url, quelleName: r.ergebnis.quelleName || f.name, zuschlaege: r.ergebnis.zuschlaege ?? [], status: "entwurf", herkunft: "ki", erfasst: Date.now(), geaendert: Date.now(), erfasstVon: nutzerVon(req) };
  const sp = await speicher(req); await sp.speichereMietspiegel(m); await bucheVerbrauch(sp, "plattform", "mietspiegelleser", verbrauch); await protokolliere(sp, req, "Mietspiegel von KI ausgelesen", m.stadt, `${m.felder.length} Felder`);
  return Response.json(m);
}
