# Nachtest Bugfix-Welle 3 · Trading

- Datum: 2026-10-26
- Geprüfter Stand: Commit c1622d9, Version 0.20.0. Eigener Produktions-Build aus `git archive` in `/home/claude/qa-trd`, `next start` auf Port 3300, frische Daten in `/home/claude/qa-trd/apps/web/.data`. Testmodus ohne Anmeldung, ohne Anthropic-Schlüssel, ohne `TRADING_LIVE`, ohne Zugang zu Alpaca und EZB, keine Konjunkturreihen.
- Zusammenfassung: 14 alte Befunde nachgeprüft: 9 behoben, 5 teilweise, 0 nicht behoben. Neue Befunde: Blocker 0, Hoch 1, Mittel 4, Niedrig 2, Hinweis 0.

Belege: `/tmp/claude-0/-home-claude/a63e209a-47ca-5889-84a9-ed4a4c2b741b/scratchpad/qa-belege/trd4/`
Skripte: `/tmp/claude-0/-home-claude/a63e209a-47ca-5889-84a9-ed4a4c2b741b/scratchpad/qa-skripte/trd4/`
- `w4_wiz.py` / `w4_wiz_b.py`: Assistent
- `w4_cockpit.py`, `w4_rest.py`, `w4_del.py`: Cockpit, Liste und Startseite
- `w4_umfeld.py`: Marktumfeld je Simulationstag
- `ts/wochenende.mts`: Datum gemockt
- `ts/trd015.mts`: Eigene App mit Wechselkurs
- `lauf.py` und `auswertung.py`: Nachrechnung

## Teil A: Nachprüfung

