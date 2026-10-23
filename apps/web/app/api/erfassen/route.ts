import { ausUmgebung, fuehreAus } from "@highstack/agents";
import { BEISPIEL_OBJEKT } from "@highstack/engine";
import { ausExtrakt, musterErkennung, textAusPdf, textAusUrl, type Extrakt } from "@/lib/erfassung";
import { mandant, speicher } from "@/lib/speicher";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Objekt erfassen: Exposé-PDF, Link oder Text auslesen. Legt noch nichts an, sondern liefert Vorschläge,
 * die der Nutzer bestätigt. Mit API-Key liest der Daten-Analyst, sonst die Mustererkennung.
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const datei = form.get("datei"); const url = form.get("url")?.toString(); const roh = form.get("text")?.toString();
  let text = "", titel: string | undefined, hinweis: string | undefined;
  if (datei instanceof File && datei.size) {
    if (datei.size > 20 * 1024 * 1024) return Response.json({ fehler: "Die Datei ist größer als 20 MB." }, { status: 413 });
    text = await textAusPdf(new Uint8Array(await datei.arrayBuffer()));
    if (!text.trim()) hinweis = "Im PDF war kein Text lesbar (vermutlich ein Scan). Tragen Sie die Werte kurz selbst ein; das PDF wird trotzdem als Unterlage abgelegt.";
  } else if (url) { const r = await textAusUrl(url); text = r.text; titel = r.titel; hinweis = r.hinweis; }
  else if (roh) text = roh.slice(0, 120000);
  if (!text.trim()) return Response.json({ felder: {}, gefunden: [], quelle: "keine", text: "", hinweis: hinweis ?? "Nichts zum Auslesen gefunden." });
  const muster = musterErkennung(text, titel);
  const { client, modelle, testmodus } = ausUmgebung();
  if (testmodus) return Response.json({ ...muster, text: text.slice(0, 20000), hinweis: hinweis ?? (muster.gefunden.length ? undefined : "Keine Werte erkannt. Mit API-Key liest der Daten-Analyst auch freie Formulierungen.") });
  try {
    const s = await speicher(req); const p = await s.profil(mandant(req));
    const ap = p.anlageprofile.find(a => a.id === p.aktivesAnlageprofil) ?? p.anlageprofile[0]!;
    const r = await fuehreAus<{ objekte: Extrakt[] }>("datenanalyst", { client, modelle, eingabe: { investor: p.investor, anlageprofil: ap, objekt: { ...BEISPIEL_OBJEKT, titel: "Erfassung" } }, signal: req.signal }, `Erkenne das Objekt in diesem Exposé bzw. Inserat und extrahiere die Daten. Es ist genau ein Objekt. Text:\n"""${text.slice(0, 60000)}"""`);
    const x = r.ergebnis.objekte?.[0];
    if (!x) return Response.json({ ...muster, text: text.slice(0, 20000), hinweis });
    const felder = { ...muster.felder, ...ausExtrakt(x) };
    const gefunden = (Object.keys(felder) as (keyof typeof felder)[]).filter(k => !["asset", "titel", "gefragt", "hausgeldGesamt"].includes(k));
    return Response.json({ felder, gefunden, quelle: "ki", text: text.slice(0, 20000), hinweis });
  } catch { return Response.json({ ...muster, text: text.slice(0, 20000), hinweis: "Der Daten-Analyst war nicht erreichbar; die Werte stammen aus der Mustererkennung." }); }
}
