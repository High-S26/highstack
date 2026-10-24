# Nachtest Bugfix-Welle 1 · Trading

- Datum: 2026-10-23 bis 2026-10-24
- Geprüfter Stand: Commit e72a4e5 (Produktions-Build, Testmodus ohne Anmeldung, ohne Anthropic-Schlüssel, ohne `TRADING_LIVE`, ohne Zugang zu Alpaca, FRED und EZB)
- Zusammenfassung: 11 alte Befunde nachgeprüft, alle 11 behoben. Neue Befunde: Blocker 0, Hoch 1, Mittel 5, Niedrig 3, Hinweis 0, dazu eine Ergänzung zu TRD-026.
- Ablauf: Am 23.10. unterbrach das API-Limit den Lauf. Bei der Wiederaufnahme am 24.10. um 10:08 war der Server nicht erreichbar, der Koordinator hat ihn danach mit denselben Daten neu gestartet. Ab 10:10 habe ich weitergeprüft. Den noch aktiven Agenten „QA-TRD NT Paper Dauerlauf“ habe ich zuerst angehalten.

Belege: `/tmp/claude-0/-home-claude/a63e209a-47ca-5889-84a9-ed4a4c2b741b/scratchpad/qa-belege/trd2/`. Skripte: `…/qa-skripte/trd2/`.

## Alte Befunde

| ID | Status | Beleg |
|---|---|---|
| TRD-001 | behoben | `POST` mit `alpaca-live` → 400 „Handel mit echtem Geld ist auf diesem Server gesperrt.“; `ibkr` → 400 „noch nicht angebunden“; `foo` → 400 „Unbekannter Broker“; ebenso über `PUT`; Broker-Wechsel eines aktiven Agenten → 409. Im Assistenten sind IBKR und Alpaca live gesperrt. `nt_sicherheit.txt`, `u_wiz.txt` |
| TRD-002 | behoben | Not-Aus bei Alpaca Paper ohne Schlüssel → 200, `aktiv: false`. Der Fall „aktiv und Broker nicht aufbaubar“ ist nicht mehr herstellbar, weil der Start jetzt den Zugang prüft; `notaus()` setzt zuerst `aktiv=false`. |
| TRD-003 | behoben | Paper mit erfundenen Schlüsseln, Start, Not-Aus → `geschlossen: false`, Meldung „Schließen beim Broker fehlgeschlagen; Positionen bitte direkt beim Broker prüfen.“ `nt_sicherheit.txt` |
| TRD-004 | behoben | Fehlerhafter Paper-Agent: höchstens ein Versuch je Minute, gleiche Fehler zusammengefasst („fetch failed (2×)“), Protokoll begrenzt. Es bleibt: kein automatisches Anhalten, technischer Text (TRD-005). |
| TRD-006 | behoben | Kaputtes JSON, leerer Body und `{}` → 400 mit Text; Fremdfelder fallen weg; Kennung und Mandant bleiben. Restpunkt: TRD-028. |
| TRD-007 | behoben | Sim C (Trades/Tag 2) über 3 Tage minutenweise: je Tag 2 Einstiege, keine Verstöße (`auswertung_C.txt`); im Vorschlagsmodus höchstens 2 offene Einstiege. |
| TRD-008 | behoben | `qty 100000` → 400 „Höchstens die vorgeschlagene Stückzahl (8,568) …“; `-5` und `"abc"` → 400; kleinere Stückzahl → 200. |
| TRD-009 | behoben | Beim Verlustlimit verfallen alle offenen Einstiege mit Grund; Bestätigen danach → 400; keine Position bleibt offen (`trd009b.txt`). |
| TRD-010 | behoben | Server: alle Grenzfälle abgewiesen, sinnvolle Randwerte angenommen (`grenzwerte_api.txt`). Assistent: Die Werte aus dem ersten Lauf (Ziel 0, Limit −50, Höchstposition 100000, Trades 0, Positionen −1, Schluss 500) erzeugen Feldfehler, „Weiter“ ist gesperrt (`u01_wiz_grenzfaelle.png`). Strategiewerte außerhalb der Grenzen sperren ebenfalls (`u03_wiz_strategie_grenz.png`). Sinnvolle Werte blockiert die Prüfung nicht: Risiko 0,05 % bis 5 %, Höchstposition 100 %, 100 Trades, 20 Positionen, Schluss 1 Min., Kapital 100 € bis 10 Mio. € mit allen drei Vorlagen, Komma als Dezimaltrenner (`u_wiz.txt`). Optische Reste: TRD-036. |
| TRD-017 | behoben | API: `takt` an einem angehaltenen Agenten → 409. Oberfläche: Nach Not-Aus steht „angehalten“, „Jetzt prüfen“ ist gesperrt (Tooltip „Agent ist angehalten“), statt „Rest des Tages …“ steht „Zum Durchspielen den Agenten starten.“ Die Simulationsuhr bleibt 12 s lang auf Minute 1 stehen, es kommt kein Trade dazu (`u_cockpit.txt`, `u12_cockpit_notaus.png`). |
| TRD-023 | behoben | Leerer Zugang bzw. Key-ID aus Leerzeichen → 400; der hinterlegte Zugang bleibt. Keine Schlüssel in `GET`-Antworten. |

