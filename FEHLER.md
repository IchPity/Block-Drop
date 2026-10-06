# Fehlerliste für die nächste Session

Ergebnis einer Code-Durchsicht (Start 2026-10-03). Alles hier stammt aus dem Lesen des Codes,
nichts wurde im Browser oder gegen die echte Supabase-Datenbank reproduziert.
Zeilennummern beziehen sich auf den Stand von Commit `d111129` plus der offenen Änderung unten.

**Schweregrad:** 🔴 hoch · 🟠 mittel · 🟡 niedrig
**Sicherheit:** ✅ im Code eindeutig nachvollzogen · ❓ plausibel, vor dem Fixen kurz prüfen

## Empfohlene Reihenfolge

1. **Zuerst, weil Daten oder Punkte falsch werden:** S1 (Freundschaft ohne Zustimmung), W1 (doppelte
   F1-Auszahlung), E1 (Erfolge gehen verloren), A1 (Konto ohne Profil), S3 (Usernames serverseitig prüfen).
2. **Dann, weil Spiele hängen bleiben:** B1 und B2 (Block Drop friert ein), W3 (Wett-Knopf tot),
   G5, G6 und G13 (Block Games online), F1 (unsichtbarer Kino-Screen).
3. **Inhaltlich klären:** SU1 und SU2 (welche Stundenzeiten stimmen?), D1 (Datenschutz-Text), G1 (ein
   Login-Verfahren für Website und Block Games), S4 und C3 (wie viel Schummeln ist egal?), R1 und R4.
4. **Der Rest** nach Belieben; die 🟡-Punkte sind einzeln klein.

**Vor dem nächsten Commit:** R4 lesen. Diese Datei beschreibt offene Sicherheitslücken und liegt im Repo-Root.

Die Ursache hinter W1, W2 und W5 ist dieselbe: `Auth.onChange` feuert mehrfach (A5). Wird A5
in `auth.js` behoben, entschärft das mehrere Seiten auf einmal; die einzelnen Fixes bleiben trotzdem sinnvoll.

## 0. Offen aus dieser Session

- [ ] **Nicht committete Änderung in `app/fx.js`** (`wake()` / `frame()`): `cancelAnimationFrame`, damit die
  Hallen-Schleife nach Tab-Wechsel nicht doppelt läuft. Syntax geprüft, nicht im Browser getestet.
  Entweder committen oder verwerfen.
- [ ] Drossel-Erkennung der Halle auf einem iPhone im Stromsparmodus gegenprüfen (kurz unscharf, nach 2–3 s wieder scharf).

## 1. Konto-System (`app/auth.js`)

- [x] 🟠 ✅ **A1 – Registrierung kann ein Konto ohne Profil hinterlassen** (`app/auth.js:498-521`).
  `signUp` legt zuerst den Auth-User an und fügt danach das Profil ein. Schlägt der Insert fehl
  (Username vergeben → `23505`, oder E-Mail-Bestätigung nötig → kein Login möglich), existiert der
  Auth-User ohne `profiles`-Zeile. Ein zweiter Versuch scheitert mit „Diese Email ist schon registriert",
  und `mountSlots` (`:949`) zeigt für eingeloggte User ohne Profil weiter „Anmelden". Der User hängt fest.
  *Fix:* Username vor `auth.signUp` auf Verfügbarkeit prüfen; und bei „eingeloggt, aber kein Profil"
  einen Username-Dialog zeigen, der das Profil nachträglich anlegt (oder Profil per DB-Trigger aus
  `raw_user_meta_data` anlegen).
  → **Stand:** behoben. Username wird vor der Registrierung geprüft; wer ohne Profil eingeloggt ist, bekommt „Username wählen“ statt „Anmelden“.
- [x] 🟠 ❓ **A2 – Nach der Registrierung bleibt die Navbar auf „Anmelden"** (`app/auth.js:491-495`, `:512`).
  `onAuthStateChange` lädt das Profil, sobald die Session da ist, also bevor `signUp` die Profilzeile
  eingefügt hat. Danach lädt niemand das Profil neu (`signUp` ruft weder `_loadProfile` noch `_notify`).
  *Fix:* am Ende von `signUp` `await this._loadProfile(); this._notify();`.
  → **Stand:** behoben. `signUp` lädt das Profil nach dem Anlegen und benachrichtigt.
- [x] 🟡 ❓ **A3 – `await` auf Supabase-Aufrufe im `onAuthStateChange`-Callback** (`app/auth.js:491-495`).
  Supabase warnt ausdrücklich davor (kann den Auth-Lock blockieren, dann hängen alle weiteren Aufrufe).
  *Fix:* Callback synchron halten und das Profil per `setTimeout(() => …, 0)` nachladen.
  → **Stand:** behoben. Callback ohne `await`, Profil wird per `setTimeout` nachgeladen.
- [x] 🟡 ✅ **A4 – Jede Auth-Änderung hängt neue `document`-Click-Listener an** (`app/auth.js:980`).
  `mountSlots` läuft bei jedem `onChange` (auch `INITIAL_SESSION`, `TOKEN_REFRESHED`, Tab-Fokus) und
  registriert pro Slot einen weiteren Listener, der nie entfernt wird.
  *Fix:* einen einzigen delegierten Listener außerhalb von `mountSlots`.
  → **Stand:** behoben. Ein delegierter Listener.
- [x] 🟡 ✅ **A5 – `onChange`-Callbacks feuern beim Start zweimal** (`app/auth.js:485-495`).
  Einmal nach `getSession`, dann nochmal durch `INITIAL_SESSION`; später bei jedem Token-Refresh.
  Seiten, die im Callback Daten laden oder Zustand zurücksetzen, tun das doppelt.
  *Fix:* nur benachrichtigen, wenn sich User-ID oder Profil wirklich geändert haben.
  → **Stand:** behoben. Benachrichtigt wird nur noch, wenn sich die User-ID ändert.
- [x] 🟡 ✅ **A6 – `init()` ohne Fehlerbehandlung** (`app/auth.js:484-489`). Wirft `getSession` (offline,
  Supabase down), wird `_ready` nie gesetzt und `onChange`-Callbacks laufen nie; Seiten, die darauf
  warten, bleiben im Ladezustand.
  → **Stand:** behoben. `getSession` und Profil-Laden fangen Fehler ab.
- [x] 🟡 ✅ **A7 – Fehlermeldungen werden als HTML eingesetzt** (`app/auth.js:883-888`). `showErr` nutzt
  `innerHTML` mit `err.message` vom Server. *Fix:* `textContent`.
  → **Stand:** behoben. `textContent`.
- [x] 🟡 ✅ **A8 – Filter-Strings mit ungeprüften IDs** (`app/auth.js:681`, `:735`). `otherId` wird direkt in
  `.or(...)` eingesetzt. Im Moment kommen alle IDs aus der Datenbank (`/u/` lädt erst das Profil und nutzt dann dessen `id`),
  der Weg ist also nicht ausnutzbar. Sobald eine ID direkt aus der URL durchgereicht wird, könnte ein
  präparierter Link den Filter verändern. *Fix:* ID gegen UUID-Regex prüfen.
  → **Stand:** behoben. IDs werden gegen ein UUID-Muster geprüft.
- [x] 🟡 ✅ **A9 – Alte Avatare bleiben im Storage liegen** (`app/auth.js:645`, `:662`). Jeder Upload bekommt
  einen neuen Dateinamen, `removeAvatar` löscht nur die URL im Profil.
  → **Stand:** behoben. Beim Hochladen und Entfernen werden alte Dateien im eigenen Ordner gelöscht. Nicht getestet (hängt an den Storage-Policies).
- [~] 🟡 ✅ **A10 – Usernames sind nur exakt eindeutig** („Peter" und „peter" gleichzeitig möglich,
  `arcade_backend_setup.sql:17`). *Fix:* Unique-Index auf `lower(username)`.
  → **Stand:** Client prüft jetzt ohne Rücksicht auf Groß-/Kleinschreibung; der Index steht in `security_fixes.sql` und muss noch eingespielt werden.

## 2. Datenbank / RLS (`*.sql`)

- [~] 🔴 ✅ **S1 – Freundschaft ohne Zustimmung** (`friends_setup.sql:29-31`). Die Insert-Policy prüft nur
  `auth.uid() = requester_id`, nicht den Status. Jeder kann direkt eine Zeile mit `status = 'accepted'`
  einfügen und ist sofort mit einem beliebigen User „befreundet".
  *Fix:* `with check (auth.uid() = requester_id and status = 'pending')`.
  → **Stand:** Policy steht in `security_fixes.sql`, noch im SQL-Editor ausführen.
- [~] 🟠 ✅ **S2 – Addressee kann die ganze Zeile umschreiben** (`friends_setup.sql:34-36`). Update-Policy ohne
  `with check` und ohne Spaltenbeschränkung: der Addressee kann `requester_id` auf einen fremden User
  setzen. *Fix:* `with check (auth.uid() = addressee_id and status = 'accepted')` plus Trigger oder
  Spaltenrechte, die `requester_id`/`addressee_id` unveränderlich machen.
  → **Stand:** Policy und Trigger stehen in `security_fixes.sql`, noch ausführen.
