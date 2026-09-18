// Block Rush — Teile: Formen, 7-Bag, Spielfeld-Kinematik (reine Daten, kein THREE).
//
// Raster pro Spieler: COLS x ROWS. Jedes Teil ist eine 4x4-Zellenliste pro
// Rotation (Standard-Tetromino-Tabellen), Drehung per einfachem Wandkick
// (0/-1/+1/-2/+2 auf der X-Achse — reicht für ein 6 Spalten breites Feld).
//
// KEINE Line-Clears in v1 — der Turm wächst nur. Dadurch ist `topRow` (die
// höchste belegte Reihe) ein simples, monotones Fortschrittsmaß, das sowohl
// der Bot-Score als auch der Online-Snapshot günstig nutzen können.
//
// Kennt NICHTS von Kippen/Stabilität — das übernimmt tower.js, sobald `step()`
// oder `hardDrop()` ein Teil einrasten lässt (Rückgabe `{locked:true, ...}`).

'use strict';

export const COLS = 6;
export const ROWS = 16;
export const CELL = 0.5;

// Fallintervalle (Sekunden pro Reihe bei gravityScale=1). BASE_FALL_INTERVAL
// war früher 0.80 — bei 90s Rundenzeit brauchte ein Teil dadurch bis zu ~9.6s
// vom Spawn bis zum Boden, unassistiertes Spielen war praktisch unmöglich und
// Hard-Drop der einzige gangbare Weg (ohne jede Anleitung dazu). Halbiert auf
// 0.42, sodass reine Schwerkraft innerhalb der Rundenzeit eine echte Option
// bleibt, Hard-Drop aber weiterhin deutlich schneller ist.
export const BASE_FALL_INTERVAL = 0.42;
export const SOFT_FALL_INTERVAL = 0.045;

// Jede Form: 4 Rotationen, je eine Liste von [x,y] in einer 4x4-Box.
const SHAPES = {
  I: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[1, 0], [1, 1], [1, 2], [1, 3]],
  ],
  O: [
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
  ],
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[1, 1], [2, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 0], [0, 1], [1, 1], [0, 2]],
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
};

export const PIECE_TYPES = Object.keys(SHAPES);

// Farbe je Teiletyp (eigene Neon-Palette für die Blöcke — die Spielerfarbe
// faerbt nur Turm-Rand/HUD/Ring, s. tower.js).
export const PIECE_COLORS = {
  I: 0x36d6e7, O: 0xffc93c, T: 0xb06dff, S: 0x3ddc84,
  Z: 0xff5d5d, J: 0x4db5ff, L: 0xff944d,
};

function cellsOf(type, rot) {
  return SHAPES[type][((rot % 4) + 4) % 4];
}

// Öffentlich für bots.js (Kandidaten-Suche muss Zellenlisten kennen, ohne
// eine eigene Instanz zu spawnen).
export function shapeCells(type, rot) { return cellsOf(type, rot); }

// Deterministischer RNG (mulberry32) — Host und Gast erzeugen mit demselben
// Seed dieselbe Teilefolge, ganz ohne eigene Netz-Nachricht dafür (s. main.js:
// Seed wird aus den Spieler-IDs abgeleitet, nicht übertragen).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Simpler FNV-1a-Hash: aus einem beliebigen String einen 32-Bit-Seed machen.
export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// 7-Bag: jede der 7 Formen genau einmal pro „Sack", dann neu mischen —
// verhindert lange Durststrecken ohne ein bestimmtes Teil.
export function makeBag(seed) {
  const rng = mulberry32(seed);
  let bag = [];
  function refill() {
    bag = [...PIECE_TYPES];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }
  return function next() {
    if (bag.length === 0) refill();
    return bag.pop();
  };
}

// ── Spielfeld eines einzelnen Spielers ──────────────────────────────────
export class Playfield {
  constructor(bagNext) {
    this.bagNext = bagNext;
    this.cells = new Int8Array(COLS * ROWS).fill(-1); // -1 = leer, sonst Index in PIECE_TYPES
    this.heights = new Int8Array(COLS).fill(ROWS);     // erste belegte Reihe je Spalte (0 = oben)
    this.topRow = ROWS;                                // höchste belegte Reihe insgesamt (kleiner = höher gebaut)
    this.overflow = false;
    this.fallAcc = 0;
    this.lockT = 0;
    this.pendingMass = 1;                               // von spells.js gesetzt (Wachstum)
    this.next = bagNext();
    this.piece = null;
    this._spawn();
  }

  _fits(type, rot, col, row) {
    for (const [dx, dy] of cellsOf(type, rot)) {
      const x = col + dx, y = row + dy;
      if (x < 0 || x >= COLS || y >= ROWS) return false;
      if (y >= 0 && this.cells[y * COLS + x] >= 0) return false;
    }
    return true;
  }

