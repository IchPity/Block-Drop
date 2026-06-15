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
  easy: {
    reactionInterval: 0.55,
    wrongTargetChance: 0.45,
    avoidStrength: 0.6,
    edgeStrength: 0.8,
    panicAt: 1.5,
    turnSpeed: 3.2,
    stuckLimit: 0.45,
    recoveryTime: 0.8,
    hardStuckThreshold: 4,
    wanderJitterAmp: 0.55,
    wanderJitterDrift: 2.8,
    fleeRadius: 4.0,
    interceptRadius: 1.8,
    interceptLead: 0,
    passBombDangerScale: 0.8,
    waypointRandomness: 0.5,
  },
  medium: {
    reactionInterval: 0.34,
    wrongTargetChance: 0.28,
    avoidStrength: 0.9,
    edgeStrength: 1.1,
    panicAt: 2.5,
    turnSpeed: 5,
    stuckLimit: 0.35,
    recoveryTime: 0.6,
    hardStuckThreshold: 3,
    wanderJitterAmp: 0.40,
    wanderJitterDrift: 2.2,
    fleeRadius: 5.0,
    interceptRadius: 2.5,
    interceptLead: 0.3,
    passBombDangerScale: 0.6,
    waypointRandomness: 0.25,
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
    hardStuckThreshold: 3,
    wanderJitterAmp: 0.16,
    wanderJitterDrift: 1.4,
    fleeRadius: 7.0,
    interceptRadius: 3.5,
    interceptLead: 0.8,
    passBombDangerScale: 0.35,
    waypointRandomness: 0.08,
  },
};

// Alias für Klarheit (intern)
PROFILES.normal = PROFILES.medium;

function norm(x, z) {
  const l = Math.hypot(x, z);
  if (l < 1e-4) return { x: 0, z: 0 };
  return { x: x / l, z: z / l };
}

function dist2(a, b) {
  const dx = a.x - b.x, dz = a.z - b.z;
  return dx * dx + dz * dz;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function randomPersonality() {
  return {
    reactionTime: 0.7 + Math.random() * 0.6,
    aggression: 0.6 + Math.random() * 0.8,
    bravery: 0.5 + Math.random() * 1.0,
    randomness: Math.random(),
    preferredDistance: 3.5 + Math.random() * 3.0,
    mistakeChance: Math.random(),
  };
}

function computeInterceptTarget(self, target, lastSeenPos, ep) {
  if (!lastSeenPos) return { x: target.x, z: target.z };
  const vx = target.x - lastSeenPos.x;
  const vz = target.z - lastSeenPos.z;
  const lead = ep.interceptLead ?? 0.3;
  return {
    x: target.x + vx * lead,
    z: target.z + vz * lead,
  };
}

export function makeBotBrain(difficulty) {
  const baseProfile = PROFILES[difficulty] || PROFILES.medium;
  const personality = randomPersonality();

  // Modulate base profile with personality
  const ep = {
    ...baseProfile,
    reactionInterval: baseProfile.reactionInterval * personality.reactionTime,
    wrongTargetChance: clamp01(baseProfile.wrongTargetChance * (0.5 + personality.mistakeChance)),
    turnSpeed: baseProfile.turnSpeed * (0.85 + personality.aggression * 0.2),
    fleeRadius: baseProfile.fleeRadius * (0.7 + personality.bravery * 0.4),
    interceptRadius: baseProfile.interceptRadius * (0.8 + personality.aggression * 0.3),
    waypointRandomness: clamp01(baseProfile.waypointRandomness + personality.randomness * 0.3),
    preferredDistance: personality.preferredDistance,
  };

  const mover = createBotMover(ep);
  const state = {
    react: Math.random() * ep.reactionInterval,
    targetId: null,
    mode: 'roam',
    lastSeenPos: new Map(),
    mistakeTimer: 0,
  };

  function pickTarget(self, world) {
    const others = world.players.filter(q => q.alive && q.id !== self.id);
    if (!others.length) return null;

    // Reachability-aware scoring
    const scored = others.map(o => {
      const d = Math.hypot(self.x - o.x, self.z - o.z);
      const edgePenalty = world.map.steerToSafety
        ? Math.hypot(...Object.values(world.map.steerToSafety(o.x, o.z))) * 4
        : 0;
      return { id: o.id, score: d + edgePenalty };
    });

    scored.sort((a, b) => a.score - b.score);

    if (scored.length > 1 && Math.random() < ep.wrongTargetChance) {
      return scored[1].id;
    }
    return scored[0].id;
  }

  function think(self, world, dt) {
    const panic = world.timeLeft <= ep.panicAt;
    state.react -= dt;
    const interval = panic ? ep.reactionInterval * 0.5 : ep.reactionInterval;

    if (state.react <= 0) {
      state.react = interval;

      // Occasional "mistake": ignore decision and roam instead
      if (Math.random() < personality.mistakeChance * 0.1) {
        state.mode = 'roam';
      } else if (self.isHolder) {
        const targetId = pickTarget(self, world);
        const target = world.players.find(q => q.id === targetId && q.alive);
        if (target) {
          state.targetId = targetId;
          state.lastSeenPos.set(targetId, { x: target.x, z: target.z });

          // Transition to PASS_BOMB if close enough
          const dist = Math.hypot(self.x - target.x, self.z - target.z);
          const passThreshold = panic ? ep.interceptRadius * 1.5 : ep.interceptRadius;
          state.mode = dist < passThreshold ? 'pass' : 'chase';
        } else {
          state.mode = 'roam';
        }
      } else {
        // Non-holder logic
        const holder = world.players.find(q => q.id === world.holderId && q.alive);
        if (holder) {
          const dHolder = Math.hypot(self.x - holder.x, self.z - holder.z);
          if (panic || dHolder < ep.fleeRadius) {
            state.targetId = world.holderId;
            state.mode = 'flee';
          } else if (dHolder < ep.preferredDistance * 1.5) {
            // In comfort buffer — roam away from holder
            state.mode = 'roam';
            mover.avoidDirection = {
              x: self.x - holder.x,
              z: self.z - holder.z,
            };
          } else {
            // Free roaming
            state.mode = 'roam';
            mover.avoidDirection = null;
          }
        } else {
          state.mode = 'roam';
        }
      }
    }

    // Resolve target and build decision
    let target = null;
    let targetPos = null;
    if (state.mode !== 'roam') {
      target = world.players.find(q => q.id === state.targetId && q.alive);
      if (target) {
        if (state.mode === 'pass') {
          const lastSeen = state.lastSeenPos.get(target.id);
          targetPos = computeInterceptTarget(self, target, lastSeen, ep);
        } else {
          targetPos = { x: target.x, z: target.z };
        }
        state.lastSeenPos.set(target.id, { x: target.x, z: target.z });
      } else {
        state.mode = 'roam';
      }
    }

    const decision = {
      mode: state.mode,
      targetPos,
      panic,
      avoidDirection: mover.avoidDirection,
    };

    return mover.update(self, world, dt, decision);
  }

  return { think };
}