- [~] 🟠 ✅ **S3 – Usernames werden nur im Browser validiert** (`arcade_backend_setup.sql:15-36`). Über die API
  lässt sich jeder beliebige Text als Username setzen, auch HTML. Jede Stelle, die einen Username
  ohne Escaping per `innerHTML` einsetzt, ist damit XSS (siehe Abschnitt 6).
  *Fix:* `check (username ~ '^[A-Za-z0-9_-]{3,20}$')` auf `profiles`.
  → **Stand:** Constraint steht in `security_fixes.sql` (als `not valid`, alte Zeilen bleiben), noch ausführen.
- [ ] 🟠 ✅ **S4 – Punktestände sind frei fälschbar** (bewusst? dann hier abhaken):
  - `scores`: Insert beliebiger Werte (`arcade_backend_setup.sql:58-60`), Block-Presser-Zeile beliebig
    änderbar, auch nach unten (`blockpresser_scores_setup.sql:41-45`).
  - `f1_points`: eigener Punktestand frei setzbar (`arcade_backend_setup.sql:97-99`).
  - `f1_bets`: `status`, `payout`, `stake` der eigenen Wette nachträglich änderbar (`:132-134`).
  - `casino_log_payout`: beliebiger Betrag ≥ 100 ins Ranking (`casino_ranking_setup.sql:23-34`).
  - `profiles.achievements`: frei setzbar.
  *Fix (wenn gewünscht):* Schreibzugriffe über `security definer`-Funktionen mit Plausibilitätsprüfung.
  → **Stand:** Für F1 gibt es jetzt `f1_place_bet` und `f1_settle_bet` in `security_fixes.sql`; die direkten Schreib-Policies bleiben, bis du sie entfernst (steht am Ende des Skripts). Scores, Casino und Erfolge sind unverändert offen. Deine Entscheidung.
- [~] 🟡 ✅ **S5 – Doppelte Freundschaftszeilen möglich** (`friends_setup.sql:13`). `unique (requester_id,
  addressee_id)` verhindert nicht A→B und B→A gleichzeitig (zwei gleichzeitige Anfragen).
  *Fix:* Unique-Index auf `(least(requester_id, addressee_id), greatest(requester_id, addressee_id))`.
  → **Stand:** Index steht in `security_fixes.sql`, noch ausführen (vorher auf doppelte Paare prüfen, Abfrage steht dabei).
- [~] 🟡 ✅ **S6 – `avatar_url` ist ein beliebiger Text**; jeder kann dort eine fremde URL eintragen
  (Tracking-Pixel für alle, die das Profil oder die Rangliste öffnen).
  → **Stand:** Constraint steht in `security_fixes.sql`, noch ausführen.
- [ ] 🟡 ✅ **S7 – Casino-Funktionen fehlen im Repo.** Der Client ruft `casino_wallet`, `casino_round`,
  `casino_deposit` und `casino_payout` auf, aber keines der `*.sql`-Skripte legt sie an (nur
  `casino_log_payout` und `casino_ranking`). Die Datenbank lässt sich aus dem Repo nicht neu aufbauen.
  *Fix:* die Definitionen aus Supabase exportieren und als `casino_setup.sql` einchecken.
  → **Stand:** nur du kommst an die Definitionen in Supabase.

## 3. Block Drop (`app/games/blockdrop/`)

- [x] 🟠 ✅ **B1 – Touch-Knöpfe wirken auch während Pause und Räum-Animation** (`index.html`, `bindTap`).
  `bindTap` sperrt nur `idle` und `gameover`. Die Tastatur ist in `paused`/`clearing` gesperrt
  (`game.js:970-975`), die Touch-Knöpfe nicht:
  - „Drop" doppelt getippt: der zweite Tipp fällt in die Räum-Animation, `hardDrop()` → `lock()` läuft
    erneut auf dem schon gesetzten Stein und startet die Animation von vorn.
  - „Halten" während der Animation tauscht den Stein, danach spawnt `finishClearAnim` noch einen:
    ein Stein aus der Vorschau geht verloren.
  - „Drop" in der Pause: der Stein fällt und wird gesetzt. Räumt er eine Reihe, steht der Zustand auf
    `clearing` ohne laufende Schleife, und „Weiter" tut nichts mehr (`resume()` verlangt `paused`).
    Das Spiel ist eingefroren.
  *Fix:* in `bindTap` nur bei `state === 'playing'` ausführen (Pause-Knopf ausgenommen).
  → **Stand:** behoben. Alle Züge prüfen `state === 'playing'` im Spiel selbst.
- [x] 🟠 ✅ **B2 – Auto-Repeat (DAS) prüft den Spielzustand nicht** (`game.js:1004-1011`).
  Die Intervalle rufen `moveLeft/moveRight` blind auf. Wer die Pfeiltaste hält und dabei pausiert,
  verschiebt den Stein in der Pause; `tryMove` → `resetLockDelay` → `scheduleLock` setzt ihn dann nach
  500 ms (gleiche Einfrier-Gefahr wie B1). Nach Game Over kann derselbe Weg `lock()` → `spawnPiece()`
  → `gameOver()` ein zweites Mal auslösen: Score wird doppelt gespeichert (lokal und in der Cloud),
  und ein übrig gebliebener Lock-Timer setzt im nächsten Spiel den ersten Stein mitten in der Luft
  (`startGame` setzt `lockTimer = null`, ohne ihn zu löschen, `game.js:342`).
  Außerdem läuft das Intervall endlos weiter, wenn das Fenster den Fokus verliert, bevor `keyup` kommt.
  *Fix:* im Intervall `state === 'playing'` prüfen; Timer bei `blur`/`visibilitychange` löschen;
  in `startGame` `clearLockDelay()` aufrufen.
  → **Stand:** behoben. Züge sind im Spiel gesperrt, Timer stoppen bei Fokusverlust, `startGame` löscht den Lock-Timer.
- [x] 🟠 ✅ **B3 – Spieltasten greifen auch beim Tippen in Eingabefelder** (`game.js:963-989`).
  Der Handler hängt an `document` und ruft `preventDefault`. Öffnet man während eines laufenden Spiels
  das Login-Fenster, lassen sich `z`, `x`, `p`, Leertaste und Shift nicht tippen (bzw. pausieren das Spiel).
  *Fix:* am Anfang von `onKey` und im DAS-Handler abbrechen, wenn `e.target` ein `input`/`textarea` ist.
  → **Stand:** behoben.
- [x] 🟡 ✅ **B4 – Pause-Knopf kann nicht fortsetzen** (`game.js:938-952`). `togglePause()` behandelt nur
  `playing`; der ⏸-Knopf der Touch-Steuerung tut in der Pause nichts.
  → **Stand:** behoben.
- [x] 🟡 ✅ **B5 – Tausch aus dem Hold prüft die Startposition nicht** (`game.js:646-654`). Im Tausch-Zweig
  wird der Stein ohne `isValid` gesetzt; liegt der Stapel schon in der Startzone, überlappt er.
  → **Stand:** behoben.
- [x] 🟡 ✅ **B6 – `tryUnlock` und `dbSaveScore` schreiben ungeschützt in `localStorage`** (`game.js:28`, `:255`).
  Wirft `setItem` (Speicher voll oder blockiert), bricht `startGame` vor `this.loop()` ab bzw. `gameOver`
  vor dem Overlay. *Fix:* `try/catch` wie in Block Presser.
  → **Stand:** behoben.
- [x] 🟡 ✅ **B7 – Mehrfinger-Druck lässt Wiederhol-Intervalle zurück** (`index.html`, `bindHold`). Ein zweites
  `touchstart` auf demselben Knopf überschreibt `delay`/`repeat`, das erste Intervall läuft für immer.
  *Fix:* in `start` zuerst `stop()` aufrufen.
  → **Stand:** behoben.
- [x] 🟡 ✅ **B8 – Punkte für Soft/Hard Drop erscheinen erst nach dem Setzen** (`game.js:419`, `:427`):
  `updateUI()` läuft nur in `calcScore`.
  → **Stand:** behoben für Soft Drop (Hard Drop setzt sofort und aktualisiert ohnehin).

## 4. Block Presser (`app/games/blockpresser/index.html`)

- [x] 🟠 ✅ **P1 – Zwei offene Tabs überschreiben sich gegenseitig** (`:371-374`, `:550`). Jeder Tab speichert
  alle 10 s seinen eigenen Stand unter demselben Schlüssel. Ein alter Tab im Hintergrund macht Käufe
  aus dem neuen rückgängig. *Fix:* `storage`-Event auswerten (neueren Stand übernehmen) oder vor dem
  Speichern `last` vergleichen.
  → **Stand:** behoben. Es gilt der Tab, in dem zuletzt gespielt wurde; der andere übernimmt dessen Stand.
- [x] 🟡 ✅ **P2 – Enter gedrückt halten ist ein Autoklicker** (`:494-506`). Die Leertaste filtert `e.repeat`,
  aber nach einem Mausklick hat der Block-Knopf den Fokus, und gehaltenes Enter feuert `click` in
  Tastenwiederholrate. *Fix:* `$('block').blur()` nach dem Klick oder `keydown` mit `e.repeat` abfangen.
  → **Stand:** behoben.
