# Befunde Trading

- Datum: 2026-10-23
- Geprüfter Stand: Commit 8f13f38 (Produktions-Build, Testmodus ohne Anmeldung, ohne Anthropic-Schlüssel, ohne `TRADING_LIVE`, ohne Alpaca-Schlüssel; Alpaca über Proxy nicht erreichbar)
- Zusammenfassung: 27 Befunde – Blocker 0, Hoch 10, Mittel 11, Niedrig 4, Hinweis 2

### TRD-001 · Echtgeld-Agent (`alpaca-live`) lässt sich trotz Sperre über die API anlegen, auf Automatik stellen und starten
- Schweregrad: Hoch
- Bereich: API › `POST /api/trading`, `PUT /api/trading/[id]`, `POST …/aktion` (start)
- Schritte: 1. `POST /api/trading` mit `{"einstellungen":{"name":"QA-TRD Live-Sperre","broker":"alpaca-live","modus":"auto"}}` 2. `POST …/aktion {"aktion":"start"}` 3. Alternativ: Simulations-Agent anlegen, `PUT /api/trading/[id] {"broker":"alpaca-live","modus":"auto"}`, dann starten. Ebenso `broker:"ibkr"` (geplant) und `broker:"foo"` (unbekannt).
- Erwartet: Ohne `TRADING_LIVE=1` lehnt der Server Anlegen, Broker-Wechsel und Start eines Live-Agenten mit 403/400 ab; gesperrte/geplante/unbekannte Broker werden gar nicht gespeichert.
- Tatsächlich: Alles 200. Der Agent steht auf `aktiv: true`, das Cockpit zeigt „handelt“. Orders gehen nur deshalb nicht raus, weil `brokerFuer` beim Takt wirft (Takt antwortet 500). Wird `TRADING_LIVE=1` später gesetzt, handelt ein so angelegter Agent sofort mit echtem Geld in Automatik, ohne dass der Nutzer den Assistenten (gesperrte Karte, kritischer Hinweis) je gesehen hat.
- Beleg: Agent `aotim0w4mvkyoza9` (QA-TRD Live-Sperre), `7q5h4xu7mvkypanl` (PUT-Wechsel), IBKR-Agent; HTTP 200/200/500; `GET` liefert `live.fehler = "Live-Handel ist auf diesem Server ausgeschaltet (TRADING_LIVE=1)."`
- Vermutete Ursache: `apps/web/app/api/trading/route.ts:14` übernimmt `einstellungen` ungeprüft; `apps/web/app/api/trading/[id]/route.ts:19` ebenso; `apps/web/app/api/trading/[id]/aktion/route.ts:23` startet ohne Broker-Prüfung. Die Sperre sitzt nur in `apps/web/lib/trading.ts:29`.
- Vorschlag: Serverseitige Prüfung der Einstellungen (Schema) inkl. erlaubter Broker je Umgebung, beim Anlegen, Ändern und Starten.

### TRD-002 · Not-Aus schlägt fehl, wenn der Broker nicht aufgebaut werden kann; der Agent bleibt „aktiv“
- Schweregrad: Hoch
- Bereich: Cockpit › Not-Aus, API `aktion: notaus`
- Schritte: 1. Agent mit Alpaca Paper ohne Schlüssel (oder `alpaca-live`, `ibkr`) anlegen 2. Starten 3. Not-Aus
- Erwartet: Not-Aus hält den Agenten immer an (`aktiv: false`), auch wenn der Broker nicht erreichbar ist, und meldet nur das Schließen der Positionen als fehlgeschlagen.
- Tatsächlich: HTTP 400 „Bitte Alpaca-Zugang (Key-ID und Secret) beim Agenten hinterlegen.“ bzw. „Live-Handel ist auf diesem Server ausgeschaltet“; `aktiv` bleibt `true`, der Dauerlauf versucht weiter. Nur „Anhalten“ hilft.
- Beleg: Agent „QA-TRD Paper ohne Schlüssel“, `aotim0w4mvkyoza9`; HTTP 400
- Vermutete Ursache: `apps/web/app/api/trading/[id]/aktion/route.ts:25` ruft `brokerFuer(a)` vor `notaus()`; wirft es, wird `z.aktiv = false` (`packages/trading/src/agent.ts:111`) nie erreicht.
- Vorschlag: Bei Not-Aus zuerst `aktiv=false` setzen und speichern, dann Schließen versuchen.

### TRD-003 · Not-Aus meldet „alle Positionen geschlossen“, obwohl das Schließen fehlgeschlagen ist
- Schweregrad: Hoch
- Bereich: Cockpit › Not-Aus, Protokoll
- Schritte: 1. Alpaca-Paper-Agent mit erfundenen Schlüsseln (Broker nicht erreichbar) 2. Starten 3. Not-Aus
- Erwartet: Klare Meldung „Positionen konnten nicht geschlossen werden – bitte beim Broker prüfen“; Oberfläche zeigt keinen Erfolg.
- Tatsächlich: Protokoll: „Fehler: Schließen fehlgeschlagen: fetch failed“ und direkt danach „Schluss: Not-Aus: Agent angehalten, alle Positionen geschlossen“. HTTP 200, die Oberfläche meldet „Not-Aus ausgeführt“. `z.gefuehrt` wird geleert, Stopp/Ziel-Überwachung ist damit weg, obwohl Positionen beim Broker evtl. noch offen sind.
- Beleg: Agent „QA-TRD Paper erfundener Schlüssel“, Protokoll 12:45:12
- Vermutete Ursache: `packages/trading/src/agent.ts:110-112` (Erfolgstext unabhängig vom `catch`).

