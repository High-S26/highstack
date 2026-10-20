import { ausUmgebung, fuehreAus } from "@highstack/agents";
import { BEISPIEL_OBJEKT, type Assetklasse } from "@highstack/engine";
import { mandant, speicher } from "@/lib/speicher";
import { neuesObjekt } from "@/lib/vorgaben";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface Extrakt { titel: string; ort: string; asset: Assetklasse; kaufpreis: number | null; wohnflaeche: number | null; vermietet?: boolean | null; kaltmieteMonat?: number | null; hausgeldNichtUmlagefaehig?: number | null; hausgeldGesamt?: number | null; ruecklageAnteil?: number | null; baujahr?: number | null; energieklasse?: string | null; erbbaurecht?: boolean | null; sonderumlage?: boolean | null; auszug?: string }

/** Inserate sichten: der Daten-Analyst erkennt Objekte, die als Kandidaten am Anlageprofil angelegt werden. */
export async function POST(req: Request) {
  const { text, anlageprofilId, suchId } = (await req.json()) as { text: string; anlageprofilId?: string; suchId?: string };
  if (!text?.trim()) return Response.json({ fehler: "Text fehlt" }, { status: 400 });
  const s = await speicher(); const t = mandant(req); const p = await s.profil(t);
  const apId = anlageprofilId ?? p.aktivesAnlageprofil; const ap = p.anlageprofile.find(a => a.id === apId) ?? p.anlageprofile[0]!;
  const { client, modelle, testmodus } = ausUmgebung();
  if (testmodus) return Response.json({ fehler: "Sichten braucht einen API-Key (ANTHROPIC_API_KEY)." }, { status: 503 });
  const r = await fuehreAus<{ objekte: Extrakt[] }>("datenanalyst", { client, modelle, eingabe: { investor: p.investor, anlageprofil: ap, objekt: { ...BEISPIEL_OBJEKT, titel: "Sichtung" } }, signal: req.signal }, `Erkenne jedes einzelne Objekt im folgenden Text und extrahiere die Daten. Text:\n"""${text.slice(0, 80000)}"""`);
  const angelegt = [];
  for (const x of r.ergebnis.objekte.slice(0, 50)) {
    const o = neuesObjekt(apId, false, "kandidat"); if (suchId) o.suchId = suchId;
    o.objekt = { ...o.objekt, titel: x.titel || "Inserat", ort: x.ort || "", asset: x.asset || "ETW", kaufpreis: x.kaufpreis ?? null, wohnflaeche: x.wohnflaeche ?? null, leer: x.vermietet === false, miete: x.kaltmieteMonat ?? null, hausgeldNichtUmlagefaehig: x.hausgeldNichtUmlagefaehig ?? (x.hausgeldGesamt != null ? Math.round(x.hausgeldGesamt * 0.4) : null), ruecklageAnteil: x.ruecklageAnteil ?? null, baujahr: x.baujahr ?? null, energieklasse: x.energieklasse ?? null, erbbaurecht: !!x.erbbaurecht, sonderumlage: !!x.sonderumlage };
    o.expose = (x.auszug ?? "").slice(0, 4000);
    await s.speichereObjekt(t, o); angelegt.push(o);
  }
  return Response.json({ angelegt });
}