## Neues seit Lauf 1 (vollständig geprüft)

- **Häkchen „Marktumfeld berücksichtigen“ (Assistent, Schritt 4):** standardmäßig gesetzt, Text verständlich, auch mobil sichtbar. Abgewählt wird `marktlage: false` gespeichert ✔ (`u04_wiz_schritt4.png`).
- **Cockpit „Marktumfeld“:** Ohne Daten steht dort „neutral · Keine Marktdaten hinterlegt; Positionsgröße unverändert“. Umschalten „berücksichtigen/ignorieren“ speichert und meldet ✔. Fehler: TRD-032 (Fehlschlag wird nicht gemeldet) und TRD-033 (Anzeige wird nicht aktualisiert).
- **Admin-Testdaten über `/admin?tab=konjunktur`:** S&P 500 mit 260 Tageswerten (5.000 → 6.000, Kurs über der 200-Tage-Linie), VIX 28,5 bis 35,8 (letzter Wert 23.10.), Termin „QA-TRD Fed-Zinsentscheid“ am 25.10.2026, Zinsentscheid, wichtig. Import über die Oberfläche: „260 Werte übernommen“ bzw. „5 Werte übernommen“. Erwartete Faktoren nach `risikolage()`: 0,75 ohne Termin, 0,375 mit Termin; die Admin-Kacheln zeigen 75 % bzw. 38 % ✔ (`u_admin.txt`, `u21_admin_nachher.png`).
- **Wirkung auf die Stückzahl:** Gleicher Simulationstag (24.10.) und gleiche Einstellungen, nur Marktumfeld bzw. Risikogrenzen verschieden (`umfeld_*.json`):

| Agent | Grenzen | Faktor | NVDA | AAPL | TSLA (4 Einstiege) |
|---|---|---|---|---|---|
| Q_ign | Risiko 0,25 %, Höchstpos. 100 % | ignoriert | 56 | 21,186 | 29 / 14 / 7 / 5 |
| Q_on75 | wie oben | 75 % | 42 | 15,889 | 23 / 10 / 5 / 4 |
| Q_on38 | wie oben | 38 % | 21 | 7,944 | 11 / 5 / 2 / 2 |
| R_ign | Vorlage „Ausgewogen“ (0,5 %, 30 %) | ignoriert | 70 | 19,685 | 8 / 8 / 8 / 8 |
| R_on75 | wie oben | 75 % | **70** | **19,685** | **8 / 8 / 8 / 8** |
| R_on38 | wie oben | 38 % | 42 | 15,889 | **8 / 8** / 5 / 4 |
| P_on38 | Risiko 5 %, Höchstpos. 10 % | 38 % | **23** | **6,561** | **2 / 2 / 2 / 2** |

  Ist die Stückzahl durch das Risiko begrenzt (Q), sinkt sie genau um den Faktor (0,75 bzw. 0,375, Rest durch Abrunden auf ganze Stück) ✔. Ist sie durch die Höchstposition begrenzt, sinkt sie gar nicht oder nur teilweise → **TRD-030**.
