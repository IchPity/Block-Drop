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