### TRD-004 · Nicht erreichbarer Broker: Dauerlauf versucht alle 5 s statt 1×/Minute, Protokoll wächst ohne Grenze mit „fetch failed“
- Schweregrad: Hoch
- Bereich: Dauerlauf, Protokoll, Alpaca Paper
- Schritte: 1. Alpaca-Paper-Agent mit erfundenen Schlüsseln anlegen 2. Starten 3. 30 s warten, `GET /api/trading/[id]`
- Erwartet: Echte Broker höchstens einmal pro Minute (laut Kommentar in `lib/dauerlauf.ts`), Fehler zusammengefasst („Broker seit 12:45 nicht erreichbar“), Protokoll begrenzt.
- Tatsächlich: In 30 s sechs Einträge „Fehler: fetch failed“ im 5-s-Abstand, `letzterTakt` bleibt `null`. Hochgerechnet ~17 000 Einträge je Tag und Agent; die Begrenzung auf 400 greift nicht, weil `taktFuer` direkt `log.unshift` nutzt. Der Agent wirkt „aktiv“, handelt aber nie. Bei echtem Alpaca droht Rate-Limit.
- Beleg: Fehler-Zeitstempel 12:45:22, :27, :32, :37, :42, :47
- Vermutete Ursache: `packages/trading/src/agent.ts:32` setzt `letzterTakt` erst nach `await b.uhr()`; `apps/web/lib/trading.ts:48` (`log.unshift` ohne Begrenzung); Drosselung `trading.ts:60`.
- Vorschlag: `letzterTakt` vor dem Broker-Aufruf setzen, Fehler zusammenfassen, `protokoll()` nutzen; nach n Fehlern Agent anhalten und deutlich anzeigen.

### TRD-005 · Unklare technische Fehlermeldungen („fetch failed“, „Cannot read properties of undefined“) und leere HTTP-500 ohne Text
- Schweregrad: Mittel
- Bereich: API › aktion, Cockpit-Hinweis, Protokoll
- Schritte: 1. Alpaca-Agent mit nicht erreichbarem Broker öffnen → Hinweis „fetch failed“ 2. `POST …/aktion {"aktion":"zugang"}` ohne Felder 3. `POST …/aktion` mit kaputtem JSON, `PUT` mit kaputtem JSON 4. `aktion: takt`/`tag` bei Live-, IBKR-, Paper-ohne-Schlüssel-Agent
- Erwartet: Verständliche deutsche Meldung („Alpaca nicht erreichbar, bitte Verbindung/Schlüssel prüfen“) bzw. 400 mit `fehler`-Text.
- Tatsächlich: (1) „fetch failed“ im Cockpit und Protokoll; (2) 400 „Cannot read properties of undefined (reading 'trim')“; (3) 500 ohne Body; (4) 500 ohne Body – die Oberfläche zeigt dann den JSON-Parse-Fehler des Browsers bzw. nichts, im Protokoll steht kein Eintrag.
- Beleg: curl-Läufe, HTTP 500 leer
- Vermutete Ursache: `aktion/route.ts:12` `req.json()` ohne catch; `[id]/route.ts:17` ebenso; `lib/trading.ts:45` `brokerFuer` außerhalb des try in `taktFuer`.

### TRD-006 · API speichert beliebige, ungültige Einstellungen; kaputtes JSON legt still einen Standard-Agenten an
- Schweregrad: Mittel
- Bereich: API › `POST /api/trading`, `PUT /api/trading/[id]`
- Schritte: 1. `POST /api/trading` mit Body `{kaputt` bzw. leerem Body 2. `POST` mit `{"einstellungen":{"startkapital":"abc","symbole":"AAPL","strategie":"gibtsnicht","broker":"foo","tagesziel":-5,"tagesverlust":null}}` 3. `PUT` mit `{"tenant":"fremd","id":"x"}`
- Erwartet: 400 mit Feldfehlern; nur bekannte Felder werden übernommen.
- Tatsächlich: (1) 200, Agent „Mein Trading-Agent“ (ohne Prefix) wird angelegt; (2) 200, alle Werte so gespeichert, `takt`/`tag` danach 500; (3) 200, `tenant`/`id` landen als Fremdfelder in `einstellungen` (die Kennung selbst bleibt zum Glück unverändert). Folgefehler siehe TRD-001.
- Beleg: Agenten `7hdx1d6tmvkypqym`, `svmszwbdmvkypqz9` (umbenannt in „QA-TRD …“), `vujw62u4mvkypqzu`
- Vermutete Ursache: `apps/web/app/api/trading/route.ts:13-14`, `[id]/route.ts:19`

### TRD-007 · „Trades je Tag höchstens“ greift nicht: mehrere Einstiege im selben Takt und bestätigte Vorschläge überschreiten das Limit
- Schweregrad: Hoch
- Bereich: Risikomanager › Trades je Tag (Automatik und Vorschläge)
- Schritte: 1. Simulations-Agent „QA-TRD Sim C“: Automatik, Mittelwert (z 0,5, Rückblick 5), 10 Werte, Trades/Tag 2, Positionen gleichzeitig 6 2. Drei Tage minutenweise über `POST …/aktion {"aktion":"takt"}` durchtakten 3. Agent „QA-TRD Sim E“ im Vorschlagsmodus, Trades/Tag 2: vier Vorschläge nacheinander bestätigen
- Erwartet: Höchstens 2 Einstiege je Tag.
- Tatsächlich: C: an allen drei Tagen 6 Einstiege (alle um 09:36 im selben Takt), `tag.trades` = 6, Kachel „Trades heute 6 / 2“. E: vier Bestätigungen werden ausgeführt, `tag.trades` = 4 / 2.
- Beleg: `sim_C.json`, `auswertung_1.txt` („Trades je Tag überschritten 3 [('2026-10-23', 6, 2), …]“), `vorschlag_tests.txt`
- Vermutete Ursache: `packages/trading/src/agent.ts:92` prüft `tag.trades >= maxTradesTag` nur einmal vor der Schleife; `agent.ts:96` begrenzt nur nach `maxPositionen - offen.size`. `aktion/route.ts:28-40` prüft beim Bestätigen gar keine Grenzen.
- Vorschlag: In der Schleife `maxTradesTag - tag.trades` mitbegrenzen; beim Bestätigen dieselben Prüfungen wie im Takt.

