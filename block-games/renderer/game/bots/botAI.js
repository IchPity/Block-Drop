// Wiederverwendbare, generische Bot-KI für Party-Spiele.
//
// Eigentümer dieses Moduls: Zustandsmaschine (CHASE/FLEE/WANDER/STUCK_RECOVERY),
// Anti-Stuck-Erkennung, Wand-/Ecken-Vermeidung, Steering (weiche Richtungslernp),
// Jitter (nur in WANDER). Per-Spiel-Adapter (z.B. bots.js) entscheidet WAS der Bot
// tun soll (chase/flee/wander + Ziel); dieses Modul entscheidet WIE er es sicher tut.

'use strict';

export const BotState = Object.freeze({
  CHASE: 'chase',
  FLEE: 'flee',
  WANDER: 'wander',
  STUCK_RECOVERY: 'stuck_recovery',
});

export const DEBUG_BOTS = false;

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
    state: BotState.WANDER,
    velocity: { x: 0, z: 0 },
    lastPos: null,
    stuckTimer: 0,
    recoveryTimer: 0,
    recoveryDir: null,
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

  function updateWander(dt) {
    mover.wanderTimer -= dt;
    if (mover.wanderTimer <= 0) {
      mover.wanderTimer = 0.6 + Math.random() * 0.8;
      const angle = Math.atan2(mover.wanderDir.z, mover.wanderDir.x) + (Math.random() * 2 - 1) * 1.2;
      mover.wanderDir = { x: Math.cos(angle), z: Math.sin(angle) };
    }
    return { x: mover.wanderDir.x, z: mover.wanderDir.z };
  }

  function driftJitter(dt) {
    mover.jx += (Math.random() * 2 - 1) * profile.wanderJitterDrift * 0.1;
    mover.jz += (Math.random() * 2 - 1) * profile.wanderJitterDrift * 0.1;
    const a = profile.wanderJitterAmp;
    mover.jx = Math.max(-a, Math.min(a, mover.jx));
    mover.jz = Math.max(-a, Math.min(a, mover.jz));
  }

  function steerBot(desired, dt) {
    const dn = norm(desired.x, desired.z);
    const t = Math.min(1, profile.turnSpeed * dt);
    mover.velocity.x += (dn.x - mover.velocity.x) * t;
    mover.velocity.z += (dn.z - mover.velocity.z) * t;
  }

  function decisionToState(mode) {
    switch (mode) {
      case 'chase': return BotState.CHASE;
      case 'flee': return BotState.FLEE;
      default: return BotState.WANDER;
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

    if (mover.state === BotState.STUCK_RECOVERY) {
      mover.recoveryTimer -= dt;
      if (mover.recoveryTimer <= 0) {
        mover.state = decisionToState(decision.mode);
        mover.stuckTimer = 0;
      }
    } else if (mover.stuckTimer >= profile.stuckLimit) {
      mover.state = BotState.STUCK_RECOVERY;
      mover.recoveryTimer = profile.recoveryTime;
      mover.recoveryDir = getRandomFreeDirection(self, world);
      mover.stuckTimer = 0;
    } else {
      mover.state = decisionToState(decision.mode);
    }

    let desired = { x: 0, z: 0 };
    if (mover.state === BotState.STUCK_RECOVERY) {
      desired = mover.recoveryDir || getRandomFreeDirection(self, world);
    } else if (mover.state === BotState.CHASE && decision.targetPos) {
      const t = decision.targetPos;
      desired = norm(t.x - self.x, t.z - self.z);
    } else if (mover.state === BotState.FLEE && decision.targetPos) {
      const t = decision.targetPos;
      desired = norm(self.x - t.x, self.z - t.z);
    } else { // WANDER
      desired = updateWander(dt);
    }

    const danger = computeDanger(self, world, profile);
    desired = applyWallGliding(desired, danger);
    desired.x += danger.x;
    desired.z += danger.z;

    if (wouldCollide(self, world, desired)) {
      desired = avoidWalls(self, world, desired);
    }

    if (mover.state === BotState.WANDER) {
      desired.x += mover.jx;
      desired.z += mover.jz;
      driftJitter(dt);
    }

    steerBot(desired, dt);

    if (DEBUG_BOTS) {
      self.debug = {
        state: mover.state,
        mode: decision.mode,
        target: decision.targetPos,
        stuck: mover.stuckTimer >= profile.stuckLimit * 0.6,
        desired: { x: desired.x, z: desired.z },
        actual: { x: mover.velocity.x, z: mover.velocity.z },
      };
    }

    mover.lastPos = { x: self.x, z: self.z };
    return norm(mover.velocity.x, mover.velocity.z);
  }

  return { update };
}
