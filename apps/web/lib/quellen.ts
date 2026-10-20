/**
 * Quellen und Pakete. Wo gesucht wird, ist Preissache: jedes Paket schaltet Quellengruppen frei.
 * Zugang immer rechtssauber: eigene Suchagent-Mails, Partner-Schnittstellen, Lizenzdaten oder öffentliche Register.
 * Kein Auslesen fremder Portale gegen deren Nutzungsbedingungen.
 */
export type PaketId = "basis" | "lokal" | "portale" | "familyoffice";
export type Quellstatus = "aktiv" | "vorbereitet" | "geplant";

export interface Paket { id: PaketId; name: string; fuer: string; preis: string; umfang: string[] }
export const PAKETE: Paket[] = [
  { id: "basis", name: "Basis", fuer: "Selbst einfügen und prüfen", preis: "Preis folgt", umfang: ["Inserate und Exposés einfügen", "1 Suchauftrag", "Prüfen, Durchspielen, Kurzurteil"] },
  { id: "lokal", name: "Lokal", fuer: "Ihre Region im Hintergrund", preis: "Preis folgt", umfang: ["Hintergrundsuche täglich", "Kleinanzeigen und lokale Quellen", "Umkreisfilter in km", "5 Suchaufträge"] },
  { id: "portale", name: "Portale", fuer: "Alle großen Märkte", preis: "Preis folgt", umfang: ["Hintergrundsuche mehrmals täglich", "Große Portale und Zwangsversteigerungen", "Experten-Team je Objekt", "unbegrenzte Suchaufträge"] },
  { id: "familyoffice", name: "Family Office", fuer: "Ganzer Zyklus bis zum Bestand", preis: "Preis folgt", umfang: ["Alles aus Portale", "Off-Market und Grundstücke", "Bestand, WEG-Verwaltung, Fristen", "mehrere Nutzer"] },
];
export const PAKET_RANG: Record<PaketId, number> = { basis: 0, lokal: 1, portale: 2, familyoffice: 3 };
export const paketName = (id: PaketId) => PAKETE.find(p => p.id === id)!.name;

export interface Quelle { id: string; name: string; gruppe: string; zugang: string; paket: PaketId; status: Quellstatus; lokal?: boolean }
export const GRUPPEN = ["Eigene Eingänge", "Lokal", "Portale", "Ferien & Inseln", "Versteigerungen", "Off-Market", "Grundstücke"] as const;
export const QUELLEN: Quelle[] = [
  { id: "einfuegen", name: "Inserate und Exposés einfügen", gruppe: "Eigene Eingänge", zugang: "Text oder PDF", paket: "basis", status: "aktiv" },
  { id: "mail", name: "Suchagent-Mails weiterleiten", gruppe: "Eigene Eingänge", zugang: "eigene Eingangsadresse je Suchauftrag", paket: "lokal", status: "vorbereitet" },
  { id: "kleinanzeigen", name: "Kleinanzeigen (eBay)", gruppe: "Lokal", zugang: "eigener Suchagent, Mail-Weiterleitung", paket: "lokal", status: "vorbereitet", lokal: true },
  { id: "zeitung", name: "Immobilienmarkt der Lokalzeitungen", gruppe: "Lokal", zugang: "Online-Rubriken, Partner", paket: "lokal", status: "geplant", lokal: true },
  { id: "maklerweb", name: "Makler-Websites der Region", gruppe: "Lokal", zugang: "Newsletter und Partner-Feeds", paket: "lokal", status: "geplant", lokal: true },
  { id: "sparkasse", name: "Banken-Immobilienportale der Region", gruppe: "Lokal", zugang: "Suchagent, Partner", paket: "lokal", status: "geplant", lokal: true },
  { id: "is24", name: "ImmoScout24", gruppe: "Portale", zugang: "eigener Suchagent per Mail, Partner-Schnittstelle", paket: "portale", status: "vorbereitet" },
  { id: "immowelt", name: "Immowelt / Immonet", gruppe: "Portale", zugang: "eigener Suchagent per Mail", paket: "portale", status: "vorbereitet" },
  { id: "aggregator", name: "Lizenzierte Anzeigen-Datenbanken", gruppe: "Portale", zugang: "Lizenz, viele Portale gebündelt", paket: "portale", status: "geplant" },
  { id: "ferienportal", name: "Ferienimmobilien-Portale (Inseln, Küste, Berge)", gruppe: "Ferien & Inseln", zugang: "eigener Suchagent per Mail, Partner", paket: "portale", status: "geplant" },
  { id: "inselmakler", name: "Inselmakler und regionale Spezialisten", gruppe: "Ferien & Inseln", zugang: "Newsletter, Netzwerk", paket: "portale", status: "geplant", lokal: true },
  { id: "ausland", name: "Ferienimmobilien im Ausland", gruppe: "Ferien & Inseln", zugang: "internationale Portale, Partner vor Ort", paket: "familyoffice", status: "geplant" },
  { id: "zvg", name: "Zwangsversteigerungen (ZVG-Portal)", gruppe: "Versteigerungen", zugang: "öffentliche Bekanntmachungen", paket: "portale", status: "geplant" },
  { id: "auktion", name: "Immobilien-Auktionshäuser", gruppe: "Versteigerungen", zugang: "Kataloge, Newsletter", paket: "portale", status: "geplant" },
  { id: "newsletter", name: "Makler-Newsletter und Netzwerk", gruppe: "Off-Market", zugang: "Weiterleitung, persönliche Kontakte", paket: "familyoffice", status: "vorbereitet" },
  { id: "verwalter", name: "Angebote über WEG-Verwalter", gruppe: "Off-Market", zugang: "Kontakte aus dem Bestand", paket: "familyoffice", status: "geplant" },
  { id: "kommune", name: "Grundstücksbörsen der Kommunen", gruppe: "Grundstücke", zugang: "öffentliche Ausschreibungen", paket: "familyoffice", status: "geplant", lokal: true },
  { id: "boris", name: "Bodenrichtwerte (BORIS)", gruppe: "Grundstücke", zugang: "öffentliches Register", paket: "familyoffice", status: "geplant" },
];
export const STATUS_TEXT: Record<Quellstatus, string> = { aktiv: "aktiv", vorbereitet: "vorbereitet", geplant: "geplant" };
export const verfuegbar = (q: Quelle, paket: PaketId) => PAKET_RANG[paket] >= PAKET_RANG[q.paket];
