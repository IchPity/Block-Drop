# app/ — Frontend

Statisches Frontend des Smashin'-Kurt-Fortschritts-Trackers. Wird von Cloudflare Workers
(`worker.js` im Projektstamm) als Static-Assets ausgeliefert.

```
app/
├── index.html        Startseite (abgemeldeter Zustand) + Anmelde-Dialog
├── favicon.svg
└── assets/
    ├── style.css     Tokens, Typografie, Grundgerüst — für alle Seiten
    └── ui.js         Gemeinsame Oberflächen-Logik (aktuell: Dialog)
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

Phase 1: Grundgerüst. Die Startseite zeigt Kopfband mit Anmelde-Schaltfläche
und sonst eine bewusst leere Bühne. Der Anmelde-Dialog ist reine Optik —
die eigentliche Anmeldung (Supabase Auth) kommt im nächsten Schritt.