| ID | Status | Beleg |
|---|---|---|
| TRD-011 | behoben | Originalschritte: Schritt 2 Tagesziel 77, dann Schritt 3 „Rückkehr zum Mittelwert“, 3 σ, „Long und Short“, danach zurück zu Schritt 2 und Startkapital 5000. Ergebnis in Schritt 3: Mittelwert, z 3, Long und Short bleiben erhalten. Tagesziel und Limit ziehen auf 50/50 mit. Vorlage „Aktiv“ nach Schritt 3: Meldung „Grenzen aus der Vorlage übernommen, Ihre Strategie bleibt.“, Strategie bleibt (`a011_vorlage_toast.png`). **Neuer Weg, über den der Fehler zurückkommt:** Neuladen in Schritt 2, siehe TRD-046. |
| TRD-012 | behoben | Eigene App, dann Vorlage „Ausgewogen“ und „Aktiv“: Ergebnis „Nur Long“ gedrückt, „Long und Short“ gesperrt und nicht gedrückt. Die Zusammenfassung zeigt „nur Long“, „Automatik“ ist gesperrt. Wechsel von Simulation mit Long/Short zu Eigene App: „Nur Long“. Über die API wird `manuell` mit `long-short`/`auto` als `long`/`vorschlag` gespeichert (`api_sicherheit.txt`). |
| TRD-013 | teilweise | Oberfläche behoben: `aapl` bei vorhandenem AAPL erzeugt keinen Doppelten. „!!x$“, „sap.de“ und „xyz1“ werden abgewiesen, der Text bleibt im Feld, die Meldung steht am Feld. „brk.b, spy; xyz1, spy“ ergibt BRK.B und SPY, die Fehlermeldung nennt XYZ1. Komma und Klick daneben fügen ebenfalls hinzu. Nach dem Entfernen bleibt kein Geister-Chip, „+ AAPL“ wird wieder angeboten. Ohne Werte erscheint „Mindestens einen Wert angeben.“ und „Weiter“ ist gesperrt (`a013_ungueltig.png`, `a013_keine_werte.png`). **Offen:** Der Server prüft anders als die Oberfläche. Per API wird `["sap.de","brk.b"]` als `SAP.DE` angenommen und in der Simulation gehandelt (`packages/trading/src/pruefung.ts:23`, `SYMBOL = /^[A-Z][A-Z0-9.]{0,9}$/`, gegenüber `/^[A-Z]{1,5}(\.[A-Z])?$/` in `trading/neu/page.tsx`). Die Oberfläche nennt SAP.DE ausdrücklich als nicht lieferbar. |
| TRD-015 | behoben (Code, Test, Skript) | Mit Alpaca und der EZB nicht live prüfbar. Der Vitest-Abschnitt TRD-015 läuft grün (30/30 im Paket trading). Eigenes Skript `trd015.mts` mit `takt()` gegen `manuellerBroker`, künstliche USD-Kerzen und Kurs 1,08 $/€ über einen ganzen Tag: Signalkurse sind exakt USD/1,08 (z. B. AAPL 158,04 $ → 146,3333 €). Stopp und Ziel sind in Euro, das Risiko liegt im Budget (49,08 € bzw. 50,00 € bei 50 €). Bewertung, G/V und Konto stimmen in jeder geprüften Minute mit der Nachrechnung überein, die Kontowährung ist EUR. Das Tagesziel greift in Euro (+204,07 €), es gab 1 EZB-Abruf für den ganzen Tag (Zwischenspeicher wirkt). Ohne Kurs bei fehlgeschlagenem Abruf kommt ein Fehler statt einer Vermischung: „Wechselkurs US-Dollar/Euro nicht verfügbar (offline). Ohne Umrechnung würden Dollar-Kurse mit Euro-Beträgen vermischt.“ Eine EZB-CSV mit Titeln in Anführungszeichen wird richtig gelesen (1,1612, Stand 2026-10-23) (`trd015_skript.txt`). Hinweise: Assistent „Pflicht für ‚Eigene App‘ …“, Cockpit „Ohne Kursquelle …“, der Order-Zettel-Text nennt Kurs und Stand (Code). Ohne Zugang startet der Agent nicht (siehe TRD-021). Folgeprobleme der Umrechnung: TRD-044. |
| TRD-016 | teilweise | Karte behoben: „Kauf 11,372 × AMD“ (`c016_karte_bruch.png`). „Bestätigt: …“ trägt jetzt die Simulationszeit („10:21 (Simulation) Bestätigt: Verkauf 70 NVDA zu 42,39“). **Offen:** „Vorschlag … abgelehnt“, „Agent gestartet“, „Agent angehalten“ und „Broker-Zugang hinterlegt“ stehen weiter mit Echtzeit zwischen den Simulationszeilen. Beispiel aus dem Protokoll von oben nach unten: „09:42:34 Info Vorschlag AMD abgelehnt“ über „10:06 (Simulation) Order Vorschlag …“; „09:35:21 Info Agent gestartet“ über „10:05 (Simulation) Bestätigt …“. Die Echtzeit 09:35 sieht aus wie eine Marktzeit und steht vor 10:05 (`b016_protokoll.png`, `c_rest.txt`). Ursache: `apps/web/app/api/trading/[id]/aktion/route.ts`, `protokoll(…, jetzt())` bei start, stopp, abgelehnt und zugang. |
| TRD-018 | teilweise | Behoben für angehaltene Agenten: Nach „tag“ und „stopp“ zeigen Liste und Startseite „−49,19 €“, „−98,93 €“ (Limit), „−20,83 €“ (Limit), Not-Aus „±0,00 €“, Alpaca in „$“ (`b018_liste.png`, `c_rest.txt`). **Offen:** Ein laufender Simulationsagent springt sofort in den nächsten Handelstag. Nach „Rest des Tages sofort durchspielen“ zeigt das Cockpit „heute +0,00 € · Trades 0 / 6 · Heute läuft“. Liste und Startseite zeigen „läuft“. Das Ergebnis des gerade gespielten Tages (−49,19 €, 3 Trades, Schluss) steht nur unten im Verlauf (`b018_cockpit_tag.png`). Protokoll: „15:45 (Simulation) … alle Positionen geschlossen“, direkt darauf „09:30 (Simulation) Neuer Handelstag“. Ursache: Die Aktion `tag` endet bei Minute 0 des Folgetags, der Dauerlauf startet ihn im nächsten Takt (≤ 5 s). Ebenso aus dem Code: Bei „Eigene App“ setzt `allesSchliessen` `tag.ende` nicht (`!b.nurZettel`), also steht nach Ziel oder Limit bis Marktschluss „–“. Vorschlag: Nach Handelsschluss in der Simulation anhalten oder das Ergebnis „Vortag“ anzeigen, bis der Nutzer weiterspielt. |
| TRD-021 | behoben | Eigene App ohne Zugang: Assistent „Pflicht für ‚Eigene App‘: Ohne diesen Zugang kann der Agent keine Kurse lesen und startet nicht.“ Im Cockpit ein roter Hinweis. „Starten“ gibt 400 „Ohne Kursquelle kann der Agent keine Signale erzeugen. Bitte den kostenlosen Alpaca-Datenzugang hinterlegen.“ und der Agent bleibt angehalten (`b021_M.png`). Mit erfundenem Zugang startet er (`b021_M2.png`). |
| TRD-022 | behoben (ohne Verbindung) | Kopf „Alpaca Paper · keine Verbindung“, kein abgebrochener Text. Mit erfundenen Schlüsseln erscheint „Keine Verbindung zu Alpaca. Kontostand und Kurse erscheinen, sobald die Verbindung steht.“, ohne Schlüssel „Bitte Alpaca-Zugang … hinterlegen.“. Hinweis zum Paper-Kontostand (100.000 $), Startkapital in der Liste „100.000,00 $“, im Assistenten Hinweis am Feld (`b022_P.png`, `b022_P2.png`). „Seit Start ab dem ersten Handelstag“ ist ohne Alpaca nicht prüfbar und nur im Code gesehen. |
| TRD-024 | behoben | 390 px: scrollWidth 390 in allen vier Schritten des Assistenten (Eigene App mit Zugangsfeldern), auf Start, Liste und Cockpit (Simulation, Alpaca, Eigene App), Aufklapper geöffnet. Kein Element ragt über 391 px hinaus (`a024_m_schritt1…4.png`, `b_m_*.png`). Optik siehe TRD-048. |
| TRD-025 | behoben | Alpaca mit Schlüsseln in Schritt 1, dann „Abbrechen“: Rückfrage „Abbrechen? Ihre Eingaben in diesem Assistenten gehen verloren.“ (`a025_abbrechen_dialog.png`). Bis Schritt 3 ausgefüllt (Startkapital 100.000, Name, Auffälligkeiten, QQQ), dann neu geladen: Schritt 3 mit allen Werten, Schritt 2 mit Startkapital und Name. **sessionStorage:** nur `hs_entwurf_agent` mit Einstellungen, keine Key-ID und kein Secret (Suche nach beiden Testwerten negativ, vor und nach Neuladen). Verlassen über den Link „Trading“ löscht den Entwurf. Folgeprobleme: TRD-046, TRD-047. |
| TRD-029 | teilweise | Alpaca ohne Zugang, nie gestartet, dann Not-Aus: „Not-Aus: Agent angehalten. Er hatte noch nicht gehandelt, es sind keine Positionen bekannt.“ (`b029_notaus_paper.png`). **Offen:** Eigene App ohne Zugang, nie gestartet, dann Not-Aus: „Not-Aus: Agent angehalten; bitte offene Positionen in der App schließen.“ Das klingt, als gäbe es offene Positionen (`b_cockpit.txt`). Ursache: `packages/trading/src/agent.ts`, `notaus()`, Zweig `b.nurZettel` ohne Prüfung auf Bestand. |
| TRD-032 | teilweise | Knöpfe behoben: Bei abgebrochener Anfrage melden „ignorieren“ „Nicht gespeichert: keine Verbindung zum Server“, „Anhalten“ und „Jetzt prüfen“ „Keine Verbindung zum Server. Bitte Verbindung prüfen und erneut versuchen.“ (`b032_netzfehler.png`). **Offen:** Das Neuladen alle 5 s (`lade` in `apps/web/app/trading/[id]/page.tsx:20`) hat kein `catch`. Während des Ausfalls kommt alle 5 s `pageerror: Failed to fetch`, und das Cockpit zeigt die alten Zahlen ohne Hinweis, dass sie nicht mehr aktuell sind. Für einen Agenten, der handelt, ist das heikel. Weitere Stellen: TRD-045. |
| TRD-035 | behoben | Datum gemockt (`wochenende.mts`): Sa 31.10. → erster Simulationstag Mo 02.11.; So 01.11. und So abends New York → Mo 02.11.; Fr bleibt Fr; Fr 30.10. Minute 390 → Mo 02.11. Marktumfeld nach Simulationstag: Termin „QA-TRD W3 Zinsentscheid“ am 28.10. angelegt. Danach spielte derselbe Agent 26.10. mit 100 %, 27.10. mit 38 % (NVDA 36 statt 97 Stück wie ohne Umfeld, 97 × 0,375 = 36), 28.10. kleiner (AAPL 11,855 statt 31,507), 29.10. wieder 100 %. Das echte Umfeld für heute blieb 100 %. Der Zwischenspeicher je Tag wurde beim Anlegen des Termins geleert: Agent U1 hatte den 27.10. vorher mit 100 % gerechnet, U2 bekam danach 38 % (`umfeld_sim.txt`). Rest, ohne Befund: US-Feiertage (Thanksgiving, 25.12.) sind in der Simulation Handelstage. |
| TRD-036 | behoben | Feldhinweise in de-DE: „Erlaubt: 0,05 bis 5“, „Erlaubt: 100 bis 10.000.000“. Jede Meldung erscheint nur einmal, keine zweite Liste. Tagesziel 0,5 wird angenommen, wie auf dem Server (API: 0,5 → 200, 0 → 400) (`a036_randwerte.png`). Im Marktumfeld gab es mangels VIX-Daten keine Zahl, siehe Rückblick und Gründe „VIX fehlt oder ist veraltet“. |

