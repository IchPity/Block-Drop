// Laser Lines — die drei Maps.
//
// Jede Map liefert dasselbe Interface wie die Block-Bomb-Maps an den Spielkern
// (main.js) — plus eine laserConfig für den LaserDirector (lasers.js):
//   group        THREE.Group mit der Welt-Geometrie
//   groundY      Höhe, auf der die Figuren stehen
//   spawns       Liste { x, z } Startpunkte
//   obstacles    Liste { x, z, r } (Bot-Ausweichen + Kollision)
//   waypoints    Liste { id, x, z, tags } (Bot-Navigation via botAI.js)
//   resolve(x,z,r) → { x, z, fell }   Position begrenzen / aus Hindernissen
//                    drücken; fell=true ⇒ von der Plattform gefallen
//   steerToSafety(x,z) → { x, z }     Richtung weg vom Rand/Abgrund (Bots)
//   respawn(x,z) → { x, z }           sicherer Punkt nach Sturz (Sky Warning)
//   update(dt)   Ambient-Animation
//   laserConfig  Pattern-Parameter für den LaserDirector
//
// Drei Maps pro Modus (Projekt-Konvention für ALLE Minigames).

'use strict';

import * as THREE from '../vendor/three.module.js';

export const LASER_MAP_META = [
  { id: 'spin', name: 'Spin Arena',   desc: 'Runde Arena — rotierende Laser werden immer schneller. Gute Einsteiger-Map.' },
  { id: 'grid', name: 'Factory Grid', desc: 'Fabrikhalle — Laser fahren nach kurzer Warnlinie quer durch. Kisten als Deckung.' },
  { id: 'sky',  name: 'Sky Warning',  desc: 'Schwebende Plattformen — Warnfelder, dann Laser. Nicht abstürzen!' },
];

// ── gemeinsame Helfer ──────────────────────────────────────────────────────
function pushOutOfObstacles(x, z, r, obstacles) {
  for (const o of obstacles) {
    const dx = x - o.x, dz = z - o.z;
    const d = Math.hypot(dx, dz);
    const min = o.r + r;
    if (d < min && d > 1e-4) {
      x = o.x + (dx / d) * min;
      z = o.z + (dz / d) * min;
    } else if (d <= 1e-4) {
      x = o.x + min;
    }
  }
  return { x, z };
}

function tileFloor(group, w, d, tile, mat, y) {
  const geo = new THREE.BoxGeometry(tile * 0.98, 0.5, tile * 0.98);
  for (let ix = -Math.floor(w / 2 / tile); ix <= Math.floor(w / 2 / tile); ix++) {
    for (let iz = -Math.floor(d / 2 / tile); iz <= Math.floor(d / 2 / tile); iz++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(ix * tile, y - 0.25 - (((ix + iz) & 1) ? 0.02 : 0), iz * tile);
      m.receiveShadow = true;
      group.add(m);
    }
  }
}

function addRimFrame(group, p, mat, y) {
  const t = 0.3;
  const bars = [
    { w: p.w + t, d: t,       x: p.x,           z: p.z - p.d / 2 },
    { w: p.w + t, d: t,       x: p.x,           z: p.z + p.d / 2 },
    { w: t,       d: p.d + t, x: p.x - p.w / 2, z: p.z },
    { w: t,       d: p.d + t, x: p.x + p.w / 2, z: p.z },
  ];
  for (const b of bars) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, 0.16, b.d), mat);
    m.position.set(b.x, y, b.z);
    group.add(m);
  }
}

function ringSpawns(radius) {
  const out = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    out.push({ x: Math.cos(a) * radius, z: Math.sin(a) * radius });
  }
  return out;
}

export function buildMap(id, reducedFx = false) {
  switch (id) {
    case 'grid': return buildGrid(reducedFx);
    case 'sky':  return buildSky(reducedFx);
    case 'spin':
    default:     return buildSpin(reducedFx);
  }
}

