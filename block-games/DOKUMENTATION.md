# Block Games — Dokumentation

Desktop-Party-Spiel (Mario-Party-Stil) für die Block-Drop Arcade, gebaut mit
Electron. **Diese Datei ist die laufende Doku des Projekts: Jede Änderung am
Code wird hier dokumentiert.**

## Grundregeln

- **Kein obfuskierter Code.** Anders als die Website (`app/` + `worker.js`)
  bleibt der Code in `block-games/` immer im Klartext lesbar.
- **Alles dokumentieren.** Neue Features, Entscheidungen und Änderungen kommen
  in diese Datei (Abschnitt „Änderungsprotokoll").
- **Alles ohne Maus bedienbar (verbindlich).** Jeder Screen und jedes Overlay
  muss sich vollständig per Tastatur steuern lassen — **Pfeiltasten ODER WASD**
  für die Navigation, **Enter/Leertaste** zum Auslösen, **Esc** zum Zurück/
  Schließen. Das gilt auch für Login/Registrierung, Einstellungen und alle
  künftigen Menüs/Minigames. Wer einen neuen Screen baut, hängt ihn in die
  Container-Auswahl von `setupKeyboard()` (`renderer/app.js`) ein.
- Geplante Features und offene Punkte stehen in `ROADMAP.md`.

## App starten

**Einfachster Weg:** Doppelklick auf **`Block Games starten.bat`** im Ordner
`block-games/`. Die Batch-Datei startet Electron direkt aus `node_modules`
und installiert beim allerersten Start automatisch die Abhängigkeiten.
(Tipp: Rechtsklick auf die Datei → „Senden an → Desktop" legt eine
Desktop-Verknüpfung an.)

Alternativ über die Konsole:

```powershell
cd "C:\Users\User\Desktop\Block Drop\block-games"
npm install   # nur beim ersten Mal
npm start
```

Hinweis: Node.js liegt portabel auf `D:\` (`D:\node.exe`).

## Dateiübersicht

| Datei | Zweck |
|---|---|
| `main.js` | Electron-Hauptprozess: Fenster (Vollbild), F11-Toggle, kein App-Menü, IPC für Anzeige-Einstellungen + `app:quit` |
| `preload.js` | Brücke Main↔Renderer: Version/Plattform, Anzeige-Steuerung (Vollbild, Fenstergröße, Display-Infos), `quitApp()` |
| `renderer/index.html` | Alle Screens: Laden, Login/Registrierung, Hauptmenü, **Lobby** (4 Playercards + Bot-Stepper + Slot-/Farb-Popups), Einstellungen (**in Kategorie-Reitern**: Konto/Anzeige/Grafik/Audio), **Credits** + Beenden-Overlay + **Konto/Freunde-Overlay**, **Match-Abbruch-Abstimmung** (`#mgAbortVote`), **Online-Sessions** (`#onlinePicker`: Hosten/Beitreten); Bühnen-Hintergrund-Layer |
| `renderer/app.js` | UI-Logik: Screen-Wechsel, Gast-Modus, Menü-Rendering, **Lobby (Slots/Bot-Anzahl-Stepper/Farben + 300 Bot-Namen, Couch-Koop-Slot, Online-Peer-Slots)**, **Match-Abbruch-Abstimmung** (F5/F6, Schein-Abstimmung gegen Bots), **Online-Sessions** (Host/Beitreten, Lobby-Sync, Netzwerk-Match-Loop), **Credits-Rendering**, Einstellungs-UI, **Konto/Freunde-Overlay + Konto-Bearbeitung**, **Login-Vorschläge zuletzt angemeldeter Nutzer (`RecentUsers`)**, Toast, Sound-Verdrahtung, Beenden-Dialog (**mit optionalem Abmelden**), **feste navId-Tastatur-Navigation (`NAV_MENU`/`buildLobbyNav`) + Fokus-Gedächtnis**, animierter Hintergrund (Blöcke/Würfel/Sterne) |
| `renderer/net/session.js` | **`NetSession`** (neu, v0.20.0): Online-Sessions über Supabase Realtime Broadcast + Presence — Hosten/Beitreten per Code, Einladungs-Channel pro Nutzer, generisches `on(type, handler)`/`send(type, payload)`. Kennt weder Lobby noch Spielkerne — reine Transport-Schicht, von app.js angesprochen |
| `renderer/settings.js` | Zentraler Einstellungs-Store (localStorage, onChange-Events, `effectiveVolume()`) |
| `renderer/audio.js` | Sound-System `Sfx`: UI- + **Block-Bomb-Effekte** (`bombTick/bombPass/bombExplode/count/go`) + **Laser-Lines-Effekte** (`laserWarn/laserFire/laserHit/laserEliminate/laserWin/laserSpeedUp`) per WebAudio synthetisiert (keine Audio-Dateien), Lautstärke aus dem Settings-Store |
| `renderer/auth.js` | Supabase-Auth + **Freundes- und Konto-API** (gleiches Backend wie die Website) + **`Auth.client`-Getter** (neu, für `net/session.js`) |
| `renderer/style.css` | Arcade-Look: Farben (inkl. `--orange/--cyan/--pink`), Animationen, Layout, unsichtbare Scrollbalken, Kompakt-Stufen, **Lobby-/Playercard-/Bot-Stepper-/Popup-Styling**, Credits-Styling, Bühnen-Hintergrund, **generischer Minigame-Flow (`.mg-*`: Map-Voting/Countdown/Ergebnis/Ranking) + Lobby-Krone**, **Match-Abbruch-Panel (`.mg-abort-vote`, links/vertikal zentriert, nicht blockierend)** |
| `renderer/block-bomb.css` | Optik **Block Bomb**: Canvas-Bühne + In-Game-HUD (Timer/Namensschilder/Meldungen, Map-Intro) + Block-Bomb-Map-Thumbnails (`.mg-thumb-block-bomb-*`). Die Voting-/Countdown-/Ergebnis-Overlays sind generisch (`.mg-*` in `style.css`) |
| `renderer/laser-lines.css` | Optik **Laser Lines**: Canvas-Bühne + In-Game-HUD (Leben/Tempo/Warnbanner/Treffer-Vignette/Namensschilder, Map-Intro) + Laser-Map-Thumbnails (`.mg-thumb-laser-lines-*`) |
| `renderer/game/` | **Spiel-agnostische, von ALLEN Minigames geteilte Bausteine**: `characters.js` (blockige 3D-Figur `BlockCharacter` + `setHolderGlow/flash/explode/setInvulnBlink/setEliminated`), `controllers.js` (`LocalHumanController(layout)` — **WASD/Pfeiltasten trennbar für Couch-Koop** —, `RemoteController` — **jetzt echt gefüttert, s. Online-Sessions** —, generischer `BotController(brain)`), `bots/botAI.js`, `bots/waypoints.js` |
| `renderer/game/bots/botAI.js` | **Generische, wiederverwendbare Bot-KI** (für alle Minigames): Zustandsautomaten (CHASE/FLEE/ROAM/AVOID_EDGE/UNSTUCK), Anti-Stuck-Erkennung, Wand-/Ecken-Vermeidung, Steering, optionaler Debug-Modus, **Utility-Scoring für Zielwahl**, **Gefahren-Lookahead** (`decision.predictedHazards`), **leichtgewichtige Bot-Koordination** (Ziel-Claims über `world.map`) |
| `renderer/game/bots/memory.js` | **Räumliches Match-Gedächtnis** (`createZoneMemory`): Bots merken sich WÄHREND eines Matches erlebte Gefahrenzonen (z.B. Stellen, an denen sie feststeckten) mit sanftem, abklingendem Malus — ergänzt die statischen `corner`-Kartentags um echtes Laufzeit-Lernen. Pro Bot-Mover = automatisch pro Match frisch |
| `renderer/block-bomb/` | **Block-Bomb-Spielkern** (ES-Module): `main.js` (Szene/Renderer/Schleife/Runden + HUD + Map-Intro + Platzierungen, **`role`-Split Host/Gast + `getSnapshot/applySnapshot/feedRemoteInput/convertToBot`**), `maps.js` (3 Maps), `bomb.js` (Bombe), `bots.js` (per-Game Adapter für `botAI.js`). Figur + Controller kommen aus `renderer/game/` |
| `renderer/laser-lines/` | **Laser-Lines-Spielkern** (ES-Module): `main.js` (Szene/Schleife/Leben/Treffer/HUD, `window.LaserLines`, **`role`-Split Host/Gast + `getSnapshot/applySnapshot/feedRemoteInput/convertToBot`**), `maps.js` (3 Maps + `LASER_MAP_META` + Laser-Configs), `lasers.js` (Laser-System `warning→active→cooldown` + `LaserDirector`), `bots.js` (per-Game Adapter für `botAI.js`). Figur + Controller aus `renderer/game/` |
| `renderer/vendor/three.module.js` | Lokal eingebundenes **Three.js (r160)** für die 3D-Darstellung (kein CDN — CSP `default-src 'self'`, offline-fähig) |
| `renderer/assets/` | Eigene lokale Assets: `block-icon.svg/.png/.ico` (Marken-Block), `cube.svg`/`star.svg` (Deko-Masken) |
| `Block Games starten.bat` | Doppelklick-Start der App |

## Verhalten & Entscheidungen

### Block Bomb (Minigame)

Erstes spielbares Minigame: ein hektisches Party-Spiel auf einer 3D-Blockwelt.
Ein zufälliger Spieler startet mit der Bombe und muss durch **Berührung** einen
anderen Spieler antippen, um sie weiterzugeben. Läuft der Timer ab, **explodiert**
der aktuelle Träger und scheidet aus — **Last-Man-Standing**, der letzte Überlebende
gewinnt.

> **Hinweis (ab v0.13.0):** Der Ablauf läuft nicht mehr über bomb-eigene
> Funktionen, sondern über den **generischen Minigame-Flow** (Abschnitt
> „Generischer Minigame-Flow" + „Party-Serie & Gesamt-Ranking"). Block Bomb ist
> nur noch ein Registry-Eintrag (`GAME_REGISTRY['block-bomb']`); der untenstehende
> Text beschreibt das Spielgefühl, die konkreten Funktionsnamen sind historisch.

- **Ablauf nach „Spiel starten":** Map-Voting → 3-2-1-GO-Countdown → Runde → Ergebnis,
  gesteuert vom generischen Flow (`openMapVote` → `castMapVote` → `runCountdown` →
  `startRound` → `onGameResult`). Der Lobby-Knopf „Spiel starten" startet die
  **Party-Serie** (`startSeries()`) über alle verfügbaren Minigames.
- **Tutorial-Schnellstart aus dem „Games"-Bereich:** Klick auf die Minigame-Karte im
  Hauptmenü startet das Spiel als **Tutorial** — sofort eine Runde **ohne Lobby, ohne
  Bot-Auswahl und ohne Map-Voting**: `startTutorial('block-bomb')` → `runCountdown` →
  `startRound`. Es spielen **immer 3 Bots** (`buildTutorialPlayers()`), die Map
  wird **zufällig** gewählt. Die Bots laufen auf dem
  **einfachsten Grad `'easy'`** — bewusste Ausnahme zur Bot-Regel „immer Mittel/Schwer",
  damit man das Spiel in Ruhe lernen kann. Eigene Farbe und Bot-Farben/-Namen sind
  zufällig & ohne Dopplung. Das Flag `isTutorial` unterscheidet danach die
  Ergebnis-Knöpfe: „Nochmal" startet eine neue Tutorial-Runde (neue Random-Map), der
  zweite Knopf heißt „Zum Menü" und führt ins Hauptmenü (statt „Zur Lobby"). Der
  Lobby-/Party-Weg (`btnParty` → `openLobby` → volle Bot-/Farb-/Map-Wahl) bleibt
  unverändert daneben bestehen.
- **Rendering:** Three.js (lokal in `renderer/vendor/`, kein CDN — CSP-konform/offline).
  Der Spielkern (`block-bomb/main.js`) wird als ES-Modul geladen und registriert
  `window.BlockBomb` (`start/pause/resume/stop/isRunning`). Settings werden respektiert:
  `fpsLimit` (Schleifen-Drossel) und `reducedFx` (weniger Partikel/Glow/Schatten).
- **Spielerfarben aus der Lobby:** `buildMatchConfig()` übersetzt `lobbyState.slots` in
  eine entkoppelte Spielerliste; die Lobby-Farbe wird über `colorHex()` (liest die
  CSS-Variable, bleibt theme-synchron) zur echten Figurenfarbe im Spiel. **Diese Regel
  gilt für ALLE Minigames.** Das Spiel selbst kennt die Lobby NICHT — derselbe Einstieg
  trägt später Online-Lobbys.
- **Steuerungs-Abstraktion (online-tauglich):** Jede Figur hängt an einem Controller
  (`controllers.js`), der pro Frame nur einen Bewegungs-Intent `{x,z}` liefert:
  `LocalHumanController` (WASD/Pfeile), `BotController` (KI), `RemoteController` (Stub
  fürs spätere Online-Spiel über verschiedene Netzwerke). Der Spielkern liest nur
  Intents — lokal↔remote ist später ein reiner Controller-Tausch, kein Umbau.
- **3 Maps** (`maps.js`): **Bomb Arena** (runde Arena, leuchtender Rand, Säulen),
  **Sky Platforms** (schwebende Plattformen, Absturz = raus), **Factory Panic**
  (Förderbänder schieben, Kisten als Hindernisse, blinkende Warnlichter). **Jeder
  Modus bekommt 3 Maps** (Projekt-Konvention). Vor dem Start gibt es **Map-Voting**:
  echte Spieler wählen, Bots zufällig, Mehrheit gewinnt, Gleichstand → zufällig.
