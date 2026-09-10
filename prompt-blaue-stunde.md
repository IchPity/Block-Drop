# Bau-Prompt: Web-App „Blaue Stunde"

> **Vor dem Absenden:** Alle `[…]`-Platzhalter in Abschnitt 0 ersetzen. Der Rest ist fertig und kann unverändert kopiert werden.
> Wenn du die Seite in mehreren Durchgängen bauen lässt: Abschnitte 1–6 und 12–14 bleiben in **jedem** Prompt drin, Abschnitt 10 kürzt du auf die gerade gebaute Route.

---

## 0. Projektkontext (ausfüllen)

- **Projektname / Wortmarke:** Smashin' Kurt
- **Zweck in einem Satz:** Fortschritts-Tracker für die Diplomarbeit — Meilensteine, Fahrplan und Team-Zugriff an einem Ort statt verteilt über Excel und Chats.
- **Stack:** statisches HTML + Vanilla-JS (ES-Module), kein Build-Schritt.
- **Datenquelle:** Supabase (Postgres) über den `supabase-js`-Client direkt im Browser, Zugriff über RLS-Regeln und RPCs statt eigenem Backend.
- **Authentifizierung:** Supabase Auth (E-Mail/Passwort) über `signInWithPassword`/`signUp` im selben Formular; Whitelist-Gate serverseitig per DB-Trigger (nicht nur im Frontend).
- **Zielgruppe / Nutzungsfrequenz:** 3-köpfiges DA-Team (Admin, Stellvertreter, Mitarbeiter, dazu ein reiner Zuschauer-Rang), tägliche Kurzbesuche zum Stand-Check.
- **Deployment:** Cloudflare Workers mit Static Assets (nicht Pages), Zugriff zusätzlich über ein Code-Gate in `worker.js` gesperrt.
- **Bereits vorhanden:** `app/README.md` mit Routen-Übersicht, `app/assets/style.css` vollständig nach dieser Spezifikation umgesetzt (siehe Abschnitte 3–9) — bei Erweiterungen bestehende Tokens/Komponenten wiederverwenden statt neu zu erfinden.

