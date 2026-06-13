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
| `renderer/index.html` | Alle Screens: Laden, Login/Registrierung, Hauptmenü, Einstellungen (**in Kategorie-Reitern**: Konto/Anzeige/Grafik/Audio), **Credits** + Beenden-Overlay + **Konto/Freunde-Overlay**; Bühnen-Hintergrund-Layer |
| `renderer/app.js` | UI-Logik: Screen-Wechsel, Gast-Modus, Menü-Rendering, **Credits-Rendering**, Einstellungs-UI, **Konto/Freunde-Overlay + Konto-Bearbeitung**, Toast, Sound-Verdrahtung, Beenden-Dialog, Tastatur-Navigation, animierter Hintergrund (Blöcke/Würfel/Sterne) |
| `renderer/settings.js` | Zentraler Einstellungs-Store (localStorage, onChange-Events, `effectiveVolume()`) |
| `renderer/audio.js` | Sound-System `Sfx`: UI-Effekte per WebAudio synthetisiert (keine Audio-Dateien), Lautstärke aus dem Settings-Store |
| `renderer/auth.js` | Supabase-Auth + **Freundes- und Konto-API** (gleiches Backend wie die Website) |
| `renderer/style.css` | Arcade-Look: Farben, Animationen, Layout, unsichtbare Scrollbalken, Kompakt-Stufen, Credits-Styling, Bühnen-Hintergrund |
| `renderer/assets/` | Eigene lokale Assets: `block-icon.svg/.png/.ico` (Marken-Block), `cube.svg`/`star.svg` (Deko-Masken) |
| `Block Games starten.bat` | Doppelklick-Start der App |

## Verhalten & Entscheidungen

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

- **Navigation per Pfeiltasten ODER WASD:** Der Fokus springt geometrisch
  zum nächstgelegenen Element in Richtung der Taste (deckt auch das
  Karten-Grid und gemischte Bedienelemente ab). **Enter/Leertaste** löst aus.
  Abgedeckte Container: **Auth-Screen (Login/Registrierung)**, Hauptmenü,
  **Einstellungen**, Credits, **Konto/Freunde-Overlay** und Beenden-Dialog
  (offene Overlays haben Vorrang). Neue Screens werden in die
  Container-Auswahl von `setupKeyboard()` eingehängt.
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
- **Einstellungen:** Die Kategorie-Reiter werden per ←/→ (bzw. A/D)
  angesteuert; der Fokus auf einen Reiter aktiviert ihn direkt
  (`activateSettingsTab()`).
- Fokus-Ring nur bei Tastatur-Bedienung (`:focus-visible`, gelber Rahmen) —
  Mausklicks erzeugen keinen Ring.
- **Esc**: schließt das offene Overlay (Beenden / Konto) bzw. führt von den
  Einstellungen **oder der Credits-Seite** zurück ins Menü.

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
