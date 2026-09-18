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
"Block-Drop Arcade") für gemeinsames Spielen an einem PC — aktuell drei
Last-Man-Standing-Minigames (Block Bomb, Laser Lines, Block Rush), weitere
geplant (siehe ROADMAP.md). Erfolg bedeutet: jederzeit sofort spielbar, egal
ob allein, zu zweit oder in voller Runde, ohne dass Technik oder Bedienung im
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
- **Zwei lokale menschliche Controller sind möglich (seit v0.19.0):**
  `LocalHumanController`/`LocalPieceController` trennen zwei unabhängige
  Instanzen auf zwei Tastensätze. **Seit v0.23.0 frei einstellbar** statt
  fest WASD/Pfeiltasten: Spieler 1 wählt ein Preset im „Steuerung"-Reiter
  der Einstellungen, Spieler 2 (Lobby-Slot-Typ `local`) bekommt automatisch
  das jeweils andere, und jede Aktion lässt sich einzeln umbelegen
  (`Keybinds`, `renderer/keybinds.js`). Mehr als 2 gleichzeitige lokale
  Menschen (3./4. Tastenlayout) sind noch nicht vorgesehen; weitere Slots
  sind Bot oder (perspektivisch) Freund/Remote.
- **Splitscreen für zwei lokale Menschen (seit v0.23.0):** Ist „Zwei Bilder"
  in der Lobby aktiv, rendert jedes Minigame zwei eigene Kamera-Hälften statt
  eines gemeinsamen Bildes (nicht verfügbar als Online-Gast — siehe
  DOKUMENTATION.md „Couch-Koop").
- **Immer mindestens 3, höchstens 4 Spieler pro Match** (seit v0.19.0) —
  fehlende Menschen werden automatisch durch Bots aufgefüllt
  (`minBotCount()`/`maxBotCount()` in `app.js`).
- **Bot-Schwierigkeit immer Mittel oder Schwer**, nie „Leicht" — seit v0.19.0
  **zufällig pro Match** vergeben, nicht mehr pro Bot-Slot in der Lobby
  einstellbar. **Seit v0.23.0 ausnahmslos**: den früheren Tutorial-
  Schnellstart mit erzwungenen „Easy"-Bots gibt es nicht mehr — jede Partie
  läuft über die Lobby.
- **Kein Einzelspiel-Einstieg mehr im Hauptmenü (seit v0.23.0):** „Spielen"
  führt ausschließlich in die Lobby; jede Runde läuft über die Party-Serie
  (Spiel-Voting fürs erste Spiel, danach zufällig, Map immer gewählt).
- **Ein laufendes Match lässt sich per Abstimmung abbrechen** (seit
  v0.19.0, F5/F6, 15s-Timeout, Schein-Abstimmung solo gegen Bots) — zählt
  bisher nur lokale Menschen, siehe unten zum Online-Stand.
- **Pause (Esc) hält lokale Matches wirklich an, Online-Matches nicht (seit
  v0.23.0):** Ist kein Online-Mitspieler beteiligt, friert Esc die Simulation
  komplett ein (inkl. Intro-Kamera); ist ein Online-Mitspieler dabei, läuft
  das Match im Hintergrund weiter und das Pause-Overlay zeigt einen
  entsprechenden Hinweis — ein einzelner Gast kann ein Match nicht für alle
  anhalten.
- **Jeder Spielmodus bekommt genau 3 Maps** plus Map-Voting vor der Runde
  (Mehrheit entscheidet, Gleichstand zufällig).
- Drei Minigames im Registry-basierten, generischen Match-Flow: Block Bomb
  (Bombe weitergeben, Last-Man-Standing), Laser Lines (Laser ausweichen,
  3 Leben) und Block Rush (Türme stapeln, Last-Man-Standing, kein
  Reihen-Räumen). Teilen sich Bot-KI-Grundlage, Controller-Abstraktion,
  Farbsystem aus der Lobby und die `#mg*`-Overlays.
- **Online-/Freundes-Spiel ist seit v0.20.0 echt verdrahtet** (host-
  autoritativ über Supabase Realtime Broadcast+Presence, `renderer/net/
  session.js`): Session hosten/per Code beitreten, Freundes-Einladung über
  den echten Einladungs-Channel, `RemoteController` wird tatsächlich
  gefüttert. Die alte, rein lokale Freund-Einladung im Platz-Popup der Lobby
  (ohne Netzbezug) existiert davon UNABHÄNGIG weiter (bewegt sich im Spiel
  nicht) — siehe DOKUMENTATION.md „Online-Sessions" für den Unterschied.
  Bewusste v1-Lücken: keine Client-Prediction, keine Host-Migration, Gäste
  stimmen beim Map-Voting weiterhin zufällig mit, und die Abbruch-
  Abstimmung zählt Online-Mitspieler (`type === 'remote'`) noch nicht mit.
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
