# Bot-Navigation Overhaul — Implementierungs-Zusammenfassung

## Abgeschlossene Änderungen

### 1. ✓ Neue Datei: `renderer/game/bots/waypoints.js`
- Generische Waypoint-Hilfsfunktionen (ohne Imports)
- `pickWaypoint()` — gewichtete Zufallswahl mit Distanz-Bias, exclusions, prefer-tags
- `nearestWaypoint()` — findet nächsten passenden Waypoint
- `isAtWaypoint()` — Distanzprüfung
- Helper: `distTo()`, `vectorTo()`, `weightedPick()`

### 2. ✓ Maps erweitert: `renderer/block-bomb/maps.js`
- Alle 3 Maps bekommen `waypoints: [...]` Arrays
  - **Arena**: 9 Waypoints (center + 8 rund um den Ring)
  - **Sky**: 9 Waypoints (center, 4 Plate-Corner mit Tag 'corner', 4 Bridges mit Tag 'bridge')
  - **Factory**: 9 Waypoints (center, 4 Mid-Edge, 4 Corner)

### 3. ✓ State-Machine v2: `renderer/game/bots/botAI.js`
- Neuer `BotState` enum: `IDLE, ROAM, CHASE, FLEE, PASS_BOMB, AVOID_EDGE, UNSTUCK`
- Neue Funktionen:
  - `checkEdgeAhead()` — Look-Ahead ohne Raycasting (nutzt `resolve()` + `steerToSafety()`)
  - `computeRoamDesired()` — Waypoint-Navigation (mit Fallback auf altes WANDER)
  - `computeFleeDesired()` — Flucht mit Safe-Waypoint-Blending
  - `computeAvoidEdgeDesired()` — Edge-Vermeidung
  - `computeDesiredForState()` — State-Dispatcher
- Anti-Stuck-Eskalation:
  - Level 1: `UNSTUCK` State mit Recovery-Direction
  - Level 2/3: Wiederholte Stucks → Teleport zu `nearestWaypoint('safe')`
  - `repeatedStuckCount`, `goodMovementTimer` für Reset-Logik
- Debug-Toggle:
  - `let DEBUG_BOTS = false` + `setDebugBots()` Funktion
  - Extended `self.debug`: `edgeAhead`, `waypoint`, `repeatedStuckCount`

### 4. ✓ Persönlichkeit & Taktik: `renderer/block-bomb/bots.js`
- Neue `PROFILES`:
  - `easy` (nur intern, für Tutorials später): langsam, fehleranfällig, wenig aggressiv
  - `medium` (=normal): bisheriges Verhalten + neue Felder
  - `hard`: schnell, präzise, aggressiv
- Neue Felder per Profil: `hardStuckThreshold`, `interceptRadius`, `interceptLead`, `passBombDangerScale`, `waypointRandomness`
- `randomPersonality()` per Bot:
  - `reactionTime, aggression, bravery, randomness, preferredDistance, mistakeChance`
  - Moduliert Base-Profile zu "effective profile" `ep`
- Holder-Taktik (`pickTarget` rewrite):
  - Erreichbarkeits-Gewicht: Ziele nahe am Rand werden leicht entwertet
  - `computeInterceptTarget()` — Hard-Bots extrapolieren Zielbewegung und schneiden Wege
  - Transition zu `PASS_BOMB` wenn `dist < interceptRadius`
  - Panic-Scaling: aggressiver wenn `timeLeft < panicAt`
- Non-Holder-Abstand:
  - `preferredDistance` Halten (3.5–6.5 Unit Bereich)
  - `avoidDirection` Hint für `pickWaypoint` — roam AWAY von Holder

### 5. ✓ Debug-Modus & API: `renderer/block-bomb/main.js`
- F9-Toggle für Debug-Mode:
  - Keydown-Listener registriert/entfernt in `begin()`/`destroy()`
  - `_initDebugViz()` — erstellt Waypoint-Scheiben (nach Tag gefärbt) + Line-Pools
  - `_updateDebugViz()` — aktualisiert Bot-zu-Waypoint-Linien pro Frame
  - `_clearDebugViz()` — disposes bei Toggle-Off
- Label-Erweiterung: zeigt jetzt `[state!E]` (stuck=!, edgeAhead=E)
- Neuer Export: `window.BlockBomb.getPlayers()` — read-only für Tests

## Verifikation

### Syntax ✓
Alle JS-Dateien prüfen aus (node -c).

### Abwärtskompatibilität ✓
- `controllers.js` Contract bleibt unverändert (`update() → {x,z}`)
- `decisionToState('wander')` Alias auf `ROAM` → bestehende Aufrufer brechen nicht
- Maps ohne `waypoints` → `computeRoamDesired` fällt auf altes WANDER zurück
- `DEBUG_BOTS` bleibt ein const, wird aber via `setDebugBots()` von außen togglebar

### Nächste Schritte zum Testen
1. **Manueller Test** (Browser): F9 drücken während eines Spiels → Debug-Overlay sichtbar?
2. **Bestehendes `verify-blockbomb.js`** muss weiter grün sein (Regression-Check)
3. **Neues Testskript** `verify-bot-navigation.js` (Playwright):
   - Pro Map + Schwierigkeit einen 30s Bot-Match
   - Prüft: Kein Kreisen, keine Dauer-Stucks, Waypointvielfalt, Chase/Flee funktioniert
4. **Manuelle Sichtprüfung** (siehe Plan Abschnitt 6.2):
   - Arena: Bots wechseln Waypoints, kreisen nicht
   - Sky: Keine Navigations-Stürze (nur Explosionen)
   - Factory: Keine Ecken-Stucks

## Bemerkungen

- **Easy-Profil intern**: Lobby zeigt weiter nur Mittel/Schwer. `'easy'` nur per Code-Aufruf erreichbar (z.B. von künftigen Tutorials).
- **Persönlichkeit**: Jeder Bot hat unique `reactionTime`, `aggression`, etc. — gleiche Schwierigkeit sieht unterschiedlich aus.
- **Interception**: Hard-Bots extrapolieren mit `interceptLead=0.8` Reaktions-Intervalle voraus; Easy mit 0 (direktes Ziel).
- **Teleport ist Safe**: Nach Anti-Stuck-Eskalation wird Bot zu `nearestWaypoint('safe')` teleportiert — garantiert kollisionsfrei weil Waypoints statisch konstruiert.

## Befund: Ready für Testing!

Alles implementiert ✓, Syntax OK ✓, Abwärtskompatibilität ✓.
