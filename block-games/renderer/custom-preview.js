// Block Games — Figur-Vorschau im Anpassen-Fenster (renderer/custom.js).
//
// Zeigt dieselbe BlockCharacter-Figur wie die Minigames, langsam drehend und
// auf der Stelle laufend, damit man Kopf, Körper, Augen und Kopfschmuck von
// allen Seiten sieht. Die Figur wird mit { mine: true } erzeugt und folgt dem
// Custom-Store damit von selbst (s. game/characters.js) — hier ist nur
// Bühne, Licht und Render-Schleife. Läuft ausschließlich, solange das
// Fenster offen ist; stop() gibt den WebGL-Kontext wieder frei.

'use strict';

import * as THREE from './vendor/three.module.js';
import { BlockCharacter } from './game/characters.js';

let active = null; // { renderer, char, raf }

function start(canvas, colorHex) {
  stop();
  if (!canvas) return;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch { return; } // kein WebGL → Fenster funktioniert auch ohne Vorschau
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth || 220, canvas.clientHeight || 280, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, (canvas.clientWidth || 220) / (canvas.clientHeight || 280), 0.1, 30);
  camera.position.set(0, 1.5, 5.2);
  camera.lookAt(0, 1.12, 0);

  scene.add(new THREE.AmbientLight(0x8088aa, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.25);
  key.position.set(3, 6, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x36d6e7, 0.5);
  rim.position.set(-4, 3, -4);
  scene.add(rim);

  const char = new BlockCharacter(colorHex, false, { mine: true });
  scene.add(char.group);

  const state = { renderer, char, raf: 0 };
  let last = performance.now();
  let facing = 0.5;
  (function loop(now) {
    state.raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    facing += dt * 0.9;
    char.update(dt, facing, 0.25, false);
    renderer.render(scene, camera);
  })(last);
  active = state;
}

function stop() {
  if (!active) return;
  cancelAnimationFrame(active.raf);
  active.char.dispose();
  active.renderer.dispose();
  active = null;
}

window.CustomPreview = { start, stop };
