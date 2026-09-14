// Block Bomb — die Bombe (3D-Objekt über dem Träger).
//
// Cartoon-Bombe: dunkle Kugel mit Zündschnur und glühendem Funken an der
// Spitze, umgeben von einer pulsierenden Glut-Hülle. Je weniger Restzeit
// (urgency 0..1), desto schneller pulsiert/blinkt sie und desto heftiger
// sprühen die Funken. main.js setzt die Position pro Frame über die Gruppe.
// Bei „Animationen reduzieren" entfallen Funkenpartikel und Punktlicht.

'use strict';

import * as THREE from '../vendor/three.module.js';

export class Bomb {
  constructor(reducedFx = false) {
    this.reducedFx = reducedFx;
    this.group = new THREE.Group();
    this.t = 0;
    this.urgency = 0;

    // Kern
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.33, 20, 16),
      new THREE.MeshStandardMaterial({ color: 0x14161f, roughness: 0.35, metalness: 0.5 }),
    );
    core.castShadow = true;
    this.group.add(core);
    this.core = core;

    // Glanzpunkt auf der Kugel
    const shine = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    shine.position.set(-0.13, 0.14, 0.22);
    this.group.add(shine);

    // Kappe + Zündschnur
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.14, 0.12, 12),
      new THREE.MeshStandardMaterial({ color: 0x3a3f4b, metalness: 0.7, roughness: 0.4 }),
    );
    cap.position.y = 0.36;
    this.group.add(cap);
    const fuse = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.22, 8),
      new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.9 }),
    );
    fuse.position.set(0.05, 0.5, 0); fuse.rotation.z = -0.4;
    this.group.add(fuse);

    // Funken an der Spitze
    this.spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd23c }),
    );
    this.spark.position.set(0.12, 0.6, 0);
    this.group.add(this.spark);

    // Glut-Hülle (additiv, pulsiert)
    this.glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 16, 12),
      new THREE.MeshBasicMaterial({
        color: 0xff5a2a, transparent: true, opacity: 0.25,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    this.group.add(this.glow);

    if (!reducedFx) {
      this.light = new THREE.PointLight(0xff7a3a, 1.2, 6, 2);
      this.light.position.y = 0.6;
      this.group.add(this.light);
      this._initSparks();
    }
  }

  _initSparks() {
    const N = 24;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    this._sparkData = [];
    for (let i = 0; i < N; i++) this._sparkData.push(this._spawnSpark());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.sparks = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffc93c, size: 0.09, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.group.add(this.sparks);
  }

  _spawnSpark() {
    return {
      x: 0.12, y: 0.6, z: 0,
      vx: (Math.random() * 2 - 1) * 0.6,
      vy: 0.8 + Math.random() * 1.2,
      vz: (Math.random() * 2 - 1) * 0.6,
      life: Math.random() * 0.5,
    };
  }

  setUrgency(u) { this.urgency = Math.max(0, Math.min(1, u)); }

  update(dt) {
    this.t += dt;
    const u = this.urgency;
    // Pulsfrequenz steigt mit der Dringlichkeit.
    const freq = 2 + u * 12;
    const pulse = 0.5 + 0.5 * Math.sin(this.t * freq);
    this.glow.material.opacity = 0.18 + pulse * (0.25 + u * 0.5);
    const sc = 1 + pulse * (0.08 + u * 0.25);
    this.glow.scale.setScalar(sc);
    this.spark.scale.setScalar(0.8 + pulse * (0.6 + u));
    this.spark.material.color.setHex(pulse > 0.5 ? 0xfff3a0 : 0xffd23c);
    if (this.light) this.light.intensity = 1 + pulse * (1.5 + u * 3);
    // leichtes Schweben + Drehen
    this.group.rotation.y += dt * (0.6 + u);

    if (this.sparks) this._updateSparks(dt, u);
  }

  _updateSparks(dt, u) {
    const arr = this.sparks.geometry.attributes.position.array;
    for (let i = 0; i < this._sparkData.length; i++) {
      const s = this._sparkData[i];
      s.life -= dt * (1 + u * 1.5);
      if (s.life <= 0) Object.assign(s, this._spawnSpark());
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      arr[i * 3] = s.x; arr[i * 3 + 1] = s.y; arr[i * 3 + 2] = s.z;
    }
    this.sparks.geometry.attributes.position.needsUpdate = true;
    this.sparks.material.opacity = 0.6 + 0.4 * Math.min(1, u + 0.3);
  }

  dispose() {
    this.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }
}
