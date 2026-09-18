// Gemeinsames Theme-Modul für die 3D-Kulissen aller Minigames.
//
// Vorher: jede 3D-Farbe war ein Hex-Literal, das die CSS-Tokens (style.css
// :root) per Hand nachgebaut hat — nur nach Wert, nicht nach Referenz, also
// drifteten 2D- und 3D-Look mit der Zeit auseinander (z.B. Laser Lines nutzte
// 0xff5bd0 für "Pink", während --pink in style.css #ff6ec7 ist). PALETTE hier
// ist die eine Quelle für diese Werte auf der JS-Seite.
//
// Jede Map bekommt zusätzlich ein `mood`-Objekt (Hintergrund/Nebel/Licht-
// Rig/Akzent) statt hart im jeweiligen Spielkern verdrahteter Werte —
// `addLightRig`/`applyMood` sind bewusst so gehalten, wie es Block Rushs
// `addLights(group, accent)` schon vormacht (das Vorbild für diese
// Verallgemeinerung), nur jetzt für alle drei Spiele nutzbar.

'use strict';

import * as THREE from '../vendor/three.module.js';

// Identische Hex-Werte wie die CSS-Custom-Properties in renderer/style.css
// (:root, oben in der Datei) — als Three.js-taugliche Zahlen.
export const PALETTE = {
  red: 0xff5d5d,
  yellow: 0xffc93c,
  green: 0x3ddc84,
  blue: 0x4db5ff,
  purple: 0xb06dff,
  orange: 0xff944d,
  cyan: 0x36d6e7,
  pink: 0xff6ec7,
  bg: 0x14142b,
  bgDeep: 0x0d0d1e,
};

// mood = { bg, fogNear, fogFar, ambientColor, ambientIntensity, keyColor,
//          keyIntensity, accent, rimIntensity, castShadow }
// Alle Felder optional — fehlende fallen auf sinnvolle Defaults zurück, damit
// eine Map nur die Felder angeben muss, die sie wirklich von der Norm
// abweichen lassen will.
const MOOD_DEFAULTS = {
  bg: 0x0d0f1c,
  fogNear: 28,
  fogFar: 54,
  ambientColor: 0x8088aa,
  ambientIntensity: 0.82,
  keyColor: 0xffffff,
  keyIntensity: 1.1,
  accent: PALETTE.cyan,
  rimIntensity: 0.4,
  castShadow: true,
};

function resolveMood(mood) {
  return { ...MOOD_DEFAULTS, ...(mood || {}) };
}

// Hintergrundfarbe + Nebel auf eine Szene anwenden.
export function applyMood(scene, mood) {
  const m = resolveMood(mood);
  scene.background = new THREE.Color(m.bg);
  scene.fog = new THREE.Fog(m.bg, m.fogNear, m.fogFar);
  return m;
}

// Ambient + Key (optional schattenwerfend) + Rim-Licht (in Akzentfarbe) auf
// `target` (Scene oder Group — beides kennt `.add()`) anwenden. Liefert die
// drei Licht-Objekte zurück, falls ein Aufrufer noch Feinjustierung braucht
// (z.B. eigene Schatten-Kamera-Grenzen).
export function addLightRig(target, mood) {
  const m = resolveMood(mood);

  const ambient = new THREE.AmbientLight(m.ambientColor, m.ambientIntensity);
  target.add(ambient);

  const key = new THREE.DirectionalLight(m.keyColor, m.keyIntensity);
  key.position.set(11, 23, 11);
  if (m.castShadow) {
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const s = 24;
    key.shadow.camera.left = -s; key.shadow.camera.right = s;
    key.shadow.camera.top = s; key.shadow.camera.bottom = -s;
    key.shadow.camera.far = 80;
  }
  target.add(key);

  const rim = new THREE.DirectionalLight(m.accent, m.rimIntensity);
  rim.position.set(-10, 7, -11);
  target.add(rim);

  return { ambient, key, rim };
}