  _spawn() {
    const type = this.next;
    this.next = this.bagNext();
    const col = Math.floor(COLS / 2) - 2;
    const mass = this.pendingMass;
    this.pendingMass = 1;
    this.piece = { type, rot: 0, col, row: 0, mass };
    this.fallAcc = 0;
    this.lockT = 0;
    if (!this._fits(type, 0, col, 0)) this.overflow = true;
  }

  // Nächstes gespawntes Teil ist schwerer/instabiler (Wachstum-Spell).
  requestGrowth(massFactor = 1.8) { this.pendingMass = massFactor; }

  tryShift(dir) {
    if (!this.piece || this.overflow) return false;
    const p = this.piece;
    if (this._fits(p.type, p.rot, p.col + dir, p.row)) { p.col += dir; this.lockT = 0; return true; }
    return false;
  }

  tryRotate(dir) {
    if (!this.piece || this.overflow) return false;
    const p = this.piece;
    const rot = (p.rot + dir + 4) % 4;
    for (const k of [0, -1, 1, -2, 2]) {
      if (this._fits(p.type, rot, p.col + k, p.row)) { p.rot = rot; p.col += k; this.lockT = 0; return true; }
    }
    return false;
  }

  // Ziel-Reihe für eine Spalte/Rotation — nutzt sowohl der Hard-Drop als auch
  // die Bot-Kandidatensuche (bots.js), damit beide exakt dieselbe Landung sehen.
  dropRow(type, rot, col) {
    let row = -4;
    while (this._fits(type, rot, col, row + 1)) row++;
    return this._fits(type, rot, col, row) ? row : -1;
  }

  hardDrop() {
    if (!this.piece || this.overflow) return null;
    const p = this.piece;
    const row = this.dropRow(p.type, p.rot, p.col);
    if (row < 0) { this.overflow = true; return 'overflow'; }
    p.row = row;
    return this._lock();
  }

  // Landevorschau (Geisterteil): wohin würde das aktuelle Teil bei einem
  // Hard-Drop JETZT fallen — ohne das Feld zu verändern. Nutzt exakt dieselbe
  // dropRow()-Logik wie hardDrop() selbst, damit Vorschau und echte Landung
  // nie auseinanderlaufen.
  previewDropRow() {
    if (!this.piece || this.overflow) return -1;
    return this.dropRow(this.piece.type, this.piece.rot, this.piece.col);
  }

  // step: normale Schwerkraft. gravityScale > 1 = schneller fallen
  // (Blitzsturz-Spell/Windkanal), soft = Spieler hält „runter".
  step(dt, gravityScale, soft, lockDelay = 0.25) {
    if (!this.piece || this.overflow) return 'none';
    const p = this.piece;
    const interval = (soft ? SOFT_FALL_INTERVAL : BASE_FALL_INTERVAL) / Math.max(0.1, gravityScale);
    const resting = !this._fits(p.type, p.rot, p.col, p.row + 1);

    if (resting) {
      this.lockT += dt;
      if (this.lockT >= lockDelay) return this._lock();
      return 'falling';
    }

    this.fallAcc += dt;
    if (this.fallAcc >= interval) {
      this.fallAcc = 0;
      p.row += 1;
      this.lockT = 0;
    }
    return 'falling';
  }

  // Seitlicher Schub (Windkanal-Map) — schiebt das FALLENDE Teil um eine
  // Spalte, wenn möglich; kein Effekt auf bereits verklebte Blöcke.
  pushSide(dir) { return this.tryShift(dir); }

  _lock() {
    const p = this.piece;
    const typeIdx = PIECE_TYPES.indexOf(p.type);
    const placed = [];
    for (const [dx, dy] of cellsOf(p.type, p.rot)) {
      const x = p.col + dx, y = p.row + dy;
      if (y < 0) { this.overflow = true; continue; }
      this.cells[y * COLS + x] = typeIdx;
      placed.push({ x, y });
      if (y < this.topRow) this.topRow = y;
    }
    this._refreshHeights();
    const result = { locked: true, cells: placed, type: p.type, mass: p.mass || 1 };
    this.piece = null;
    this.lockT = 0; this.fallAcc = 0;
    if (this.overflow) return 'overflow';
    this._spawn();
    if (this.overflow) return 'overflow';
    return result;
  }

  _refreshHeights() {
    for (let c = 0; c < COLS; c++) {
      let h = ROWS;
      for (let r = 0; r < ROWS; r++) { if (this.cells[r * COLS + c] >= 0) { h = r; break; } }
      this.heights[c] = h;
    }
  }

  // Nur für Bots/Debug: Löcher (leere Zelle unter einer belegten) je Spalte.
  countHoles() {
    let holes = 0;
    for (let c = 0; c < COLS; c++) {
      let seen = false;
      for (let r = 0; r < ROWS; r++) {
        const filled = this.cells[r * COLS + c] >= 0;
        if (filled) seen = true;
        else if (seen) holes++;
      }
    }
    return holes;
  }
}
