# BlockDrop Arcade 🎮

Eine moderne Browser-basierte Arcade-Plattform mit klassischen Spielen, täglichen Challenges und nützlichen Tools. Alle Spiele laufen direkt im Browser — keine Installation, keine Komplikationen.

## Features

### Verfügbare Spiele & Tools

**Puzzle & Klassiker**
- **Block Drop** — Klassisches Fallblock-Puzzle (Tetris-ähnlich). Linien löschen, Level aufsteigen, High Scores brechen.
- **Tic Tac Toe** — Drei in einer Reihe lokal, online mit Codes oder gegen KI (leicht & unbesiegbar).
- **Jedno** — UNO im Browser. Wirf alle Karten ab, bevor die drei Bots es tun. Nur mit Account spielbar.
- **Wörtle** — Tägliches 5-Buchstaben-Wort-Rätsel in 6 Versuchen (deutsches Wordle).

**Action & Strategie**
- **WarShips** — Überlebe Welle um Welle. Dein Boot schießt selbstständig — rüste Schiff, Waffen und Zielsystem auf.
- **Block Clicker** — Idle/Clicker-Spiel. Klick Blöcke, kauf Fabriken und Portale, verdiene Milliarden passiv.

**Tools & Utilities**
- **SchulUhr** — Countdown-Timer für Pausen, Stundenende und Feierabend. Schulplan auf einen Blick.
- **Weather Dashboard** — Aktuell + 24h + 7 Tage Vorhersage mit Radar-Karte, UV-Index und Luftqualität. Favoriten cloud-synct.
- **METAR Browser** — Echtzeitwetterdaten für jeden Flughafen weltweit. ICAO-Code rein, METAR-Rohdaten und Decode raus.
- **Formel 1 Hub** — Live-Daten für Fahrer-WM, Konstrukteure und Race-Tracking. Echtzeit von der Strecke.
- **F1 Podium Wetten** — Tippe das Podium, verdiene Punkte. 1.000 Startpunkte pro Saison (mit Verlustrisiko). Nur mit Account.
- **Speedtest** — Messe Download, Upload, Ping und Jitter deiner Internetverbindung direkt im Browser.
- **Rechner** — Umfassender Rechner mit Grundrechnen, wissenschaftlichen Funktionen, Einheiten-Umrechnung und Programmierer-Modus (HEX/BIN/Bitweise).

### Bald verfügbar
- Snake
- Pong
- Space Blaster
- Memory Match
- Minesweeper

## Architektur

### Tech Stack
- **Frontend**: Vanilla HTML/CSS/JavaScript (keine Frameworks)
- **Backend**: Supabase (PostgreSQL + Auth + Echtzeit)
- **Deployment**: Cloudflare Workers (API/Auth-Gate) + Static Assets
- **Styling**: CSS3 mit modernen Animationen und responsive Design
- **Authentifizierung**: Supabase Auth (E-Mail & Benutzername)

### Projektstruktur

```
Block Drop/
├── app/                     # Frontend (statisches Single-Page-App)
│   ├── index.html          # Landing Page / Game-Übersicht
│   ├── auth.js             # Supabase Auth & User Management
│   ├── games/              # Game-Ordner
│   │   ├── blockdrop/      # Block Drop (Electron + Web)
│   │   ├── tictactoe/      # Tic Tac Toe
│   │   ├── jedno/          # Jedno (UNO)
│   │   ├── warships/       # WarShips
│   │   ├── blockclicker/   # Block Clicker
│   │   ├── schuluhr/       # SchulUhr
│   │   └── woertle/        # Wörtle
│   ├── weather/            # Weather Dashboard
│   ├── metar/              # METAR Browser
│   ├── f1/                 # F1 Hub
│   ├── f1-wetten/          # F1 Wetten
│   ├── speedtest/          # Speedtest
│   ├── rechner/            # Calculator
│   └── [weitere Tools]
├── db/                     # Supabase SQL-Skripte
│   ├── username_login_setup.sql
│   ├── friends_setup.sql
│   ├── messages_setup.sql
│   └── notifications_setup.sql
├── block-games/            # Electron-App (Block Drop Desktop)
├── worker.js               # Cloudflare Worker (Auth-Gate & API)
├── wrangler.toml           # Wrangler Konfiguration (Cloudflare)
├── package.json            # Dependencies
└── tools/                  # Build & Obfuscation Tools
```

