# Block Games — Roadmap & Notizen

Desktop-Party-Spiel (Mario-Party-Stil) für die Block-Drop Arcade.
Alles zu diesem Spiel lebt **nur in diesem Ordner** (`block-games/`), bis es
am Ende in die Repo-Struktur integriert wird.

> **Doku:** Architektur, Entscheidungen und Änderungsprotokoll stehen in
> `DOKUMENTATION.md`. Diese Datei hier listet nur, was noch zu bauen ist.

## Stand (2026-06-14)

✅ **Fertig:**
- **Erstes Minigame „Block Bomb"** (v0.10.0): Bomben-Weitergabe / Last-Man-Standing
  auf 3D-Blockwelt (Three.js, lokal vendored). Ablauf Map-Voting → 3-2-1-Countdown →
  Runde → Ergebnis. 3 Maps (Bomb Arena, Sky Platforms, Factory Panic), Bot-KI
  (verfolgen/fliehen, Mittel/Schwer, fair), Lobby-Farben als echte Figurenfarben,
  HUD + Pause + tastaturbedienbares Einladungsfenster (online vorbereitet).
  Steuerungs-Abstraktion (Mensch/Bot/Remote) für späteres Online-Spiel.
- **Feste Tastatur-Navigation** (v0.9.0): Hauptmenü und Lobby laufen über eine
  navId-Tabelle (`NAV_MENU` + dynamisches `buildLobbyNav()` in `app.js`) statt
  über die DOM-Reihenfolge — deterministisch, am Rand bleibt der Fokus stehen.
  Sichtbarer Fokus (Glow + Skalierung), Sound beim Wechsel, Eingabe-Delay gegen
  gedrückt gehaltene Tasten, Hauptmenü merkt sich das zuletzt fokussierte Element.
- **Zuletzt angemeldete Nutzer** (v0.9.0): Login-Vorschläge (lokal, `RecentUsers`),
  einzeln löschbar, automatisch nach 7 Tagen ohne Login entfernt.
- **Beenden mit optionalem Abmelden** (v0.9.0): Der Beenden-Dialog fragt
  angemeldete Nutzer zusätzlich, ob auch abgemeldet werden soll.
- **Lobby-Vorbereitungsscreen** (v0.8.0): „Spielen" öffnet die Lobby mit 4
  Playercards — P1 = man selbst, P2–P4 als Leer/Bot/Freund, feste 8-Farben-
  Palette mit Sperr-/Verdrängungs-Logik, 300 zufällige Bot-Namen. Reine lokale
  Konfiguration; „Spiel starten" zeigt vorerst nur einen Toast.
- Electron-Grundgerüst (main.js, preload.js, Renderer)
- Anmeldung/Registrierung **mit bestehenden Website-Konten** — gleiches
  Supabase-Backend wie die Website (Flow 1:1 aus `app/auth.js` übernommen:
  synthetische Mail `<username>@blockdrop.local`, RPC `resolve_login_email`)
- **Gast-Modus**: Login überspringbar, ohne Konto aber nur Spiele gegen Bots
- Vollbild-Start (F11 zum Umschalten), Doppelklick-Start per
  `Block Games starten.bat`
- Hauptmenü im Mario-Party-Stil mit Party-Button und 6 Minigame-Platzhaltern
- **Einstellungsseite** (⚙️ im Hauptmenü): Vollbild, Fenstergröße,
  FPS-Limit, Animationen, Lautstärke — zentraler Store in
  `renderer/settings.js`; UI scrollfrei, Scrollbalken app-weit unsichtbar
- **Sound-System** (`renderer/audio.js`): UI-Sounds per WebAudio
  synthetisiert (keine Audio-Dateien), Lautstärke live aus dem Settings-Store
- **Beenden-Knopf** (⏻ im Hauptmenü) mit Bestätigungs-Dialog
- **Tastatur-Navigation** überall (Pfeiltasten/WASD/Enter/Leertaste/Esc,
  Fokus-Glow); Menü + Lobby über feste navIds, restliche Screens geometrisch;
  Auth-Screen scrollfrei auch im Registrieren-Tab

## Noch zu bauen