### TRD-008 · Vorschlag bestätigen mit beliebiger Stückzahl umgeht alle Risikoregeln (Short über das 360-fache des Kontos)
- Schweregrad: Hoch
- Bereich: API › `aktion: vorschlag` (Feld `qty`), Simulation/Alpaca
- Schritte: 1. Agent „QA-TRD Sim E“ (Vorschläge, 10.000 €, Höchstposition 20 %, Risiko 0,5 %) bis zu offenen Vorschlägen takten 2. Short-Vorschlag META (55 Stück) bestätigen mit `{"aktion":"vorschlag","id":…,"ok":true,"qty":100000}`
- Erwartet: Stückzahl wird gegen Risiko je Trade, Höchstposition und Guthaben geprüft (oder `qty` ist nur für die eigene App erlaubt und höchstens die vorgeschlagene Menge).
- Tatsächlich: 200. Position META −100.000 Stück, Wert −3.619.000 €, Konto sofort 8.190,50 € (−1.809,50 € allein durch die Spanne); `cash` 3.627.190,50 €. Bei Long greift nur die Guthabenprüfung der Simulation; bei Alpaca ginge die Order unverändert raus.
- Beleg: `vorschlag_tests.txt` (Abschnitt a)
- Vermutete Ursache: `apps/web/app/api/trading/[id]/aktion/route.ts:33` übernimmt `b.qty` ohne Prüfung; `packages/trading/src/broker.ts:62` prüft Guthaben nur für Käufe.

### TRD-009 · Nach Verlustlimit/Tagesziel bleiben Vorschläge offen und ausführbar; so eröffnete Positionen werden nie mehr geschlossen (auch nicht vor Handelsende)
- Schweregrad: Hoch
- Bereich: Cockpit › Vorschläge, Risikomanager › Verlustlimit/Tagesziel/Schluss vor Ende
- Schritte: 1. „QA-TRD Sim E“ (Vorschläge, Verlustlimit 30 €) 2. Einige Vorschläge bestätigen, takten bis „Verlustlimit erreicht“ 3. Zwei der weiterhin offenen Vorschläge (TSLA, SPY Short) mit „Ausführen“ bestätigen 4. weiter takten
- Erwartet: Mit Erreichen von Ziel/Limit verfallen offene Einstiegs-Vorschläge (oder lassen sich nicht mehr bestätigen); jede offene Position wird spätestens vor Handelsende geschlossen.
- Tatsächlich: Nach dem Limit stehen 4 Vorschläge weiter mit „Ausführen“-Knopf da. Bestätigung → 200, Positionen TSLA −5 und SPY −40 offen bei Status „Verlustlimit erreicht“. Jeder weitere Takt endet mit „Verlustlimit erreicht, Stopp für heute“, ohne Stopp/Ziel zu prüfen und ohne „15 Minuten vor Handelsschluss“ zu schließen – die Positionen gehen über Nacht.
- Beleg: `vorschlag_tests.txt` (Abschnitt c)
- Vermutete Ursache: `packages/trading/src/agent.ts:65` kehrt bei `tag.status !== "laeuft"` vor allen Prüfungen zurück; Vorschläge verfallen nur bei neuem Tag (`agent.ts:43`); `aktion/route.ts:29` prüft nur `v.status`.
- Vorschlag: Bei Ziel/Limit/Not-Aus offene Einstiegs-Vorschläge auf „verfallen“ setzen; bei Status ≠ läuft trotzdem offene Positionen schließen.

### TRD-010 · Grenzwerte werden weder im Assistenten noch auf dem Server geprüft: 0/negativ legt den Agenten still lahm, sehr große Werte erlauben Positionen weit über das Konto hinaus
- Schweregrad: Hoch
- Bereich: Agent anlegen › Ziel & Grenzen; Risikomanager
- Schritte: 1. `/trading/neu` → Schritt 2: Tagesziel `0`, Verlustlimit `-50`, Risiko `1,5`, Höchstens je Position `100000`, Trades je Tag `0`, Positionen gleichzeitig `-1`, Schluss vor Ende `500` 2. Auswirkungen je Wert mit einem Simulations-Agenten (10.000 €, 10 Werte, Automatik) über `aktion: tag` geprüft
- Erwartet: Feldfehler („Erlaubt: …“), sinnvolle Grenzen (z. B. Höchstposition ≤ 100 %, Risiko ≤ 5 %, Schluss < 390 Min., Ziel/Limit > 0) und eine Warnung, wenn der Agent so nie handeln kann.
- Tatsächlich: Keine einzige Fehlermeldung, kein Hinweis (die `Zahl`-Felder bekommen kein `min`/`max`). Ergebnis in der Simulation: Ziel 0 → um 09:30 „Tagesziel erreicht (+0,00 €)“, kein Trade; Verlustlimit −50 → „Verlustlimit erreicht (0,00 €)“; Schluss 500 Min. → sofort „500 Minuten vor Handelsschluss“; Trades 0 / Positionen −1 / Risiko 0 → ganzer Tag ohne Trade. Höchstposition 1000 (= 100.000 %) mit Risiko 50 % → **Short 17.857 MSFT ≈ 3,3 Mio. € bei 10.000 € Konto**, in einer Minute −3.792,56 € (Limit 100 €).
- Beleg: `14_neu_grenzfaelle.png`, `grenzwerte_sim.txt`
- Vermutete Ursache: `apps/web/app/trading/neu/page.tsx:60-66` (keine `min`/`max`), `packages/trading/src/agent.ts:126-132` (`hinweise` prüft nur Obergrenzen einzelner Werte); Short-Größe `agent.ts:23` ist nur durch `equity * maxPosition` begrenzt; keine Server-Prüfung (TRD-006).