## Development

### Voraussetzungen
- Node.js 16+
- Supabase Account & Projekt
- Cloudflare Account (für Deployment)

### Lokal starten

```bash
# Dependencies installieren
npm install

# Supabase starten (optional, für lokale DB)
supabase start

# Cloudflare Worker im Dev-Modus starten
npm run dev
```

Die App lädt dann unter `http://localhost:8787`.

### Umgebungsvariablen

`.env.local` (gitignored):
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key (for admin access)
```

## Deployment

### Statische Assets
Assets werden zu Cloudflare Static Assets hochgeladen:
```bash
npm run build
npm run deploy:static
```

### Cloudflare Worker
```bash
npm run deploy:worker
```

Der Worker dient als:
- Auth-Gate (validiert Supabase-Tokens)
- API-Proxy (requestiert externe APIs wie F1, Wetter, METAR)
- CORS-Handling

## Datenbank (Supabase)

Tabellen (angelegt via `db/*.sql`):
- **profiles** — Benutzerdaten (mit Freunde, Blocked-List, etc.)
- **games** — Highscores und Spielstatistiken
- **notifications** — Benachrichtigungen
- **messages** — Direktnachrichten zwischen Usern
- **f1_bets** — F1 Wetten-Records

RLS-Policies sperren den Direktzugriff ab — alle Änderungen laufen über API-Endpoints im Worker.

## Sicherheit

- ✅ Supabase Auth für sichere Authentifizierung
- ✅ RLS (Row Level Security) auf allen Tabellen
- ✅ Cloudflare Worker validiert alle Requests
- ✅ Sensitive Keys in `.env.local` (nicht im Repo)
- ✅ API-Calls von Server (nicht vom Client), um Keys zu schützen

## Browser-Support

- Chrome/Chromium 88+
- Firefox 87+
- Safari 14+
- Edge 88+
- Mobile-Browser (iOS Safari 13+, Chrome Mobile)

## Performance

- Lazy Loading von Game-Assets
- CSS Animations mit `will-change: transform` und GPU-Beschleunigung
- Komprimierte Assets via Cloudflare
- Staggered Card-Animationen für smoothe Page-Loads
- Magnetic 3D Tilt-Effekte auf Desktop (mit `prefers-reduced-motion` Respekt)

## Analytics & Fehlerbehandlung

- Supabase Logs für Datenbankaktivität
- Cloudflare Worker Logs für API-Zugriffe
- In-Browser Error Handling (graceful degradation)

## Maintenance

### Neue Games hinzufügen
1. Game-Ordner unter `app/games/` erstellen
2. `index.html` aktualisieren (neue Card zur Grid hinzufügen)
3. Game-spezifische Assets & Logik implementieren
4. Bei Bedarf Highscore-Tabelle in Supabase einrichten

### Neue Tools hinzufügen
1. Ordner unter `app/` erstellen
2. Externe API ins Worker-Routing aufnehmen
3. `index.html` Card hinzufügen
4. Responsive Design testen

## Known Issues & Roadmap

### Roadmap
- [ ] Snake, Pong, Space Blaster, Memory Match, Minesweeper (siehe "Bald verfügbar")
- [ ] Multiplayer-Lobbys für kompatible Games
- [ ] Achievements/Badges System
- [ ] Global Leaderboards
- [ ] Dark Mode Toggle (aktuell nur Dark Mode verfügbar)

### Bekannte Limitierungen
- Worker hat 50ms CPU-Limit pro Request (für externe APIs problematisch bei Overload)
- Supabase free tier: max. 50.000 Zeilen pro Tabelle
- Kein Offline-Modus (alle Daten live, keine Service-Worker PWA)

## Credits & Lizenzen

- **Supabase** — Open-Source Backend-as-a-Service
- **Cloudflare Workers** — Serverless Computing
- **Fonts** — Inter (Google Fonts)
- **Icons** — Inline SVG & CSS-Art

## Support & Kontakt

- **Bugs melden**: GitHub Issues (falls verfügbar)
- **Feedback**: Kontakt via Supabase Auth oder E-Mail
- **Developer**: Peter Scheikl (Peterscheikl10@gmail.com)

---

**Version**: 0.9.0  
**Letztes Update**: 2026-06-14  
**Status**: 🟢 Live & Actively Maintained
