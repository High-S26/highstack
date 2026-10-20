const ok = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);
export const eur = (v: number | null | undefined) => !ok(v) ? "–" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
export const teur = (v: number | null | undefined) => !ok(v) ? "–" : `${(v / 1000).toLocaleString("de-DE", { maximumFractionDigits: 0 })} T€`;
export const pct = (v: number | null | undefined, d = 1) => !ok(v) ? "–" : `${(v * 100).toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d })} %`;
export const num = (v: number | null | undefined, d = 2) => !ok(v) ? "–" : v.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });
export const vorzeichen = (v: number | null | undefined, f: (x: number) => string) => !ok(v) ? "" : (v > 0 ? "+" : v < 0 ? "−" : "±") + f(Math.abs(v));
export const EINSTUFUNG: Record<string, string> = { opp: "Opportunity", watch: "Watch", pass: "Pass" };
export const STRUKTUR: Record<string, string> = { privat: "Privat", gbr: "GbR", gmbh: "GmbH", offen: "Noch offen" };
export function kennzahl(wert: number | null, einheit: string) {
  if (wert == null) return "–";
  switch (einheit) { case "€": return eur(wert); case "%": return pct(wert); case "x": return num(wert, 2) + "x"; case "€/m²": return `${num(wert, 0)} €/m²`; case "m²": return `${num(wert, 0)} m²`; case "Monate": return `${num(wert, 0)} Monate`; case "Jahre": return `${num(wert, 1)} Jahre`; default: return num(wert, 2); }
}
