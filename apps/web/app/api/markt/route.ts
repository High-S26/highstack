import { ausUmgebung, fuehreAus } from "@highstack/agents";
import { LEERES_OBJEKT } from "@/lib/vorgaben";
import { mandant, speicher } from "@/lib/speicher";
import type { Assetklasse } from "@highstack/engine";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const { region, asset, anlageprofilId } = (await req.json()) as { region: string; asset: Assetklasse | "Grundstück" | "Ferienimmobilie"; anlageprofilId?: string };
  const objektklasse: Assetklasse = asset === "Grundstück" ? "EFH/ZFH" : asset === "Ferienimmobilie" ? "ETW" : asset;
  if (!region?.trim()) return Response.json({ fehler: "Region fehlt" }, { status: 400 });
  const s = await speicher(); const p = await s.profil(mandant(req));
  const ap = p.anlageprofile.find(a => a.id === (anlageprofilId ?? p.aktivesAnlageprofil)) ?? p.anlageprofile[0]!;
  const { client, modelle } = ausUmgebung();
  const r = await fuehreAus("markt", { client, modelle, eingabe: { investor: p.investor, anlageprofil: ap, objekt: { ...LEERES_OBJEKT, titel: `Markt ${region}`, ort: region, asset: objektklasse } }, signal: req.signal },
    `Erstelle das Markt-Briefing für die Region „${region}“ und die Assetklasse ${asset}${asset === "Grundstück" ? " (Bauland, Baurecht, Bodenrichtwerte, Entwicklungspotenzial)" : asset === "Ferienimmobilie" ? " (Saison, Auslastung, Tagespreise, Zweitwohnungsteuer, Zweckentfremdungs- und Ferienwohnungsregeln vor Ort, Eigennutzung)" : ""}. Es gibt kein konkretes Objekt; nutze Anlageprofil und Spielraum. Du hast keinen Zugriff auf aktuelle Daten: kennzeichne Marktwerte als Modellwissen mit ungefährem Stand.`);
  return Response.json({ region, asset, am: Date.now(), ...r });
}
