// Laser Lines — Bot-Entscheidungslogik (dünner Adapter).
//
// Dieses Modul entscheidet, WAS der Bot tun soll (vor Lasern fliehen, sichere
// Zonen suchen, sonst entspannt wandern). Das WIE (sichere Bewegung, Steering,
// Stuck-Recovery, Rand-/Abgrund-Vermeidung) delegiert es an botAI.js — ganz
// OHNE botAI.js anzufassen. Die gewünschten Laser-Zustände werden auf die
// vorhandenen botAI-States abgebildet:
//   WANDER          → ROAM
//   AVOID_LASER     → FLEE (Ziel = nächster Punkt auf dem bedrohenden Laser)
//   SEEK_SAFE_ZONE  → FLEE weg vom Warnfeld-Zentrum (Sky Warning)
//   STUCK_RECOVERY  → UNSTUCK (automatisch in botAI)
//   AVOID_EDGE      → AVOID_EDGE (automatisch über map.steerToSafety)
//
// Fairness: Bots reagieren nur auf SICHTBARE Gefahren (Warnung/aktiver Laser) —
// nicht auf zukünftige, für Menschen unsichtbare Laser. Schwierigkeit steuert
// Reaktionszeit + Fehlerrate (Easy langsamer/fehleranfälliger, Schwer schneller
// und mit mehr Abstand).

'use strict';

import { createBotMover } from '../game/bots/botAI.js';

const PROFILES = {
  easy: {
    reactionInterval: 0.50, ignoreChance: 0.28, fleeRadius: 4.5,
    turnSpeed: 3.4, avoidStrength: 0.6, edgeStrength: 1.0,
    stuckLimit: 0.45, recoveryTime: 0.8, hardStuckThreshold: 4,
    wanderJitterAmp: 0.50, wanderJitterDrift: 2.6, waypointRandomness: 0.5,
    passBombDangerScale: 0.6,
  },
  medium: {
    reactionInterval: 0.28, ignoreChance: 0.08, fleeRadius: 5.5,
    turnSpeed: 5.5, avoidStrength: 0.9, edgeStrength: 1.2,
    stuckLimit: 0.35, recoveryTime: 0.6, hardStuckThreshold: 3,
    wanderJitterAmp: 0.40, wanderJitterDrift: 2.0, waypointRandomness: 0.3,
    passBombDangerScale: 0.6,
  },
  hard: {
    reactionInterval: 0.13, ignoreChance: 0.02, fleeRadius: 6.8,
    turnSpeed: 9, avoidStrength: 1.2, edgeStrength: 1.6,
    stuckLimit: 0.25, recoveryTime: 0.6, hardStuckThreshold: 3,
    wanderJitterAmp: 0.18, wanderJitterDrift: 1.4, waypointRandomness: 0.1,
    passBombDangerScale: 0.6,
  },
};
PROFILES.normal = PROFILES.medium;

export function makeLaserBotBrain(difficulty) {
  const base = PROFILES[difficulty] || PROFILES.medium;
  // leichte Persönlichkeits-Streuung, damit Bots nicht synchron handeln
  const ep = {
    ...base,
    reactionInterval: base.reactionInterval * (0.85 + Math.random() * 0.4),
    fleeRadius: base.fleeRadius * (0.9 + Math.random() * 0.2),
  };
  const mover = createBotMover(ep);
  const state = {
    react: Math.random() * ep.reactionInterval,
    threatened: false,
    ignore: false,
  };

  function think(self, world, dt) {
    // Gefahr jeden Frame frisch lesen (Laser bewegen sich), Entscheidung zum
    // FLIEHEN aber nur im Reaktions-Intervall neu fällen (Reaktionszeit).
    const danger = world.laserDanger ? world.laserDanger(self.x, self.z) : null;

    state.react -= dt;
    if (state.react <= 0) {
      state.react = ep.reactionInterval;
      state.ignore = Math.random() < ep.ignoreChance;
      state.threatened = !!(danger && danger.dist < ep.fleeRadius);
    }

    let mode = 'roam';
    let targetPos = null;
    if (state.threatened && !state.ignore && danger) {
      mode = 'flee';
      targetPos = danger.point; // wegfliehen vom nächsten Punkt des Lasers
    }

    const decision = { mode, targetPos };
    return mover.update(self, world, dt, decision);
  }

  return { think };
}
