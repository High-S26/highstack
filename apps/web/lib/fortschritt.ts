import type { Analyse } from "@highstack/engine";
import type { Objektdatensatz } from "./typen";

export const REITER = [["daten", "Daten"], ["ergebnis", "Ergebnis"], ["spielen", "Durchspielen"], ["gestaltung", "Gestaltung"], ["steuern", "Steuern & Struktur"], ["unterlagen", "Unterlagen"], ["experten", "Experten"]] as const;
export type Reiter = (typeof REITER)[number][0];
export type Zustand = "offen" | "begonnen" | "erledigt";

/** Objekt-Check: jeder Schritt offen, begonnen oder erledigt, nach festen Kriterien. Gilt in Objekt und Übersicht gleich. */
export function fortschritt(o: Objektdatensatz, a: Analyse) {
  const gesehen = (t: Reiter) => !!o.besucht?.[t];
  const pflicht = [o.objekt.kaufpreis, o.objekt.wohnflaeche, o.objekt.ort, o.objekt.leer ? 1 : o.objekt.miete, o.objekt.hausgeldNichtUmlagefaehig];
  const datenQ = pflicht.filter(x => x != null && x !== "").length / pflicht.length;
  const nDok = o.dokumente.filter(d => d.dateiId).length, nMod = Object.keys(o.module).length, nExp = Object.keys(o.experten).filter(k => k !== "kurzurteil").length;
  const schritt: Record<Reiter, { z: Zustand; was: string; tun: string }> = {
    daten: { z: datenQ >= 1 ? "erledigt" : datenQ > 0 ? "begonnen" : "offen", was: "Eckdaten vollständig", tun: "Eckdaten ergänzen" },
    ergebnis: { z: gesehen("ergebnis") && a.bewertung.score != null ? "erledigt" : "offen", was: "Ergebnis angesehen", tun: "Ergebnis ansehen" },
    spielen: { z: gesehen("spielen") ? "erledigt" : "offen", was: "Annahmen durchgespielt", tun: "Durchspielen" },
    gestaltung: { z: gesehen("gestaltung") ? "erledigt" : "offen", was: nMod ? `${nMod} Gestaltung geprüft` : "Gestaltung geprüft", tun: "Gestaltung prüfen" },
    steuern: { z: gesehen("steuern") ? "erledigt" : "offen", was: "Steuern verglichen", tun: "Steuern vergleichen" },
    unterlagen: { z: nDok ? "erledigt" : gesehen("unterlagen") ? "begonnen" : "offen", was: nDok ? `${nDok} Unterlagen hochgeladen` : "Unterlagen", tun: "Unterlagen hochladen" },
    experten: { z: o.experten.komitee ? "erledigt" : nExp || o.experten.kurzurteil ? "begonnen" : "offen", was: o.experten.komitee ? "Urteil des Komitees liegt vor" : "Experten", tun: "Experten fragen" },
  };
  const schritte = REITER.map(([k]) => k).filter(k => k !== "daten");
  const erledigt = schritte.filter(k => schritt[k].z === "erledigt").length;
  const naechster: Reiter | undefined = datenQ < 1 ? "daten" : schritte.find(k => schritt[k].z !== "erledigt");
  return { schritt, schritte, erledigt, naechster, datenQ };
}
