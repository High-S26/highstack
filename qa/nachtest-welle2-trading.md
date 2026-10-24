# Nachtest Bugfix-Welle 2 · Trading

- Datum: 2026-10-24
- Geprüfter Stand: Commit 7b30665, Version 0.14 (Produktions-Build, Testmodus ohne Anmeldung, ohne Anthropic-Schlüssel, ohne `TRADING_LIVE`, ohne Zugang zu Alpaca, FRED und EZB; frische Daten)
- Zusammenfassung: 12 alte Befunde nachgeprüft: 7 behoben, 5 teilweise, 0 nicht behoben. Neue Befunde: Blocker 0, Hoch 0, Mittel 2, Niedrig 2, Hinweis 1.

Belege: `/tmp/claude-0/-home-claude/a63e209a-47ca-5889-84a9-ed4a4c2b741b/scratchpad/qa-belege/trd3/`. Skripte: `/tmp/claude-0/-home-claude/a63e209a-47ca-5889-84a9-ed4a4c2b741b/scratchpad/qa-skripte/trd3/` (`auswertung.py` rechnet einen Lauf aus dem Protokoll nach, `stopfill.py` vergleicht Stopp-Ausstiege mit den Kerzen, `bars.ts` erzeugt die Simulationskerzen mit dem Code der App).

## Alte Befunde

