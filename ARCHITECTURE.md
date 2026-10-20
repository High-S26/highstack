# Architektur

## Grundsatz: Rechnen und Urteilen trennen

Alle Zahlen kommen aus `@highstack/engine` (reine Funktionen, getestet). Die Agenten rechnen nicht selbst, sondern rufen das Rechenwerk über Werkzeuge auf. Dadurch sind Ergebnisse nachvollziehbar und reproduzierbar.

## Datenmodell

- **Investorenprofil** (wer investiert): Kapital, Finanzierung, Bundesland, Erwerbsstruktur, Steuersatz, Risiko, Bankannahmen.
- **Anlageprofil** (was gesucht wird, mehrere je Investor): Strategie, Regionen, Assetklassen, Preisrahmen, Renditeziel, Max-Faktor, Mindest-Cashflow, Haltedauer, Gewichte, K.O.-Kriterien.
- **Spielraum** = Kombination beider: max. Kaufpreis, Rate, nötige Rendite für Cashflow ± 0.
- **Objekt** mit Lebenszyklus Kandidat → In Prüfung → Bestand; dazu Einstellung im Durchspielen, aktive Gestaltungsmodule, Unterlagen (Text extrahiert), Expertenergebnisse mit Arbeitsschritten und Rückfrageverlauf.
- Jede Zeile ist mandantenbezogen (`tenant_id`). Anmeldung (Magic Link / Passkey) und Tarife sind vorbereitet, aber noch nicht aktiv; der Mandant kommt derzeit aus `HIGHSTACK_TENANT`.

## Agenten

```
Investor ──Auftrag──▶ Orchestrator (teamlauf)
                        ├─ Makler · Verwalter · Bank · Vermögen · Steuer · Recht   (parallel, begrenzt)
                        ├─ Projektentwickler   (wenn Gestaltungsmodule aktiv)
                        ├─ Dokumentprüfer      (wenn Unterlagen vorliegen)
                        ├─ Investment-Komitee  (liest die Berichte, rechnet Strittiges nach)
                        └─ Compliance          (prüft Beratungsgrenze, Annahmen, Rechtsstände)
```

- **Skill-Ordner:** `experts/<id>/SKILL.md` mit Frontmatter (Titel, Rolle, Werkzeuge, Modell, Ausgabeformat) und Rollenbeschreibung, Arbeitsweise, Prüfliste, Ergebnis. `_qualitaet.md` gilt für alle.
- **Werkzeuge:** `rechne_szenario`, `zielpreis`, `steuer_rechnung`, `lies_unterlagen`, `rechne_modul`. Jedes liefert Daten an das Modell und eine lesbare Zeile für das Arbeitsprotokoll.
- **Abgabe:** strukturiert über das Werkzeug `abgabe` mit JSON-Schema je Ausgabeformat (Bericht, Komitee, Compliance, Extraktion).
- **Modelle:** `HIGHSTACK_MODEL_EXPERT` für Fachexperten und Komitee, `HIGHSTACK_MODEL_FAST` für Compliance und Extraktion.
- **Testmodus:** ohne API-Key ein deterministischer Client, der jedes Werkzeug echt aufruft und Platzhalter abgibt. So sind Orchestrierung und Oberfläche ohne Kosten testbar.

## Qualität

- Unit-Tests für Rechenwerk und Agenten-Laufzeit (`npm test`).
- Nächster Schritt: Testset aus 20–30 echten Exposés mit Bewertung durch Praktiker; jede Änderung an Skills oder Werkzeugen läuft vor dem Livegang dagegen.

## Nächste Ausbaustufen

1. Anmeldung (Magic Link / Passkey), Mandanten und Rollen, Tarife.
2. Eingescannte PDFs (OCR bzw. Bildeingabe), Bilder von Unterlagen.
3. Automatische Sichtung von Suchagent-Mails und Newslettern; lizenzierte Marktdaten.
4. Management-Säule: Mieten, Darlehen, Fristen, Push-Hinweise.
5. PDF-Bericht je Objekt; Partnernetz (Steuerberater, Kanzlei, Finanzierung).
