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

## Trading-Assistent („Los geht’s“)

Einstieg im Trading-Modul: Ziel wählen (Tagestrade oder Rally), Spielgeld, Zielrendite bzw. Horizont und Richtung angeben, analysieren. highstack zeigt drei Optionen mit Wahrscheinlichkeiten aus der DAX-Historie (Ziel, Stopp, dazwischen) und dem Erwartungswert nach Gebühren. Umsetzen entweder automatisch über Scalable (Vorschau, Freigabe per Klick) oder Schritt für Schritt in jeder Broker-App (Suche, Kauforder mit Stückzahl und Limit, Stopp und Ziel). Offene Positionen werden überwacht und im Journal mit Ergebnis festgehalten.

## Lokales KI-Modell (Ollama)

Einzelne Experten können statt Claude ein lokales Modell nutzen, z. B. Qwen auf dem eigenen Mac. Die Daten verlassen den Rechner dann nicht.

1. Ollama installieren (ollama.com) und ein Modell laden: `ollama pull qwen3.5:9b` (ca. 5 GB, passt auf 16 GB Arbeitsspeicher).
2. Im Admin unter „KI-Modelle“ je Experte Claude oder das lokale Modell wählen.
3. Mit dem Vergleichslauf prüfen, wo das lokale Modell reicht: gleiche Aufgabe an beide Modelle, Bewertung gegen das Ausgabeschema, Dauer und Tokens.

Fällt das lokale Modell aus oder liefert es kein gültiges Ergebnis, rechnet highstack mit Claude weiter (abschaltbar, braucht `ANTHROPIC_API_KEY`).

## Trading mit Scalable Capital

highstack nutzt dafür ausschließlich die offizielle Scalable CLI (`sc`, github.com/ScalableCapital/scalable-cli), keine inoffiziellen Zugänge.

1. Scalable CLI installieren (macOS: `brew tap ScalableCapital/tap && brew install scalable-cli`).
2. Im Scalable-Web unter Profil → Sicherheit → Agentic Investing die CLI freischalten.
3. Im Terminal `sc login` (Anmeldung im Browser, hält höchstens sieben Tage). Empfohlen: in `~/.config/scalable-cli/config.toml` unter `[trade_controls]` eine Obergrenze `max_order_notional` setzen.
4. In `.env`: `SCALABLE_CLI=1`. Orders ausführen zusätzlich nur mit `TRADING_LIVE=1`.

Jede Order läuft in zwei Schritten: Vorschau von Scalable (Kurs, Kosten, Hinweise), dann Freigabe per Klick in highstack. Die Verbindung sehen nur Admins des Servers. Bei unklarem Ausgang einer Order sperrt highstack neue Orders, bis Sie die Umsätze in der App geprüft haben.

Das Panel „DAX heute“ unter Trading rechnet ein Signal zur Eröffnung (US-Vorabend, Asien, Trend, Vortag, Eröffnungslücke), lernt die Gewichte nur aus vergangenen Tagen und zeigt den Rückblick. Tageskurse kommen von Stooq oder als CSV-Upload.

## Rechtlicher Rahmen

Ausgaben dienen der Information und Vorbereitung. Keine individuelle Steuerberatung (§ 5 StBerG), keine Rechtsdienstleistung im Einzelfall (RDG), keine Makler- oder Darlehensvermittlung (§§ 34c, 34i GewO). Die Experten übergeben Verbindliches als Fragen an Steuerberater, Notar, Anwalt oder Architekt; die Compliance-Rolle prüft jede Teamausgabe.

## Online betreiben

Anleitung für Server, Domain, Anmeldung und Sicherung: [DEPLOY.md](DEPLOY.md). Lokal ohne `AUTH_SECRET` läuft die App ohne Anmeldung.