### TRD-011 · Startkapital ändern setzt Strategie, Strategie-Werte und Richtung aus Schritt 3 still zurück
- Schweregrad: Mittel
- Bereich: Agent anlegen › Ziel & Grenzen / Strategie
- Schritte: 1. Schritt 2: Tagesziel 77 2. Schritt 3: „Rückkehr zum Mittelwert“, Abweichung 3 σ, „Long und Short“ 3. Über den Schrittkopf zurück zu „Ziel & Grenzen“, Startkapital 5000 4. Weiter zu Schritt 3
- Erwartet: Die Vorlage zieht nur die Geldgrenzen mit (Tagesziel, Verlustlimit); Strategie und Richtung bleiben.
- Tatsächlich: Strategie wieder „Ausbruch“, Richtung „Nur Long“, eigene σ-Werte verloren; ebenso das manuell gesetzte Tagesziel (erwartet, aber ohne Hinweis). Auch jede Vorlage-Karte überschreibt Strategie und Werte ohne Hinweis.
- Beleg: `19_strategie_zurueckgesetzt.png`
- Vermutete Ursache: `apps/web/app/trading/neu/page.tsx:21` und `:54` (`nimmVorlage` bei jeder Kapitaländerung, Vorlage enthält `strategie`, `werte`, `richtung`).

### TRD-012 · Eigene App: Vorlage „Ausgewogen“/„Aktiv“ stellt wieder „Long und Short“ ein, obwohl die Option gesperrt ist
- Schweregrad: Niedrig
- Bereich: Agent anlegen › Eigene App
- Schritte: 1. Broker „Eigene App“ 2. Schritt 2: Vorlage „Ausgewogen“ 3. Schritt 3/4 ansehen
- Erwartet: Richtung bleibt „Nur Long“.
- Tatsächlich: Chip „Long und Short“ ist ausgegraut, aber gewählt (`aria-pressed=true`); Zusammenfassung zeigt „Long und Short“; nur ein Info-Hinweis erklärt, dass Short nicht vorgeschlagen wird. Gespeichert wird `richtung: "long-short"`.
- Beleg: Ausgabe Schritt 3 „Long/Short chip disabled: True pressed: true“
- Vermutete Ursache: `apps/web/app/trading/neu/page.tsx:21` (Vorlage überschreibt `richtung`), Server `route.ts:15` setzt nur `modus` zurück.

### TRD-013 · Werte-Eingabe: Kleinschreibung erzeugt doppelten Eintrag, der sich danach nicht mehr entfernen lässt; ungültige Kürzel werden angenommen
- Schweregrad: Mittel
- Bereich: Agent anlegen › Strategie › Werte
- Schritte: 1. Schritt 3, Werte enthalten AAPL 2. `aapl` + Enter 3. Auf × bei AAPL klicken (mehrmals) 4. `!!x$` und `sap.de` eingeben
- Erwartet: `aapl` wird als vorhandenes AAPL erkannt; Kürzel werden geprüft (Format, bei Alpaca/Simulation bekannte US-Werte).
- Tatsächlich: Zwei „AAPL“-Chips. Ein Klick entfernt beide aus dem Zustand, aber ein „Geister-Chip“ AAPL bleibt sichtbar und reagiert nicht mehr; gleichzeitig wird „+ AAPL“ angeboten; die Zusammenfassung zeigt „MSFT, NVDA, AMD, TSLA, META“ (ohne AAPL). `!!X$` und `SAP.DE` werden angenommen; in der Simulation erzeugt jedes beliebige Kürzel künstliche Kurse und wird gehandelt.
- Beleg: `18a_werte_duplikat.png`, `18b_werte_zusammenfassung.png`, `16_neu_werte.png`
- Vermutete Ursache: `apps/web/components/Felder.tsx:66` prüft Duplikate vor dem Großschreiben (`apps/web/app/trading/neu/page.tsx:81` schreibt erst danach groß), doppelte React-`key` in `Felder.tsx:71`.

### TRD-014 · Cockpit rundet Kurse, Einstand, Stopp und Ziel auf ganze Euro – für Daytrading unbrauchbar und irreführend
- Schweregrad: Hoch
- Bereich: Cockpit › Positionen, Vorschläge, Kacheln, Verlauf
- Schritte: 1. „QA-TRD UI Sim“ (Ausbruch, Ausgewogen) bis 10:57 (Simulation) laufen lassen 2. Tabelle „Positionen“ ansehen
- Erwartet: Kurse mit 2 Nachkommastellen (z. B. Stopp 42,07 / Ziel 42,88), G/V auf den Cent.
- Tatsächlich: NVDA „Einstand 42 €, Kurs 42 €, G/V 1 €, Stopp / Ziel 42 € / 43 €“ – Stopp (42,07) und Einstand (42,36) sind nicht zu unterscheiden; AMD „271 € / 272 €, Stopp/Ziel 268 € / 274 €“. Ebenso Vorschlagskarten („Stopp …, Ziel …, Kurs …“), Kacheln „Konto 10.013 €“, „heute +13 €“, Verlauf „-35 €“ und Grenzenbalken.
- Beleg: `23_cockpit_sim_laufend.png`
- Vermutete Ursache: `apps/web/lib/format.ts:2` (`eur` mit `maximumFractionDigits: 0`), verwendet in `apps/web/app/trading/[id]/page.tsx:43-71`.
- Vorschlag: Eigene Formatierung für Kurse/Trading mit 2 Nachkommastellen (und der richtigen Währung, siehe TRD-015).

