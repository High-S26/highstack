/** Einheitliches deutsches Zahlenformat für Protokoll, Gründe und Oberfläche */
const ZEICHEN: Record<string, string> = { EUR: "€", USD: "$", GBP: "£", CHF: "CHF" };
export const zeichen = (w = "EUR") => ZEICHEN[w] ?? w;
export const dez = (v: number, nach = 2) => v.toLocaleString("de-DE", { minimumFractionDigits: nach, maximumFractionDigits: nach });
/** Kurs, immer mit 2 Nachkommastellen */
export const kurs = (v: number) => dez(v, 2);
/** Betrag mit Währungszeichen */
export const geld = (v: number, w = "EUR") => `${dez(v, 2)} ${zeichen(w)}`;
/** Betrag mit Vorzeichen */
export const geldPm = (v: number, w = "EUR") => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${dez(Math.abs(v), 2)} ${zeichen(w)}`;
/** Stückzahl: ganze Stück ohne Nachkommastellen, Bruchstücke mit bis zu 3 Stellen (deutsches Komma) */
export const stueck = (q: number) => q.toLocaleString("de-DE", { maximumFractionDigits: 3 });
/** Allgemeine Zahl, deutsch, höchstens n Nachkommastellen */
export const zahl = (v: number, n = 2) => v.toLocaleString("de-DE", { maximumFractionDigits: n });