## Teil B: Regressionen

- **Kompletter Weg Simulation:** Die Agenten S1 (Ausbruch, Limit 60 €) und S2 (Mittelwert, Limit 20 €, 1 Position, 2 Trades) liefen je 5 Tage. Mit `auswertung.py` aus dem Protokoll nachgerechnet (`auswertung_S1.txt`, `auswertung_S2.txt`):
  - Die Summe der Orders ergibt an allen 10 Tagen das gebuchte Tagesergebnis, mit höchstens 0,01 € Rundung.
  - Trades je Tag und Positionen gleichzeitig wurden nie überschritten, am Handelsende war nie etwas offen.
  - Risiko je Trade und Höchstposition wurden bei allen Einstiegen eingehalten, die Mindest-Chance ebenso.
  - Handrechnung S1 am 28.10.: 7,107 × (156,06 − 157,14) − 27 × (35,96 − 35,25) − 7 × (155,07 − 153,99) + 27,671 × (35,94 − 36,65) = −54,05 €. Konto 9.922,46 → 9.868,41 €, das ist der Start am 29.10. ✔
  - **Überschreitungen des Verlustlimits:** S1 am 26.10. −63,24 € und am 30.10. −98,93 € bei 60 €, siehe TRD-042 und TRD-043. S2 an drei Tagen −20,83 bis −21,95 € bei 20 €. Das liegt an der Spanne und entspricht dem Hinweis TRD-041.
  - Das Tagesergebnis steht in Liste und Startseite (siehe TRD-018).
