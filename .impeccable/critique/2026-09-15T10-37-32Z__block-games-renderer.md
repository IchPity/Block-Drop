---
target: block-games/renderer/
total_score: 34
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:C:\\Users\\User\\Desktop\\Block Drop\\block-games\\renderer"
timestamp: 2026-09-15T10-37-32Z
slug: block-games-renderer
---
Method: dual-agent (A: design-review subagent · B: detector subagent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Der größte Button im Hauptmenü (`#btnParty`) ist voll funktionsfähig, sagt aber "bald verfügbar" |
| 2 | Match System / Real World | 4 | Vollständig Deutsch, Supabase-Fehler werden hart übersetzt (nie rohes Englisch) |
| 3 | User Control and Freedom | 4 | Saubere Esc-Kette (Popup → Overlay → Screen), 3-Wege-Quit-Dialog |
| 4 | Consistency and Standards | 3 | Settings-Kopfzeile nur per Tab erreichbar — Ausnahme vom sonst durchgängigen Pfeiltasten-Modell |
| 5 | Error Prevention | 4 | Lobby-Start blockiert bei <2 Spielern, Formularvalidierung überall |
| 6 | Recognition Rather Than Recall | 3 | Recent-Login-Chips, persistenter Avatar, Steuerungs-Hinweis im Footer |
| 7 | Flexibility and Efficiency | 3 | Maus+Tastatur gleichwertig, aber kein Couch-Multiplayer (bekannt, siehe PRODUCT.md), keine Shortcuts |
| 8 | Aesthetic and Minimalist Design | 4 | Menü bleibt bei ~4 Kopf-Aktionen + 1 Hero-Button + kleinem Grid, trotz animiertem Hintergrund aufgeräumt |
| 9 | Error Recovery | 4 | Toast + flashInvalid()-Shake am Element doppeln sich ab |
| 10 | Help and Documentation | 2 | Nur der settings-note-Hinweis; kein "So wird gespielt" jenseits des Tutorial-Bot-Modus |
| **Total** | | **34/40** | **Good** |

## Design Specificity Verdict

**LLM-Einschätzung (Assessment A):** Klar eigenständig, kein generisches Menü-Template. style.css framt sich selbst als "Arcade-Plakat-Look im Mario-Party-Stil" mit Impact-Font, hartem Schatten-Versatz, rotierendem Block-Farbsystem — und dokumentiert im Code, warum --blue-deep/--purple-deep überhaupt existieren (WCAG AA auf zu hellen Basisfarben). PRODUCT.md lehnt bewusst ein Mario-"?"-Block-Zitat ab, obwohl das Gameplay Mario-Party-artig ist. Sogar die IA-Entscheidung, 4 unfertige Minigames zu einer Sammel-Kachel zusammenzufassen, ist im Code mit Cognitive-Load-Begründung kommentiert (app.js:14-17).

**Deterministischer Scan (Assessment B):** 13 Funde, alle severity: advisory, Kategorie slop:
- gpt-thin-border-wide-shadow ("dünner Rand + breiter Schatten") — 12x, Blur-Werte 18-70px
- repeating-stripes-gradient — 1x (Laser-Lines-Bühnenhintergrund)

**Wichtig — Tool-Defekt gefunden:** Der Detektor meldet alle 13 Funde als index.html:0. index.html enthält aber gar kein <style> und keine border-Regel — die tatsächlichen Fundorte sind style.css (Border+Shadow-Kombis, u.a. Zeilen 290, 504, 1385, 1605, 1866) sowie laser-lines.css/block-bomb.css (die Streifen-Gradients). Die Muster selbst sind real, nur die Datei/Zeile im JSON-Output ist falsch zugeordnet — das ist ein Tool-Bug im Detektor, kein Beleg gegen die Funde.

Kein Überlappen mit den bereits akzeptierten ignoreValues (side-tab, border-accent-on-rounded, dark-glow, bounce-easing) nach Regelname — aber 2 der 12 Shadow-Funde (style.css:761, :1969) sind farbige Akzent-Glows, die konzeptionell zum bereits akzeptierten "warm glow" (dark-glow) passen könnten, nur unter anderer Regel-ID.

## Overall Impression

Solide, erkennbar eigene Design-Sprache mit ungewöhnlich sauberer Tastatur-Engineering für ein Hobbyprojekt. Der größte Stolperstein ist keine Stil-, sondern eine Text-Frage: Der auffälligste Button im ganzen Menü bewirbt sich selbst als "bald verfügbar", obwohl er die fertige Kernschleife startet.

## What's Working

1. **Tastatur-Navigation ungewöhnlich rigoros**: Pro-Screen-NAV_MENU/lobbyNav-Tabellen, geometrischer Fallback, gedrosseltes Key-Repeat, dokumentierte Begründung für die eine bewusste Ausnahme.
2. **Lokalisierung konsequent durchgezogen**: jeder Nutzerfehler wird übersetzt, explizite Regel "nie rohes Englisch durchlassen".
3. **IA-Entscheidungen sind Cognitive-Load-bewusst im Code begründet**, nicht nachträglich gerechtfertigt.

## Priority Issues

**[P1] Haupt-CTA widerspricht seiner eigenen Funktion**
- Was: #btnParty ist der visuell dominanteste Button im Menü (großer Farbverlauf, Glow, animiertes Würfel-Icon), aber sein Untertitel sagt "Brettspiel-Modus · 4 Spieler · bald verfügbar". Er ist voll klickbar und startet die fertige, echte Minigame-Serie (openLobby/startSeries).
- Warum wichtig: Ein Erstspieler liest "bald verfügbar" und hält den Button für deaktiviert — genau das untergräbt das Produktziel "jederzeit sofort spielbar".
- Fix: Untertitel auf das umschreiben, was der Klick HEUTE tut ("Minigame-Serie starten"); den Roadmap-Hinweis auf den Brettspiel-Modus in Sekundärtext oder die UPCOMING_MINIGAMES-Kachel verschieben.
- Vorschlag: /impeccable clarify

**[P2] Settings-Kopfzeile bricht das eigene "keine Ausnahmen"-Prinzip**
- Was: "Zurücksetzen"/"←" in den Einstellungen sind nur per Tab erreichbar, nicht per Pfeiltasten — eine dokumentierte, aber echte Ausnahme vom sonst durchgängigen Modell.
- Warum wichtig: PRODUCT.md nennt volle Tastaturbedienbarkeit "verbindlich, keine Ausnahmen" als Produktprinzip Nr. 1 — genau hier gibt es eine.
- Fix: Pfeiltasten-Nav für die beiden Header-Buttons ergänzen (analog zu den anderen Screens).
- Vorschlag: /impeccable harden

**[P2] Verlierende Spieler bekommen keine Rückmeldung**
- Was: showSingleResult() zeigt nur "{Gewinner} gewinnt!" oder "Unentschieden!" — nichts für den Spieler, der ausgeschieden ist.
- Warum wichtig: Peak-End-Moment eines Matches ist komplett gewinnerzentriert; gerade bei einem Projekt, das Fairness und häufiges Solo/Duo-Spiel gegen Bots betont, fehlt die Rückmeldung an genau die Person, die sie am meisten braucht.
- Fix: Platzierungs-bewusste Zeile ergänzen ("Du bist ausgeschieden — Platz 2").
- Vorschlag: /impeccable clarify

**[P3] Wiederkehrendes "dünner Rand + breiter Schatten"-Muster (12x, Detektor)**
- Was: Detektor markiert 12 Stellen in style.css mit 1px-Border + 18-70px-Box-Shadow-Blur als generisches "KI-Slop"-Muster — bisher nicht wie dark-glow/border-accent-on-rounded bewusst als Stilmittel akzeptiert.
- Warum wichtig: Assessment A (ohne die Detektor-Funde zu kennen) bewertet das Gesamtdesign unabhängig als "klar eigenständig, kein Template" — im Widerspruch zum "Slop"-Signal des Detektors. Entweder ist das Muster hier bewusst (dann gehört es wie die anderen vier in .impeccable/config.json als ignore-value), oder ein Teil der 12 Stellen ist tatsächlich unreflektiert übernommen.
- Fix: Kurz durchsehen, welche der 12 Stellen bewusste Gestaltung sind (→ ignore-value ergänzen) und welche zu stark verallgemeinert wirken (→ Blur/Border gezielt anpassen).
- Vorschlag: /impeccable audit

**[P3] Icon-only Buttons ohne aria-label**
- Was: ⚙️/⏻/←/✕ verlassen sich nur auf title, nicht auf aria-label (Ausnahme: die Settings-Tableiste).
- Warum wichtig: Außerhalb des Pfeiltasten-Modells (z.B. Screenreader) fehlt die semantische Beschriftung.
- Fix: Jedes title zusätzlich als aria-label spiegeln.
- Vorschlag: /impeccable audit

## Persona Red Flags

**Jordan (Erstspieler):** Liest "bald verfügbar" auf dem einen Button, der unmöglich zu übersehen ist, und schließt vernünftigerweise, dass der ganze Party-Modus noch nicht bereit ist — untergräbt direkt das Produktziel "jederzeit sofort spielbar". Größtes Onboarding-Risiko im gesamten Review.

**Sam (nur Tastatur):** Der Anspruch "volle Tastaturbedienbarkeit überall" hält für ein Hobbyprojekt ungewöhnlich gut stand — deterministische Nav-Tabellen, sichtbarer Fokus, Esc-Kette. Der eine Bruch: Die Settings-Kopfzeile verlangt plötzlich Tab statt Pfeiltasten, nachdem Sam auf jedem anderen Screen das andere Modell gelernt hat.

## Minor Observations

- Overlays (accountOverlay, quitOverlay, mgPause etc.) haben kein role="dialog"/aria-modal, obwohl der Fokus manuell gefangen wird.
- --text-dim: #9a9abd wird viel für Sekundärtext verwendet — Kontrastwert nicht einzeln verifiziert, lohnt einen gezielten Check.
- "Melde dich an…"-Hinweis taucht auf zwei Screens fast wortgleich auf — leicht redundant, nicht schädlich.
- Der Detektor selbst hat einen Attributionsfehler: alle 13 Funde zeigen index.html:0, tatsächlich liegen sie in style.css/laser-lines.css/block-bomb.css — reiner Tool-Bug, kein Design-Problem.
- repeating-stripes-gradient (Laser-Lines-Bühnenhintergrund, hinter reduced-fx versteckt) ist noch nicht als ignore-value erfasst, obwohl es zur selben "bewusstes Arcade-Genre-Stilmittel"-Kategorie wie die vier bestehenden Einträge passen könnte.

## Questions to Consider

1. Der auffälligste Button im Menü bewirbt aktuell ein noch nicht gebautes Feature, während er still die fertige, echte Funktion startet — ist das die gewollte erste-10-Sekunden-Geschichte?
2. Bots sind bewusst auf Fairness ausgelegt, das ganze Projekt legt Wert auf Transparenz — warum bleibt der Ergebnis-Screen ausgerechnet für die verlierende Person stumm?
3. Der Tastatur-Nav-Graph ist pro Screen von Hand gepflegt — was verhindert, dass er still verrottet, sobald Coin Grab/Memory Clash & Co. dazukommen?
