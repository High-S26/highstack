# Testnutzer: gemeinsame Regeln

Zwei Testnutzer-Agenten prüfen highstack wie echte Nutzer:

- `.claude/agents/testnutzer-investments.md` prüft den Einstieg Investments.
- `.claude/agents/testnutzer-trading.md` prüft den Einstieg Trading.

Sie ändern keinen Code. Sie halten Befunde fest, die danach in einer Bugfix-Runde abgearbeitet werden.

## Umgebung

- Die App läuft unter der Adresse, die im Auftrag steht (Standard: `http://localhost:3100`, Produktions-Build mit `next start`).
- Die App läuft im Testmodus ohne Anmeldung. Ein Anthropic-Schlüssel fehlt in der Regel.
- Starte den Server nicht neu, beende ihn nicht und baue nicht neu. Ist er nicht erreichbar, halte das fest und höre auf.
- Den Quellcode darfst du lesen, um Ursachen einzugrenzen: `apps/web`, `packages/*`. Ändere ihn nicht.
- Benenne angelegte Daten mit einem Präfix (`QA-INV …` oder `QA-TRD …`), damit sich die beiden Testnutzer nicht in die Quere kommen.

## Werkzeuge

- **Browser:** Python-Playwright mit Chromium ist installiert (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`); führe `playwright install` nicht aus.
- **Skripte:** Schreibe sie in dein eigenes Arbeitsverzeichnis, nicht ins Repo.
- **Konsole und Netzwerk:** Sammle bei jedem Seitenaufruf Konsolenmeldungen (`page.on("console")`, `page.on("pageerror")`) und Antworten mit Status ≥ 400 (`page.on("response")`).
- **Belege:** Lege Bildschirmfotos im Ordner ab, der im Auftrag steht. Verweise im Befund auf den Dateinamen.
- **API:** Direkte Aufrufe mit `curl` sind erlaubt, um Grenzfälle und Sicherheit zu prüfen.
- **Rechnungen:** Prüfe sie selbst mit Python nach, nicht im Kopf.

## Befundformat

Die Befunddatei beginnt mit drei Angaben: Datum, geprüfter Stand (Commit) und eine Zeile Zusammenfassung mit der Anzahl je Schweregrad. Danach folgt je Befund ein Abschnitt:

```
### INV-001 · Kurzer Titel
- Schweregrad: Blocker | Hoch | Mittel | Niedrig | Hinweis
- Bereich: z. B. Objekt › Unterlagen
- Schritte: 1. … 2. … 3. …
- Erwartet: …
- Tatsächlich: …
- Beleg: bild.png, Konsole/HTTP-Status, ggf. Zahlen
- Vermutete Ursache: Datei:Zeile, falls im Code gefunden (sonst weglassen)
- Vorschlag: kurz, optional
```

### Schweregrade

- **Blocker:** Ein Hauptablauf ist unmöglich. Dazu zählen auch Datenverlust und Sicherheitslücken (Secrets sichtbar, Echtgeld trotz Sperre).
- **Hoch:** Falsches Ergebnis, etwa eine falsche Rechnung, eine nicht greifende Risikoregel oder eine irreführende Aussage. Ebenso ein Absturz in einem Nebenablauf.
- **Mittel:** Ein Ablauf ist umständlich oder verwirrend, eine Fehlermeldung ist unklar, die Darstellung auf dem Smartphone ist kaputt.
- **Niedrig:** Optik, Tippfehler, Zahlenformat.
- **Hinweis:** Verbesserungsidee aus Nutzersicht, kein Fehler.

## Ablauf

- Schreibe jeden Befund in die Datei, sobald du ihn findest, nicht erst am Ende.
- Kein Befund doppelt: Hat ein Fehler mehrere Erscheinungen, wird daraus ein Befund mit allen Fundstellen.
- Am Ende der Datei steht ein Abschnitt **Abdeckung** mit allem, was du geprüft hast, auch was ohne Befund blieb. Ebenso, was du nicht prüfen konntest, und warum.
