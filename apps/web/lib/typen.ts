import type { Anlageprofil, Assetklasse, Investorenprofil, Objekt, Szenario } from "@highstack/engine";
import type { PaketId } from "./quellen";

/** Was ein Suchauftrag sucht: Objektklassen plus Grundstücke und Ferienimmobilien */
export type Suchklasse = Assetklasse | "Grundstück" | "Ferienimmobilie";

export type Status = "kandidat" | "pruefung" | "bestand";
export type Modulwerte = Record<string, Record<string, number | string | boolean>>;

export interface Profil {
  onboarded: boolean;
  investor: Investorenprofil;
  anlageprofile: Anlageprofil[];
  aktivesAnlageprofil: string;
  /** Gespeicherte Markt-Briefings, Schlüssel Region|Assetklasse */
  research?: Record<string, { region: string; asset: string; am: number; ergebnis: unknown; schritte: string[] }>;
  /** Gespeicherte Suchaufträge */
  suchen?: Suchauftrag[];
  /** Eigene Strategien fürs Durchspielen */
  strategien?: Strategie[];
  /** Experten an/aus; fehlt ein Eintrag, ist der Experte an */
  experten?: Record<string, boolean>;
  /** Karte „Erste Schritte“ auf der Übersicht ausgeblendet */
  ersteSchritteAus?: boolean;
  /** Bedienmodus: „unterstuetzt“ (Standard) blendet den Concierge ein, der fehlende Angaben erfragt */
  modus?: "selbst" | "unterstuetzt";
  /** Beantragte Kontolöschung: wird nach Ablauf der Frist ausgeführt, bis dahin abbrechbar */
  loeschung?: { beantragt: number; durch: string; ausfuehrung: number };
  /** Gebuchtes Paket; bis die Abrechnung aktiv ist, frei wählbar zum Ausprobieren */
  paket?: PaketId;
}

/** Ein Suchauftrag: was gesucht wird (Anlageprofil) und wo (Region, Assetklasse). Treffer hängen per suchId daran. */
export interface Suchauftrag {
  id: string;
  name: string;
  anlageprofilId: string;
  region: string;
  asset: Suchklasse;
  aktiv: boolean;
  notiz?: string;
  erstellt: number;
  /** letzte Sichtung von Inseraten */
  gesichtet?: number;
  /** Hintergrundsuche */
  hintergrund?: { aktiv: boolean; takt: "taeglich" | "mehrmals" | "stuendlich"; umkreisKm: number | null; quellen: string[] };
}

export interface Dokument {
  schluessel: string;
  titel: string;
  dateiId?: string;
  dateiname?: string;
  text?: string;
  status: "offen" | "angefordert" | "erhalten" | "geprueft" | "auffaellig";
  befund?: unknown;
}

export interface Expertenstand {
  ergebnis: unknown;
  schritte: string[];
  am: number;
  /** Fingerabdruck der Eingaben; gleich = Ergebnis wird wiederverwendet */
  hash?: string;
  verlauf: { rolle: "nutzer" | "experte"; text: string }[];
}

export interface Objektdatensatz {
  id: string;
  status: Status;
  anlageprofilId: string;
  /** Suchauftrag, aus dem der Treffer stammt */
  suchId?: string;
  objekt: Objekt;
  szenario: Partial<Szenario>;
  module: Modulwerte;
  expose: string;
  dokumente: Dokument[];
  experten: Record<string, Expertenstand>;
  compliance?: unknown;
  /** Wann welcher Reiter zuerst angesehen wurde (Fortschritt) */
  besucht?: Record<string, number>;
  erstellt: number;
  geaendert: number;
}

export interface Strategie { id: string; name: string; szenario: Partial<Szenario>; quelle: "eigen" | "vermoegen"; notiz?: string; erstellt: number }

export interface Nutzer { email: string; tenant: string; rolle: "inhaber" | "mitglied"; name?: string; eingeladenVon?: string; erstellt: number; letzterLogin?: number }
