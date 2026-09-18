// Block Bomb — die drei Maps.
//
// Jede Map liefert ein einheitliches Interface an den Spielkern (main.js):
//   group        THREE.Group mit der ganzen Welt-Geometrie
//   groundY      Höhe, auf der die Figuren stehen
//   spawns       Liste { x, z } Startpunkte
//   obstacles    Liste { x, z, r } (für Bot-Ausweichen + Kollision)
//   resolve(x,z,r) → { x, z, fell }  Position in gültige Grenzen schieben,
//                    aus Hindernissen drücken; fell=true ⇒ abgestürzt (raus)
//   steerToSafety(x,z) → { x, z }    Richtung weg vom Rand/Abgrund (Bots)
//   conveyor(x,z) → { x, z }         Förderband-Schub (nur Factory), sonst 0
//   update(dt)   bewegliche Teile / blinkende Lichter animieren
//
// Es gibt drei Maps pro Modus (Projekt-Konvention für ALLE Minigames).

'use strict';

import * as THREE from '../vendor/three.module.js';
import { PALETTE } from '../game/theme.js';

// mood pro Map (s. game/theme.js) — abgeleitet aus den bisherigen Hex-
// Literalen jeder Map (Arena=Cyan-Rand, Sky=violette Rahmen/kühles Void-
// Gefühl mit weiterem Nebel, Factory=warmes Industrie-Licht/enger Nebel wie
// in einer Halle) statt sie hart im Spielkern zu wiederholen.
const MOODS = {
  arena: { accent: PALETTE.cyan },
  sky: {
    bg: 0x0a0c1c, fogNear: 22, fogFar: 64,
    ambientColor: 0x7078a8, ambientIntensity: 0.72,
    accent: PALETTE.purple, rimIntensity: 0.5,
  },
  factory: {
    bg: 0x14121c, fogNear: 16, fogFar: 38,
    ambientColor: 0x9a7f5c, ambientIntensity: 0.8,
    keyColor: 0xffe3b0, keyIntensity: 1.05,
    accent: PALETTE.orange, rimIntensity: 0.35,
  },
};

export const BOMB_MAPS = [
  { id: 'arena',   name: 'Bomb Arena',    desc: 'Runde Arena mit leuchtendem Rand und Säulen zum Ausweichen.' },
  { id: 'sky',     name: 'Sky Platforms', desc: 'Schwebende Plattformen über dem Abgrund — Vorsicht am Rand!' },
  { id: 'factory', name: 'Factory Panic', desc: 'Fabrik mit Förderbändern, Kisten und blinkenden Warnlichtern.' },
];

// gemeinsame Helfer ---------------------------------------------------------
function pushOutOfObstacles(x, z, r, obstacles) {
  for (const o of obstacles) {
    const dx = x - o.x, dz = z - o.z;
    const d = Math.hypot(dx, dz);
    const min = o.r + r;
    if (d < min && d > 1e-4) {
      x = o.x + (dx / d) * min;
      z = o.z + (dz / d) * min;
    } else if (d <= 1e-4) {
      x = o.x + min; // exakt im Zentrum → seitlich rausschieben
    }
  }
  return { x, z };
}

