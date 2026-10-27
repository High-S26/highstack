/** Deutsche Zahl lesen: „245.000“, „3,8“, „1.250,50“ */
export function leseZahl(t: string): number | null {
  // Übliche Schreibweisen mit Währung, „ca.“, „mtl.“ oder „,-“ zulassen: „185,- €“, „ca. 185 EUR/Monat“
  const x = t.replace(/\s|€|%|m²|eur(o)?|ca\.?|mtl\.?|monatl(ich)?\.?|\/\s*(monat|mon\.?)$/gi, "").replace(/[,.]-+$/, "").trim(); if (!x) return null;
  // Nur Ziffern, Punkt, Komma und Minus; keine Exponenten („1e6“), kein „Infinity“
  if (!/^-?[\d.,]+$/.test(x) || !/\d/.test(x)) return null;
  const norm = x.includes(",") ? x.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(x) ? x.replace(/\./g, "") : x;
  const v = Number(norm); return Number.isFinite(v) ? v : null;
}