### TRD-015 · Währung durchgängig „€“, obwohl US-Aktien in US-Dollar gehandelt werden; Kontowährung des Brokers wird ignoriert
- Schweregrad: Mittel
- Bereich: Assistent (Startkapital, Tagesziel), Cockpit, Protokoll, Liste, Startseite
- Schritte: 1. Agent mit Simulation oder Alpaca Paper anlegen 2. Cockpit/Protokoll ansehen
- Erwartet: Kurse von AAPL, NVDA … in $; Kontostand in der Währung des Kontos (Alpaca liefert `currency: "USD"`); bei EUR-Konto (Trade Republic) Hinweis auf Umrechnung.
- Tatsächlich: „Kauf 11.095 AMD zu 270,51“, „Stopp 268 €“, „Konto 10.013 €“, „Neuer Handelstag, Konto 10.000,00 €“, „Tagesziel erreicht (+0,00 €)“. Die Simulation meldet fest `waehrung: "EUR"`, die Oberfläche nutzt `konto.waehrung` nirgends; das Alpaca-Paper-Konto (Standard 100.000 $) würde als „100.000 €“ erscheinen, „seit Start“ rechnet gegen das eingegebene Startkapital in €.
- Beleg: `23_cockpit_sim_laufend.png`, Protokolle in `sim_A.json`
- Vermutete Ursache: `packages/trading/src/broker.ts:71`, `agent.ts:12` + Texte `agent.ts:36,44,66-67`, `apps/web/app/trading/[id]/page.tsx` (überall `eur`).

### TRD-016 · Gemischtes Zahlenformat im Protokoll: Stückzahl „70.895“ liest sich als siebzigtausend
- Schweregrad: Mittel
- Bereich: Protokoll, Vorschläge, Zusammenfassung im Assistenten
- Schritte: Simulation laufen lassen, Protokoll lesen; Assistent Schritt 4 mit Startkapital 1.000.000
- Erwartet: Durchgängig de-DE: „70,895 Stück“, „(42,19)“, „2,07-fachem Volumen“, „+40.000 €“.
- Tatsächlich: Protokoll „Kauf 70.895 NVDA zu 42,36“ (Stückzahl mit Punkt als Dezimaltrenner, Preis mit Komma im selben Satz), Gründe „Hoch der ersten 15 Minuten (42.19) mit 2.07-fachem Volumen“, „5.62 Standardabweichungen … (154.37)“, „Kurs -1.92 %“; Bestätigungen „Bestätigt: Verkauf 40 SPY zu 49.04“; Zusammenfassung „Tagesziel / Verlustlimit +40000 € / −25000 €“; Zeitstempel teils Simulationszeit „10:41 (Simulation)“, teils Echtzeit „14:58:24“ in derselben Liste.
- Beleg: `23_cockpit_sim_laufend.png`, `vorschlag_tests.txt`
- Vermutete Ursache: `packages/trading/src/agent.ts:62,77,101` (`antrag.qty` roh), `strategien.ts:18-20,30-31,42-43` (`r2` ohne Locale), `aktion/route.ts:39`, `neu/page.tsx:94`.

### TRD-017 · Angehaltener Agent handelt trotzdem: „Jetzt prüfen“ und „Rest des Tages sofort durchspielen“ eröffnen in Automatik neue Positionen, auch nach Not-Aus
- Schweregrad: Hoch
- Bereich: Cockpit › Jetzt prüfen / Tag durchspielen; API `aktion: takt|tag`
- Schritte: 1. „QA-TRD UI Sim“ (Automatik) läuft, Not-Aus auslösen (Status „angehalten“, „Not-Aus“) 2. Zweimal „Rest des Tages sofort durchspielen“
- Erwartet: Ein angehaltener Agent sendet keine Orders; „Jetzt prüfen“ prüft (zeigt Signale) statt zu handeln, oder fragt nach.
- Tatsächlich: Badge bleibt „angehalten“, trotzdem am Folgetag 6 Einstiege („Trades heute 6 / 6“), Konto 9.970 €. Beim echten Broker (Alpaca) würde „Jetzt prüfen“ an einem angehaltenen Automatik-Agenten echte Orders senden.
- Beleg: `26_tag_durchgespielt.png`
- Vermutete Ursache: `apps/web/app/api/trading/[id]/aktion/route.ts:15-19` und `apps/web/lib/trading.ts:42-53` prüfen `zustand.aktiv` nicht.

### TRD-018 · Liste und Startseite zeigen nach Tagesende „–“ bzw. „läuft“ statt des Ergebnisses
- Schweregrad: Mittel
- Bereich: `/trading` (Kachel „heute“), Startseite (Abschnitt „Trading heute“)
- Schritte: 1. Simulationstag bis 16:00 durchspielen (Status „Ziel“, „Limit“ oder „Schluss“) 2. `/trading` und `/` öffnen
- Erwartet: Tagesergebnis (z. B. „−27,80 €“, „Verlustlimit erreicht“).
- Tatsächlich: Liste „heute –“, Startseite „läuft“ bei allen fünf Sim-Agenten, obwohl die Tage mit Ziel/Limit/Schluss beendet sind. `tag.ende` wird bei Ziel/Limit/Schluss vor Ende nicht gesetzt, sondern erst beim nächsten Handelstag.
- Beleg: Textauszug Startseite („QA-TRD Sim D Kleines Ziel – läuft“, Status `limit`), `02_trading_liste.png`, `01_start.png`
- Vermutete Ursache: `packages/trading/src/agent.ts:57` (`allesSchliessen` setzt kein `ende`), `:36` setzt `ende` nur bei Status „laeuft“; `apps/web/app/page.tsx:36`, `apps/web/app/trading/page.tsx:21,25`.