| ID | Status | Beleg |
|---|---|---|
| TRD-014 | behoben | Cockpit: Einstand 37,84, Kurs 37,82, Stopp / Ziel 36,42 / 40,50, Konto 10.000,00 €, Verlauf −2,29 €, Grenzenbalken „Verlustlimit −150,00 €“. `c01_cockpit_vorschlag.png`, `c02_cockpit_position.png`, `t01_treffer.png` |
| TRD-015 | teilweise | Behoben: Assistent zeigt bei Alpaca „$“ (Startkapital, Ziel, Limit), das Cockpit nimmt die Kontowährung vom Broker und fällt bei Alpaca auf USD zurück. **Offen:** (a) Bei „Eigene App“ (Trade Republic) ist das Konto in EUR (`manuellerBroker`, `waehrung: "EUR"`), die Kurse kommen aber von Alpaca in USD. Der Einstand ist der vom Nutzer eingetragene EUR-Kurs. G/V, Tagesergebnis, Verlustlimit und Tagesziel vermischen also beide Währungen, sodass der Wechselkurs als Gewinn oder Verlust erscheint. Eine Umrechnung gibt es nicht (`packages/trading/src/broker.ts`, `manuellerBroker`, `positionen()`; kein Code mit Wechselkurs). Auf der Vorschlagskarte stehen USD-Kurse ohne Währung. (b) Prüfmeldungen des Servers verwenden bei Alpaca „€“: „Verlustlimit: … höchstens die Hälfte des Startkapitals (500 €)“ (`trd028_api.txt`, `packages/trading/src/pruefung.ts`, `eur()`). Mit echter Alpaca-Verbindung nicht prüfbar. |
| TRD-016 | teilweise | Protokoll, Gründe, Positionen und Zusammenfassung sind jetzt durchgängig de-DE („Kauf 13,786 META zu 37,84“, „(37,36) mit 6,5-fachem Volumen“, „+500 € / −375 €“). **Offen:** (a) Die Vorschlagskarte zeigt die Stückzahl roh: „Kauf 13.786 × META“, im Protokoll darunter steht „13,786“ (`c01_cockpit_vorschlag.png`; `apps/web/app/trading/[id]/page.tsx`, `{v.antrag.qty} × {v.antrag.symbol}`). Genau das war der Kern des Befunds: 13.786 liest sich wie dreizehntausend. (b) Zeitstempel sind weiter gemischt: „Bestätigt: Kauf …“ steht mit Echtzeit „11:05:46“ zwischen Einträgen mit „09:46 (Simulation)“ (`u_cockpit.txt`, Protokoll oben; `aktion/route.ts`, `protokoll(…, jetzt())`). |
| TRD-019 | behoben | Mit Python aus dem Protokoll nachgerechnet, 4 Agenten, 22 Simulationstage (`auswertung_A/B/D/M.txt`): Die Summe der protokollierten Orders (Stück × Kurs) ergibt jeden Tag das gebuchte Tagesergebnis. Die Abweichung liegt bei höchstens 0,01 € durch die Rundung des Kontostands. Beispiel Sim A, 24.10.: META +36,764 × (39,34 − 37,80) = +56,62 €, MSFT 16,134 × (184,14 − 186,10) = −31,62 €, zusammen +24,99 €, App +24,99 €. Schluss, Verlustlimit und Not-Aus protokollieren jede Position einzeln mit Stück und Kurs (Not-Aus: 5.607,78 + 16,134 × 186,03 + 36,764 × 37,86 = 10.001,07, App 10.001,08; `notaus.txt`). „Treffsicherheit“ Summe 76,13 € gegen Konto seit Start +76,14 € (in Welle 1 noch 0,30 € Abstand). |
| TRD-020 | teilweise | **Behoben:** Stopps reagieren auf Hoch und Tief. In 66 Stopp-Ausstiegen war die Auslöseminute immer die erste Minute, deren Hoch bzw. Tief den Stopp berührt (`auswertung_*.txt`, keine Abweichung). Das Verlustlimit rechnet die Schließkosten ein („Verlustlimit erreicht (−150,45 €, mit Schließkosten −151,77 €)“), Ergebnis −151,92 € bei Limit 150 € (Welle 0: −266,56 € bei 250 €). Die Mindest-Chance greift: „AMD: Chance (1,30) nach Kosten kleiner als Risiko (1,30)“, 5 Sperren in B und M, kein Einstieg mit Chance < Risiko. Der Assistent erklärt, dass das Limit überschritten werden kann. **Offen:** Ausgeführt wird zum Schlusskurs der Auslöseminute, nicht am Stopp. 19 von 66 Stopp-Ausstiegen kosteten mehr als 1,25 R, der schlechteste 1,87 R, und zwar **alle ohne Kurslücke**: Die Minute eröffnete jeweils noch vor dem Stopp (`stopp_fill.txt`). Beispiel M, 27.10., 10:37, TSLA Short: Stopp 337,68, Eröffnung 337,34, Ausstieg 338,58 → −1,87 R statt etwa −1,16 R. Bei Sim A ist der Fall aus Lauf 1 unverändert: AAPL Short, Stopp 157,27, Ausstieg 158,12, −63,24 € bei 50 € Budget, Eröffnung der Minute 155,41. Damit liegt das tatsächliche Risiko je Trade bis zu 87 % über der Einstellung. Bei Alpaca gilt dasselbe: Der Agent legt keine Stopp-Order beim Broker ab, er prüft nach der Minute und schickt dann eine Market-Order (`agent.ts`, Schritt 1 in `takt()`). Vorschlag: Stopp-Orders oder Bracket-Orders beim Broker ablegen; in der Simulation zum Stoppkurs ausführen bzw. zur Eröffnung, wenn die Minute schon jenseits eröffnet. |
| TRD-026 | teilweise | **Behoben (der hochgestufte Teil):** Vorschläge verfallen. META, Vorschlag 09:46, war um 10:02 „verfallen (nach 15 Minuten veraltet)“, bestätigt danach → 400 „Vorschlag nicht mehr offen“. MSFT, Vorschlag 09:50, war um 10:05 verfallen mit „Kurs schon jenseits von Stopp oder Ziel“. Bestätigen innerhalb der Frist (5 Takte) → 200 (`vorschlag.txt`). Verfallene Vorschläge blockieren das Tageslimit nicht mehr. **Offen:** Die Bestätigung führt zum aktuellen Kurs aus, Stückzahl, Stopp und Ziel stammen aber weiter vom Signal. Beispiel META: Signal 37,78 / Stopp 36,42, bestätigt zu 37,91. Das Risiko je Aktie steigt von 1,36 auf 1,49, das Risiko je Trade liegt 10 % über dem Budget. Liegt der Kurs kurz unter dem Ziel, kann es bis zum Dreifachen steigen, bei kaum noch Chance. Die Karte zeigt weder den aktuellen Kurs noch, wie lange der Vorschlag noch gilt (`c01_cockpit_vorschlag.png`). |
| TRD-028 | behoben | „Startkapital: bitte eine Zahl angeben. Verlustlimit: bitte eine Zahl angeben.“; `symbole: "AAPL"` → 400 „Werte bitte als Liste angeben …“; `risikoProTrade: "0.005"` und `werte.z: "2"` → 400 mit Feldname (`trd028_api.txt`). Rest, nur über die API erreichbar: `marktlage: "nein"` und `modus: null` werden still durch den Standardwert ersetzt (also Marktumfeld *an*), Nicht-Texte in `symbole` (`[“AAPL”, 5, {}]`) fallen still weg. |
| TRD-030 | behoben | Gleicher Simulationstag, gleiche Einstellungen, mit und ohne Marktumfeld (`umfeld_f75.txt`, `umfeld_f38.txt`). Vorlage „Ausgewogen“ (Höchstposition 30 % begrenzt): 75 % → TSLA 8 → 6, NVDA 71 → 53, AMD 11,18 → 8,385; 38 % → 8 → 3, 71 → 26, 11,18 → 4,192. Risiko 5 % / Höchstposition 10 %: 75 % → NVDA 23 → 17; 38 % → 23 → 8, TSLA 2 → 0 (gesperrt). Alle Verhältnisse stimmen mit Faktor × Stückzahl, abgerundet. |
| TRD-031 | behoben | Termin „QA-TRD Fed-Zinsentscheid“ (wichtig, 25.10.) um 11:04:46 angelegt; `/api/trading/umfeld` in derselben Sekunde 0,375 statt 0,75 (`termin.txt`). Ebenso wirken Import und Löschen von Werten sofort (`trd034.txt`). |
| TRD-032 | teilweise | Serverfehler: „Nicht gespeichert: Testfehler“ ✔ (`c03_umschalten_fehler.png`). **Offen:** Bei einem Netzwerkfehler (Anfrage bricht ab) kommt keine Meldung, die Anzeige bleibt unverändert, in der Konsole steht ein unbehandelter Fehler `pageerror: Failed to fetch` (`u_netz.txt`, `c06_umschalten_netzfehler.png`). Ursache: `setzeMarktlage` in `apps/web/app/trading/[id]/page.tsx` ruft `fetch` ohne `try/catch` auf. Andere Knöpfe (z. B. „Starten“) melden in diesem Fall nur den englischen Rohtext „Failed to fetch“. |
| TRD-033 | behoben | Cockpit offen, VIX um 11:05:55 auf 15,0 gesetzt: Die Anzeige wechselte nach 24 s auf „Risikobereitschaft · Positionsgröße 50 % · VIX ruhig (15,0, Stand 23.10.)“ (`u_cockpit.txt`, `c04_umfeld_aktualisiert.png`). Danach habe ich den Wert wieder auf 35,8 gesetzt. |
| TRD-034 | behoben | Nur VIX `2025-12-01;45,0` → VIX wird ignoriert. VIX vom 14.10. (10 Tage alt) zählt noch, vom 11.10. (13 Tage) nicht mehr. Gründe nennen jetzt das Datum („VIX hoch (35,8, Stand 23.10.)“), das Zahlenformat ist deutsch (`trd034.txt`). Folgeproblem: TRD-037. |

