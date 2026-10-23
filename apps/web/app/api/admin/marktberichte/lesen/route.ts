import { extractText, getDocumentProxy } from "unpdf";
import { ausUmgebung, fuehreAus, neuerVerbrauch } from "@highstack/agents";
import { BEISPIEL_ANLAGEPROFIL, BEISPIEL_INVESTOR } from "@highstack/engine";
import { speicher } from "@/lib/speicher";
import { bucheVerbrauch, istAdmin, keinAdmin, protokolliere } from "@/lib/admin";
import type { Marktbericht } from "@/lib/marktwissen";
import { id as neueId, LEERES_OBJEKT } from "@/lib/vorgaben";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Marktbericht-PDF von der KI auslesen lassen: Fakten mit Seite, als Entwurf zur Prüfung */
export async function POST(req: Request) {
  const s = await speicher(req); if (!await istAdmin(req, s)) return keinAdmin();
  const form = await req.formData(); const f = form.get("datei"); const url = form.get("quelleUrl")?.toString() ?? ""; const lizenz = form.get("lizenz")?.toString() ?? "";
  if (!(f instanceof File)) return Response.json({ fehler: "Bitte ein PDF auswählen." }, { status: 400 });
  if (f.size > 40 * 1024 * 1024) return Response.json({ fehler: "Datei größer als 40 MB" }, { status: 413 });
  let text = "";
  try { const doc = await getDocumentProxy(new Uint8Array(await f.arrayBuffer())); text = ((await extractText(doc, { mergePages: false })).text as string[]).map((t, i) => `[Seite ${i + 1}] ${t}`).join("\n"); } catch { /* unten */ }
  if (text.replace(/\s/g, "").length < 500) return Response.json({ fehler: "Im PDF ist kaum Text lesbar." }, { status: 422 });
  const { client, modelle, testmodus } = ausUmgebung();
  if (testmodus) return Response.json({ fehler: "Auslesen braucht den API-Key (Testmodus). Alternativ eine Import-Datei (JSON) einspielen." }, { status: 409 });
  const verbrauch = neuerVerbrauch();
  const r = await fuehreAus<Partial<Marktbericht>>("marktberichtleser", { verbrauch, client, modelle, eingabe: { investor: BEISPIEL_INVESTOR, anlageprofil: BEISPIEL_ANLAGEPROFIL, objekt: { ...LEERES_OBJEKT, titel: "Marktbericht" } }, signal: req.signal, maxRunden: 2, maxTokens: 32000 },
    `Übertrage die Kennzahlen dieses Marktberichts (Datei ${f.name}). Text:\n"""${text.slice(0, 180000)}"""`);
  const m: Marktbericht = { titel: f.name, herausgeber: "", stand: "", datum: null, kernaussagen: [], fakten: [], ...r.ergebnis, id: neueId(), quelleUrl: url, lizenz, status: "entwurf", herkunft: "ki", erfasst: Date.now(), geaendert: Date.now() };
  m.fakten = (m.fakten ?? []).map(x => ({ ...x, id: neueId() }));
  await s.speichereGlobal("marktbericht", m.id, m); await bucheVerbrauch(s, "plattform", "marktberichtleser", verbrauch);
  await protokolliere(s, req, "Marktbericht von KI ausgelesen", `${m.herausgeber} ${m.titel}`, `${m.fakten.length} Fakten`);
  return Response.json(m);
}
