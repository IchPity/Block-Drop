# Smashin' Kurt — Fortschritts-Tracker

Interne Webanwendung, mit der das Team hinter der Diplomarbeit „Smashin'
Kurt" (prototypisches 2D-Multiplayer-Kampfspiel mit bis zu 4 Spielern und
mehreren spielbaren Charakteren) seinen Arbeitsstand festhält: Aufgaben,
Meilensteine und Termine an einem Ort. Der Zugang ist auf freigeschaltete
Teammitglieder beschränkt.

> Das Repository hieß vorher „Block Drop" und beherbergte eine Arcade-Seite.
> Deren Stand liegt weiterhin vollständig in der Git-History (letzter Commit
> mit Arcade-Inhalten: `1db9f76`).

## Aufbau

```
.
├── app/          Frontend (statisch) — wird als Cloudflare-Static-Asset ausgeliefert
├── db/           SQL-Skripte für das Supabase-Schema (einmalig im SQL-Editor ausführen)
├── tools/        lokale Dev-Helfer, nicht Teil des Deployments
├── worker.js     Cloudflare Worker: läuft vor den Assets
└── wrangler.jsonc
```

- **Frontend**: Vanilla HTML/CSS/JS, keine Frameworks, kein Build-Schritt
- **Backend**: Supabase (PostgreSQL + Auth)
- **Deployment**: Cloudflare Workers + Static Assets (`run_worker_first: true`)

## Design

Alles Design-Relevante lebt in `app/assets/style.css` als ein einziges,
gemeinsames Stylesheet für alle Seiten — kein Framework, keine
Komponentenbibliothek.

### Richtung

**„Blaue Stunde"** — tiefes Blauschwarz mit einer warmen Lichtquelle (Key)
und einem schwachen kühlen Fülllicht, dazu feines Filmkorn. Kinoartig, aber
still: die Fläche bewegt sich kaum, das Licht driftet langsam
(`@keyframes lightDrift`, 72 s), der Akzent markiert pro Ansicht bewusst nur
**eine** Sache — nie mehrere Elemente gleichzeitig.

### Farbe

| Token          | Wert                     | Rolle                                       |
| -------------- | ------------------------ | -------------------------------------------- |
| `--ink`        | `#080b12`                | Grundfläche                                  |
| `--ink-raised` | `#0f131d`                | angehobene Flächen (Dialog, Formularfelder)  |
| `--ink-line`   | `#1c2230`                | Haarlinien, Rahmen, Trenner                  |
| `--paper`      | `#e9edf4`                | Primärtext                                   |
| `--steel`      | `#78839a`                | Sekundärtext, Labels, Meta-Angaben           |
| `--lamp`       | `#f0b357`                | der einzige Akzent — die Lichtquelle         |
| `--lamp-soft`  | `rgba(240,179,87,.14)`   | Glow/Spotlight-Hintergründe                  |
| `--lamp-edge`  | `rgba(240,179,87,.38)`   | Akzent-Ränder, Fokus-Kanten                  |
| `--alarm`      | `#c65d4a`                | einziger Warnton — nur für kritische Verzögerung bei Meilensteinen |

Strikte Regel: `--lamp` ist der einzige warme Akzent im ganzen System. Er
taucht nie flächig auf, sondern als Punkt, Rand oder Glow — Wortmarke-Puls,
Hover-Rand auf Kacheln/Chips, aktiver Filter, Fortschrittsbalken, Fokusring.
`--alarm` ist bewusst die einzige zweite Farbe außerhalb der
Blauschwarz/Bernstein-Achse und ausschließlich für "kritisch verzögert"
reserviert (Meilenstein-Punkt, Fahrplan-Marke, Text-Tag).

### Typografie

Drei Google-Fonts, klar nach Rolle getrennt:

- **Instrument Serif** (kursiv) — `--font-display`: Wortmarke, Überschriften
  (`.headline`), Kachel-/Dialogtitel. Der einzige kursive, "geschriebene"
  Akzent im System.
