// Gemeinsame Steuerungs-Abstraktion (Controller) für ALLE Minigames.
//
// KERNIDEE (online-tauglich von Anfang an): Jede Spielfigur wird von genau
// einem Controller gesteuert. Ein Controller liefert pro Frame NUR einen
// Bewegungs-Intent { x, z } (Richtung, Länge 0..1) — sonst nichts. Der
// Spielkern liest ausschließlich diese Intents und kennt die Herkunft nicht.
// Dadurch ist „lokaler Mensch" ↔ „entfernter Spieler" später ein reiner
// Controller-Tausch, ohne den Spielkern anzufassen.
//
// Drei Implementierungen:
//   LocalHumanController  — gedrückte Tasten (WASD/Pfeile) des lokalen Spielers
//   BotController         — KI-Gehirn (per Konstruktor injiziert, je Spiel anders)
//   RemoteController      — STUB für späteres Online-Spiel über Netzwerke
//
// Ein Intent ist immer { x, z } mit x,z ∈ [-1,1] und Länge ≤ 1.
//
// Lag früher in renderer/block-bomb/controllers.js; nach renderer/game/ gehoben.
// Der BotController ist jetzt spiel-agnostisch: Er bekommt ein fertiges Brain
// (z.B. aus block-bomb/bots.js oder laser-lines/bots.js) statt selbst eines zu
// bauen — so teilen sich alle Spiele dieselben Mensch-/Remote-Controller.

'use strict';

const ZERO = Object.freeze({ x: 0, z: 0 });

// Richtung normalisieren (Diagonale nicht schneller als gerade).
function normalize(x, z) {
  const len = Math.hypot(x, z);
  if (len < 1e-4) return { x: 0, z: 0 };
  if (len <= 1) return { x, z };
  return { x: x / len, z: z / len };
}

// ── Lokaler Mensch: gedrückte Tasten → Richtung ──────────────────────────
// Hört global auf keydown/keyup und merkt sich, welche Tasten GEHALTEN werden
// (kein einzelner Tastendruck). Damit läuft die Figur flüssig, solange die
// Taste unten ist. WASD und Pfeiltasten sind gleichwertig.
export class LocalHumanController {
  constructor() {
    this.keys = new Set();
    this._onDown = (e) => {
      const k = mapKey(e.key);
      if (!k) return;
      // Pfeiltasten nicht die Seite scrollen lassen.
      e.preventDefault();
      this.keys.add(k);
    };
    this._onUp = (e) => {
      const k = mapKey(e.key);
      if (k) this.keys.delete(k);
    };
    this.attached = false;
  }

  attach() {
    if (this.attached) return;
    window.addEventListener('keydown', this._onDown);
    window.addEventListener('keyup', this._onUp);
    this.attached = true;
  }

  detach() {
    window.removeEventListener('keydown', this._onDown);
    window.removeEventListener('keyup', this._onUp);
    this.keys.clear();
    this.attached = false;
  }

  // Tasten leeren, ohne die Listener zu lösen (z.B. beim Pausieren, damit die
  // Figur nicht „weiterläuft", wenn man im Pausemenü eine Taste loslässt).
  clear() { this.keys.clear(); }

  update(/* self, world, dt */) {
    let x = 0, z = 0;
    if (this.keys.has('left'))  x -= 1;
    if (this.keys.has('right')) x += 1;
    if (this.keys.has('up'))    z -= 1; // -Z = „nach hinten/oben" in die Szene
    if (this.keys.has('down'))  z += 1;
    return normalize(x, z);
  }
}

function mapKey(key) {
  switch (key) {
    case 'ArrowLeft':  case 'a': case 'A': return 'left';
    case 'ArrowRight': case 'd': case 'D': return 'right';
    case 'ArrowUp':    case 'w': case 'W': return 'up';
    case 'ArrowDown':  case 's': case 'S': return 'down';
    default: return null;
  }
}

// ── Bot: KI-Gehirn (je Minigame injiziert) ───────────────────────────────
// Der Controller hält nur das „Gehirn"; die eigentliche Entscheidung liegt im
// per-Spiel-Adapter (z.B. block-bomb/bots.js, laser-lines/bots.js). Das Brain
// muss eine think(self, world, dt) → {x,z}-Methode haben.
export class BotController {
  constructor(brain) {
    this.brain = brain;
  }
  update(self, world, dt) {
    return this.brain.think(self, world, dt) || ZERO;
  }
}

// ── Remote: Platzhalter für Online-Spiel (verschiedene Netzwerke) ─────────
// Späterer Ablauf: Eingaben des entfernten Spielers kommen über das Netz
// (z.B. Supabase Realtime) herein und werden in `pending` gepuffert; update()
// gibt den zuletzt empfangenen Intent zurück. Noch NICHT verdrahtet — bis dahin
// steht die Figur still. So lässt sich Online ohne Umbau des Spielkerns
// nachrüsten: nur diesen Controller mit echten Netz-Daten füttern.
export class RemoteController {
  constructor(peerId) {
    this.peerId = peerId;
    this.pending = { x: 0, z: 0 };
  }
  // Vom (späteren) Netzwerk-Layer aufzurufen.
  feed(intent) {
    this.pending = normalize(intent.x || 0, intent.z || 0);
  }
  update(/* self, world, dt */) {
    return this.pending;
  }
}

export { normalize };