- **Bots** (`bots.js`): Mit Bombe verfolgen sie den nächsten erreichbaren Spieler, ohne
  Bombe fliehen sie vom Träger und meiden Rand/Abgrund. Fairness statt Perfektion:
  Reaktionsverzögerung, weiches Richtungs-Jitter, gelegentliche Fehlentscheidungen;
  gleiches Tempo wie Menschen. **Mittel** = träge/ungenau, **Schwer** = schneller/
  gezielter (kein „leicht", s. Bot-Regel). Bei wenig Restzeit reagieren beide aggressiver.
  - **Taktik (ab Mittel, voll bei Schwer):** *Offensiv* drängt der Träger Ziele zur
    Kante — die Zielwahl bevorzugt randnahe (leicht zu cornernde) Gegner und der Anflug
    erfolgt von der „sicheren" Seite (`herding`), sodass das Ziel beim Wegfliehen Richtung
    Abgrund läuft. *Defensiv* nutzen Nicht-Träger eine **Sampling-Flucht** (`escapeSamples`,
    in `botAI.js`): statt stur rückwärts wird die Richtung gewählt, die maximalen Abstand
    zu allen Bedrohungen hat **und** nicht über die Kante/in eine Wand führt. Nahe
    Mit-Flüchtende zählen als milde Bedrohung → die Bots **verteilen sich** statt zu
    verklumpen. Schwere Bots fliehen zudem vor der **vorhergesagten** Träger-Position
    (`anticipation`) und reagieren früher, wenn der Träger auf sie zuhält.
- **HUD:** Namensschilder über den Köpfen (3D→2D projiziert), markierter Bombenträger
  (roter Glow + 💣), Bomben-Timer, verbleibende Spieler, kurze Meldungen
  („… hat die Bombe!", „Bombe weitergegeben!", „… ist explodiert!", „… gewinnt!").
- **Tastatur überall:** WASD/Pfeile bewegen P1; Esc öffnet die Pause (`#bombPause`,
  Weiter/Zum Menü). Map-Voting, Pause, Ergebnis und Einladungsfenster sind komplett
  ohne Maus bedienbar. Die Bewegungstasten kollidieren nicht mit der Menü-Navigation,
  weil der globale Handler in `setupKeyboard()` für den Spielscreen früh aussteigt.
- **Online-Einladung (vorbereitet):** `#inviteOverlay` zeigt „Du wurdest … eingeladen.
  Von: [Name]" mit **Annehmen/Ablehnen**, Enter bestätigt, Esc lehnt ab, mehrere
  Einladungen als Warteschlange. Noch ohne echte Netz-Anbindung — Test-Auslöser
  `window.BombInvite.test('Name')`; die echte Online-Logik hängt später an
  `isOnlineAllowed()`.

### Generischer Minigame-Flow (für ALLE Minigames)

Seit v0.13.0 ist die Match-Orchestrierung in `app.js` **nicht mehr fest an Block
Bomb gekoppelt**, sondern generisch — so teilen sich Block Bomb und Laser Lines
(und künftige Spiele) denselben Ablauf und dieselben Overlays.

- **Minigame-Registry (`GAME_REGISTRY`):** Jedes spielbare Minigame deklariert
  entkoppelt `windowKey` (globales Spiel-Objekt `window.BlockBomb`/`window.LaserLines`
  mit `start/pause/resume/stop/isRunning`), `mapMeta` (Maps fürs Voting), `screenId`
  + `stageId` (Vollbild-Screen + Canvas-Host). Der Flow spricht das Spiel nur über
  `window[windowKey]` an und kennt keine Spiel-Internas.
- **Ein gemeinsames Overlay-Set (`#mg*`):** `#mgMapVote` (Voting), `#mgCountdown`
  (3·2·1·GO), `#mgPause`, `#mgResult` (Einzel-/Tutorial-Ergebnis) und `#mgRanking`
  (Serien-Zwischenstand/Gesamt-Ranking). Styling generisch als `.mg-*` in `style.css`;
  spielspezifisch sind nur die Map-Thumbnails (`.mg-thumb-<spiel>-<map>` in der
  jeweiligen Spiel-CSS).
- **Generischer Ergebnis-Vertrag:** `onResult(result)` mit
  `result = { winner, placements: [{id,name,colorHex}] }` (Reihenfolge 1.→letzter).
  Block Bomb merkt sich dafür die Eliminierungs-Reihenfolge; Laser Lines sortiert die
  Überlebenden nach Leben. Einzelspiele zeigen `winner`, die Serie wertet `placements`.
- **Flow-Funktionen:** `openMapVote()`/`castMapVote()` (Mensch wählt, Bots/Remote
  zufällig, Mehrheit, Gleichstand zufällig) → `runCountdown()` → `startRound()` →
  `onGameResult()`. Pause/Weiter/Beenden laufen generisch über `pauseGame()`/
  `resumeGame()`/`quitGameToMenu()`. Esc-Verhalten + Tastatur-Container in
  `setupKeyboard()` sind auf die `#mg*`-Overlays + beide Spielscreens umgestellt.

### Party-Serie & Gesamt-Ranking (Lobby „Spiel starten")

Der große **„Spielen"**-Weg über die Lobby startet eine **Party-Serie** statt einer
einzelnen Runde (`startSeries()` in `app.js`):

- **Alle verfügbaren Minigames in zufälliger Reihenfolge** (`availableGames()` +
  `shuffled()`): aktuell Block Bomb + Laser Lines.
- Pro Spiel: **eigenes Map-Voting** → Countdown → Runde → **Zwischen-Ranking**
  (`#mgRanking`, „Weiter"). Nach dem letzten Spiel: **Gesamt-Ranking** mit Krone.
- **Platzierungspunkte:** Bei N Spielern bekommt der 1. **N** Punkte, der letzte **1**
  (`awardSeriesPoints()`). Die Summe über alle Spiele (`seriesStandings`) entscheidet;
  **Gleichstand → besserer Platz im letzten Spiel, sonst zufällig**.
- **Gesamt-Ranking** (`showRanking(true)`): Plätze, Farben, Punkte; der Gesamtsieger
  trägt eine 👑. Knöpfe: **Nochmal** (neue Serie), **Zur Lobby**, **Zum Menü**.
- **Lobby-Krone:** Der Gesamtsieger-Slot wird in `lobbyCrownSlotId` gemerkt; `renderLobby()`
  zeigt eine 👑 auf dessen Playercard. Sie **verschwindet bei „Lobby zurücksetzen"**
  (`resetLobby()`) bzw. wenn ihr Slot leer wird.
- Die entkoppelte Spielerliste kommt unverändert aus `buildMatchConfig()` (Lobby-Farben
  werden übernommen, Bot-Schwierigkeit jetzt zufällig pro Match) — das Spiel kennt die
  Lobby NICHT.

### Match-Abbruch per Abstimmung

Im Pausemenü (`#mgPause`, Esc im Spiel) gibt es neben „Weiter"/„Zum Menü" einen
dritten Knopf **„Match abbrechen"** (`startAbortVote()` in `app.js`):

- **Bewusst nicht blockierend:** Das Öffnen der Abstimmung hebt die Pause sofort
  wieder auf (`window[currentGame.windowKey].resume()`) — das Match läuft während
  der ganzen Abstimmung normal weiter. Das Fenster (`#mgAbortVote`, `.mg-abort-vote`
  in `style.css`) ist deshalb **kein** `.overlay`-Modal, sondern ein kleines, am
  **linken Bildschirmrand vertikal zentriertes** Panel ohne Backdrop und ohne
  Fokus-Diebstahl.
- **Steuerung ausschließlich über F5/F6**, global in `setupKeyboard()` abgefangen
  (noch vor der Escape-/Container-Kaskade, weil das Panel keinen Fokus hat):
  **F5 = Ja, abbrechen**, **F6 = Nein, weiterspielen**. Beide Tasten waren frei —
  `main.js` entfernt das Standardmenü, nur F11 ist sonst belegt.
- **Wer startet, stimmt sofort mit Ja** (`abortVotes[initiator.id] = 'yes'`). Nur
  echte Menschen stimmen ab (`currentPlayers.filter(p => p.type === 'human')`),
  Bots werden bei der Mehrheitsberechnung ignoriert. Bei mehreren lokalen Menschen
  (Couch-Koop) gilt der erste Mensch in `currentPlayers` (= P1) als Initiator, weil
  Menü-Aktionen — anders als die Spielfigur-Bewegung — noch keinem bestimmten
  Controller zugeordnet sind; alle anderen müssen per F5/F6 selbst abstimmen
  (`castLocalAbortVote()`, `abortPendingIds` als Warteschlange).
- **15 s ohne Antwort = Nein** (`armAbortTimeout()`) — verhindert, dass eine
  hängende Abstimmung das Match blockiert.
- **Spielt man nur gegen Bots** (kein zweiter Mensch), läuft stattdessen eine
  **Schein-Abstimmung** (`runFakeAbortVote()`): die Bots „stimmen" zeitversetzt
  (~400–900 ms) sichtbar ab, das Ergebnis ist **immer Ja**.
- **Bei Mehrheit Ja** (`resolveAbortVote()` → `abortMatchToLobby()`) endet das
  Match sofort: zurück in die Lobby bei einer Party-Serie, zurück ins Menü bei
  einem Tutorial (das keine Lobby kennt). Bei Mehrheit Nein schließt sich das
  Panel und das Match läuft unverändert weiter.
- **Online-Mitspieler zählen noch nicht mit** (`type === 'remote'`) — sie senden
  heute keine echten Eingaben (siehe ROADMAP „Online-Spiel"), eine Netz-Abstimmung
  folgt zusammen mit der echten Online-Anbindung.

### Laser Lines (Minigame)

Zweites spielbares Minigame: ein schnelles 3D-Party-Spiel, bei dem **Laserlinien**
über die Map fahren oder rotieren. Wer getroffen wird, **verliert ein Leben**; bei 0
Leben scheidet man aus — **Last-Man-Standing**, der letzte Überlebende gewinnt.

- **Spielkern** (`renderer/laser-lines/main.js`, registriert `window.LaserLines`):
  Three.js (lokal vendored), gleiche Steuerungs-Abstraktion + Figur wie Block Bomb
  (`renderer/game/`), Map-Intro (Kamera-Flug), Settings respektiert (`fpsLimit`,
  `reducedFx`).
- **Leben/Treffer:** Start mit **3 Leben**. Treffer → −1 Leben, **1,5 s
  Unverwundbarkeit** (Figur blinkt, `setInvulnBlink`), Treffer-Sound + **Screen-Shake**
  + rote **Treffer-Vignette**. Bei 0 Leben: ausgegraut/abgesunken (`setEliminated`),
  Eliminierungs-Sound, ausscheiden.
- **Sieg/Ende:** letzter Lebender gewinnt. **Zeitlimit 60 s** als Fallback: leben dann
  noch mehrere, gewinnt der mit den meisten Leben — Gleichstand → wer zuletzt getroffen
  wurde, sonst zufällig. `onResult` liefert die vollständigen Platzierungen.
- **3 Maps** (`maps.js`, `LASER_MAP_META`):
  - **Spin Arena** (`spin`): runde Arena, rotierende Laser-Speichen aus der Mitte,
    werden mit der Zeit schneller (gute Einsteiger-Map).
  - **Factory Grid** (`grid`): Fabrikhalle, Laser fahren nach kurzer **Boden-Warnlinie**
    achsenparallel quer durch; Kisten als Deckung.
  - **Sky Warning** (`sky`): schwebende Plattformen, zufällige **Warnfelder**, danach
    Laser über diese Felder. **Sturz = 1 Leben verlieren** (+ Unverwundbarkeit +
    Rücksetzen auf eine sichere Plattform).
- **Laser-System** (`lasers.js`): Zustände **warning → active → cooldown** (bzw.
  „persistent" rotierende Speichen). Optik: rot/pinke leuchtende Linie + Glow,
  Boden-Warnlinie, **Funken beim Aktivieren** (nur ohne `reducedFx`), Warn- + Feuer-Sound.
  **Fairness:** keine Treffer ohne sichtbare Warnung; Tempo/Frequenz steigen langsam
  (`LaserDirector`, Level aus der Rundenzeit, `laserSpeedUp` bei Level-Up). **Kollision:**
  Abstand Punkt→Segment (lane/spoke) bzw. Punkt-in-Rechteck (zone), nur in `active`.
- **HUD:** Spielname „Laser Lines", Rundentimer, **Leben je Spieler** (Herzen),
  **Warnbanner** („⚠ Laser incoming!"), **Tempo/Level**, Namensschilder über den Köpfen.
- **Bots** (`bots.js`, `makeLaserBotBrain`): dünner Adapter, der die Bewegung an
  `botAI.js` delegiert. Laser-Verhalten wird auf die vorhandenen Zustände abgebildet:
  **AVOID_LASER → FLEE**, **SEEK_SAFE_ZONE/WANDER → ROAM**, **AVOID_EDGE/STUCK_RECOVERY**
  automatisch. Schwierigkeit (easy/medium/hard) steuert Reaktionszeit + Fehlerrate;
  **kein Cheaten** (Bots reagieren nur auf sichtbare Warnungen). Im Tutorial spielen die
  Bots auf `easy`.
  - **Multi-Laser-Ausweichen (ab Mittel):** Statt stur vom nächsten Laser wegzulaufen,
    probt die **Sampling-Flucht** (`escapeSamples`) mehrere Richtungen und wählt die mit
    dem größten Abstand zu **allen** Lasern (über `world.laserDanger` an jedem Probe-Punkt)
    — der Bot weicht **seitlich** aus statt in einen zweiten Laser zu laufen, und nie über
    die Kante. **Safe-Zone-Seeking** (`seekSafe`): ist gerade keine Gefahr akut, steuert
    der Bot proaktiv die laserfreieste Zone an (`safestWaypoint`). **Warn-Antizipation**
    (`warnAnticipation`, stärkster Effekt bei Schwer): starke Bots verlassen einen Laser
    schon in dessen sichtbarer **Warnphase**, bevor er feuert.
- **Tutorial-Schnellstart:** Klick auf die Minigame-Karte „Laser Lines" startet sofort
  eine **einzelne** Runde (`startTutorial('laser-lines')`): P1 + 3 Easy-Bots, zufällige
  Map, kein Voting, kein Serien-Ranking. Ergebnis-Knöpfe „Nochmal"/„Zum Menü".
- **Steuerung:** WASD/Pfeile bewegen P1, Esc pausiert (`#mgPause`). Der globale
  Tastatur-Handler steigt im Spielscreen früh aus, damit die Bewegung nicht mit der
  Menü-Navigation kollidiert (wie bei Block Bomb).

### Vollbild
Die App startet **immer im Vollbild** — wie andere Videospiele, ohne sichtbare
Taskleiste. Das Fenster wird mit `fullscreen: true` erzeugt (`main.js`);
zusätzlich erzwingt `app.js` beim Start den Vollbildmodus unabhängig vom
gespeicherten Wert (`Settings.set('fullscreen', true)` + `setFullscreen(true)`).
Dadurch öffnet das Spiel auch dann im Vollbild, wenn zuvor Fenstermodus
gespeichert war (sonst wäre beim Start die Taskleiste sichtbar).
**F11** (oder der Schalter in den Einstellungen) wechselt jederzeit in den
Fenstermodus — das ist nötig, weil das Standard-Menü deaktiviert ist und es
sonst keinen Weg aus dem Vollbild gäbe. Verlässt man den Vollbildmodus, fällt
das Fenster auf 1280×800 zurück (min. 960×640).

### Login & Gast-Modus
- Anmeldung/Registrierung läuft gegen **dasselbe Supabase-Backend wie die
  Website** — bestehende Website-Konten funktionieren direkt
  (synthetische Auth-Mail `<username>@blockdrop.local`,
  Fallback-RPC `resolve_login_email`; Flow 1:1 aus `app/auth.js`).
- Der Login ist **überspringbar**: Button „Als Gast spielen" auf dem
  Auth-Screen.
- **Zuletzt angemeldete Nutzer (`RecentUsers`):** Nach erfolgreichem Login/
  Registrierung wird der Login-Name + Zeitstempel **rein lokal** gespeichert
  (`localStorage`-Schlüssel `blockgames.recentUsers`, **nie ein Passwort**). Auf
  dem Login-Reiter erscheinen die Namen als Vorschläge (`#recentUsers`,
  `renderRecentUsers()`): Klick füllt das Namensfeld und springt ins Passwort,
  das ✕ entfernt einen Vorschlag. Einträge, die **7 Tage** nicht für einen Login
  genutzt wurden, werden beim Laden automatisch entfernt (max. 5 Vorschläge).
- **Gast-Regel: Ohne Konto nur Partien gegen Bots.** Kein Online-Spiel,
  kein gespeicherter Fortschritt. Im Menü weist ein gelbes Hinweisband
  darauf hin; der Button oben rechts heißt dann „Anmelden" statt „Abmelden".
- Technisch hängt die Sperre an `isOnlineAllowed()` in `renderer/app.js`
  (`true` nur mit echter Session). **Jede künftige Online-Funktion
  (Matchmaking, Lobbys, Bestenlisten …) muss diese Funktion prüfen.**
  Der Gast-Status selbst steckt in der Variable `guestMode`.

### Einstellungen

Erreichbar über das **⚙️-Zahnrad oben rechts im Hauptmenü** (zurück per
„←"-Button oder **Esc**). Alle Werte liegen im zentralen Store
`renderer/settings.js` (localStorage-Key `blockgames.settings`) und
überleben Neustarts.

**Aufbau in Kategorie-Reitern:** Oben wählt man den Bereich (**Konto ·
Anzeige · Grafik · Audio**), darunter erscheinen nur die Optionen dieser
Kategorie. Es ist immer genau ein Panel sichtbar (`.settings-tab` /
`.settings-panel` in `index.html`; `activateSettingsTab()` / `openSettings()`
in `app.js`). Der **Konto-Reiter erscheint nur angemeldet**
(`syncAccountCard()` blendet Reiter + Panel ein/aus und fällt sonst auf
„Anzeige" zurück). Einstiegspunkte: das ⚙️-Zahnrad öffnet **Anzeige**, der
Knopf „Konto bearbeiten" im Konto-Overlay öffnet direkt den **Konto**-Reiter.
Reiter und Optionen sind komplett **ohne Maus** bedienbar (siehe
„Tastatur-Bedienung").

| Bereich | Einstellung | Verhalten |
|---|---|---|
| Anzeige | Vollbild (Schalter) | wirkt sofort per IPC; bleibt mit F11 synchron (`display:fullscreen-changed`-Event aus `main.js`) |
| Anzeige | Fenstergröße (Auswahl) | nur im Fenstermodus aktiv; Liste wird auf die Bildschirmgröße gefiltert; beim Verlassen des Vollbilds wird die gespeicherte Größe wiederhergestellt |
| Grafik | FPS-Limit (30/60/120/144/240/unbegrenzt) | wird nur **gespeichert** — die Minigames müssen das Limit selbst über `Settings.get('fpsLimit')` umsetzen (0 = unbegrenzt) |
| Grafik | Animationen reduzieren | blendet schwebende Hintergrund-Blöcke und Glanz-Sweep aus (`body.reduced-fx`) |
| Audio | Gesamt / Musik / Soundeffekte (0–100 %) | nur gespeichert (noch kein Sound in der App); Spiele lesen die fertige Lautstärke über `Settings.effectiveVolume('music'|'sfx')` (0–1, Master eingerechnet) |

„Zurücksetzen" stellt alle Defaults wieder her. Gespeicherte
Anzeige-Einstellungen werden beim App-Start angewendet — **mit einer Ausnahme:
der Start ist immer Vollbild** (siehe Abschnitt „Vollbild"), ein gespeicherter
Fenstermodus greift erst, wenn man im laufenden Spiel umschaltet.

**Geplant & verbindlich (siehe ROADMAP):** Jedes Minigame bekommt ein
eigenes, **kleineres Einstellungs-Overlay** (z.B. im Pause-Menü, v.a. für
Lautstärke). Dieses Overlay muss **denselben Store** (`settings.js`)
nutzen — gleiche Keys, gleiche `onChange`-Events — damit In-Game-Regler
und die Haupt-Einstellungsseite immer synchron bleiben.

### Sound (`renderer/audio.js`)

- Alle UI-Sounds (Klick, Hover, Tab-Wechsel, Schalter, Erfolg, Fehler,
  Lautstärke-Testblip) werden **per WebAudio synthetisiert** — es gibt keine
  Audio-Dateien, die App bleibt offline-fähig und CSP-konform.
- API: `Sfx.play(name)` bzw. `Sfx.play(name, 'music')`. Die Lautstärke wird
  bei jedem Abspielen frisch über `Settings.effectiveVolume(channel)` gelesen
  (Master eingerechnet) — Regler-Änderungen wirken dadurch sofort.
- Verdrahtung zentral per Event-Delegation in `app.js` (`setupSfx()`):
  Klick/Hover auf `.btn`, `.auth-tab`, `.party-btn`, `.minigame-card.available`;
  `toggle` bei Checkboxen, `tab` bei Selects; `success`/`error` beim Login.
  Neue Buttons klingen damit automatisch.
- Beim Ziehen eines Lautstärke-Reglers spielt ein gedrosselter Test-Blip
  (Musik-Regler auf dem Musik-Kanal), damit man die Lautstärke direkt hört.
- **Kein** Sound beim Toast — der Auslöser (Klick) hat schon geklungen,
  ein zweiter Ton wäre doppelt.
- Der Musik-Kanal (`volMusic`) ist noch ungenutzt; Hintergrundmusik kommt
  mit den Minigames. **Minigames spielen ihre Effekte über `Sfx.play()`**
  (oder eigene Sounds, dann aber immer mit `Settings.effectiveVolume`
  skaliert).

### Beenden

- **⏻-Knopf** oben rechts im Hauptmenü öffnet einen Bestätigungs-Dialog
  („Spiel beenden?"); „Beenden" ruft per IPC `app:quit` → `app.quit()`.
  Abbrechen, Esc oder Klick auf den abgedunkelten Hintergrund schließen nur
  den Dialog. Nötig, weil die App im Vollbild ohne Menüleiste läuft.
- **Abmelden beim Beenden (dritter Button):** Angemeldeten Nutzern zeigt der
  Dialog einen mittleren Button **„Abmelden & Beenden"** (`#btnQuitLogout`, im
  Gast-Modus per `hidden` ausgeblendet, gesteuert über `isOnlineAllowed()` in
  `openQuitDialog()`). Er läuft `Auth.signOut()` und beendet danach — die Session
  wird beendet, sodass der nächste Start wieder den Login zeigt. Der rechte
  „Beenden"-Button hält die Session (nächster Start direkt im Menü). Reihenfolge
  im Dialog: **Abbrechen · Abmelden & Beenden · Beenden**.

### Konto & Freunde

- **Konto-Overlay** (`#accountOverlay` in `index.html`), geöffnet per Klick aufs
  **Spieler-Badge** (Avatar + Name) oben links im Menü. Zeigt Profilkopf
  (großer Avatar mit Initiale, Username, hinterlegte Kontakt-E-Mail),
  **offene Freundschaftsanfragen** (eingehend mit „Annehmen/Ablehnen",
  eigene als „Angefragt") und die **Freundesliste** (mit „Entfernen"),
  dazu eine **Username-Suche** zum Anfragen neuer Freunde. Schließen per
  „✕", **Esc** oder Klick auf den Hintergrund.
- **Gast-Modus:** kein Konto → Klick aufs Badge zeigt nur einen Hinweis-Toast
  (über `isOnlineAllowed()` gegated).
- **Freundes-API in `renderer/auth.js`** gegen die Supabase-Tabelle
  `public.friends` (Spiegel der Website): `getFriendOverview()` (eine Abfrage
  + Nachladen der Usernamen), `searchUsers()`, `sendFriendRequest()`,
  `acceptFriendRequest()`, `removeFriend()`. RLS erlaubt nur Zeilen, an denen
  man selbst beteiligt ist. **Profilbilder bleiben außen vor** (CSP lässt nur
  lokale Bilder zu) — Avatare zeigen wie im Menü die Namens-Initiale.

### Konto bearbeiten (Einstellungen)

- Eigene **Karte „👤 Konto"** oben in den Einstellungen — nur sichtbar, wenn
  angemeldet (im Gast-Modus ausgeblendet). Drei kleine Formulare:
  - **Anzeigename:** ändert `profiles.username` (unique). Da der Username der
    **Login-Schlüssel** ist, zieht `Auth.updateUsername()` für Accounts mit
    synthetischer Auth-Mail die Login-Mail `<username>@blockdrop.local`
    automatisch nach (`auth.updateUser({ email })`), damit der Login mit dem
    neuen Namen weiter klappt. Alt-Accounts mit echter Auth-Mail behalten ihre
    Login-Mail. Validierung wie bei der Registrierung (3–20 Zeichen, `a–z 0–9 _`).
  - **E-Mail:** optionale **Kontakt-Adresse** (`user_metadata.contact_email`,
    nie die Auth-Mail). Leeren entfernt sie.
  - **Passwort:** `auth.updateUser({ password })`, min. 6 Zeichen.
- Jedes Formular meldet Erfolg/Fehler unter der Karte (`#accountMsg`, grün/rot).
- **Wichtig:** Profil-Updates feuern denselben `Auth.onChange`-Event wie der
  Login. Der Screen-Wechsel ins Menü passiert deshalb **nur beim Login**
  (vom Lade-/Auth-Screen) — sonst würde das Bearbeiten aus den Einstellungen
  herausspringen. Die Konto-Karte wird bei Update bewusst **nicht** neu
  befüllt, damit Erfolgsmeldung und laufende Eingaben erhalten bleiben.

### Credits

- Eigener **Credits-Screen** (`#screen-credits` in `index.html`), erreichbar
  über den **„Credits"-Button** im Menü-Footer; zurück per „←"-Button oder
  **Esc**. Kein `alert()` mehr.
- Gleicher Arcade-/Bühnen-Look wie das Menü (Spotlights, Sterne, Würfel,
  großer „CREDITS"-Titel), Rollen als farbakzentuierte Karten mit
  gestaffelter Einblendung.
- **Datengetrieben & leicht erweiterbar:** Die Rollen stehen in der Liste
  `CREDITS` in `app.js`; `renderCredits()` baut die Karten daraus. Eine neue
  Rolle ist ein Eintrag mehr. **Aktuell überall nur „Peter Scheikl".** Darunter
  steht klein „Made with Electron, JavaScript, HTML and CSS".

### Lobby (Vorbereitungsscreen)

- **„Spielen" führt jetzt zur Lobby** (nicht mehr zu einem Toast): Der
  Hauptmenü-Button `#btnParty` ruft `openLobby()` (`app.js`) und öffnet den
  eigenen Screen `#screen-lobby`. **Zurück:** der Footer-Button „← Zurück"
  ODER **Esc** (solange kein Popup offen ist) → Hauptmenü.
- **Vier große Playercards** nebeneinander (`renderLobby()` baut sie aus
  `lobbyState`). Jede Karte zeigt Slot-Nummer (P1–P4), Avatar-Kreis mit Farbring
  (Initiale, 🤖 für Bots, „+" für leere Slots), Name, Status-Badge
  („Du/Freund/Bot/Leer"), die gewählte **Farbe als leuchtende Oberkante + Rahmen**
  und Aktions-Buttons. Gleicher Arcade-/Bühnen-Look wie das Menü.
- **Slot-Regeln** (`lobbyState.slots`, Typen `self`|`local`|`friend`|`bot`|`empty`):
  - **P1 ist immer man selbst** (`self`): angemeldet der Username, sonst „Gast".
    Nicht entfernbar — nur die **Farbe** ist änderbar.
  - **P2–P4** sind frei: **Leer**, **2. Spieler** (`local`), **Freund** oder
    (indirekt über den Footer-Stepper) **Bot**. Auswahl über ein kleines
    Arcade-Popup über der Karte (`openSlotPicker()`), nicht per `alert()`.
  - **Couch-Koop:** höchstens **ein** `local`-Slot gleichzeitig — die Option
    ist im Popup deaktiviert, sobald es schon einen gibt. `local` steuert mit
    **Pfeiltasten**, während P1 bei **WASD** bleibt (`isLocal:true` +
    `keys:'arrows'` in `buildMatchConfig()`, s. Abschnitt „Couch-Koop").
  - **Gast-Regel:** Ohne Konto sind im Platz-Popup nur **Leer/2. Spieler**
    erlaubt. Die Freund-Option ist sichtbar, löst aber den Toast „Melde dich
    an, um Freunde einzuladen." aus. Alle Freundes-Funktionen sind über
    `isOnlineAllowed()` gegated. **Online-Sessions per Code (🌐-Knopf) sind
    davon ausgenommen** — Hosten und Beitreten per Code funktioniert auch als
    Gast, nur die Freundes-basierte Einladung braucht ein Konto (siehe
    Abschnitt „Online-Sessions").
  - **Angemeldet:** „Freund einladen" im Platz-Popup lädt über die bestehende
    `Auth.getFriendOverview()` **nur akzeptierte** Freunde in dieselbe
    Popup-Ansicht (`openFriendPicker()`). Keine Freunde → Empty-State
    „Noch keine Freunde gefunden." Ein bereits in einem anderen Slot
    eingeladener Freund ist deaktiviert/markiert (**keine Doppelauswahl**).
    **Wichtig:** Das ist weiterhin der alte, rein lokale Weg ohne Netzbezug
    (der Slot bleibt lokale Deko, bewegt sich im Spiel nicht) — für eine
    ECHTE Online-Einladung gibt es seit v0.20.0 den separaten 🌐-„Online"-
    Knopf im Lobby-Footer mit eigenem Freund-Einladen (`openOnlineFriendPicker()`,
    sendet echt über `NetSession.sendInvite()`). Peer-Slots aus einer
    laufenden Online-Session (Typ `friend` **mit** `peerId`) sind in der
    Karte nicht mehr über „Ändern" editierbar (Status-Badge „Online" statt
    „Freund") — sonst holt die nächste Presence-Synchronisation eine
    „entfernte" Person sofort zurück. Ein `friend`-Slot **ohne** `peerId`
    (aus dem alten Platz-Popup) bleibt wie bisher rein lokale Deko ohne
    Netzbezug — siehe „Online-Sessions" für den Unterschied.
- **Bot-ANZAHL statt Pro-Bot-Schwierigkeit (Footer-Stepper):** Bots werden
  nicht mehr manuell pro Slot hinzugefügt, sondern über „🤖 Bots: − N +" im
  Footer geregelt (`adjustBotCount()`/`setBotCount()`). Der Stepper füllt/leert
  automatisch freie Slots und klemmt auf `[minBotCount(), maxBotCount()]` —
  siehe „Mindestens 3 Spieler" unten. Bots bekommen weiterhin einen
  zufälligen Namen aus **`BOT_NAMES`** (300 Namen, `getRandomBotName()`, ohne
  Dopplung) und eine zufällige Farbe (`getRandomFreeColor()`); die
  Bot-Card behält „🎲 Neuer Name" zum Neu-Würfeln.
  - **Schwierigkeit ist nicht mehr in der Lobby einstellbar.** Jeder Bot
    bekommt sie **zufällig pro Match** (`randomBotDifficulty()` in
    `buildMatchConfig()`, weiterhin nur Mittel/Schwer, nie Leicht) — dieselbe
    Lobby-Konfiguration kann also von Match zu Match unterschiedlich starke
    Bots ergeben.
- **Mindestens 3 Spieler insgesamt** (Menschen + Bots), höchstens 4 Plätze:
  `minBotCount() = max(0, 3 − Menschen)`, `maxBotCount() = 4 − Menschen`.
  Verlässt ein Mensch die Lobby (Slot auf „Leer") oder wird ein Bot manuell
  geleert, ruft `ensureBotCount()` automatisch `setBotCount()` auf und füllt
  wieder auf. `startSeries()` prüft die Regel zusätzlich als Sicherheitsnetz.
- **Farbauswahl** (`openColorPicker()`, feste Palette `LOBBY_COLORS`: Rot, Blau,
  Grün, Gelb, Lila, Orange, Cyan, Pink). Nur für **Menschen** (P1, 2. Spieler,
  Freunde — `isHumanSlot()`) — Bots erscheinen nicht im Picker. Popup mit
  Farbfeld **+ Name** je Farbe:
  - Jeder aktive Slot hat eine Farbe (Menschen via `getNextFreeColor()`, Bots
    zufällig via `getRandomFreeColor()`).
  - **Von Menschen** belegte Farben sind für andere Menschen **gesperrt** —
    deutlich mit **✕** überlagert und deaktiviert, aber sichtbar. Die aktuell
    gewählte Farbe trägt ein **✓** + Glow.
  - **Bots werden verdrängt:** Wählt ein Mensch eine Farbe, die gerade ein Bot
    hat, wechselt der Bot automatisch auf die nächste freie Farbe
    (`resolveColorConflicts()`, mehrere Bots ohne Dopplung). Beispiel: Bot P2
    hat Rot, P1 wählt Rot → P1 bekommt Rot, P2 rückt z.B. auf Blau, UI
    aktualisiert sofort. Ist **keine** freie Farbe mehr da → Toast
    „Keine freie Farbe verfügbar."
- **Lobby-Aktionen** (Footer): „← Zurück" (→ Menü), Bot-Stepper, „↺ Lobby
  zurücksetzen" (`resetLobby()` — Slots 2–4 auf Leer, P1 bleibt, danach wieder
  mit Bots auf Minimum aufgefüllt) und „Spiel starten" (`startSeries()` — die
  echte Party-Serie über alle Minigames, s. „Party-Serie & Gesamt-Ranking").
- **Tastatur (ohne Maus):** Die Lobby ist in `setupKeyboard()` eingehängt und
  navigiert über **feste navIds** (`buildLobbyNav()`, bei jedem `renderLobby()`
  neu erzeugt): ↑/↓ wechselt innerhalb einer Karte, ←/→ zur Nachbarkarte,
  unten führt ↓ in die Fußzeile. Der Bot-Stepper sitzt als **zwei echte
  Knöpfe** (`lobby_botsMinus`/`lobby_botsPlus`) zwischen „Zurück" und
  „Zurücksetzen" — bewusst keine ←/→-Wertverstellung wie früher beim
  Schwierigkeits-Knopf, damit die Fußzeile durchgängig mit ←/→ navigierbar
  bleibt. Die **Popups** (`#slotPicker` / `#colorPicker`) haben **Vorrang** im
  Container-Cascade und nutzen die geometrische `moveFocus()` — der Fokus
  bleibt im Popup, springt nicht in die Lobby/das Menü dahinter. **Esc**
  schließt erst ein offenes Popup, sonst geht es von der Lobby zurück ins
  Menü. Enter/Leertaste lösen aus, alle Karten-/Popup-Elemente sind echte
  `<button>`.

### Couch-Koop (2. lokaler Mensch)

- Ein zweiter Mensch kann am selben PC mitspielen, ohne Konto oder
  Netzwerk — Lobby-Slot-Typ `local` (siehe oben). P1 steuert mit **WASD**,
  der 2. Spieler mit **Pfeiltasten**. Das ist ein bewusster **Breaking
  Change**: vorher steuerten WASD UND Pfeiltasten gleichwertig P1 alleine;
  Solo-Spielen geht jetzt nur noch mit WASD.
- Technisch trennt `LocalHumanController(layout)` in `renderer/game/
  controllers.js` die beiden Tastensätze auf zwei unabhängige Instanzen —
  jede hört global auf `window`, ignoriert aber Tasten außerhalb des eigenen
  Layouts (`mapKey(key, layout)`). Beide Spielkerne reichen dafür nur ein
  zusätzliches Feld durch: `new LocalHumanController(p.keys || 'wasd')`
  (`block-bomb/main.js`/`laser-lines/main.js`, `_initPlayers()`).
  `buildMatchConfig()` setzt `keys: 'arrows'` für den `local`-Slot, sonst
  `'wasd'`. Der Tutorial-Schnellstart (immer nur 1 Mensch) ist unberührt.
- **Responsiv & scrollfrei:** Eigene Regeln in den Kompakt-Stufen
  (`@media max-height: 900px / 680px`) verkleinern Karten/Avatare; sieht in
  Vollbild, 1280×800 und 960×640 gut aus, Scrollbalken bleiben unsichtbar.

### Online-Sessions (Host-autoritativ, seit v0.20.0)

Transport, Protokoll und Netcode-Details stehen ausführlich im
Änderungsprotokoll-Eintrag v0.20.0 oben — hier nur der Überblick als
Einstiegspunkt für „wie geht das jetzt".

- **Einstieg:** 🌐-„Online"-Knopf im Lobby-Footer (`#onlinePicker`, JS in
  `app.js`). Zwei Wege zum Beitreten: **Session-Code** eintippen (funktioniert
  auch als Gast, kein Konto nötig) oder eine **Freundes-Einladung** annehmen
  (`#inviteOverlay`, braucht ein Konto — `isOnlineAllowed()`).
- **Host:** sieht seine normale Lobby, in der beigetretene Peers automatisch
  einen Bot- oder Leer-Slot belegen (Status-Badge „Online"). Startet die
  Serie ganz normal über „Spiel starten".
- **Gast:** sieht statt der editierbaren Lobby einen Warteraum (Spiegel des
  Host-Stands), tritt dem eigentlichen Match automatisch bei, wenn der Host
  startet, und steuert seine Figur normal — die Bewegung wird aber vom Host
  simuliert, der Gast rendert nur, was ankommt (kleine Eingabelatenz, keine
  Client-Prediction in v1).
- **Verbindung verloren:** in der Lobby-Phase wird der Slot einfach frei
  (Bots füllen automatisch nach); mitten im Match übernimmt ein Bot die
  Figur, ohne das Match zu unterbrechen.
- Modul: `renderer/net/session.js` (`NetSession`). Transport: Supabase
  Realtime Broadcast + Presence, keine neuen Tabellen.

### App-Icon

- Eigenes Marken-Icon: ein eigenständiger **goldener Arcade-Power-Block mit
  „B"** (Stern-Akzent, Highlight, Eck-Studs, dicke dunkle Kontur, Glow) —
  bewusst **kein** Mario-?-Block.
- Assets in `renderer/assets/`: `block-icon.svg` (bearbeitbare Quelle),
  `block-icon.png` (256×256, aus dem Design gerendert) und `block-icon.ico`
  (PNG im ICO-Container für Windows/Taskleiste).
- Eingebunden in `main.js`: `BrowserWindow`-`icon`-Option (auf Windows die
  `.ico`, sonst die `.png`) plus `app.setAppUserModelId('com.blockdrop.blockgames')`,
  damit Windows Fenster und Taskleisten-Icon sauber dem Spiel zuordnet.
- Für späteres Packaging vorbereitet: `build`-Block in `package.json`
  (electron-builder-Konvention, referenziert das Icon) — **keine neue
  Dependency** installiert.

### Tastatur-Bedienung

**Grundsatz: Die ganze App ist ohne Maus bedienbar** (siehe Grundregeln).
Zentraler Handler `setupKeyboard()` in `app.js`.

- **Navigation per Pfeiltasten ODER WASD**, **Enter/Leertaste** löst aus,
  **Esc** geht zurück. Es ist **immer genau ein Element fokussiert**; an einem
  Rand, an dem es in die gedrückte Richtung kein Ziel gibt, **bleibt der Fokus
  stehen** (springt nie ins Leere).
- **Feste navId-Navigation (Hauptmenü + Lobby):** Diese beiden Screens laufen
  **nicht** über die DOM-Reihenfolge/Geometrie, sondern über eine feste Tabelle.
  Jedes Element trägt eine `data-nav`-ID (z.B. `main_play`, `main_coinGrab`,
  `lobby_p1_color`, `lobby_botsMinus`); `NAV_MENU` (statisch) bzw.
  `buildLobbyNav()` (dynamisch, weil die Karten je nach Slot-Typ andere Knöpfe
  haben) sagen pro Richtung das Ziel. **Start-Fokus:** Hauptmenü → „Spielen",
  Lobby → „P1 · Farbe". Das Hauptmenü **merkt sich das zuletzt fokussierte
  Element** (`menuFocusNav`) und stellt es beim Zurückkehren wieder her
  (`goToMenu()`).
- **Geometrische Navigation (`moveFocus()`) als Fallback** für Screens ohne
  navIds: **Auth-Screen (Login/Registrierung)**, **Lobby-Popups** (Slot-/Farbwahl,
  mit Vorrang), Credits, **Konto/Freunde-Overlay** und Beenden-Dialog. Sie wählt
  zuerst die **nächste Reihe/Spalte** in Pfeilrichtung („Bande" ≈ halbe
  Elementgröße) und erst darin die geringste seitliche Abweichung (Gleichstand →
  DOM-Reihenfolge). Offene Overlays/Popups haben Vorrang; neue Screens werden in
  die Container-Auswahl von `setupKeyboard()` eingehängt.
- **Eingabe-Delay (`navThrottled()`):** Eine bewusste Einzel-Eingabe wird immer
  ausgeführt; nur die Auto-Wiederholung einer **festgehaltenen** Taste wird auf
  90 ms gedrosselt (kein „Durchrutschen" des Fokus). **Sound** beim Fokuswechsel
  (`Sfx.play('hover')`).
- **W/A/S/D** wirken wie ↑/←/↓/→ — **außer in Textfeldern**, dort tippen sie
  normal (sonst ließe sich kein Name mit „w" o.ä. eingeben). In Textfeldern
  navigiert man mit den echten Pfeiltasten (hoch/runter) bzw. **Tab**.
  Tastenkombis (Strg/Alt/⌘ + Taste) werden nie als Navigation gedeutet.
- **Bedienelemente:** Hoch/Runter springt immer zwischen den Zeilen. Die
  **waagerechte** Pfeilbewegung behält ihre native Aufgabe — **←/→ verstellt
  Regler, wechselt die Auswahl (Select) und bewegt den Text-Cursor**;
  **Leertaste** schaltet Schalter (Checkbox). So ist jede Option erreichbar
  und änderbar, ohne die Maus.
- **Login/Registrierung:** Der Cursor steht beim Öffnen direkt im ersten Feld
  (`showAuth()`). Der Fokus auf einen Reiter (per Pfeil/WASD) schaltet das
  Formular sofort um (`focus`-Aktivierung wie bei den Einstellungs-Reitern).
- **Einstellungen (deterministische Navigation, `handleSettingsKey()`):** In den
  Einstellungen gilt NICHT die geometrische Navigation, sondern eine klare
  Reiter-/Options-Logik (zuverlässiger, besonders nach dem Verstellen einer
  Option):
  - **Auf einem Reiter:** ←/→ (bzw. A/D) wechselt den Reiter; **↓ oder Enter**
    springt in die erste Option (Schalter/Auswahl/Regler).
  - **Auf einer Option:** ↑/↓ wechselt die Option; an der **obersten Option
    bringt ↑ zurück zum Reiter** — von dort wechselt ←/→ wieder die Reiter.
    ←/→ auf einer Option bleibt native (Regler verstellen / Auswahl wechseln).
  - Back/Reset im Header bleiben per **Tab** erreichbar (Tab ist nicht belegt).
  - Die gerade angesteuerte Option wird **deutlich gelb markiert**: gelber Balken
    + gelbe Schrift auf der Zeile (`.setting-row:focus-within`), beim Lautstärke-
    Regler zusätzlich gelber, vergrößerter Griff. Der aktive Reiter selbst trägt
    gelbe Schrift + gelbe Unterkante.
- Sichtbarer Fokus nur bei Tastatur-Bedienung (`:focus-visible`): kräftiger
  gelber Rahmen **+ Glow** und leichtes **Skalieren** des fokussierten Elements
  (große Karten/Play-Buttons behalten ihren eigenen Effekt). Mausklicks erzeugen
  keinen Ring.
- **Esc**: schließt das offene Overlay (Beenden / Konto) bzw. führt von den
  Einstellungen **oder der Credits-Seite** zurück ins Menü.
- **F5/F6 — Match-Abbruch-Abstimmung:** einzige Ausnahme von „alles läuft über
  Fokus/Container" — wirken global, sobald `#mgAbortVote` offen ist, unabhängig
  davon, was gerade fokussiert ist (das Panel selbst ist bewusst fokuslos, s.
  Abschnitt „Match-Abbruch per Abstimmung"). **F5** = Ja, abbrechen, **F6** =
  Nein, weiterspielen.
- **Couch-Koop (2 lokale Menschen):** nur die **Spielfigur-Bewegung** im
  laufenden Match ist pro Spieler getrennt (P1 WASD, 2. Spieler Pfeiltasten,
  siehe `LocalHumanController`-Layout) — alle Menüs/Overlays bleiben über die
  normale, geteilte WASD-ODER-Pfeiltasten-Navigation bedienbar.

### UI / Design
- Arcade-Party-Look: Impact-Schriftzug mit Versatz-Schatten **und Glow**,
  dunkle Bühne mit **bewegten Spotlights** (`#stageLights`), Punktraster,
  schwebenden **3D-Blöcken und Würfeln** (`#bgBlocks`, Würfel als Masken aus
  `assets/cube.svg`) und **funkelnden Sternen** (`#bgStars`, Maske aus
  `assets/star.svg`). Block-Farben (rot/gelb/grün/blau/lila) als Akzente auf
  Minigame- und Credit-Karten, gestaffelte Einblend-Animationen.
- **Hauptmenü-Politur (v0.5.0):**
  - Großer Logo-/Titelbereich im Header: glühender „BLOCK GAMES"-Schriftzug
    mit Pop-In plus Untertitel-Chip „★ Party Arcade ★".
  - Primärer **„Spielen"-Button**: Verlauf, Gloss-Overlay, wandernder
    Glanz-Sweep, Hover-Wackeln (`partyWobble`), hüpfendes Würfel-Icon,
    gleitender Play-Pfeil.
  - **Minigame-Karten** wie kleine Arcade-Spieltafeln: eigene Akzentfarbe,
    glühende Akzentleiste, Icon in akzentfarbener Gloss-Kachel, beim Hover
    Lift + leichter Tilt + Akzent-Glow. Karten bleiben echte `<button>`
    (Tastatur-Fokus); gesperrte sind `disabled` und werden übersprungen.
  - Gast-Hinweisband aufgewertet (Icon-Chip + Glanz), **Funktion unverändert**
    (per `.hidden` anhand des Gast-Status).
  - Beenden-Knopf hebt sich beim Hover rot ab, Zahnrad dreht sich (gelb).
- Nur Systemfonts (Impact, Segoe UI) — die App braucht fürs UI kein Internet.
- **Kein Scrollen, keine Scrollbalken:** Das Layout schrumpft bei flachen
  Fenstern über zwei Kompakt-Stufen (`@media (max-height: 820px / 680px)`),
  damit alles ohne Scrollen passt. Falls bei Mini-Fenstern doch gescrollt
  werden muss (Auth, Menü, Einstellungen als Fallback), sind die
  Scrollbalken app-weit unsichtbar (`scrollbar-width: none` +
  `::-webkit-scrollbar { display: none }`) — Mausrad funktioniert weiter.
- Überlappungsschutz: Header bricht bei schmalen Fenstern um
  (`flex-wrap`), lange Usernamen werden mit `…` abgeschnitten.
- Kurze Hinweise laufen über einen Toast (unten Mitte) statt `alert()`.

### Sicherheit
- Renderer ist gesandboxt (`contextIsolation`, kein `nodeIntegration`).
- CSP in `index.html` erlaubt Verbindungen nur zum Supabase-Projekt.
- Der Supabase-**Publishable**-Key in `renderer/auth.js` ist bewusst im
  Klartext — gleicher Key wie die Website, RLS schützt die Daten.

## Änderungsprotokoll

### v0.22.1 — 2026-09-17
- **Impeccable-Polish-Durchgang über die ganze App** (Hauptmenü, Einstellungen,
  Credits, Konto-Overlay, Lobby + kurzer Anspieltest in allen drei
  Minigames per Playwright-`_electron`-Rundgang). Drei reale Befunde
  behoben, keine Konsolenfehler:
  - **Toast überlappte das Menü-Footer.** `.toast` war `position: fixed;
    bottom: 36px` — auf `#screen-menu` lag das genau über dem
    Credits-Button/der Versionsnummer im Footer (z.B. sichtbar bei der
    Gast-Modus-„kein Konto"-Meldung). `bottom` auf `96px` angehoben, damit
    der Toast immer oberhalb des Footers schwebt (`renderer/style.css`).
  - **`.credit-card` nutzte einen 5px farbigen `border-left`** als
    einzige Stelle im ganzen Frontend mit diesem Muster — inkonsistent zur
    etablierten Akzent-Sprache der `.minigame-card`s (leuchtender Strich
    oben, per `::before`). `.credit-card` auf dieselbe
    `::before`-Top-Leiste umgestellt statt der Rand-Variante
    (`renderer/style.css`).
  - **Einstellungen/Credits klebten oben im Vollbild-Fenster**, darunter
    bis zu 60–70% reine Leerfläche (Sternenhintergrund) — Fensterhöhe
    1080px, Panel-Inhalt kaum 300px hoch, ohne jeden Bezug zum restlichen
    Screen-Raum. `.settings-panels` (Flex-Spalte, `justify-content:
    center`) und `.credits-grid` (`align-content: center`) zentrieren den
    Inhalt jetzt vertikal im verfügbaren Raum unter Kopfzeile/Reitern,
    statt oben zu kleben (`renderer/style.css`).
  - Verifiziert per Playwright-Rundgang (alle Einstellungs-Reiter, Credits,
    Konto-Overlay, Minigame-Grid, je ein Match in Block Bomb/Block
    Rush/Laser Lines) — keine Konsolenfehler, Screenshots vor/nach
    verglichen.
  - Version auf 0.22.1 (package.json, preload.js).

### v0.22.0 — 2026-09-17
- **Block Rush spielbar (drittes Minigame).** Tricky-Towers-artiges Party-
  Minigame: alle Spieler bauen GLEICHZEITIG, nebeneinander in einer 3D-Szene,
  aus fallenden Teilen einen Turm auf ihrem eigenen Podest. Eigene,
  vereinfachte Kipp-/Kollaps-Simulation statt Physik-Engine (`block-rush/
  tower.js`); wer einstürzt oder überläuft, scheidet sofort aus
  (Last-Man-Standing), bei Zeitlimit gewinnt der höchste/stabilste Turm.
  Vier Spells (Kleber/Wachstum/Erdbeben/Blitzsturz, `block-rush/spells.js`)
  greifen ins eigene oder gegnerische Spiel ein. Keine Line-Clears in v1 —
  der Turm wächst nur.
  - Neue Dateien `renderer/block-rush/{main,pieces,tower,maps,spells,bots}.js`
    + `renderer/block-rush.css`; folgt demselben Aufbau wie Block Bomb
    (Steuerungs-Abstraktion, Lobby-Farben = Spielerfarben, 3 Maps + Voting:
    Ruhige Halle/Sturmklippe/Wackelplattform).
  - **Neuer Controller-Typ, weil kein `{x,z}`-Bewegungsintent passt:**
    `LocalPieceController` (`renderer/game/controllers.js`) liefert pro Frame
    einen Ereignis-Zähler (`{dx,rot,hard,cast,cycle,soft,seq}`) statt eines
    Zustands, hört auf `e.code` (QWERTZ-fest) und regelt Links/Rechts per
    DAS/ARR selbst. `RemoteController` bekommt dafür einen optionalen
    zweiten Konstruktor-Parameter `adapter` (`initial/merge/drain`) — ohne
    Adapter unverändertes Verhalten für Block Bomb/Laser Lines. Grund:
    das bestehende 20-Hz-Polling (`getMyInput()`) würde bei einem reinen
    Zustands-Intent Drehungen/Hard-Drops zwischen zwei Abfragen verschlucken.
  - Eigene Bot-KI in `block-rush/bots.js` (`makeBlockRushBotBrain`).
  - Vier neue Soundeffekte in `renderer/audio.js` (`rushLock`, `rushCollapse`,
    `rushSpell`, `rushWin`).
  - Verdrahtet wie Block Bomb/Laser Lines: `MINIGAMES`-Eintrag +
    `GAME_REGISTRY['block-rush']` (`renderer/app.js`), Screen
    `#screen-block-rush`/`#rushStage` + CSS-Link + Modul-Script
    (`renderer/index.html`). Läuft über denselben generischen Match-Flow
    (Tutorial-Schnellstart, Lobby/Serien-Modus, Online-Snapshot/Input) ohne
    Sonderfälle.
  - Verifiziert per Playwright (`_electron`): Tutorial-Match startet,
    Tastatursteuerung (links/rechts/drehen/softdrop/hard-drop/cast/cycle)
    reagiert, Türme rendern, Bot-Kollaps löst Ausscheiden aus, Ergebnis-
    Screen zeigt korrekten Sieger — keine Konsolenfehler.
  - Version auf 0.22.0 (package.json, preload.js).

### v0.21.0 — 2026-09-17
- **Update-Check vor dem Login.** Beim Start fragt der Hauptprozess
  (`main.js`, IPC `update:check`) einmalig `GET /repos/IchPity/Block-Drop/
  releases/latest` der GitHub-API ab (5s-Timeout via `AbortController`, jeder
  Fehler — kein Internet, noch kein Release, Rate-Limit — fällt still auf
  „kein Update" zurück, blockiert den Start nie). `tag_name` wird gegen die
  eigene `package.json`-Version verglichen (`isNewerVersion()`, simpler
  Zahlen-Vergleich statt einer semver-Library, reicht für `MAJOR.MINOR.PATCH`
  -Tags wie `v0.21.0`).
  - Neuer Screen `#screen-update` (`renderer/index.html`, gleicher Auth-Karten-
    Look) erscheint — falls eine neuere Version gefunden wurde — nach dem
    Lade-Screen und VOR Login/Menü (`checkForUpdate()` in `app.js`, awaited
    in `boot()` vor `Auth.init()`). Zwei Aktionen: **„Jetzt herunterladen"**
    öffnet die Release-Seite im Standardbrowser (`shell.openExternal` in
    main.js, IPC `update:open` — whitelisted auf `github.com/IchPity/
    Block-Drop`-URLs), **„Später"** führt normal weiter. Esc = „Später".
  - Kein Auto-Download/-Install — dafür fehlt noch die Publish-Pipeline
    (`electron-builder`, s. ROADMAP „Verteilung/Download"). Der Check findet
    erst etwas, sobald auf GitHub ein Release veröffentlicht wird (Tag
    `vX.Y.Z` + „Release erstellen", nicht nur ein `git tag`).
  - `preload.js` reicht `checkForUpdate()`/`openUpdateUrl()` an den Renderer
    durch. Version auf 0.21.0 (package.json, preload.js).

### v0.20.0 — 2026-09-17
- **Online-Sessions (host-autoritativ) — echte Netz-Anbindung, kein Stub
  mehr.** Schließt den ROADMAP-Abschnitt „Online-Spiel über verschiedene
  Netzwerke" ab. Kandidat war Supabase Realtime, ist es geworden — Broadcast
  + Presence, **keine neuen Tabellen**.
  - **Transport (`renderer/net/session.js`, neu):** `NetSession` (globales
    Objekt wie `Auth`/`Settings`/`Sfx`). Ein Sitzungscode (6 Zeichen, ohne
    `0/O/1/I`) identifiziert den Channel `blockgames:session:<CODE>`; jeder
    Teilnehmer trackt sich per Presence (`peerId` = eigene User-ID, sonst
    eine zufällige Gast-ID). Nachrichten laufen als ein Broadcast-Event `msg`
    mit `{type, payload, from}`, damit `NetSession.on(type, handler)`
    generisch dispatchen kann. `Auth.client`-Getter (neu in `auth.js`) reicht
    den bisher modul-privaten Supabase-Client nach außen, weil `session.js`
    denselben Client (und dieselbe Auth) für seine Channels braucht.
  - **Beitritt: Freundes-Einladung UND Session-Code.** Jeder angemeldete
    Client abonniert `blockgames:user:<userId>` (`listenForInvites()`); eine
    Einladung öffnet kurz den Ziel-Channel, sendet und schließt wieder
    (`sendInvite()`). Das lange vorbereitete `#inviteOverlay` (UI + Tastatur
    + Warteschlange standen schon seit v0.5.0) ist damit endlich echt
    verdrahtet — `acceptInvite()` tritt jetzt wirklich der Session bei statt
    nur einen Toast zu zeigen. Alternativ: Code eintippen im neuen
    🌐-„Online"-Lobby-Popup (`#onlinePicker`).
  - **Lobby-Sync:** Der Host broadcastet seinen `lobbyState` bei jedem
    `renderLobby()` (`broadcastLobbyState()`); neue Peers werden per
    Presence automatisch einem Bot- oder Leer-Slot zugewiesen
    (`assignPeerSlot()`, Typ `friend` + echtes `peerId`) und die Bot-Anzahl
    passt sich automatisch an (`ensureBotCount()`). Verlässt ein Peer die
    Lobby-Phase, wird sein Slot frei und wieder mit Bots aufgefüllt
    (`freePeerSlot()`). Peer-Slots sind in der Host-UI **nicht** editierbar
    (kein „Ändern"/Farbe) — sonst holt die nächste Presence-Synchronisation
    eine „entfernte" Person sofort zurück; Trennen geht nur über 🌐 Online.
    Ein Gast sieht statt der editierbaren Lobby einen reinen Warteraum
    (`renderGuestWaitingRoom()`, gespiegelt aus dem Host-Broadcast) — „← Zurück"
    heißt für ihn „✕ Verbindung trennen".
  - **Host-autoritative Simulation.** Beide Spielkerne (`block-bomb/main.js`,
    `laser-lines/main.js`) bekommen ein `role: 'host'|'guest'` in `start()`.
    Host simuliert wie bisher UND liefert `getSnapshot()` (Position/Facing/
    Flags/Extra pro Spieler, gerundet, ~20 Hz von app.js gepollt). Gast
    überspringt Physik/Kollision/Spielregeln komplett (`_stepReplica()`) und
    zieht die Figuren nur weich zum letzten `applySnapshot()`-Stand nach
    (~80 ms Angleichung) — **keine Client-Prediction in v1**, spürbar als
    kleine Eingabelatenz beim Gast. Der eigene Intent des Gasts wird trotzdem
    lokal berechnet (`getMyInput()`, denselben `LocalHumanController` wie
    sonst) und ~20 Hz an den Host gesendet, der ihn per `feedRemoteInput()`
    an den passenden `RemoteController` weiterreicht — `RemoteController`
    wird dafür jetzt mit der echten `peerId` statt der Lobby-Slot-Id
    konstruiert. Ergebnis + Zwischen-/Gesamt-Ranking laufen über den
    bestehenden generischen Flow: der Host broadcastet `result`, der Gast
    ruft **dieselbe** `onGameResult()` lokal auf — dadurch bleiben
    `seriesIndex`/`seriesStandings` bei allen identisch, ohne Sonderpfad.
  - **Bekannte v1-Einschränkungen (bewusst, siehe ROADMAP für „später"):**
    Online-Mitspieler stimmen beim Map-Voting weiterhin **zufällig** ab wie
    Bots (keine eigene Gast-Abstimmungs-UI); die **Match-Abbruch-Abstimmung**
    zählt Online-Mitspieler noch **nicht** mit (nur lokale Menschen, s.u.);
    **keine Client-Prediction**; **keine Host-Migration** — fällt der Host
    aus, endet die Session für alle Gäste; höchstens **4 Spieler gesamt**
    (Host + 3), da Lobby und Maps auf 4 Plätze ausgelegt sind.
  - **Verlorene Verbindung mitten im Match → Bot übernimmt.** Neue Methode
    `convertToBot(peerId)` in beiden Spielkernen tauscht nur den Controller
    (Figur/Position/HUD bleiben unverändert); ausgelöst, sobald die Presence
    des Peers verschwindet, während `inSeries` läuft
    (`handlePeerDisconnectMidMatch()`). In der Lobby-Phase (nicht `inSeries`)
    wird der Slot stattdessen einfach frei (`freePeerSlot()`).
  - Zwischen-/Gesamt-Ranking: In einer Online-Session entscheidet **nur der
    Host**, wann's weitergeht — ein Gast-Klick auf „Weiter"/„Nochmal"/„Zur
    Lobby" ist ein No-op mit Toast („Nur der Host kann das."), sonst würden
    `seriesIndex` bei Host und Gast unabhängig verändert und auseinanderlaufen.
    „Zum Menü" bleibt für den Gast ein persönlicher Rückzug (verlässt nur die
    eigene Teilnahme, die Serie läuft für die anderen weiter).
  - **Verifiziert per Playwright, zwei echte Electron-Instanzen** (getrennte
    `--user-data-dir`, echtes Supabase-Realtime-Netzwerk, kein Mock): Hosten +
    Beitreten per Code, Peer-Zuweisung + Lobby-Sync, Serie starten mit
    korrektem Rollen-Split, Snapshot/Eingabe-Austausch, identisches Ranking
    auf beiden Seiten nach einem Ergebnis, Slot-Freigabe beim Verlassen der
    Lobby-Phase, Bot-Übernahme bei Verbindungsverlust mitten im Match.

### v0.19.0 — 2026-09-16
- **Lobby: nur noch Bot-ANZAHL statt Pro-Bot-Schwierigkeit, immer mindestens
  3 Spieler.** Der ⚙️-Grad-Knopf pro Bot-Karte ist weg; Bots bekommen ihre
  Schwierigkeit (Mittel/Schwer, weiter nie Leicht) jetzt zufällig **pro
  Match** zugewiesen (`randomBotDifficulty()` in `buildMatchConfig()`), nicht
  mehr pro Slot in der Lobby. Stattdessen regelt ein neuer Footer-Stepper
  („🤖 Bots: − N +") die **Anzahl**: er klemmt automatisch auf
  `[max(0, 3 − Menschen), 4 − Menschen]` (`minBotCount()`/`maxBotCount()` in
  `app.js`), damit es immer mindestens 3 und höchstens 4 Spieler insgesamt
  gibt. Verlässt ein Mensch die Lobby oder wird ein Bot manuell auf „Leer"
  gesetzt, füllt `ensureBotCount()` automatisch wieder auf.
- **Couch-Koop: zweiter lokaler Mensch am selben PC.** Neuer Lobby-Slot-Typ
  `'local'` (Slot-Picker: „🎮 2. Spieler", höchstens einer gleichzeitig) —
  steuert mit **Pfeiltasten**, während P1 bei **WASD** bleibt.
  `LocalHumanController` (`renderer/game/controllers.js`) nimmt dafür ein
  `layout`-Argument (`'wasd'` | `'arrows'`) und ignoriert Tasten außerhalb des
  eigenen Layouts, statt wie bisher beide Tastensätze gleichwertig auf eine
  Figur zu legen — **Breaking Change:** Solo-Spielen geht jetzt nur noch mit
  WASD, nicht mehr zusätzlich mit den Pfeiltasten. Zwei Instanzen können
  gleichzeitig angehängt sein, ohne sich gegenseitig zu steuern (per
  Playwright-Test verifiziert: `d`/`ArrowUp` bewegen jeweils nur ihre eigene
  Instanz). `buildMatchConfig()` gibt pro Spieler jetzt `keys: 'wasd'|'arrows'`
  mit; beide Minigame-Kerne reichen das 1:1 an den Konstruktor weiter
  (`new LocalHumanController(p.keys || 'wasd')`).
- **Match-Abbruch per Abstimmung.** Im Pausemenü (Esc im Spiel) neuer Knopf
  „Match abbrechen" — öffnet ein kleines, bewusst **nicht blockierendes**
  Fenster am **linken Rand, vertikal zentriert** (`#mgAbortVote`,
  `.mg-abort-vote` in `style.css`): kein Backdrop, kein Fokus-Diebstahl, das
  Match läuft während der Abstimmung normal weiter (Pause wird beim Öffnen
  sofort wieder aufgehoben). Gesteuert ausschließlich über **F5 = Ja,
  abbrechen** / **F6 = Nein, weiterspielen** (beide Tasten waren frei — kein
  Electron-Menü, das sie belegt). Wer die Abstimmung startet, zählt sofort als
  Ja; nur echte Menschen stimmen ab (Bots ignoriert), bei mehreren lokalen
  Menschen gilt der erste Mensch in `currentPlayers` (= P1) als Initiator, die
  übrigen müssen selbst per F5/F6 abstimmen. **15 s ohne Antwort = Nein**
  (verhindert eine hängende Abstimmung). Spielt man nur gegen Bots, läuft
  stattdessen eine **Schein-Abstimmung** (`runFakeAbortVote()`): die Bots
  „stimmen" zeitversetzt ab, das Ergebnis ist immer Ja. Bei Mehrheit Ja endet
  das Match und es geht zurück in die Lobby (Tutorial-Runden, die keine Lobby
  kennen, gehen zurück ins Menü). Per Playwright end-to-end verifiziert:
  Schein-Abstimmung, echte Abstimmung mit Timeout→Nein, echte Abstimmung mit
  F5→Ja→Abbruch.
- **Noch offen (siehe ROADMAP):** echte Online-Sessions (Host lädt bis zu 3
  weitere Spieler ein, `RemoteController` wird tatsächlich gefüttert) sind
  weiterhin **nicht** verdrahtet — nur die lokale Seite (Solo + Couch-Koop)
  dieser Änderung ist umgesetzt.

### v0.18.0 — 2026-09-16
- **Bot-KI Phase 1 — Kern-Modul (`botAI.js`), ohne Adapter-Änderungen:**
  - **Utility-Scoring für Zielwahl:** Neuer, optionaler `decision.candidateGoals`-
    Kanal (`[{id, position, baseValue}]`). Meldet ein Adapter Kandidaten, wählt
    ROAM/CHASE den nach Distanz, gelernter Gefahr und Koordinations-Malus am
    besten bewerteten statt des ersten Treffers. Ohne `candidateGoals` (aktuell
    beide Spiele) unverändertes Verhalten.
  - **Gefahren-Lookahead:** Neuer, optionaler `decision.predictedHazards`-Kanal
    (`[{zone:{x,z,radius}, severity, expiresAt}]`) nach dem Adapter-Contract aus
    Abschnitt 6 des Umsetzungsauftrags. FLEE-Sampling, AVOID_EDGE und die
    allgemeine Gefahren-Abstoßung (`computeDanger`) bewerten künftig auch
    prognostizierte statt nur aktuelle Gefahrenquellen — wird erst mit Phase 2/3
    (Block Bomb: Kettenexplosionen; Laser Lines: Lookahead-Anbindung) aktiv befüllt.
  - **Räumliches Match-Gedächtnis (`memory.js`, neu):** Ergänzt die statischen
    `corner`-Kartentags aus v0.16.0 um echtes Laufzeit-Lernen — steckt ein Bot
    wiederholt fest und wird per Hard-Stuck-Eskalation teleportiert, merkt er
    sich die alte Stelle für den Rest des Matches als Falle (sanfter, mit der Zeit
    abklingender Malus in Zielwahl/Flucht/Teleport-Ziel). Pro Bot-Mover-Instanz,
    dadurch automatisch pro Match frisch.
  - **Leichtgewichtige Bot-Koordination:** Gemeinsames, kurzlebiges Ziel-Claim-
    Register an `world.map` (über ein ganzes Match hinweg dieselbe Instanz,
    anders als `world` selbst). Visiert ein Bot gerade ein Ziel an, das ein
    anderer Bot desselben Matches ebenfalls anvisiert, bekommt es einen leichten
    Malus — verhindert, dass sich Bots auf demselben Wegpunkt stapeln. Kein
    Multi-Agent-Pathfinding.
  - **Verifiziert per Logik- + Adapter-Regressionstest ohne Rendering:** neue
    Kern-Mechanik (Utility-Scoring, Gedächtnis-Markierung, Hazard-Ausweichen,
    Koordination) sowie 200-Frame-Läufe beider **unveränderter** Adapter
    (Block Bomb, Laser Lines) auf allen drei Schwierigkeitsgraden — keine
    Crashes/NaN, bestehendes Verhalten bleibt erhalten.
  - Adapter (`block-bomb/bots.js`, `laser-lines/bots.js`) bewusst **nicht**
    angefasst — folgt getrennt in Phase 2/3 des Umsetzungsauftrags.

### v0.17.0 — 2026-09-15
- **`/impeccable critique` + Fixes auf `renderer/` gelaufen** (Dual-Agent:
  Design-Review + Detektor, isoliert). Score 30/40 → 34/40 ggü. dem letzten
  Lauf vom 2026-09-14. Report archiviert in `.impeccable/critique/`.
  Umgesetzte Punkte:
  - **[P1] Haupt-CTA widersprach der eigenen Funktion:** `#btnParty` zeigte
    „Brettspiel-Modus · bald verfügbar", startete aber voll funktionsfähig
    die fertige Minigame-Serie. Text in `index.html` UND im
    `renderMenu()`-Override (`app.js`, der den HTML-Text zur Laufzeit
    überschreibt) auf „Minigame-Serie starten" geändert — der unfertige
    Brettspiel-Modus wird nicht mehr auf dem auffälligsten Button beworben.
  - **[P2] Settings-Kopfzeile per Pfeiltasten erreichbar:** „Zurück"/
    „Zurücksetzen" waren nur per Tab-Taste erreichbar — eine Ausnahme vom
    sonst durchgängigen Pfeiltasten-Modell, die PRODUCT.mds Prinzip „volle
    Tastaturbedienbarkeit, keine Ausnahmen" verletzte.
    `handleSettingsKey()` (`app.js`) behandelt die beiden Header-Buttons
    jetzt explizit (←/→ wechselt zwischen ihnen, ↓ zurück zum Reiter) und
    Hoch auf dem obersten Reiter springt jetzt zu „Zurück" statt den Fokus
    stehen zu lassen.
  - **[P2] Verlierende Spieler bekamen keine Rückmeldung:**
    `showSingleResult()` (Tutorial-Ergebnis) zeigte nur „{Gewinner}
    gewinnt!"/„Unentschieden!" — nichts für die ausgeschiedene Person. Zeigt
    jetzt zusätzlich die eigene Platzierung („… gewinnt — du bist
    ausgeschieden (Platz N)."), ermittelt über `result.placements`.
  - **[P3] Icon-only-Buttons ohne `aria-label`:** ⚙️/⏻/←(×2)/✕ hatten nur
    `title`, jetzt zusätzlich `aria-label` mit demselben Text.
  - **[P3] 12 Detektor-Funde `gpt-thin-border-wide-shadow` einzeln
    durchgesehen** (nicht pauschal freigegeben): alle betroffenen Stellen
    (`.auth-card`, `.player-badge`, `.minigame-card`, `.lobby-popup-card`,
    `.overlay-card`, Toast) nutzen konsequent echten Y-Offset (14-24px) +
    weichen Blur (18-70px) auf Schwarz — das ist die im Projekt etablierte
    Karten-Elevation, kein Zero-Offset-Glow-Slop. Als `ignore-value` auf
    `renderer/style.css` festgehalten. Die 1 Fund `repeating-stripes-gradient`
    sind Map-Vote-Thumbnails, die die echte 3D-Kartengeometrie (Laser-
    Streifen/Brücken) in Miniatur abbilden — ebenfalls als `ignore-value`
    auf `laser-lines.css`/`block-bomb.css` festgehalten.
    Nebenbefund: der Detektor meldet Funde in `style.css`/`laser-lines.css`/
    `block-bomb.css` fälschlich als `index.html:0` — Tool-Attributionsfehler,
    kein Design-Problem (nicht behoben, liegt außerhalb dieses Projekts).
  - **Bewusst offen gelassen** (nicht Teil der Fix-Liste, für später notiert):
    fehlende `role="dialog"`/`aria-modal` auf Overlays, unverifizierter
    `--text-dim`-Kontrast, redundante „Melde dich an…"-Texte auf zwei
    Screens.

### v0.16.0 — 2026-09-15
- **Bot-KI deutlich klüger (Block Bomb + Laser Lines), Fokus: Sackgassen und
  Fangen/Entkommen.** Alle Änderungen bleiben innerhalb der Fairness-Regel
  (gleiche Geschwindigkeit, nur sichtbare Infos) — keine neuen Cheats, nur
  bessere Entscheidungen.
  - **`'corner'`-Waypoint-Tag endlich genutzt** (`game/bots/waypoints.js`,
    `game/bots/botAI.js`): Die Maps markieren Sackgassen-Zonen mit nur einem
    Fluchtweg (Sky-Plattformen-Ecken, Fabrikecken) schon lange als `'corner'`
    — bisher hat kein Bot-Codepfad das Tag gelesen. Jetzt sanfter Malus (kein
    harter Ausschluss, da auf manchen Karten fast nur Eck-Plattformen als
    „sicher" getaggt sind) sowohl bei der Fluchtziel-Wahl
    (`safestWaypoint()`, neu wiederverwendbar mit `threatPoints` statt nur
    `dangerFn`) als auch bei der Kurzstrecken-Ausweich-Abtastung
    (`chooseEscapeDirection()` → neue `cornerRisk()`-Funktion). Flüchtende
    Bots suchen jetzt aktiv die offene Mitte statt sich in die Ecke zu
    drängen.
  - **`computeFleeDesired()` überarbeitet** (`botAI.js`): blendet jetzt den
    bedrohungsbewussten `safestWaypoint()`-Zielpunkt ein statt eines simplen
    „nächster safe-Tag, falls weiter vom Verfolger entfernt"-Fallbacks —
    berücksichtigt dabei ALLE Bedrohungspunkte, nicht nur den einen Verfolger.
  - **Vorausschauendere Bomben-Verfolgung** (`block-bomb/bots.js`,
    `computeInterceptTarget()`): der Vorhalt beim Anpirschen/Abfangen skaliert
    jetzt mit der Entfernung zum Ziel — auf Distanz wird stärker auf die
    vorhergesagte Position zugelaufen (mehr Zeit bis zum Zusammentreffen),
    kurz vor dem Ziel nimmt der Vorhalt ab, damit der Bot nicht knapp
    vorbeirennt. Vorher fester Vorhalt-Faktor unabhängig von der Distanz.
  - Verifiziert per Logik-Smoketest (kein Rendering nötig, `bots.js`/
    `botAI.js`/`waypoints.js` sind reine JS-Module): Bot startet auf einer
    Eck-Plattform mit Verfolger im Fluchtradius — Ø-Abstand zur Ecke steigt
    über 10 simulierte Sekunden von 2.16 auf 3.17 (bewegt sich aktiv weg statt
    zu verharren), keine Exceptions/Abstürze in Block Bomb oder Laser Lines.

### v0.15.0 — 2026-09-14
- **PRODUCT.md angelegt** (`/impeccable init`) — Zielgruppe (solo gegen Bots
  UND Couch-Mehrspieler mit Bot-Auffüllung), spätere breitere Verteilung,
  Kernprinzipien (volle Tastaturbedienbarkeit, Controller-Abstraktion,
  Fairness der Bots) als dauerhafter Produktkontext festgehalten.
- **`/impeccable critique` + `/impeccable polish` auf `renderer/` gelaufen**
  (Detektor: 43 Funde; manuelle Design-Review). Ergebnis archiviert in
  `.impeccable/critique/`. Umgesetzte Punkte:
  - **Hauptmenü:** Die 4 „Bald"-Minigame-Karten (Coin Grab, Memory Clash,
    Speed Tap, Quiz Blocks) sind keine eigenen, vollwertigen Karten mehr —
    sie liefen der Wahl auf dem ersten Screen auf 6 Optionen auf, obwohl nur
    2 etwas taten. Jetzt EINE gedämpfte Sammel-Kachel („X weitere in
    Arbeit", `main_soonGames` in `NAV_MENU`/`MINIGAMES`→`UPCOMING_MINIGAMES`
    in `app.js`, `.minigame-teaser` in `style.css`).
  - **Kontrast (WCAG AA):** Neue Tokens `--blue-deep`/`--purple-deep` für
    Flächen mit weißer Schrift (Spieler-Avatar-Verlauf, „Anfragen N"-Chip —
    vorher 2.2:1/3.2:1 statt 4.5:1). `.btn-danger`-Textfarbe abgedunkelt
    (`#3d0606` → `#1a0202`, vorher 4.1:1). `opacity: 0.7` auf
    `.auth-form .hint`/`.account-form .hint` entfernt (vorher ~3.5:1) —
    `--text-dim` allein reicht.
  - **Supabase-Fehlertexte auf Deutsch:** neue `translateError()`-Zuordnung
    (`app.js`) für bekannte Supabase-Fehlermeldungen; rohes Englisch
    („Invalid login credentials" etc.) erscheint nicht mehr in der sonst
    komplett deutschen Oberfläche, unbekannte Fehler zeigen weiter den
    deutschen Fallback-Text statt `error.message`.
  - **Toast-Feedback:** `#toast` hat jetzt `role="status"`/`aria-live="polite"`
    (vorher für Screenreader unsichtbar). Neue Hilfsfunktion `flashInvalid()`
    markiert zusätzlich kurz das betroffene Bedienelement direkt (Shake +
    roter Rand) statt sich allein auf den nach 3.2s spurlos verschwindenden
    Toast zu verlassen — aktuell verdrahtet für „Spiel starten" bei weniger
    als 2 Spielern in der Lobby.
- **Bewusst NICHT verändert:** der dunkle `border-bottom` auf abgerundeten
  Karten/Buttons (3D-Sockel-Optik, `/* 3D-Sockel */`-Kommentare in
  `style.css`) sowie Glow/Bounce-Easing/breite Schatten — beim Review als
  durchgängiges, absichtliches Arcade-Stilmittel erkannt statt als Defekt.
  Als `ignore-value` in `.impeccable/config.json` festgehalten (`side-tab`,
  `border-accent-on-rounded`, `dark-glow`, `bounce-easing`, jeweils auf
  `renderer/index.html` + `renderer/style.css` begrenzt), damit der
  Design-Hook das nicht bei jeder künftigen Änderung erneut anmahnt.
- **Nachgezogen nach erneutem Hook-Fund:** zu weite Buchstabenabstände auf
  Fließtext entfernt (`.credits-made`, `.lobby-slot-no`,
  `.party-btn-text strong`, `.overlay-card h2` — betraf keine
  Großbuchstaben-Label, nur die reguläre `letter-spacing` bei denen). Fehlende
  Zwischenebene in der Überschriften-Struktur behoben: `Platz wählen`/
  `Farbe wählen` (Lobby-Popups) sowie `Anfragen`/`Freunde` (Konto-Overlay)
  sind jetzt `<h2>` statt `<h3>` — jeweils direkt nach dem Screen-`<h1>` ohne
  Zwischenebene, optisch unverändert (Klassen legen `font-size` explizit
  fest).

### v0.14.0 — 2026-06-17
- **Intelligentere Bots (beide Minigames).** Die taktische Entscheidungsebene wurde
  vertieft; Navigation/Fairness-Grundsätze (gleiches Tempo, nur sichtbare Infos,
  Schwierigkeit über Reaktionszeit/Fehlerrate) bleiben. Neue Profilfelder gaten den
  Effekt nach Schwierigkeit — **Easy bleibt absichtlich schwach**.
- **Gemeinsamer Kern** (`renderer/game/bots/botAI.js`): Die FLEE-Bewegung nutzt jetzt eine
  **Sampling-Fluchtrichtung** (`chooseEscapeDirection`) — sie probt mehrere Richtungen,
  bewertet jede nach Abstand zu **allen** Bedrohungen am Probe-Punkt (`threatPoints` +
  optionale `dangerFn`) und verwirft Richtungen über die Kante/in Wände. Dadurch weichen
  Bots seitlich aus statt blind rückwärts. Adapter→Kern-Signale laufen jetzt sauber über
  `decision` (`threatPoints`, `dangerFn`, `preferredWaypoint`, `avoidDirection`) — dabei
  wurde die bislang wirkungslose `avoidDirection`-Verdrahtung repariert. Neuer Helper
  `safestWaypoint` in `waypoints.js`.
- **Laser Lines** (`bots.js`): **Multi-Laser-Ausweichen** über die neue Sampling-Flucht
  (kein Hineinlaufen in den zweiten Laser mehr), **Safe-Zone-Seeking** im ROAM
  (`seekSafe` → `safestWaypoint`) und **Warn-Antizipation** (`warnAnticipation`): starke
  Bots verlassen einen Laser bereits in der sichtbaren Warnphase. Hard-`ignoreChance` auf 0.
- **Block Bomb** (`bots.js`): *Offensiv* drängt der Träger Ziele zur Kante — randnahe Ziele
  werden bevorzugt gewählt und von der sicheren Seite angeflogen (`herding`). *Defensiv*
  fliehen Nicht-Träger kantenbewusst (Sampling-Flucht), **verteilen sich** (nahe
  Mit-Flüchtende als milde Bedrohung) und starke Bots fliehen vor der **vorhergesagten**
  Träger-Position (`anticipation`) bzw. reagieren früher, wenn der Träger zuhält.
- Version auf 0.14.0 (package.json, preload.js).

### v0.13.0 — 2026-06-16
- **Neues Minigame „Laser Lines":** Schnelles 3D-Party-Spiel — Laserlinien fahren/
  rotieren über die Map, Treffer kosten ein Leben (1,5 s Unverwundbarkeit + Blinken +
  Treffer-Vignette/Screen-Shake), bei 0 Leben raus, Last-Man-Standing. Zeitlimit 60 s als
  Fallback (meiste Leben gewinnt). Spielkern in `renderer/laser-lines/` (`main.js` →
  `window.LaserLines`, `maps.js` + `LASER_MAP_META`, `lasers.js`, `bots.js`), Optik in
  `renderer/laser-lines.css`. **3 Maps:** Spin Arena (rotierende Speichen, beschleunigen),
  Factory Grid (achsenparallele Laser mit Boden-Warnlinie, Kisten als Deckung), Sky
  Warning (Warnfelder → Laser; Sturz = 1 Leben + Rücksetzen).
- **Laser-System** (`lasers.js`): Zustände `warning → active → cooldown` (+ persistente
  Speichen), `LaserDirector` spawnt/ramped die Schwierigkeit; faire Warnphase (kein
  Treffer ohne sichtbare Warnung), Glow + Funken (Funken nur ohne `reducedFx`), Kollision
  per Punkt→Segment bzw. Punkt-in-Rechteck.
- **Generischer Minigame-Flow:** Die Match-Orchestrierung in `app.js` ist nicht mehr fest
  an Block Bomb gekoppelt, sondern läuft über eine **Registry** (`GAME_REGISTRY`,
  `windowKey/mapMeta/screenId/stageId`) und **ein gemeinsames Overlay-Set** (`#mgMapVote`/
  `#mgCountdown`/`#mgPause`/`#mgResult`/`#mgRanking`, Styling generisch als `.mg-*` in
  `style.css`). Block Bomb wurde darauf migriert (verhält sich unverändert). Neuer
  Ergebnis-Vertrag `onResult({ winner, placements })`.
- **Party-Serie & Gesamt-Ranking:** „Spiel starten" in der Lobby spielt jetzt **alle
  verfügbaren Minigames in zufälliger Reihenfolge** (`startSeries()`), mit Map-Voting +
  Zwischen-Ranking je Spiel und **Platzierungspunkten** (1.=N … letzter=1). Am Ende ein
  **Gesamt-Ranking**; der Gesamtsieger bekommt eine **Krone in der Lobby**
  (`lobbyCrownSlotId`, verschwindet bei „Lobby zurücksetzen"). Gleichstand → besserer
  Platz im letzten Spiel, sonst zufällig.
- **Gemeinsame Schicht `renderer/game/`:** `BlockCharacter` (mit neuen generischen
  Zuständen `setInvulnBlink`/`setEliminated`) und die Controller (`LocalHumanController`/
  `RemoteController` + generischer `BotController(brain)`) aus `block-bomb/` hierher
  gehoben; beide Spiele teilen sie (kein Duplikat). `block-bomb/characters.js` +
  `block-bomb/controllers.js` entfallen.
- **Tutorial-Schnellstart generalisiert:** Jede Minigame-Karte startet ihr Spiel als
  einzelne Tutorial-Runde (`startTutorial(id)`, P1 + 3 Easy-Bots, zufällige Map). Die
  „Bald"-Karte `block-rush` wurde zur spielbaren **Laser-Lines-Karte** umgebaut
  (`main_laserLines`, Icon 🔺, „Weiche den Lasern aus!"); `NAV_MENU` angepasst.
- **Sounds:** `audio.js` um `laserWarn/laserFire/laserHit/laserEliminate/laserWin/
  laserSpeedUp` erweitert (WebAudio-synthetisiert, Lautstärke über `Settings.effectiveVolume`).
- **Bots:** Laser-Lines-Adapter (`makeLaserBotBrain`) bildet Laser-Verhalten auf die
  bestehenden `botAI.js`-Zustände ab (AVOID_LASER→FLEE, SEEK_SAFE_ZONE/WANDER→ROAM,
  AVOID_EDGE/STUCK_RECOVERY automatisch) — **ohne `botAI.js` zu ändern**.
- Version auf 0.13.0 (package.json, preload.js).

### v0.12.0 — 2026-06-15
- **Tutorial-Schnellstart aus dem „Games"-Bereich:** Klick auf eine Minigame-Karte im
  Hauptmenü startet die Runde jetzt sofort als Tutorial — **ohne Lobby, ohne Bot-Auswahl
  und ohne Map-Voting**. Es spielen **immer 3 Bots** auf dem einfachsten Grad `'easy'`
  (bewusste Ausnahme zur Bot-Regel „immer Mittel/Schwer", damit man das Spiel in Ruhe
  lernt), die Map wird zufällig gewählt.
- **`renderer/app.js`:** Neue Funktionen `buildTutorialPlayers()` (man selbst + 3 Bots,
  zufällige Farben/Namen ohne Dopplung, Format wie `buildMatchConfig()`) und
  `startBlockBombTutorial()` (setzt `bombPlayers` + zufällige `bombMapId` und springt
  direkt in `runCountdown()`). Die Minigame-Karte „Block Bomb" ruft jetzt
  `startBlockBombTutorial` statt `startBlockBomb`. Neues Flag `bombIsTutorial` steuert die
  Ergebnis-Knöpfe: „Nochmal" startet eine neue Tutorial-Runde (neue Random-Map), der
  zweite Knopf heißt „Zum Menü" und führt ins Hauptmenü. `startBlockBomb()` setzt das
  Flag zurück (`false`), sodass der Lobby-/Party-Weg unverändert bleibt.
- Version auf 0.12.0 (package.json, preload.js).

### v0.11.0 — 2026-06-14
- **Wiederverwendbare Bot-KI (State-System):** Neues Modul `renderer/game/bots/botAI.js`
  (erstes Verzeichnis in `renderer/game/` für zukünftige Minigames) mit generischem
  Zustandsautomaten (`CHASE`/`FLEE`/`WANDER`/`STUCK_RECOVERY`), Anti-Stuck-Erkennung,
  Wand-/Ecken-Vermeidung, Steering (weiche Richtungslernp mit `turnSpeed`), und
  optionalem Debug-Modus (`DEBUG_BOTS`). Entfernt die alte reaktions-basierte Jitter aus
  Bots (jx/jz/driftJitter) → nur noch Wander-State nutzt Jitter.
- **`renderer/block-bomb/bots.js` → dünner Adapter:** Delegiert Bewegungs-KI an
  `botAI.js`; behält Block-Bomb-spezifische Logik (Zielwahl mit wrongTargetChance,
  Holder/Non-Holder-Mode, Panik). Neue PROFILES mit `turnSpeed`, `stuckLimit`,
  `wanderJitterAmp/Drift`, `fleeRadius` — Non-Holder fliehen nur, wenn Träger näher als
  `fleeRadius`, sonst `WANDER`.
- **Map-Vorstellung (Kamera-Intro):** Vor Rundenstart kurzer Kamera-Flug von Übersicht
  zu Spielposition (2.2s, easeOutCubic), mit Map-Namen-Overlay (aus `BOMB_MAPS`).
  Spiel-Timer/Bewegung pausiert während Intro, nur Kamera+Rendering+Charakter-Anim
  laufen. Dom-Overlay (`.bomb-map-intro-name`) mit Ein-/Ausblend-Animationen.
- **`renderer/block-bomb/main.js` erweitert:** Neue Felder `introActive/introT/
  introDuration/camOverview/introEl`, Funktionen `_startIntro()`/`_updateIntro()`/
  `_showMapIntro()`/`_hideMapIntro()`; `_loop()` gatet `_step()` während Intro;
  `_animate()` um `!this.introActive &&` ergänzt, damit Kamera-Snap nicht das Intro
  stört; `_world()` um `radius`/`speed` ergänzt (für `botAI.js`'s Stuck-Detection).
  `_updateLabels()` zeigt opt. `p.debug` (State/Stuck) an.
- **`renderer/block-bomb.css`:** `.bomb-map-intro-name` mit Transform/Opacity-Animation,
  `.show`/`.hide`-Klassen.
- Version auf 0.11.0 (package.json, preload.js).

### v0.10.1 — 2026-06-14
- **Bot-KI — Ecken-Stecken & Abgrund-Stürze behoben:**
  - **Sky Platforms (Bug 1):** `steerToSafety()` in `maps.js` neu: Statt kaputtem
    Look-Ahead jetzt Abstands-Gradient. Findet die Plattform mit größtem
    Abstand zum nächsten Rand (`clearance`), zieht Bot sanft Richtung Mitte,
    sobald clearance unter ~1,4 fällt. Verhindert zuverlässig Abstürze in
    den Abgrund — auch bei schnellen Bewegungen über Brücken.
  - **Bots in Ecken (Bug 2):** `think()` in `bots.js` neu: Statt naive Summation
    von Wunschrichtung + Hindernisse + Rand wird jetzt ein Gefahren-Vektor
    berechnet; zeigt Wunsch in die Gefahr, wird nur die tangentiale Komponente
    behalten (Wand-Gleiten statt Festkleben). Bots entkommen sicherer aus
    Nischen und Ecken, wenn sie eingekeilt sind.
  - Beide Änderungen sind geometrisch + physikalisch (keine neuen Konstanten),
    `SPEED`, Schwierigkeit und Fairness unverändert.
- Version auf 0.10.1 (package.json, preload.js).

### v0.10.0 — 2026-06-14
- **Neues Minigame „Block Bomb":** Erstes spielbares Minigame (Bomben-Weitergabe,
  Last-Man-Standing) auf einer Three.js-3D-Blockwelt. Der Lobby-Platzhalter
  `bomb-pass`/`Bomb Pass` wurde zu `block-bomb`/`Block Bomb` umgebaut (`MINIGAMES`,
  `available: true`); `NAV_MENU` entsprechend von `main_bombPass` auf `main_blockBomb`
  umbenannt.
- **Ablauf nach „Spiel starten":** Der Lobby-Start-Knopf ruft `startBlockBomb()` statt
  eines Toasts. Ablauf: Map-Voting (`#bombMapVote`) → 3-2-1-GO-Countdown
  (`#bombCountdown`) → Runde (`#screen-block-bomb`) → Ergebnis (`#bombResult`).
  Map-Voting: echte Spieler wählen, Bots zufällig, Mehrheit gewinnt, Gleichstand
  zufällig.
- **Spielkern als ES-Modul** (`renderer/block-bomb/`): `main.js` (Szene/Renderer/
  Spielschleife mit FPS-Limit + `reducedFx`, Runden-/Bomben-Mechanik, HUD),
  `maps.js` (3 Maps: Bomb Arena, Sky Platforms, Factory Panic), `characters.js`
  (blockige 3D-Figur mit Lauf-/Trag-/Explosionsanimation), `bomb.js` (Bombe mit
  Glut/Funken/Timer), `bots.js` (Verfolgen/Fliehen, Mittel/Schwer, fair),
  `controllers.js` (Steuerungs-Abstraktion Mensch/Bot/Remote). Registriert
  `window.BlockBomb` (`start/pause/resume/stop/isRunning`).
- **Three.js (r160) lokal vendored** (`renderer/vendor/three.module.js`) — kein CDN
  (CSP `default-src 'self'`), offline-fähig. In `index.html` als
  `<script type="module">` eingebunden, plus `block-bomb.css`.
- **Lobby-Farben → echte Spielerfarben:** `buildMatchConfig()` + `colorHex()` in
  `app.js` übergeben die in der Lobby gewählten Farben entkoppelt an das Spiel
  (gilt künftig für alle Minigames).
- **Sound:** `audio.js` um `bombTick/bombPass/bombExplode/count/go` erweitert
  (WebAudio-synthetisiert, Lautstärke über `Settings.effectiveVolume`).
- **Online-Einladungsfenster vorbereitet:** `#inviteOverlay` (Annehmen/Ablehnen,
  Enter/Esc, Warteschlange), tastaturbedienbar, noch ohne Netz-Anbindung
  (Test-Auslöser `window.BombInvite.test`).
- **Tastatur:** `setupKeyboard()` um Esc-Behandlung für Spiel/Voting/Pause/Ergebnis/
  Einladung und um die Navigations-Container der neuen Overlays erweitert.
- Version auf 0.10.0 (package.json, preload.js).

### v0.9.1 — 2026-06-14
- **Abmelden im Beenden-Dialog als dritter Button:** Der bisherige Schalter
  „Auch abmelden" (`#quitLogoutRow` + `#quitLogout`) ist entfallen. Stattdessen
  zeigt der Dialog angemeldeten Nutzern einen mittleren Button
  „Abmelden & Beenden" (`#btnQuitLogout`, im Gast-Modus `hidden`). Buttonreihe:
  Abbrechen · Abmelden & Beenden · Beenden. Der mittlere Button ruft
  `Auth.signOut()` und beendet danach; „Beenden" hält die Session unverändert.
  Betrifft `index.html`, `app.js` (`openQuitDialog`/`setupQuit`) und `style.css`
  (`.quit-logout`/`.quit-logout-text` entfernt, `.btn-quit-logout` ergänzt).
- Version auf 0.9.1 (package.json, preload.js).

### v0.9.0 — 2026-06-14
- **Feste Tastatur-Navigation über navIds (`NAV_MENU` + `buildLobbyNav()` in
  `app.js`):** Hauptmenü und Lobby navigieren nicht mehr über die
  DOM-Reihenfolge/Geometrie, sondern über eine feste Tabelle. Jedes Element
  trägt eine `data-nav`-ID (z.B. `main_play`, `main_coinGrab`, `lobby_p1_color`,
  `lobby_p2_difficulty`); pro Richtung steht das Ziel fest. Fehlt für eine
  Richtung ein Eintrag, **bleibt der Fokus stehen** (springt nie ins Leere).
  Die übrigen Screens (Auth, Konto, Credits, Beenden, Lobby-Popups) sowie die
  Einstellungen nutzen weiter die geometrische bzw. die eigene deterministische
  Navigation (`moveFocus()` / `handleSettingsKey()`).
- **Lobby-Tabelle dynamisch:** Da die Karten je nach Slot-Typ unterschiedliche
  Knöpfe haben, wird die Lobby-Navigation bei jedem `renderLobby()` neu aus den
  vorhandenen Knöpfen gebaut: ↑/↓ wechselt innerhalb einer Karte, ←/→ springt zur
  Nachbarkarte (deren oberster Knopf), am unteren Kartenrand führt ↓ in die
  Fußzeile (Zurück/Zurücksetzen/Spiel starten). Der Bot-Grad-Knopf verstellt mit
  ←/→ die Schwierigkeit (`adjustBotDifficulty()`, ohne Umlauf), Enter/Leertaste
  schaltet zyklisch (`cycleBotDifficulty()`).
- **Sichtbarer Fokus aufgewertet:** kräftiger gelber Ring **+ Glow** und ein
  leichtes Skalieren des fokussierten Elements (große Karten/Play-Buttons
  behalten ihren eigenen Effekt). Sound beim Fokuswechsel (`Sfx.play('hover')`).
- **Eingabe-Delay (`navThrottled()`):** Eine bewusste Einzel-Eingabe wird immer
  ausgeführt; nur die Auto-Wiederholung einer **festgehaltenen** Taste wird
  gedrosselt (90 ms), damit der Fokus pro Druck nur ein Feld weiterspringt.
- **Fokus-Gedächtnis fürs Hauptmenü:** Das zuletzt fokussierte Menü-Element wird
  gemerkt (`menuFocusNav`); beim Zurückkehren aus Einstellungen/Lobby/Credits
  (zentral über `goToMenu()`) landet der Fokus wieder dort. Start-Fokus: „Spielen".
- **Zuletzt angemeldete Nutzer (`RecentUsers` in `app.js`):** Erfolgreiche
  Logins/Registrierungen merken sich (rein lokal, `localStorage`) den
  Login-Namen + Zeitstempel — **nie ein Passwort**. Auf dem Login-Reiter
  erscheinen sie als Vorschläge (`#recentUsers`): Klick füllt das Namensfeld, das
  ✕ entfernt einen Vorschlag, und Einträge, die **7 Tage** nicht für einen Login
  genutzt wurden, verschwinden beim Laden automatisch (max. 5 Vorschläge).
- **Beenden mit optionalem Abmelden:** Der Beenden-Dialog zeigt angemeldeten
  Nutzern zusätzlich den Schalter „Auch abmelden" (`#quitLogoutRow`, im
  Gast-Modus ausgeblendet). Ist er aktiv, wird vor dem Beenden `Auth.signOut()`
  ausgeführt, sodass der nächste Start wieder den Login zeigt.
- Version auf 0.9.0 (package.json, preload.js).

### v0.8.1 — 2026-06-14
- **Tastatur-Navigation deterministisch (`moveFocus()` in `app.js`):** Die
  geometrische Fokus-Suche wählt jetzt zuerst die nächste Reihe/Spalte in
  Pfeilrichtung („Bande") und erst darin die geringste seitliche Abweichung
  (Gleichstand → DOM-Reihenfolge). Behebt im Hauptmenü das zufällige Springen:
  **↓ von den Buttons oben rechts → „Spielen"**, **↓ von „Spielen" → immer
  dieselbe mittlere Karte**, **←/→ von „Spielen" → linke bzw. rechte Karte**.
  Gilt für alle geometrisch navigierten Screens (Menü, Lobby, Auth …).
- **Bots: Schwierigkeit statt Farbe.** Bot-Slots haben keine Farbwahl mehr —
  ihre Farbe ist immer zufällig (`getRandomFreeColor()`). Stattdessen gibt es
  einen „⚙️"-Button, der zwischen **Mittel** und **Schwer** umschaltet
  (`cycleBotDifficulty()`, `BOT_DIFFICULTIES`); der Grad steht im Status-Badge
  („Bot · Mittel"). Bewusst keine leichten Bots. `slot.difficulty` im
  `lobbyState`; Farb-Picker wird nur noch für Menschen (P1 + Freunde) geöffnet.
- **Konto-Einstellungen untereinander:** Die Formulare Anzeigename/E-Mail/
  Passwort im Reiter „Konto" stehen jetzt in **einer Spalte** untereinander
  statt dreispaltig nebeneinander (`.account-forms` → `grid-template-columns: 1fr`).

### v0.8.0 — 2026-06-14
- **Neuer Lobby-Screen (`#screen-lobby`):** Der „Spielen"-Button führt jetzt
  auf einen Vorbereitungsbildschirm statt auf einen Toast (`btnParty` →
  `openLobby()`). Vier große Playercards im Arcade-Look mit Slot-Nummer,
  Avatar-Farbring, Name, Status-Badge und gewählter Farbe als leuchtender
  Oberkante. Details siehe Abschnitt „Lobby".
- **Slots P1–P4:** P1 ist immer man selbst (nicht entfernbar, Farbe änderbar);
  P2–P4 sind Leer/Bot/Freund. Auswahl über kleine, per Tastatur bedienbare
  Arcade-Popups über der Karte (`#slotPicker` / `#colorPicker`), kein `alert()`.
- **Gast-Regel eingehalten:** Ohne Konto nur Leer/Bot; Freund-Wahl löst den
  Toast „Melde dich an, um Freunde einzuladen." aus (`isOnlineAllowed()`).
  Angemeldet: nur **akzeptierte** Freunde aus `Auth.getFriendOverview()`,
  keine Doppelauswahl, Empty-State bei keiner Freundesliste. Rein lokale
  Konfiguration — keine neuen Supabase-Tabellen, keine Realtime.
- **Bot-System:** Array `BOT_NAMES` mit **300** kurzen, lustigen Party-Namen;
  `getRandomBotName()` wählt zufällig (in der Lobby möglichst ohne Dopplung),
  „🎲 Neuer Name" auf Bot-Cards würfelt neu.
- **Farbpalette `LOBBY_COLORS` (8 Farben):** neue CSS-Vars `--orange/--cyan/
  --pink`. Menschlich belegte Farben sind mit **✕** gesperrt (sichtbar, aber
  deaktiviert); die aktive Farbe trägt **✓** + Glow. Wählt ein Mensch die Farbe
  eines Bots, weicht der Bot automatisch auf die nächste freie Farbe aus
  (`resolveColorConflicts()`); keine freie Farbe → Toast.
- **Aktionen:** „← Zurück", „↺ Lobby zurücksetzen" (`resetLobby()` — Slots 2–4
  leeren, P1 bleibt) und „Spiel starten" (vorerst Toast „Spielstart kommt als
  Nächstes." + Konsolen-Log der Konfig ohne sensible Daten).
- **Tastatur:** Lobby + Popups in `setupKeyboard()` eingehängt (Container-Cascade
  mit Popup-Vorrang, eigener Esc-Schritt). Komplett per Pfeile/WASD/Enter/Esc
  bedienbar; responsiv (Kompakt-Stufen) und ohne sichtbare Scrollbalken.
- Version auf 0.8.0 (package.json, preload.js).

### v0.7.1 — 2026-06-13
- **„F11 = Vollbild"-Hinweis aus dem Hauptmenü-Footer entfernt:** Die
  Versionszeile unten im Menü (`#appVersion`) zeigt nur noch
  „Block Games v…", ohne den F11-Zusatz. F11 schaltet weiterhin den Vollbild
  um (Hinweis dazu steht weiter im Vollbild-Setting).
- **Beenden-Dialog Nachricht geändert:** Statt „Block Games wird geschlossen."
  heißt es nun „Möchtest du uns denn etwa wirklich verlassen?" — freundlicher,
  spielerischer Ton.
- **Gelber Fokus-Ring am Spieler-Badge entzerrt:** `.badge-id` bekommt etwas
  Innen-Padding (`3px 10px 3px 3px`), damit der gelbe `:focus-visible`-Ring
  nicht direkt am Namen (z.B. am „t" von „Gast") klebt.
- **Minigame-Karten immer auswählbar (noch nicht spielbar):** Karten sind
  nicht mehr `disabled` — auch „Bald"-Spiele lassen sich per Maus/Tastatur
  anwählen und animieren (Lift + `@keyframes iconPulse` beim Hover/Fokus, jetzt
  für ALLE Karten statt nur `.available`). Klick/Enter auf ein „Bald"-Spiel
  zeigt einen Hinweis-Toast („… kommt bald!"), gestartet wird nichts. Gesperrte
  Karten sind nur noch leicht gedimmt (`opacity 0.62`, beim Hover 0.85).
  `SFX_SELECTOR` deckt jetzt alle `.minigame-card` ab.
- **Einstellungen-Navigation komplett überarbeitet (deterministisch):** Die
  geometrische Navigation war hier zu unzuverlässig — nach dem Verstellen einer
  Option kam man nicht mehr zu den Reitern zurück (↑ landete u.U. auf
  „Zurücksetzen"), und ←/→ verstellte nur die Option statt den Reiter zu
  wechseln. Neue Funktion `handleSettingsKey()` (in `app.js`):
  - **Auf einem Reiter:** ←/→ wechselt den Reiter, **↓ oder Enter** springt in
    die Optionen.
  - **Auf einer Option:** ↑/↓ wechselt die Option; an der obersten bringt **↑
    zurück zum Reiter** (von dort wechselt ←/→ wieder die Reiter). ←/→ auf der
    Option bleibt native (Regler/Auswahl). Back/Reset per Tab erreichbar.
  - Verifiziert per Playwright: voller Ablauf Reiter→Enter→Option verstellen→↑
    zurück→Reiter wechseln klappt.
- **Einstellungen per Tastatur deutlich sichtbarer:**
  - **Gerade angesteuerte Option wird klar gelb markiert**
    (`.setting-row:focus-within`: gelber Hintergrund + Balken links + gelbe
    Schrift; `.range-value` gelb). So sieht man bei den drei Lautstärke-Reglern
    sofort, welcher ausgewählt ist.
  - **Fokussierter Regler-Griff wird gelb, größer und glüht**
    (`input[type=range]:focus-visible::-webkit-slider-thumb`).
  - **Aktiver Reiter** trägt jetzt gelbe Schrift + gelbe Unterkante
    (`.settings-tab.active`), statt nur einer leicht helleren Fläche.
  - Hinweistext unten erwähnt die Enter-Navigation.

### v0.7.0 — 2026-06-13
- **Einstellungen in Kategorie-Reiter aufgeteilt:** Oben wählbar (Konto ·
  Anzeige · Grafik · Audio), darunter nur die Optionen der aktiven Kategorie
  (`.settings-tabs`/`.settings-panel` in `index.html`; `activateSettingsTab()`,
  `setupSettingsTabs()`, `openSettings()` in `app.js`). Der Konto-Reiter
  erscheint nur angemeldet (`syncAccountCard()` ein-/ausblenden, sonst Rückfall
  auf „Anzeige"). Zahnrad öffnet „Anzeige", „Konto bearbeiten" öffnet „Konto".
  Frühere Karten-Raster-Optik (`.settings-grid`/`.settings-card`) ersetzt.
- **Login/Registrierung komplett per Tastatur:** Auth-Screen in die
  Pfeil-/WASD-Navigation aufgenommen; Cursor startet im ersten Feld
  (`showAuth()`); Fokus auf einen Reiter schaltet das Formular sofort um.
- **Navigation per Pfeiltasten ODER WASD** (zentrale `DIR_KEYS`-Map). W/A/S/D
  navigieren überall außer in Textfeldern (dort tippen sie); Tastenkombis
  (Strg/Alt/⌘) werden ignoriert.
- **`moveFocus()` deckt jetzt alle Bedienelemente ab** (nicht nur Buttons):
  Hoch/Runter springt zwischen Zeilen, ←/→ bleibt native (Regler/Select/Text-
  Cursor), Leertaste schaltet Schalter. Auch das **Konto/Freunde-Overlay** ist
  jetzt per Pfeil/WASD bedienbar.
- **Grundsatz „alles ohne Maus" verbindlich festgehalten** (Grundregeln +
  Abschnitt „Tastatur-Bedienung"): jeder neue Screen muss vollständig per
  Tastatur steuerbar sein und in `setupKeyboard()` eingehängt werden.
- Version auf 0.7.0 (package.json, preload.js).

### v0.6.0 — 2026-06-13
- **Konto & Freunde:** Neues Overlay (`#accountOverlay`), geöffnet per Klick
  aufs Spieler-Badge im Menü — Profilkopf, offene Freundschaftsanfragen
  (Annehmen/Ablehnen), Freundesliste (Entfernen) und Username-Suche zum
  Anfragen. Schließen per ✕/Esc/Hintergrund. Im Gast-Modus nur Hinweis-Toast.
- **Konto bearbeiten:** Neue Karte „👤 Konto" oben in den Einstellungen
  (nur angemeldet sichtbar) zum Ändern von Anzeigename (Username/Login-Mail),
  Kontakt-E-Mail und Passwort, mit Erfolg-/Fehlermeldung.
- **`renderer/auth.js` erweitert:** Freundes-API (`getFriendOverview`,
  `searchUsers`, `sendFriendRequest`, `acceptFriendRequest`, `removeFriend`)
  gegen `public.friends` sowie Konto-API (`updateUsername`,
  `updateContactEmail`, `updatePassword`) + Getter `userId`/`contactEmail`.
- **`Auth.onChange`-Logik geschärft:** Screen-Wechsel ins Menü nur noch beim
  Login (vom Lade-/Auth-Screen), damit Profil-Updates die Einstellungen nicht
  verlassen; Konto-Overlay schließt + Konto-Karte versteckt sich beim Abmelden.
- Spieler-Badge ist jetzt ein Button (`.badge-id`, klingt mit); Pfeil-Navigation
  und Esc decken das Konto-Overlay korrekt ab (Pfeile springen nicht ins Menü
  dahinter). Avatare nutzen CSP-konform die Namens-Initiale (keine Remote-Bilder).
- Version auf 0.6.0 (package.json, preload.js).

### v0.5.1 — 2026-06-13
- **Start immer im Vollbild:** `app.js` erzwingt beim Boot den Vollbildmodus
  unabhängig vom gespeicherten Wert (`Settings.set('fullscreen', true)` +
  `setFullscreen(true)`, UI nachgezogen). Zuvor öffnete ein gespeicherter
  Fenstermodus das Spiel im Fenster mit sichtbarer Taskleiste. Fenstermodus
  bleibt per Schalter/F11 erreichbar.
- **„Spielen"-Button beruhigt (cleanerer Look):** Glanz-Sweep dezenter und
  seltener (Opazität 0.35 → 0.18, Intervall 4,5 s → 7 s); Hover-Wackeln mit
  Rotation (`partyWobble`) entfernt — jetzt sauberes, ruhiges Anheben;
  Würfel-Icon schwebt sanft auf/ab statt zu rotieren (`diceBounce` ohne
  Drehung, 2,4 s → 3,4 s).
- Version auf 0.5.1 (package.json, preload.js).

### v0.5.0 — 2026-06-13
- **Hauptmenü-Redesign:** Großer Logo-/Titelbereich mit Glow und Pop-In plus
  Untertitel-Chip „Party Arcade"; primärer Button auf „Spielen" umgestellt
  (Gloss-Overlay, Glanz-Sweep, Hover-Wackeln, hüpfendes Würfel-Icon, Play-Pfeil);
  Minigame-Karten als Arcade-Spieltafeln (Akzent-Glow, Icon-Kachel, Lift/Tilt
  beim Hover); aufgewertetes Gast-Hinweisband (Funktion unverändert);
  poliertes Player-Badge und Beenden-Knopf.
- **Bühnen-Hintergrund:** Neue Layer `#stageLights` (bewegte Spotlights),
  `#bgStars` (funkelnde Sterne) sowie 3D-Würfel in `#bgBlocks`; Würfel/Sterne
  als CSS-Masken aus `assets/cube.svg` / `assets/star.svg`. Bei „Animationen
  reduzieren" werden alle dauerhaften Ambient-Animationen abgeschaltet.
- **Credits-Screen:** Eigener `#screen-credits` (Button im Footer, zurück per
  ←/Esc), gleicher Bühnen-Look, datengetriebene Rollen-Karten aus der
  `CREDITS`-Liste in `app.js` (`renderCredits()`) — aktuell überall
  „Peter Scheikl", plus Zeile „Made with Electron, JavaScript, HTML and CSS".
- **App-Icon:** Eigenständiger goldener Block mit „B" als `block-icon.svg/.png/.ico`
  in `renderer/assets/`; in `main.js` über die `BrowserWindow`-`icon`-Option
  und `app.setAppUserModelId(...)` eingebunden; `build`-Block in `package.json`
  fürs spätere Packaging vorbereitet (keine neue Dependency).
- **Tastatur:** Esc und Pfeil-Navigation decken jetzt auch die Credits-Seite ab.
- Nur lokale Assets / CSS / SVG, keine Internet-Abhängigkeiten; Sicherheits-,
  Auth-, Gast- und Settings-Modell unverändert. Version auf 0.5.0
  (package.json, preload.js).

### v0.4.0 — 2026-06-13
- **Auth-Screen scrollfrei:** Vertikale Abstände gestrafft und beide
  Kompakt-Stufen (820px/680px) verschärft — auch der Registrieren-Tab
  (3 Felder) passt jetzt bei allen unterstützten Fenstergrößen
  (bis hinunter zur Minimalgröße 960×640) ohne Scrollen.
- **Sound-System:** Neues Modul `renderer/audio.js` (`Sfx`) mit per WebAudio
  synthetisierten UI-Sounds (Klick, Hover, Tab, Schalter, Erfolg, Fehler,
  Test-Blip); Lautstärke live aus dem Settings-Store. Die Lautstärke-Regler
  haben damit erstmals eine hörbare Wirkung (Test-Blip beim Ziehen).
- **Beenden-Knopf:** ⏻ im Hauptmenü mit Bestätigungs-Dialog; IPC `app:quit`
  in `main.js`, `quitApp()` in `preload.js`.
- **Tastatur-Navigation:** Hauptmenü und Beenden-Dialog per Pfeiltasten/Enter
  bedienbar (geometrische Fokus-Navigation), gelber Fokus-Ring per
  `:focus-visible`; Minigame-Karten sind jetzt `<button>`; Esc-Logik
  zentralisiert (Dialog schließen / Einstellungen → Menü).
- Version auf 0.4.0 (package.json, preload.js).

### v0.3.0 — 2026-06-13
- **Einstellungsseite** im Hauptmenü (⚙️ oben rechts, zurück per ←/Esc):
  Vollbild-Schalter, Fenstergröße, FPS-Limit, „Animationen reduzieren",
  Lautstärke (Gesamt/Musik/Effekte), „Zurücksetzen".
- Neuer zentraler Einstellungs-Store `renderer/settings.js`
  (localStorage, `onChange`-Events, `effectiveVolume()`); Anzeige-Steuerung
  per IPC in `main.js`/`preload.js` (`display:*`-Kanäle), F11 und
  UI-Schalter bleiben synchron; gespeicherte Einstellungen werden beim
  Start angewendet.
- **Scroll-Politur:** Scrollbalken app-weit unsichtbar; zwei
  Kompakt-Stufen (820px/680px Fensterhöhe) lassen Auth-Screen, Menü und
  Einstellungen ohne Scrollen passen.
- Festgehalten: Minigames bekommen später ein kleineres
  Einstellungs-Overlay, das denselben Store nutzt (siehe Abschnitt
  „Einstellungen" + ROADMAP).

### v0.2.0 — 2026-06-13
- App startet immer im Vollbild; F11 schaltet um (`main.js`).
- Gast-Modus: Login überspringbar, ohne Konto nur Spiele gegen Bots
  (`isOnlineAllowed()`/`guestMode` in `app.js`, Gast-Button + Hinweisband).
- UI-Redesign von Auth-Screen und Hauptmenü (Arcade-Plakat-Look, s. oben);
  Overlap-Fixes (Header-Wrap, Username-Ellipsis, scrollender Auth-Screen).
- `alert()` durch Toast ersetzt.
- `Block Games starten.bat` für Doppelklick-Start angelegt.
- Beschluss festgehalten: Code in `block-games/` wird **nicht** obfuskiert
  (ROADMAP entsprechend angepasst); diese Doku-Datei eingeführt.

### v0.1.0 — 2026-06-12
- Electron-Grundgerüst, Login-Pflicht, Hauptmenü mit 6
  Minigame-Platzhaltern, Supabase-Auth mit Website-Konten.
