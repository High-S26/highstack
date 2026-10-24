# Bugliste für die Bugfix-Runde

**Grundlage:**
- Zwei Testnutzer-Agenten haben am 23.10.2026 den Stand 0.12 (Commit 8f13f38) im Produktions-Build geprüft. Der eine hat Investments durchgespielt, der andere Trading.
- Die Details stehen in den Befunddateien [befunde-investments.md](befunde-investments.md) und [befunde-trading.md](befunde-trading.md). Dort stehen zu jedem Befund Schritte, Erwartung und Beleg, oft auch die Fundstelle im Code.

**Umfang:** 60 Befunde.

| Schweregrad | Anzahl |
|---|---|
| Blocker | 2 |
| Hoch | 16 |
| Mittel | 24 |
| Niedrig | 13 |
| Hinweis | 5 |

**Nach jeder Runde:** Die beiden Agenten erneut laufen lassen (`.claude/agents/testnutzer-*.md`, Regeln in [TESTNUTZER.md](TESTNUTZER.md)). Erledigte Befunde bekommen dabei ein ✅ vor die ID.

## Welle 1: Sicherheit und Geld (vor jedem Online-Gang)

| ID | Befund | Grad |
|---|---|---|
| ✅ INV-017 | Gespeichertes XSS über hochgeladene Unterlagen (HTML als .png) | Blocker |
| ✅ INV-014 | Link-Auslesen folgt Weiterleitungen ohne erneute Adressprüfung (SSRF) | Hoch |
| ✅ TRD-001 | Echtgeld-Agent lässt sich trotz `TRADING_LIVE=0` per API anlegen, auf Automatik stellen und starten | Hoch |
| ✅ TRD-008 | Vorschlag mit beliebiger Stückzahl bestätigen umgeht alle Risikoregeln | Hoch |
| ✅ TRD-009 | Nach Verlustlimit/Tagesziel bleiben Vorschläge ausführbar; Positionen bleiben über Nacht offen | Hoch |
| ✅ TRD-007 | „Trades je Tag“ greift nicht (mehrere Einstiege je Takt, bestätigte Vorschläge) | Hoch |
| ✅ TRD-017 | Angehaltener Agent handelt bei „Jetzt prüfen“/„Tag durchspielen“, auch nach Not-Aus | Hoch |
| ✅ TRD-002 | Not-Aus scheitert ohne Broker-Zugang; Agent bleibt aktiv | Hoch |
| ✅ TRD-003 | Not-Aus meldet „alles geschlossen“, obwohl Schließen fehlschlug | Hoch |
| ✅ TRD-010 | Grenzwerte weder im Assistenten noch auf dem Server geprüft | Hoch |
| ✅ TRD-006 | API speichert ungültige Einstellungen; kaputtes JSON legt still einen Agenten an | Mittel |
| ✅ TRD-023 | Leerer Zugang überschreibt hinterlegten Alpaca-Zugang | Niedrig |
| ✅ INV-028 | Mietspiegel-API gibt Entwürfe und Pflegedaten an jeden Nutzer | Mittel |
| ✅ INV-029 | Google Fonts extern geladen, Datenschutzhinweis sagt das Gegenteil | Mittel |

**Ansatz:**
- **Eingaben prüfen:** Ein gemeinsamer Prüfer (`pruefeEinstellungen`) gilt für Assistent, POST und PUT.
- **Broker-Wahl:** Broker, die nicht freigegeben sind, werden schon beim Anlegen abgelehnt.
- **Risikomanager vor jeder Ausführung:** Er prüft vor jeder Order, auch vor bestätigten Vorschlägen. Die Stückzahl darf höchstens der vorgeschlagenen entsprechen.
- **Ende des Handelstags:** Offene Vorschläge verfallen bei Tagesziel, Limit oder Schluss.
- **Takt:** Nur ein aktiver Agent darf einen Takt ausführen. Eröffnungen zählen schon innerhalb desselben Takts.
- **Not-Aus:** Er hält den Agenten immer an, auch wenn der Broker fehlt. Die Meldung nennt das tatsächliche Ergebnis.
- **Dateien:** Sie werden mit dem MIME-Typ aus dem Inhalt ausgeliefert (Magic Bytes), dazu `Content-Disposition: attachment` und `X-Content-Type-Options: nosniff`.
- **Link-Auslesen:** Weiterleitungen werden von Hand verfolgt, bei jedem Schritt wird die Adresse erneut geprüft.

## Welle 2: Falsche Ergebnisse