Oberflächensprache ist **Deutsch** (Du-Form vermeiden, neutrale Beschriftungen: „Anmelden", „Abmelden", „Filter").

---

## 1. Auftrag

Du baust eine vollständige, lauffähige Web-App nach der unten vollständig spezifizierten Design-Sprache. Liefere echten, fertigen Code — keine `// TODO`-Kommentare, keine Platzhalterfunktionen, keine „hier würdest du…"-Stellen. Jede genannte Route, Komponente und jeder Zustand muss existieren und funktionieren.

Wenn eine Information fehlt: triff eine begründete, konservative Annahme, setze sie um und liste sie am Ende unter **„Getroffene Annahmen"** auf. Frage nicht zurück, sondern liefere.

---

## 2. Harte Rahmenbedingungen

1. **Genau ein Stylesheet:** `app/assets/style.css`. Kein zweites CSS-File, kein `<style>`-Block, kein Framework, keine Komponentenbibliothek, kein Tailwind, kein Bootstrap, kein CSS-in-JS, kein Preprocessor.
2. **Inline-`style` nur für berechnete Werte** — also für `--tile-step`, `--enter-step`, Fortschrittswerte, Runway-Positionen. Alles andere gehört ins Stylesheet.
3. **Vanilla JavaScript**, ES-Module, keine Laufzeit-Abhängigkeiten, kein Build-Schritt (sofern Abschnitt 0 nichts anderes sagt).
4. **Semantisches HTML zuerst:** natives `<dialog>` für Dialoge, natives `<details>`/`<summary>` für aufklappbare Zeilen, `<button>` für Aktionen, `<a>` für Navigation, echte `<label for>`-Verknüpfungen, Landmarks (`header`/`main`/`footer`/`nav`).
5. **Progressive Enhancement:** Ohne JavaScript bleiben Inhalte lesbar und die Navigation funktioniert. JS verbessert (Filter, Dialog, Auftritts-Animation), es trägt nicht.
6. **Keine externen Assets außer den drei Google-Fonts.** Keine Icon-Bibliothek — Symbole, falls überhaupt nötig, als Inline-SVG mit `currentColor`.
7. **Keine Bilder als Design-Träger.** Die Fläche entsteht aus Farbe, Licht, Korn und Typografie.

---

## 3. Design-Tokens — wörtlich so in `:root` anlegen

```css
:root {
  /* Farbe */
  --ink:        #080b12;                    /* Grundfläche */
  --ink-raised: #0f131d;                    /* angehobene Flächen: Dialog, Formularfelder */
  --ink-line:   #1c2230;                    /* Haarlinien, Rahmen, Trenner */
  --paper:      #e9edf4;                    /* Primärtext */
  --steel:      #78839a;                    /* Sekundärtext, Labels, Meta */
  --lamp:       #f0b357;                    /* EINZIGER Akzent — die Lichtquelle */
  --lamp-soft:  rgba(240,179,87,.14);       /* Glow, Spotlight-Hintergründe */
  --lamp-edge:  rgba(240,179,87,.38);       /* Akzent-Ränder, Fokus-Kanten */
  --alarm:      #c65d4a;                    /* einziger Warnton — nur kritische Verzögerung */

  /* Typografie */
  --font-display: "Instrument Serif", Georgia, serif;   /* nur kursiv verwendet */
  --font-body:    "Instrument Sans", system-ui, sans-serif;
  --font-mono:    "IBM Plex Mono", ui-monospace, monospace;

  /* Raster */
  --gutter:  clamp(1.25rem, 4vw, 3.5rem);
  --measure: 68rem;
  --band:    clamp(3.75rem, 7vh, 4.75rem);

  /* Bewegung */
  --ease-out:   cubic-bezier(0.16, 1, 0.3, 1);
  --enter-step: 130ms;
  --tile-step:  90ms;
}
```

**Unverhandelbare Farbregeln:**

- `--lamp` ist der **einzige** warme Akzent im gesamten System. Er erscheint **nie flächig**, sondern nur als Punkt, Rand oder Glow: Wortmarken-Puls, Hover-Rand auf Kacheln und Chips, aktiver Filter, Fortschrittsbalken, Fokusring, gefüllte Primärschaltfläche (genau eine pro Ansicht).
- **Pro Ansicht markiert der Akzent bewusst genau eine Sache.** Nie mehrere Elemente gleichzeitig. Wenn du dich zwischen zwei Akzenten entscheiden musst, gewinnt die Primäraktion.
- `--alarm` ist die einzige zweite Farbe außerhalb der Blauschwarz/Bernstein-Achse und **ausschließlich** für „kritisch verzögert" reserviert (Meilenstein-Punkt, Fahrplan-Marke, Text-Tag, linker Rand einer Konfliktzeile). Nirgends sonst — kein Fehler-Toast, kein Formular-Fehler, kein „Löschen"-Button in `--alarm`.
- Keine weiteren Farben. Kein Grün für „erledigt": `--fertig` wird `--paper` (heller, aber kein neuer Ton).
- Keine reinen Schwarz-/Weißwerte (`#000`, `#fff`) irgendwo im Stylesheet.

**Atmosphäre:** Grundfläche `--ink` mit einer warmen Lichtquelle (Key) und einem schwachen kühlen Fülllicht — als weiche Radial-Gradients auf einem fixierten Pseudo-Element hinter dem Inhalt. Dazu feines Filmkorn (SVG-`feTurbulence` als Data-URI oder wiederholtes Rausch-Pattern, sehr niedrige Opazität, `pointer-events: none`). Das Licht driftet über `@keyframes lightDrift` mit **72 s** Dauer, `linear`, `infinite`, `alternate` — kaum wahrnehmbar. Die Fläche selbst bewegt sich nicht.

---

## 4. Typografie

Drei Google-Fonts, streng nach Rolle getrennt — Rollen niemals mischen:

| Rolle | Font | Verwendung |
|---|---|---|
| Display | **Instrument Serif**, *kursiv* | Wortmarke, `.headline`, Kachel- und Dialogtitel. Der einzige kursive, „geschriebene" Akzent im System. |
| Body | **Instrument Sans** | Fließtext, Beschreibungen, Formularwerte. |
| Mono | **IBM Plex Mono** | Alles Label-artige: Eyebrows, Feld-Labels, Meta-Angaben (Datum, Rang, Termine), Buttons, Tags. Immer großzügiges `letter-spacing`, meist Versalien. Signalisiert „System/Daten" im Gegensatz zum menschlichen Fließtext. |

- Fonts über `<link rel="preconnect">` + eine gebündelte `fonts.googleapis.com`-URL laden, `display=swap`, nur die tatsächlich genutzten Schnitte.
- **Alle** Schriftgrößen `clamp()`-basiert, keine festen Breakpoint-Sprünge. Referenz: `.headline { font-size: clamp(2.5rem, 1.4rem + 5.4vw, 5.25rem); }` — dieselbe Formel-Logik (Minimum, `rem + vw`-Mischung, Maximum) für alle anderen Größen.
- Fließtext auf `--measure` (68rem) begrenzt, Zeilenhöhe großzügig (~1.6), Mono-Labels eng gesetzt (~1.2) und in `--steel`.

---

## 5. Layout & Raster

- `--gutter` ist der seitliche Innenabstand **überall** — nie ein anderer Wert.
- Seitengerüst `.frame` = dreizeiliges Grid: **Kopfband** (sticky, `backdrop-filter: blur(...)`, halbtransparenter `--ink`) → **Bühne `.stage`** → **Fußband**. Kopf- und Fußband haben die Höhe `--band`.
- Kachel- und Karten-Raster nutzen `repeat(auto-fit, minmax(…, 1fr))`, **niemals** feste Spaltenzahlen.
- **App-Kacheln (`.apps__grid`) sind flaches Querformat, kein Quadrat** — bei einer Handvoll Apps frisst ein Quadrat nur unnötig Höhe. `minmax()` entsprechend breit wählen, Kachelhöhe über Padding und Inhalt statt `aspect-ratio`.
- Ab **58rem** Breite stellt `.dash-grid` Lagebericht und Fortschritt nebeneinander statt gestapelt (betrifft Startseite und App „Meilensteine").
- **Genau ein Breakpoint nach unten:** `@media (max-width: 32rem)` — passt an: Wortmarke, Kopfband-Abstände, Profil-Chip-Breite, Anmelde-Dialog-Footer (Spalte statt Zeile). Sonst keine weiteren Media-Queries für Layout; alles andere skaliert stufenlos über `clamp()` und `auto-fit`.

---

## 6. Zwei Zustände: Kino vs. Cockpit

Das ist das zentrale Verhaltensmerkmal — nicht wegoptimieren.

- **Abgemeldet** ist die Startseite bewusst **kinoartig**: große Headline, zentrierte Bühne, viel Leerraum, ruhiger Auftritt.
- **Angemeldet** (`body.is-authenticated`) wird daraus ein **Arbeits-Cockpit**: Bühne rückt nach oben, Headline und Eyebrow schrumpfen, Abstände straffen sich. Begründung: Wer täglich reinschaut, will den Stand sehen und nicht erst durch Kino scrollen.
- Der Wechsel läuft rein über die Klasse `body.is-authenticated` im CSS — kein zweites Template, keine JS-gesteuerten Inline-Styles.
- **App-Unterseiten** nutzen `.stage--app` mit eigenem, kompakterem Headline-Format `.headline--app`.
- Die Klasse muss beim ersten Rendern gesetzt sein (serverseitig oder synchron vor dem Paint), damit es kein sichtbares Umspringen gibt.

---

## 7. Komponenten

Klassennamen exakt so übernehmen. Jede Komponente braucht: Ruhezustand, `:hover`, `:focus-visible`, `:disabled` (wo sinnvoll), aktiven Zustand.

**Schaltflächen `.btn`** — drei Varianten:
- Standard: Haarlinien-Rand `--ink-line`, Mono-Schrift, Versalien, transparenter Grund.
- `.btn--lamp`: gefüllt in `--lamp`, Text in `--ink`. **Genau eine pro Ansicht** (z. B. „Anmelden").
- `.btn--quiet`: randlos, Fließschrift, für Nebenaktionen wie Checkboxen und Filter.
- `.btn--active` (für aktive Filter): Text in `--lamp`.

**App-Kacheln `.apps__tile`** — Haarlinien-Rahmen, radialer Spotlight in `--lamp-soft`, der **erst bei `:hover`/`:focus-visible` einblendet**: der Lampen-Akzent bleibt „eine Sache pro Blick", nur zeitlich statt räumlich verteilt. Kacheln fahren beim Laden gestaffelt ein (`--tile-step`, 90 ms Versatz je Kachel, per Inline-`--i` oder `:nth-child`). Ganze Kachel ist der Link, Titel in Display-Kursiv.

**Anmelde-/Profil-Dialog `.sheet`** — natives `<dialog>`, `showModal()`. Angehobene Fläche `--ink-raised`, weicher Schatten, eigene Ein- und Ausblend-Animation für Panel **und** Backdrop (`::backdrop`). Schließen per Esc, per Klick auf den Backdrop und per Schließen-Schaltfläche; Fokus beim Öffnen ins erste Feld, beim Schließen zurück auf den Auslöser.

**Formularfelder `.field`** — Mono-Label in Versalien **über** dem Feld, Feldgrund `--ink-raised`, Haarlinien-Rand. Fokuszustand hebt Rand und Hintergrund in Richtung `--lamp-edge` an. Fehlermeldung als Text unter dem Feld, mit `aria-describedby` verknüpft, in `--steel`/`--paper` — **nicht** in `--alarm`.

**Listenzeilen `.datalist__row`** — Primärtext links, Meta rechts, umbricht bei schmaler Breite in zwei Zeilen. Genutzt von Whitelist, Rang, Passwords und Meilensteinen. Trenner als Haarlinie `--ink-line`.

**Meilenstein-Zeilen `.milestone`** — natives `<details>`: eine Zeile Zusammenfassung, Details erst per Klick (27 Einträge mit voller Beschreibung wären sonst eine Textwand). Konfliktzeilen (Termin nach hinten verschoben, Nachfolger betroffen) bekommen einen linken Rand in `--alarm`. `<summary>` muss per Tastatur bedienbar und der Marker gestaltet sein.

**Fahrplan `.runway`** — horizontale Zeitachse, **eine Spur pro Person**, Position auf der Achse = Termin, dazu eine „Heute"-Nadel. Klick auf eine Marke scrollt zur passenden Zeile in der Liste darunter (`scrollIntoView({ behavior: 'smooth', block: 'center' })`, plus kurzes Hervorheben der Zielzeile) und respektiert `prefers-reduced-motion`. Marken sind `<button>`s mit sprechendem `aria-label` (Name, Meilenstein, Datum). Horizontal scrollbar auf schmalen Viewports.

**Fortschrittsbalken `.progress__bar`** — 4 px hoch, Füllung in `--lamp`, animiert bei Wertänderung. Wrapper mit `role="progressbar"` und `aria-valuenow/min/max`.

**Tags `.tag`** — Mono, Versalien, Standard `--steel`; `.tag--fertig` → `--paper`; `.tag--kritisch` → `--alarm`.

**Profil-Chip `.account`** — im Kopfband, öffnet den Profil-Dialog; im abgemeldeten Zustand steht dort die Anmelde-Aktion. Eigene Breitenregel im 32rem-Breakpoint.

**Wortmarke** — Display-Kursiv mit langsamem Puls in `--lamp` (sehr geringe Amplitude, lange Dauer). Zusammen mit `lightDrift` die **einzigen** Dauerschleifen im gesamten System.

---

## 8. Bewegung

- Ease-Kurve durchgehend `var(--ease-out)` = `cubic-bezier(0.16, 1, 0.3, 1)` — schnelles Ein-, sanftes Ausschwingen. Keine andere Kurve im Stylesheet.
- Bewegung ist **fast ausschließlich Auftritts-Choreografie**: Elemente mit `[data-enter]` faden und schieben beim ersten Rendern herein, gestaffelt über `--enter-step` (130 ms Versatz je Element). Danach ist die Fläche ruhig.
- **Keine** Dauerschleifen außer `lightDrift` (72 s) und dem Wortmarken-Puls. Keine Karussells, keine Skeleton-Shimmer, keine Parallax-Effekte, keine Scroll-Animationen.
- Zustandswechsel (Hover, Fokus, Filter, Fortschritt, Dialog) dürfen animieren, aber kurz (120–260 ms).

---

## 9. Barrierefreiheit — Pflicht, nicht optional

```css
*:focus-visible {
  outline: 2px solid var(--lamp);
  outline-offset: 3px;
}

[hidden] { display: none !important; }   /* im Reset, ganz oben */

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
  [data-enter], .apps__tile { opacity: 1 !important; transform: none !important; }
}
```

- **Sichtbarer Tastaturfokus überall.** Keine Komponente darf den Browser-Default per `outline: none` stillschweigend entfernen.
- `[hidden] { display: none !important; }` gehört global in den Reset, **weil** Autor-Regeln wie `.btn` oder `.account` mit eigenem `display:` sonst bei gleicher Spezifität gegen die UA-Regel für `hidden` gewinnen. Jede neue Komponente mit eigenem `display:` und `hidden`-Attribut wäre sonst betroffen.
- `prefers-reduced-motion: reduce` überall: `[data-enter]`- und Kachel-Elemente springen direkt in den Endzustand statt zu faden.
- Kontrast: Fließtext (`--paper` auf `--ink`) und Primäraktion sicher über 4.5:1. `--steel` nur für Sekundärtext, dort mindestens 4.5:1 nachweisen — sonst Ton minimal aufhellen und im Token-Kommentar vermerken.
- Zustand nie allein über Farbe: „kritisch verzögert" trägt zusätzlich Text-Tag und Randmarkierung.
- Tastaturreihenfolge folgt der optischen Reihenfolge; Skip-Link zum Hauptinhalt; `aria-live="polite"` für Filterergebnis-Anzahl und Anmeldefehler; Fokusfalle im offenen Dialog.

---

## 10. Routen und Inhalte

Setze diese Routen um (Details zu den Dateien je Route gehören nach `app/README.md`):

1. **Startseite `/`** — abgemeldet: Kino-Bühne mit Eyebrow, `.headline`, kurzem Absatz und Anmelde-Primäraktion. Angemeldet: Cockpit mit `.dash-grid` (Lagebericht links, Fortschritt rechts ab 58rem) und darunter das Raster der App-Kacheln `.apps__grid`.
2. **Meilensteine** — `.dash-grid` mit Fortschritt, darunter der Fahrplan `.runway` und die Liste aus `.milestone`-Zeilen mit Filtern (`.btn--quiet` / `.btn--active`), Tags und Alarm-Rand bei Konflikten.
3. **Whitelist** — `.datalist__row`-Liste, Suche/Filter, Hinzufügen und Entfernen.
4. **Rang** — `.datalist__row`-Liste mit Rang als Meta-Angabe in Mono.
5. **Passwords** — `.datalist__row`-Liste; Werte standardmäßig maskiert, Aufdecken und Kopieren als bewusste Aktion, kein Klartext im DOM vor dem Aufdecken.
6. **Anmelden / Profil** — als `.sheet`-Dialog von jeder Seite aus erreichbar, nicht als eigene Seite.

*(Anpassen an die reale Routenliste aus `app/README.md`.)*

Für jede Liste: **Leerzustand**, **Ladezustand** und **Fehlerzustand** ausformulieren — jeweils ein kurzer Satz in `--steel`, Mono-Eyebrow darüber, keine Illustration, keine Ausrufezeichen.

---

## 11. Code-Konventionen

- CSS-Reihenfolge im Stylesheet: `@import`/Fonts → Reset inkl. `[hidden]` → Tokens (`:root`) → Grundtypografie → Gerüst (`.frame`, `.stage`, Bänder) → Komponenten alphabetisch oder nach Auftreten → Zustände (`body.is-authenticated`) → Keyframes → `@media (max-width: 32rem)` → `prefers-reduced-motion`. Kurze Kommentar-Überschriften pro Block.
- Klassennamen wie bereits vorhanden: Block `__Element` `--Modifikator`.
- Keine ID-Selektoren fürs Styling, keine `!important` außer bei `[hidden]` und im Reduced-Motion-Block, maximal drei Ebenen Verschachtelung an Selektoren.
- JS: kleine Module pro Aufgabe (`dialog.js`, `filters.js`, `runway.js`, `enter.js`), keine globalen Variablen, Event-Delegation wo sinnvoll, keine `innerHTML`-Zuweisung mit Nutzerdaten.

---

## 12. Abnahmekriterien — vor der Abgabe selbst durchgehen

- [ ] Es existiert genau **ein** Stylesheet, `app/assets/style.css`, ohne Framework-Reste.
- [ ] `--lamp` erscheint pro Ansicht an **einer** Stelle als Akzent, nie flächig.
- [ ] `--alarm` erscheint ausschließlich bei „kritisch verzögert".
- [ ] Jede Schriftgröße nutzt `clamp()`; kein Layout-Breakpoint außer `max-width: 32rem` und `min-width: 58rem` für `.dash-grid`.
- [ ] Kachel- und Kartenraster nutzen `auto-fit`/`minmax`, App-Kacheln sind Querformat.
- [ ] `body.is-authenticated` verändert Startseite messbar (Bühne oben, kleinere Headline, engere Abstände) — ohne Umspringen beim Laden.
- [ ] Tab durch jede Seite: Fokusring auf **jedem** interaktiven Element sichtbar, Reihenfolge logisch, Dialog hält den Fokus.
- [ ] Mit `prefers-reduced-motion: reduce` ist die Seite statisch und vollständig sichtbar.
- [ ] Ohne JavaScript sind alle Inhalte lesbar und Links funktionieren.
- [ ] Kein `outline: none` ohne Ersatz, kein `#000`/`#fff`, keine Farbe außerhalb der Tokens.
- [ ] Leer-, Lade- und Fehlerzustand existieren für jede Liste.
- [ ] `app/README.md` beschreibt je Route, welche Datei was ausliefert.

---

## 13. Anti-Ziele — ausdrücklich nicht tun

Kein zweiter Akzentton „für Erfolg". Keine Farbverläufe über Flächen. Keine Schatten als Dekoration (nur der Dialog hat einen). Keine abgerundeten Ecken über das im bestehenden Stylesheet etablierte Maß hinaus. Keine Icon-Bibliothek. Keine Toast-Notifications. Keine Dauer-Animationen. Keine Emoji in der Oberfläche. Kein Ausbau der Kacheln zu Quadraten. Keine Utility-Klassen-Wolke im Markup.

---

## 14. Lieferumfang

1. Vollständige Dateien mit Pfadangabe, jede in einem eigenen Codeblock.
2. `app/assets/style.css` komplett, kommentiert nach der Reihenfolge aus Abschnitt 11.
3. `app/README.md` mit Routen-Übersicht (welche Datei liefert was aus).
4. Am Ende: kurze Liste **„Getroffene Annahmen"** und **„Bewusste Abweichungen"** (falls es welche gibt, jeweils mit einem Satz Begründung).