- **Instrument Sans** — `--font-body`: Fließtext, Beschreibungen, Formularwerte.
- **IBM Plex Mono** — `--font-mono`: alles Label-artige — Eyebrows, Feld-Labels,
  Meta-Angaben (Datum, Rang, Termine), Buttons, Tags. Immer mit großzügigem
  `letter-spacing` und meist Versalien — signalisiert "System/Daten" im
  Gegensatz zum menschlichen Fließtext.

Schriftgrößen sind durchgehend `clamp()`-basiert (z. B. `.headline`:
`clamp(2.5rem, 1.4rem + 5.4vw, 5.25rem)`) statt fester Breakpoints — die
Fläche skaliert stufenlos mit dem Viewport.

### Layout & Raster

- `--gutter: clamp(1.25rem, 4vw, 3.5rem)` — seitlicher Innenabstand, überall.
- `--measure: 68rem` — maximale Inhaltsbreite für Textblöcke/Listen.
- `--band: clamp(3.75rem, 7vh, 4.75rem)` — Höhe von Kopf- und Fußband.
- Seitengerüst `.frame` ist ein dreizeiliges Grid: Kopfband (sticky, blur-
  Hintergrund) — Bühne (`.stage`) — Fußband.
- Kachel-/Karten-Raster nutzen `repeat(auto-fit, minmax(…))` statt fester
  Spaltenzahl — App-Kacheln (`.apps__grid`) sind bewusst **kein Quadrat**
  mehr, sondern flaches Querformat: bei einer Handvoll Apps frisst ein
  Quadrat nur unnötig Höhe.
- Ab `58rem` Breite stellt `.dash-grid` Lagebericht und Fortschritt
  nebeneinander statt gestapelt (Startseite + App "Meilensteine").
- Ein einziger Breakpoint nach unten (`max-width: 32rem`) für sehr schmale
  Viewports — passt Wortmarke, Kopfband-Abstände, Profil-Chip-Breite und
  den Anmelde-Dialog-Footer (Spalte statt Zeile) an.

### Zustände: Kino vs. Cockpit

Abgemeldet bleibt die Startseite bewusst kinoartig — große Headline,
zentrierte Bühne, viel Leerraum. Sobald jemand angemeldet ist
(`body.is-authenticated`), rückt die Bühne nach oben, Headline und Eyebrow
schrumpfen, Abstände straffen sich: aus der Heldenfläche wird ein
Arbeits-Cockpit, weil wer täglich reinschaut den Stand sehen will, nicht
erst durch Kino scrollen soll. App-Unterseiten (`.stage--app`) haben ihr
eigenes, kompakteres Headline-Format (`.headline--app`).

### Komponenten

- **Schaltflächen** (`.btn`): drei Varianten — Standard (Haarlinien-Rand,
  Mono-Schrift, Versalien), `--lamp` (gefüllt, für die eine Primäraktion
  pro Ansicht, z. B. Anmelden) und `--quiet` (randlos, Fließschrift, für
  Nebenaktionen wie Checkboxen/Filter). Aktive Filter bekommen `--active`
  (Text in `--lamp`).
- **App-Kacheln** (`.apps__tile`): Haarlinien-Rahmen, radialer Spotlight,
  der erst bei Hover/Fokus einblendet — der Lampen-Akzent bleibt "eine
  Sache pro Blick", nur zeitlich statt räumlich verteilt. Kacheln fahren
  beim Laden gestaffelt ein (`--tile-step`, 90 ms Versatz).
- **Anmelde-/Profil-Dialog** (`.sheet`, natives `<dialog>`): angehobene
  Fläche, weicher Schatten, eigene Ein-/Ausblend-Animation für Panel und
  Backdrop.
- **Formularfelder** (`.field`): Mono-Label in Versalien über dem Feld,
  Fokuszustand hebt Rand + Hintergrund in Richtung `--lamp-edge` an.
- **Listenzeilen** (`.datalist__row`): Primärtext links, Meta rechts,
  umbricht bei schmaler Breite; genutzt von Whitelist/Rang/Passwords/Meilensteinen.
- **Meilenstein-Zeilen** (`.milestone`, natives `<details>`): eine Zeile
  Zusammenfassung, Details erst per Klick — 27 Einträge mit voller
  Beschreibung wären sonst eine Textwand. Konfliktzeilen (Termin nach
  hinten verschoben, Nachfolger betroffen) bekommen einen linken
  Alarm-Rand.