function tileFloor(group, w, d, tile, mat, y) {
  // Floor aus leicht variierenden Boxen (blockiger, hochwertiger Look).
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

export function buildMap(id, reducedFx = false) {
  switch (id) {
    case 'sky':     return buildSky(reducedFx);
    case 'factory': return buildFactory(reducedFx);
    case 'arena':
    default:        return buildArena(reducedFx);
  }
}

// ── Map 1: Bomb Arena ──────────────────────────────────────────────────
function buildArena(reducedFx) {
  const group = new THREE.Group();
  const R = 13, groundY = 0.5;

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a2d44, roughness: 0.8 });
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.5, 64), floorMat);
  floor.position.y = 0.25; floor.receiveShadow = true;
  group.add(floor);

  // leuchtender Rand
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(R, 0.35, 12, 80),
    new THREE.MeshStandardMaterial({ color: 0x36d6e7, emissive: 0x36d6e7, emissiveIntensity: 1.1 }),
  );
  rim.rotation.x = Math.PI / 2; rim.position.y = groundY;
  group.add(rim);

  // Säulen
  const obstacles = [];
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x3a3f5c, roughness: 0.6, metalness: 0.2 });
  const pillarPos = [
    { x: -5, z: -4 }, { x: 5, z: -4 }, { x: -5, z: 4 }, { x: 5, z: 4 }, { x: 0, z: 7 },
  ];
  for (const p of pillarPos) {
    const h = 2.4;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, h, 18), pillarMat);
    m.position.set(p.x, groundY + h / 2, p.z); m.castShadow = true; m.receiveShadow = true;
    group.add(m);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.2, 18),
      new THREE.MeshStandardMaterial({ color: 0xff944d, emissive: 0xff944d, emissiveIntensity: 0.5 }));
    cap.position.set(p.x, groundY + h, p.z); group.add(cap);
    obstacles.push({ x: p.x, z: p.z, r: 1.0 });
  }

  const spawns = ringSpawns(6.5);

  const waypoints = [
    { id: 'center', x: 0,    z: 0,    tags: ['center','safe'] },
    { id: 'n',      x: 0,    z: -9.5, tags: ['safe'] },
    { id: 's',      x: 0,    z: 9.7,  tags: ['safe'] },
    { id: 'e',      x: 9.5,  z: 0,    tags: ['safe'] },
    { id: 'w',      x: -9.5, z: 0,    tags: ['safe'] },
    { id: 'ne',     x: 6.5,  z: -6.5, tags: ['safe'] },
    { id: 'nw',     x: -6.5, z: -6.5, tags: ['safe'] },
    { id: 'se',     x: 6.5,  z: 6.5,  tags: ['safe'] },
    { id: 'sw',     x: -6.5, z: 6.5,  tags: ['safe'] },
  ];

  return {
    group, groundY, spawns, obstacles, waypoints, mood: MOODS.arena,
    resolve(x, z, r) {
      const p = pushOutOfObstacles(x, z, r, obstacles);
      const d = Math.hypot(p.x, p.z);
      const max = R - r - 0.3;
      if (d > max) { p.x = (p.x / d) * max; p.z = (p.z / d) * max; }
      return { x: p.x, z: p.z, fell: false };
    },
    steerToSafety(x, z) {
      const d = Math.hypot(x, z);
      if (d > R * 0.8) return { x: -x / d, z: -z / d };
      return { x: 0, z: 0 };
    },
    conveyor() { return { x: 0, z: 0 }; },
    update() {},
  };
}

