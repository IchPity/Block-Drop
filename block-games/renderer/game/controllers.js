// Gemeinsame Steuerungs-Abstraktion (Controller) für ALLE Minigames.
//
// KERNIDEE (online-tauglich von Anfang an): Jede Spielfigur wird von genau
// einem Controller gesteuert. Ein Controller liefert pro Frame NUR einen
// Bewegungs-Intent { x, z } (Richtung, Länge 0..1) — sonst nichts. Der
// Spielkern liest ausschließlich diese Intents und kennt die Herkunft nicht.
// Dadurch ist „lokaler Mensch" ↔ „entfernter Spieler" später ein reiner
// Controller-Tausch, ohne den Spielkern anzufassen.
//
// Vier Implementierungen:
//   LocalHumanController  — gedrückte Tasten (WASD/Pfeile) des lokalen Spielers
//   LocalPieceController  — wie oben, aber Ereignis-Zähler statt Richtung
//                            (Block Rush: schieben/drehen/droppen/casten/Ziel
//                            wechseln), s. „Lokales Teil-Stapeln" unten
//   BotController         — KI-Gehirn (per Konstruktor injiziert, je Spiel anders)
//   RemoteController      — Online-Spiel über Netzwerke; optionaler `adapter`
//                            für Intents, die kein {x,z} sind (s. dort)
//
// Ein Bewegungs-Intent ist { x, z } mit x,z ∈ [-1,1] und Länge ≤ 1. Andere
// Genres (Block Rush) definieren ihre eigene Intent-Form — der Vertrag
// „Controller liefert pro Frame etwas, Spielkern kennt die Herkunft nicht"
// gilt trotzdem unverändert.
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
// Taste unten ist.
//
// Couch-Koop (2 lokale Menschen am selben PC): das `layout`-Argument trennt
// WASD und Pfeiltasten auf zwei UNABHÄNGIGE Controller-Instanzen, statt beide
// (wie früher) gleichwertig auf dieselbe Figur zu legen. P1 = 'wasd' (Default),
// P2 = 'arrows'. Beide Instanzen hören global auf `window`, ignorieren aber
// Tasten außerhalb ihres eigenen Layouts — mapKey() gibt dafür pro Layout
// gezielt null zurück.
export class LocalHumanController {
  constructor(layout = 'wasd') {
    this.layout = layout === 'arrows' ? 'arrows' : 'wasd';
    this.keys = new Set();
    this._onDown = (e) => {
      const k = mapKey(e.key, this.layout);
      if (!k) return;
      // Pfeiltasten nicht die Seite scrollen lassen.
      e.preventDefault();
      this.keys.add(k);
    };
    this._onUp = (e) => {
      const k = mapKey(e.key, this.layout);
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

// layout 'wasd' → WASD, layout 'arrows' → Pfeiltasten. Jedes Layout hört NUR
// auf seine eigenen Tasten, damit zwei LocalHumanController gleichzeitig
// angehängt sein können, ohne sich gegenseitig zu steuern.
function mapKey(key, layout) {
  if (layout === 'arrows') {
    switch (key) {
      case 'ArrowLeft':  return 'left';
      case 'ArrowRight': return 'right';
      case 'ArrowUp':    return 'up';
      case 'ArrowDown':  return 'down';
      default: return null;
    }
  }
  switch (key) {
    case 'a': case 'A': return 'left';
    case 'd': case 'D': return 'right';
    case 'w': case 'W': return 'up';
    case 's': case 'S': return 'down';
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
//
// `adapter` (optional, zweiter Konstruktor-Parameter): für Spiele, deren
// Intent KEIN {x,z}-Bewegungsvektor ist (z.B. Block Rush' Ereignis-Zähler
// {dx,rot,hard,cast,cycle,soft,seq}). Ohne Adapter verhält sich der Controller
// exakt wie bisher (Ersetzen + {x,z}-Normalisierung) — bestehende Spiele sind
// unverändert. Ein Adapter definiert:
//   initial()          → Startwert von `pending`
//   merge(pending, in)  → neuer `pending`-Wert beim Empfang eines Intents
//   drain(pending)       → { value, next } beim Lesen in update() — damit ein
//                         verlustbehafteter 20-Hz-Poll-Kanal (s. app.js
//                         getMyInput) trotzdem jedes Ereignis überträgt, statt
//                         nur den letzten Stand.
export class RemoteController {
  constructor(peerId, adapter) {
    this.peerId = peerId;
    this._adapter = adapter || null;
    this.pending = this._adapter ? this._adapter.initial() : { x: 0, z: 0 };
  }
  // Vom (späteren) Netzwerk-Layer aufzurufen.
  feed(intent) {
    if (this._adapter) { this.pending = this._adapter.merge(this.pending, intent); return; }
    this.pending = normalize(intent.x || 0, intent.z || 0);
  }
  update(/* self, world, dt */) {
    if (this._adapter) {
      const { value, next } = this._adapter.drain(this.pending);
      this.pending = next;
      return value;
    }
    return this.pending;
  }
}

// ── Lokales Teil-Stapeln (Block Rush): kein {x,z}-Bewegungsintent, sondern
// ein Ereignis-Zähler seit der letzten Abfrage — sonst würden bei 20-Hz-
// Online-Polling (app.js) Drehungen/Hard-Drops zwischen zwei Abfragen
// verschluckt. Hört wie LocalHumanController global auf `window`, mappt aber
// auf `e.code` (nicht `e.key` — QWERTZ-fest) und regelt Links/Rechts selbst
// per DAS/ARR (Verzögerung bis Wiederholung / Wiederholrate).
const DAS = 0.16; // s, bis eine gehaltene Links/Rechts-Taste zu wiederholen beginnt
const ARR = 0.04; // s zwischen zwei automatischen Wiederholungen

function mapPieceCode(code, layout) {
  if (layout === 'arrows') {
    switch (code) {
      case 'ArrowLeft':  return 'left';
      case 'ArrowRight': return 'right';
      case 'ArrowUp':    return 'rotate';
      case 'ArrowDown':  return 'down';
      case 'ShiftRight': return 'hard';
      case 'ControlRight': return 'cast';
      case 'Slash':      return 'cycle';
      default: return null;
    }
  }
  switch (code) {
    case 'KeyA': return 'left';
    case 'KeyD': return 'right';
    case 'KeyW': return 'rotate';
    case 'KeyS': return 'down';
    case 'KeyQ': return 'hard';
    case 'KeyE': return 'cast';
    case 'KeyR': return 'cycle';
    default: return null;
  }
}

export class LocalPieceController {
  constructor(layout = 'wasd') {
    this.layout = layout === 'arrows' ? 'arrows' : 'wasd';
    this.held = new Set();
    this._acc = { dx: 0, rot: 0, hard: 0, cast: 0, cycle: 0 };
    this.soft = false;
    this.seq = 0;
    this._dasDir = 0; this._dasTimer = 0; this._arrTimer = 0;
    this.attached = false;

    this._onDown = (e) => {
      const a = mapPieceCode(e.code, this.layout);
      if (!a) return;
      e.preventDefault();
      if (this.held.has(a)) return; // Browser-Auto-Repeat ignorieren, DAS/ARR macht das selbst
      this.held.add(a);
      this._press(a);
    };
    this._onUp = (e) => {
      const a = mapPieceCode(e.code, this.layout);
      if (!a) return;
      this.held.delete(a);
      if (a === 'left' || a === 'right') { this._dasDir = 0; this._dasTimer = 0; this._arrTimer = 0; }
      if (a === 'down') this.soft = false;
    };
  }

  _press(action) {
    switch (action) {
      case 'left':   this._acc.dx -= 1; this.seq++; this._dasDir = -1; this._dasTimer = 0; break;
      case 'right':  this._acc.dx += 1; this.seq++; this._dasDir = 1;  this._dasTimer = 0; break;
      case 'rotate': this._acc.rot += 1; this.seq++; break;
      case 'down':   this.soft = true; break;
      case 'hard':   this._acc.hard += 1; this.seq++; break;
      case 'cast':   this._acc.cast += 1; this.seq++; break;
      case 'cycle':  this._acc.cycle += 1; this.seq++; break;
    }
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
    this.held.clear();
    this.attached = false;
  }
  // Tasten leeren, ohne die Listener zu lösen (z.B. beim Pausieren).
  clear() {
    this.held.clear();
    this.soft = false;
    this._dasDir = 0; this._dasTimer = 0; this._arrTimer = 0;
  }

  update(self, world, dt) {
    if (this._dasDir !== 0) {
      this._dasTimer += dt;
      if (this._dasTimer >= DAS) {
        this._arrTimer += dt;
        while (this._arrTimer >= ARR) {
          this._arrTimer -= ARR;
          this._acc.dx += this._dasDir;
          this.seq++;
        }
      }
    }
    const out = { ...this._acc, soft: this.soft, seq: this.seq };
    this._acc.dx = 0; this._acc.rot = 0; this._acc.hard = 0; this._acc.cast = 0; this._acc.cycle = 0;
    return out;
  }
}

export { normalize };
