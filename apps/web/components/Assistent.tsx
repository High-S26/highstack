"use client";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useApp } from "./App";

/**
 * Einheitliche Führung für alle Assistenten: oben Abbrechen und Schritte (erledigte anklickbar),
 * unten links Zurück, rechts der nächste Schritt. Abbrechen fragt nach, wenn schon etwas eingegeben ist.
 */
export function WizKopf({ schritte, aktuell, gehe, abbrechen, abbrechenText = "Abbrechen" }: { schritte: readonly string[]; aktuell: number; gehe?: (n: number) => void; abbrechen: () => void; abbrechenText?: string }) {
  return (
    <div className="wiz-kopf">
      <button type="button" className="btn ghost sm" onClick={abbrechen}>{abbrechenText}</button>
      <ol className="wiz-steps" aria-label="Schritte">{schritte.map((l, i) => {
        const n = i + 1; const zustand = n < aktuell ? "done" : n === aktuell ? "now" : "";
        const inhalt = <><span>{n < aktuell ? "✓" : n}</span>{l}</>;
        return <li key={l} className={zustand} aria-current={n === aktuell ? "step" : undefined}>{n < aktuell && gehe ? <button type="button" className="wiz-sprung" onClick={() => gehe(n)} title={`Zurück zu ${l}`}>{inhalt}</button> : inhalt}</li>;
      })}</ol>
    </div>
  );
}

export function WizFuss({ zurueck, weiter, weiterText = "Weiter", weiterAus, hinweis, links }: { zurueck?: () => void; weiter?: () => void; weiterText?: string; weiterAus?: boolean; hinweis?: ReactNode; links?: ReactNode }) {
  return (
    <div className="wiz-fuss">
      <div className="row">{zurueck && <button type="button" className="btn ghost" onClick={zurueck}>Zurück</button>}{links}</div>
      <div className="row">{hinweis && <span className="note">{hinweis}</span>}{weiter && <button type="button" className="btn" disabled={weiterAus} onClick={weiter}>{weiterText}</button>}</div>
    </div>
  );
}

/** Abbrechen mit Rückfrage, wenn Eingaben verloren gingen */
export function useAbbrechen(ziel: string, geaendert: boolean, text = "Ihre Eingaben in diesem Assistenten gehen verloren.") {
  const { frage } = useApp(); const router = useRouter();
  return async () => { if (!geaendert || await frage({ titel: "Abbrechen?", text, ja: "Abbrechen", nein: "Weiter bearbeiten", gefahr: true })) router.push(ziel); };
}
