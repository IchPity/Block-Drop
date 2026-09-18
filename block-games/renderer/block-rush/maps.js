// Block Rush — die drei Maps.
//
// Anders als bei Block Bomb/Laser Lines gibt es keine Figuren, die durch den
// Raum laufen — die Map liefert stattdessen Podest-Positionen (alle Türme
// nebeneinander in EINER Szene) und zwei reine Umgebungsfunktionen, die sowohl
// die Optik als auch (über extTorque/tiltTarget) die Kippsimulation in
// tower.js speisen:
//   group              THREE.Group mit der Welt-Geometrie
//   podiumY            Höhe der Podest-Oberfläche (Turm-Pivot sitzt hier)
//   gravityScale       Basis-Fallgeschwindigkeits-Faktor (1 = normal)
//   podiums(n)         → [{x,z}, ...] Podest-Positionen für n Spieler
//   windAt(t, i)       → Seitenwind-Stärke [-1,1] für Podest i zur Zeit t
//   ambientTilt(t, i)  → zusätzliche Kipp-Vorspannung (rad) für Podest i
//   update(dt, t)      Ambient-Animation (t = eigene Rundenzeit des Spielkerns,
//                       damit Optik und Physik exakt dieselbe Kurve sehen)
//   dispose()
//
// Reine Funktionen von (t, i) — der Online-Gast reproduziert die Optik damit
// ohne eigene Simulation. Drei Maps pro Modus (Projekt-Konvention für ALLE
// Minigames).

'use strict';

import * as THREE from '../vendor/three.module.js';
import { COLS, ROWS, CELL } from './pieces.js';

export const BLOCK_RUSH_MAP_META = [
  { id: 'halle', name: 'Ruhige Halle',     desc: 'Klassische Bühne, keine Umgebungsgefahr — gute Einsteiger-Map.' },
  { id: 'sturm', name: 'Sturmklippe',      desc: 'Böen schieben ungeklebte Blöcke zur Seite.' },
  { id: 'wippe', name: 'Wackelplattform',  desc: 'Die Podeste schaukeln ständig — baue mittig!' },
];

const SPACING = 4.6;
const PODIUM_W = 3.4, PODIUM_D = 3.4, PODIUM_H = 0.6;
const PODIUM_Y = PODIUM_H;

function podiumPositions(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ x: (i - (n - 1) / 2) * SPACING, z: 0 });
  return out;
}

// Gemeinsamer Unterbau: Hallenboden + bis zu 4 Podeste mit leuchtendem Rand.
// `accent` färbt Rand/Rasterlinien je Map unterschiedlich.
function buildBase(reducedFx, accent) {
  const group = new THREE.Group();

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x151a2e, roughness: 0.85 });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(SPACING * 4.4, 0.4, 9), floorMat);
  floor.position.y = -0.2;
  floor.receiveShadow = true;
  group.add(floor);

  // Blaupausen-Rasterlinien auf dem Boden (dünne, leicht erhabene Streifen).
  const gridMat = new THREE.MeshStandardMaterial({
    color: accent, emissive: accent, emissiveIntensity: 0.35, roughness: 0.6,
  });
  const gridSpan = SPACING * 4.4;
  for (let x = -gridSpan / 2; x <= gridSpan / 2; x += 1.15) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 9), gridMat);
    line.position.set(x, 0.01, 0);
    group.add(line);
  }

  const podiumMat = new THREE.MeshStandardMaterial({ color: 0x242b4a, roughness: 0.6, metalness: 0.15 });
  const rimMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.9 });

  const podiumGroups = [];
  const positions = podiumPositions(4);
  for (const p of positions) {
    const pg = new THREE.Group();
    pg.position.set(p.x, 0, p.z);
    const top = new THREE.Mesh(new THREE.BoxGeometry(PODIUM_W, PODIUM_H, PODIUM_D), podiumMat);
    top.position.y = PODIUM_H / 2;
    top.receiveShadow = true; top.castShadow = !reducedFx;
    pg.add(top);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(PODIUM_W * 0.62, 0.05, 8, 28), rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = PODIUM_H + 0.02;
    pg.add(rim);

    // Spaltenlinien auf dem Podest — markieren die COLS=6 echten Spielspalten
    // (COLS*CELL=3.0 breit, das Podest selbst ist 3.4 breit) direkt unter dem
    // fallenden Teil, damit klar ist, in welche Spalte man gerade droppt.
    const colSpan = COLS * CELL; // 3.0 — schmaler als das Podest (3.4), passt darauf
    const colLineMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.5 });
    for (let c = 0; c <= COLS; c++) {
      const lx = -colSpan / 2 + c * CELL;
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.015, colSpan), colLineMat);
      line.position.set(lx, PODIUM_H + 0.015, 0);
      pg.add(line);
    }

    // Höhenmarken: vier dünne Eckstäbe bis ROWS*CELL Höhe, mit Ticks alle
    // 4 Reihen — gibt eine sichtbare Referenz, wie hoch der Turm relativ zum
    // Rahmen werden kann (vorher: keinerlei Höhenbezug am Podest selbst).
    const frameH = ROWS * CELL;
    const postMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.22, transparent: true, opacity: 0.55 });
    const tickMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.4 });
    for (const cx of [-colSpan / 2, colSpan / 2]) {
      for (const cz of [-PODIUM_D / 2, PODIUM_D / 2]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, frameH, 6), postMat);
        post.position.set(cx, PODIUM_H + frameH / 2, cz);
        pg.add(post);
      }
    }
    for (let row = 4; row < ROWS; row += 4) {
      const y = PODIUM_H + row * CELL;
      const tick = new THREE.Mesh(new THREE.BoxGeometry(colSpan + 0.12, 0.02, 0.02), tickMat);
      tick.position.set(0, y, -PODIUM_D / 2);
      pg.add(tick);
    }

    group.add(pg);
    podiumGroups.push(pg);
  }

  return { group, podiumGroups, floorMat, gridMat, podiumMat, rimMat };
}