### Party-Modus (Kernfeature)
- **✅ Erledigt (v0.13.0/v0.19.0):** „Spiel starten" erzeugt die echte
  Party-Serie über alle Minigames (`startSeries()`, s. DOKUMENTATION.md
  „Party-Serie & Gesamt-Ranking"). Die Lobby liefert dafür Spieler/Bots/
  Freunde + Farben.
- Brettspiel-Runden wie Mario Party: Würfeln → Feld-Events → nach jeder Runde ein Minigame
  (bleibt offen — bisher reine Minigame-Serie ohne Brett/Würfel).
- **✅ Erledigt (v0.19.0): Mindestens 3, höchstens 4 Spieler pro Partie.**
  Fehlende menschliche Spieler werden durch Bots aufgefüllt (1 Mensch → min.
  2 Bots, 2 Menschen → min. 1 Bot); `minBotCount()`/`maxBotCount()` in
  `app.js` klemmen die Anzahl. **Seit v0.23.0** wird Bot NICHT mehr über einen
  globalen Fußzeilen-Stepper gesteuert, sondern ist eine gleichwertige Option
  direkt im Platz-Popup jedes Lobby-Slots.
- **✅ Erledigt (v0.23.0): Erstes Spiel der Party-Serie wird gewählt.** „Spiel
  starten" öffnet zuerst ein Spiel-Voting (`#mgGameVote`); alle weiteren Spiele
  der Serie laufen danach zufällig, die Map wird vor jeder Runde weiter
  gewählt — siehe DOKUMENTATION.md „Party-Serie & Gesamt-Ranking".
- **✅ Erledigt (v0.23.0): Einstellbare Tastenbelegung.** Eigener „Steuerung"-
  Reiter in den Einstellungen: Preset (WASD/Pfeiltasten) pro Spieler-Slot,
  jede Aktion einzeln umbelegbar, Konflikte werden getauscht/abgelehnt —
  siehe DOKUMENTATION.md „Einstellungen"/„Couch-Koop".
- **✅ Erledigt (v0.23.0): Splitscreen für Couch-Koop.** Bei zwei lokalen
  Menschen kann die Lobby zwischen „Ein Bild"/„Zwei Bilder" umschalten; alle
  drei Minigames rendern dann zwei eigene Kamera-Hälften statt eines
  gemeinsamen Bildes — siehe DOKUMENTATION.md „Couch-Koop".
- KI braucht pro Minigame eine eigene einfache Spiellogik (reagieren mit
  zufälliger menschenähnlicher Verzögerung, Fehlerquote je Schwierigkeit)
- **✅ Erledigt (v0.19.0): Bot-Schwierigkeit ist nicht mehr pro Slot in der
  Lobby einstellbar**, sondern wird **zufällig pro Match** vergeben
  (`randomBotDifficulty()` in `app.js`) — weiterhin nur „Mittel"/„Schwer",
  nie „Leicht".
- **✅ Erledigt (v0.19.0): Couch-Koop.** Ein zweiter lokaler Mensch kann über
  den Lobby-Slot-Typ `local` mitspielen (Pfeiltasten, P1 bleibt bei WASD) —
  siehe DOKUMENTATION.md „Couch-Koop". Mehr als 2 lokale Menschen (3./4.
  Tastenlayout) sind noch nicht vorgesehen.
- **✅ Erledigt (v0.19.0): Match-Abbruch per Abstimmung** (F5/F6, 15s-Timeout,
  Schein-Abstimmung solo gegen Bots) — siehe DOKUMENTATION.md „Match-Abbruch
  per Abstimmung". Zählt bisher nur lokale Menschen; Online-Mitspieler folgen
  zusammen mit dem Abschnitt „Online-Spiel" unten.

### Minigames
| ID | Name | Idee | Status |
|----|------|------|--------|
| block-bomb | Block Bomb | Bombe weitergeben, wer hochgeht fliegt raus | ✅ v0.10.0 |
| block-rush | Block Rush | Blöcke schneller stapeln als die Gegner | ✅ v0.22.0, Spielbarkeits-Durchgang v0.23.0 |
| coin-grab | Coin Grab | In begrenzter Zeit Münzen einsammeln | Platzhalter |
| memory-clash | Memory Clash | Sequenzen merken, wer zuerst patzt fliegt | Platzhalter |
| speed-tap | Speed Tap | Reaktionsduell | Platzhalter |
| quiz-blocks | Quiz Blocks | Quizfragen, schnellste richtige Antwort gewinnt | Platzhalter |

Freischalten: in `renderer/app.js` im `MINIGAMES`-Array `available: true`
setzen und einen `GAME_REGISTRY`-Eintrag ergänzen (seit v0.23.0 kein
Menü-Klick-Ziel mehr — jedes Spiel läuft ausschließlich über die Lobby/
Party-Serie, `MINIGAMES` hat kein `start`/`nav` mehr). Block Bomb
(`renderer/block-bomb/`) dient als Vorlage für Aufbau, Map-Voting und die
Steuerungs-Abstraktion.

**Konventionen für jedes Minigame (ab Block Bomb gesetzt):**
- **Lobby-Farben = echte Spielerfarben** im Spiel (über `buildMatchConfig()` +
  `colorHex()` in `app.js`). Nicht nur Deko in der Lobby.
- **3 eigene, hochwertige Maps** pro Modus, mit **Map-Voting** vor dem Start
  (echte Spieler wählen, Bots zufällig, Mehrheit gewinnt, Gleichstand zufällig).
- **Steuerungs-Abstraktion** (`controllers.js`-Muster): Spielkern liest nur
  Bewegungs-Intents, damit lokal/Bot/Online austauschbar sind.