- [x] 🟡 ✅ **P3 – Glocken- und Meilenstein-Geschenke werden vom Boost versiebenfacht** (`:531`, `:649`).
  `bps()` und `clickPower()` enthalten `mult()`; fällt ein Geschenk in die 30 s Boost, ist es ×7.
  → **Stand:** behoben.
- [x] 🟡 ✅ **P4 – Der Boost geht beim Neuladen verloren** (`:345`): `buffUntil`/`buffMult` stehen nicht im Spielstand.
  → **Stand:** behoben.
- [x] 🟡 ✅ **P5 – `grant()` liest bei jedem Tick `localStorage`** (`:574-582`, `:658-664`). `checkAchievements`
  läuft zehnmal pro Sekunde und parst für jeden schon erreichten Erfolg die ganze Liste neu.
  *Fix:* erreichte IDs in einem `Set` merken.
  → **Stand:** behoben.
- [ ] 🟡 ✅ **P6 – Hintergrund-Tab und geschlossener Tab werden unterschiedlich abgerechnet** (`:384`, `:541`).
  Offen im Hintergrund: volle Rate, aber höchstens 1 h pro Tick. Geschlossen: halbe Rate, bis 8 h.
  → **Stand:** bewusste Spielregel oder nicht? Nicht angefasst.
- [x] 🟡 ❓ **P7 – Bestenliste und Score-Sync starten nach festen 1,5 s** (`:762`). Ist `Auth` dann noch nicht
  bereit, steht bis zu 2 Min. „Melde dich an", und der Score wird erst nach 60 s gesendet.
  *Fix:* an `Auth.onChange` hängen.
  → **Stand:** behoben.
- [~] 🟡 ✅ **P8 – Spielstand gehört dem Browser, der Score dem Konto** (`:744-749`). Meldet sich auf demselben
  Gerät ein anderer User an, landet der lokale Stand des Vorgängers unter dessen Namen in der
  Bestenliste. Dasselbe gilt für Erfolge (siehe E1).
  → **Stand:** der Abgleich merkt sich jetzt, für welches Konto er gesendet hat. Der Spielstand selbst gehört weiter dem Browser.

## 5. Effekte (`app/fx.js`)

- [x] 🟠 ❓ **F1 – Kino-Screen kann unsichtbar offen bleiben** (`fx.js:548-565`). `closeCinema` setzt
  `cineOpen = false` sofort, räumt aber erst nach 230 ms auf. Ruft in diesem Fenster jemand `cinema()`
  auf (Block Presser prüft Meilensteine alle 100 ms), startet der neue Screen sofort, und das
  verzögerte Aufräumen des alten nimmt ihm die Klasse `on` und ruft `cover(false)`. Ergebnis: Screen
  unsichtbar, `cineOpen` bleibt `true`, Enter/Leertaste/Esc werden verschluckt.
  Dasselbe Fenster gibt es beim Schließen des Abspanns (480 ms, `:612-617`).
  *Fix:* Zustand `closing` einführen und `cinema()` währenddessen in die Warteschlange stellen.
  → **Stand:** behoben.
- [x] 🟡 ✅ **F2 – Kein Umgang mit verlorenem WebGL-Kontext** (`fx.js:164-182`). Verliert der Browser den Kontext
  (häufig auf iOS nach Tab-Wechsel), bleibt die Halle schwarz bzw. eingefroren.
  *Fix:* `webglcontextlost` (mit `preventDefault`) und `webglcontextrestored` → `startHall()` neu.
  → **Stand:** behoben. Nicht auf einem echten Gerät getestet.
- [x] 🟡 ✅ **F3 – `FX.go` kann die Seite dunkel hängen lassen** (`fx.js:684-701`). `fx-leaving` wird gesetzt und
  nur bei `pageshow` zurückgenommen. Kommt die Navigation nicht zustande (Download-Link mit anderer
  Endung als in der Liste, abgebrochenes `beforeunload`), bleibt die Röhre aus.
  *Fix:* nach z. B. 2 s ohne Seitenwechsel die Klasse wieder entfernen.
  → **Stand:** behoben.

## 6. Casino (`app/games/casino/`)

- [x] 🟠 ❓ **C1 – Blackjack-Gewinn mit halben Cent wird vom Konto abgelehnt** (`blackjack/index.html`, `finish()`,
  `r = h.bet * 2.5`). „All In" setzt `Math.floor(balance)`, also auch ungerade Cent-Beträge. Ein
  Blackjack ergibt dann z. B. 832,5 Cent. Ist `p_win` in `casino_round` ein `integer` (Funktion fehlt im
  Repo, siehe S7), lehnt der Server die Runde ab, das Guthaben wird neu geladen und der Gewinn ist weg,
  der Einsatz wurde aber schon abgebucht. Als Gast entsteht ein krummes Guthaben.
  *Fix:* `Math.floor(h.bet * 2.5)` bzw. Einsätze auf gerade Cent runden.
  → **Stand:** behoben.
- [x] 🟠 ✅ **C2 – Roulette: „Wie zuvor" prüft nichts und bringt den Einsatz durcheinander**
  (`roulette/index.html`, `$('rebet')`-Handler). Der Handler setzt `bets[k] = v` (überschreibt statt
  addiert), prüft weder Guthaben noch `MAX_TOTAL` und legt trotzdem jedes Mal Einträge auf `stack`.
  - Liegt der alte Einsatz über dem Guthaben, tut „DREHEN" ohne Meldung nichts (`if (t > balance) return`).
  - Zweimal „Wie zuvor", dann zweimal „Rückgängig": das zweite Rückgängig rechnet `undefined - v`,
    der Einsatz wird `NaN` und bleibt stehen.
  *Fix:* über `place()` laufen lassen (addiert und prüft) oder `bets`/`stack` vorher leeren.
  → **Stand:** kein Fehler. Der Knopf ist gesperrt, sobald schon ein Einsatz liegt oder das Guthaben nicht reicht (`render()`), beide Fälle kommen also nicht vor.
- [x] 🟠 ✅ **C3 – Gast-Spielgeld wird zu Konto-Guthaben** (alle drei Spiele). Freispiele (`state.free`,
  `state.freeBet` bis 10.000 €) und laufende Blackjack-Hände liegen im `localStorage`, unabhängig vom
  Konto. Wer als Gast Freispiele gewinnt oder eine Hand setzt und sich dann anmeldet, bekommt die
  Gewinne über `casino_round(p_paid = 0, p_win = …)` aufs Konto und damit in die Rangliste.
  Grundproblem dahinter: `casino_round` nimmt den Gewinn vom Client entgegen (siehe S4).
  *Fix:* beim Wechsel Gast → Konto Freispiele und offene Hand verwerfen.
  → **Stand:** behoben. Freispiele und Glück verfallen beim Wechsel Gast ↔ Konto; eine Blackjack-Hand wird dort abgerechnet, wo ihr Einsatz herkam.
- [x] 🟡 ✅ **C4 – Gast-Guthaben springt nach Login/Logout zurück** (`index.html`, `load()`/`save()`).
  `guestBalance` wird nur beim Laden gesetzt. Im Konto-Modus schreibt `save()` diesen alten Wert zurück,
  Gewinne und Verluste als Gast seit dem Laden der Seite sind damit rückgängig gemacht.
  *Fix:* in `loadWallet()` vor dem Überschreiben `guestBalance = state.balance`.
  → **Stand:** behoben.
- [x] 🟡 ✅ **C5 – Doppelte Auszahlung per Enter** (`index.html`, `payout()`). Der Knopf wird gesperrt, der
  Enter-Handler im Eingabefeld ruft `payout()` aber direkt. Zweimal Enter startet zwei Auszahlungen
  über denselben Betrag. *Fix:* eigenes `paying`-Flag.
  → **Stand:** behoben.
- [x] 🟡 ✅ **C6 – Beträge mit Tausenderpunkt werden abgelehnt** (`parseEur`, `parseAmt`). Die Anzeige
  schreibt „1.000,00 €", die Eingabe „1.000,50" fällt aber durch den Regex und meldet „Bitte mindestens
  1 € eingeben". *Fix:* Punkte vor dem Komma entfernen.
  → **Stand:** behoben (Automat und Kasse).
- [x] 🟡 ✅ **C7 – Esc und Leertaste wirken durch den Beleg-Dialog hindurch** (`index.html`). Esc schließt den
  `<dialog>` und öffnet gleichzeitig die Einstellungen; die Leertaste dreht hinter dem offenen Dialog
  die Walzen, weil `spaceIgnored()` Dialoge nicht kennt.
  → **Stand:** behoben.
- [x] 🟡 ✅ **C8 – Kasse: Gast-Gutschrift mit Rundungsfehler** (`aufladen/index.html`, Gast-Zweig am Ende des
  `pay`-Handlers). `s.balance = balanceOf(s) + eur * 100` rechnet mit Gleitkomma (1,15 € → 114,999…),
  beim nächsten Laden wird abgerundet und 1 Cent fehlt. Der Konto-Zweig rundet richtig.
  → **Stand:** behoben.
- [x] 🟡 ✅ **C9 – Kasse: Username unescaped im Dialog** (`aufladen/index.html`, `showData()`): `g('mail')`
  enthält den Username und wird per `innerHTML` eingesetzt. Zusammen mit S3 ist das Self-XSS.
  → **Stand:** behoben.
