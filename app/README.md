# app/ — Frontend

Statisches Frontend des Smashin'-Kurt-Fortschritts-Trackers. Wird von Cloudflare Workers
(`worker.js` im Projektstamm) als Static-Assets ausgeliefert.

```
app/
├── index.html         Startseite: Anmeldung, Lagebericht + Fortschritt, App-Kacheln
├── favicon.svg
├── assets/
│   ├── style.css      Tokens, Typografie, Grundgerüst — für alle Seiten
│   ├── errors.js      Rohe Supabase-/Fetch-Fehler in verständliche Sätze übersetzen
│   ├── auth.js        Supabase-Client, Kontoanzeige, Profil-Fenster, Rang-Guard, App-Registry
│   ├── datalist.js    Gemeinsame Bausteine für Listen-Apps (Zeile, Button, leerer Zustand)
│   ├── progress.js    Ampel-/Fortschritts-Berechnung aus Meilenstein-Daten (reine Logik)
│   ├── overview.js    Lagebericht + Fortschritt auf der Startseite
│   └── ui.js          Gemeinsame Oberflächen-Logik (Anmelde-Dialog)
├── meilensteine/      App: Plan-Übersicht, Admin bearbeitet, jede:r hakt Eigenes ab
├── whitelist/         App: neue E-Mails freischalten (Admin + Stellvertreter)
├── rang/              App: Ränge vergeben (Admin)
└── passwords/         App: Zugangsstatus & Anmeldungen (Admin)
```

## Designsystem

Richtung: **„Blaue Stunde"** — tiefes Blauschwarz, eine warme Lichtquelle,
ein kühles Fülllicht, feines Filmkorn. Kinoartig, aber still.

| Token         | Wert      | Rolle                              |
| ------------- | --------- | ---------------------------------- |
| `--ink`       | `#080b12` | Grundfläche                        |
| `--ink-raised`| `#0f131d` | Dialog, angehobene Flächen         |
| `--ink-line`  | `#1c2230` | Haarlinien, Rahmen                 |
| `--paper`     | `#e9edf4` | Primärtext                         |
| `--steel`     | `#78839a` | Sekundärtext, Labels               |
| `--lamp`      | `#f0b357` | einziger Akzent — die Lichtquelle  |

Schriften (Google Fonts): **Instrument Serif** (kursiv) für Titel und
Wortmarke, **Instrument Sans** für Fließtext, **IBM Plex Mono** für Labels
und Werte.

Regeln, die neue Seiten einhalten sollen:

- Der Akzent `--lamp` markiert genau eine Sache pro Ansicht.
- Struktur entsteht über Haarlinien und Weißraum, nicht über Kästen.
- Bewegung nur beim Auftritt (`data-enter` + `--enter-step`), sonst keine.
- `prefers-reduced-motion` und sichtbarer Tastaturfokus sind Pflicht.

## Stand

Phase 3: Inhalte. Anmeldung (Phase 2) läuft über Supabase Auth. Rang-System
und die Verwaltungs-Apps Whitelist/Rang/Passwords stehen. Die App
"Meilensteine" bildet den DA-Plan ab (siehe `db/milestones_setup.sql`):
Admin bearbeitet Termine/Zuweisung/Status/Kommentar und schreibt den
Lagebericht, alle anderen sehen den vollen Stand und haken nur den eigenen
Bereich ab — durchgesetzt per RLS + RPC, nicht nur im Frontend.
