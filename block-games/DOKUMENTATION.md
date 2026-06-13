# Block Games — Dokumentation

Desktop-Party-Spiel (Mario-Party-Stil) für die Block-Drop Arcade, gebaut mit
Electron. **Diese Datei ist die laufende Doku des Projekts: Jede Änderung am
Code wird hier dokumentiert.**

## Grundregeln

- **Kein obfuskierter Code.** Anders als die Website (`app/` + `worker.js`)
  bleibt der Code in `block-games/` immer im Klartext lesbar.
- **Alles dokumentieren.** Neue Features, Entscheidungen und Änderungen kommen
  in diese Datei (Abschnitt „Änderungsprotokoll").
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
| `renderer/index.html` | Alle Screens: Laden, Login/Registrierung, Hauptmenü, Einstellungen, **Credits** + Beenden-Overlay; Bühnen-Hintergrund-Layer |
| `renderer/app.js` | UI-Logik: Screen-Wechsel, Gast-Modus, Menü-Rendering, **Credits-Rendering**, Einstellungs-UI, Toast, Sound-Verdrahtung, Beenden-Dialog, Tastatur-Navigation, animierter Hintergrund (Blöcke/Würfel/Sterne) |
| `renderer/settings.js` | Zentraler Einstellungs-Store (localStorage, onChange-Events, `effectiveVolume()`) |
| `renderer/audio.js` | Sound-System `Sfx`: UI-Effekte per WebAudio synthetisiert (keine Audio-Dateien), Lautstärke aus dem Settings-Store |
| `renderer/auth.js` | Supabase-Auth (gleiches Backend/Flow wie die Website) |
| `renderer/style.css` | Arcade-Look: Farben, Animationen, Layout, unsichtbare Scrollbalken, Kompakt-Stufen, Credits-Styling, Bühnen-Hintergrund |
| `renderer/assets/` | Eigene lokale Assets: `block-icon.svg/.png/.ico` (Marken-Block), `cube.svg`/`star.svg` (Deko-Masken) |
| `Block Games starten.bat` | Doppelklick-Start der App |

## Verhalten & Entscheidungen

### Vollbild
Die App startet **immer im Vollbild** (`fullscreen: true` in `main.js`).
**F11** schaltet den Vollbildmodus um — das ist nötig, weil das Standard-Menü
deaktiviert ist und es sonst keinen Weg aus dem Vollbild gäbe. Verlässt man
den Vollbildmodus, fällt das Fenster auf 1280×800 zurück (min. 960×640).

### Login & Gast-Modus
- Anmeldung/Registrierung läuft gegen **dasselbe Supabase-Backend wie die
  Website** — bestehende Website-Konten funktionieren direkt
  (synthetische Auth-Mail `<username>@blockdrop.local`,
  Fallback-RPC `resolve_login_email`; Flow 1:1 aus `app/auth.js`).
- Der Login ist **überspringbar**: Button „Als Gast spielen" auf dem
  Auth-Screen.
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

| Bereich | Einstellung | Verhalten |
|---|---|---|
| Anzeige | Vollbild (Schalter) | wirkt sofort per IPC; bleibt mit F11 synchron (`display:fullscreen-changed`-Event aus `main.js`) |
| Anzeige | Fenstergröße (Auswahl) | nur im Fenstermodus aktiv; Liste wird auf die Bildschirmgröße gefiltert; beim Verlassen des Vollbilds wird die gespeicherte Größe wiederhergestellt |
| Grafik | FPS-Limit (30/60/120/144/240/unbegrenzt) | wird nur **gespeichert** — die Minigames müssen das Limit selbst über `Settings.get('fpsLimit')` umsetzen (0 = unbegrenzt) |
| Grafik | Animationen reduzieren | blendet schwebende Hintergrund-Blöcke und Glanz-Sweep aus (`body.reduced-fx`) |
| Audio | Gesamt / Musik / Soundeffekte (0–100 %) | nur gespeichert (noch kein Sound in der App); Spiele lesen die fertige Lautstärke über `Settings.effectiveVolume('music'|'sfx')` (0–1, Master eingerechnet) |

„Zurücksetzen" stellt alle Defaults wieder her. Gespeicherte
Anzeige-Einstellungen werden beim App-Start angewendet (Start ist immer
Vollbild; wer Fenstermodus gespeichert hat, landet sofort dort).

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

- **Pfeiltasten** springen im Hauptmenü (und im Beenden-Dialog) zum
  nächstgelegenen Button in Pfeilrichtung (geometrische Navigation, deckt
  auch das Karten-Grid ab); **Enter/Leertaste** löst aus. Die
  Minigame-Karten sind dafür echte `<button>` (gesperrte sind `disabled`
  und werden übersprungen).
- Fokus-Ring nur bei Tastatur-Bedienung (`:focus-visible`, gelber Rahmen) —
  Mausklicks erzeugen keinen Ring.
- **Esc**: schließt den Beenden-Dialog bzw. führt von den Einstellungen
  **oder der Credits-Seite** zurück ins Menü (zentraler Handler
  `setupKeyboard()` in `app.js`). Die Pfeil-Navigation deckt auch die
  Credits-Seite ab.
- In Eingabefeldern, Slidern und Selects behalten die Pfeiltasten ihre
  normale Funktion.

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
