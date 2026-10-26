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

## 0.18.0: Fotos von Aushängen und Anzeigen
- Neu: Bilder (JPG, PNG, WebP) werden per Texterkennung (Tesseract, Deutsch, lokal ohne externen Dienst) gelesen. Das Blatt wird vorher auf die helle Fläche zugeschnitten.
- „Neues Objekt“ → „Exposé oder Foto“: Kaufpreis, Wohnfläche, Miete, Ort, vermietet/leer und Titel werden übernommen; ist ein KI-Schlüssel gesetzt, sieht der Datenanalyst das Bild zusätzlich.
- Unterlagen: Fotos mit Anzeigenmerkmalen landen unter „Exposé & Inserat“ statt „Fotos“, der erkannte Text steht den Experten zur Verfügung.
- HEIC (iPhone) wird mit Hinweis abgelehnt: bitte als JPG teilen.
- Geprüft mit dem Aushang „Dachgeschosswohnung Düsseldorf-Mitte“ im Test, im Server und im eigenständigen Paket (ca. 5 s je Foto).

## 0.19.0: Außenfläche und Mietpfad nach Mietrecht
- Außenfläche (Balkon, Loggia, Terrasse, Dachterrasse, Wintergarten, Garten) mit Größe, Ausrichtung, „in Wohnfläche enthalten“ und Anrechnung nach Wohnflächenverordnung (Regelfall ein Viertel, höchstens die Hälfte). Gerechnet wird mit Wohnfläche + angerechnetem Anteil (Marktmiete, Preis je m²). Setzt der Anbieter mehr an (Aushang: 41,3 m² = Terrasse zur Hälfte), steht das als Hinweis dabei.
- Mietvertrag: Art (normal, Staffel, Index), letzte Mieterhöhung, angenommener Mieterwechsel, Regulierung am Ort, Ziel bei Neuvermietung. Erkennung aus Exposé, Text und Foto; Concierge fragt nach der letzten Erhöhung.
- Mietpfad (Rechenkern `mietrecht.ts`): § 558 mit 15 Monaten Sperrfrist (frühestens ab dem dritten Monat nach Übergang), Kappungsgrenze 15 % bzw. 20 % in drei Jahren, Obergrenze Vergleichsmiete; Neuvermietung mit Mietpreisbremse höchstens Vergleichsmiete + 10 % oder Vormiete; Index jährlich nach Inflation, Staffel nach Vertrag. Stand Oktober 2026 (NRW-Mieterschutzverordnung, Mietpreisbremse bis 2029; Mietrecht II nur als Hinweis).
- Kalkulation: Durchspielen rechnet standardmäßig „nach Mietrecht“ (Mietsteigerung = Entwicklung der Vergleichsmiete), umschaltbar auf „pauschal“. Playbook zeigt Mietpotenzial, Termine, Cashflow mit und ohne Anpassung, Eigenkapitalrendite mit/ohne, Kaufpreis für Cashflow ± 0 bei erreichter Vergleichsmiete und bei Neuvermietung.
- Experten Verwalter, Recht, Vermögen und Datenanalyst kennen Mietpfad und Außenfläche.

## Welle 3 (0.20.0, 26.10.2026)

