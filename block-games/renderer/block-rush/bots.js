// Block Rush — Bot-Entscheidungslogik.
//
// ANDERES Genre als botAI.js (Charakterbewegung) — hier geht es um Teile-
// Platzierung + Spell-Einsatz, deshalb KEINE Wiederverwendung von botAI.js,
// aber dieselben Konventionen: PROFILES pro Schwierigkeit, Persönlichkeits-
// Streuung im Konstruktor, Reaktions-Timer-Idiom (die teure Kandidatensuche
// läuft nur, wenn der Timer abläuft ODER ein neues Teil erscheint — nicht
// jeden Frame).
//
// Der Bot liefert GENAU dieselbe Intent-Form wie ein Mensch am Controller
// ({dx,rot,hard,cast,cycle,soft}) — kein privilegierter Pfad. Die eigentliche
// Ausführung (Drehen bis zum Ziel, dann seitlich fahren, dann droppen; Spells
// per Cursor anwählen) läuft über mehrere Frames, exakt wie bei einem Menschen.

'use strict';

import { COLS, ROWS, CELL, shapeCells } from './pieces.js';
import { SPELL_META } from './spells.js';

// Mindestabstand zwischen zwei Dreh-/Verschiebe-Eingaben eines Bots — bisher
// gab es keine Bremse, `think()` läuft mit jedem gerenderten Frame, ein Bot
// konnte also bis zu 60 Eingaben/s absetzen (deutlich schneller, als ein
// Mensch physisch tippen kann; menschliches ARR in controllers.js liegt bei
// 0.04s). 0.08s hält Bots klar im menschlich plausiblen Bereich.
const ACTION_INTERVAL = 0.08;

const PROFILES = {
  easy: {
    reactionInterval: 0.55, mistakeChance: 0.35, hardDropChance: 0.20,
    w: { holes: 4.0, bump: 0.5, height: 0.6, com: 3.0, flat: 0.8 },
    spellChance: 0.35, spellDelay: 2.5,
  },
  medium: {
    reactionInterval: 0.30, mistakeChance: 0.16, hardDropChance: 0.55,
    w: { holes: 7.0, bump: 0.9, height: 0.9, com: 7.0, flat: 1.1 },
    spellChance: 0.70, spellDelay: 1.2,
  },
  hard: {
    reactionInterval: 0.14, mistakeChance: 0.04, hardDropChance: 0.85,
    w: { holes: 11.0, bump: 1.3, height: 1.2, com: 13.0, flat: 1.4 },
    spellChance: 0.95, spellDelay: 0.5,
  },
};
PROFILES.normal = PROFILES.medium;

// Bewertet einen Kandidaten (Rotation+Spalte) OHNE das echte Feld zu
// verändern: klont nur das Zellen-Array, setzt die hypothetischen Zellen
// hinein und liest Löcher/Bumpiness/Höhe/„liegt flach auf" daraus ab.
function evaluatePlacement(field, type, rot, col) {
  const row = field.dropRow(type, rot, col);
  if (row < 0) return null;
  const cellList = shapeCells(type, rot);
  const cellsClone = field.cells.slice();
  let flat = 0, sumDx = 0, minY = ROWS;
  for (const [dx, dy] of cellList) {
    const x = col + dx, y = row + dy;
    if (y < 0) return null;
    cellsClone[y * COLS + x] = 1;
    sumDx += dx;
    if (y < minY) minY = y;
    const belowY = y + 1;
    const ownCellBelow = cellList.some(([dx2, dy2]) => col + dx2 === x && row + dy2 === belowY);
    if (!ownCellBelow && (belowY >= ROWS || field.cells[belowY * COLS + x] >= 0)) flat++;
  }
  const heights = new Array(COLS).fill(ROWS);
  let holes = 0;
  for (let c = 0; c < COLS; c++) {
    let seen = false;
    for (let r = 0; r < ROWS; r++) {
      const filled = cellsClone[r * COLS + c] >= 0;
      if (filled) { if (heights[c] === ROWS) heights[c] = r; seen = true; }
      else if (seen) holes++;
    }
  }
  let bump = 0;
  for (let i = 1; i < COLS; i++) bump += Math.abs(heights[i] - heights[i - 1]);
  const comApprox = (col + sumDx / cellList.length) - (COLS - 1) / 2;
  const topRow = Math.min(field.topRow, minY);
  return { holes, bump, topRow, flat, comApprox };
}

