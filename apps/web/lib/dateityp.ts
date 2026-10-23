/**
 * Dateityp aus dem Inhalt (Signatur), nicht aus Name oder Angabe des Browsers.
 * Nur diese Typen werden angenommen und im Browser angezeigt; alles andere ist ein Download.
 */
export type Erlaubt = "application/pdf" | "image/png" | "image/jpeg" | "image/webp";
export function typAusInhalt(b: Uint8Array): Erlaubt | null {
  const s = (i: number, t: string) => [...t].every((c, k) => b[i + k] === c.charCodeAt(0));
  if (b.length >= 5 && s(0, "%PDF-")) return "application/pdf";
  if (b.length >= 8 && b[0] === 0x89 && s(1, "PNG\r\n\x1a\n")) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 12 && s(0, "RIFF") && s(8, "WEBP")) return "image/webp";
  return null;
}

/** Kopfzeilen für die Auslieferung gespeicherter Dateien */
export function dateiKopf(inhalt: Uint8Array, name: string): Record<string, string> {
  const typ = typAusInhalt(inhalt); const dateiname = `filename*=UTF-8''${encodeURIComponent(name)}`;
  const basis = { "x-content-type-options": "nosniff", "cache-control": "private, max-age=300", "cross-origin-resource-policy": "same-origin" };
  if (typ) return { ...basis, "content-type": typ, "content-disposition": `inline; ${dateiname}` };
  // Unbekannter Inhalt: nie im App-Ursprung ausführen, nur herunterladen
  return { ...basis, "content-type": "application/octet-stream", "content-disposition": `attachment; ${dateiname}`, "content-security-policy": "sandbox; default-src 'none'" };
}
