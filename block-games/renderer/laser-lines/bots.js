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
import { safestWaypoint } from '../game/bots/waypoints.js';

// Neue Felder ggü. der alten Tabelle:
//   escapeSamples   — wie viele Richtungen die Sampling-Flucht probt
//                     (3 = grob/leicht, 8 = voll, >8 = + aktuelle Laufrichtung)
//   seekSafe        — im ROAM proaktiv die laserfreieste Zone ansteuern
//   warnAnticipation— wie weit ein Laser in der WARN-Phase (noch ungefährlich)
//                     den effektiven Fluchtradius vergrößert → frühes Ausweichen
// jumpChance: wie zuverlässig der Bot springt statt seitlich auszuweichen,
// wenn eine überspringbare Speiche (Spin Arena) schon aktiv UND zu nah ist,
// um noch rechtzeitig seitlich weglaufen zu können (s. JUMP_TRIGGER_DIST).
const PROFILES = {
  easy: {
    reactionInterval: 0.50, ignoreChance: 0.28, fleeRadius: 4.5,
    turnSpeed: 3.4, avoidStrength: 0.6, edgeStrength: 1.0,
    stuckLimit: 0.45, recoveryTime: 0.8, hardStuckThreshold: 4,
    wanderJitterAmp: 0.50, wanderJitterDrift: 2.6, waypointRandomness: 0.5,
    passBombDangerScale: 0.6,
    escapeSamples: 3, seekSafe: false, warnAnticipation: 0,
    jumpChance: 0.15,
  },
  medium: {
    reactionInterval: 0.28, ignoreChance: 0.08, fleeRadius: 5.5,
    turnSpeed: 5.5, avoidStrength: 0.9, edgeStrength: 1.2,
    stuckLimit: 0.35, recoveryTime: 0.6, hardStuckThreshold: 3,
    wanderJitterAmp: 0.40, wanderJitterDrift: 2.0, waypointRandomness: 0.3,
    passBombDangerScale: 0.6,
    escapeSamples: 8, seekSafe: true, warnAnticipation: 0.8,
    jumpChance: 0.55,
  },
  hard: {
    reactionInterval: 0.13, ignoreChance: 0.0, fleeRadius: 6.8,
    turnSpeed: 9, avoidStrength: 1.2, edgeStrength: 1.6,
    stuckLimit: 0.25, recoveryTime: 0.6, hardStuckThreshold: 3,
    wanderJitterAmp: 0.18, wanderJitterDrift: 1.4, waypointRandomness: 0.1,
    passBombDangerScale: 0.6,
    escapeSamples: 9, seekSafe: true, warnAnticipation: 2.0,
    jumpChance: 0.9,
  },
};
PROFILES.normal = PROFILES.medium;

// Ab welcher Entfernung zu einer bereits AKTIVEN Speiche ein seitliches
// Ausweichen als "zu spät" gilt und ein Sprung sinnvoller ist — grob die
// Trefferzone (halfWidth+Spielerradius ≈ 1.1) plus etwas Reaktionsspielraum.
const JUMP_TRIGGER_DIST = 1.8;

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
    safeWp: null,
    wantsJump: false,
  };

  function think(self, world, dt) {
    // Gefahr jeden Frame frisch lesen (Laser bewegen sich), Entscheidung zum
    // FLIEHEN aber nur im Reaktions-Intervall neu fällen (Reaktionszeit).
    const danger = world.laserDanger ? world.laserDanger(self.x, self.z) : null;
    // Nur die Spin Arena hat überspringbare (persistente) Speichen — s.
    // LASER_CLEAR_Y/jumpable in lasers.js. Andere Maps: Bots springen nie.
    const jumpableMap = world.map?.laserConfig?.kind === 'spin';

    state.react -= dt;
    if (state.react <= 0) {
      state.react = ep.reactionInterval;
      state.ignore = Math.random() < ep.ignoreChance;
      // Warnphasen-Laser (noch nicht active) früher meiden: nur starke Bots
      // vergrößern dafür ihren effektiven Fluchtradius (warnAnticipation).
      let effRadius = ep.fleeRadius;
      if (danger && !danger.active) effRadius += ep.warnAnticipation || 0;
      state.threatened = !!(danger && danger.dist < effRadius);
      // Safe-Zone-Ziel nur neu bestimmen, wenn gerade keine akute Gefahr droht.
      state.safeWp = (ep.seekSafe && !state.threatened && world.laserDanger)
        ? safestWaypoint(self, world, world.laserDanger)
        : null;
      // Springen statt/zusätzlich zu seitlichem Ausweichen: nur wenn die
      // Speiche schon AKTIV und so nah ist, dass ein Sidestep zu spät käme
      // (s. JUMP_TRIGGER_DIST) — sonst weicht der Bot lieber ganz normal aus.
      state.wantsJump = !!(danger && danger.active && danger.dist < JUMP_TRIGGER_DIST
        && jumpableMap && Math.random() < ep.jumpChance);
    }

    let mode = 'roam';
    let targetPos = null;
    let preferredWaypoint = null;
    if (state.threatened && !state.ignore && danger) {
      mode = 'flee';
      targetPos = danger.point; // wegfliehen vom nächsten Punkt des Lasers
    } else if (state.safeWp) {
      preferredWaypoint = state.safeWp; // proaktiv in die laserfreieste Zone
    }

    // dangerFn liefert der Sampling-Flucht in botAI.js bei JEDER geprobten
    // Richtung den vollen Laser-Scan vom jeweiligen Probe-Punkt — dadurch weicht
    // der Bot seitlich aus, statt blind in einen zweiten Laser zu laufen.
    // (targetPos liefert nur den Weg-Vektor; threatPoints bräuchte es hier nicht,
    // da dangerFn schon alle Laser abdeckt.)
    const decision = {
      mode,
      targetPos,
      dangerFn: world.laserDanger || null,
      preferredWaypoint,
    };
    const intent = mover.update(self, world, dt, decision);
    // jump ist ein Tastendruck-Zähler (s. game/controllers.js) — hier reicht
    // ein einzelner "Druck" pro Sprungwunsch, main.js ignoriert weitere
    // Signale ohnehin, solange der Bot schon in der Luft ist.
    if (state.wantsJump) intent.jump = 1;
    return intent;
  }

  return { think };
}