| ID | Befund | Lösung |
|---|---|---|
| ✅ TRD-015 | „Eigene App“: Dollar-Kurse mit Euro-Einstand vermischt | Broker rechnet alle Kurse mit dem EZB-Referenzkurs in Euro um (zwölf Stunden zwischengespeichert, bei Ausfall der letzte Kurs, ganz ohne Kurs Fehler statt Vermischen); Hinweis mit Kurs und Stand auf den Order-Zetteln |
| ✅ INV-015, TRD-024 | Mobil zu breit | Panels und offene Aufklapper begrenzen ihre Spalte; Tabellen scrollen in ihrem Rahmen (gemessen: 390 px) |
| ✅ INV-045 | Admin mobil | Aktiver Reiter wird eingeblendet, Aktionsleiste fehlt im Admin, Prognosen mobil mit Begründung über die ganze Breite |
| ✅ INV-008, INV-011 | Endloses „Lädt …“, englische 404 | „Objekt nicht gefunden“ mit Link; deutsche 404-Seite mit Wegen zurück |
| ✅ INV-022 | Doppelklick legt doppelt an | Sperre in Suchauftrag- und Anlageprofil-Assistent |
| ✅ TRD-032 (Rest) | „Failed to fetch“ als Rohtext | Netzfehler werden zentral verständlich gemeldet |
| ✅ INV-016, TRD-025 | Neuladen verwirft Entwürfe | Entwürfe in Objekt-, Suchauftrag-, Anlageprofil-, Agent-Assistent und Onboarding überstehen ein Neuladen (Tab-Speicher, ohne Schlüssel); Abbrechen fragt nach, sobald etwas eingegeben ist |
| ✅ INV-024 | Profiländerung bei schnellem Neuladen verloren | Ausstehende Änderung wird beim Verlassen noch gesendet |
| ✅ TRD-011, TRD-012 | Vorlage überschreibt Strategie | Nach Schritt 3 setzt eine Vorlage nur die Grenzen; „Eigene App“ bleibt „Nur Long“ |
| ✅ TRD-013 | Werte-Eingabe | Erst groß schreiben, dann Doppelte prüfen; nur US-Kürzel, Fehler am Feld |
| ✅ TRD-018 | Liste/Startseite nach Tagesende „–“ | Tagesergebnis wird bei Ziel, Limit, Schluss und Not-Aus sofort festgehalten; Beträge in Kontowährung |
| ✅ TRD-021 | Eigene App ohne Kursquelle | Hinweis im Assistenten und Cockpit, Start ohne Zugang gesperrt |
| ✅ TRD-022 | Alpaca-Cockpit | Kopfzeile ohne abgebrochenen Text, „Keine Verbindung zu Alpaca“ statt „fetch failed“, Hinweis auf Paper-Kontostand, „seit Start“ ab erstem Handelstag |
| ✅ TRD-029 | Not-Aus ohne Zugang alarmiert | Ohne Handel und Positionen: „keine Orders gesendet“ |
| ✅ TRD-035 | Simulation am Samstag, Umfeld nach echtem Datum | Erster Simulationstag ist ein Werktag; Marktumfeld nach simuliertem Tag |
| ✅ INV-027, INV-033, INV-041, INV-051, TRD-036 | Zahlen, Daten, Einzahl/Mehrzahl, Meldungen | de-DE, „1 Wert“, Stand als MM/JJJJ, „Quelle nicht erreichbar“, Importfehler nennen Eingabe und gelesenen Wert mit Tipp; Tagesziel-Grenze wie auf dem Server |
| ✅ INV-042, INV-043 | Termine, Schrittweite | Rückfrage und Protokoll beim Entfernen, Hinweis bei vergangenem Datum; Schrittweite wird gemeldet |
| ✅ INV-035 | Kaputte Bilder/PDFs | Werden beim Hochladen geöffnet und sonst mit Grund abgewiesen |
| ✅ INV-036 | Link-Abruf ohne Gesamtzeitlimit | Fester Abbruch nach Ablauf |
| ✅ INV-044 | Wohnlage ändert Vergleichsmiete nicht | Wohnlage ermittelt die Vergleichsmiete neu, wenn sie ermittelt war |
| ✅ INV-052 | Bundrendite zu früh veraltet | Monatswerte gelten bis 100 Tage; danach „veraltet, Stand MM/JJJJ“ |
| ✅ INV-053 | Abschreibung der Kauf-Positionen unsichtbar | Eigene Zeile im Steuern-Reiter mit Hinweis auf anschaffungsnahe Herstellungskosten |
| ✅ INV-054 | „1,25 Mio. €“ | Wird gelesen |

Offen bleibt: echte Stopp-Orders beim Broker (Produktthema), Testdaten vor dem Betrieb löschen.
