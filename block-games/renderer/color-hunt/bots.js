// Farbjagd — Bot-Entscheidungslogik.
//
// ANDERES Genre als botAI.js (Charakterbewegung) und block-rush/bots.js
// (Teile-Platzierung) — hier geht es um Regler-Werte. Der Bot liefert GENAU
// dieselbe Intent-Form wie ein Mensch am LocalColorController
// ({d:[dr,dg,db], cur, lock, seq}) — kein privilegierter Pfad.
//
// KEIN Cheaten: `world.target` ist NUR während der Phase "show" gesetzt,
// exakt so lange, wie ein Mensch die Zielfarbe auch sieht. Der Bot merkt/
// wählt sich seine Zielfarbe für den Zug in genau diesem Moment und arbeitet
// danach nur noch mit dieser Erinnerung — genau wie ein Mensch.
//
// Als Jäger: Gedächtnis-Rauschen je Kanal (Gauß, stärker bei niedrigerer
// Schwierigkeit), dann kanalweise auf den gemerkten Wert zusteuern, danach
// einloggen (kleine Denkpause vor dem allerersten Zug).
// Als Störer: wählt aus der gesehenen Zielfarbe eine Ablenkfarbe — entweder
// einen "Beinahe-Treffer" (Versatz auf 1-2 Kanälen) oder den Kontrast/das
// Komplement — und steuert dorthin. Störer loggen nie ein (kein Timing-Druck
// nötig, ihre Fläche zählt nie für die Wertung).

'use strict';

import { STEP, clamp255 } from './color.js';

const PROFILES = {
  medium: { reactionDelay: 0.5, actionInterval: 0.11, memorySigma: 16, lockDelay: 0.7, decoyNearChance: 0.6, decoyOffset: 45 },
  hard:   { reactionDelay: 0.25, actionInterval: 0.07, memorySigma: 6, lockDelay: 0.35, decoyNearChance: 0.5, decoyOffset: 60 },
};
PROFILES.normal = PROFILES.medium;

// Box-Muller — gaußverteiltes Rauschen fürs Kanal-Gedächtnis.
function gaussian(sigma) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function onGrid(v) { return clamp255(Math.round(v / STEP) * STEP); }

function noisyMemory(target, sigma) {
  return target.map((c) => onGrid(c + gaussian(sigma)));
}

function pickDecoyColor(target, ep) {
  if (Math.random() < ep.decoyNearChance) {
    const out = target.slice();
    const order = [0, 1, 2].sort(() => Math.random() - 0.5);
    const n = 1 + Math.floor(Math.random() * 2); // 1 oder 2 Kanäle versetzen
    for (let i = 0; i < n; i++) {
      const c = order[i];
      const dir = Math.random() < 0.5 ? 1 : -1;
      out[c] = onGrid(out[c] + dir * ep.decoyOffset);
    }
    return out;
  }
  return target.map((c) => onGrid(255 - c)); // Kontrast/Komplement
}

export function makeColorHuntBotBrain(difficulty) {
  const base = PROFILES[difficulty] || PROFILES.medium;
  // Persönlichkeits-Streuung, damit Bots nicht synchron handeln.
  const ep = {
    ...base,
    reactionDelay: base.reactionDelay * (0.8 + Math.random() * 0.4),
    actionInterval: base.actionInterval * (0.85 + Math.random() * 0.3),
  };

  const state = {
    turnIndex: -1,
    goal: null,      // gemerkte/gewählte Zielfarbe für DIESEN Zug
    actionT: 0,
    thinkT: 0,
    locked: false,
  };

  function think(self, world, dt) {
    const out = { d: [0, 0, 0], cur: self.cur || 0, lock: 0, seq: 0 };

    // Neuer Zug → kompletter Reset (neue Reaktionszeit, neue Denkpause).
    if (state.turnIndex !== world.turnIndex) {
      state.turnIndex = world.turnIndex;
      state.goal = null;
      state.actionT = Math.random() * ep.actionInterval;
      state.thinkT = ep.reactionDelay;
      state.locked = false;
    }

    // Zielfarbe nur in "show" sichtbar — hier einmalig merken/wählen.
    if (world.phase === 'show' && world.target && !state.goal) {
      state.goal = self.isHunter ? noisyMemory(world.target, ep.memorySigma) : pickDecoyColor(world.target, ep);
    }
    if (world.phase !== 'mix' || !state.goal || state.locked) return out;

    state.thinkT -= dt;
    if (state.thinkT > 0) return out;

    state.actionT -= dt;
    if (state.actionT > 0) return out;
    state.actionT = ep.actionInterval;

    // Kanal mit dem größten verbleibenden Abstand zuerst angehen — wie ein
    // Mensch, der zuerst den auffälligsten Fehler korrigiert.
    const rgb = self.rgb;
    let bestC = -1, bestDiff = 0;
    for (let c = 0; c < 3; c++) {
      const diff = Math.abs(state.goal[c] - rgb[c]);
      if (diff > bestDiff) { bestDiff = diff; bestC = c; }
    }
    if (bestC === -1) {
      if (self.isHunter) { out.lock = 1; state.locked = true; }
      return out;
    }
    out.cur = bestC;
    out.d[bestC] = state.goal[bestC] > rgb[bestC] ? STEP : -STEP;
    out.seq = 1;
    return out;
  }

  return { think };
}
