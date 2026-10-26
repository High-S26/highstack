import { dirname, join } from "node:path";

/**
 * Text aus einem Foto (Aushang, Zeitungsanzeige, abfotografiertes Exposé) ohne KI:
 * 1. auf das helle Blatt zuschneiden (Fliesen, Wand und Klebeband stören die Texterkennung stark),
 * 2. in Graustufen, vergrößert und kontrastverstärkt an Tesseract (deutsche Sprachdaten liegen im Paket),
 * 3. Zeilen ohne lesbare Wörter verwerfen.
 * Mit API-Key liest zusätzlich die KI das Bild direkt (siehe /api/erfassen).
 */

export async function textAusBild(bytes: Uint8Array, opts: { dokument?: boolean; psm?: string } = {}): Promise<{ text: string; konfidenz: number }> {
  return (await textAusBildern([bytes], opts))[0]!;
}

/**
 * Mehrere Bilder mit einem Texterkennungs-Durchgang (Sprachdaten nur einmal laden).
 * dokument: gerenderte Seiten (weißer Hintergrund, eine Spalte) ohne Blatt-Zuschnitt und mit Spaltenmodus,
 * damit keine Zeilen verloren gehen.
 */
export async function textAusBildern(bilder: Uint8Array[], opts: { dokument?: boolean; psm?: string } = {}): Promise<{ text: string; konfidenz: number }[]> {
  const { createWorker } = await import("tesseract.js");
  // Sprachdaten aus dem Paket (zur Laufzeit geladen, damit der Pfad stimmt; „best_int“ ist genauer als die Standarddaten)
  const deu = (await import("@tesseract.js-data/deu")) as unknown as { langPath: string; default?: { langPath: string } };
  const langPath = join(dirname(deu.langPath ?? deu.default!.langPath), "4.0.0_best_int");
  const worker = await createWorker("deu", 1, { langPath, cacheMethod: "none", gzip: true });
  try {
    if (opts.dokument || opts.psm) await worker.setParameters({ tessedit_pageseg_mode: (opts.psm ?? "4") as never });
    const out: { text: string; konfidenz: number }[] = [];
    for (const b of bilder) {
      const vorbereitet = await vorbereiten(b, !!opts.dokument);
      const r = await worker.recognize(vorbereitet);
      const lesbar = r.data.text.split("\n").filter(z => { const w = z.match(/[A-Za-zÄÖÜäöüß]{3,}/g) ?? []; const zeichen = z.replace(/\s/g, "").length; return w.length >= 1 && (w.join("").length / Math.max(1, zeichen)) > (opts.dokument ? 0.15 : 0.45); });
      out.push({ text: normalisiereOcr(lesbar.join("\n")), konfidenz: Math.round(r.data.confidence) });
    }
    return out;
  } finally { await worker.terminate(); }
}

async function vorbereiten(bytes: Uint8Array, dokument: boolean): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const eingang = sharp(Buffer.from(bytes)).rotate().flatten({ background: "#ffffff" });
  const meta = await eingang.metadata();
  const breite = meta.autoOrient?.width ?? meta.width ?? 0; const hoehe = meta.autoOrient?.height ?? meta.height ?? 0;
  // Blatt finden: Zeilen und Spalten mit überwiegend hellen Pixeln
  const klein = await sharp(Buffer.from(bytes)).rotate().grayscale().resize({ width: 600 }).raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = klein.info; const px = klein.data;
  const anteil = (n: number, laenge: number) => n / Math.max(1, laenge);
  const zeile = (y: number) => { let n = 0; for (let x = 0; x < W; x++) n += px[y * W + x]! > 170 ? 1 : 0; return anteil(n, W); };
  let y0 = 0, y1 = H - 1; while (y0 < H - 1 && zeile(y0) < 0.35) y0++; while (y1 > y0 && zeile(y1) < 0.35) y1--;
  const spalte = (x: number) => { let n = 0; for (let y = y0; y < y1; y++) n += px[y * W + x]! > 170 ? 1 : 0; return anteil(n, y1 - y0); };
  let x0 = 0, x1 = W - 1; while (x0 < W - 1 && spalte(x0) < 0.6) x0++; while (x1 > x0 && spalte(x1) < 0.6) x1--;
  const f = breite / W; const blattGefunden = (x1 - x0) > W * 0.3 && (y1 - y0) > H * 0.3;
  const zuschnitt = blattGefunden ? { left: Math.round(x0 * f), top: Math.round(y0 * f), width: Math.min(breite - Math.round(x0 * f), Math.round((x1 - x0) * f)), height: Math.min(hoehe - Math.round(y0 * f), Math.round((y1 - y0) * f)) } : null;
  return (zuschnitt && !dokument ? eingang.extract(zuschnitt) : eingang).grayscale().resize({ width: 2000 }).normalize().png().toBuffer();
}

/** Typische Lesefehler: „m?“ / „m”“ statt m², „41.3 m²“ (Punkt statt Komma bei Flächen), Häkchen als „V/“ */
export function normalisiereOcr(t: string): string {
  return t.replace(/(\d)\s*m[?”"'’2]/g, "$1 m²").replace(/(\d+)\.(\d)\s*m²/g, "$1,$2 m²").replace(/^[|{}\[\]'\-–—~ ]+/gm, "").replace(/^(?:V\/|vV\/|Y\s?vV\/|V)\s+/gm, "• ");
}

/**
 * Text aus einem Dokument für Importe (z. B. Wirtschaftskalender): PDF mit Text direkt; PDF ohne Text
 * („Drucken als PDF“ aus dem Browser speichert Seiten oft als Bilder oder Pfade) Seite für Seite rendern und lesen;
 * Bilder (Screenshots) per Texterkennung. Höchstens maxSeiten Seiten.
 */
export async function textAusDokument(bytes: Uint8Array, typ: string, opts: { maxSeiten?: number } = {}): Promise<{ text: string; seiten: number; ocr: boolean }> {
  const max = opts.maxSeiten ?? 15;
  if (typ === "application/pdf") {
    const { extractText, getDocumentProxy, renderPageAsImage } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes.slice());
    const n = Math.min(pdf.numPages, max);
    const roh = String((await extractText(pdf, { mergePages: true })).text ?? "");
    if (roh.replace(/\s/g, "").length > 200 * Math.max(1, Math.min(n, 3))) return { text: roh, seiten: n, ocr: false };
    const bilder: Uint8Array[] = [];
    for (let p = 1; p <= n; p++) bilder.push(new Uint8Array(await renderPageAsImage(bytes.slice(), p, { canvasImport: () => import("@napi-rs/canvas"), scale: 2 })));
    const r = await textAusBildern(bilder, { dokument: true });
    return { text: r.map(x => x.text).join("\n"), seiten: n, ocr: true };
  }
  const [r] = await textAusBildern([bytes], { dokument: true });
  return { text: r!.text, seiten: 1, ocr: true };
}
