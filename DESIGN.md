---
name: Der Automat der 5DK
description: Klassen-Arcade der 5DK als Spielhalle nach Ladenschluss, in der nur die Geräte leuchten.
colors:
  neon-pink: "#ff3d9a"
  neon-cyan: "#2ee6ff"
  marquee: "#ffb000"
  bell: "#ff2e63"
  neon-lime: "#b8ff3d"
  uv: "#7b4dff"
  board: "#120a30"
  board-raised: "#1c1246"
  board-line: "rgba(196,178,255,0.14)"
  ink: "#0a0520"
  tube-glass: "#05030c"
  blackout: "#070318"
  chalk: "#f3eeff"
  hall-copy: "#cfc5ee"
  chalk-dim: "#aaa0cc"
  chalk-faint: "#9d92c4"
typography:
  display:
    fontFamily: "'Tilt Neon', 'Kanit', sans-serif"
    fontSize: "clamp(46px, 8.7vw, 150px)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.01em"
  headline:
    fontFamily: "'Tilt Neon', 'Kanit', sans-serif"
    fontSize: "46px"
    fontWeight: 400
    lineHeight: 1.06
    letterSpacing: "0.01em"
  title:
    fontFamily: "'Kanit', 'Barlow', sans-serif"
    fontSize: "clamp(26px, 3.4vw, 38px)"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "0.02em"
  body:
    fontFamily: "'Barlow', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "'Kanit', 'Barlow', sans-serif"
    fontSize: "12px"
    fontWeight: 700
    letterSpacing: "0.14em"
  data:
    fontFamily: "'Share Tech Mono', ui-monospace, monospace"
    fontSize: "15px"
    fontWeight: 400
    letterSpacing: "normal"
rounded:
  label: "4px"
  plate: "6px"
  control: "8px"
  row: "12px"
  cabinet: "14px"
  tube: "22px / 16px"
  lamp: "999px"
components:
  nav-back:
    backgroundColor: "rgba(196,178,255,0.04)"
    textColor: "{colors.chalk-dim}"
    rounded: "{rounded.control}"
    padding: "6px 12px"
    height: "36px"
  nav-back-hover:
    textColor: "{colors.chalk}"
  nav-pill:
    backgroundColor: "{colors.bell}"
    textColor: "{colors.ink}"
    rounded: "{rounded.label}"
    padding: "2px 7px"
  cabinet-panel:
    backgroundColor: "{colors.board-raised}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.cabinet}"
    padding: "12px 14px"
  cabinet-panel-doc:
    backgroundColor: "{colors.board-raised}"
    textColor: "{colors.chalk-dim}"
    rounded: "{rounded.cabinet}"
    padding: "30px 34px"
  coin-lamp:
    backgroundColor: "{colors.bell}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lamp}"
    size: "34px"
  lamp-button:
    backgroundColor: "{colors.marquee}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lamp}"
    padding: "13px 34px"
  reward-chip:
    backgroundColor: "{colors.marquee}"
    textColor: "{colors.ink}"
    typography: "{typography.data}"
    rounded: "{rounded.plate}"
    padding: "8px 14px"
  tube-screen:
    backgroundColor: "{colors.tube-glass}"
    rounded: "{rounded.tube}"
    height: "152px"
  screen-sticker:
    backgroundColor: "{colors.bell}"
    textColor: "{colors.ink}"
    rounded: "3px"
    padding: "1px 8px"
  counter-display:
    backgroundColor: "{colors.tube-glass}"
    textColor: "{colors.marquee}"
    typography: "{typography.data}"
    rounded: "{rounded.row}"
    padding: "14px 12px 12px"
  highscore-row:
    backgroundColor: "rgba(12,6,34,0.7)"
    textColor: "{colors.chalk}"
    typography: "{typography.data}"
    rounded: "{rounded.plate}"
    padding: "8px 10px"
---

# Design System: Der Automat der 5DK

## Overview

**Creative North Star: "Die Halle nach Ladenschluss"**

