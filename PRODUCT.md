# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Schülerinnen und Schüler der Klasse 5DK (abgeleitet aus README und Seitentexten, nicht im Interview bestätigt). Sie öffnen die Seite in der Schule und daheim, am Schul-Laptop und am Handy, meist zwischendurch: in der Pause, in einer Freistunde, kurz vor Stundenende.

## Product Purpose

„Der Automat der 5DK" ist die Klassenwebsite der 5DK: Browser-Spiele, Alltagshelfer fürs Schulleben und ein Konto-System mit Freunden, Erfolgen und Bestenlisten, alles auf einer Seite. Erfolg heißt: die Klasse kommt gern wieder, spielt, vergleicht Punkte und findet Stundenplan und Uhr ohne Umweg.

## Positioning

Eine Seite, die nur dieser Klasse gehört: der echte Stundenplan der 5DK, Schul-Insider in den Spielen (Hausmeister Jürgen, Matura, Schulglocke, Pensions-Presse) und gemeinsame Bestenlisten.

## Operating Context

- Spiele: Block Drop (Fallblock), Block Presser (Idle-Klicker mit Matura, Meilensteinen, Spezialpunkten), Casino mit Spielgeld (Automat mit drei Modi, Roulette, Blackjack, Aufladen, Belege).
- Für die Klasse: Stundenplan, SchulUhr, Weather Dashboard, METAR Browser, Formel 1 Hub, F1 Podium Wetten, Achievements.
- Konto: Profil, Freunde, öffentliche Profile (`/u`).
- Block Games: eigenständiges Electron-Partyspiel mit eigener Download-Seite.
- Fünf Spiele sind angekündigt und noch nicht spielbar (Snake, Pong, Space Blaster, Memory Match, Minesweeper).

## Capabilities and Constraints

- Vanilla HTML/CSS/JS, kein Build-Schritt, keine Frameworks. Jede Seite ist eine eigene `index.html` mit Inline-Styles; geteilt werden `app/theme.css` und `app/auth.js`.
- Backend ist Supabase (Auth, Postgres, RLS).
- Push auf `main` deployt `app/` automatisch über Cloudflare Workers Builds. Gearbeitet wird direkt auf `main`.
- Das Casino arbeitet ausschließlich mit Spielgeld.
- Muss auf Schul-Laptops und Handys laufen.

## Brand Commitments

- Name: „Der Automat der 5DK" / „Arcade".
- Sprache: Deutsch (österreichisch), locker, mit Schulhumor.
- Visuelle Welt (vom Nutzer am 2026-10-02 festgelegt): Arcade-Halle bei Nacht. Der bisherige Kreidetafel-Look wird ersetzt.
- Anspruch (vom Nutzer festgelegt): so aufwendig und cineastisch wie möglich, auch in den Spielfeldern selbst („alles volle Kanne").

## Evidence on Hand

- Echte Inhalte aller Seiten unter `app/`.
- Keine Fotos, keine Logos außer den SVG-Favicons. Keine echten Personennamen für Abspann oder Ähnliches verwenden.

## Product Principles

- Die Seite gehört der Klasse: Insider vor Allgemeinplätzen.
- Spielen kommt zuerst, die Helfer bleiben trotzdem in Sekunden erreichbar.
- Spektakel darf nie verhindern, dass man Stundenplan, Uhr oder Kontostand lesen kann.
- Fortschritt wird gefeiert: jeder Meilenstein bekommt seinen Moment.

## Accessibility & Inclusion

`prefers-reduced-motion` wird seitenweit respektiert. Tastaturbedienung und sichtbarer Fokus bleiben erhalten.