- [ ] 🟡 ❓ **C10 – Blackjack: „All In" und „Wie zuvor" umgehen `MAX_BET`.** Die Chips prüfen
  `Math.min(balance, MAX_BET)`, „All In" setzt das ganze Guthaben, und „Wie zuvor" übernimmt diesen
  Einsatz später wieder. Falls gewollt, hier abhaken.
  → **Stand:** gewollt oder nicht? Nicht angefasst.
- [ ] 🟡 ✅ **C11 – Hinweis, kein Fehler:** Die Geheimwörter im Auszahlungsfeld („enya" = eine Minute nur
  Hauptgewinne, „peter" = zehn Minuten nur Nieten) und der Kreditkarten-Code in der Kasse gelten auch im
  Konto-Modus und wirken damit auf die öffentliche Rangliste.
  → **Stand:** Hinweis, deine Entscheidung.

## 7. F1 Wetten (`app/f1-wetten/index.html`)

- [x] 🔴 ✅ **W1 – Gewinne können doppelt gutgeschrieben werden** (`init()` → `runApp()` → `settleOpenBets()`).
  `Auth.onChange` feuert beim Start zweimal kurz hintereinander (siehe A5), `runApp()` läuft also zweimal
  parallel. Beide Läufe laden die noch offenen Wetten, beide setzen sie auf `settled` (das Update hat
  keinen Filter auf `status = 'open'`) und beide lesen den Punktestand und addieren die Auszahlung.
  Dasselbe passiert mit zwei Geräten oder zwei Tabs.
  *Fix:* `runApp()` gegen Doppelstart sperren; Update mit `.eq('status', 'open').select()` und nur bei
  getroffener Zeile auszahlen; besser eine `security definer`-Funktion, die Wette und Punkte in einer
  Transaktion abrechnet.
  → **Stand:** behoben. Seite lädt nur noch bei echtem User-Wechsel; abgerechnet wird über `f1_settle_bet` (eine Transaktion) oder, solange die Funktion fehlt, mit Statusfilter.
- [x] 🟠 ❓ **W2 – Neue User sehen beim ersten Besuch einen Ladefehler** (`loadOrCreatePoints()`). Aus demselben
  Doppelstart: beide Läufe finden keine `f1_points`-Zeile, beide fügen ein, der zweite scheitert am
  Primärschlüssel und überschreibt die fertige Seite mit „Fehler beim Laden: Points init: …".
  *Fix:* `upsert` mit `ignoreDuplicates` und danach lesen.
  → **Stand:** behoben.
- [x] 🟠 ✅ **W3 – „Wette platzieren" bleibt nach einem Eingabefehler tot** (Click-Handler am Ende von `render()`).
  Der Knopf wird gesperrt und auf „..." gesetzt; `placeBet()` kehrt bei jedem Fehler (gleicher Fahrer
  doppelt, zu wenig Punkte, Netzwerkfehler) ohne `render()` zurück. Bis zum Neuladen geht nichts mehr.
  *Fix:* im Handler nach `await placeBet(…)` den Knopf wieder freigeben.
  → **Stand:** behoben.
- [~] 🟠 ✅ **W4 – Wette und Punktabzug sind zwei getrennte Schritte** (`placeBet()`). Erst wird die Wette
  eingefügt, dann der Einsatz abgezogen, und zwar vom lokal gemerkten Stand. Scheitert Schritt 2 oder
  wird der Tab geschlossen, ist die Wette gratis; ein zwischenzeitlicher Gewinn auf einem anderen Gerät
  wird überschrieben.
  → **Stand:** mit `f1_place_bet` aus `security_fixes.sql` atomar; ohne die Funktion bleibt es bei zwei Schritten (jetzt immerhin vom frischen Punktestand).
- [x] 🟠 ❓ **W5 – Die Seite lädt bei jedem Auth-Ereignis komplett neu** (`init()`). Token-Refresh oder die
  Rückkehr in den Tab lösen `onChange` aus, `runApp()` baut alles neu auf und die halb ausgefüllte
  Wette (gewählte Fahrer, Einsatz) ist weg. *Fix:* nur neu laden, wenn sich die User-ID ändert
  (wie im Casino: `if (id === uid) return`).
  → **Stand:** behoben.
- [x] 🟡 ✅ **W6 – Wetten auf das letzte Saisonrennen können offen bleiben.** `loadMyBets()` filtert auf die
  Saison aus `current.json`. Springt die API auf die neue Saison, bevor der User die Seite öffnet,
  wird die alte Wette nie abgerechnet und der Einsatz ist weg.
  → **Stand:** behoben. Abgerechnet werden jetzt offene Wetten aller Saisons, die Punkte landen in der Saison der Wette. Der normale Fall ist mit nachgestellter Datenbank geprüft, der Saisonwechsel selbst nicht.
- [x] 🟡 ✅ **W7 – API-Texte landen unescaped im HTML** (`d.code` in den `<option>`-Zeilen).
  → **Stand:** behoben.

## 8. F1 Hub (`app/f1/index.html`)

- [x] 🟠 ✅ **H1 – Live-Tracker lädt alle 5 s die komplette Session** (`renderLiveSession()`). Drei Anfragen ohne
  Zeitfilter (`position`, `drivers`, `intervals` für die ganze Session, mehrere MB) alle 5 Sekunden,
  ohne Schutz gegen überlappende Läufe. Das sind 36 Anfragen pro Minute und liegt über dem freien
  Limit von OpenF1, die Antworten werden dann zu 429.
  *Fix:* `date>=…` mit dem Zeitpunkt der letzten Antwort anhängen, `drivers` nur einmal laden,
  Intervall auf 10–15 s, laufenden Abruf abwarten.
  → **Stand:** behoben. Erster Abruf komplett, danach nur neue Daten; Fahrerliste einmal; 10 s Abstand ohne Überlappen.
- [x] 🟠 ✅ **H2 – Polling läuft im falschen Tab weiter oder doppelt** (`startTrackerPolling()`).
  `stopTrackerPolling()` läuft vor dem `await renderTracker()`. Wechselt man währenddessen den Tab oder
  klickt zweimal auf „Tracker", werden die Intervalle erst danach gesetzt und nie mehr gestoppt.
  *Fix:* Laufnummer mitführen und nach dem `await` prüfen.
  → **Stand:** behoben.
- [x] 🟡 ✅ **H3 – Live-Ansicht endet nie.** `liveSession` wird einmal bestimmt; nach Session-Ende pollt die
  Seite weiter, bis man neu lädt. Umgekehrt springt der Countdown bei 0 nicht in die Live-Ansicht.
  → **Stand:** behoben.
- [x] 🟡 ✅ **H4 – „Runde 5 / " ohne Gesamtzahl** (`renderUpcoming()`): `${nextRace.round} / ${nextRace.season ? '' : ''}`
  gibt hinter dem Schrägstrich immer nichts aus. Gemeint war wohl `races.length`.
  → **Stand:** behoben.
- [x] 🟡 ✅ **H5 – Leerer Kalender lässt den Tracker abstürzen.** Ist `Races` leer (Winterpause), ist `nextRace`
  `undefined` und `renderUpcoming` wirft; angezeigt wird „Tracker nicht verfügbar".
  → **Stand:** behoben.
- [x] 🟡 ✅ **H6 – Unterschiedliche Ersatz-Uhrzeit** für Rennen ohne `time`: `00:00:00Z` beim Sortieren,
  `14:00:00Z` bei Anzeige und Countdown.
  → **Stand:** behoben.
- [x] 🟡 ✅ **H7 – API-Texte landen unescaped im HTML** (Fahrer-, Team-, Streckennamen, `e.message`).
  → **Stand:** behoben.

## 9. Wetter (`app/weather/index.html`)

- [~] 🟠 ❓ **WE1 – Cloud-Favoriten: Spalte `profiles.weather_favorites` fehlt im Schema.** `loadFavorites()` und
  `saveFavorites()` lesen und schreiben die Spalte, `arcade_backend_setup.sql` legt sie nicht an.
  Supabase liefert dann nur ein `error`-Objekt (kein Throw), der Code fällt still auf `localStorage`
  zurück und Favoriten wandern nie zwischen Geräten. In der echten Datenbank prüfen, ob es die Spalte gibt.
  *Fix:* `alter table profiles add column if not exists weather_favorites jsonb` ins Setup-Skript.
  → **Stand:** Spalte steht in `security_fixes.sql`, noch ausführen. Der Client meldet einen Speicherfehler jetzt in der Konsole.
- [x] 🟠 ✅ **WE2 – Schnelles Wechseln zeigt das Wetter des falschen Orts** (`pickLocation()` → `loadAll()`).
  Zwei Abrufe laufen parallel; kommt der ältere zuletzt an, stehen seine Daten unter dem Namen des
  neueren Orts. *Fix:* Laufnummer merken und veraltete Antworten verwerfen.
  → **Stand:** behoben.
- [x] 🟡 ✅ **WE3 – Favorit umschalten baut die ganze Seite neu** (`toggleFavorite()` → `renderCurrent()`).
  Die Karte wird zerstört und neu erzeugt, das Radar neu geladen, die Ebenenwahl springt auf „Radar".
  Läuft die Radar-Animation gerade, tickt `radarInterval` weiter, der neue Knopf zeigt aber „▶".
  *Fix:* nur den Favoriten-Knopf aktualisieren; in `initMap()` `stopRadarPlay()` aufrufen.
  → **Stand:** behoben.