// `tower` (optional): TowerSim des Bots — ermöglicht Rebalancing statt reinem
// Zentrieren. Ohne `tower` (z.B. in Tests) verhält sich das exakt wie zuvor.
function pickPlacement(field, type, ep, tower) {
  // comX ist in Welteinheiten (tower.js), comApprox unten in Rasterspalten —
  // durch CELL teilen, um beide vergleichbar zu machen. leanFactor 0..1 sagt,
  // wie stark der Turm schon schief steht (auf die halbe Feldbreite normiert);
  // bei leanFactor≈0 verhält sich targetCenter wie vorher (reines Zentrieren).
  const towerComCol = tower ? tower.comX / CELL : 0;
  const leanFactor = tower ? Math.min(1, Math.abs(towerComCol) / (COLS / 2)) : 0;
  // Turm steht schon schief → die "gute Mitte" verschiebt sich Richtung
  // Gegengewicht, statt immer bei comApprox=0 zu bleiben — sonst bauen Bots
  // ewig nur mittig und balancieren einen kippenden Turm nie zurück.
  const targetCenter = -towerComCol * leanFactor;
  const candidates = [];
  for (let rot = 0; rot < 4; rot++) {
    for (let col = -2; col < COLS; col++) {
      const r = evaluatePlacement(field, type, rot, col);
      if (!r) continue;
      const center = Math.abs(r.comApprox - targetCenter) / (COLS / 2);
      const heightPenalty = (ROWS - r.topRow) / ROWS;
      const score = -ep.w.holes * r.holes - ep.w.bump * r.bump
        - ep.w.height * heightPenalty - ep.w.com * center + ep.w.flat * r.flat;
      candidates.push({ rot, col, score });
    }
  }
  if (!candidates.length) return { rot: 0, col: Math.floor(COLS / 2) - 2 };
  candidates.sort((a, b) => b.score - a.score);
  // Fehler = zweit-/drittbester Zug statt reiner Zufallszug (bleibt plausibel).
  if (candidates.length > 1 && Math.random() < ep.mistakeChance) {
    return candidates[1 + Math.floor(Math.random() * Math.min(2, candidates.length - 1))];
  }
  return candidates[0];
}

// Welcher Spell soll (falls im Inventar) als Nächstes anvisiert werden.
function pickSpell(self, world) {
  const s = self.spells;
  if (!s || !s.inventory.length) return null;
  const has = (id) => s.inventory.includes(id);
  const my = world.towers.find((t) => t.id === self.id);
  const opponents = world.towers.filter((t) => t.id !== self.id && t.alive);

  if (has('glue') && my && my.stability < 0.55) return { spellId: 'glue', targetId: self.id };
  if (has('growth') && my && my.stability > 0.7) return { spellId: 'growth', targetId: self.id };
  if (has('quake') && opponents.length) {
    const best = opponents.reduce((acc, t) => {
      const score = (1 - t.stability) * ((ROWS - t.topRow) / ROWS);
      return (!acc || score > acc.score) ? { t, score } : acc;
    }, null);
    if (best && best.score > 0.35) return { spellId: 'quake', targetId: best.t.id };
  }
  if (has('speed') && opponents.length) {
    const tallest = opponents.reduce((acc, t) => (!acc || t.topRow < acc.topRow) ? t : acc, null);
    if (tallest) return { spellId: 'speed', targetId: tallest.id };
  }
  // Fallback: irgendeinen Spell loswerden, damit das Inventar nicht verstopft.
  const any = s.inventory[0];
  const meta = SPELL_META[any];
  const targetId = meta.offensive ? (opponents[0] ? opponents[0].id : self.id) : self.id;
  return { spellId: any, targetId };
}

