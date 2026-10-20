import type { Anlageprofil, Assetklasse, Investorenprofil, Objekt, Szenario } from "@highstack/engine";

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
}

/** Ein Suchauftrag: was gesucht wird (Anlageprofil) und wo (Region, Assetklasse). Treffer hängen per suchId daran. */
export interface Suchauftrag {
  id: string;
  name: string;
  anlageprofilId: string;
  region: string;
  asset: Assetklasse;
  aktiv: boolean;
  notiz?: string;
  erstellt: number;
  /** letzte Sichtung von Inseraten */
  gesichtet?: number;
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
  erstellt: number;
  geaendert: number;
}