- **Not-Aus:** Simulation mitten im Tag: Rückfrage, dann „Not-Aus: Agent angehalten, keine Positionen offen.“; Liste „±0,00 €“. Alpaca und Eigene App: siehe TRD-029.
- **Vorschläge mit Verfall:** „Kurs schon jenseits von Stopp oder Ziel“ nach 6 Minuten, „nach 15 Minuten veraltet“ bei AMD 10:06 → 10:22 (zählt jetzt Minuten, TRD-040 wirkt). Bestätigen nach Verfall → 400 „Vorschlag nicht mehr offen“. Bestätigen innerhalb der Frist → 200 mit Simulationszeit (`vorschlag.txt`, `verfall2.txt`). Ablehnen über die Oberfläche funktioniert.
- **Rückblick:** künstliche Kurse, 03.08. bis 30.09.2026, mit Varianten: „Rückblick gerechnet“, 43 Handelstage, Endwert 9.328,26 €, Kennzahlen in de-DE. „bis heute“ gibt „Der Zeitraum muss vor heute enden.“ (`c_rueckblick.png`). Aus dem Code: Bei Eigene App mit Alpaca-Daten rechnet der Rückblick in $ und liest das Startkapital als $. Mangels Zugang nicht prüfbar.
- **Marktumfeld:** siehe TRD-035; Faktor 0,375 bei Termin ohne VIX ✔.
- **Mobil 390 px:** alle Trading-Seiten ohne waagerechtes Scrollen (TRD-024).
- **Entwurf und sessionStorage:** siehe TRD-025, keine Schlüssel im Tab-Speicher.
- **Sicherheit (API):**
  - `GET /api/trading` mit 23 Agenten und `GET /api/trading/[id]` für alle 4 Alpaca- und Eigene-App-Agenten: kein `secret`, keine `keyId`, keine Testschlüssel; nur `zugangHinterlegt`.
  - `alpaca-live` → 400 „Handel mit echtem Geld ist auf diesem Server gesperrt.“
  - Kaputtes JSON und leerer Körper → 400, `{}` → 400 „Einstellungen fehlen.“
  - Fremde ID bei GET, aktion und DELETE → 404, unbekannte Aktion → 400.
  - Nur `name` → Agent mit Standardwerten (gewollt) (`api_sicherheit.txt`).
