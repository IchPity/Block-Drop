// Wiederverwendbare, generische Bot-KI für Party-Spiele.
//
// Eigentümer dieses Moduls: Zustandsmaschine (IDLE/ROAM/CHASE/FLEE/PASS_BOMB/AVOID_EDGE/UNSTUCK),
// Edge-Lookahead, Anti-Stuck-Erkennung mit Eskalation (Teleport), Wand-/Ecken-Vermeidung,
// Steering, Jitter (nur Fallback-WANDER ohne Waypoints).
// Per-Spiel-Adapter (z.B. bots.js) entscheidet WAS der Bot tun soll; dieses Modul
// entscheidet WIE er es sicher tut.

'use strict';

import { pickWaypoint, nearestWaypoint, isAtWaypoint } from './waypoints.js';

export const BotState = Object.freeze({
  IDLE: 'idle',
  ROAM: 'roam',
  CHASE: 'chase',
  FLEE: 'flee',
  PASS_BOMB: 'pass_bomb',
  AVOID_EDGE: 'avoid_edge',
  UNSTUCK: 'unstuck',
});

export let DEBUG_BOTS = false;

export function setDebugBots(v) {
  DEBUG_BOTS = v;
}

function norm(x, z) {
  const l = Math.hypot(x, z);
  if (l < 1e-4) return { x: 0, z: 0 };
  return { x: x / l, z: z / l };
}