## Regressionen (Stichproben Welle 1 und normaler Weg)

- **Sicherheit:** `alpaca-live` → 400 „Handel mit echtem Geld ist auf diesem Server gesperrt.“ Kaputtes JSON → 400, fremde ID bei `GET`, `aktion` und `DELETE` → 404. `GET /api/trading` mit 30 Agenten enthält weder `secret` noch `keyId` ✔ (`trd028_api.txt`).
- **TRD-017:** `takt` und `tag` an einem angehaltenen Agenten → 409 ✔ (`regression.txt`).
- **TRD-007, Trades je Tag und Positionen gleichzeitig:** In 22 Simulationstagen (A, B, D, M) nie überschritten, am Handelsende nie eine Position offen ✔. Risiko je Trade bei der Stückzahl (vor Ausführung) und Höchstposition in allen Einstiegen eingehalten ✔ (`auswertung_*.txt`). Die Überschreitung bei der Ausführung steht unter TRD-020.
- **Parallelbetrieb:** zwei Agenten, 20 gleichzeitige `takt` → je genau +10 Minuten, keine doppelten Orders. 3 gleichzeitige `tag` spielen nacheinander 3 Tage, das ist folgerichtig ✔ (`parallel.txt`).
- **Treffsicherheit:** Trefferquote 52 %, Ø 0,13 R, Gewinnfaktor 1,15, Summe 76,13 €, Ziel/Stopp/Schluss 16/15/0, alles mit Python gleich ✔ (`u_treffer.txt`).
- **Assistent, normaler Weg (1280 px und 390 px):** Simulation → Ausgewogen → Startkapital 25.000 zieht Tagesziel 500 und Limit 375 mit ✔ → Mittelwert, „spy“ wird zu SPY, „1abc“ sperrt „Weiter“ mit klarer Meldung, nach Entfernen frei ✔ → Automatik, Zusammenfassung de-DE, Hinweis „keine Anlageberatung“ ✔ → Anlegen, Starten, „Rest des Tages“ ✔. Kein waagerechtes Scrollen (scrollWidth 390), keine Konsolenfehler (`u_wiz.txt`, `w_mobil_*.png`, `w_desktop_*.png`). Neuer Befund: TRD-038.
- **Cockpit mobil 390 px:** Kacheln, Umfeld, Vorschlag, Protokoll lesbar. Die Positionstabelle scrollt in ihrem Rahmen (`c05_cockpit_mobil.png`).
- **Tastatur:** Tab-Reihenfolge im Cockpit: Kopf, „← Trading“, Starten, Not-Aus, zurücksetzen, berücksichtigen, Letzte Trades ✔.