- **Mehrfachbetrieb:** 2 Agenten, 40 gleichzeitige `takt`: alle 200, genau +20 Minuten je Agent, keine doppelten Orders (`parallel.txt`). Neuladen im laufenden Tag: Uhr läuft weiter, Protokoll erhalten.
- **Konsole:** keine Fehler außer bei absichtlich erzeugten Netzfehlern (TRD-032, TRD-045).

## Neue Befunde

### TRD-042 · Verlustlimit und Stopp in derselben Minute: Die Position wird zum Minutenschluss statt zum Stopp-Kurs geschlossen
- Schweregrad: Hoch
- Bereich: Risikoregeln › Verlustlimit / Stopp (Simulation; bei Alpaca gilt dasselbe Prinzip)
- Schritte: 1. Agent S1: 10.000 €, Risiko 0,5 %, Limit 60 €, Ausbruch, Long/Short, Automatik 2. 5 Tage per `tag` durchspielen 3. Protokoll mit den Kerzen vergleichen (`auswertung.py`)
- Erwartet: Wird der Stopp in einer Minute berührt, wird zum Stopp-Kurs geschlossen (TRD-020, Welle 2). Das Verlustlimit greift nur für das, was danach noch offen ist.
- Tatsächlich: 26.10., AAPL Short 17 Stück zu 154,40, Stopp 157,27. In der Minute 11:29 liegt das Hoch bei 158,09 und der Schluss bei 158,04. Statt des Stopps greift zuerst das Verlustlimit („Verlustlimit erreicht (−61,88 €, mit Schließkosten −63,22 €)“), geschlossen wird zu 158,12. Ergebnis −63,24 € = −1,33 R. Mit dem Stopp-Kurs wären es −50,15 €, also innerhalb des Limits von 60 €. 30.10., NVDA Long 69,188 zu 42,70, Stopp 42,31, Minute 12:42 mit Tief 42,13: Schließen über das Limit zu 42,12 ergibt −40,13 € (−1,57 R), mit dem Stopp-Kurs wären es −28,37 €. Das ist genau der Fall aus Welle 2 (AAPL −63,24 €). Der Stopp-Fix wirkt dort nicht, weil das Limit ihn überholt.
- Beleg: `auswertung_S1.txt`, `lauf_S1.json`
- Vermutete Ursache: `packages/trading/src/agent.ts`, `takt()`: Die Prüfung `tagesGV - schliessKosten <= -e.tagesverlust` und `allesSchliessen()` laufen vor Schritt 1 (Stopp/Ziel) und schließen per `schliesseAlle()` ohne `stoppKurs`. `tagesGV` rechnet mit dem Schlusskurs der Minute, obwohl der Stopp in derselben Minute ausgelöst hätte.
- Vorschlag: Zuerst Stopps und Ziele der Minute ausführen (zum Stopp-Kurs), danach das Limit mit dem neuen Kontostand prüfen.