function rotate(dir, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return {
    x: dir.x * c - dir.z * s,
    z: dir.x * s + dir.z * c,
  };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const DIRS_8 = [
  { x: 1, z: 0 },
  { x: 1, z: 1 },
  { x: 0, z: 1 },
  { x: -1, z: 1 },
  { x: -1, z: 0 },
  { x: -1, z: -1 },
  { x: 0, z: -1 },
  { x: 1, z: -1 },
].map(d => norm(d.x, d.z));

export function createBotMover(profile) {
  const mover = {
    state: BotState.IDLE,
    velocity: { x: 0, z: 0 },
    lastPos: null,
    stuckTimer: 0,
    repeatedStuckCount: 0,
    goodMovementTimer: 0,
    recoveryTimer: 0,
    recoveryDir: null,
    idleTimer: 0.15 + Math.random() * 0.15,
    currentWaypoint: null,
    wanderTimer: 0,
    wanderDir: { x: 1, z: 0 },
    jx: 0,
    jz: 0,
  };

  function wouldCollide(self, world, dir) {
    const r = world.radius ?? 0.55;
    const step = r * 1.2;
    const tx = self.x + dir.x * step;
    const tz = self.z + dir.z * step;
    const res = world.map.resolve(tx, tz, r);
    if (res.fell) return true;
    const dx = res.x - tx, dz = res.z - tz;
    return Math.hypot(dx, dz) > r * 0.5;
  }

  function getRandomFreeDirection(self, world) {
    const shuffled = shuffle([...DIRS_8]);
    for (const d of shuffled) {
      if (!wouldCollide(self, world, d)) return d;
    }
    return norm(Math.random() * 2 - 1, Math.random() * 2 - 1);
  }

  function avoidWalls(self, world, desired) {
    if (!wouldCollide(self, world, desired)) return desired;
    const left = rotate(desired, Math.PI / 2);
    const right = rotate(desired, -Math.PI / 2);
    const leftFree = !wouldCollide(self, world, left);
    const rightFree = !wouldCollide(self, world, right);
    if (leftFree && rightFree) return Math.random() < 0.5 ? left : right;
    if (leftFree) return left;
    if (rightFree) return right;
    return getRandomFreeDirection(self, world);
  }

  function computeDanger(self, world, profile) {
    let ax = 0, az = 0;
    const list = world.obstacles || [];
    for (const o of list) {
      const dx = self.x - o.x, dz = self.z - o.z;
      const d = Math.hypot(dx, dz);
      const safe = o.r + 1.4;
      if (d < safe && d > 1e-3) {
        const push = (safe - d) / safe;
        ax += (dx / d) * push;
        az += (dz / d) * push;
      }
    }
    let edge = { x: 0, z: 0 };
    if (world.map && world.map.steerToSafety) {
      edge = world.map.steerToSafety(self.x, self.z);
    }
    return {
      x: ax * profile.avoidStrength + edge.x * profile.edgeStrength,
      z: az * profile.avoidStrength + edge.z * profile.edgeStrength,
    };
  }

  function applyWallGliding(desired, danger) {
    const hLen = Math.hypot(danger.x, danger.z);
    if (hLen <= 1e-3) return desired;
    const hnx = danger.x / hLen, hnz = danger.z / hLen;
    const into = desired.x * hnx + desired.z * hnz;
    if (into < 0) {
      return {
        x: desired.x - into * hnx,
        z: desired.z - into * hnz,
      };
    }
    return desired;
  }

  function updateWander(mover, profile, dt = 0.016) {
    if (!mover.wanderTimer) mover.wanderTimer = 0.6 + Math.random() * 0.8;
    if (!mover.wanderDir) mover.wanderDir = { x: 1, z: 0 };
    mover.wanderTimer -= dt;
    if (mover.wanderTimer <= 0) {
      mover.wanderTimer = 0.6 + Math.random() * 0.8;
      const angle = Math.atan2(mover.wanderDir.z, mover.wanderDir.x) + (Math.random() * 2 - 1) * 1.2;
      mover.wanderDir = { x: Math.cos(angle), z: Math.sin(angle) };
    }
    return { x: mover.wanderDir.x, z: mover.wanderDir.z };
  }

  function driftJitter(mover, profile, dt) {
    mover.jx += (Math.random() * 2 - 1) * profile.wanderJitterDrift * 0.1;
    mover.jz += (Math.random() * 2 - 1) * profile.wanderJitterDrift * 0.1;
    const a = profile.wanderJitterAmp;
    mover.jx = Math.max(-a, Math.min(a, mover.jx));
    mover.jz = Math.max(-a, Math.min(a, mover.jz));
  }

  function steerBot(desired, dt, profile) {
    const dn = norm(desired.x, desired.z);
    const t = Math.min(1, profile.turnSpeed * dt);
    mover.velocity.x += (dn.x - mover.velocity.x) * t;
    mover.velocity.z += (dn.z - mover.velocity.z) * t;
  }

  function decisionToState(mode) {
    switch (mode) {
      case 'chase': return BotState.CHASE;
      case 'flee': return BotState.FLEE;
      case 'pass': return BotState.PASS_BOMB;
      case 'roam': return BotState.ROAM;
      case 'wander': return BotState.ROAM; // Legacy alias
      default: return BotState.ROAM;
    }
  }

  function checkEdgeAhead(self, world, velocity) {
    const l = Math.hypot(velocity.x, velocity.z);
    if (l < 1e-3) return false;
    const dir = { x: velocity.x / l, z: velocity.z / l };
    const r = world.radius ?? 0.55;
    const lookDist = r * 2.5;
    const probeX = self.x + dir.x * lookDist;
    const probeZ = self.z + dir.z * lookDist;
    const res = world.map.resolve(probeX, probeZ, r);
    if (res.fell) return true;
    const edge = world.map.steerToSafety ? world.map.steerToSafety(probeX, probeZ) : { x: 0, z: 0 };
    return Math.hypot(edge.x, edge.z) > 0.6;
  }

  function computeRoamDesired(self, world, mover, profile, decision = {}) {
    // Adapter-vorgegebenes Ziel (z.B. Safe-Zone-Seeking in Laser Lines):
    // direkt ansteuern, bis erreicht — überschreibt die Zufalls-Waypoints.
    if (decision.preferredWaypoint) {
      if (isAtWaypoint(self, decision.preferredWaypoint)) {
        mover.currentWaypoint = decision.preferredWaypoint;
      } else {
        return norm(
          decision.preferredWaypoint.x - self.x,
          decision.preferredWaypoint.z - self.z,
        );
      }
    }
    if (world.map.waypoints?.length) {
      // Waypoint-driven ROAM
      if (!mover.currentWaypoint || isAtWaypoint(self, mover.currentWaypoint)) {
        mover.currentWaypoint = pickWaypoint(self, world, {
          excludeId: mover.currentWaypoint?.id,
          avoidTags: ['edge-risk'],
          randomness: profile.waypointRandomness ?? 0.25,
          avoidDirection: decision.avoidDirection,
        });
      }
      if (mover.currentWaypoint) {
        const dx = mover.currentWaypoint.x - self.x;
        const dz = mover.currentWaypoint.z - self.z;
        return norm(dx, dz);
      }
    }
    // Fallback: old WANDER behavior (updateWander + driftJitter handled outside)
    const d = updateWander(mover, profile);
    return { x: d.x, z: d.z };
  }

  function computeFleeDesired(self, world, decision, mover, profile) {
    if (!decision.targetPos) return updateWander(mover, profile);
    let desired = norm(self.x - decision.targetPos.x, self.z - decision.targetPos.z);
    // Blend in safe waypoint if available
    if (world.map.waypoints?.length) {
      const safeWp = nearestWaypoint(self, world, { preferTags: ['safe'] });
      if (safeWp) {
        const dToTarget = Math.hypot(safeWp.x - decision.targetPos.x, safeWp.z - decision.targetPos.z);
        const dFromTarget = Math.hypot(self.x - decision.targetPos.x, self.z - decision.targetPos.z);
        if (dToTarget > dFromTarget * 0.8) {
          // Safe waypoint is further from target → bias toward it
          const toSafe = norm(safeWp.x - self.x, safeWp.z - self.z);
          desired.x = desired.x * 0.6 + toSafe.x * 0.4;
          desired.z = desired.z * 0.6 + toSafe.z * 0.4;
          desired = norm(desired.x, desired.z);
        }
      }
    }
    return desired;
  }

  // Abstand zur nächstgelegenen Bedrohung an Punkt (x,z) — größer = sicherer.
  // Berücksichtigt mehrere Bedrohungspunkte (decision.threatPoints) UND eine
  // optionale Gefahr-Funktion (decision.dangerFn, z.B. world.laserDanger, die
  // bereits ALLE Laser abscannt). Das macht die Flucht multi-bedrohungs-bewusst.
  function threatClearance(x, z, decision) {
    let minD = Infinity;
    const pts = decision.threatPoints;
    if (pts?.length) {
      for (const tp of pts) {
        const w = tp.weight ?? 1;
        const d = Math.hypot(x - tp.x, z - tp.z) / w;
        if (d < minD) minD = d;
      }
    }
    if (decision.dangerFn) {
      const dg = decision.dangerFn(x, z);
      if (dg && typeof dg.dist === 'number') {
        const d = dg.dist - (dg.active ? 1.5 : 0);
        if (d < minD) minD = d;
      }
    }
    return isFinite(minD) ? minD : 99;
  }

  // Sampling-basierte Fluchtrichtung: probt mehrere Richtungen, bewertet jede
  // nach Abstand zu ALLEN Bedrohungen am Probe-Punkt, verwirft Richtungen, die
  // in den Abgrund oder gegen Wände führen, und meidet Kartenränder. Dadurch
  // weicht der Bot SEITLICH aus statt blind rückwärts in einen zweiten Laser /
  // über die Kante zu laufen. Fällt auf computeFleeDesired zurück, falls keine
  // Richtung brauchbar ist.
  function chooseEscapeDirection(self, world, decision, profile) {
    const away = computeFleeDesired(self, world, decision, mover, profile);

    const samples = profile.escapeSamples ?? 8;
    let candidates;
    if (samples <= 4) {
      candidates = [DIRS_8[0], DIRS_8[2], DIRS_8[4], DIRS_8[6]];
    } else {
      candidates = [...DIRS_8];
      if (samples > 8) {
        const vlen = Math.hypot(mover.velocity.x, mover.velocity.z);
        if (vlen > 1e-3) {
          candidates.push({ x: mover.velocity.x / vlen, z: mover.velocity.z / vlen });
        }
      }
    }

    const speed = world.speed ?? 6.4;
    const lookahead = Math.max(1.5, Math.min(3.0, speed * (profile.reactionInterval ?? 0.3)));
    const r = world.radius ?? 0.55;

    let best = null;
    for (const dir of candidates) {
      if (wouldCollide(self, world, dir)) continue;
      const px = self.x + dir.x * lookahead;
      const pz = self.z + dir.z * lookahead;
      const res = world.map.resolve(px, pz, r);
      if (res.fell) continue;

      const clearance = threatClearance(px, pz, decision);
      let edgePen = 0;
      if (world.map.steerToSafety) {
        const e = world.map.steerToSafety(px, pz);
        edgePen = Math.hypot(e.x, e.z);
      }
      const awayBias = dir.x * away.x + dir.z * away.z;
      const score = clearance - edgePen * 2.0 + awayBias * 0.5;
      if (!best || score > best.score) best = { dir, score };
    }

    return best ? best.dir : away;
  }

  function computeAvoidEdgeDesired(self, world, mover) {
    if (world.map.steerToSafety) {
      const edge = world.map.steerToSafety(self.x, self.z);
      const l = Math.hypot(edge.x, edge.z);
      if (l > 1e-3) return norm(edge.x, edge.z);
    }
    // Fallback: toward nearest safe waypoint
    if (world.map.waypoints?.length) {
      const safeWp = nearestWaypoint(self, world, { preferTags: ['safe'] });
      if (safeWp) {
        return norm(safeWp.x - self.x, safeWp.z - self.z);
      }
    }
    // Last resort: reverse velocity
    return norm(-mover.velocity.x, -mover.velocity.z);
  }

  function computeDesiredForState(state, self, world, decision, mover, profile) {
    switch (state) {
      case BotState.IDLE:
        return { x: 0, z: 0 };
      case BotState.ROAM:
        return computeRoamDesired(self, world, mover, profile, decision);
      case BotState.CHASE:
        if (decision.targetPos) {
          return norm(decision.targetPos.x - self.x, decision.targetPos.z - self.z);
        }
        return computeRoamDesired(self, world, mover, profile, decision);
      case BotState.PASS_BOMB:
        if (decision.targetPos) {
          return norm(decision.targetPos.x - self.x, decision.targetPos.z - self.z);
        }
        return computeRoamDesired(self, world, mover, profile, decision);
      case BotState.FLEE:
        return chooseEscapeDirection(self, world, decision, profile);
      case BotState.AVOID_EDGE:
        return computeAvoidEdgeDesired(self, world, mover);
      case BotState.UNSTUCK:
        return mover.recoveryDir || getRandomFreeDirection(self, world);
      default:
        return { x: 0, z: 0 };
    }
  }

  function detectStuck(self, world, dt) {
    if (!mover.lastPos) {
      mover.lastPos = { x: self.x, z: self.z };
      return;
    }
    const moved = Math.hypot(self.x - mover.lastPos.x, self.z - mover.lastPos.z);
    const speed = world.speed ?? 6.4;
    const expected = speed * dt;
    if (moved < expected * 0.35 && (mover.velocity.x || mover.velocity.z)) {
      mover.stuckTimer += dt;
    } else {
      mover.stuckTimer = Math.max(0, mover.stuckTimer - dt * 2);
    }
  }

  function update(self, world, dt, decision) {
    detectStuck(self, world, dt);

    // Track good movement for stuck-count reset
    if (mover.stuckTimer === 0) {
      mover.goodMovementTimer += dt;
      if (mover.goodMovementTimer >= 2.0) {
        mover.repeatedStuckCount = 0;
        mover.goodMovementTimer = 0;
      }
    } else {
      mover.goodMovementTimer = 0;
    }

    // State transitions — priority order
    if (mover.state === BotState.UNSTUCK) {
      // In recovery, count down
      mover.recoveryTimer -= dt;
      if (mover.recoveryTimer <= 0) {
        // Recovery period ended
        if (mover.repeatedStuckCount >= (profile.hardStuckThreshold ?? 3)) {
          // Hard stuck → teleport to safe waypoint
          const safeWp = nearestWaypoint(self, world, { preferTags: ['safe'] });
          if (safeWp) {
            self.x = safeWp.x;
            self.z = safeWp.z;
          }
          mover.repeatedStuckCount = 0;
          mover.stuckTimer = 0;
        }
        mover.state = decisionToState(decision.mode);
        mover.stuckTimer = 0;
      }
    } else if (mover.stuckTimer >= profile.stuckLimit) {
      // Stuck detected → enter UNSTUCK
      mover.state = BotState.UNSTUCK;
      mover.recoveryTimer = profile.recoveryTime;
      mover.recoveryDir = getRandomFreeDirection(self, world);
      mover.repeatedStuckCount += 1;
      mover.stuckTimer = 0;
    } else {
      // Check edge ahead (preemptive)
      const edgeAhead = checkEdgeAhead(self, world, mover.velocity);
      if (edgeAhead && mover.state !== BotState.UNSTUCK) {
        mover.state = BotState.AVOID_EDGE;
      } else if (mover.idleTimer > 0) {
        mover.state = BotState.IDLE;
      } else {
        mover.state = decisionToState(decision.mode);
      }
    }

    // Countdown idle timer
    if (mover.idleTimer > 0) {
      mover.idleTimer -= dt;
    }

    // Compute desired direction
    let desired = computeDesiredForState(mover.state, self, world, decision, mover, profile);

    // Danger (obstacle/edge repulsion)
    const danger = computeDanger(self, world, profile);
    desired = applyWallGliding(desired, danger);

    // For PASS_BOMB, reduce danger contribution (more committed approach)
    const dangerScale = (mover.state === BotState.PASS_BOMB)
      ? (profile.passBombDangerScale ?? 0.6)
      : 1.0;
    desired.x += danger.x * dangerScale;
    desired.z += danger.z * dangerScale;

    // Collision avoidance
    if (wouldCollide(self, world, desired)) {
      desired = avoidWalls(self, world, desired);
    }

    // Jitter only in ROAM with fallback wander (no waypoints)
    if (mover.state === BotState.ROAM && !world.map.waypoints?.length) {
      desired.x += mover.jx;
      desired.z += mover.jz;
      driftJitter(mover, profile, dt);
    }

    // Steering (smooth velocity interpolation)
    steerBot(desired, dt, profile);

    // Debug population
    if (DEBUG_BOTS) {
      self.debug = {
        state: mover.state,
        mode: decision.mode,
        target: decision.targetPos,
        stuck: mover.stuckTimer >= profile.stuckLimit * 0.6,
        edgeAhead: checkEdgeAhead(self, world, mover.velocity),
        waypoint: mover.currentWaypoint ? { id: mover.currentWaypoint.id, x: mover.currentWaypoint.x, z: mover.currentWaypoint.z } : null,
        repeatedStuckCount: mover.repeatedStuckCount,
        desired: { x: desired.x, z: desired.z },
        actual: { x: mover.velocity.x, z: mover.velocity.z },
      };
    }

    mover.lastPos = { x: self.x, z: self.z };
    return norm(mover.velocity.x, mover.velocity.z);
  }

  return { update, setDebugBots };
}