Die Halle ist zu, das Licht ist aus, alle Automaten laufen im Attract-Modus, und wer die Seite öffnet, ist der einzige Mensch im Raum. Das System beschreibt einen Raum und die Geräte darin, keine Oberfläche mit Karten: unter jeder Seite liegt ein Gang zwischen zwei Automatenreihen (WebGL-Shader in `app/fx.js`, Standbild aus Verläufen in `app/theme.css`, wenn WebGL oder Bewegung fehlen), darüber stehen Gehäuse, Röhren, Schilder und Münzlampen. Jede Seite bringt ihre eigene Akzentfarbe (`--accent`) mit und behält ihr eigenes UI; geteilt wird der Raum, in dem sie steht.

Licht kommt nur aus Geräten. Röhren-Phosphor ist Cyan, Münzlampen sind Bernstein, die Neonschrift ist Magenta, die Decke ist Schwarzlicht-Violett. Dunkelheit ist Schwarzlicht-Indigo, nie Schwarz; echtes Fast-Schwarz gibt es nur hinter dem Glas einer Röhre. Die Dichte ist auf der Startseite hoch und körperlich (drei 3D-Automaten, eine Monitorwand, eine abgeschaltete hintere Reihe), auf den Unterseiten ruhig: dort dimmt die Halle den Mittelgang ab, damit Tabellen, Stundenplan, Uhr und Kontostand lesbar stehen. Das Spektakel (Kino-Screens, Abspann, Partikel) gehört den Momenten, in denen etwas gewonnen wurde.

Die Token-Namen `--board`, `--chalk`, `--marquee`, `--bell` stammen aus dem abgelösten Kreidetafel-Look und sind absichtlich stehen geblieben, damit keine Seite angefasst werden musste. Sie bezeichnen heute Hallen-Indigo, Textweiß, Bernstein und Signalrot. Verworfen ist das Karten-Raster auf dunklem Grund mit einem einzelnen Neon-Akzent.

**Key Characteristics:**
- Ein Raum unter jeder Seite: Hallen-Shader hinten, Deckenröhre oben (3px), Objektiv-Vignette vorn.
- Vier Lichtquellen mit festen Rollen: Magenta (Neonschrift), Cyan (Phosphor, Fokus), Bernstein (Münzlampe, Belohnung), Violett (Schwarzlicht).
- Vier Schriften mit festen Rollen: Tilt Neon für Röhrenschilder, Kanit kursiv-fett für Gehäuse, Barlow für Text, Share Tech Mono für Zähler.
- Panels sind Gehäuse mit farbiger Kantenleiste, Knöpfe sind beleuchtete Taster, Bestenlisten sind Highscore-Tafeln.
- Alles, was in einem Bildschirm steht, ist aus Zellen gebaut und springt in Schritten.
- Bewegung folgt dem Material: Röhre an und aus, Neon zündet, Attract-Loops laufen leer.
- Läuft ohne WebGL weiter und steht still bei `prefers-reduced-motion`.

## Colors

Schwarzlicht-Indigo als Raum, darin vier gesättigte Lichtfarben, die immer als Lichtquelle auftreten und nie als Flächenfarbe einer Seite.

### Primary
- **Neon-Magenta** (`neon-pink`): die Standard-Röhre. Farbe der Seitentitel, wenn eine Seite kein `--accent` setzt (`--tube: var(--accent, var(--neon-pink))`), erstes Wort des Hallenschilds, Textauswahl, `accent-color` der Formularfelder, Anfang des Verlaufs in Deckenröhre, Scrollbar und Fortschrittsbalken.

### Secondary
- **Phosphor-Cyan** (`neon-cyan`): das Licht der Bildschirme. Fokusring überall (2px), Textcursor, Links in Dokumentseiten ohne eigenen Akzent, Standardakzent der Monitore, zweite Hälfte des Hallenschilds, Bonus-Zustand in Block Presser.