## Neue Befunde

### TRD-037 · Fällt der VIX als veraltet weg, springt das Marktumfeld auf „Risikobereitschaft“, ohne den fehlenden Wert zu nennen
- Schweregrad: Mittel
- Bereich: Marktumfeld › Risikolage; Cockpit
- Schritte: 1. S&P 500 (über der 200-Tage-Linie, Stand 23.10.) und Termin wie oben 2. VIX-Werte löschen, nur `2025-12-01;45,0` (oder `2026-10-11;45,0`) importieren 3. `GET /api/trading/umfeld`
- Erwartet: Ein fehlender bzw. veralteter Stressindikator macht die Lage nicht *besser*. Mindestens steht da „VIX: keine aktuellen Daten (letzter Wert 01.12.2025)“, die Lage bleibt höchstens „neutral“.
- Tatsächlich: Mit VIX 35,8 heißt es „neutral, 38 %“. Ist der VIX 13 Tage alt, heißt es „Risikobereitschaft, Positionsgröße 50 %“, ohne Termin wären es 100 %. Die Gründe nennen nur noch den S&P 500, dass der VIX fehlt, steht nirgends. Der automatische Abruf scheitert hier dauerhaft (Admin: „Fehler: fetch failed“). Ein liegengebliebener Datenabruf erhöht also unbemerkt die Positionsgröße.
- Beleg: `trd034.txt`
- Vermutete Ursache: `packages/prognose/src/modell.ts`, `risikolage()`: Fehlt `punktAktuell(…, "vix", …)`, wird der Punkt still übersprungen, und `s = +1` allein aus dem S&P ergibt `risk-on`.
- Vorschlag: Fehlende Indikatoren in `gruende` nennen; ohne aktuellen VIX höchstens „neutral“.