### Online-Spiel über verschiedene Netzwerke — ✅ Grundversion erledigt (v0.20.0)
- **Erledigt:** Spieler aus unterschiedlichen Netzwerken können zusammen
  spielen (host-autoritativ, Supabase Realtime Broadcast+Presence, `renderer/
  net/session.js`). Beitritt per Session-Code (auch als Gast) oder per
  Freundes-Einladung über `#inviteOverlay` (jetzt echt verdrahtet, nicht mehr
  nur UI-Stub). `RemoteController` (`renderer/game/controllers.js`) wird
  wirklich gefüttert statt nur vorbereitet zu sein. Details:
  DOKUMENTATION.md, Änderungsprotokoll v0.20.0.
- **Noch offen für später:**
  - Client-Prediction (Gäste spüren aktuell eine kleine Eingabelatenz).
  - Host-Migration (fällt der Host aus, endet die Session für alle statt
    dass jemand anders übernimmt).
  - Echte Gast-Beteiligung am Map-Voting (Gäste stimmen bisher zufällig wie
    Bots mit) und an der Match-Abbruch-Abstimmung (zählt bisher nur lokale
    Menschen mit — s. DOKUMENTATION.md „Match-Abbruch per Abstimmung").
  - Mehr als 4 Spieler gesamt (aktuell hart an die 4 Lobby-Plätze/Map-Spawns
    gekoppelt).

**Pflichten für jedes Minigame (Einstellungen):**
- **Eigenes, kleineres Einstellungs-Fenster im Spiel** (z.B. Pause-Overlay,
  v.a. Lautstärke) — es nutzt **denselben Store** (`renderer/settings.js`,
  gleiche Keys + `onChange`), damit es mit der Haupt-Einstellungsseite
  immer synchron bleibt. KEIN eigener zweiter Speicherort!
- Lautstärke über `Settings.effectiveVolume('music'|'sfx')` (0–1,
  Master eingerechnet) abspielen und live auf `Settings.onChange` reagieren.
  Sound-Effekte am besten direkt über `Sfx.play()` (`renderer/audio.js`) —
  das liest die Lautstärke automatisch bei jedem Abspielen.
- Das FPS-Limit aus `Settings.get('fpsLimit')` respektieren
  (0 = unbegrenzt), z.B. im requestAnimationFrame-Loop drosseln.

### Verteilung / Download über die Website
- **✅ Erledigt (v0.21.0): Update-Check vor dem Login.** Die App fragt beim
  Start die GitHub-Releases-API ab und bietet bei einer neueren Version
  einen Screen vor Login/Menü an — „Jetzt herunterladen" öffnet nur die
  Release-Seite im Browser (kein Auto-Download). Siehe DOKUMENTATION.md,
  Änderungsprotokoll v0.21.0.
- **✅ Erledigt (v0.24.0): `electron-builder` eingerichtet + Demo-Kennzeichnung.**
  `npm run dist` baut über `electron-builder --win nsis` einen Windows-
  Installer; NSIS selbst schlägt auf Rechnern ohne Windows-Entwickler-
  modus fehl (fehlendes Symlink-Recht beim Entpacken von `winCodeSign`,
  s. DOKUMENTATION.md „Bekannte Probleme"). Bis das geklärt ist, liefert
  `dist/win-unpacked/` (vom selben Lauf immer erfolgreich gepackt) ein
  fertiges Portable-Zip als Übergangslösung. App ist überall sichtbar als
  **Demo** markiert: Fenstertitel, Logo-Badge (Login-Screen + Hauptmenü),
  Versionszeile im Hauptmenü-Footer, `productName` in package.json.
- Installer/Zip auf der Website zum Download anbieten (z.B. neue Seite
  `app/download/` oder Button auf der Startseite) — noch offen
- Releases versionieren (Tag `vX.Y.Z` + GitHub Release erstellen — nötig,
  damit der Update-Check oben überhaupt etwas findet); später evtl. echter
  Auto-Updater (`electron-updater`) statt nur des Browser-Links
- Windows-Entwicklermodus auf dem Build-Rechner aktivieren (oder Build in
  einer Umgebung mit Symlink-Recht laufen lassen), damit `nsis` statt nur
  `win-unpacked`/Zip funktioniert

### Integration in die Repo-Struktur (ganz am Ende)
- Ordner ggf. umziehen/umbenennen gemäß Repo-Konvention
- `tools/node/` und `node_modules/` gehören NICHT ins Git
  (siehe `.gitignore` hier im Ordner)
- **Beschluss (2026-06-13): Der Code in `block-games/` wird NICHT
  obfuskiert** — er bleibt im Klartext und wird in `DOKUMENTATION.md`
  dokumentiert. (Die Obfuskation der Website in `app/` bleibt davon
  unberührt.)
- Der Supabase-Publishable-Key steht im Klartext in `renderer/auth.js` —
  das ist ok (gleicher Key wie Website, RLS schützt)

## Entwicklung

Siehe `DOKUMENTATION.md` → „App starten". Kurzfassung: Doppelklick auf
`Block Games starten.bat`, oder `npm install` + `npm start` im Ordner
`block-games/` (Node liegt portabel auf `D:\`).
