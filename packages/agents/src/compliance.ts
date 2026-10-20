import type { Compliancebefund } from "./schemas";

/** Muster, die auf eine Beratung im Einzelfall oder unzulässige Zusicherungen hindeuten. */
const MUSTER: { re: RegExp; problem: string; korrektur: string }[] = [
  { re: /\b(kaufen|verkaufen|investieren|unterschreiben) Sie\b/i, problem: "Handlungsanweisung an den Investor", korrektur: "Als Einschätzung formulieren, z. B. „Aus Maklersicht spricht … dafür/dagegen“." },
  { re: /\bSie sollten (das Objekt )?(kaufen|verkaufen|investieren|zugreifen|gründen|unterschreiben)\b/i, problem: "Handlungsanweisung an den Investor", korrektur: "Entscheidung beim Investor lassen; Argumente und Zahlen nennen." },
  { re: /\b(gründen|wählen|nutzen) Sie (eine|die|einen) (GmbH|GbR|Holding)\b/i, problem: "Empfehlung einer Rechtsform", korrektur: "Unterschiede beschreiben und als Frage an den Steuerberater formulieren (§ 5 StBerG)." },
  { re: /\b(ich|wir) empfehlen?\b|\bempfehlen wir\b|\bunsere Empfehlung\b/i, problem: "Formulierung als Empfehlung", korrektur: "Als Einschätzung oder Option formulieren." },
  { re: /\b(ist|wäre) (rechtlich )?(zulässig|unzulässig|wirksam|unwirksam|nichtig)\b/i, problem: "Rechtliche Würdigung des Einzelfalls", korrektur: "Als Auffälligkeit mit Frage an Notar oder Anwalt formulieren (RDG)." },
  { re: /\b(garantiert|sicher(e|er)? Rendite|ohne Risiko|risikolos)\b/i, problem: "Unzulässige Zusicherung", korrektur: "Unsicherheit und Annahmen benennen." },
];

function texte(x: unknown, pfad: string, aus: { pfad: string; text: string }[]) {
  if (typeof x === "string") aus.push({ pfad, text: x });
  else if (Array.isArray(x)) x.forEach((v, i) => texte(v, `${pfad}[${i}]`, aus));
  else if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) texte(v, pfad ? `${pfad}.${k}` : k, aus);
  return aus;
}

/** Regelprüfung im Code. Ein Modell prüft nur, wenn hier etwas anschlägt. */
export function regelpruefung(ergebnisse: Record<string, unknown>): Compliancebefund {
  const beanstandungen: Compliancebefund["beanstandungen"] = [];
  for (const [experte, erg] of Object.entries(ergebnisse)) {
    for (const t of texte(erg, "", [])) {
      for (const m of MUSTER) {
        const treffer = t.text.match(m.re);
        if (treffer) beanstandungen.push({ experte, stelle: `${t.pfad}: „…${t.text.slice(Math.max(0, (treffer.index ?? 0) - 30), (treffer.index ?? 0) + treffer[0].length + 30)}…“`, problem: m.problem, korrektur: m.korrektur });
      }
    }
  }
  return { freigabe: beanstandungen.length === 0, beanstandungen };
}