- **„Treffsicherheit der Signale“ nachgerechnet** (`treffer.py`, `treffer_repro.txt`): Agent „QA-TRD NT Repro Limit“, 12 abgeschlossene Trades über zwei Simulationstage. Mit Python aus `abschluesse` gerechnet: Trefferquote 2/12 = 17 %, Ø R −0,74, Gewinnfaktor 83,71 / 345,15 = 0,24, Summe −261,44 €, Ziel/Stopp/Schluss 2/9/1. Das Cockpit zeigt dieselben Werte (17 %, −0,74 R, 0,24, „−261 €“, 2/9/1) ✔. Ich habe G/V und R je Trade aus Einstieg, Ausstieg, Stopp und Stückzahl neu berechnet, Abweichung 0,00 ✔. Die Summe weicht um 0,30 € von der Kontoveränderung (−261,74 €) ab. Ursache sind die gerundeten Ausführungskurse, wie in TRD-019. Die Tabelle nach Signalstärke stimmt mit den Einzeltrades überein. Nach „Zurücksetzen“ steht „0 abgeschlossene Trades“ ✔.
- **Normaler Weg (Regression):** Assistent mit allen drei Vorlagen und allen drei Strategien, Anlegen, Starten, „Rest des Tages“, Vorschläge über die Oberfläche ausführen und ablehnen, Not-Aus mit Dialog, erneuter Start nach Not-Aus, Zurücksetzen mit Dialog: alles funktioniert (`u_cockpit.txt`, `u_vorschlag.txt`). Verlustlimit 150 € → Schluss bei −150,75 € ✔. Mobil 390 px: Assistent (Schritte 1, 2 und 4), Liste und Cockpit ohne waagerechtes Scrollen (`u42`–`u47`). Konsole: keine Fehler außer den absichtlich erzeugten HTTP 500. Tastatur: Die Knöpfe im Cockpit, einschließlich „ignorieren“, sind per Tab erreichbar.

## Neue Befunde

### TRD-028 · Fehlermeldung „Bitte eine Zahl angeben.“ nennt das Feld nicht; falscher Typ bei `symbole` wird still ersetzt
- Schweregrad: Mittel
- Bereich: API › `POST /api/trading`, `PUT /api/trading/[id]`
- Schritte: 1. `POST /api/trading` mit `{"einstellungen":{"startkapital":"abc","tagesverlust":null,…}}` 2. `POST` mit `"symbole":"AAPL"` (Text statt Liste)
- Erwartet: „Startkapital: bitte eine Zahl angeben.“; Feldfehler bei falschem Typ.
- Tatsächlich: (1) „Unbekannter Broker. Bitte eine Zahl angeben. Bitte eine Zahl angeben. …“ – zweimal derselbe Satz ohne Feldnamen. (2) 200, gespeichert werden still die Standardwerte AAPL, MSFT, NVDA, AMD, TSLA, META.
- Beleg: `nt_sicherheit.txt`, `grenzwerte_api.txt`
- Vermutete Ursache: `packages/trading/src/pruefung.ts`, `zahl()` ohne Feldnamen; `rohSymbole` fällt bei Nicht-Liste auf `basis.symbole` zurück.

### TRD-029 · Not-Aus an einem nie gestarteten Agenten ohne Zugang meldet „Positionen konnten nicht geschlossen werden“
- Schweregrad: Niedrig
- Bereich: Cockpit › Not-Aus (Alpaca Paper ohne Schlüssel)
- Schritte: 1. Alpaca Paper ohne Schlüssel anlegen (der Start schlägt korrekt fehl) 2. Not-Aus
- Erwartet: „Agent angehalten. Ohne Zugang wurden keine Orders gesendet.“
- Tatsächlich: „Not-Aus: Agent angehalten. Positionen konnten nicht geschlossen werden (Bitte Alpaca-Zugang … hinterlegen.); bitte direkt beim Broker prüfen.“ Das alarmiert ohne Grund.
- Beleg: `nt_sicherheit.txt` (Abschnitt TRD-002)

