---
version: 1
slug: "app-index-html"
primary_target: "app/index.html"
related_targets: ["app/theme.css"]
---

# Surface brief: ganze Arcade-Website (app/)

Scope: alle Seiten unter `app/`, geteilte Ebene `theme.css` + `fx.js`. Visitor mode: Experience (Startseite, Spiele), Operate (Stundenplan, Wetter, METAR, F1, Konto).

Audience: Klasse 5DK, Schul-Laptop und Handy. Job: spielen, vergleichen, schnell Stundenplan/Uhr finden. Constraints: Vanilla, kein Build, läuft ohne WebGL weiter, `prefers-reduced-motion` respektiert.

Vom Nutzer festgelegt: Welt „Arcade-Halle bei Nacht", Effekte auch im Spielfeld, Kino-Screens für alle Rewards, Abspann bei der Pension in Block Presser, Gutschrift-Screen nach dem Aufladen im Casino.

## Direction contract

THESIS: Die Halle nach Ladenschluss. Niemand ist da, alle Automaten laufen im Attract-Modus, und du bist der einzige Mensch im Raum. Verweigert wird das Karten-Raster auf dunklem Grund mit einem Neon-Akzent.

OWN-WORLD: Schwarzlicht-Indigo statt Schwarz, als Boden der fluoreszierende Hallenteppich in Perspektive, dahinter unscharfe Bildschirmlichter. Licht kommt nur aus Geräten: Röhren-Phosphor in Cyan, Münzlampen in Bernstein, die Neonschrift in Magenta, Teppichgrün als Erfolg. Panels sind Automatengehäuse mit farbiger Kantenleiste, Knöpfe sind beleuchtete Arcade-Taster, Bestenlisten sind Highscore-Tafeln. Schrift: Kanit kursiv-fett für Gehäuse, Tilt Neon für Röhrenschilder, Barlow für Text, Share Tech Mono für Zähler.

STORY: Man tritt ein, das Schild zündet, die Automaten wachen auf, wenn man näher kommt. Man wirft eine Münze ein und der Bildschirm schluckt einen.

FIRST VIEWPORT: Oben mittig das Neonschild „Der Automat der 5DK" über die volle Breite, zündet flackernd. Darunter die Automatenreihe in 3D, drei Spiele vorne, Bildschirme im Attract-Loop, Münzlampe als Startknopf. Boden und Tiefe füllt der WebGL-Teppich.

FORM: Halle nach Ladenschluss (Attract-Modus), Kandidat 7 der eigenen Liste, seed key 0e425981. Vom Teletext-Herausforderer übernommen: strenge Zellenraster-Disziplin für alles, was in einem Bildschirm steht. Signature interaction: Münzeinwurf, Bildschirm zoomt bildfüllend, nächste Seite schaltet wie eine Röhre ein. Motion grammar: Röhre an/aus, Neon zündet, Attract-Loops laufen leer.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