- [x] 🟡 ✅ **WE4 – „JETZT"-Linie stimmt nur in der eigenen Zeitzone** (`drawHourly()`). Open-Meteo liefert Ortszeit
  ohne Offset, `new Date(h.time[i])` liest sie als Browser-Zeit und vergleicht mit `Date.now()`.
  Für Orte in anderen Zeitzonen sitzt die Linie falsch oder fehlt.
  *Fix:* `utc_offset_seconds` aus der Antwort einrechnen.
  → **Stand:** behoben.
- [x] 🟡 ✅ **WE5 – „Wolken" zeigt gar keine Wolken** (`setMapLayer('clouds')`): es ist dasselbe Radarbild in einem
  anderen Farbschema (steht auch so im Kommentar).
  → **Stand:** behoben durch ehrliche Beschriftung („Radar 2“).
- [x] 🟡 ❓ **WE6 – RainViewer-Kacheln fest verdrahtet.** Host (`tilecache.rainviewer.com`), Farbschema und
  `maxZoom: 18` stehen im Code statt aus `weather-maps.json` (`host`) zu kommen. RainViewer hat die
  freie API eingeschränkt (Zoomstufen, Farbschemata, Prognose); prüfen, ob das Radar beim Hineinzoomen
  noch Bilder liefert.
  → **Stand:** behoben, im Browser geprüft: Radar-Kacheln laden (HTTP 200). Die alte URL hatte `/v2/radar/` doppelt.
- [x] 🟡 ✅ **WE7 – Ungeschützte `localStorage`-Zugriffe** (`pickLocation`, `saveFavorites`, `loadFavorites`):
  wirft `setItem`, lädt die Seite gar kein Wetter.
  → **Stand:** behoben.

## 10. METAR (`app/metar/index.html`)

- [x] 🟠 ❓ **M1 – Abhängigkeit von `corsproxy.io`.** Schlägt der direkte NOAA-Abruf an CORS fehl, geht alles über
  diesen fremden Proxy. Der Dienst hat die freie Nutzung für produktive Seiten eingeschränkt; fällt er
  aus, zeigt die Seite nur „Abruf fehlgeschlagen". *Fix:* eigener kleiner Proxy als Cloudflare Worker
  (die Seite läuft dort ohnehin).
  → **Stand:** behoben, im Browser geprüft. `corsproxy.io` antwortet inzwischen mit 401 (API-Key nötig), die Seite war also komplett kaputt. Neuer Ausweichweg: Rohtext-METARs von `metar.vatsim.net` (erlaubt Browser-Abrufe), ein kleiner Parser füllt dieselben Felder.
- [x] 🟡 ✅ **M2 – Windstille zeigt „Calm kt"** (`decodeFields()`): `unit: wspd === 'Calm' ? '' : 'kt'` vergleicht
  die Zahl `wspd` mit einem Text, die Einheit wird also immer angehängt.
  → **Stand:** behoben.
- [x] 🟡 ✅ **M3 – Fehler beim Speichern der „Zuletzt"-Liste sieht aus wie ein Abruffehler.** `addRecent()` läuft
  im selben `try` wie der Abruf; wirft `localStorage.setItem`, erscheint „Abruf fehlgeschlagen",
  obwohl die Daten da sind.
  → **Stand:** behoben.
- [x] 🟡 ✅ **M4 – Parallele Abrufe überholen sich** (`fetchAndRender()`): schnelle Klicks auf mehrere Flughäfen
  zeigen am Ende die Antwort, die zuletzt ankommt, nicht die zuletzt angeforderte.
  → **Stand:** behoben.
- [x] 🟡 ✅ **M5 – API-Werte unescaped** (`d.val` für Wind, Sicht, Temperatur, `fltCat` in `renderStation()`).
  → **Stand:** behoben.

## 11. Stundenplan und SchulUhr

- [ ] 🟠 ✅ **SU1 – Die beiden Seiten nennen unterschiedliche Stundenzeiten.**
  `app/stundenplan/index.html` (`PERIODS`): 07:50–08:35, 08:40–09:25, 09:35–10:20, 10:30–11:25, 11:35–12:25,
  12:30–13:20 (Stunden mit 45, 55 und 50 Minuten gemischt).
  `app/games/schuluhr/index.html` (`MORNING`): 07:50–08:40, 08:45–09:35, 09:40–10:30, 10:45–11:35,
  11:40–12:30, 12:35–13:25 (durchgehend 50 Minuten).
  Mindestens eine Liste ist falsch. *Fix:* richtige Zeiten klären und an einer Stelle pflegen
  (gemeinsame `zeiten.js`).
  → **Stand:** welche Zeiten stimmen, weißt nur du.
- [ ] 🟠 ✅ **SU2 – Die SchulUhr kennt den echten Stundenplan nicht.** Sie nimmt jeden Tag sechs Stunden an und
  montags zusätzlich Mittagspause plus 7./8. Stunde bis 15:55. Laut Stundenplan der 5DK hat der Montag
  nur fünf Stunden, der Freitag fünf, und Mittwoch ist die 3. Stunde frei. Die Uhr zeigt also
  „Unterricht", wenn frei ist. *Fix:* die Uhr aus `CLASSES['5DK']` speisen.
  → **Stand:** hängt an SU1.
- [x] 🟡 ✅ **SU3 – Falsche Beschriftung am Tagesende** (`update()`, `renderPipDoc()`, `updateWidget()`): in der
  letzten Stunde und zwischen 7. und 8. Stunde steht „bis zur Pause", obwohl keine Pause folgt.
  → **Stand:** behoben.
- [x] 🟡 ✅ **SU4 – Bild-in-Bild-Fenster nutzt Variablen, die es dort nicht gibt** (`PIP_CSS`). `var(--chalk)` und
  `var(--board-raised)` kommen aus `theme.css`, das im PiP-Dokument nicht geladen ist: Textfarbe fällt
  auf Schwarz zurück, die Fortschrittsleiste hat keinen Hintergrund. Außerdem wird „Barlow" verwendet,
  importiert werden aber Orbitron und Inter.
  → **Stand:** behoben.
- [x] 🟡 ✅ **SU5 – Schwebendes Ersatzfenster lässt sich nur mit der Maus ziehen** (Drag-Block am Ende): gerade
  die Geräte ohne Bild-in-Bild (Handy, Safari, Firefox) haben keine `mousedown`-Events.
  *Fix:* Pointer-Events.
  → **Stand:** behoben.
- [ ] 🟡 ✅ **SU6 – Ferien und Feiertage** kennt die Uhr nicht („Schule wieder in …" zählt auf den nächsten Werktag).
  → **Stand:** bräuchte eine Ferienliste.

## 12. Erfolge, Profil, Freunde (`app/achievements/`, `app/profile/`, `app/freunde/`, `app/u/`)

- [x] 🟠 ✅ **E1 – Erfolge gehen verloren oder wandern zwischen Konten.** Die Liste liegt pro Browser in
  `localStorage` (`arcade_achievements`) und pro Konto in `profiles.achievements`; jede Seite gleicht
  anders ab:
  - **Überschreiben:** `Auth.saveAchievements(list)` ersetzt das ganze Array. Block Presser, SchulUhr und
    F1 Wetten (bei `tryUnlock`) senden die lokale Liste, ohne vorher die Cloud zu lesen (Block Presser
    und SchulUhr haben gar keinen Sync). Auf einem neuen Gerät löscht der erste Erfolg dort alle
    bisherigen in der Cloud.
  - **Cloud gewinnt:** die Erfolge-Seite (`syncFromCloud()`) überschreibt die lokale Liste mit der Cloud,
    sobald die Cloud nicht leer ist. Als Gast verdiente Erfolge sind nach dem Login weg.
  - **Vereinigen:** Block Drop und F1 Wetten führen lokal und Cloud zusammen und laden hoch. Nach einem
    Logout bleibt die lokale Liste liegen, der nächste User auf demselben Gerät (Schul-PC) erbt sie.
  *Fix:* eine gemeinsame Funktion in `auth.js` (laden, vereinigen, speichern), lokale Liste pro User-ID
  ablegen und beim Logout leeren; am besten ein RPC, das serverseitig einzelne IDs hinzufügt.
  → **Stand:** behoben. Eine gemeinsame Stelle `window.Achievements` in `auth.js`: lokal pro Konto, Abgleich vereinigt immer, Gast-Erfolge wandern beim ersten Login ins Konto.
- [x] 🟡 ✅ **E2 – „Du"-Markierung in der Rangliste fehlt beim ersten Laden** (`achievements/index.html`,
  `renderLeaderboard()`): läuft sofort, `Auth.profile` ist dann noch leer. Erst nach einem Tab-Klick stimmt es.
  *Fix:* in `Auth.onChange` neu rendern; besser `user_id` statt Username vergleichen.
  → **Stand:** behoben. Dabei hatte ich zuerst einen Fehler eingebaut (`lbMode` wurde vor der Initialisierung benutzt), der Browser-Test hat ihn gefunden; korrigiert.
