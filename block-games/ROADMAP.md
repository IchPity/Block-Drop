# Block Games — Roadmap & Notizen

Desktop-Party-Spiel (Mario-Party-Stil) für die Block-Drop Arcade.
Alles zu diesem Spiel lebt **nur in diesem Ordner** (`block-games/`), bis es
am Ende in die Repo-Struktur integriert wird.

## Stand (2026-06-12)

✅ **Fertig:**
- Electron-Grundgerüst (main.js, preload.js, Renderer)
- Login-Pflicht beim Start: ohne Konto kein Hauptmenü
- Anmeldung/Registrierung **mit bestehenden Website-Konten** — gleiches
  Supabase-Backend wie die Website (Flow 1:1 aus `app/auth.js` übernommen:
  synthetische Mail `<username>@blockdrop.local`, RPC `resolve_login_email`)
- Hauptmenü im Mario-Party-Stil mit Party-Button und 6 Minigame-Platzhaltern
- Portables Node.js in `tools/node/` (keine Systeminstallation nötig)

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

### Verteilung / Download über die Website
- `electron-builder` einrichten → Windows-Installer (NSIS) bauen
- Installer auf der Website zum Download anbieten (z.B. neue Seite
  `app/download/` oder Button auf der Startseite)
- Releases versionieren; später evtl. Auto-Update (electron-updater)

### Integration in die Repo-Struktur (ganz am Ende)
- Ordner ggf. umziehen/umbenennen gemäß Repo-Konvention
- `tools/node/` und `node_modules/` gehören NICHT ins Git
  (siehe `.gitignore` hier im Ordner)
- Obfuskation: Renderer-JS vor Release durch `tools/_obfuscate.js`-artigen
  Schritt jagen (Achtung: `debugProtection` nur im Browser sinnvoll)
- **Wichtig:** Der Supabase-Publishable-Key steht im Klartext in
  `renderer/auth.js` — das ist ok (gleicher Key wie Website, RLS schützt),
  aber beim Release-Build an die Obfuskation denken, wenn gewünscht

## Entwicklung

```powershell
# Abhängigkeiten installieren (portables Node liegt in tools/node):
$env:Path = "D:\Block-Drop\block-games\tools\node;$env:Path"
cd D:\Block-Drop\block-games
npm install

# App starten:
npm start
```
