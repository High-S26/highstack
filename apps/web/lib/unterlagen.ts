import type { Dokument, Unterlagendatei } from "./typen";

/**
 * Unterlagen erkennen: Punktwerte aus Dateiname (stark) und Inhalt der ersten Seiten.
 * Ein Exposé erwähnt oft Teilung, Energieausweis oder Grundbuch nur nebenbei; deshalb zählen
 * typische Formulierungen des jeweiligen Dokuments und nicht einzelne Stichwörter.
 */
type Regel = { name?: RegExp; inhalt: [RegExp, number][] };
const REGELN: Record<string, Regel> = {
  expose: { name: /expos|inserat|angebot|immoscout|immowelt|kleinanzeigen/i, inhalt: [[/expos[ée]/i, 3], [/(käufer)?provision|courtage|maklerprovision/i, 2], [/objektbeschreibung|ausstattung|lagebeschreibung|die lage\b|highlights/i, 1.5], [/kaufpreis/i, 1.5], [/\bzimmer\b/i, 1], [/ihr ansprechpartner|besichtigung|anbieter/i, 1.5]] },
  grundriss: { name: /grundriss|floor ?plan|\bplan\b|aufteilungsplan/i, inhalt: [[/grundriss/i, 2]] },
  fotos: { name: /foto|bild|img|photo|dsc|pxl/i, inhalt: [] },
  teilung: { name: /teilung/i, inhalt: [[/teilungserkl(ä|ae)rung/i, 3], [/gemeinschaftsordnung/i, 3], [/aufteilungsplan/i, 1.5], [/sondereigentum/i, 0.7], [/miteigentumsanteil/i, 0.5]] },
  kaufvertrag: { name: /kaufvertrag|kv[-_ ]?entwurf|urkunde/i, inhalt: [[/kaufvertrag/i, 2], [/urkundenrolle|ur\.?-?nr|notar(in)?\b/i, 2.5], [/der verk(ä|ae)ufer verkauft/i, 3]] },
  grundbuch: { name: /grundbuch/i, inhalt: [[/grundbuch von/i, 4], [/bestandsverzeichnis/i, 3], [/abteilung (ii|iii|2|3)\b/i, 1.5]] },
  protokolle: { name: /protokoll|etv|versammlung/i, inhalt: [[/protokoll der .{0,40}versammlung/i, 4], [/eigent(ü|ue)merversammlung/i, 1.5], [/tagesordnungspunkt|\btop \d/i, 2], [/beschlossen|abstimmung/i, 1]] },
  wirtschaft: { name: /wirtschaftsplan|hausgeld|abrechnung/i, inhalt: [[/wirtschaftsplan/i, 3], [/(hausgeld|jahres|einzel)abrechnung/i, 3], [/umlageschl(ü|ue)ssel/i, 1.5]] },
  ruecklage: { name: /r(ü|ue)cklage/i, inhalt: [[/(erhaltungs|instandhaltungs)r(ü|ue)cklage/i, 1.5], [/r(ü|ue)cklagenstand|stand der r(ü|ue)cklage/i, 3]] },
  energie: { name: /energie|epass|energieausweis/i, inhalt: [[/energieausweis f(ü|ue)r wohngeb(ä|ae)ude/i, 4], [/registriernummer/i, 3], [/g(ü|ue)ltig bis/i, 1]] },
  mieter: { name: /mieterliste|mieteraufstellung|rent ?roll/i, inhalt: [[/mieterliste|mieteraufstellung/i, 4]] },
  vertraege: { name: /mietvertrag/i, inhalt: [[/mietvertrag (ü|ue)ber/i, 4], [/zwischen .{0,80}\(vermieter\)/i, 3]] },
  miete: { name: /mietvertrag|zahlungs|kontoauszug/i, inhalt: [[/mietvertrag (ü|ue)ber/i, 4], [/zahlungseing(ä|ae)nge|mietkonto/i, 3]] },
  bk: { name: /betriebskosten|nebenkosten/i, inhalt: [[/(betriebs|neben)kostenabrechnung/i, 4]] },
  instand: { name: /instandhalt|sanierung|ma(ß|ss)nahmen/i, inhalt: [[/instandhaltungshistorie|durchgef(ü|ue)hrte ma(ß|ss)nahmen/i, 3]] },
  flaeche: { name: /wohnfl|fl(ä|ae)chenberechnung|fl(ä|ae)chenaufstellung/i, inhalt: [[/wohnfl(ä|ae)chenberechnung|fl(ä|ae)chenaufstellung/i, 4], [/wohnfl(ä|ae)chenverordnung|wofiv/i, 2]] },
  baulast: { name: /baulast/i, inhalt: [[/baulastenverzeichnis|baulastenblatt/i, 4]] },
  bauakte: { name: /bauakte|baugenehmigung|bauschein/i, inhalt: [[/baugenehmigung|bauschein/i, 3]] },
};

const BILD = /^image\//;
export function istBild(mime: string, name = "") { return BILD.test(mime) || /\.(png|jpe?g|webp|gif)$/i.test(name); }