### Tertiary
- **Münzlampen-Bernstein** (`marquee`): alles, was mit Münze, Punktestand und Belohnung zu tun hat. Standardfarbe von Kino-Screen und Abspann (`--rc`), Einwurfschlitz, Zählwerk, Preise, Rang-1-Zeile, Unterstrich der Gehäuse-Überschriften in Block Presser.
- **Signalrot** (`bell`): Rückfallfarbe für Nav-Plakette und Münzlampe, wenn eine Seite kein `--accent` setzt; Rückgabeknopf der Münztür, Joystick-Kugel.
- **Schwarzlicht-Violett** (`uv`): Deckenröhren, Bodenschein im Standbild, Mitte des Deckenröhren-Verlaufs, Scrollbar.
- **Teppich-Lime** (`neon-lime`): Teppichkonfetti, Partikel, einzelne Tasterlampen und eine Meilenstein-Farbe. Der Direction Contract nennt es als Erfolgsfarbe; in der geteilten Ebene gibt es dafür noch kein Bauteil.

### Neutral
- **Hallen-Indigo** (`board`): Seitengrund und Navbar-Blende.
- **Gehäuse-Indigo** (`board-raised`): Fläche jedes Panels.
- **Kantenlinie** (`board-line`): 1px-Rahmen von Panels, Tasten, Navbar-Unterkante. Lavendel mit 14 % Deckkraft.
- **Tinte** (`ink`): Schrift auf jeder leuchtenden Fläche (Plakette, Chip, Lampenknopf, Marquee, Aufkleber); Trennring um Lampen; Scrollbar-Spur.
- **Röhrenglas** (`tube-glass`): das Dunkel hinter dem Glas. Bildschirme, Zählwerk, Förderband, Spielfeld. Der dunkelste Wert im System und nur dort erlaubt.
- **Bild aus** (`blackout`): Maske der Bildröhre beim Ein- und Ausschalten und die Kinobalken.
- **Textweiß** (`chalk`): Überschriften und Haupttext, 16,6:1 auf Hallen-Indigo.
- **Hallentext** (`hall-copy`): Fließtext, der ohne Panel direkt über der Halle steht (Untertitel, Automaten-Beschreibung), immer mit dunklem Textschatten. Im Code ein Literal, kein Custom Property.
- **Text gedämpft** (`chalk-dim`): Sekundärtext in Panels, 7,0:1 auf Gehäuse-Indigo.
- **Text leise** (`chalk-faint`): Panel-Etiketten, Rangnummern, Hinweise, 6,0:1 auf Gehäuse-Indigo.

### Named Rules
**Die Gerätelicht-Regel.** Farbe ist Licht aus einem Gerät. Jeder farbige Schein ist ein Schatten in der Farbe seiner Quelle (`color-mix(in srgb, var(--accent) 55%, transparent)`), keine eingefärbte Fläche. Eine Seite hat genau eine Quelle, ihr `--accent`.

**Die Indigo-Regel.** Der Raum dunkelt Richtung Schwarzlicht-Indigo ab, nie Richtung Schwarz. Fast-Schwarz (`tube-glass`) steht nur hinter Glas.

**Die Tinte-Regel.** Auf allem, was selbst leuchtet, steht die Schrift in `ink`. Helle Schrift auf heller Lampe gibt es nicht.

## Typography

**Display Font:** Tilt Neon (mit Kanit, sans-serif)
**Body Font:** Barlow (mit -apple-system, Segoe UI, sans-serif)
**Label/Mono Font:** Kanit für Gehäusebeschriftung, Share Tech Mono für Zähler und Röhrentext

**Character:** Vier Stimmen, jede an ein Material gebunden: die gebogene Glasröhre, der kursive fette Siebdruck auf dem Gehäuse, die sachliche Lesetype und die Segmentanzeige. Sie werden nicht gemischt; welche Schrift steht, sagt, woraus das Ding gemacht ist.