### TRD-030 · Marktumfeld verkleinert die Position nicht, wenn die Höchstposition die Stückzahl begrenzt; das Cockpit verspricht trotzdem „Positionsgröße 38 %“
- Schweregrad: Hoch
- Bereich: Risikomanager › Marktumfeld; Cockpit › Marktumfeld
- Schritte: 1. Admin-Testdaten wie oben (Faktor 0,75 bzw. 0,375) 2. Simulations-Agenten mit identischen Einstellungen anlegen (Vorlage „Ausgewogen“ mit Mittelwert, bzw. Risiko 5 % und Höchstposition 10 %), je einmal mit berücksichtigtem und ignoriertem Marktumfeld 3. denselben Simulationstag durchspielen und die Stückzahlen vergleichen
- Erwartet: Bei „Positionsgröße 38 %“ sind alle Einstiege etwa 38 % so groß wie ohne Marktumfeld.
- Tatsächlich: Mit der Standardvorlage „Ausgewogen“ und 75 % sind alle sechs Einstiege unverändert (NVDA 70, AAPL 19,685, TSLA 4 × 8). Bei 38 % sinken nur einige (NVDA 70 → 42, AAPL → 15,889), TSLA bleibt bei den ersten beiden Einstiegen bei 8. Mit Höchstposition 10 % ändert sich bei 38 % gar nichts (23 / 6,561 / 2). Das Protokoll und das Cockpit melden trotzdem „Positionsgröße 75 %“ bzw. „38 %“. Vor einem Zinsentscheid handelt der Nutzer also in voller Größe, glaubt aber, verkleinert zu sein.
- Beleg: Tabelle oben, `umfeld_R_on75.json`, `umfeld_R_on38.json`, `umfeld_P_on38.json`, `umfeld_Q_*.json`
- Vermutete Ursache: `packages/trading/src/agent.ts`, `takt()`: `stueckzahl({ ...e, risikoProTrade: e.risikoProTrade * faktor }, …)` skaliert nur das Risiko; `nachGroesse` und `nachGeld` in `stueckzahl()` bleiben unverändert.
- Vorschlag: Faktor auf das Endergebnis von `stueckzahl()` anwenden (oder auf Risiko und Höchstposition).

### TRD-031 · Neuer wichtiger Termin wirkt bis zu 10 Minuten nicht; der Admin zeigt schon 38 %, der Agent handelt noch mit 75 %
- Schweregrad: Mittel
- Bereich: Marktumfeld › Zwischenspeicher; Admin › Termine
- Schritte: 1. S&P 500 und VIX importieren (10:14) 2. Termin „wichtig“ für morgen anlegen 3. sofort `GET /api/trading/umfeld` abfragen und einen Simulationstag durchspielen
- Erwartet: Der Termin gilt sofort (Admin und Agent zeigen dasselbe).
- Tatsächlich: Admin-Kachel „Positionsgröße Trading 38 %“, `/api/trading/umfeld` aber weiter 75 % ohne Termin. Die Agenten Q_on75, R_on75 und P_on75 handelten um 10:14:19 und 10:14:31 mit 75 %. Erst später (spätestens nach 10 Minuten) gilt 38 %.
- Beleg: `u_admin.txt` (Zeilen „Umfeld direkt nach Termin“ und „Admin Kacheln nach Termin“), `umfeld_Q_on75.json`
- Vermutete Ursache: `apps/web/lib/konjunktur.ts`, `umfeld()` speichert das Ergebnis 10 Minuten zwischen; nur `uebernimm()` und `taeglich()` setzen `bevorzugt.zeit = 0`, das Anlegen und Löschen von Terminen (`app/api/admin/konjunktur/route.ts`, `case "ereignis"`, `"ereignis-loeschen"`) nicht.

### TRD-032 · „berücksichtigen/ignorieren“ scheitert still, wenn das Speichern fehlschlägt
- Schweregrad: Mittel
- Bereich: Cockpit › Marktumfeld
- Schritte: 1. Cockpit öffnen 2. `PUT /api/trading/[id]` mit 500 beantworten lassen (Playwright-Route, nachgestellter Server- oder Netzwerkfehler) 3. „ignorieren“ klicken
- Erwartet: Fehlermeldung („Konnte nicht gespeichert werden …“).
- Tatsächlich: Keine Meldung, die Anzeige bleibt unverändert, nur die Konsole zeigt den 500er. Der Nutzer weiß nicht, ob seine Wahl gilt. Ebenso bei 400 aus der Einstellungsprüfung (z. B. wenn ein Agent mit älteren, heute ungültigen Einstellungen gespeichert ist).
- Beleg: `u_vorschlag.txt` (Zeile „PUT 500“), `u41_umschalten_fehler.png`
- Vermutete Ursache: `apps/web/app/trading/[id]/page.tsx`, `setzeMarktlage`: nur `if (r.ok) …`, kein `else`.