### TRD-043 · Der Agent eröffnet neue Trades, obwohl das Verlustlimit fast ausgeschöpft ist; der Tag endet 65 % über dem Limit
- Schweregrad: Mittel
- Bereich: Risikoregeln › Verlustlimit / Positionsgröße
- Schritte: wie TRD-042, Tag 30.10.
- Erwartet: Ein neuer Einstieg riskiert höchstens den Rest bis zum Verlustlimit, oder er unterbleibt, wenn dieser Rest nicht für eine sinnvolle Position reicht.
- Tatsächlich: Nach AMD (−32,89 €) und TSLA (−25,91 €) steht der Tag bei −58,80 €, das Limit ist 60 €, der Rest also 1,20 €. Um 12:39 kauft der Agent 69,188 NVDA mit 25,60 € Risiko (Budget 49,22 € = 0,5 % vom Konto). Drei Minuten später greift das Limit: Der Tag endet bei −98,93 €, das sind 165 % des Limits. Auch mit Ausstieg zum Stopp-Kurs (TRD-042) wären es −87,17 €.
- Beleg: `auswertung_S1.txt` (Einträge 2026-10-30)
- Vermutete Ursache: `packages/trading/src/agent.ts`, `stueckzahl()` kennt nur `equity * risikoProTrade`, nicht den Abstand `tagesverlust + tagesGV`. Verwandt mit dem Hinweis TRD-041 (statische Warnung), hier im laufenden Betrieb.
- Vorschlag: Das Risiko je Trade auf `min(Budget, Rest bis Limit − Schließkosten)` begrenzen und bei zu kleinem Rest mit „Rest bis Verlustlimit zu klein“ sperren.

### TRD-044 · Eigene App: Die Umrechnung mit dem EZB-Tageskurs verschiebt Stopp-Abstand und G/V gegenüber dem App-Kurs; ein alter Kurs gilt unbegrenzt
- Schweregrad: Mittel
- Bereich: Eigene App › Wechselkurs (Code und Skript, ohne Netz nicht live prüfbar)
- Schritte: 1. `trd015.mts`: Signal META 15:16, Kurs 33,6944 €, Stopp 33,51 € (Abstand 0,1844 € = 0,55 %) 2. Annahme: Der Euro-Kurs in der App weicht um 0,3 % vom umgerechneten Kurs ab (der EZB-Referenzkurs wird einmal täglich um 14:15 MEZ festgestellt, der Dollar bewegt sich während der US-Sitzung typischerweise um mehrere Zehntelprozent; Trade Republic preist zusätzlich mit eigenem Spread) 3. Ausführungskurs aus der App eintragen
- Erwartet: Das Risiko je Trade bleibt etwa beim eingestellten Wert; die Abweichung zwischen App und Umrechnung wird erkannt oder ausgeglichen.
- Tatsächlich: Eingetragen wird 33,80 € statt 33,69 €. Der Stopp bleibt beim umgerechneten 33,51 €. Der Abstand wächst auf 0,2855 €, das Risiko je Trade steigt um 55 %. Gleichzeitig zeigt das Cockpit sofort −0,3 % G/V, die aus dem Wechselkurs kommen und nicht aus dem Markt. Diese Werte fließen in Tagesziel und Verlustlimit ein. Die Prüfung im Server lässt bis zu 25 % Abweichung vom Signalkurs zu. Scheitert der Abruf, gilt außerdem der letzte Kurs ohne Altersgrenze weiter. Im Skript wurde ein 30 Tage alter Kurs (1,20, Stand 01.09.) still verwendet, sichtbar nur als „Stand“ im Zetteltext. TRD-034 hat für Marktdaten bewusst Altersgrenzen eingeführt.
- Beleg: `trd015_skript.txt`. Rechnung: 33,6944 × 1,003 = 33,7955; (33,7955 − 33,51) / 0,1844 = 1,548.
- Vermutete Ursache: `packages/trading/src/broker.ts`, `manuellerBroker` (`kursUsdJeEur`: Rückfall auf `w.usdJeEur` ohne Alter); `apps/web/app/api/trading/[id]/aktion/route.ts`: Beim Bestätigen werden Stopp und Ziel des Signals unverändert übernommen.
- Vorschlag: Beim Bestätigen Stopp und Ziel relativ zum eingetragenen Kurs verschieben (gleicher prozentualer Abstand) oder den Wechselkurs aus Signal-USD-Kurs und eingetragenem Euro-Kurs neu ableiten. Den alten Kurs höchstens wenige Tage verwenden, danach keine Zettel erstellen.