// ── Map 2: Sky Platforms ───────────────────────────────────────────────
function buildSky(reducedFx) {
  const group = new THREE.Group();
  const groundY = 0.5;
  // Plattformen + Brücken als Rechtecke { x, z, w, d }.
  const plates = [
    { x: 0, z: 0, w: 10, d: 10 },
    { x: -11, z: -8, w: 7, d: 7 },
    { x: 11, z: -8, w: 7, d: 7 },
    { x: -11, z: 8, w: 7, d: 7 },
    { x: 11, z: 8, w: 7, d: 7 },
    // Brücken
    { x: -6.5, z: -4, w: 5, d: 2.4 },
    { x: 6.5, z: -4, w: 5, d: 2.4 },
    { x: -6.5, z: 4, w: 5, d: 2.4 },
    { x: 6.5, z: 4, w: 5, d: 2.4 },
    // Bonus-Plattform, nur per Sprung erreichbar (s. jumpLanes unten) —
    // taktischer Rückzugsort, kein Pflichtweg.
    { x: 11, z: -16, w: 4, d: 4, jumpBonus: true },
  ];
  // Sprunglücke: Korridor zwischen dem NE-Eckfeld und der Bonus-Plattform,
  // in dem `fell` unterdrückt wird, SOLANGE die Figur gerade in der Luft ist
  // (s. main.js: airborne = jumpY > JUMP_AIRBORNE_Y). Breite ≈ die reale
  // maximale Sprungweite (SPEED·Flugzeit ≈ 6.4·0.45 ≈ 2.9 Einheiten) —
  // knapp genug, dass ein gut getimter Sprung nötig ist, kein Dauerfliegen.
  const jumpLanes = [
    { x: 11, z: -12.75, w: 4.4, d: 3.2 },
  ];
  function inJumpLane(x, z) {
    return jumpLanes.some((l) =>
      Math.abs(x - l.x) <= l.w / 2 && Math.abs(z - l.z) <= l.d / 2);
  }
  const matA = new THREE.MeshStandardMaterial({ color: 0x3b3f6e, roughness: 0.7 });
  const matSide = new THREE.MeshStandardMaterial({ color: 0x24264a, roughness: 0.85 });
  const matEdge = new THREE.MeshStandardMaterial({ color: 0xb06dff, emissive: 0xb06dff, emissiveIntensity: 0.9 });
  const matBonusEdge = new THREE.MeshStandardMaterial({ color: 0xffc93c, emissive: 0xffc93c, emissiveIntensity: 0.9 });
  for (const p of plates) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(p.w, 0.6, p.d),
      [matSide, matSide, matA, matSide, matSide, matSide]); // nur Oberseite hell
    m.position.set(p.x, 0.2, p.z); m.receiveShadow = true; group.add(m);
    addRimFrame(group, p, p.jumpBonus ? matBonusEdge : matEdge, 0.52); // Rahmen — Bonus-Plattform gelb statt violett
  }
  // Sprung-Markierung: zwei schwebende Pfeile im Korridor (rein optisch;
  // bei reducedFx keine Pulsanimation, nur statisch).
  const laneMarkers = [];
  if (!reducedFx) {
    const markMat = new THREE.MeshStandardMaterial({ color: 0xffc93c, emissive: 0xffc93c, emissiveIntensity: 1 });
    for (const dz of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 4), markMat);
      m.rotation.x = -Math.PI / 2; m.rotation.z = Math.PI / 4;
      m.position.set(11, 1.1, -12.75 + dz * 1.1);
      group.add(m);
      laneMarkers.push(m);
    }
  }

  const margin = 0.5; // wie weit man über die Kante darf, bevor man fällt
  const onPlate = (x, z) => plates.some(p =>
    Math.abs(x - p.x) <= p.w / 2 + margin && Math.abs(z - p.z) <= p.d / 2 + margin);

  function nearestPlateDir(x, z) {
    let best = null, bestD = Infinity;
    for (const p of plates) {
      const dx = p.x - x, dz = p.z - z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = p; }
    }
    if (!best) return { x: 0, z: 0 };
    const dx = best.x - x, dz = best.z - z;
    const l = Math.hypot(dx, dz) || 1;
    return { x: dx / l, z: dz / l };
  }

  function clearanceOnPlate(x, z, p) {
    const halfW = p.w / 2 + margin, halfD = p.d / 2 + margin;
    const lx = x - p.x, lz = z - p.z;
    if (Math.abs(lx) > halfW || Math.abs(lz) > halfD) return null;
    return { clearance: Math.min(halfW - Math.abs(lx), halfD - Math.abs(lz)), lx, lz, halfW, halfD };
  }

  const spawns = [
    { x: -2.5, z: -2.5 }, { x: 2.5, z: -2.5 }, { x: -2.5, z: 2.5 }, { x: 2.5, z: 2.5 },
  ];

  const waypoints = [
    { id: 'center',    x: 0,    z: 0,  tags: ['center','safe'] },
    { id: 'nw-plate',  x: -11,  z: -8, tags: ['safe','corner'] },
    { id: 'ne-plate',  x: 11,   z: -8, tags: ['safe','corner'] },
    { id: 'sw-plate',  x: -11,  z: 8,  tags: ['safe','corner'] },
    { id: 'se-plate',  x: 11,   z: 8,  tags: ['safe','corner'] },
    { id: 'bridge-nw', x: -6.5, z: -4, tags: ['bridge'] },
    { id: 'bridge-ne', x: 6.5,  z: -4, tags: ['bridge'] },
    { id: 'bridge-sw', x: -6.5, z: 4,  tags: ['bridge'] },
    { id: 'bridge-se', x: 6.5,  z: 4,  tags: ['bridge'] },
  ];

  let t = 0;
  return {
    group, groundY, spawns, obstacles: [], waypoints, mood: MOODS.sky,
    resolve(x, z, r, airborne) {
      // Kein Wegschieben — wer die Plattform verlässt, stürzt (fell=true),
      // AUSSER sie ist gerade in der Luft UND im Sprung-Korridor unterwegs
      // (s. jumpLanes oben) — das ist der einzige Weg zur Bonus-Plattform.
      const grounded = onPlate(x, z);
      const safe = grounded || (airborne && inJumpLane(x, z));
      return { x, z, fell: !safe };
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
      const t2 = (threshold - best.clearance) / threshold;
      let sx = 0, sz = 0;
      if (best.halfW - Math.abs(best.lx) < threshold) sx = -Math.sign(best.lx) * t2;
      if (best.halfD - Math.abs(best.lz) < threshold) sz = -Math.sign(best.lz) * t2;
      return { x: sx, z: sz };
    },
    conveyor() { return { x: 0, z: 0 }; },
    update(dt) {
      if (reducedFx) return;
      t += dt;
      for (let i = 0; i < laneMarkers.length; i++) {
        laneMarkers[i].position.y = 1.1 + Math.sin(t * 3 + i) * 0.12;
      }
    },
  };
}