### TRD-033 · Marktumfeld im Cockpit wird nicht aktualisiert, während der Rest alle 5 s neu lädt
- Schweregrad: Mittel
- Bereich: Cockpit › Marktumfeld
- Schritte: 1. Cockpit offen lassen (10:14) 2. Um 10:16 VIX auf 15,0 ändern (Admin-Import) 3. weiter beobachten
- Erwartet: Das Cockpit zeigt spätestens beim nächsten Neuladen der Daten das neue Umfeld.
- Tatsächlich: Die API meldet ab 10:16 „Risikobereitschaft, Positionsgröße 50 % … VIX ruhig (15.0)“. Das offene Cockpit zeigt bis 10:18:58 unverändert „neutral · Positionsgröße 38 % · VIX hoch (35.8)“, während Kacheln, Positionen und Protokoll alle 5 s neu laden. Erst beim Neuladen der Seite stimmt die Anzeige.
- Beleg: `u_umfeld_warten.log` (Zeilen 10:16:58 und 10:17:58)
- Vermutete Ursache: `apps/web/app/trading/[id]/page.tsx`: `fetch("/api/trading/umfeld")` in einem eigenen `useEffect` ohne Intervall, unabhängig von `lade()`.

### TRD-034 · Veraltete Marktdaten steuern die Positionsgröße ohne Altersgrenze und ohne Datum in der Anzeige
- Schweregrad: Mittel
- Bereich: Marktumfeld › Risikolage
- Schritte: 1. VIX-Reihe löschen, nur `2025-12-01;45,0` importieren 2. `GET /api/trading/umfeld`
- Erwartet: Werte, die älter als einige Tage sind, werden ignoriert oder deutlich als veraltet markiert, zumal der automatische Abruf hier scheitert (Admin: „Fehler: fetch failed“ bei S&P 500 und VIX).
- Tatsächlich: „neutral, Positionsgröße 38 % (…; VIX hoch (45.0); …)“: ein elf Monate alter Wert verkleinert die Positionen. Weder Cockpit noch Protokoll nennen das Datum. Umgekehrt würde ein alter, ruhiger VIX in einer echten Stressphase volle Größe erlauben. Danach habe ich die Testreihe wiederhergestellt (VIX 35,8).
- Beleg: Antwort `/api/trading/umfeld` vom 24.10., 10:19 (siehe Ablauf in `u_admin.txt` und dieser Abschnitt)
- Vermutete Ursache: `packages/prognose/src/modell.ts`, `risikolage()`: `lies(…, "vix", …)` und `bis(sp500, …)` ohne Prüfung des Alters (`wertAm` sucht nur den letzten Wert ≤ Stichtag). Die Wirkungsketten in `mechanismen.ts` haben dafür eine 7-Tage-Grenze, die Risikolage nicht.

### TRD-035 · Simulation handelt am Samstag; Marktumfeld richtet sich nach dem echten Datum statt nach dem Simulationstag
- Schweregrad: Niedrig
- Bereich: Simulation › Uhr; Marktumfeld
- Schritte: 1. Am Samstag, 24.10.2026, einen Simulations-Agenten anlegen und den Tag durchspielen
- Erwartet: Der erste Simulationstag ist ein Handelstag (Montag, 26.10.).
- Tatsächlich: Handelstag „2026-10-24“ mit 6 Trades im Verlauf, danach 26.10. Das Marktumfeld nutzt immer das echte Datum: Der Termin vom 25.10. halbiert die Positionen an jedem simulierten Tag, auch wenn der Simulationstag längst danach liegt.
- Beleg: `repro_limit.json` (`verlauf[0].datum = 2026-10-24`)
- Vermutete Ursache: `packages/trading/src/broker.ts`, `simBroker` (`simUhr.datum = heute` ohne Wochenendprüfung); `apps/web/lib/konjunktur.ts`, `umfeld()` mit `heute()`.

