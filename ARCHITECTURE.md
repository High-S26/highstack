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

## Stufenmodell (Branch `light`)

| Stufe | Was | Modellaufrufe |
|---|---|---|
| 0 Rechnen | Kennzahlen, Spielraum, Szenarien, Sensitivität, Steuern, Gestaltungsmodule (`@highstack/engine`) | 0 |
| 1 Kurzurteil | Kernaussage, Fragen, Verhandlungsansatz (`/api/objekte/[id]/kurzurteil`) | 1 |
| 2 Einzelexperte | gezielt eine Rolle, Ergebnis gespeichert | 1–3 |
| 3 Teamlauf | Dokumentprüfer zuerst → Fachexperten mit seinen Befunden → Komitee → Compliance | ca. 10–20 |

- **Gate:** Bei Einstufung *Pass* ohne Gestaltung und ohne Unterlagen startet der Teamlauf nur mit „Trotzdem beauftragen“ (`erzwingen`).
- **Speicher:** Jeder Lauf erhält einen Fingerabdruck (`eingabeHash`: Kontext, Unterlagen, Zusatz, Skill-Version). Unverändert → gespeichertes Ergebnis, kein Aufruf.
- **Compliance:** zuerst Regelprüfung im Code (`compliance.ts`); das Modell prüft nur bei Treffern.
- **Modell je Rolle:** stark (`expert`) nur für Komitee, Recht, Projektentwicklung; übrige Rollen `fast`.
- **Weniger Werkzeuge:** Steuer ohne Werkzeuge, Verwalter/Bank nur Szenario bzw. Zielpreis; was im Kontext steht, wird nicht neu gerechnet.
- **Verbrauch:** Aufrufe, Tokens und Dauer werden je Lauf gemessen und in der Oberfläche angezeigt.
