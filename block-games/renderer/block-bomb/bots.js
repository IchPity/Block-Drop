// Block Bomb — Bot-Entscheidungslogik (dünner Adapter).
//
// Dieses Modul entscheidet, WAS der Bot tun soll (Ziel wählen, Mode
// CHASE/FLEE/WANDER entscheiden, Panik berücksichtigen). Das WIE (sichere
// Bewegung, Steering, Stuck-Recovery) delegiert es an botAI.js.
//
// Fairness durch: Reaktionsverzögerung (Zielwahl nur in Intervallen),
// Fehlentscheidungen (wrongTargetChance), Flucht-Reichweite (Bots wandern
// entspannt, wenn der Träger weit weg ist). Geschwindigkeit gleich für alle.

'use strict';

import { createBotMover } from '../game/bots/botAI.js';

const PROFILES = {
  medium: {
    reactionInterval: 0.34,
    wrongTargetChance: 0.28,
    avoidStrength: 0.9,
    edgeStrength: 1.1,
    panicAt: 2.5,
    turnSpeed: 5,
    stuckLimit: 0.35,
    recoveryTime: 0.6,
    wanderJitterAmp: 0.40,
    wanderJitterDrift: 2.2,
    fleeRadius: 5.0,
  },
  hard: {
    reactionInterval: 0.13,
    wrongTargetChance: 0.06,
    avoidStrength: 1.3,
    edgeStrength: 1.6,
    panicAt: 4.0,
    turnSpeed: 9,
    stuckLimit: 0.25,
    recoveryTime: 0.6,
    wanderJitterAmp: 0.16,
    wanderJitterDrift: 1.4,
    fleeRadius: 7.0,
  },
};

function norm(x, z) {
  const l = Math.hypot(x, z);
  if (l < 1e-4) return { x: 0, z: 0 };
  return { x: x / l, z: z / l };
}

function dist2(a, b) {
  const dx = a.x - b.x, dz = a.z - b.z;
  return dx * dx + dz * dz;
}

export function makeBotBrain(difficulty) {
  const p = PROFILES[difficulty] || PROFILES.medium;
  const mover = createBotMover(p);
  const state = {
    react: Math.random() * p.reactionInterval,
    targetId: null,
    mode: 'wander',
  };

  function pickTarget(self, world) {
    const others = world.players.filter(q => q.alive && q.id !== self.id);
    if (!others.length) return null;
    others.sort((a, b) => dist2(self, a) - dist2(self, b));
    if (others.length > 1 && Math.random() < p.wrongTargetChance) {
      return others[1].id;
    }
    return others[0].id;
  }

  function think(self, world, dt) {
    const panic = world.timeLeft <= p.panicAt;
    state.react -= dt;
    const interval = panic ? p.reactionInterval * 0.5 : p.reactionInterval;

    if (state.react <= 0) {
      state.react = interval;
      if (self.isHolder) {
        state.targetId = pickTarget(self, world);
        state.mode = 'chase';
      } else {
        state.targetId = world.holderId;
        const holder = world.players.find(q => q.id === state.targetId && q.alive);
        if (panic) {
          state.mode = 'flee';
        } else if (holder && Math.hypot(self.x - holder.x, self.z - holder.z) < p.fleeRadius) {
          state.mode = 'flee';
        } else {
          state.mode = 'wander';
        }
      }
    }

    const target = state.mode !== 'wander'
      ? world.players.find(q => q.id === state.targetId && q.alive)
      : null;
    const decision = target
      ? { mode: state.mode, targetPos: { x: target.x, z: target.z }, panic }
      : { mode: 'wander', targetPos: null, panic };

    return mover.update(self, world, dt, decision);
  }

  return { think };
}