- [x] 🟡 ✅ **E3 – Schneller Tab-Wechsel in der Rangliste** zeigt die Antwort, die zuletzt ankommt.
  → **Stand:** behoben.
- [x] 🟡 ✅ **E4 – „Ihr seid jetzt Freunde" ohne Wirkung** (`auth.js:720-727`, `u/index.html`, `freunde/index.html`).
  `acceptFriendRequest` meldet Erfolg auch, wenn das Update keine Zeile trifft (Anfrage inzwischen
  zurückgezogen). *Fix:* `.select()` anhängen und die Zeilenzahl prüfen.
  → **Stand:** behoben.
- [x] 🟡 ✅ **E5 – Freundesuche: 13 Anfragen pro Suche und überholende Antworten** (`freunde/index.html`,
  `setupSearch()`). Pro Treffer ein eigener `friendStatus`-Abruf; eine ältere Suche kann die neuere
  überschreiben. *Fix:* die Übersicht aus `getFriendOverview()` einmal laden und lokal nachschlagen.
  → **Stand:** behoben.
- [ ] 🟡 ✅ **E6 – Profil: kein Weg, das Konto zu löschen oder die E-Mail zu ändern.** Die Datenschutzseite
  verweist dafür auf eine Mail an den Betreiber; nur als Hinweis.
  → **Stand:** Hinweis.

## 13. Datenschutz-Text (`app/datenschutz/index.html`)

- [x] 🟠 ✅ **D1 – Angaben stimmen nicht mit dem Code überein:**
  - Das Cookie heißt im Code `automat5dk_casino2`, im Text `automat5dk_casino`.
  - „Es wird nie an einen Server gesendet" stimmt technisch nicht: ein Cookie mit `path=/` schickt der
    Browser bei jedem Seitenabruf an den Webserver mit.
  - Die F1-Seiten rufen `api.jolpi.ca` ab; der Dienst fehlt in der Liste der externen APIs.
  - Nicht erwähnt: Freundesliste, Profilbild-Upload (Supabase Storage), Casino-Guthaben und
    Auszahlungen, F1-Wetten (alle in Supabase gespeichert), dazu Block Games mit Supabase Realtime.
  - „Favoriten-Orte verlassen deinen Browser nicht": die Wetterseite schreibt sie bei Login nach
    `profiles.weather_favorites` (siehe WE1).
  → **Stand:** behoben. Bitte den Text selbst noch einmal lesen, es ist deine Erklärung.

## 14. Startseite und Block-Games-Downloadseite

- [ ] 🟡 ✅ **ST1 – Download-Seite und Build passen nicht zusammen** (`app/blockgames/index.html`,
  `block-games/package.json`). Die Seite bewirbt Version 0.24.0 als portables Zip „ohne Installer",
  `package.json` steht auf 0.25.0 und baut einen NSIS-Installer (`BlockGames-Demo-…-Setup.exe`).
  Der Link zeigt fest auf das Release v0.24.0 und muss bei jedem Release von Hand nachgezogen werden.
  → **Stand:** hängt am nächsten Release.
- [x] 🟡 ✅ **ST2 – Doppelklick auf einen Automaten startet die Zoom-Animation zweimal** (`app/index.html`,
  Münzeinwurf-Handler): kein Schutz gegen erneutes Auslösen, es entstehen zwei geklonte Schirme und zwei
  Navigationen.
  → **Stand:** behoben.

## 15. Block Games (Electron, `block-games/`)

### Konto

- [~] 🟠 ✅ **G1 – Website und Block Games nutzen zwei verschiedene Login-Verfahren.** `renderer/auth.js`
  behauptet im Kopfkommentar, der Flow sei „1:1 von app/auth.js übernommen". Tatsächlich:
  - Block Games registriert mit einer künstlichen Auth-Mail `<username>@blockdrop.local` und meldet
    per Username an. Die Website registriert und meldet mit echter E-Mail an (`type="email"`, Pflichtfeld).
    Ein in Block Games erstelltes Konto kommt auf der Website nur hinein, wenn man
    `name@blockdrop.local` als E-Mail eintippt.
  - Die Website ändert in `updateUsername` nur `profiles.username`. Bei einem Block-Games-Konto bleibt
    die Auth-Mail auf dem alten Namen; der Login in Block Games geht danach nur noch mit dem alten
    Namen (oder über `resolve_login_email`, falls es die Funktion in der Datenbank gibt).
  - Das RPC `resolve_login_email` fehlt in den `*.sql`-Skripten (siehe S7).
  - Username-Regeln weichen ab: Website erlaubt `-`, Block Games nicht; Block Games ist durch die
    kleingeschriebene Mail faktisch case-insensitiv, die Website nicht (A10).
  *Fix:* ein gemeinsames Verfahren festlegen und `app/auth.js` anpassen (Login per Username dort ergänzen).
  → **Stand:** Die Website nimmt jetzt auch den Username an und zieht bei Block-Games-Konten die Login-Mail beim Umbenennen mit. Im Browser-Test bestätigt: `resolve_login_email` gibt es in der Datenbank nicht (404); die Funktion steht jetzt in `security_fixes.sql` (mit Hinweis zur Abwägung). Die abweichenden Username-Regeln (`-`) bleiben.
- [x] 🟠 ❓ **G2 – Fremden Namen in Lobbys tragen** (`renderer/auth.js`, `signUp` und Getter `username`).
  Wie A1: `auth.signUp` läuft vor dem Profil-Insert. Ist der Username in `profiles` schon vergeben, die
  künstliche Mail aber noch frei (Website-Konto mit echter Mail), entsteht ein Auth-Konto ohne Profil,
  das eingeloggt bleibt. `Auth.username` fällt dann auf `user_metadata.username` zurück, also auf den
  fremden Namen. Im Client prüfen, ob die App diesen Zustand als angemeldet behandelt.
  *Fix:* Username vorab prüfen; ohne Profil nicht als angemeldet werten.
  → **Stand:** behoben. Username wird vor der Registrierung geprüft.
- [x] 🟡 ✅ **G3 – Gegenanfrage erzeugt eine zweite Freundschaftszeile** (`sendFriendRequest`). Anders als die
  Website prüft Block Games nicht, ob die andere Person schon angefragt hat (siehe S5).
  → **Stand:** behoben.
- [x] 🟡 ✅ **G4 – `await` im `onAuthStateChange`-Callback** (`init()`), gleiches Risiko wie A3.
  → **Stand:** behoben.

### Online-Sitzungen

- [x] 🟠 ✅ **G5 – Beitritt mit falschem Code endet im ewigen Warteraum** (`app.js:1926-1934`, `net/session.js`
  `_join`). Ein Realtime-Channel lässt sich für jeden beliebigen Namen abonnieren; `SUBSCRIBED` heißt
  nicht, dass dort ein Host sitzt. Der Gast landet bei „Warte auf den Host …", die Meldung „Beitritt
  fehlgeschlagen — Code prüfen" kommt nur bei Verbindungsfehlern.
  *Fix:* nach dem Abonnieren in der Presence nach einem Peer mit `isHost` suchen, sonst nach 3–5 s abbrechen.
  → **Stand:** behoben.
- [x] 🟠 ✅ **G6 – Gäste erfahren nicht, wenn der Host geht oder abbricht.** `leave()` sendet `'bye'`, aber
  niemand hat einen Handler dafür registriert, und der Presence-Handler in `setupNetworking()` arbeitet
  nur im Host-Zustand. Beendet der Host die Session, bricht das Match ab (`abortMatchToLobby`,
  `cancelMgFlow`, `quitGameToMenu`) oder schließt die App, bleiben Gäste im eingefrorenen Spiel bzw.
  im Warteraum. *Fix:* `'bye'`/`'abort'` behandeln und als Gast auf das Verschwinden des Hosts aus der
  Presence reagieren.
  → **Stand:** behoben.
- [x] 🟠 ✅ **G7 – Der Host vertraut jeder Nachricht** (`app.js:2102-2125`). Der Kommentar über
  `setupNetworking()` sagt, die Handler prüften ihren Zustand selbst; das tun nur `onPresence` und
  `lobby`. `series_start`, `round_setup`, `map_result`, `snap` und `result` werden auch im Host-Zustand
  ausgeführt, ein Gast kann also mit `result` die Runde beenden und die Wertung bestimmen. `from`
  steht im Payload und ist frei wählbar, ein Gast kann Eingaben für einen anderen senden.
  *Fix:* Handler nach Rolle filtern (Host nimmt nur `input`, Gast nur vom Host-Peer).
  → **Stand:** behoben, soweit ohne Server möglich: Rollen werden geprüft, `from` bleibt fälschbar.
- [~] 🟠 ✅ **G8 – Einladungs-Kanäle sind offen** (`net/session.js`, `listenForInvites`/`sendInvite`). Der Kanal
  `blockgames:user:<userId>` ist ein öffentlicher Broadcast-Kanal, User-IDs stehen in Profil-Links.
  Jeder mit dem öffentlichen Key kann beliebigen Usern Einladungen mit frei gewähltem Namen schicken
  und fremde Einladungs-Kanäle mitlesen (und so den Session-Code erfahren). Der Kommentar „nur für
  angemeldete Freunde" wird nirgends durchgesetzt.
  *Fix:* private Realtime-Channels mit RLS, oder beim Empfang gegen die Freundesliste prüfen.
  → **Stand:** Einladungen zählen nur noch von Usern aus der eigenen Freundesliste, angezeigt wird der Name aus dieser Liste. Mitlesen fremder Kanäle bleibt möglich (bräuchte private Channels).