// ── Map 3: Factory Panic ───────────────────────────────────────────────
function buildFactory(reducedFx) {
  const group = new THREE.Group();
  const HW = 12, HD = 9, groundY = 0.5; // halbe Breite/Tiefe

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x2c2f3e, roughness: 0.85 });
  tileFloor(group, HW * 2, HD * 2, 3, floorMat, groundY);

  // Wände/Rand
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x474b63, roughness: 0.6, metalness: 0.3 });
  const walls = [
    { x: 0, z: -HD, w: HW * 2, d: 0.6 }, { x: 0, z: HD, w: HW * 2, d: 0.6 },
    { x: -HW, z: 0, w: 0.6, d: HD * 2 }, { x: HW, z: 0, w: 0.6, d: HD * 2 },
  ];
  for (const w of walls) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w.w, 1.4, w.d), wallMat);
    m.position.set(w.x, groundY + 0.7, w.z); m.castShadow = true; group.add(m);
  }

  // Förderbänder (Zonen, die schieben). dir in Weltkoordinaten.
  const belts = [
    { x: 0, z: -4.5, w: 16, d: 3, dir: { x: 1, z: 0 }, speed: 2.6 },
    { x: 0, z: 4.5, w: 16, d: 3, dir: { x: -1, z: 0 }, speed: 2.6 },
  ];
  buildBeltMeshes(group, belts, groundY);

  // Kisten als Hindernisse
  const obstacles = [];
  const crateMat = new THREE.MeshStandardMaterial({ color: 0xb07a3a, roughness: 0.7 });
  const crateTop = new THREE.MeshStandardMaterial({ color: 0xc98c47, roughness: 0.7 });
  const cratePos = [{ x: -6, z: 0 }, { x: 6, z: 0 }, { x: 0, z: 0 }, { x: -3, z: -1.5 }, { x: 3, z: 1.5 }];
  for (const c of cratePos) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), [crateMat, crateMat, crateTop, crateMat, crateMat, crateMat]);
    m.position.set(c.x, groundY + 0.8, c.z); m.castShadow = true; m.receiveShadow = true; group.add(m);
    obstacles.push({ x: c.x, z: c.z, r: 1.1 });
  }

  // Sprungmarkierungen über den Förderbändern: rein optisch (keine eigene
  // Kollision), zeigen an, wo ein Sprung über das Band lohnt — während der
  // Luftzeit setzt conveyor() unten den Bandschub aus, man wird also nicht
  // seitlich weggeschoben. Bei reducedFx nur statische Markierungen ohne
  // Puls (kein neues bewegtes Element).
  const beltJumpMarks = [];
  const jumpMarkMat = new THREE.MeshStandardMaterial({ color: 0xffc93c, emissive: 0xffc93c, emissiveIntensity: 0.8 });
  for (const b of belts) {
    for (const dx of [-4, 4]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.12, 6), jumpMarkMat);
      m.position.set(b.x + dx, groundY + 0.08, b.z);
      group.add(m);
      beltJumpMarks.push(m);
    }
  }

  // Blinkende Warnlichter
  const lights = [];
  for (const lx of [-HW + 1, HW - 1]) {
    for (const lz of [-HD + 1, HD - 1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff3b30, emissiveIntensity: 0.4 }));
      m.position.set(lx, groundY + 1.7, lz); group.add(m);
      lights.push(m);
    }
  }

  const spawns = [
    { x: -7, z: -2 }, { x: 7, z: -2 }, { x: -7, z: 2 }, { x: 7, z: 2 },
  ];

  const waypoints = [
    { id: 'center',     x: 0,  z: -3, tags: ['center','safe'] },
    { id: 'n-mid',      x: 0,  z: -6, tags: ['safe'] },
    { id: 's-mid',      x: 0,  z: 6,  tags: ['safe'] },
    { id: 'w-mid',      x: -9, z: 0,  tags: ['safe'] },
    { id: 'e-mid',      x: 9,  z: 0,  tags: ['safe'] },
    { id: 'nw-corner',  x: -9, z: -6, tags: ['safe','corner'] },
    { id: 'ne-corner',  x: 9,  z: -6, tags: ['safe','corner'] },
    { id: 'sw-corner',  x: -9, z: 6,  tags: ['safe','corner'] },
    { id: 'se-corner',  x: 9,  z: 6,  tags: ['safe','corner'] },
  ];

  let t = 0;
  return {
    group, groundY, spawns, obstacles, waypoints, mood: MOODS.factory,
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
    conveyor(x, z, airborne) {
      // Wer gerade springt, berührt das Band nicht — kein Schub (s.
      // beltJumpMarks oben: das ist der Sinn der Sprungmarkierungen).
      if (airborne) return { x: 0, z: 0 };
      for (const b of belts) {
        if (Math.abs(x - b.x) <= b.w / 2 && Math.abs(z - b.z) <= b.d / 2) {
          return { x: b.dir.x * b.speed, z: b.dir.z * b.speed };
        }
      }
      return { x: 0, z: 0 };
    },
    update(dt) {
      t += dt;
      const on = (Math.sin(t * 6) > 0);
      for (const l of lights) l.material.emissiveIntensity = on ? 1.4 : 0.3;
      if (!reducedFx) {
        for (let i = 0; i < beltJumpMarks.length; i++) {
          beltJumpMarks[i].material.emissiveIntensity = 0.6 + Math.sin(t * 4 + i) * 0.3;
        }
      }
    },
  };
}