function addLights(group, accent) {
  group.add(new THREE.AmbientLight(0x8a90c0, 0.75));
  const key = new THREE.DirectionalLight(0xffffff, 1.05);
  key.position.set(8, 20, 14);
  group.add(key);
  const rim = new THREE.DirectionalLight(accent, 0.4);
  rim.position.set(-10, 6, -10);
  group.add(rim);
}

// ── Map 1: Ruhige Halle ─────────────────────────────────────────────────
function buildHalle(reducedFx) {
  const accent = 0x36d6e7;
  const { group } = buildBase(reducedFx, accent);
  addLights(group, accent);
  return {
    group, podiumY: PODIUM_Y, gravityScale: 1,
    podiums: podiumPositions,
    windAt: () => 0,
    ambientTilt: () => 0,
    update() {},
    dispose() { disposeGroup(group); },
  };
}

// ── Map 2: Sturmklippe ──────────────────────────────────────────────────
function buildSturm(reducedFx) {
  const accent = 0x4db5ff;
  const { group, podiumGroups } = buildBase(reducedFx, accent);
  addLights(group, accent);

  // Deko: zwei große Windturbinen-Silhouetten am Rand, deren Rotoren mit dem
  // aktuellen Windwert mitdrehen (rein kosmetisch, keine Kollision).
  const rotors = [];
  const turbineMat = new THREE.MeshStandardMaterial({ color: 0x2a3350, roughness: 0.7 });
  const bladeMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.5 });
  for (const side of [-1, 1]) {
    const mastX = side * (SPACING * 2.1);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 6, 10), turbineMat);
    mast.position.set(mastX, 3, -5.5);
    group.add(mast);
    const hub = new THREE.Group();
    hub.position.set(mastX, 6, -5.5);
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 0.05), bladeMat);
      blade.position.y = 1.3;
      const pivot = new THREE.Group();
      pivot.rotation.z = (b / 3) * Math.PI * 2;
      pivot.add(blade);
      hub.add(pivot);
    }
    group.add(hub);
    rotors.push(hub);
  }

  function windAt(t) {
    // gleichmäßiger, aber unregelmäßiger Böen-Verlauf — Summe zweier Sinusse.
    return Math.max(-1, Math.min(1, Math.sin(t * 0.9) * 0.65 + Math.sin(t * 2.3 + 1.3) * 0.35));
  }

  return {
    group, podiumY: PODIUM_Y, gravityScale: 1,
    podiums: podiumPositions,
    windAt,
    ambientTilt: () => 0,
    update(dt, t) {
      const w = windAt(t);
      for (const hub of rotors) hub.rotation.z += dt * (0.6 + Math.abs(w) * 3);
    },
    dispose() { disposeGroup(group); },
  };
}

// ── Map 3: Wackelplattform ────────────────────────────────────────────────
function buildWippe(reducedFx) {
  const accent = 0xb06dff;
  const { group, podiumGroups } = buildBase(reducedFx, accent);
  addLights(group, accent);

  function ambientTilt(t, i) {
    return Math.sin(t * 1.3 + i * 1.7) * 0.055;
  }

  return {
    group, podiumY: PODIUM_Y, gravityScale: 1,
    podiums: podiumPositions,
    windAt: () => 0,
    ambientTilt,
    update(dt, t) {
      podiumGroups.forEach((pg, i) => { pg.rotation.z = ambientTilt(t, i); });
    },
    dispose() { disposeGroup(group); },
  };
}

function disposeGroup(group) {
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
}

export function buildMap(id, reducedFx = false) {
  switch (id) {
    case 'sturm': return buildSturm(reducedFx);
    case 'wippe': return buildWippe(reducedFx);
    case 'halle':
    default:      return buildHalle(reducedFx);
  }
}
