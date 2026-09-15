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
  // Neue Felder ggü. der alten Tabelle:
  //   escapeSamples — Richtungen der Sampling-Flucht (3 grob … >8 + Laufrichtung)
  //   herding       — Träger drängt Ziele zur Kante (Zielwahl + Anflugseite); 0 aus
  //   anticipation  — Sekunden Vorhalt: Nicht-Träger fliehen vor der VORHERGESAGTEN
  //                   Position des Trägers (leichter Vorteil nur für starke Bots)
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
    escapeSamples: 3,
    herding: 0,
    anticipation: 0,
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
    escapeSamples: 8,
    herding: 0.4,
    anticipation: 0.15,
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
    escapeSamples: 9,
    herding: 1.0,
    anticipation: 0.4,
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

function computeInterceptTarget(self, target, lastSeenPos, ep, world) {
  let ax = target.x, az = target.z;
  if (lastSeenPos) {
    const vx = target.x - lastSeenPos.x;
    const vz = target.z - lastSeenPos.z;
    // Vorhalt nach Entfernung skalieren: auf Distanz lohnt sich, auf den
    // vorhergesagten Punkt zuzulaufen (mehr Zeit bis zum Zusammentreffen);
    // kurz vor dem Ziel wird der Vorhalt zurückgenommen, sonst rennt der Bot
    // knapp dran vorbei statt zuzupacken.
    const dist = Math.hypot(target.x - self.x, target.z - self.z);
    const distFactor = Math.max(0.4, Math.min(1.6, dist / 4));
    const lead = (ep.interceptLead ?? 0.3) * distFactor;
    ax += vx * lead;
    az += vz * lead;
  }
  // Herding: von der "sicheren" Seite des Ziels anfliegen, damit das Ziel beim
  // Wegfliehen Richtung Kante gedrängt wird (nur mittlere/schwere Bots).
  const herd = ep.herding || 0;
  if (herd > 0 && world?.map?.steerToSafety) {
    const s = world.map.steerToSafety(target.x, target.z);
    const sl = Math.hypot(s.x, s.z);
    if (sl > 1e-3) {
      ax += (s.x / sl) * herd * 1.2;
      az += (s.z / sl) * herd * 1.2;
    }
  }
  return { x: ax, z: az };
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
    avoidDirection: null,
    holderSample: null, // { id, x, z } vom Vorframe — für Träger-Geschwindigkeit
  };

  // Bedrohungspunkte für die Sampling-Flucht: der (ggf. vorhergesagte) Träger
  // mit vollem Gewicht plus nahe Mit-Nicht-Träger mit mildem Gewicht, damit die
  // Bots sich verteilen statt zu verklumpen (schwerer als Gruppe zu fangen).
  function buildThreatPoints(self, world, holderPos) {
    const pts = [{ x: holderPos.x, z: holderPos.z, weight: 1 }];
    for (const o of world.players) {
      if (!o.alive || o.id === self.id || o.id === world.holderId) continue;
      const d = Math.hypot(self.x - o.x, self.z - o.z);
      if (d < 3.5) pts.push({ x: o.x, z: o.z, weight: 0.6 });
    }
    return pts;
  }

  function pickTarget(self, world) {
    const others = world.players.filter(q => q.alive && q.id !== self.id);
    if (!others.length) return null;

    // Reachability-aware scoring. edgeMag ~ Nähe zur Kante des Ziels.
    // Ohne Herding (easy) werden Randziele gemieden (+), mit Herding (schwer)
    // bevorzugt, weil sie leichter über die Kante zu drängen sind (−).
    const herd = ep.herding || 0;
    const edgeWeight = 4 - herd * 8;
    const scored = others.map(o => {
      const d = Math.hypot(self.x - o.x, self.z - o.z);
      const edgeMag = world.map.steerToSafety
        ? Math.hypot(...Object.values(world.map.steerToSafety(o.x, o.z)))
        : 0;
      return { id: o.id, score: d + edgeMag * edgeWeight };
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

    // Träger-Geschwindigkeit jeden Frame mitführen (für „nähert sich"-Erkennung
    // und die vorhergesagte Fluchtposition).
    const holderNow = world.players.find(q => q.id === world.holderId && q.alive);
    let holderVel = { x: 0, z: 0 };
    if (holderNow) {
      if (state.holderSample && state.holderSample.id === holderNow.id) {
        holderVel = { x: holderNow.x - state.holderSample.x, z: holderNow.z - state.holderSample.z };
      }
      state.holderSample = { id: holderNow.id, x: holderNow.x, z: holderNow.z };
    } else {
      state.holderSample = null;
    }

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
        const holder = holderNow;
        if (holder) {
          const dHolder = Math.hypot(self.x - holder.x, self.z - holder.z);
          // Nähert sich der Träger? Dann früher fliehen (größerer Radius).
          const approaching =
            holderVel.x * (self.x - holder.x) + holderVel.z * (self.z - holder.z) > 0;
          const fleeR = approaching ? ep.fleeRadius * 1.4 : ep.fleeRadius;
          if (panic || dHolder < fleeR) {
            state.targetId = world.holderId;
            state.mode = 'flee';
            state.avoidDirection = null;
          } else if (dHolder < ep.preferredDistance * 1.5) {
            // In comfort buffer — roam away from holder
            state.mode = 'roam';
            state.avoidDirection = {
              x: self.x - holder.x,
              z: self.z - holder.z,
            };
          } else {
            // Free roaming
            state.mode = 'roam';
            state.avoidDirection = null;
          }
        } else {
          state.mode = 'roam';
          state.avoidDirection = null;
        }
      }
    }

    // Resolve target and build decision
    let target = null;
    let targetPos = null;
    let threatPoints = null;
    if (state.mode !== 'roam') {
      target = world.players.find(q => q.id === state.targetId && q.alive);
      if (target) {
        if (state.mode === 'pass') {
          const lastSeen = state.lastSeenPos.get(target.id);
          targetPos = computeInterceptTarget(self, target, lastSeen, ep, world);
        } else if (state.mode === 'flee') {
          // Vor der VORHERGESAGTEN Position des Trägers fliehen (Vorhalt nur bei
          // starken Bots > 0). holderVel ist Bewegung/Frame → /dt = pro Sekunde.
          const lead = (ep.anticipation || 0) / Math.max(dt, 1e-3);
          targetPos = {
            x: target.x + holderVel.x * lead,
            z: target.z + holderVel.z * lead,
          };
          threatPoints = buildThreatPoints(self, world, targetPos);
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
      threatPoints,
      panic,
      avoidDirection: state.avoidDirection,
    };

    return mover.update(self, world, dt, decision);
  }

  return { think };
}