export function makeBlockRushBotBrain(difficulty) {
  const base = PROFILES[difficulty] || PROFILES.medium;
  // Persönlichkeits-Streuung, damit Bots nicht synchron handeln.
  const ep = {
    ...base,
    reactionInterval: base.reactionInterval * (0.85 + Math.random() * 0.4),
    w: { ...base.w },
  };
  for (const k of Object.keys(ep.w)) ep.w[k] *= 0.92 + Math.random() * 0.16;

  const state = {
    reactT: Math.random() * ep.reactionInterval,
    plan: null, planType: null,
    spellCd: 1 + Math.random() * ep.spellDelay,
    spellGoal: null,
    actionT: Math.random() * ACTION_INTERVAL, // Eingabe-Cooldown (Dreh/Verschieb)
    dropPause: 0,                             // zusätzliche Denkpause vor Hard-/Soft-Drop
  };

  function think(self, world, dt) {
    const out = { dx: 0, rot: 0, hard: 0, cast: 0, cycle: 0, soft: false };
    const field = self.field;
    if (!field) return out;

    state.actionT -= dt;

    // ── Teil-Platzierung ──────────────────────────────────────────────
    state.reactT -= dt;
    const type = field.piece ? field.piece.type : null;
    if (type && (state.reactT <= 0 || state.planType !== type)) {
      state.reactT = ep.reactionInterval;
      state.plan = pickPlacement(field, type, ep, self.tower);
      state.planType = type;
      // Neuer Plan → neue Denkpause, bevor der Bot droppt (proportional zur
      // Reaktionszeit, s. Plan Phase 9 Punkt 4 — ohne diese Pause würde der
      // Bot im selben Moment droppen, in dem Drehung/Spalte zufällig schon
      // passen, was sich instant statt reagierend anfühlt).
      state.dropPause = ep.reactionInterval * 0.5;
    }
    if (field.piece && state.plan) {
      const p = field.piece;
      const misaligned = p.rot !== state.plan.rot || p.col !== state.plan.col;
      if (misaligned) {
        // Höchstens EINE Dreh-/Verschiebe-Eingabe pro ACTION_INTERVAL — vorher
        // lief das ungebremst mit jedem Frame (s. Kommentar bei ACTION_INTERVAL).
        if (state.actionT <= 0) {
          state.actionT = ACTION_INTERVAL;
          if (p.rot !== state.plan.rot) out.rot = 1;
          else out.dx = p.col < state.plan.col ? 1 : -1;
        }
      } else {
        state.dropPause -= dt;
        if (state.dropPause <= 0) {
          if (Math.random() < ep.hardDropChance) out.hard = 1;
          else out.soft = true;
        }
      }
    }

    // ── Spells (Ziel bleibt über mehrere Frames bestehen, bis erreicht) ─
    if (!state.spellGoal) {
      state.spellCd -= dt;
      if (state.spellCd <= 0) {
        state.spellCd = ep.spellDelay * (0.8 + Math.random() * 0.4);
        if (Math.random() < ep.spellChance) state.spellGoal = pickSpell(self, world);
      }
    }
    if (state.spellGoal) {
      const actions = world.spellActions(self.id);
      const idx = actions.findIndex((a) => a.spellId === state.spellGoal.spellId && a.targetId === state.spellGoal.targetId);
      if (idx < 0) {
        state.spellGoal = null; // Ziel nicht mehr verfügbar (Inventar/Gegner weg)
      } else if (world.spellCursor(self.id) === idx) {
        out.cast = 1;
        state.spellGoal = null;
      } else {
        out.cycle = 1;
      }
    }

    return out;
  }

  return { think };
}