### TRD-019 · Protokoll reicht zum Nachrechnen nicht: Sammelschlüsse ohne Einzelorders/Preise, geloggte Preise weichen von der Buchung ab
- Schweregrad: Mittel
- Bereich: Protokoll, Simulation
- Schritte: 1. „QA-TRD Sim A“ Tag 23.10.2026 aus dem Protokoll nachrechnen (`handrechnung_A_tag1.txt`) 2. Sim B/D: Tage mit Ziel/Limit
- Erwartet: Jede Ausführung steht mit Stückzahl und Ausführungskurs im Protokoll; Summe der Buchungen = Tagesergebnis.
- Tatsächlich: (a) Handrechnung aus dem Protokoll ergibt +3,21 €, die App bucht +3,57 € (Cash 10.003,5747): geloggt wird der auf Cent gerundete Kurs, gebucht der ungerundete Kurs inkl. Spanne. (b) Ziel, Verlustlimit, „15 Minuten vor Handelsschluss“ und Not-Aus schließen Positionen nur mit der Sammelzeile „alle Positionen geschlossen“ – ohne Werte, Stück, Kurse. Bei Sim D wurden 10 von 18 Trades so geschlossen, ihr Ergebnis ist aus dem Protokoll nicht nachvollziehbar.
- Beleg: `handrechnung_A_tag1.txt`, `trade_verluste.txt`
- Vermutete Ursache: `packages/trading/src/broker.ts:63,66` (Buchung mit `k`, Rückgabe `rd(k)`), `agent.ts:55` (`schliesseAlle` ohne Einzelprotokoll).

### TRD-020 · Verlustlimit und Stopps werden nur am Minutenschluss geprüft; Limit wird deutlich überschritten
- Schweregrad: Mittel
- Bereich: Risikomanager › Verlustlimit, Stopps
- Schritte: 3 Simulationstage je Agent A–D minutenweise über die API (`sim_lauf.py`, `auswertung.py`)
- Erwartet: Verlust je Tag ≈ Verlustlimit, Verlust je Trade ≈ Risikobudget (Toleranz für Spanne).
- Tatsächlich: Sim D (Limit 20 €): Tagesergebnis −32,50 € (163 %), −27,80 €, Limit greift erst bei −24,69 €; Sim B (Limit 250 €): −266,56 €. Sim A: AAPL-Short Stopp 157,27, Ausstieg 158,12 → −63,24 € bei Budget 50,02 € (1,26×). Die Spanne beim Schließen (0,05 % je Seite) ist im Limit nicht eingerechnet. Zusätzlich (Mittelwert-Strategie): Einstieg TSLA Short zu 335,39 mit Ziel 335,47 – das Ziel liegt nach Spanne bereits hinter dem Ausführungskurs, „Ziel erreicht“ wäre ein Verlust.
- Beleg: `auswertung_1.txt`, `trade_verluste.txt`, `ziel_hinter_einstieg.txt`
- Vermutete Ursache: `packages/trading/src/agent.ts:66-67,86` (Prüfung nur gegen Schlusskurs/Equity zum Taktbeginn); `strategien.ts:30` (Ziel = VWAP ohne Mindestabstand).
- Vorschlag: Limit mit Puffer (erwartete Kosten der offenen Positionen) prüfen, Stopps gegen Hoch/Tief der Minute, Signale ohne Mindest-Chance-Risiko verwerfen; im Assistenten erklären, dass das Limit überschritten werden kann.

### TRD-021 · „Eigene App“ ohne Alpaca-Zugang funktioniert nicht, der Assistent sagt aber „Können Sie auch später eintragen“
- Schweregrad: Mittel
- Bereich: Agent anlegen › Eigene App; Cockpit
- Schritte: 1. Broker „Eigene App“, keinen Zugang eintragen, anlegen 2. Cockpit ansehen, starten
- Erwartet: Deutlicher Hinweis im Assistenten und Cockpit: „Ohne Kursquelle (Alpaca-Daten) kann der Agent keine Signale erzeugen“, oder eine eingebaute Kursquelle.
- Tatsächlich: Der Bedarf steht nur im Info-Tooltip und als Nebensatz „Dient nur als Kursquelle“. Das Cockpit zeigt „Konto 10.000 €“, „Starten“ funktioniert; zur Handelszeit würde jeder Takt mit „Für Marktdaten bitte einen Datenzugang (Alpaca, kostenlos) hinterlegen.“ scheitern (Code, nicht live prüfbar, da US-Markt während des Tests geschlossen und Alpaca nicht erreichbar). Die Positionen werden ohne Kursquelle mit dem Einstand bewertet (G/V immer 0).
- Beleg: `12_neu_eigeneapp.png`, `22_cockpit_Eigene_App.png`
- Vermutete Ursache: `packages/trading/src/broker.ts:135` (`bars` wirft), `:134` (Kurs = Einstand), `apps/web/app/trading/neu/page.tsx:46`.

### TRD-022 · Alpaca Paper: Cockpit ohne Kontostand und mit Startkapital in €, das für Alpaca keine Rolle spielt
- Schweregrad: Mittel
- Bereich: Agent anlegen › Ziel & Grenzen; Cockpit Alpaca Paper
- Schritte: 1. Alpaca Paper mit Startkapital 10.000 € anlegen 2. Cockpit öffnen (Broker nicht erreichbar)
- Erwartet: Hinweis, dass bei Alpaca der Kontostand des Paper-Kontos gilt (Standard 100.000 $) und Ziel/Limit dazu passen müssen; bei fehlender Verbindung ein klarer Status („keine Verbindung zu Alpaca“).
- Tatsächlich: Kopfzeile „Alpaca Paper ·“ (abgebrochener Text), Kacheln alle „–“, Hinweis „fetch failed“. Die Vorlage leitet Tagesziel/Limit aus den eingegebenen 10.000 € ab; „seit Start“ würde Paper-Equity (USD) minus Startkapital (EUR) rechnen.
- Beleg: `22_cockpit_Alpaca_Paper.png`
- Vermutete Ursache: `apps/web/app/trading/[id]/page.tsx:37,43`; `packages/trading/src/agent.ts:123-124`.