### Hierarchy
- **Display** (400, `clamp(46px, 8.7vw, 150px)`, 1): das Hallenschild der Startseite, eine Zeile über die volle Breite, zweifarbig (Magenta und Cyan). Unter 600px `clamp(46px, 15vw, 80px)`.
- **Headline** (400, 46px, 1.06): Seitentitel als Neonschild (`.hero h1`, `.neon`), 34px unter 720px. Dieselbe Machart tragen Kino-Titel (`clamp(34px, 6.4vw, 78px)`) und Abspann-Logo (`clamp(44px, 9vw, 110px)`).
- **Title** (900 kursiv, Versalien, `clamp(26px, 3.4vw, 38px)`, 1): Gehäusebeschriftung in Kanit. Abschnittsschilder der Startseite, Marquee-Namen (25px), Panel-Überschriften (20px, 0.03em), Nav-Titel (15px, 800), Lampenknöpfe (18px, 800).
- **Body** (400, 16px, 1.6): Barlow. Untertitel maximal 65ch; Dokumenttext 15px bei 1.7 und maximal 72ch.
- **Label** (700, 12px, 0.14em, Versalien): Kanit. Panel-Etikett, das selbst die Überschrift des Panels ist.
- **Data** (400, 15px, `tabular-nums`): Share Tech Mono. Punkte, Preise, Ränge, Raten, Chips, Text in Röhren. Großes Zählwerk `clamp(34px, 7vw, 54px)`, Zähler im Kino-Screen `clamp(30px, 6vw, 64px)`.

### Named Rules
**Die Röhren-Regel.** Tilt Neon steht nur dort, wo eine Glasröhre hängen könnte: Seitentitel, Kino-Titel, Abspann-Logo, Start-Overlay eines Spiels. Die Füllung ist fast weiß (`color-mix(in srgb, var(--tube) 14%, #fff)`), die Farbe sitzt im vierstufigen Schein (`0 0 2px #fff, 0 0 10px, 0 0 26px, 0 6px 60px`). Nie für Fließtext, Tasten oder Zahlen.

**Die Zählwerk-Regel.** Jede Zahl, die sich ändern kann, steht in Share Tech Mono mit `tabular-nums`.

## Layout

Kein durchgehendes Raster. Jede Seite ordnet ihre Geräte selbst an; geteilt sind nur die Ebenen des Raums und die feste Navbar. Die Navbar sitzt 3px unter der Oberkante (darüber liegt die Deckenröhre), mit Innenabstand 12px 24px, unter 720px 10px 14px. Inhalte liegen in `.container` über der Halle (`z-index: 1`).

Die Startseite ist 1180px breit (Rand 32px, 20px unter 860px, 16px unter 600px) und stapelt drei Gänge mit 60px Abstand, jeder in eigener Form: drei Automaten nebeneinander (Abstand 44px, die äußeren um 13° eingedreht), eine Monitorwand als 8-Spalten-Raster mit Röhren in drei Größen (der Stundenplan belegt 3 Spalten und 3 Reihen), eine hintere Reihe aus fünf abgeschalteten Geräten. Ab 1000px fällt die Drehung weg und die Wand wird zweispaltig; ab 860px stehen die Automaten untereinander (maximal 400px breit).

Spielseiten setzen Presse und Werkstatt als zwei Gehäuse nebeneinander (`minmax(0, 1fr) minmax(0, 1.1fr)`, Abstand 22px, maximal 1020px) und stapeln unter 760px. Die Halle kennt zwei Zustände: `data-hall="open"` auf der Startseite zeigt den Gang offen, weil deckende Automaten davorstehen; alle anderen Seiten dimmen die Bildmitte auf 16 % ab.

Die geteilte Ebene bricht bei 720px um, die Startseite bei 1000, 860 und 600px, die Spielseiten bei 760px. Eine gemeinsame Stufenskala gibt es nicht.

## Elevation & Depth

Tiefe ist räumlich, nicht geschichtet. Hinten läuft die Halle mit eigener Perspektive, Nebel zum Fluchtpunkt und einer Kamera, die Maus und Scrollposition leicht folgt. Davor stehen Gehäuse, die sich mit zwei Mitteln abheben: einer 1px-Lichtkante oben in Akzentfarbe (die Kantenleiste) und einem tiefen, indigo getönten Schlagschatten. Farbiger Schein unter einem Gerät ist dessen Licht auf dem Teppich. Die Automaten der Startseite sind echte 3D-Körper (`perspective: 1300px`, Seitenwände 84px tief, Marquee 26px vorgezogen, Bedienpult um 38° gekippt) und neigen sich bis 9° zur Maus.

Die Ebenen von hinten nach vorn: Standbild (-2), Hallen-Canvas (-1), Inhalt (1), Navbar (100), Deckenröhre (101), Objektiv-Vignette (102), Kino-Screen (9000), Abspann (9100), Blitz und Lichtstreifen (9400 bis 9450), Partikel (9500), gezoomter Bildschirm (9800), Bildröhren-Maske (10000).