// Förderband-Geometrie: Basisband + statische Richtungs-Streifen. Der Schub
// auf die Figuren passiert in conveyor(); die Streifen sind reine Optik.
function buildBeltMeshes(group, belts, groundY) {
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x1d2030, roughness: 0.9, metalness: 0.3 });
  for (const b of belts) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, 0.12, b.d), baseMat);
    m.position.set(b.x, groundY + 0.02, b.z); m.receiveShadow = true; group.add(m);
    // Richtungs-Streifen
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffc93c, emissive: 0xffc93c, emissiveIntensity: 0.4 });
    for (let i = -b.w / 2 + 1; i < b.w / 2; i += 2) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.14, b.d * 0.8), stripeMat);
      s.position.set(b.x + i, groundY + 0.05, b.z); group.add(s);
    }
  }
}

// Leuchtender Rahmen entlang der vier Plattformkanten (statt Vollabdeckung).
function addRimFrame(group, p, mat, y) {
  const t = 0.3; // Rahmenstärke
  const bars = [
    { w: p.w + t, d: t,       x: p.x,            z: p.z - p.d / 2 },
    { w: p.w + t, d: t,       x: p.x,            z: p.z + p.d / 2 },
    { w: t,       d: p.d + t, x: p.x - p.w / 2,  z: p.z },
    { w: t,       d: p.d + t, x: p.x + p.w / 2,  z: p.z },
  ];
  for (const b of bars) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, 0.16, b.d), mat);
    m.position.set(b.x, y, b.z);
    group.add(m);
  }
}

// ── gemeinsame Spawn-Helfer ────────────────────────────────────────────
function ringSpawns(radius) {
  const out = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    out.push({ x: Math.cos(a) * radius, z: Math.sin(a) * radius });
  }
  return out;
}