| ID | Befund | Grad |
|---|---|---|
| ✅ INV-020 | Haltedauer 0 legt den ganzen Bereich Investments lahm | Blocker |
| ✅ INV-003 | Auslesen kehrt Verneinungen um (kein Erbbaurecht, unvermietet, kein Stellplatz) | Hoch |
| ✅ INV-004 | Stellplatz bekommt fremde Beträge (Kaufpreis, Hausgeld) | Hoch |
| ✅ INV-007 | Zielpreise „zum Angebot“ ohne Stellplatz, Playbook mit | Hoch |
| ✅ INV-019 | Steuern ignorieren eigene Positionen | Hoch |
| ✅ INV-018 | Ermitteln ohne KI: falsche Stadt durch Teilwort, Quelle „Modellwissen“ | Hoch |
| ✅ TRD-014 | Cockpit rundet Kurse, Stopp, Ziel auf ganze Euro | Hoch |
| ✅ TRD-004 | Dauerlauf bei Broker-Ausfall alle 5 s, Protokoll wächst unbegrenzt | Hoch |
| ✅ TRD-020 | Verlustlimit und Stopps nur am Minutenschluss geprüft | Mittel |
| ✅ TRD-016 | Stückzahl „70.895“ liest sich als siebzigtausend (Bruchstücke im de-Format) | Mittel |
| ✅ TRD-015 | Währung durchgängig €, obwohl US-Werte in USD | Mittel |
| ✅ TRD-019 | Protokoll reicht zum Nachrechnen nicht | Mittel |
| ✅ INV-021 | API speichert unsinnige Objektdaten, Bewertung trotzdem „Watch 64“ | Mittel |
| ✅ INV-026 | Portfolio: Kaufpreise ohne Stellplätze, EK im Bestand falsch benannt | Mittel |
| ✅ INV-001 | Risikoneigung ändert an den Rechnungen nichts | Mittel |
| ✅ INV-002 | Zahlenfelder nehmen negative und absurde Werte an | Mittel |
| ✅ INV-005, INV-006 | Kaufpreis-Schreibweisen nicht erkannt; Ort aus der Makleradresse | Mittel |

**Ansatz:**
- **Grenzen der Zahlenfelder:** Eine Feldbeschreibung mit Grenzen (min/max) gilt für die Oberfläche und für die API.
- **Verneinungen beim Auslesen:** Die Erkennung bekommt ein Fenster für Verneinungen („kein“, „ohne“, „un-“), dazu Tests mit den Belegtexten der Befunde.
- **Kurse anzeigen:** Kurse mit 2 Nachkommastellen, Stückzahlen ohne Tausenderpunkt.
- **Währung:** Die Kontowährung kommt vom Broker.

## Welle 3: Bedienung, Darstellung, Texte

Alle übrigen Befunde mit „Mittel“ und „Niedrig“, zum Beispiel:
- **Navigation:** Lädt endlos (INV-008), 404 auf Englisch (INV-011), mobile Breite (INV-015, TRD-024).
- **Abläufe:** Doppelklick legt doppelt an (INV-022).
- **Daten:** Verlust beim Neuladen (INV-016, INV-024, TRD-025), der Assistent setzt Strategie zurück (TRD-011, TRD-012).
- **Werte-Eingabe:** TRD-013.
- **Anzeige:** Liste und Startseite nach Tagesende (TRD-018), eigene App ohne Kursquelle (TRD-021), Alpaca ohne Kontostand (TRD-022).
- **Zahlenformate:** INV-027, INV-033.

Die Hinweise (INV-010, INV-025, INV-031, TRD-026, TRD-027) gehören in den Produktbacklog.

## Nachtest Welle 1 (24.10.2026, Stand e72a4e5)

Alle 15 Befunde aus Welle 1 sind bestätigt behoben. Die Einzelheiten stehen in [nachtest-welle1-investments.md](nachtest-welle1-investments.md) und [nachtest-welle1-trading.md](nachtest-welle1-trading.md).
- INV-028 ist nur im Code belegt, weil im Testmodus jeder Admin ist.
- TRD-004: Der Agent hält bei Dauerfehlern nicht von selbst an.

Neue Befunde: 21. Davon sind 4 hoch, 8 mittel, 8 niedrig, 1 ist ein Hinweis. Der Forecast-Teil wurde dabei zum ersten Mal geprüft.

### Kommt in Welle 2 (falsche Ergebnisse)

| ID | Befund | Grad |
|---|---|---|
| ✅ INV-037 | Konjunktur-Import übernimmt falsche Werte ohne Warnung (Komma-Trenner, ungültige Daten), Folge: Anschlusszins 71,40 % | Hoch |
| ✅ INV-038 | Veraltete Bundrendite gilt als „aktuelle Marktdaten“ | Hoch |
| ✅ TRD-030 | Marktumfeld verkleinert Positionen nicht, wenn die Höchstposition begrenzt; das Cockpit verspricht trotzdem 38 % | Hoch |
| ✅ TRD-026 | Vorschlag lässt sich bestätigen, obwohl der Kurs schon unter dem Stopp liegt; offene Vorschläge blockieren das Tageslimit (hochgestuft) | Hoch |
| ✅ TRD-034 | Veraltete Marktdaten steuern die Positionsgröße, ohne Altersgrenze und ohne Datum | Mittel |
| ✅ TRD-031 | Neuer Termin wirkt erst nach bis zu 10 Minuten | Mittel |
| ✅ INV-039 | Rückblick wird nicht gespeichert: „Überprüfung“ und Gewichte bleiben leer | Mittel |
| ✅ INV-040 | „Lauf jetzt“ legt nach neuen Daten am selben Tag keine Prognosen an | Mittel |
| ✅ INV-034 | Upload mehrerer Dateien: eine ungültige verwirft die gültigen, verwaiste Dateien bleiben liegen | Mittel |
| ✅ TRD-028 | „Bitte eine Zahl angeben.“ nennt das Feld nicht; `symbole` als Text wird still ersetzt | Mittel |
| ✅ TRD-032, TRD-033 | Marktumfeld im Cockpit: Fehler beim Umschalten unbemerkt, Anzeige wird nicht aktualisiert | Mittel |