### Shadow Vocabulary
- **Kantenleiste und Stand** (`box-shadow: inset 0 1px 0 color-mix(in srgb, var(--tube) 55%, transparent), 0 18px 44px rgba(8,4,26,0.55)`): jedes Gehäuse-Panel.
- **Röhrenschein** (`text-shadow: 0 0 2px #fff, 0 0 10px var(--tube), 0 0 26px var(--tube), 0 6px 60px color-mix(in srgb, var(--tube) 70%, transparent)`): Neonschilder.
- **Lampenring** (`box-shadow: 0 0 0 3px rgba(10,5,32,0.9), 0 0 0 4px var(--board-line), 0 6px 18px color-mix(in srgb, var(--accent, var(--bell)) 60%, transparent)`): Münzlampe; der Lampenknopf trägt dieselbe Folge mit 4px und 5px Ring.
- **Hinter Glas** (`box-shadow: inset 0 0 0 2px rgba(0,0,0,0.9), inset 0 0 44px rgba(0,0,0,0.9), 0 0 0 1px rgba(196,178,255,0.2)`): Bildschirme. Nur hier ist reines Schwarz im Schatten zulässig.
- **Teppichschein** (radialer Verlauf in Akzentfarbe, `filter: blur(14px)`, Deckkraft 0.55, bei Nähe 1): unter Automaten und unter dem Pressblock.
- **Lesbarkeit über der Halle** (`text-shadow: 0 1px 2px rgba(9,4,30,0.9), 0 0 18px rgba(9,4,30,0.9)`): jeder Text ohne Panel dahinter.

### Named Rules
**Die Kantenleisten-Regel.** Ein Panel wird durch die 1px-Lichtkante oben zum Gehäuse. Ohne sie ist es eine Karte, und Karten gibt es in der Halle nicht.

**Die Ruhiger-Gang-Regel.** Wo gelesen wird, wird die Halle abgedimmt oder ein Gehäuse steht dahinter. Text liegt nie ungeschützt auf dem bewegten Teppich.

## Shapes

Drei Formfamilien, jede an ein Material gebunden. Blech und Gehäuse sind mäßig gerundet: Panels 14px, Listenzeilen und Anzeigen 12px, Tasten 8px, Schildchen, Chips und Tafelzeilen 6px, Plaketten 4px. Glas ist elliptisch gewölbt (`22px / 16px` am Automaten, `16px / 12px` an der Monitorwand), damit ein Bildschirm nie wie ein Panel aussieht. Lampen sind rund: Münzlampe und Taster als Kreis, Lampenknöpfe als Pille (999px).

Rahmen sind 1px in `board-line` an Panels und Tasten und 2px in Akzentfarbe an den Körpern der Automaten. Das Gestell der Monitorwand ist bewusst eckig (0px) mit 2px Stahlkante. Aufkleber im Bildschirm sitzen um 3° gedreht. Kugeln, Lampen und Taster haben ein Glanzlicht oben links (`radial-gradient(circle at 35% 30%, #fff ...)`).

## Components

Bauteile sind Dinge aus der Halle. Sie reagieren, als wären sie angeschlossen: Lampen pulsieren, Röhren werden heller, wenn man näher kommt, Taster geben nach.

### Buttons
- **Münzlampe (Start):** runde Lampe (34px) mit Dreieck in `ink`, daneben Beschriftung in Kanit kursiv 700, 14px. Die Lampe ist ein Kugelverlauf in Akzentfarbe mit Lampenring. Hover skaliert die Lampe auf 1.1; ist der Automat in der Nähe, pulsiert sie.
- **Lampenknopf (Hauptaktion):** Pille, Kanit kursiv 800, 18px, Schrift in `ink`, senkrechter Verlauf von aufgehellt nach abgedunkelt in der Screen-Farbe, doppelter Ring, Pulsieren `brightness(1.22)` im 1.4s-Takt. Hover hebt 2px und skaliert 1.03, gedrückt senkt 2px. Fokus: 3px weiß mit 5px Abstand.
- **Gehäusetaste (Nebenaktion):** Kanit 600, 13px, `chalk-dim` auf 4 % Lavendel, 1px `board-line`, 8px Radius, mindestens 36px hoch (40px unter 720px). Hover: Schrift `chalk`, Rand in Akzent- oder Cyanfarbe. Gilt für Zurück-Taste und Werkzeugtasten.
- **Fokus:** 2px `neon-cyan` mit 2px Abstand auf allen bedienbaren Elementen, 3px Abstand an Zurück-Taste und Münzlampe.