### TRD-023 · Leerer Zugang überschreibt einen hinterlegten Alpaca-Zugang still
- Schweregrad: Niedrig
- Bereich: API › `aktion: zugang`
- Schritte: 1. Zugang hinterlegen 2. `POST …/aktion {"aktion":"zugang","keyId":"","secret":""}`
- Erwartet: 400 „Key-ID und Secret erforderlich“.
- Tatsächlich: 200, Protokoll „Broker-Zugang hinterlegt“, `zugangHinterlegt: true`, gespeichert sind leere Werte (wirkt wie gelöscht, der Server fiele auf `ALPACA_KEY_ID` aus der Umgebung zurück). Die Oberfläche verhindert das per deaktiviertem Knopf.
- Vermutete Ursache: `apps/web/app/api/trading/[id]/aktion/route.ts:27`, `apps/web/lib/trading.ts:22`.

### TRD-024 · Mobil (390 px): Assistent ist 5 px breiter als der Bildschirm
- Schweregrad: Niedrig
- Bereich: `/trading/neu` mobil
- Schritte: Viewport 390×844, `/trading/neu`, alle vier Schritte
- Erwartet: Kein waagerechtes Scrollen.
- Tatsächlich: `scrollWidth` 395 bei `clientWidth` 390 in allen Schritten; Kopfleiste (`.appbar`, `.menue-b`) ragt bis 395 px. Start, Liste und Cockpit sind in Ordnung (Positionstabelle scrollt innerhalb der Karte).
- Beleg: `32_m_neu1.png` … `35_m_neu4.png`, `36_m_cockpit.png`

### TRD-025 · Assistent: Neuladen verwirft alle Eingaben; Abbrechen in Schritt 1 nach Eingabe der Schlüssel ohne Rückfrage
- Schweregrad: Niedrig
- Bereich: Agent anlegen
- Schritte: 1. Bis Schritt 3 ausfüllen, Seite neu laden 2. Schritt 1: Alpaca Paper wählen, Schlüssel eintragen, „Abbrechen“
- Erwartet: Entwurf bleibt erhalten (oder Warnung beim Verlassen); Rückfrage, sobald etwas eingegeben wurde.
- Tatsächlich: Nach Neuladen wieder Schritt 1 mit Standardwerten. Abbrechen in Schritt 1 springt ohne Rückfrage zu `/trading` (Rückfrage erst ab Schritt 2, `20_abbrechen_dialog.png`).
- Vermutete Ursache: `apps/web/app/trading/neu/page.tsx:20` (`useAbbrechen(…, schritt > 1)`).

### TRD-026 · Vorschlag „Ausführen“ ohne erneute Prüfung: Ausführung zum aktuellen Kurs, Stopp/Ziel vom alten Signal
- Schweregrad: Hinweis
- Bereich: Cockpit › Vorschläge
- Schritte: Vorschlag liegen lassen, Kurs läuft weiter, dann „Ausführen“
- Erwartet: Vor dem Ausführen aktueller Kurs, Abstand zu Stopp/Ziel und neue Stückzahl anzeigen; Vorschlag nach einigen Minuten verfallen lassen. Bei „Eigene App“ ein Feld für die tatsächlich ausgeführte Stückzahl (Teilausführung), die API kennt `qty` bereits.
- Tatsächlich: Ausführung zum Kurs der aktuellen Minute mit Stopp/Ziel/Stückzahl des ursprünglichen Signals; Vorschläge bleiben bis zum nächsten Handelstag offen (siehe auch TRD-009). Die Karte zeigt „09:36 (Simulation)“, auch wenn es 11:00 ist.
- Vermutete Ursache: `apps/web/app/api/trading/[id]/aktion/route.ts:28-40`

### TRD-027 · Auswahlkarten (Broker, Vorlage, Strategie, Betriebsart) sind `role="radio"`, reagieren aber nicht auf Pfeiltasten
- Schweregrad: Hinweis
- Bereich: Querschnitt › Tastatur
- Schritte: Assistent mit Tab bedienen; auf „Simulation“ Pfeil rechts
- Erwartet: Radiogruppe mit Pfeiltasten (eine Tab-Stelle) oder normale Buttons ohne Radio-Rolle.
- Tatsächlich: Jede Karte ist eigener Tab-Stopp, Pfeiltasten ohne Wirkung. Fokus ist überall sichtbar, die Bedienung per Tab/Enter funktioniert vollständig; gesperrte Broker werden korrekt übersprungen.

## Abdeckung