- [x] 🟠 ✅ **G9 – Einladung annehmen mitten im Match** (`showInvite`, `acceptInvite`). Das Overlay erscheint
  auch während eines laufenden Spiels und nimmt den Fokus. Annehmen ruft `openLobby()` auf, ohne das
  laufende Spiel zu stoppen; wer gerade selbst hostet, verlässt seine Session über `NetSession.join`
  → `leave()`, ohne dass die eigenen Gäste es erfahren (G6).
  → **Stand:** behoben.
- [x] 🟡 ✅ **G10 – Kurzer Verbindungsaussetzer macht einen Mitspieler dauerhaft zum Bot** (`app.js:2087-2099`).
  Fehlt ein Peer in einem einzigen Presence-Sync, wird er im Match in einen Bot umgewandelt; einen
  Rückweg gibt es nicht. *Fix:* erst nach einigen Sekunden Abwesenheit umwandeln.
  → **Stand:** behoben (5 s Karenz).
- [x] 🟡 ✅ **G11 – Voller Tisch: fünfter Spieler wartet ohne Hinweis** (`assignPeerSlot`): kein Slot frei →
  der Peer bleibt verbunden, bekommt aber keine Meldung.
  → **Stand:** behoben.
- [ ] 🟡 ✅ **G12 – Dasselbe Konto auf zwei Rechnern sieht sich nicht** (`net/session.js`): `peerId` ist die
  User-ID, eigene Nachrichten werden per `from === this.peerId` verworfen.
  → **Stand:** OFFEN.

### Spielablauf

- [x] 🟠 ✅ **G13 – Esc bricht ab, das Spiel startet trotzdem** (`castGameVote`, `castMapVote`, `runCountdown`,
  `cancelMgFlow`). Nach der Abstimmung laufen `setTimeout`s (1,3 s bis zum nächsten Schritt, dann der
  Countdown mit vier weiteren), die `cancelMgFlow()` nicht löscht. Esc in diesem Fenster führt in die
  Lobby zurück, kurz darauf startet die Runde doch. Während des Countdowns kennt der Esc-Zweig in
  `setupKeyboard()` gar keinen Fall (`mgCountdown` wird nicht geprüft): Esc springt ins Hauptmenü, und
  die Runde startet von dort. *Fix:* Timer-IDs merken und in `cancelMgFlow()` löschen; Countdown im
  Esc-Zweig behandeln.
  → **Stand:** behoben.
- [x] 🟡 ✅ **G14 – Start wartet auf den Update-Check** (`boot()`: `await checkForUpdate()` vor `Auth.init()`).
  Ohne Antwort von GitHub steht der Ladebildschirm bis zu 5 s (`UPDATE_CHECK_TIMEOUT_MS`), obwohl der
  Kommentar in `main.js` sagt, der Start dürfe nie blockiert werden.
  → **Stand:** behoben (höchstens 1,5 s).

### Electron-Hülle

- [x] 🟡 ✅ **G15 – Versionsnummer steht doppelt** (`preload.js`: `version: '0.25.0'` fest eingetragen,
  `package.json` separat). Beim nächsten Release leicht vergessen; dann zeigt das Menü die alte Version.
  → **Stand:** behoben.
- [x] 🟡 ✅ **G16 – URL-Prüfung per Präfix** (`main.js`, `update:open`): `startsWith('https://github.com/IchPity/Block-Drop')`
  passt auch auf `…/Block-Drop-irgendwas`. *Fix:* mit abschließendem `/` vergleichen oder `new URL` prüfen.
  → **Stand:** behoben.
- [x] 🟡 ✅ **G17 – Keine Sperre für Navigation und neue Fenster** (`main.js`): es fehlen
  `setWindowOpenHandler` und ein `will-navigate`-Handler. Aktuell gibt es keine externen Links im
  Renderer, die Sperre wäre reine Vorsorge.
  → **Stand:** behoben.
- [ ] 🟡 ❓ **G18 – Electron `^33`** ist nicht mehr im Support-Fenster; vor dem nächsten Release anheben.
  → **Stand:** braucht `npm install` und einen Testlauf.

### Spielkerne (nur überflogen)

- [x] 🟡 ✅ **G19 – Ergebnis-Timer überlebt den Abbruch** (`block-bomb/main.js` `_finish`, ebenso `laser-lines`,
  `block-rush`, `color-hunt`). Nach „X gewinnt!" ruft ein `setTimeout` nach 1,4 s `onResult` auf;
  `destroy()` löscht ihn nicht. Endet in diesem Fenster die Abbruch-Abstimmung, erscheint das Ranking
  über der Lobby und `seriesIndex` zählt weiter. *Fix:* Timer-ID merken und in `destroy()` löschen.
  → **Stand:** behoben.
- [x] 🟡 ✅ **G20 – Tastenbelegung wird beim Preset-Wechsel nicht neu geprüft** (`keybinds.js`). Wechselt
  Spieler 1 zwischen WASD und Pfeiltasten, tauscht Spieler 2 automatisch das Preset, die gespeicherten
  Einzelbelegungen (`keysP1`/`keysP2`) bleiben aber. Danach können zwei Aktionen oder beide Spieler auf
  derselben Taste liegen. *Fix:* beim Preset-Wechsel Übersteuerungen leeren oder Konflikte auflösen.
  → **Stand:** behoben. Preset-Wechsel setzt die Einzelbelegungen zurück.
- [x] 🟡 ✅ **G22 – Tasten bleiben hängen, wenn das Fenster den Fokus verliert** (`game/controllers.js`, alle drei
  lokalen Controller). Bei Alt+Tab kommt kein `keyup`; die Figur läuft weiter bzw. das Teil schiebt
  weiter, bis die Taste erneut gedrückt wird. *Fix:* auf `blur` `clear()` aufrufen.
  → **Stand:** behoben.
- [x] 🟡 ✅ **G23 – Block Rush: Loslassen einer Richtung stoppt auch die andere** (`LocalPieceController._onUp`).
  Rechts halten, kurz links tippen: beim Loslassen von links wird `_dasDir = 0` gesetzt, die noch
  gehaltene rechte Taste wiederholt nicht mehr.
  → **Stand:** behoben.
- [ ] 🟡 ❓ **G21 – Pro Runde ein neuer WebGL-Renderer.** `destroy()` ruft `renderer.dispose()`, gibt den
  Kontext aber nicht aktiv frei (`forceContextLoss()`). Nach vielen Runden in einer Sitzung kann
  Chromium ältere Kontexte abräumen; beobachten, ob in langen Serien Warnungen auftauchen.
  → **Stand:** beobachten.

## 16. Repo

- [x] 🟠 ✅ **R1 – Fremde E-Mail-Adressen im Repo** (`tracker_backend_cleanup.sql`, Kopfkommentar). Dort stehen
  zwei Schul-Adressen im Klartext, eine davon von einer dritten Person. Das Repo ist über GitHub
  erreichbar (die Download-Seite verlinkt die Releases). *Fix:* Adressen aus dem Kommentar nehmen;
  sie bleiben in der Git-History, falls das stört, History bereinigen.
  → **Stand:** behoben im aktuellen Stand; die Adressen stehen weiter in der Git-History.
- [ ] 🟡 ✅ **R2 – Nicht verlinktes Schach wird weiter ausgeliefert** (`app/games/schach/` mit `game.js`,
  `Schach.jar`). Laut README nicht mehr verlinkt, aber unter `/games/schach/` öffentlich erreichbar und
  ungepflegt. Löschen oder wieder verlinken.
  → **Stand:** löschen oder verlinken, deine Entscheidung.
- [ ] 🟡 ✅ **R3 – Schach-Regeln unvollständig** (`app/games/schach/game.js`), nur relevant, falls die Seite wieder
  verlinkt wird:
  - Kein Schach, Matt oder Patt: der König darf ins Schach ziehen, das Spiel endet erst, wenn er
    geschlagen wird (`movePiece`).
  - Kein En passant.
  - Rochade (`calcKingMoves`): erlaubt, während der König im Schach steht; die lange Rochade verlangt
    fälschlich auch ein unbedrohtes b-Feld; `threatened()` wertet Bauern-Vorwärtszüge als Angriff und
    übersieht deren Schlagfelder auf leeren Feldern.
  → **Stand:** hängt an R2.
- [ ] 🟡 ✅ **R4 – `FEHLER.md` selbst** liegt im Repo-Root und wird beim nächsten Commit öffentlich, inklusive
  der Sicherheitsfunde in Abschnitt 2. Vor dem Push entscheiden: erst S1–S3 fixen oder die Datei in
  `.gitignore` aufnehmen.
  → **Stand:** vor dem nächsten Commit entscheiden.

## Nicht geprüft

- Das Java-Projekt `Schach/`
- Die 3D-Spielkerne von Block Games im Detail (`block-bomb/`, `laser-lines/`, `block-rush/`,
  `color-hunt/`, `game/bots/`, `game/controllers.js`): nur Timer, Listener und Aufräumen angesehen