### Chips
- **Belohnungs-Chip:** Share Tech Mono 15px in `ink` auf der Screen-Farbe, 6px Radius, 8px 14px, klappt beim Erscheinen um die Oberkante auf. Nur im Kino-Screen.
- **Nav-Plakette:** zwei bis drei Zeichen in Share Tech Mono 11px, `ink` auf Akzentfarbe, 4px Radius, mit Schein in Akzentfarbe.
- **Aufkleber im Bildschirm:** Kanit 700, 12px, `ink` auf Akzentfarbe, 3px Radius, 3° gedreht, oben rechts auf dem Glas. Der Status eines Geräts steht auf dem Gerät.

### Cards / Containers
- **Gehäuse-Panel:** `board-raised` mit 5 % Lavendel-Schimmer in den obersten 120px, 1px `board-line`, 14px Radius, Kantenleiste und Stand. Innenabstand 12px 14px, als Dokumentseite 30px 34px (22px 18px unter 720px). Überschriften in Kanit kursiv.
- **Automat (nur Startseite):** Marquee mit durchlaufendem Lichtreflex, Blende mit Röhre, gekipptes Bedienpult mit blinkenden Tastern, Münztür mit beleuchtetem Einwurf. Im Ruhezustand ist der Schirm gedimmt (`saturate(0.8) brightness(0.8)`), bei Nähe oder Fokus hell (`saturate(1.25) brightness(1.15)`), der Automat hebt sich 8px.
- **Abgeschaltetes Gerät:** dunkle Röhre, gezogener Stecker als SVG, Zustand in Bernstein. Form für alles, was es noch nicht gibt.

### Inputs / Fields
Die geteilte Ebene legt für Felder nur Verhalten fest: Textcursor in `neon-cyan`, `accent-color` in `neon-pink`, Fokusring wie oben. Gestalt und Rahmen bestimmt jede Seite selbst.

### Navigation
Feste Blende über den Automaten: Hallen-Indigo mit 94 bis 78 % Deckkraft, `blur(16px) saturate(1.4)`, 1px `board-line` unten. Links Zurück-Taste und Seitentitel (Kanit kursiv 800, 15px) mit Plakette, rechts das Konto. Die Startseite zeigt stattdessen den Schriftzug ARCADE (Kanit kursiv 900, 19px) mit blinkender Münzlampe. Jeder interne Seitenwechsel schaltet das Bild wie eine Röhre aus (0.3s) und auf der nächsten Seite wieder ein (0.62s).

### Bildschirm (Röhre)
Jede Fläche mit der Klasse `.crt` bekommt Zeilenraster (1px dunkel alle 3px), Randabdunklung und einen schrägen Glasreflex. Der Inhalt ist aus Zellen gebaut: Motive werden auf einer Zeichenfläche von 15 bis 26 Zellen Breite gemalt und ganzzahlig hochskaliert (`image-rendering: pixelated`, mindestens Faktor 2), Raster aus 13px-Zellen mit 2px Fuge, Bildwechsel alle 130ms, Animationen in `steps()`. Text in der Röhre ist Share Tech Mono; »Münze einwerfen« blinkt im 1.2s-Takt.

### Zählwerk
Leuchtanzeige hinter dunklem Glas: `tube-glass`, 12px Radius, Bernsteinrand mit 30 % Deckkraft, Ziffern in Share Tech Mono mit Schein nach unten, darunter die Einheit als Kanit-Etikett.

### Highscore-Tafel
Zeilen in Share Tech Mono 15px auf `rgba(12,6,34,0.7)`, 6px Radius, drei Spalten (Rang 34px, Name, Punkte). Rang 1 in Bernstein mit 1px Bernsteinlinie innen, die eigene Zeile mit Cyan-Tönung und Cyan-Linie.