// ── Map 1: Spin Arena ───────────────────────────────────────────────────────
function buildSpin() {
  const group = new THREE.Group();
  const R = 13, groundY = 0.5;

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x241f33, roughness: 0.8 });
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.5, 64), floorMat);
  floor.position.y = 0.25; floor.receiveShadow = true;
  group.add(floor);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(R, 0.35, 12, 80),
    new THREE.MeshStandardMaterial({ color: 0xff5bd0, emissive: 0xff5bd0, emissiveIntensity: 1.0 }),
  );
  rim.rotation.x = Math.PI / 2; rim.position.y = groundY;
  group.add(rim);

  // dezenter Mittel-Hub (optischer Ankerpunkt der Rotation)
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 1.0, 0.6, 20),
    new THREE.MeshStandardMaterial({ color: 0x3a2f55, emissive: 0xff2747, emissiveIntensity: 0.25 }),
  );
  hub.position.y = groundY + 0.3; group.add(hub);

  const spawns = ringSpawns(8.5);
  // Sichere Waypoints: Ring im mittleren Radius (Mitte ist gefährlich = Nabe der
  // Speichen), gleichmäßig verteilt.
  const waypoints = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    waypoints.push({ id: 'r' + i, x: Math.cos(a) * 7.5, z: Math.sin(a) * 7.5, tags: ['safe'] });
  }

  return {
    group, groundY, spawns, obstacles: [], waypoints,
    resolve(x, z, r) {
      const d = Math.hypot(x, z);
      const max = R - r - 0.3;
      if (d > max && d > 1e-4) { x = (x / d) * max; z = (z / d) * max; }
      return { x, z, fell: false };
    },
    steerToSafety(x, z) {
      const d = Math.hypot(x, z);
      if (d > R * 0.82) return { x: -x / d, z: -z / d };
      return { x: 0, z: 0 };
    },
    update() {},
    laserConfig: {
      kind: 'spin', radius: R, halfWidth: 0.55, maxBeams: 5,
      beams: (lvl) => 1 + Math.floor((lvl - 1) / 1),
      angularSpeed: (lvl) => 0.55 + lvl * 0.18,
      levelEvery: 9,
    },
  };
}

// ── Map 2: Factory Grid ──────────────────────────────────────────────────────
function buildGrid() {
  const group = new THREE.Group();
  const HW = 12, HD = 9, groundY = 0.5;

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x26293a, roughness: 0.85 });
  tileFloor(group, HW * 2, HD * 2, 3, floorMat, groundY);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x3f4360, roughness: 0.6, metalness: 0.3 });
  const walls = [
    { x: 0, z: -HD, w: HW * 2, d: 0.6 }, { x: 0, z: HD, w: HW * 2, d: 0.6 },
    { x: -HW, z: 0, w: 0.6, d: HD * 2 }, { x: HW, z: 0, w: 0.6, d: HD * 2 },
  ];
  for (const w of walls) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w.w, 1.4, w.d), wallMat);
    m.position.set(w.x, groundY + 0.7, w.z); m.castShadow = true; group.add(m);
  }

  // Kisten als Deckung/Hindernis.
  const obstacles = [];
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x8a6b3a, roughness: 0.7 });
  const crateTop = new THREE.MeshStandardMaterial({ color: 0xa9854a, roughness: 0.7 });
  const cratePos = [{ x: -6, z: -3 }, { x: 6, z: -3 }, { x: -6, z: 3 }, { x: 6, z: 3 }, { x: 0, z: 0 }];
  for (const c of cratePos) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), [crateMat, crateMat, crateTop, crateMat, crateMat, crateMat]);
    m.position.set(c.x, groundY + 0.8, c.z); m.castShadow = true; m.receiveShadow = true; group.add(m);
    obstacles.push({ x: c.x, z: c.z, r: 1.1 });
  }

  const spawns = [
    { x: -9, z: -6 }, { x: 9, z: -6 }, { x: -9, z: 6 }, { x: 9, z: 6 },
  ];

  const waypoints = [
    { id: 'c',  x: 0,  z: 0,  tags: ['center', 'safe'] },
    { id: 'n',  x: 0,  z: -6, tags: ['safe'] },
    { id: 's',  x: 0,  z: 6,  tags: ['safe'] },
    { id: 'w',  x: -9, z: 0,  tags: ['safe'] },
    { id: 'e',  x: 9,  z: 0,  tags: ['safe'] },
    { id: 'nw', x: -9, z: -6, tags: ['safe', 'corner'] },
    { id: 'ne', x: 9,  z: -6, tags: ['safe', 'corner'] },
    { id: 'sw', x: -9, z: 6,  tags: ['safe', 'corner'] },
    { id: 'se', x: 9,  z: 6,  tags: ['safe', 'corner'] },
  ];

  return {
    group, groundY, spawns, obstacles, waypoints,
    resolve(x, z, r) {
      const p = pushOutOfObstacles(x, z, r, obstacles);
      p.x = Math.max(-HW + 0.6 + r, Math.min(HW - 0.6 - r, p.x));
      p.z = Math.max(-HD + 0.6 + r, Math.min(HD - 0.6 - r, p.z));
      return { x: p.x, z: p.z, fell: false };
    },
    steerToSafety(x, z) {
      let sx = 0, sz = 0;
      if (x < -HW + 2) sx = 1; else if (x > HW - 2) sx = -1;
      if (z < -HD + 2) sz = 1; else if (z > HD - 2) sz = -1;
      return { x: sx, z: sz };
    },
    update() {},
    laserConfig: {
      kind: 'lane', hw: HW, hd: HD, margin: 1.6, beamLength: 2 * HW + 3, halfWidth: 0.55,
      active: 0.5, firstDelay: 1.2, levelEvery: 9,
      warn: (lvl) => Math.max(0.62, 1.15 - lvl * 0.08),
      interval: (lvl) => Math.max(0.5, 1.7 - lvl * 0.16),
    },
  };
}

