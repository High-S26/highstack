/**
 * Mietspiegel-Datenbasis. Mietspiegel sind je Stadt unterschiedlich aufgebaut; gemeinsam ist eine
 * Tabelle aus Merkmalen (meist Baujahr, Wohnfläche, Wohnlage) mit Spannen in €/m² Nettokaltmiete.
 * Gespeichert wird die Tabelle mit Quelle und Gültigkeit, nicht das Dokument.
 */
export type MerkmalKey = "baujahr" | "flaeche" | "lage" | "ausstattung";
export interface Klasse { label: string; von?: number | null; bis?: number | null; wert?: string }
export interface Merkmal { key: MerkmalKey; label: string; klassen: Klasse[] }
export interface Feld { k: number[]; von: number | null; mittel: number | null; bis: number | null }
export interface Zuschlag { text: string; wert: number; einheit: "€/m²" | "%" }
export interface Mietspiegel {
  id: string;
  stadt: string;
  /** weitere Namen, unter denen die Stadt in Adressen vorkommt (z. B. Ortsteile) */
  aliase?: string[];
  art: "qualifiziert" | "einfach" | "unbekannt";
  gueltigAb: string | null;
  gueltigBis: string | null;
  quelleName: string;
  quelleUrl: string;
  merkmale: Merkmal[];
  felder: Feld[];
  zuschlaege: Zuschlag[];
  hinweise?: string;
  status: "entwurf" | "geprueft";
  erfasst: number;
  geaendert: number;
  erfasstVon?: string;
  geprueftVon?: string;
  /** Wie die Tabelle entstand */
  herkunft: "manuell" | "ki";
}

/** Für Kunden: ohne Pflegedaten (wer erfasst und geprüft hat, interne Hinweise) */
export const oeffentlich = (m: Mietspiegel): Mietspiegel => { const { erfasstVon: _e, geprueftVon: _g, hinweise: _h, ...rest } = m; return rest; };

export const WOHNLAGEN: [string, string][] = [["einfach", "einfache Lage"], ["mittel", "mittlere Lage"], ["gut", "gute Lage"], ["sehr gut", "sehr gute Lage"]];

export const leererMietspiegel = (id: string, stadt = ""): Mietspiegel => ({
  id, stadt, art: "unbekannt", gueltigAb: null, gueltigBis: null, quelleName: "", quelleUrl: "", status: "entwurf", erfasst: Date.now(), geaendert: Date.now(), herkunft: "manuell", zuschlaege: [],
  merkmale: [
    { key: "baujahr", label: "Baujahr", klassen: [{ label: "bis 1948", bis: 1948 }, { label: "1949–1977", von: 1949, bis: 1977 }, { label: "1978–1994", von: 1978, bis: 1994 }, { label: "1995–2010", von: 1995, bis: 2010 }, { label: "ab 2011", von: 2011 }] },
    { key: "flaeche", label: "Wohnfläche", klassen: [{ label: "bis 40 m²", bis: 40 }, { label: "40–60 m²", von: 40, bis: 60 }, { label: "60–90 m²", von: 60, bis: 90 }, { label: "über 90 m²", von: 90 }] },
    { key: "lage", label: "Wohnlage", klassen: [{ label: "einfach", wert: "einfach" }, { label: "mittel", wert: "mittel" }, { label: "gut", wert: "gut" }] },
  ],
  felder: [],
});

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Mietspiegel zu einem Ort finden: geprüfte vor Entwürfen, neuere vor älteren */
export function findeMietspiegel(liste: Mietspiegel[], ort: string, titel = ""): Mietspiegel | null {
  const text = ` ${norm(`${ort} ${titel}`)} `;
  const passt = liste.filter(m => [m.stadt, ...(m.aliase ?? [])].some(n => { const t = norm(n); return !!t && text.includes(` ${t} `); }));
  return passt.sort((a, b) => (a.status === b.status ? 0 : a.status === "geprueft" ? -1 : 1) || (b.gueltigAb ?? "").localeCompare(a.gueltigAb ?? ""))[0] ?? null;
}

/** Klasse eines Merkmals für einen Objektwert; null = unbekannt (dann zählen alle Klassen) */
export function klasseFuer(m: Merkmal, wert: number | string | null | undefined): number | null {
  if (wert == null || wert === "") return null;
  if (typeof wert === "string") { const i = m.klassen.findIndex(k => (k.wert ?? k.label).toLowerCase() === wert.toLowerCase()); return i < 0 ? null : i; }
  // Grenzwert gehört zur unteren Klasse („bis 60 m²“), daher die erste passende Klasse
  const i = m.klassen.findIndex(k => (k.von == null || wert >= k.von) && (k.bis == null || wert <= k.bis));
  return i < 0 ? null : i;
}

export interface Abfrage { baujahr?: number | null; flaeche?: number | null; lage?: string | null; ausstattung?: string | null }
export interface Treffer { von: number; mittel: number; bis: number; genau: boolean; beschreibung: string; offen: string[]; felder: number }

/** Spanne aus dem Mietspiegel für ein Objekt. Unbekannte Merkmale verbreitern die Spanne. */
export function abfrage(ms: Mietspiegel, q: Abfrage): Treffer | null {
  const idx = ms.merkmale.map(m => klasseFuer(m, q[m.key]));
  const passend = ms.felder.filter(f => f.k.every((k, i) => idx[i] == null || k === idx[i]) && (f.mittel != null || f.von != null));
  if (!passend.length) return null;
  const mittelwerte = passend.map(f => f.mittel ?? ((f.von ?? 0) + (f.bis ?? f.von ?? 0)) / 2).sort((a, b) => a - b);
  const median = mittelwerte[Math.floor((mittelwerte.length - 1) / 2)]! / 2 + mittelwerte[Math.ceil((mittelwerte.length - 1) / 2)]! / 2;
  const von = Math.min(...passend.map(f => f.von ?? f.mittel!)); const bis = Math.max(...passend.map(f => f.bis ?? f.mittel!));
  const offen = ms.merkmale.filter((_, i) => idx[i] == null).map(m => m.label);
  const beschreibung = ms.merkmale.map((m, i) => idx[i] == null ? null : `${m.label} ${m.klassen[idx[i]!]!.label}`).filter(Boolean).join(", ");
  return { von: r2(von), mittel: r2(median), bis: r2(bis), genau: !offen.length, beschreibung, offen, felder: passend.length };
}
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Prüft eine Tabelle auf typische Fehler (für die Freigabe) */
export function pruefe(ms: Mietspiegel): string[] {
  const f: string[] = [];
  if (!ms.stadt.trim()) f.push("Stadt fehlt");
  if (!ms.quelleUrl.trim() && !ms.quelleName.trim()) f.push("Quelle fehlt");
  if (!ms.gueltigAb) f.push("Gültig ab fehlt");
  if (!ms.felder.length) f.push("Keine Werte erfasst");
  const sollFelder = ms.merkmale.reduce((a, m) => a * Math.max(1, m.klassen.length), 1);
  if (ms.felder.length && ms.felder.length < sollFelder * 0.5) f.push(`Nur ${ms.felder.length} von ${sollFelder} Feldern erfasst`);
  ms.felder.forEach(x => { if (x.von != null && x.bis != null && x.von > x.bis) f.push(`Feld ${x.k.join("/")}: von größer als bis`); if ([x.von, x.mittel, x.bis].some(v => v != null && (v < 2 || v > 60))) f.push(`Feld ${x.k.join("/")}: Wert außerhalb 2–60 €/m²`); });
  return [...new Set(f)];
}
