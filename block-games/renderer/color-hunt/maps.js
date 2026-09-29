// Farbjagd — die drei Maps (Projekt-Konvention für ALLE Minigames).
//
// Anders als bei den 3D-Spielen ist "Map" hier kein Ort, sondern ein
// Regelsatz: wie lange die Zielfarbe zu sehen ist (showTime), wie lange
// gemischt werden darf (mixTime) und wie die Störer-Flächen um die
// Jäger-Fläche herum angeordnet sind (layout, steuert nur CSS-Klassen in
// color-hunt.css). Schwierigkeit steigt von atelier → blitz spürbar
// (kürzeres Zeigen, weniger Zeit zum Mischen, aufdringlichere Anordnung).

'use strict';

export const COLOR_HUNT_MAP_META = [
  { id: 'atelier', name: 'Atelier', layout: 'atelier', showTime: 2.0, mixTime: 14,
    desc: 'Getrennte Tafeln ringsum, ruhiger Einstieg — genug Zeit zum genauen Mischen.' },
  { id: 'kaleido', name: 'Kaleidoskop', layout: 'kaleido', showTime: 1.5, mixTime: 12,
    desc: 'Ringe direkt um die Jägerfläche — die Ablenkfarben liegen zum Greifen nah.' },
  { id: 'blitz', name: 'Blitzlicht', layout: 'blitz', showTime: 0.8, mixTime: 9,
    desc: 'Nur ein kurzer Blick auf die Zielfarbe, dann tickt die Uhr im Mosaik.' },
];

export function mapMeta(id) {
  return COLOR_HUNT_MAP_META.find((m) => m.id === id) || COLOR_HUNT_MAP_META[0];
}