// ── Map 3: Sky Warning ───────────────────────────────────────────────────────
function buildSky() {
  const group = new THREE.Group();
  const groundY = 0.5;
  const plates = [
    { x: 0, z: 0, w: 11, d: 11 },
    { x: -11, z: -8, w: 7, d: 7 },
    { x: 11, z: -8, w: 7, d: 7 },
    { x: -11, z: 8, w: 7, d: 7 },
    { x: 11, z: 8, w: 7, d: 7 },
    { x: -6.5, z: -4, w: 5, d: 2.4 },
    { x: 6.5, z: -4, w: 5, d: 2.4 },
    { x: -6.5, z: 4, w: 5, d: 2.4 },
    { x: 6.5, z: 4, w: 5, d: 2.4 },
  ];
  const matA = new THREE.MeshStandardMaterial({ color: 0x352f55, roughness: 0.7 });
  const matSide = new THREE.MeshStandardMaterial({ color: 0x201d3a, roughness: 0.85 });
  const matEdge = new THREE.MeshStandardMaterial({ color: 0xff5bd0, emissive: 0xff5bd0, emissiveIntensity: 0.8 });
  for (const p of plates) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(p.w, 0.6, p.d),
      [matSide, matSide, matA, matSide, matSide, matSide]);
    m.position.set(p.x, 0.2, p.z); m.receiveShadow = true; group.add(m);
    addRimFrame(group, p, matEdge, 0.52);
  }

  const margin = 0.5;
  const onPlate = (x, z) => plates.some(p =>
    Math.abs(x - p.x) <= p.w / 2 + margin && Math.abs(z - p.z) <= p.d / 2 + margin);

  function clearanceOnPlate(x, z, p) {
    const halfW = p.w / 2 + margin, halfD = p.d / 2 + margin;
    const lx = x - p.x, lz = z - p.z;
    if (Math.abs(lx) > halfW || Math.abs(lz) > halfD) return null;
    return { clearance: Math.min(halfW - Math.abs(lx), halfD - Math.abs(lz)), lx, lz, halfW, halfD };
  }
  function nearestPlateDir(x, z) {
    let best = null, bestD = Infinity;
    for (const p of plates) {
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bestD) { bestD = d; best = p; }
    }
    const dx = best.x - x, dz = best.z - z;
    const l = Math.hypot(dx, dz) || 1;
    return { x: dx / l, z: dz / l };
  }

  const spawns = [
    { x: -2.5, z: -2.5 }, { x: 2.5, z: -2.5 }, { x: -2.5, z: 2.5 }, { x: 2.5, z: 2.5 },
  ];
  const waypoints = [
    { id: 'center',   x: 0,   z: 0,  tags: ['center', 'safe'] },
    { id: 'nw-plate', x: -11, z: -8, tags: ['safe', 'corner'] },
    { id: 'ne-plate', x: 11,  z: -8, tags: ['safe', 'corner'] },
    { id: 'sw-plate', x: -11, z: 8,  tags: ['safe', 'corner'] },
    { id: 'se-plate', x: 11,  z: 8,  tags: ['safe', 'corner'] },
  ];

  // Warnfeld-Zonen liegen auf den großen Plattformen (nicht auf den Brücken).
  const zones = [
    { x: 0, z: 0, w: 5.5, d: 5.5 },
    { x: -11, z: -8, w: 5, d: 5 }, { x: 11, z: -8, w: 5, d: 5 },
    { x: -11, z: 8, w: 5, d: 5 }, { x: 11, z: 8, w: 5, d: 5 },
    { x: 0, z: 0, w: 9, d: 3 },
  ];

  return {
    group, groundY, spawns, obstacles: [], waypoints,
    resolve(x, z) {
      return { x, z, fell: !onPlate(x, z) };
    },
    steerToSafety(x, z) {
      const threshold = 1.4;
      let best = null;
      for (const p of plates) {
        const c = clearanceOnPlate(x, z, p);
        if (c && (!best || c.clearance > best.clearance)) best = c;
      }
      if (!best) return nearestPlateDir(x, z);
      if (best.clearance >= threshold) return { x: 0, z: 0 };
      const t = (threshold - best.clearance) / threshold;
      let sx = 0, sz = 0;
      if (best.halfW - Math.abs(best.lx) < threshold) sx = -Math.sign(best.lx) * t;
      if (best.halfD - Math.abs(best.lz) < threshold) sz = -Math.sign(best.lz) * t;
      return { x: sx, z: sz };
    },
    respawn() { return { x: 0, z: 0 }; }, // Mitte der großen Mittelplattform
    update() {},
    laserConfig: {
      kind: 'zone', zones, active: 0.7, firstDelay: 1.2, levelEvery: 9,
      warn: (lvl) => Math.max(0.7, 1.25 - lvl * 0.08),
      interval: (lvl) => Math.max(0.55, 1.6 - lvl * 0.16),
    },
  };
}
