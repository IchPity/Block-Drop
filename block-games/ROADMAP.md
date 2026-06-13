# Block Games — Roadmap & Notizen

Desktop-Party-Spiel (Mario-Party-Stil) für die Block-Drop Arcade.
Alles zu diesem Spiel lebt **nur in diesem Ordner** (`block-games/`), bis es
am Ende in die Repo-Struktur integriert wird.

> **Doku:** Architektur, Entscheidungen und Änderungsprotokoll stehen in
> `DOKUMENTATION.md`. Diese Datei hier listet nur, was noch zu bauen ist.

## Stand (2026-06-13)

✅ **Fertig:**
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
- **Tastatur-Navigation** im Hauptmenü (Pfeiltasten/Enter, Fokus-Ring);
  Auth-Screen scrollfrei auch im Registrieren-Tab

## Noch zu bauen

### Party-Modus (Kernfeature)
- Brettspiel-Runden wie Mario Party: Würfeln → Feld-Events → nach jeder Runde ein Minigame
- **Immer 4 Spieler pro Partie.** Fehlende menschliche Spieler werden durch
  KI-Gegner aufgefüllt (1 Mensch → 3 KIs usw.)
- KI braucht pro Minigame eine eigene einfache Spiellogik (reagieren mit
  zufälliger menschenähnlicher Verzögerung, Fehlerquote je Schwierigkeit)

### Minigames (aktuell Platzhalter im Menü)
| ID | Name | Idee |
|----|------|------|
| block-rush | Block Rush | Blöcke schneller stapeln als die Gegner |
| coin-grab | Coin Grab | In begrenzter Zeit Münzen einsammeln |
| memory-clash | Memory Clash | Sequenzen merken, wer zuerst patzt fliegt |
| speed-tap | Speed Tap | Reaktionsduell |
| bomb-pass | Bomb Pass | Heiße Kartoffel mit Bombe |
| quiz-blocks | Quiz Blocks | Quizfragen, schnellste richtige Antwort gewinnt |

Freischalten: in `renderer/app.js` im `MINIGAMES`-Array `available: true`
setzen und eine `start`-Funktion geben.

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
