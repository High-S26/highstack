import { ausUmgebung, fuehreAus } from "@highstack/agents";
import { BEISPIEL_OBJEKT } from "@highstack/engine";
import { ausExtrakt, musterErkennung, textAusPdf, textAusUrl, type Extrakt } from "@/lib/erfassung";
import { mandant, speicher } from "@/lib/speicher";
import { typAusInhalt } from "@/lib/dateityp";
import { textAusBild } from "@/lib/ocr";
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
  let bild: { mime: "image/jpeg" | "image/png" | "image/webp"; base64: string } | null = null;
  if (datei instanceof File && datei.size) {
    if (datei.size > 20 * 1024 * 1024) return Response.json({ fehler: "Die Datei ist größer als 20 MB." }, { status: 413 });
    const bytes = new Uint8Array(await datei.arrayBuffer()); const typ = typAusInhalt(bytes);
    if (typ === "application/pdf") {
      text = await textAusPdf(bytes);
      if (!text.trim()) hinweis = "Im PDF war kein Text lesbar (vermutlich ein Scan). Tragen Sie die Werte kurz selbst ein; das PDF wird trotzdem als Unterlage abgelegt.";
    } else if (typ) {
      // Foto einer Anzeige oder eines Aushangs: Texterkennung, mit API-Key liest die KI das Bild zusätzlich direkt
      try { const r = await textAusBild(bytes); text = r.text; if (r.konfidenz < 60) hinweis = "Das Foto war schwer lesbar. Bitte die Werte prüfen; ein gerades, scharfes Foto nur des Blatts hilft."; }
      catch (e) { console.error("Texterkennung fehlgeschlagen:", e); hinweis = "Die Texterkennung ist fehlgeschlagen. Bitte die Werte selbst eintragen."; }
      // für die KI verkleinert (lange Kante 1600 px), damit auch große Handyfotos passen
      try { const sharp = (await import("sharp")).default; bild = { mime: "image/jpeg", base64: (await sharp(Buffer.from(bytes)).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()).toString("base64") }; } catch { bild = null; }
      if (!text.trim() && !bild) return Response.json({ felder: {}, gefunden: [], quelle: "keine", text: "", hinweis: hinweis ?? "Auf dem Foto war kein Text lesbar." });
    } else return Response.json({ fehler: "Bitte ein PDF oder ein Foto (JPG, PNG, WebP) hochladen. iPhone-Fotos im HEIC-Format vorher als JPG teilen." }, { status: 415 });
  } else if (url) { const r = await textAusUrl(url); text = r.text; titel = r.titel; hinweis = r.hinweis; }
  else if (roh) text = roh.slice(0, 120000);
  if (!text.trim() && !bild) return Response.json({ felder: {}, gefunden: [], quelle: "keine", text: "", hinweis: hinweis ?? "Nichts zum Auslesen gefunden." });
  const muster = musterErkennung(text, titel);
  const { client, modelle, testmodus } = ausUmgebung();
  if (testmodus) return Response.json({ ...muster, text: text.slice(0, 20000), hinweis: hinweis ?? (muster.gefunden.length ? undefined : "Keine Werte erkannt. Mit API-Key liest der Daten-Analyst auch freie Formulierungen.") });
  try {
    const s = await speicher(req); const p = await s.profil(mandant(req));
    const ap = p.anlageprofile.find(a => a.id === p.aktivesAnlageprofil) ?? p.anlageprofile[0]!;
    const r = await fuehreAus<{ objekte: Extrakt[] }>("datenanalyst", { client, modelle, eingabe: { investor: p.investor, anlageprofil: ap, objekt: { ...BEISPIEL_OBJEKT, titel: "Erfassung" } }, signal: req.signal, ...(bild ? { bilder: [bild] } : {}) }, bild ? `Erkenne das Objekt auf diesem Foto einer Anzeige bzw. eines Aushangs und extrahiere die Daten. Es ist genau ein Objekt. Zur Kontrolle der Text aus der automatischen Texterkennung (kann Lesefehler enthalten):\n"""${text.slice(0, 20000)}"""` : `Erkenne das Objekt in diesem Exposé bzw. Inserat und extrahiere die Daten. Es ist genau ein Objekt. Text:\n"""${text.slice(0, 60000)}"""`);
    const x = r.ergebnis.objekte?.[0];
    if (!x) return Response.json({ ...muster, text: text.slice(0, 20000), hinweis });
    const ki = ausExtrakt(x);
    // Anrechnungsanteil der Außenfläche (aus der Gesamtfläche im Inserat) kennt nur die Mustererkennung
    if (ki.aussenflaeche && muster.felder.aussenflaeche?.art === ki.aussenflaeche.art) ki.aussenflaeche = { ...ki.aussenflaeche, anrechnung: muster.felder.aussenflaeche.anrechnung, ...(muster.felder.aussenflaeche.anbieterAnrechnung != null ? { anbieterAnrechnung: muster.felder.aussenflaeche.anbieterAnrechnung } : {}), qm: ki.aussenflaeche.qm ?? muster.felder.aussenflaeche.qm, inWohnflaeche: muster.felder.aussenflaeche.qm ? muster.felder.aussenflaeche.inWohnflaeche : ki.aussenflaeche.inWohnflaeche };
    const felder = { ...muster.felder, ...ki };
    const gefunden = (Object.keys(felder) as (keyof typeof felder)[]).filter(k => !["asset", "titel", "gefragt", "hausgeldGesamt"].includes(k));
    return Response.json({ felder, gefunden, quelle: "ki", text: text.slice(0, 20000), hinweis });
  } catch { return Response.json({ ...muster, text: text.slice(0, 20000), hinweis: "Der Daten-Analyst war nicht erreichbar; die Werte stammen aus der Mustererkennung." }); }
}