**Geprüft (mit Befund oder ohne):**
- Start und Navigation: Startseite → Trading-Karte (Anzahl Agenten/aktiv), `/trading` mit 20+ Agenten, Links Investments/Trading/„+ Agent einstellen“, Menü in Kopfzeile, Zurück-Link im Cockpit. Leerer Zustand nur per Code gelesen (der Server hatte bereits Agenten des parallelen Laufs bzw. eigene; Text und Stufen 1–3 vorhanden). → TRD-018
- Assistent alle 4 Schritte: Simulation, Alpaca Paper ohne/mit erfundenen Schlüsseln, Eigene App mit leerem App-Namen, IBKR/Alpaca live korrekt deaktiviert; Vorlagen vorsichtig/ausgewogen/aktiv; Startkapital ändern (Vorlage zieht mit), leeres Startkapital (→ 500), `1.000.000,50`, Komma als Dezimaltrenner (funktioniert), 0/negativ/sehr groß; Strategien Ausbruch/Mittelwert/Auffälligkeiten mit ihren Feldern (VWAP wird nicht als eigene Strategie angeboten, nur intern im Mittelwert); Werte hinzufügen/entfernen, Kleinschreibung, ungültige Kürzel, keine Werte (Weiter korrekt gesperrt); Richtung Long/Short (bei Eigener App gesperrt), Betriebsart (Automatik bei Eigener App gesperrt); Zusammenfassung; Neuladen und Abbrechen; Anlegen über die Oberfläche für Simulation, Eigene App, Alpaca Paper. → TRD-010 bis TRD-013, TRD-016, TRD-025, TRD-027
- Cockpit: Starten, Anhalten, Takt („Jetzt prüfen“, auch 5× schnell hintereinander – keine Doppelverarbeitung, Takte werden serialisiert), „Rest des Tages“, Not-Aus mit Dialog, Zurücksetzen mit Dialog (funktioniert), Vorschläge ausführen/ablehnen (API und Oberfläche), Zugang nachtragen (API und Oberfläche), Agent löschen (aktiv → 409, korrekt). → TRD-002, TRD-003, TRD-009, TRD-014, TRD-017, TRD-026
- Risikoregeln: 4 Automatik-Agenten (A Ausbruch/Ausgewogen, B Auffälligkeiten/Aktiv, C Mittelwert mit engen Trade-Limits, D kleines Ziel/Limit) je 3 Simulationstage minutenweise über `POST …/aktion` (1.173 Takte je Agent), dazu Vorschlags-Agent E und 7 Grenzwert-Agenten über `aktion: tag`. Mit Python geprüft: Stopp bei Tagesziel (B Tag 3: +405,26 € bei Ziel 400 → alles geschlossen, keine neuen Trades) und Verlustlimit (B Tag 2, D alle Tage) ✔; alles vor Handelsende geschlossen (`schlussVorEnde`) ✔ (außer TRD-009); Risiko je Trade bei der Stückzahl ✔ (kein Verstoß beim Einstieg), Höchstposition ✔ (bei sinnvollen Werten), Positionen gleichzeitig ✔; Trades je Tag ✘ (TRD-007); Stopp-/Limit-Überschreitung (TRD-020). Handrechnung Gewinn/Verlust und Kontostand für Sim A, 23.10.2026: +3,21 € aus Protokoll vs. +3,57 € gebucht (TRD-019); Kontostand = Cash bei 0 Positionen ✔, Startkapital Folgetag = Ende Vortag ✔.
- Sicherheit (curl): `GET /api/trading`, `GET /api/trading/[id]`, Antworten von `POST`/`aktion` liefern nie Key-ID oder Secret (nur `zugangHinterlegt`) ✔; Secret im `store.json` nur verschlüsselt ✔ (Key-ID im Klartext, unkritisch); `alpaca-live` über API anleg- und startbar (TRD-001), aber keine Order (Sperre in `brokerFuer` greift) ✔; kaputtes JSON, leere Bodies, fehlende Felder, unbekannte Aktion (200 ohne Wirkung), fremde IDs (404 ✔), Pfad-Traversal (404 ✔), falsche Methode (405 ✔), `PUT` mit Fremdfeldern. → TRD-005, TRD-006, TRD-008, TRD-023
- Dauerlauf und Mehrfachbetrieb: zwei Sim-Agenten parallel im Dauerlauf (je 7 Minuten in 33 s, ✔), Neuladen während laufendem Tag (Zustand und Protokoll bleiben erhalten ✔), 80 parallele Takt-Anfragen (alle serialisiert, keine verlorenen Updates ✔), Löschen während `aktion: tag` (kein Wiederauferstehen beobachtet), Dauerlauf bei nicht erreichbarem Broker (TRD-004).
- Querschnitt: Mobil 390 px (Start, Liste, Assistent, Cockpit mit Vorschlägen/Positionen) → TRD-024; Tastatur → TRD-027; Konsolenfehler: außer `net::ERR_TUNNEL_CONNECTION_FAILED` für Google Fonts (Umgebung/Proxy, kein App-Fehler) keine Konsolen- oder Seitenfehler, keine HTTP ≥ 400 bei normaler Bedienung; Zahlen-/Währungsformat → TRD-014 bis TRD-016; „keine Anlageberatung“ in Liste und Schritt 4 vorhanden ✔, im Cockpit nur über den allgemeinen Fußtext; Verständlichkeit für Einsteiger: Hinweise im Assistenten (kleines Kapital, >2 % Risiko, Tagesziel >5 %) erscheinen korrekt.

**Nicht prüfbar:**
- Alpaca Paper/Live mit echter Verbindung (Kurse, Orders, Positionen, `schliesseAlle`, Uhr): Alpaca über den Proxy nicht erreichbar; nur Fehlerverhalten geprüft (TRD-002 bis TRD-005).
- Order-Zettel der „Eigenen App“ buchen (Kurs eintragen, `bucheManuell`): ohne Kursquelle entstehen keine Zettel, außerdem war der US-Markt während des Tests geschlossen (manueller Broker nutzt die echte New-Yorker Uhr). Nur Code gelesen (TRD-021), Not-Aus/Takt im geschlossenen Markt geprüft (✔).
- Echtgeld mit `TRADING_LIVE=1`: Server darf nicht neu gestartet werden.
- Leerer Zustand `/trading` live: der gemeinsame Server enthielt bereits Agenten; Löschen fremder Daten vermieden.
- Anmeldung/Mandantentrennung: Testmodus ohne `AUTH_SECRET`; fremde IDs nur als „nicht vorhanden“ prüfbar.

**Angelegte Testdaten:** alle Agenten mit Präfix „QA-TRD“ (zwei per kaputtem/leerem JSON entstandene Agenten wurden nachträglich umbenannt). Belege und Skripte: `/tmp/claude-0/-home-claude/a63e209a-47ca-5889-84a9-ed4a4c2b741b/scratchpad/qa-belege/trd/` bzw. `…/qa-skripte/trd/`.