- **Fahrplan/"Runway"** (`.runway`): horizontale Zeitachse, eine Spur pro
  Person, Position = Termin, eine "Heute"-Nadel; Klick auf eine Marke
  scrollt zur passenden Zeile in der Liste darunter.
- **Fortschrittsbalken** (`.progress__bar`): 4px hoch, gefüllt in `--lamp`,
  animiert bei Wertänderung.
- **Tags** (`.tag`): Mono, Versalien, standardmäßig `--steel`; `--fertig`
  wird `--paper` (heller, aber kein neuer Ton), `--kritisch` wird `--alarm`.

### Bewegung

- Ease-Kurve durchgehend `cubic-bezier(0.16, 1, 0.3, 1)` (`--ease-out`) —
  schnelles Ein-, sanftes Ausschwingen.
- Bewegung ist fast ausschließlich Auftritts-Choreografie: Elemente mit
  `[data-enter]` faden/schieben beim ersten Rendern herein, gesteuert über
  `--enter-step` (130 ms Versatz je Element). Danach ist die Fläche ruhig —
  keine Dauerschleifen außer dem sehr langsamen Lichtdrift und dem
  Wortmarke-Puls.
- `prefers-reduced-motion: reduce` ist Pflicht überall: Animationen/
  Übergänge werden auf ~0 gekürzt, `[data-enter]`- und Kachel-Elemente
  springen direkt in den Endzustand statt zu faden.

### Barrierefreiheit

- Sichtbarer Tastaturfokus ist Pflicht: `:focus-visible` bekommt überall
  einen 2px-Ring in `--lamp` mit 3px Abstand — keine Komponente darf den
  Browser-Default per `outline: none` stillschweigend entfernen.
- `[hidden] { display: none !important; }` global im Reset, weil
  Autor-Regeln wie `.btn`/`.account` sonst mit gleicher Spezifität gegen
  die UA-Regel für `hidden` gewinnen — jede neue Komponente mit eigenem
  `display:` + `hidden`-Attribut ist sonst betroffen.

**Verwandt:** Details je Route (welche Datei was ausliefert) stehen in
`app/README.md`.

## Entwicklung

```bash
npm run dev      # wrangler dev — Worker + Assets lokal
npm run deploy   # wrangler deploy
```

Nur das Frontend anschauen, ohne Worker davor:

```bash
cd app && python -m http.server 8791
```

## Stand & Fahrplan

**Phase 1 — Grundgerüst (erledigt).**
Startseite im abgemeldeten Zustand: Kopfband mit Anmelde-Schaltfläche,
Anmelde-Dialog als reine Optik, sonst bewusst leer. Designsystem steht
(siehe `app/README.md`).

**Phase 2 — Anmeldung.**
Supabase Auth. Nur vorab freigeschaltete E-Mail-Adressen können sich
anmelden; beim ersten Anmelden setzt die Person ihr Passwort selbst.

**Phase 3 — Inhalte (läuft).**
App "Meilensteine" bildet den DA-Plan ab: Admin bearbeitet Termine,
Zuweisung, Status und Kommentare sowie einen Lagebericht; alle
Teammitglieder sehen den vollen Fortschritt (Startseite + App) und haken
ausschließlich ihren eigenen Bereich ab. Team- und Admin-Bereich (Whitelist,
Rang, Passwords) stehen bereits aus Phase 2.

## Passwörter und Admin-Zugriff

Supabase Auth speichert Passwörter ausschließlich als Hash — auch mit dem
Service-Key sind sie nicht auslesbar. Der Admin-Bereich zeigt deshalb
Zugangsstatus und Anmeldezeitpunkte und erlaubt Zurücksetzen sowie
Einladungs-Links, aber keine Klartext-Passwörter.

## Geheimnisse

`.env.local` enthält den Supabase-Service-Key und ist über `.gitignore`
ausgeschlossen. Er gehört ausschließlich in lokales Admin-Tooling — niemals
ins Frontend und niemals in den Worker.