### TRD-038 · Zahlenfelder verwerfen Eingaben außerhalb der Grenzen beim Verlassen still und zeigen wieder den alten Wert
- Schweregrad: Mittel
- Bereich: Assistent › Ziel & Grenzen (gemeinsame Komponente `Zahl`, betrifft auch Investments)
- Schritte: 1. `/trading/neu`, Alpaca Paper, Weiter 2. Startkapital 1000 3. Verlustlimit „900“ eintippen, dann Tab 4. Risiko je Trade „5,1“, dann Tab
- Erwartet: Der eingegebene Wert bleibt stehen und ist rot markiert, „Weiter“ ist gesperrt; oder eine Meldung „auf 500 begrenzt“.
- Tatsächlich: Während der Eingabe steht „Erlaubt: 1 bis 500“, „Weiter“ bleibt aber aktiv. Nach dem Verlassen stehen ohne jede Meldung wieder die alten Werte im Feld: Verlustlimit 10, Risiko 0,25 %. Wer schnell durchklickt, legt den Agenten mit anderen Grenzen an, als er eingetippt hat. Liegt der alte Wert höher als der gewollte (z. B. Risiko 2 %, Eingabe 0,01 % unter der Untergrenze), handelt der Agent mit dem höheren Risiko.
- Beleg: `u_feld.txt`, `w_feld_fokus.png`, `w_feld_blur.png`
- Vermutete Ursache: `apps/web/components/Felder.tsx`, `Zahl`, `onChange`: `if (n != null && !ausserhalb(n)) onChange(…)`. Werte außerhalb erreichen den Zustand nie, beim `onBlur` zeigt das Feld wieder `intern`.

### TRD-039 · Sperrmeldungen nennen die falsche Grenze bzw. gleiche Zahlen
- Schweregrad: Niedrig
- Bereich: Protokoll › Gesperrt
- Schritte: Agent mit Risiko 5 % und Höchstposition 10 %, Marktumfeld 38 %, Tag durchspielen
- Erwartet: „TSLA: Positionsgröße unter einer Aktie (Höchstposition 10 % und Marktumfeld 38 %)“.
- Tatsächlich: „TSLA: Positionsgröße unter einer handelbaren Einheit bei 5 % Risiko und 38 % Marktumfeld“. Begrenzt hat aber die Höchstposition (1.000 € / 340 € = 2 Stück × 0,375 = 0). Außerdem: „AMD: Chance (1,30) nach Kosten kleiner als Risiko (1,30)“. Durch das Runden sind beide Zahlen gleich, die Sperre wirkt willkürlich.
- Beleg: `umfeld_P_an_f38.json`, `lauf_B.json` (Protokoll)
- Vermutete Ursache: `packages/trading/src/agent.ts`, `takt()`, Sperrtexte nach `stueckzahl()` und Mindest-Chance.

### TRD-040 · Verfall von Vorschlägen zählt Takte statt Minuten
- Schweregrad: Niedrig
- Bereich: Vorschläge › Verfall (Alpaca Paper, eigene App)
- Schritte: Code-Durchsicht. Mit Alpaca nicht prüfbar, in der Simulation entspricht ein Takt einer Minute.
- Erwartet: Ein Vorschlag gilt 15 Minuten Marktzeit.
- Tatsächlich: `v.alter` steigt je Takt. Jeder Klick auf „Jetzt prüfen“ ist ein zusätzlicher Takt: 15 Klicks lassen einen frischen Vorschlag verfallen. Umgekehrt zählt ein Takt, der vorher abbricht (Broker nicht erreichbar, Markt geschlossen), nicht mit. Ein Vorschlag kann dann über die Pause hinweg „jung“ bleiben. Beim Bestätigen wird zwar der Kurs geprüft, schlägt aber das Laden der Kurse fehl (`.catch(() => ({}))`), entfällt auch diese Prüfung.
- Vermutete Ursache: `packages/trading/src/agent.ts`, Schritt 2 (`v.alter = (v.alter ?? 0) + 1`); `apps/web/app/api/trading/[id]/aktion/route.ts` (Prüfung `alter`, Kurs mit `catch`).
- Vorschlag: Zeitstempel des Signals speichern, Alter aus Uhr bzw. Simulationsminute berechnen; ohne aktuellen Kurs nicht ausführen.

