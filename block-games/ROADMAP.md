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
- **Einstieg steht schon:** Die Lobby (v0.8.0) liefert die Partie-Konfiguration
  (Spieler/Bots/Freunde + Farben). „Spiel starten" muss daraus später die
  echte Partie erzeugen (aktuell nur Toast).
- Brettspiel-Runden wie Mario Party: Würfeln → Feld-Events → nach jeder Runde ein Minigame
- **Immer 4 Spieler pro Partie.** Fehlende menschliche Spieler werden durch
  KI-Gegner aufgefüllt (1 Mensch → 3 KIs usw.)
- KI braucht pro Minigame eine eigene einfache Spiellogik (reagieren mit
  zufälliger menschenähnlicher Verzögerung, Fehlerquote je Schwierigkeit)
- **Bot-Schwierigkeit (festgelegt):** Es soll **immer mindestens „Mittel" und
  „Schwer"** geben — **keine leichten Bots**. In der Lobby ist der Grad pro Bot
  einstellbar (`BOT_DIFFICULTIES` in `app.js`, `slot.difficulty`, Default
  `medium`); die Minigame-KI muss diese Grade später per Fehlerquote/Tempo
  umsetzen.

### Minigames
| ID | Name | Idee | Status |
|----|------|------|--------|
| block-bomb | Block Bomb | Bombe weitergeben, wer hochgeht fliegt raus | ✅ v0.10.0 |
| block-rush | Block Rush | Blöcke schneller stapeln als die Gegner | Platzhalter |
| coin-grab | Coin Grab | In begrenzter Zeit Münzen einsammeln | Platzhalter |
| memory-clash | Memory Clash | Sequenzen merken, wer zuerst patzt fliegt | Platzhalter |
| speed-tap | Speed Tap | Reaktionsduell | Platzhalter |
| quiz-blocks | Quiz Blocks | Quizfragen, schnellste richtige Antwort gewinnt | Platzhalter |

Freischalten: in `renderer/app.js` im `MINIGAMES`-Array `available: true`
setzen und eine `start`-Funktion geben. Block Bomb (`renderer/block-bomb/`) dient
als Vorlage für Aufbau, Map-Voting und die Steuerungs-Abstraktion.

**Konventionen für jedes Minigame (ab Block Bomb gesetzt):**
- **Lobby-Farben = echte Spielerfarben** im Spiel (über `buildMatchConfig()` +
  `colorHex()` in `app.js`). Nicht nur Deko in der Lobby.
- **3 eigene, hochwertige Maps** pro Modus, mit **Map-Voting** vor dem Start
  (echte Spieler wählen, Bots zufällig, Mehrheit gewinnt, Gleichstand zufällig).
- **Steuerungs-Abstraktion** (`controllers.js`-Muster): Spielkern liest nur
  Bewegungs-Intents, damit lokal/Bot/Online austauschbar sind.

### Online-Spiel über verschiedene Netzwerke (Langfristziel)
- Spieler aus unterschiedlichen Netzwerken sollen zusammen spielen können, voll
  tastaturbedienbar. Die **Steuerungs-Abstraktion** (`RemoteController` in
  `block-bomb/controllers.js`) ist dafür vorbereitet — es fehlt der Netz-Layer
  (Kandidat: Supabase Realtime), der Intents synchronisiert.
- **Einladungsfenster** (`#inviteOverlay` in `index.html`, Logik in `app.js`):
  UI + Tastatur + Warteschlange stehen; echte Lobby-Anbindung folgt, gekoppelt an
  `isOnlineAllowed()`.

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
- `electron-builder` einrichten → Windows-Installer (NSIS) bauen
- Installer auf der Website zum Download anbieten (z.B. neue Seite
  `app/download/` oder Button auf der Startseite)
- Releases versionieren; später evtl. Auto-Update (electron-updater)

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
