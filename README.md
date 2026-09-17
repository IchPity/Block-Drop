# Der Automat der 5DK

> Drei Spiele, ein paar nützliche Sachen für dazwischen, und dein Stundenplan
> — alles auf einer Seite, kein zweiter Tab nötig.

Klassenwebsite der 5DK im Kreidetafel-Arcade-Look: Browser-Spiele,
Alltagshelfer (Stundenplan, Wetter, METAR, F1) und ein Konto-System mit
Freunden/Achievements — alles statisch gebaut, mit Supabase als Backend.
Dazu kommt **Block Games**, ein eigenständiges Electron-Partyspiel im
Mario-Party-Stil, das dieselben Konten nutzt.

Der Repo-Ordner heißt historisch bedingt noch „Block Drop" — von
2026-08-18 bis 2026-09-11 lief hier kurz ein Diplomarbeits-Fortschritts-
Tracker, der wieder verworfen wurde (Stand nur noch in der Git-History).
Seit 2026-09-11 ist wieder die Arcade-Seite aktiv.

## Struktur

```
app/                 Die Arcade-Website (statisches Frontend)
├─ index.html         Startseite mit dem Automaten-Grid
├─ auth.js            Supabase-Auth-Client, site-weit eingebunden
├─ theme.css           Design-System „Automat der 5DK"
├─ games/              Block Drop, Wörtle, Schach, SchulUhr
├─ stundenplan/        Echter Stundenplan der 5DK
├─ weather/, metar/, f1/, f1-wetten/   Alltagshelfer für die Klasse
├─ achievements/, freunde/, profile/, u/   Konto, Freunde, Erfolge
└─ datenschutz/, impressum/

block-games/          Electron-Partyspiel „Block Games" (eigenständige App,
                       eigene Doku: block-games/DOKUMENTATION.md + ROADMAP.md)

*.sql                 Supabase-Schema-Skripte (im SQL-Editor ausführen)
├─ arcade_backend_setup.sql     Aktuelles Schema: profiles, scores,
│                                leaderboard, f1_points, f1_bets
├─ friends_setup.sql            Freunde-Feature (Tabelle public.friends)
└─ tracker_backend_cleanup.sql  Räumt Reste des verworfenen
                                 Diplomarbeits-Trackers aus der DB

Schach/               Eigenständiges Java/Swing-Schachprojekt (Client/Server,
                       .iml/IntelliJ) — NICHT dasselbe wie app/games/schach,
                       kein Teil der Arcade

DiplData/             Private Unterlagen, gitignored, wird nie gepusht
```

## Tech-Stack

- **Frontend:** Vanilla HTML/CSS/JS, kein Build-Schritt, keine Frameworks
- **Backend:** [Supabase](https://supabase.com) (Postgres, Auth, Row Level
  Security) — der Publishable Key in `app/auth.js` ist bewusst im Klartext,
  RLS schützt die Daten
- **Block Games:** Electron 33, Three.js (lokal vendored), Supabase Realtime
  für Online-Sessions über Netzwerkgrenzen hinweg

## Entwicklung

**Arcade-Website:** rein statisch — `app/index.html` direkt öffnen oder den
Ordner `app/` mit einem beliebigen statischen Webserver ausliefern. Kein
`npm install` nötig.

**Block Games:**
```powershell
cd block-games
npm install
npm start
```
Alternativ: Doppelklick auf `block-games/Block Games starten.bat`.

## Deployment

Aktuell offen. Das frühere Cloudflare-Worker-Gate (`worker.js` +
`wrangler.jsonc`) wurde am 2026-09-11 beim Umstieg zurück auf die
Arcade-Seite entfernt — der Deploy-Weg für `app/` muss vor dem nächsten
Release neu geklärt werden.

## Lizenz

Privates Schulprojekt ohne Open-Source-Lizenz.
