# highstack

Ihr privates Family Office für Immobilien: Investments finden, prüfen, durchspielen, gestalten und von einem Team aus Experten-Agenten bewerten lassen. Information und fundierte Aufklärung, keine Beratung im Einzelfall.

## Schnellstart

```bash
npm install
cp .env.example .env        # ANTHROPIC_API_KEY eintragen; ohne Key läuft der Testmodus
npm run dev                 # App auf http://localhost:3000
npm test                    # Rechenwerk und Agenten
npm run team                # Teamlauf im Terminal mit dem Beispielobjekt
```

Ohne `DATABASE_URL` speichert die App in `apps/web/.data/`. Mit `DATABASE_URL` (Postgres) legt sie die Tabellen aus `apps/web/sql/001_init.sql` beim ersten Zugriff an.

## Aufbau

| Paket | Inhalt |
| --- | --- |
| `packages/engine` | Deterministisches Rechenwerk: Spielraum, Bewertung, Durchspielen, Sensitivität, Zielpreise, Steuern je Struktur, Gestaltungsmodule (Umnutzung, möbliert, Kurzzeit, Grundstück & Neubau mit Residualwert, Aufteilung, Aufstockung, Sanierung, Zusatzerträge) |
| `packages/agents` | Experten als Skill-Ordner (`experts/<id>/SKILL.md`), Werkzeuge auf dem Rechenwerk, Laufzeit mit Werkzeug-Schleife, Orchestrator (Fachexperten → Komitee → Compliance), Testmodus, CLI |
| `apps/web` | Next.js-App (mobil zuerst): Übersicht, Suchen, Prüfen, Portfolio, Experten, Profil; API-Routen mit Ereignisstrom für Teamläufe |

Mehr in [ARCHITECTURE.md](ARCHITECTURE.md).

## Experten ändern

Die Experten sind Skill-Ordner unter `packages/agents/experts/`. Nach einer Änderung:

```bash
npm run experts -w @highstack/agents   # übersetzt die SKILL.md-Dateien in experts.generated.ts
npm test
```

## Rechtlicher Rahmen

Ausgaben dienen der Information und Vorbereitung. Keine individuelle Steuerberatung (§ 5 StBerG), keine Rechtsdienstleistung im Einzelfall (RDG), keine Makler- oder Darlehensvermittlung (§§ 34c, 34i GewO). Die Experten übergeben Verbindliches als Fragen an Steuerberater, Notar, Anwalt oder Architekt; die Compliance-Rolle prüft jede Teamausgabe.