/** Beste Zuordnung für eine Datei unter den erlaubten Punkten */
export function erkenneArt(name: string, mime: string, text: string, erlaubt: Set<string>): { schluessel: string; sicher: boolean; grund: string } {
  if (istBild(mime, name)) {
    const plan = REGELN.grundriss!.name!.test(name);
    if (plan) return { schluessel: "grundriss", sicher: true, grund: "Bild, Name deutet auf Grundriss" };
    // Foto einer Anzeige oder eines Aushangs: per Texterkennung gelesener Text mit typischen Angaben
    const merkmale = [/Kaufpreis|Preis\s*:/i, /Wohnfl(ä|ae)che|\bm²/i, /Kaltmiete|vermietet|Zimmer|ZKDB/i, /Hausgeld|Baujahr|provisionsfrei|Kontakt/i].filter(r => r.test(text)).length;
    if (merkmale >= 2 && erlaubt.has("expose")) return { schluessel: "expose", sicher: merkmale >= 3, grund: "Foto einer Anzeige, Text erkannt" };
    return { schluessel: "fotos", sicher: false, grund: "Bild" };
  }
  const anfang = text.slice(0, 8000);
  const punkte = Object.entries(REGELN).filter(([k]) => erlaubt.has(k)).map(([k, r]) => {
    let p = r.name?.test(name) ? 5 : 0;
    for (const [re, w] of r.inhalt) { const n = (anfang.match(new RegExp(re.source, "gi")) ?? []).length; p += Math.min(n, 3) * w; }
    return [k, p] as const;
  }).sort((a, b) => b[1] - a[1]);
  const [erst, zweit] = punkte;
  if (!erst || erst[1] < 3) return { schluessel: "sonst", sicher: false, grund: text ? "keine eindeutigen Merkmale" : "kein Text lesbar" };
  const sicher = erst[1] >= 5 && erst[1] >= 1.5 * (zweit?.[1] ?? 0);
  return { schluessel: erst[0], sicher, grund: REGELN[erst[0]]!.name?.test(name) ? "Dateiname und Inhalt" : "Inhalt" };
}

const RAUM = /\b(wohnen|wohnzimmer|schlafen|schlafzimmer|kind(erzimmer)?|bad|duschbad|k(ü|ue)che|flur|diele|balkon|terrasse|loggia|abstellraum|abst\.|wc|essen|arbeiten|gast|hwr|speis)\b/gi;
/** Seiten eines PDFs, die nach Grundriss aussehen: wenig Fließtext, viele Raumbezeichnungen oder „Grundriss“ */
export function grundrissSeiten(seiten: string[]): number[] {
  return seiten.map((t, i) => {
    const raeume = new Set((t.match(RAUM) ?? []).map(x => x.toLowerCase())).size;
    const kurz = t.replace(/\s+/g, " ").length < 900;
    return (kurz && raeume >= 3) || (/grundriss/i.test(t) && raeume >= 2 && t.length < 2500) ? i + 1 : 0;
  }).filter(n => n > 1);
}

/** Text eines Punkts aus seinen Dateien (für die Experten) */
export const textAus = (d: Pick<Dokument, "dateien">) => (d.dateien ?? []).filter(x => !x.aus).map(x => x.text).filter(Boolean).join("\n").slice(0, 150000) || undefined;

/** Datei von einem Punkt zu einem anderen verschieben */
export function verschiebe(liste: Dokument[], dateiId: string, nach: string, titelVon: (k: string) => string): Dokument[] {
  let datei: Unterlagendatei | undefined;
  const ohne = liste.map(d => { const f = d.dateien?.find(x => x.id === dateiId && !x.aus); if (!f) return d; datei = f; return aufraeumen({ ...d, dateien: d.dateien!.filter(x => x !== f) }); });
  if (!datei) return liste;
  const ziel = ohne.find(d => d.schluessel === nach) ?? { schluessel: nach, titel: titelVon(nach), status: "offen" as const };
  const neu = aufraeumen({ ...ziel, dateien: [...(ziel.dateien ?? []), { ...datei, erkannt: { sicher: true, grund: "von Ihnen zugeordnet" } }], status: ziel.status === "offen" || ziel.status === "angefordert" ? "erhalten" : ziel.status });
  return ohne.some(d => d.schluessel === nach) ? ohne.map(d => d.schluessel === nach ? neu : d) : [...ohne, neu];
}
function aufraeumen(d: Dokument): Dokument {
  const letzte = d.dateien?.filter(x => !x.aus).at(-1) ?? d.dateien?.at(-1);
  return { ...d, dateiId: letzte?.id, dateiname: letzte?.name, text: textAus(d), status: d.dateien?.length ? d.status : d.status === "erhalten" ? "offen" : d.status };
}

/** Ältere Datensätze (nur dateiId) in die Dateiliste überführen */
export function mitDateien(d: Dokument): Dokument {
  if (d.dateien || !d.dateiId) return d;
  return { ...d, dateien: [{ id: d.dateiId, name: d.dateiname ?? "Datei", mime: /\.pdf$/i.test(d.dateiname ?? "") ? "application/pdf" : "application/octet-stream", text: d.text, am: 0 }] };
}
