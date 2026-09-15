# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Der Autor selbst (Peter) und seine Freunde. Zwei Spielweisen sind
gleichberechtigt, nicht nur eine der Fallback für die andere:

- **Solo gegen Bots** — vollständig lobbyfähig ohne jeden anderen Menschen.
- **Mit Freunden am selben PC**, auch wenn nur 2 oder 3 Menschen da sind —
  die restlichen Lobby-Plätze werden dann mit Bots aufgefüllt statt eine
  volle Menschen-Lobby zu verlangen.

Perspektivisch: breitere Verteilung an mehr Leute (z.B. Mitschüler), nicht
nur der enge Freundeskreis — siehe Evidence/Constraints zu electron-builder.

## Product Purpose

Party-Minigame-Sammlung im Mario-Party-Stil ("Block Games", Teil der
"Block-Drop Arcade") für gemeinsames Spielen an einem PC — aktuell zwei
Last-Man-Standing-Minigames (Block Bomb, Laser Lines), weitere geplant
(siehe ROADMAP.md). Erfolg bedeutet: jederzeit sofort spielbar, egal ob
allein, zu zweit oder in voller Runde, ohne dass Technik oder Bedienung im
Weg steht.

## Positioning

Baut die Architektur von Anfang an online-tauglich, ohne online zu sein:
Figuren werden nie direkt gesteuert, sondern nur über einen austauschbaren
Controller (lokaler Mensch / Bot-KI / späterer Remote-Peer), und alle
Minigames teilen sich einen generischen Match-Flow (Voting → Countdown →
Runde → Ranking), dieselbe Bot-KI und dasselbe Farbsystem. Der Umstieg auf
echtes Online-Spiel soll später ein reiner Controller-Tausch sein, kein
Umbau des Spielkerns.

## Operating Context

- Electron-Desktop-App unter Windows, startet immer im Vollbild (F11 zum
  Umschalten), kein natives App-Menü.
- Start aktuell über `Block Games starten.bat` (startet Electron direkt aus
  `node_modules`) oder `npm start`; Node.js liegt beim Autor portabel auf
  `D:\`.
- Login läuft gegen dasselbe Supabase-Backend wie die Block-Drop-Website
  (`app/`) — bestehende Website-Konten funktionieren direkt. Gast-Modus
  ohne Konto ist vollwertig unterstützt (nur ohne Online-Funktionen).
- `electron-builder`-Konfiguration liegt bereits in `package.json` vor
  (App-Icon, App-ID) — vorbereitet für spätere Installer-Pakete, wenn das
  Spiel an mehr Leute verteilt wird.

## Capabilities and Constraints

- **Volle Tastatursteuerung ist verbindlich, nicht optional**: jeder Screen
  und jedes Overlay muss komplett ohne Maus bedienbar sein (Pfeiltasten
  oder WASD navigieren, Enter/Leertaste löst aus, Esc geht zurück) —
  gilt für jedes aktuelle und künftige Minigame/Menü.
- **Nur ein lokaler menschlicher Controller existiert aktuell**
  (`LocalHumanController`, WASD/Pfeile, ein Tastatur-Layout). Mehrere
  gleichzeitige lokale Menschen auf einem PC (Couch-Multiplayer mit
  getrennten Tastenbelegungen) ist laut Nutzer ein bestätigtes Ziel, aber
  **noch nicht implementiert** — aktuell steuert nur P1, weitere Slots sind
  Bot oder (perspektivisch) Freund/Remote.
- **Bot-Schwierigkeit immer Mittel oder Schwer**, nie „Leicht" — Ausnahme:
  der Tutorial-Schnellstart aus dem Hauptmenü erzwingt bewusst „Easy"-Bots
  zum Erlernen des Spiels.
- **Jeder Spielmodus bekommt genau 3 Maps** plus Map-Voting vor der Runde
  (Mehrheit entscheidet, Gleichstand zufällig).
- Zwei Minigames aktuell im Registry-basierten, generischen Match-Flow:
  Block Bomb (Bombe weitergeben, Last-Man-Standing) und Laser Lines (Laser
  ausweichen, 3 Leben). Teilen sich Bot-KI (`botAI.js`), Controller-
  Abstraktion, Farbsystem aus der Lobby und die `#mg*`-Overlays.
- Online-/Freundes-Spiel ist architektonisch vorbereitet (Freunde-API gegen
  Supabase, `RemoteController`-Stub, Einladungs-Overlay mit Test-Trigger),
  aber **noch nicht verdrahtet** — Lobby-Freundeseinladung ist bisher rein
  lokale Konfiguration ohne echte Netzwerkverbindung.
- Kein Obfuskieren des Codes in `block-games/` (im Gegensatz zur Website)
  — bleibt immer Klartext. Jede Code-Änderung wird in `DOKUMENTATION.md`
  protokolliert.
- Kein Audio-Dateien-Bedarf: alle Sounds werden per WebAudio synthetisiert
  (Offline-Fähigkeit + CSP `default-src 'self'`).

## Brand Commitments

- Name „Block Games" innerhalb der „Block-Drop Arcade". Eigenes Marken-Icon
  (goldener Arcade-Power-Block mit „B") — bewusst **kein** Mario-?-Block-
  Zitat, obwohl das Spielprinzip Mario-Party-artig ist.
- Credits listen aktuell ausschließlich „Peter Scheikl".

## Evidence on Hand

- Laufende, ausführliche technische Doku in `block-games/DOKUMENTATION.md`
  (jede Änderung protokolliert) und geplante Punkte in
  `block-games/ROADMAP.md`.
- Keine externen Testimonials/Nutzerforschung — Hobby-Projekt des Autors,
  informelles Playtesting mit Freunden.

## Product Principles

1. Jeder Screen ist ohne Maus vollständig bedienbar — keine Ausnahmen, auch
   nicht für neue Minigames oder Overlays.
2. Alleine-Spielen ist gleichwertig zu Mehrspieler, nicht dessen Notlösung:
   fehlende Menschen werden durch Bots (Mittel/Schwer) ersetzt statt eine
   volle Lobby zu verlangen.
3. Die Spiellogik kennt nie, wer eine Figur steuert — lokaler Mensch, Bot
   und (später) Remote-Spieler sind austauschbar, damit Online-Spiel ein
   Controller-Tausch bleibt, kein Rewrite.
4. Fairness vor Schwierigkeitsspitzen: Bots laufen im gleichen Tempo wie
   Menschen und reagieren nur auf sichtbare Informationen — Schwierigkeit
   kommt über Reaktionszeit/Fehlerrate, nie über Cheaten.
5. Der Code bleibt lesbar und dokumentiert — jede Änderung in
   `DOKUMENTATION.md`, nichts wird obfuskiert.

## Accessibility & Inclusion

Volle Tastaturbedienbarkeit ist eine verbindliche, projektweite Anforderung
(kein Nice-to-have) — siehe „Capabilities and Constraints".
