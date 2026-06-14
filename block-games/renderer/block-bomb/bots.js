// Block Bomb — Bot-KI.
//
// Ein Bot-„Gehirn" entscheidet pro Frame eine Bewegungsrichtung { x, z }.
// Es kennt nur SICHTBARE Informationen (Positionen, wer die Bombe hat, Restzeit)
// — kein Blick in die Zukunft, keine perfekten Reaktionen. Fairness entsteht
// durch drei Mittel: Reaktionsverzögerung (Ziel wird nur in Intervallen neu
// gewählt), weiches Richtungs-Jitter (Random-Walk) und gelegentliche
// Fehlentscheidungen. Geschwindigkeit ist für alle gleich (siehe main.js) —
// Bots unterscheiden sich nur in der Entscheidungsqualität, nie im Tempo.
//
// Zwei Schwierigkeiten (im Projekt gibt es kein „leicht"):
//   medium — träge Reaktion, ungenaues Zielen, läuft menschlich „schlampig"
//   hard   — schnellere Reaktion, gezielter, weicht besser aus; trotzdem fair

'use strict';

const PROFILES = {
  medium: {
    reactionInterval: 0.34,   // s, bis ein neues Ziel/eine neue Richtung gewählt wird
    jitterAmp: 0.40,          // Stärke des Richtungs-Rauschens
    jitterDrift: 2.2,         // wie schnell das Rauschen wandert
    wrongTargetChance: 0.28,  // Chance, NICHT den nächsten Gegner zu jagen
    avoidStrength: 0.9,       // Hindernis-Ausweichen
    edgeStrength: 1.1,        // Rand/Abgrund meiden
    panicAt: 2.5,             // s Restzeit, ab der „Panik" einsetzt
  },
  hard: {
    reactionInterval: 0.13,
    jitterAmp: 0.16,
    jitterDrift: 1.4,
    wrongTargetChance: 0.06,
    avoidStrength: 1.3,
    edgeStrength: 1.6,
    panicAt: 4.0,
  },
};

function norm(x, z) {
  const l = Math.hypot(x, z);
  if (l < 1e-4) return { x: 0, z: 0 };
  return { x: x / l, z: z / l };
}

export function makeBotBrain(difficulty) {
  const p = PROFILES[difficulty] || PROFILES.medium;
  const state = {
    react: Math.random() * p.reactionInterval, // gestaffelter Start
    targetId: null,
    jx: (Math.random() * 2 - 1) * p.jitterAmp,
    jz: (Math.random() * 2 - 1) * p.jitterAmp,
    // letzte gewählte „Wunschrichtung" (wird zwischen Reaktionen gehalten)
    wishX: 0,
    wishZ: 0,
  };

  function pickTarget(self, world) {
    const others = world.players.filter(q => q.alive && q.id !== self.id);
    if (!others.length) return null;
    // nach Distanz sortieren
    others.sort((a, b) =>
      dist2(self, a) - dist2(self, b));
    // medium wählt manchmal bewusst NICHT den nächsten (menschlicher Fehler)
    if (others.length > 1 && Math.random() < p.wrongTargetChance) {
      return others[1].id;
    }
    return others[0].id;
  }

  function think(self, world, dt) {
    const panic = world.timeLeft <= p.panicAt;
    // Reaktions-Takt: nur in Intervallen neu „denken" (in Panik schneller).
    state.react -= dt;
    const interval = panic ? p.reactionInterval * 0.5 : p.reactionInterval;

    if (state.react <= 0) {
      state.react = interval;
      driftJitter();
      if (self.isHolder) {
        // Bombe abgeben: nächsten (meist) Gegner jagen.
        state.targetId = pickTarget(self, world);
      } else {
        state.targetId = world.holderId; // vom Träger weg
      }
      recomputeWish(self, world);
    } else if (self.isHolder && state.targetId == null) {
      state.targetId = pickTarget(self, world);
      recomputeWish(self, world);
    }

    // Wunschrichtung + laufendes Ausweichen/Rand (jeden Frame frisch, damit
    // Hindernisse und Abgründe sofort wirken — nur die ZIELWAHL ist verzögert).
    let dx = state.wishX, dz = state.wishZ;

    // Hindernisse abstoßen
    const avoid = avoidObstacles(self, world);
    dx += avoid.x * p.avoidStrength;
    dz += avoid.z * p.avoidStrength;

    // Rand/Abgrund meiden (Map liefert Richtung zur Sicherheit)
    if (world.map && world.map.steerToSafety) {
      const s = world.map.steerToSafety(self.x, self.z);
      dx += s.x * p.edgeStrength;
      dz += s.z * p.edgeStrength;
    }

    // weiches Rauschen (in Panik gedämpft → entschlossener)
    const jScale = panic ? 0.4 : 1;
    dx += state.jx * jScale;
    dz += state.jz * jScale;

    return norm(dx, dz);
  }

  function recomputeWish(self, world) {
    if (state.targetId == null) { state.wishX = 0; state.wishZ = 0; return; }
    const t = world.players.find(q => q.id === state.targetId);
    if (!t) { state.wishX = 0; state.wishZ = 0; return; }
    if (self.isHolder) {
      // hin zum Ziel
      const d = norm(t.x - self.x, t.z - self.z);
      state.wishX = d.x; state.wishZ = d.z;
    } else {
      // weg vom Träger
      const d = norm(self.x - t.x, self.z - t.z);
      state.wishX = d.x; state.wishZ = d.z;
    }
  }

  function driftJitter() {
    state.jx += (Math.random() * 2 - 1) * p.jitterDrift * 0.1;
    state.jz += (Math.random() * 2 - 1) * p.jitterDrift * 0.1;
    state.jx = clamp(state.jx, -p.jitterAmp, p.jitterAmp);
    state.jz = clamp(state.jz, -p.jitterAmp, p.jitterAmp);
  }

  function avoidObstacles(self, world) {
    let ax = 0, az = 0;
    const list = world.obstacles || [];
    for (const o of list) {
      const dx = self.x - o.x, dz = self.z - o.z;
      const d = Math.hypot(dx, dz);
      const safe = o.r + 1.4;
      if (d < safe && d > 1e-3) {
        const push = (safe - d) / safe; // 0..1, näher = stärker
        ax += (dx / d) * push;
        az += (dz / d) * push;
      }
    }
    return { x: ax, z: az };
  }

  return { think };
}

function dist2(a, b) {
  const dx = a.x - b.x, dz = a.z - b.z;
  return dx * dx + dz * dz;
}
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