- `app/theme.css` und das CSS der einzelnen Seiten (Darstellungsfehler brauchen einen Browser)
- `app/impressum/`
- Alles, was nur in Supabase liegt: tatsächliche Policies, die Casino-Funktionen, Storage-Regeln für
  `avatars`, Auth-Einstellungen (E-Mail-Bestätigung, Passwortregeln)

## 17. Impeccable-Audit, Runde 1 (2026-10-03)

Gemessen im Browser (Edge headless, 360 px breit) und mit dem Impeccable-Detector über `app/`.

| Bereich | Note (0–4) | Befund |
|---|---|---|
| Barrierefreiheit | 3 | Kontrast kleiner Beschriftungen und der Login-Knöpfe lag unter 4,5:1 (behoben); zwei Eingabefelder ohne Beschriftung (behoben) |
| Performance | 3 | F1-Live-Tracker lud alle 5 s die ganze Session (behoben, H1); Block Presser las zehnmal pro Sekunde den Speicher (behoben, P5) |
| Responsive | 4 | Auf keiner der 21 Seiten horizontaler Überlauf; kleine Knöpfe auf dem Handy jetzt mindestens 40 px hoch |
| Theming | 2 | 686 Hinweise auf Farben, Radien und Schriftgrößen außerhalb von `DESIGN.md`; jede Seite hat eigene Inline-Styles |
| Umsetzung | 3 | Detector: 17 Funde, davon 13× derselbe (siehe unten), 4× Schrift im Bild-in-Bild-Fenster (behoben) |

**Behoben in dieser Runde**
- [x] Login-Knopf und „Anmelden"-Knopf im Fenster: dunkle Schrift auf dem leuchtenden Knopf statt Weiß (3,2:1 → über 6:1), `app/auth.js`.
- [x] 50 Stellen mit `color: rgba(255,255,255,0.4)` bzw. `0.45` in 13 Seiten auf `0.52`/`0.54` angehoben (3,7:1 → rund 5:1).
- [x] SchulUhr: `--muted` von 28 % auf 52 % Deckkraft.
- [x] `aria-label` für das Suchfeld der Wetterseite und das ICAO-Feld der METAR-Seite; Kartenmarker mit Alternativtext.
- [x] Handy: `.map-btn`, `.quick-tag`, `.recent-tag`, `.lb-tab`, `.fav-btn`, `.pip-btn`, `.mini-btn` mindestens 40 px hoch, Schließen-Knopf des Ersatzfensters 36 px.
- [x] Bild-in-Bild-Fenster der SchulUhr nutzt die Schriften des Design-Systems (Barlow, Share Tech Mono) statt Orbitron und Inter.

**Stehen gelassen (bewusst)**
- [ ] `clipped-overflow-container` auf `body` (13 Seiten): `overflow-x` am `body` schneidet die Deko-Lichtflecken ab, die absichtlich über den Rand ragen. Das Konto-Menü liegt innerhalb des Bildes und wird nicht abgeschnitten. Kein Fehler.
- [ ] `pulsing-dot` im F1-Live-Tracker: der Punkt steht für echte Live-Daten.
- [ ] Gesperrte Knöpfe im Casino (4,0:1) und Farbverlauf-Texte (Messfehler meines Skripts): keine Verstöße.

**Offen**
- [ ] Die meisten Seiten haben kein `<main>`-Element; Wetter und Block Presser haben keine `<h1>`.
- [ ] Theming: die 686 Hinweise sind ein eigenes Projekt (`/impeccable extract` bzw. `document`), kein Einzelfix.
- [ ] `DESIGN.md` ist neuer als `.impeccable/design.json` (`/impeccable document` würde das auffrischen).

## 18. Runde 2: Tests im echten Browser (2026-10-03)

Ab hier ist nicht mehr nur gelesen, sondern ausgeführt: alle 22 Seiten in Edge (headless) über einen
lokalen Server, Block Games in Electron (auch zwei Instanzen gegeneinander über Supabase Realtime).
Nicht getestet ist alles, was ein echtes Konto braucht (Login, Wallet, Freunde, F1-Wetten mit echter
Datenbank); dort wurde die Logik mit nachgestellten Antworten geprüft.

**Im Test bestätigt**
- Alle Seiten laden ohne Skriptfehler.
- Block Drop: Pause sperrt alle Züge (auch per Touch), Pause-Knopf setzt fort, Räum-Animation ignoriert
  Züge, Game Over speichert genau einen Score, Tippen im Login-Fenster funktioniert bei laufendem Spiel.
- Block Presser: zweiter Tab überschreibt den neueren Stand nicht mehr; Matura, Reset, Spezial-Shop,
  Glocke laufen durch.
- Kino-Screen: ein Screen, der im Schließfenster angefordert wird, erscheint danach sichtbar (F1).
- Casino: Spin, Blackjack (auch mit ungeradem Einsatz und Split), Roulette (Setzen, Rückgängig,
  Wiederholen), Kasse als Gast.
- Erfolge: Gast → Konto, zweites Gerät, Lesefehler, zwei Erfolge direkt hintereinander, Kontowechsel.
- F1 Wetten: zwei gleichzeitige Läufe zahlen nur einmal aus, mit und ohne Datenbank-Funktion.
  (Alter Stand im selben Test: Anzeige 1.300 statt 1.100 Punkte.)
- METAR lädt wieder (über den neuen Ausweichweg), Wetter-Radar lädt, „JETZT"-Linie auch für New York.
- Block Games: Version kommt aus `package.json`; falscher Code scheitert nach 6 s mit Meldung; Esc im
  Abstimmungsfenster und im Countdown bricht wirklich ab; ein Gast kann dem Host kein Ergebnis
  unterschieben; Host-Abbruch bringt den Gast in den Warteraum, Session-Ende ins Menü.

**In Runde 2 neu gefunden und behoben**
- [x] 🔴 **Eigener Fehler aus Runde 1: Casino-Spielstand ging bei jedem Neuladen verloren.** `claim('gast')`
  lief im Auth-Callback, der sofort feuern kann, also vor `load()`, und speicherte die Startwerte über
  den gespeicherten Stand. Jetzt wird der Besitzer bis nach dem Laden nur vorgemerkt. Im Browser
  geprüft: Guthaben und Freispiele überleben das Neuladen.
- [x] 🟠 **Eigener Fehler aus Runde 1: Erfolge-Seite warf beim Laden** (`lbMode` vor der Initialisierung
  benutzt, gleiche Ursache: Auth-Callback feuert sofort). Behoben.
- [x] 🟡 **Wetter: Fehlerkarte ohne Ausweg.** Antwortet Open-Meteo mit 503, stand nur „Forecast 503" da.
  Jetzt mit Erklärung und „Nochmal versuchen".
- [x] 🟡 **Registrierung flackerte kurz auf „Username wählen"**, weil der Auth-Callback vor dem
  Profil-Insert meldete. `signUp` meldet jetzt einmal am Ende.

**Merksatz für künftige Änderungen:** `Auth.onChange(cb)` ruft `cb` sofort auf, wenn die Session schon
geladen ist. Alles, was der Callback braucht (`let`-Variablen, geladener Spielstand), muss vorher stehen.

**Impeccable, zweiter Lauf:** Detector meldet nur noch die 12 bewusst stehen gelassenen
`clipped-overflow-container`-Funde und den Live-Punkt im F1-Tracker.

## 19. Runde 3 (2026-10-03)

- Kompletter Wiederholungslauf aller Browser-Tests: keine Skriptfehler, alle Abläufe wie in Runde 2.
- Derselbe Lauf mit `prefers-reduced-motion`: ebenfalls ohne Fehler.
- [x] METAR: der funktionierende Weg (Rohtext) steht jetzt an erster Stelle. Vorher schlug bei jedem
  Abruf erst der direkte NOAA-Aufruf an CORS fehl (Fehler in der Konsole, eine unnötige Anfrage).
- [x] Tablet (768 px): die Mindesthöhe für kleine Knöpfe galt nur unter 760 px. Sie gilt jetzt für alle
  Touch-Geräte (`@media (pointer: coarse)` in `app/auth.js`).
- Impeccable-Detector, dritter Lauf: 13 Funde, alle aus der Gruppe „bewusst stehen gelassen" (Abschnitt 17).

## Was du selbst tun musst

1. **`security_fixes.sql` im Supabase-SQL-Editor ausführen** (vorher die beiden PRÜFEN-Abfragen im Skript
   laufen lassen). Ohne das bleiben S1–S3, S5, S6, A10 und WE1 offen; der Client funktioniert aber auch so.
2. **Entscheiden:** SU1/SU2 (richtige Stundenzeiten), S4 (direkte Schreibrechte entfernen?), R2 (Schach
   löschen oder verlinken), R4 (`FEHLER.md` und `security_fixes.sql` committen?), ST1 und G18 beim
   nächsten Block-Games-Release.
3. **Mit echtem Konto gegenprüfen**, was ich nicht testen konnte: Registrierung und Login (auch per
   Username), Profilbild hochladen/entfernen, Casino im Konto-Modus (Wallet, Auszahlung), F1-Wette
   platzieren, Freundschaftsanfrage, Einladung in Block Games.
4. **Nichts ist committet.** 34 geänderte Dateien liegen im Arbeitsverzeichnis.