### Kommt in Welle 3

INV-035, INV-036, INV-041, INV-042, INV-043, INV-045, TRD-029, TRD-035, TRD-036 (niedrig), INV-044 (Hinweis).

### Testdaten aufräumen

Auf dem Testserver liegen künstliche Konjunkturreihen: `bund10j`, `immo-preis`, S&P 500, VIX 35,8 und ein Termin am 25.10. Auf echten Servern dürfen sie nie landen.

## Nachtest Welle 2 (24.10.2026, Stand 7b30665)

Einzelheiten: [nachtest-welle2-investments.md](nachtest-welle2-investments.md), [nachtest-welle2-trading.md](nachtest-welle2-trading.md).

- **Investments:** 13 von 17 Befunden sind behoben, 4 teilweise.
- **Trading:** 7 von 12 sind behoben, 5 teilweise.
- **Neu:** 14 Befunde, darunter ein Blocker, den die neue Serverprüfung eingeführt hatte: INV-047, die Rücklage sperrte jede Änderung am Objekt.
- **Nachgerechnet:** Steuern mit Küche, Zielpreise, Treffsicherheit sowie 22 Simulationstage aus dem Protokoll. Alle stimmen.

### Danach behoben (117dc15 und folgende)

| ID | Befund | Grad |
|---|---|---|
| ✅ INV-047 | Serverprüfung sperrte das Objekt (Rücklage in € als 0–1 geprüft). Jetzt werden ungültige Felder verworfen und gemeldet, der Rest wird gespeichert, und die Seite zeigt den Grund. | Blocker |
| ✅ INV-049 | Falsche Datentypen per API legten Seiten lahm. Jetzt werden Typen geprüft; dazu Grundprüfung für Szenario und Profil. | Mittel |
| ✅ INV-048 | Zu große Eingaben wurden auf den letzten Zwischenstand gekürzt. Jetzt gilt der Wert von vor der Eingabe, mit Meldung. | Mittel |
| ✅ INV-046 | „Stellplatz“, „Hotel“ und ähnliche Wörter galten als Makler-Kontaktzeile | Mittel |
| ✅ INV-050 | Erbbaurecht und Sonderumlage werden angezeigt und sind vor dem Anlegen korrigierbar | Mittel |
| ✅ INV-003 | „Erbbaurecht: nein“ und „Sonderumlage: keine“ | Rest |
| ✅ INV-037 | Leerzeichen als Trenner; „1.085“ wird über die Grenzen entschieden, sonst nachgefragt | Rest |
| ✅ INV-001 | Profiltext verspricht kein Energieklasse-K.O. mehr, das nicht gesetzt wird | Rest |
| ✅ TRD-020 | Stopps in der Simulation zum Stopp-Kurs | Rest |
| ✅ TRD-026 | Stückzahl beim Bestätigen zum aktuellen Kurs | Rest |
| ✅ TRD-037 bis 041, TRD-016, 028, 032 | siehe Commit 117dc15 | Mittel/Niedrig |

**Noch offen:**
- **TRD-015:** Bei „Eigene App“ werden USD-Signalkurse mit dem EUR-Einstand verrechnet. Dafür fehlt die Wechselkurs-Umrechnung.
- **INV-015:** Die Forecast-Tabelle ist auf dem Handy zu breit.
- **Niedrig und Hinweise** aus beiden Nachtests (Welle 3).
- **Testdaten:** Vor echtem Betrieb Testreihen, Rückblick und Gewichte im Admin zurücksetzen.

## Konjunktur & Prognosen: Prüfumfang für künftige Läufe

Der Forecast-Teil (Version 0.13) war nicht Gegenstand dieses Laufs. Im nächsten Lauf prüfen:
- **Admin › Konjunktur & Prognosen:**
  - Einfügen von Reihen, Termine anlegen und entfernen.
  - Rückblick rechnen.
  - Den Lauf jetzt starten.
- **Trading-Cockpit:**
  - Marktumfeld anzeigen und abschalten.
  - Treffsicherheit der Signale nachrechnen, mit Ergebnis und R je Trade.
- **Investments › Durchspielen › Marktszenarien:**
  - Grundlage „Marktausblick“ prüfen.
  - Bundrendite als Swap-Näherung prüfen, wenn keine Marktberichte vorliegen.
- **Echte Datenquellen:**
  - FRED und das EZB-Datenportal sind aus der Testumgebung gesperrt, deshalb nur auf dem eigenen Rechner oder dem Server prüfen.