### TRD-041 · Kein Hinweis, wenn das Risiko eines einzelnen Trades größer ist als das Verlustlimit des Tages
- Schweregrad: Hinweis
- Bereich: Assistent › Ziel & Grenzen
- Schritte: Startkapital 10.000, Risiko je Trade 1 % (100 €), Verlustlimit 20 €; 5 Tage durchspielen (Sim D)
- Beobachtet: Das Limit greift richtig mit Schließkosten, die Tage enden aber bei −23,51 / −28,60 / −26,42 / −25,58 / −22,48 €, also 12 % bis 43 % über dem Limit, weil schon die Spanne einer 4.000-€-Position (40 %) etwa 2 € kostet (`auswertung_D.txt`). Der Assistent warnt nicht.
- Vorschlag: Hinweis „Ein einzelner Trade darf bis zu 100 € verlieren, Ihr Tageslimit ist 20 €. Das Limit wird regelmäßig überschritten.“

## Abdeckung

**Geprüft:** alle 12 aufgetragenen Befunde mit den damaligen Schritten. 22 Simulationstage (Agenten A, B, D, M) mit Python aus dem Protokoll nachgerechnet: Tagesergebnis, Stopps gegen Hoch und Tief der Simulationskerzen (mit dem Code der App erzeugt), Risiko je Trade, Höchstposition, Trades je Tag, Positionen gleichzeitig, Schluss vor Handelsende, Verlustlimit mit Schließkosten (Limit 150 € und 20 €), Mindest-Chance. Verfall nach 15 Minuten, jenseits von Stopp/Ziel, Bestätigen davor und danach. Marktumfeld 75 % und 38 % bei drei Grenzkonstellationen (Risiko, Höchstposition 30 %, Höchstposition 10 %). Termin sofort wirksam, Anzeige aktualisiert sich, veraltete VIX-Werte (13 Tage, 11 Monate, 10 Tage). Umschalten mit Server- und Netzwerkfehler. API-Prüfung (falsche Typen, Live-Sperre, kaputtes JSON, fremde IDs, keine Secrets). Not-Aus mit Einzelprotokoll. Parallelbetrieb. Assistent und Cockpit Desktop und 390 px, Tastatur im Cockpit, Konsole und Netzwerk.

**Nicht prüfbar:** Alpaca Paper mit echter Verbindung (Kontowährung USD im Cockpit, Order-Zettel der eigenen App mit Kursquelle, Verfall in Echtzeit). Echtgeld mit `TRADING_LIVE=1`.

**Unverändert gesehen, nicht beauftragt:** TRD-035: Der erste Simulationstag ist weiter Samstag, der 24.10.2026.

**Angelegte Testdaten (Präfix QA-TRD W2), alle angehalten:** Sim A, Sim B Lang, Sim D Limit20, Sim M Mittelwert, Vorschlag, Vorschlag 2, Umfeld R/P/Q an/aus (f75, f38), UI Cockpit, Wizard desktop, Wizard mobil, Paper ohne, Eigene App, Parallel X/Y, Notaus, 028 / 028 b / 028 c. Konjunktur-Testdaten (global): `sp500` 260 Werte bis 23.10.2026, `vix` 5 Werte (zuletzt 35,8 am 23.10.), Termin „QA-TRD Fed-Zinsentscheid“ am 25.10.2026 (wichtig). Sie wirken auf alle Trading-Agenten (Positionsgröße 38 %). Wer ohne sie weitertesten will, löscht sie im Admin. Von anderen Daten wurde nichts gelöscht.