### TRD-036 · Zahlenformat und doppelte Meldungen in den neuen Prüfungen und im Marktumfeld
- Schweregrad: Niedrig
- Bereich: Assistent › Ziel & Grenzen; Cockpit › Marktumfeld
- Schritte: Schritt 2 mit Risiko 5,1 %, Tagesziel 0,5 €, Startkapital 10.000.001; Cockpit mit Admin-Daten
- Erwartet: de-DE durchgängig, eine Meldung je Fehler, Feld und Server einig.
- Tatsächlich: Feldhinweis „Erlaubt: 0.05 bis 5“ (Punkt) und „Erlaubt: 100 bis 10000000“ (ohne Tausenderpunkte); jeder Fehler erscheint doppelt (Feldhinweis und Liste mit anderem Wortlaut). Tagesziel 0,5 € ist im Feld rot („Erlaubt: 1 bis 25000“), „Weiter“ bleibt aber frei und der Server nimmt den Wert an. Im Marktumfeld „VIX hoch (35.8)“ mit Punkt.
- Beleg: `u_wiz.txt`, `u02_wiz_randwerte.png`, `u30_cockpit_umfeld_75.png`
- Vermutete Ursache: `apps/web/components/Felder.tsx`, `Zahl` (`Erlaubt: ${min} bis ${max}` ohne Formatierung); `apps/web/app/trading/neu/page.tsx` (`min={1}` bei Tagesziel gegen `> 0` in `pruefung.ts`); `packages/prognose/src/modell.ts` (`v.toFixed(1)`).

### Ergänzung zu TRD-026 (Vorschlag ohne erneute Prüfung): jetzt mit messbarem Schaden, Vorschlag auf Hoch heben
- Vorschläge verfallen weiterhin erst am nächsten Handelstag. In „QA-TRD NT Sim E2“ lagen 6 Einstiege von 09:41 um 12:51 noch bereit und blockierten zusammen mit den Trades drei Stunden lang neue Signale über „Trades je Tag“ (`trd009.txt`).
- „QA-TRD NT Sim E“: GOOGL Long, Stopp 233,05, zehn Minuten später bestätigt und zu 232,04 **unter dem Stopp** ausgeführt, im nächsten Takt ausgestoppt (`vorschlag_tests.txt`).

## Abdeckung

**Geprüft:** alle elf alten Befunde (API und Oberfläche); Sicherheit (keine Secrets, kaputtes JSON, fremde IDs, unbekannte Aktion); Risikoregeln mit Sim C über 3 Tage minutenweise sowie Limit, Ziel und Schluss mit E, E2, E3 und Repro; Handrechnung je eines Tages (Sim C: −16,86 € aus dem Protokoll gegen −16,65 € gebucht, TRD-019); Treffsicherheit vollständig nachgerechnet; Assistent mit allen Vorlagen und Strategien sowie Grenz- und Randwerten; Häkchen „Marktumfeld berücksichtigen“; Cockpit (Start, Not-Aus, erneuter Start, Tag durchspielen, Zurücksetzen, Vorschläge ausführen und ablehnen, Marktumfeld umschalten, auch mit Serverfehler); Admin-Import und Termin über die Oberfläche; Wirkung des Marktumfelds auf die Stückzahl in drei Konstellationen; mobil 390 px; Tastatur im Cockpit; Konsole und Netzwerk.

**Nicht prüfbar:** Alpaca mit echter Verbindung und Order-Zettel der eigenen App zur Handelszeit (kein Zugang zu Alpaca); Echtgeld mit `TRADING_LIVE=1`.

**Beobachtung ohne Befund:** In `u_cockpit.py` zeigte das Cockpit nach einem Klick auf „Rest des Tages“ zwei gespielte Tage (Konto 9.738 €). Die Netzwerkaufzeichnung im Nachstellversuch (`u_tag.py`) zeigte genau eine Anfrage und einen Tag. Nicht reproduzierbar, daher kein Befund.

**Angelegte Testdaten (Präfix QA-TRD NT), alle angehalten:** Sim C, Sim E, E2, E3, Repro Limit, UI Wizard, UI Tagtest, UI Vorschlag, Umfeld R/P/Q_*, Basis, Paper fake, Paper ohne, Paper Dauerlauf, Grenz, Langer Name. Konjunktur-Testdaten (gelten global, also auch für den Investments-Testnutzer): Reihen `sp500` (260 Werte) und `vix` (5 Werte, zuletzt 35,8), Termin „QA-TRD Fed-Zinsentscheid“ am 25.10.2026. Wer sauber weitertesten will, sollte sie im Admin löschen.