### TRD-045 · Netz- und Serverfehler: Die Liste zeigt „Ersten Agenten einstellen“, Löschen meldet nichts oder tut so, als sei gelöscht
- Schweregrad: Mittel
- Bereich: `/trading` (Liste), Cockpit › Agent löschen
- Schritte: 1. `/trading` mit 30 Agenten offen 2. Anfrage `GET /api/trading` abbrechen (Netzausfall, Playwright-Route), 10 s warten 3. Cockpit eines angehaltenen Agenten, „Agent löschen“, bestätigen; einmal mit abgebrochener, einmal mit 500er-Antwort
- Erwartet: Die Liste bleibt stehen, mit dem Hinweis „Keine Verbindung, Stand von …“. Löschen meldet den Fehler und bleibt im Cockpit.
- Tatsächlich: Liste: Alle Karten verschwinden, stattdessen kommt der Leerzustand „Ersten Agenten einstellen … Agent einstellen“, als wären alle Agenten weg. Nach Rückkehr der Verbindung sind sie wieder da (`c_liste_netzfehler.png`). Löschen bei Netzausfall: keine Meldung, `pageerror: Failed to fetch`. Löschen mit 500: Die App springt ohne Meldung zur Liste, als wäre gelöscht, der Agent besteht aber weiter (`c_loeschen_500.png`, `GET` → 200).
- Beleg: `c_rest.txt`, `c_liste_netzfehler.png`, `c_loeschen_500.png`
- Vermutete Ursache: `apps/web/app/trading/page.tsx:11` (`.catch(() => setL([]))`); `apps/web/app/trading/[id]/page.tsx`, „Agent löschen“: `await fetch(…DELETE); router.push("/trading")` ohne `r.ok` und ohne `try/catch`.

### TRD-046 · Neuladen in Schritt 2 hebt den Schutz aus TRD-011 auf: Die Vorlage überschreibt Strategie und Richtung still
- Schweregrad: Mittel
- Bereich: Assistent › Ziel & Grenzen nach Neuladen
- Schritte: 1. Simulation, Schritt 3: „Rückkehr zum Mittelwert“, 3 σ, „Long und Short“ 2. Zurück zu Schritt 2, Seite neu laden (der Entwurf kommt in Schritt 2 zurück) 3. Vorlage „Vorsichtig“ wählen 4. Weiter zu Schritt 3
- Erwartet: Wie ohne Neuladen: Nur die Grenzen ändern sich, mit der Meldung „Ihre Strategie bleibt“.
- Tatsächlich: Strategie „Ausbruch“, Richtung „Nur Long“, die eigenen σ-Werte sind weg. Es kommt keine Meldung (`a011_nach_neuladen_vorlage.png`, Ausgabe „011 Schritt 3 nach Neuladen+Vorlage“).
- Vermutete Ursache: `apps/web/app/trading/neu/page.tsx`: `strategieGesehen` ist ein eigener State und gehört nicht zum Entwurf (`useEntwurf("agent", { schritt, e, vorlage }, …)`). Nach dem Neuladen in Schritt 2 ist er `false`.
- Vorschlag: `strategieGesehen` im Entwurf mitspeichern, oder beim Wiederherstellen aus dem Entwurf als gesehen werten.

### TRD-047 · Entwurf: Alpaca-Schlüssel fehlen nach dem Neuladen ohne Hinweis; ein alter Entwurf taucht nach einem Seitenwechsel über die Adresszeile wieder auf
- Schweregrad: Niedrig
- Bereich: Assistent › Entwurf
- Schritte: 1. Alpaca Paper, Schlüssel eintragen, bis Schritt 3, neu laden 2. Getrennt: Eigene App bis Schritt 4, dann `/trading` und `/trading/neu` über die Adresszeile (oder Lesezeichen) aufrufen
- Erwartet: (1) Ein Hinweis „Aus Sicherheitsgründen wurden die Schlüssel nicht gespeichert, bitte erneut eingeben“ in Schritt 1 oder 4. (2) Ein neuer Assistent oder die Frage „Entwurf fortsetzen?“.
- Tatsächlich: (1) Die Schlüsselfelder sind leer, nichts weist darauf hin. Schritt 4 legt den Agenten ohne Zugang an, das fällt erst im Cockpit auf. Dass die Schlüssel nicht gespeichert werden, ist richtig, siehe TRD-025. (2) Der Assistent öffnet direkt in „Wie selbstständig?“ (Schritt 4) mit dem alten Entwurf, weil nur das Verlassen innerhalb der App den Entwurf löscht.
- Beleg: `a_wiz_b.txt` (Zeilen 025), Ausgabe „012 harte Navigation weg und zurück: Überschrift Wie selbstständig?“
- Vermutete Ursache: `apps/web/lib/entwurf.ts` (Löschen nur im Cleanup des Effekts).