### Kino-Screen und Abspann
Belohnungen und Gutschriften übernehmen das ganze Bild (`FX.cinema`): Kinobalken (11vh, 6vh unter 600px), langsam drehender Strahlenkranz, ein Symbol, das einschlägt, der Titel als Neonschild, dessen Buchstaben einzeln zünden, hochzählende Zahl, Chips, ein Lampenknopf. Eine Farbe (`--rc`, Standard Bernstein) färbt alles. Zwei Stufen: normal und `epic` (mehr Funken, Konfettiregen, zweite Druckwelle). Symbole sind gezeichnete SVGs im 64er-Raster, gefüllt mit `currentColor`, Details in `ink` und weißem Glanzstrich. Der Abspann (`FX.credits`) rollt mit 62px pro Sekunde, Halten beschleunigt sechsfach; bei reduzierter Bewegung wird er zu einer ruhigen, scrollbaren Seite.

## Do's and Don'ts

### Do:
- **Do** jeder neuen Seite genau eine Lichtquelle geben: `--accent` auf `:root` setzen. Plakette, Münzlampe, Neontitel, Links und der Lichtkegel am Ende des Gangs folgen von selbst.
- **Do** Panels als Gehäuse bauen: `board-raised`, 1px `board-line`, 14px Radius, Kantenleiste oben in Akzentfarbe, Schatten `0 18px 44px rgba(8,4,26,0.55)`.
- **Do** farbigen Schein mit `color-mix(in srgb, <Quelle> N%, transparent)` aus der Farbe des Geräts ableiten.
- **Do** Schrift auf leuchtenden Flächen in `ink` setzen.
- **Do** alles in einer Röhre aus Zellen bauen, ganzzahlig skalieren und in `steps()` bewegen.
- **Do** Zahlen in Share Tech Mono mit `tabular-nums` setzen.
- **Do** Text ohne Panel mit `hall-copy` und dem Lesbarkeits-Schatten schützen, und Unterseiten im gedimmten Gang lassen (`data-hall="open"` nur dort, wo deckende Geräte davorstehen).
- **Do** Belohnungen über `FX.cinema` feiern und Seitenwechsel über die Röhre laufen lassen, statt eigene Overlays und Übergänge zu bauen.
- **Do** jede Bewegung mit einem Standbild absichern: `prefers-reduced-motion` stoppt Shader, Partikel, Zünden und Röhrenwechsel; der Inhalt bleibt vollständig.
- **Do** den Fokusring (2px `neon-cyan`) sichtbar lassen und Tasten mindestens 36px hoch halten.

### Don't:
- **Don't** den Raum Richtung Schwarz abdunkeln. Fast-Schwarz (`tube-glass`) gehört hinter Glas, sonst nirgends hin.
- **Don't** ein Karten-Raster auf dunklem Grund mit einem Neon-Akzent bauen. Was nebeneinander steht, sind Geräte unterschiedlicher Bauart.
- **Don't** Tilt Neon für Fließtext, Tasten oder Zahlen verwenden und die Röhre nicht in voller Sättigung füllen: der Kern bleibt fast weiß.
- **Don't** ein Etikett über eine Überschrift setzen. Status steht als Aufkleber auf dem Gerät; `.hero-eyebrow` ist in `theme.css` zentral abgeschaltet.
- **Don't** helle Schrift auf eine leuchtende Lampe oder Marquee setzen.
- **Don't** weiche Verläufe oder Kurven in eine Röhre zeichnen; der Schirm kennt nur Zellen und Mono-Text.
- **Don't** einer Seite eine zweite Akzentfarbe geben. Die übrigen Lichtfarben kommen aus der Halle, nicht aus dem Inhalt.
- **Don't** Spektakel über Lesbares legen: Stundenplan, Uhr und Kontostand bleiben in jedem Zustand lesbar.
- **Don't** die alten Deko-Ebenen (`.orb`, `.dot-grid`, `.vignette`, `.paper-grid`, `.bulb-strip`) wiederbeleben; sie sind zentral ausgeblendet.