### TRD-048 · Listenkarten brechen Beträge um: „10.000,00“ / „€“ in zwei Zeilen
- Schweregrad: Niedrig
- Bereich: `/trading` (Kacheln Startkapital und heute), 1280 px und 390 px
- Schritte: `/trading` mit Agenten öffnen
- Erwartet: Betrag und Währung in einer Zeile.
- Tatsächlich: Seit dem Format mit zwei Nachkommastellen steht bei 1280 px „10.000,00“ und darunter „€“, bei 390 px „100.000,00“ und darunter „$“. „läuft“ klebt ohne Abstand am Betrag daneben.
- Beleg: `c_loeschen_500.png` (Liste bei 1280 px), `b_m_liste.png`
- Vorschlag: `white-space: nowrap` für Beträge in `.tr-k`, beim Startkapital ohne Nachkommastellen.

## Abdeckung

**Geprüft:**
- Alle 14 beauftragten Befunde mit den Originalschritten und zusätzlichen Wegen. Assistent: alle Zweige für Vorlage und Strategie, Neuladen in Schritt 2 und 3, Abbrechen mit Schlüsseln, sessionStorage-Inhalt, Randwerte, Werte-Eingabe (Kleinschreibung, Doppelte, ungültige, Liste mit Komma und Semikolon, Klick daneben, alle entfernen).
- Cockpit für Simulation, Alpaca ohne und mit erfundenen Schlüsseln, Eigene App ohne und mit Zugang und ohne App-Namen: Kopf, Hinweise, Kacheln, Start, Not-Aus. Vorschlag ausführen und ablehnen. Netzfehler bei Knöpfen, Neuladen, Liste und Löschen; Serverfehler beim Löschen.
- 10 Simulationstage aus dem Protokoll nachgerechnet, ein Tag von Hand.
- Verfall von Vorschlägen. Marktumfeld je Simulationstag mit Termin und Zwischenspeicher. Wochenende mit gemocktem Datum.
- TRD-015 per Vitest und eigenem Tageslauf mit Wechselkurs, Ausfallfällen und EZB-CSV.
- API-Sicherheit. Parallelbetrieb. Rückblick mit künstlichen Kursen. Liste und Startseite. Mobil 390 px auf allen Trading-Seiten. Konsole und Netzwerk bei jedem Aufruf.

**Nicht prüfbar (externe Dienste fehlen):**
- Alpaca Paper mit echter Verbindung: Kontostand in $, „seit Start“ ab dem ersten Handelstag.
- Eigene App mit echten Kursen und echtem EZB-Kurs: Zettel-Hinweis mit Kurs und Stand nur im Code gesehen.
- Rückblick mit Alpaca-Daten.
- Echtgeld mit `TRADING_LIVE=1`.
- Ein Marktumfeld mit VIX- und S&P-Daten: keine Konjunkturreihen angelegt, nur ein Termin.

**Nicht beauftragt, nebenbei gesehen:** Bestätigt man in der Simulation einen Vorschlag in einer Minute, deren Hoch schon über dem Stopp lag, wird die Position in derselben Minute ausgestoppt (NVDA 10:21, −5,60 €). Die Prüfung beim Bestätigen sieht nur den Schlusskurs der Minute.

**Hinterlassene Testdaten:**
- Alles liegt nur in der eigenen Instanz unter `/home/claude/qa-trd/apps/web/.data`, nicht im Repo und nicht auf dem Server des Investments-Testers.
- 31 Agenten mit dem Präfix `QA-TRD W3 …`, alle angehalten. „QA-TRD W3 Loeschtest“ besteht weiter (Löschen war nur simuliert fehlgeschlagen).
- Ein Termin „QA-TRD W3 Zinsentscheid“ am 28.10.2026 (wichtig).
- Profil auf `onboarded: true` gesetzt.
- Der Server auf Port 3300 ist beendet. Das Verzeichnis `/home/claude/qa-trd` kann gelöscht werden.
