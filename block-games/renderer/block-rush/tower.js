// Block Rush — vereinfachte Kipp-/Einsturz-Simulation UND deren Darstellung.
//
// KEINE Physik-Engine: Ein Turm hat einen Schwerpunkt (aus Masse + Zellposition
// je gelegtem Block), daraus eine Stabilität und ein Kipp-Ziel. Pro Frame läuft
// nur eine gedämpfte Feder auf den aktuellen Winkel zu — das reicht für ein
// sichtbares, glaubwürdiges Wackeln, ohne echte Starrkörper-Physik.
//
// Alle Blöcke eines Turms sitzen in EINER InstancedMesh (max. COLS*ROWS
// Instanzen) unter einem Pivot, der am Podest-Fußpunkt sitzt. Kippen = Pivot
// um die Z-Achse drehen. Einsturz = Instanzen zu einfachen ballistischen
// Trümmern umfunktionieren (keine neuen Meshes/Allokationen pro Frame).

'use strict';

import * as THREE from '../vendor/three.module.js';
import { COLS, ROWS, CELL, PIECE_COLORS } from './pieces.js';

const SUPPORT = 1.25;        // Podest-Halbbreite (schmaler als das 3.0 breite Raster → Überhang ist möglich)
const MAX_TILT = 0.28;       // rad, Deckel für das Kipp-Ziel bei extremer Schieflage
const LEAN_ANGLE = 0.20;     // rad, ab hier beginnt die sichtbare Wackel-Warnung
const COLLAPSE_ANGLE = 0.44; // rad, sofortiger Einsturz
const GRACE = 1.1;           // Sekunden Gnadenfrist im Wackel-Zustand
const CAP = COLS * ROWS;

function bumpiness(heights) {
  let b = 0;
  for (let i = 1; i < heights.length; i++) b += Math.abs(heights[i] - heights[i - 1]);
  return b;
}

export class TowerSim {
  constructor(scene, podiumPos, reducedFx) {
    this.reducedFx = reducedFx;
    this.pivot = new THREE.Group();
    this.pivot.position.copy(podiumPos);
    scene.add(this.pivot);

    const geo = new THREE.BoxGeometry(CELL * 0.92, CELL * 0.92, CELL * 0.92);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.08 });
    this.mesh = new THREE.InstancedMesh(geo, mat, CAP);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    if (!reducedFx) { this.mesh.castShadow = true; this.mesh.receiveShadow = true; }
    this.pivot.add(this.mesh);

    this.blocks = [];        // { cells:[{x,y}], mass, glued }
    this.angle = 0; this.angVel = 0; this.tiltTarget = 0; this.ambientBias = 0;
    this.stability = 1; this.comX = 0; this.leanT = 0; this.state = 'ok';
    this.quakeT = 0; this._t = 0; this._hNorm = 0;
    this._dummy = new THREE.Object3D();
    this._instCount = 0;
    this._debris = null; this._debrisT = 0; this._debrisDur = 0;
  }

  // Vom Spielkern aufgerufen, wenn Playfield.step()/hardDrop() ein Teil
  // einrasten lässt. `pf` = { heights, topRow, holes } vom aktuellen Playfield.
  lock(lockInfo, glued, pf) {
    const colorHex = PIECE_COLORS[lockInfo.type] || 0xffffff;
    this.blocks.push({ cells: lockInfo.cells, mass: lockInfo.mass || 1, glued: !!glued });
    const color = new THREE.Color(colorHex);
    for (const c of lockInfo.cells) {
      if (this._instCount >= CAP) break;
      this._dummy.position.set(
        (c.x - (COLS - 1) / 2) * CELL,
        (ROWS - 1 - c.y) * CELL + CELL / 2,
        0,
      );
      this._dummy.rotation.set(0, 0, 0);
      this._dummy.scale.set(1, 1, 1);
      this._dummy.updateMatrix();
      this.mesh.setMatrixAt(this._instCount, this._dummy.matrix);
      this.mesh.setColorAt(this._instCount, color);
      this._instCount++;
    }
    this.mesh.count = this._instCount;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    this._recompute(pf);
    // Landeimpuls: ein Teil, das seitlich außerhalb des Schwerpunkts landet,
    // stößt den Turm spürbar in diese Richtung an.
    this.angVel += (this.comX / SUPPORT) * 0.9;
  }

  _recompute(pf) {
    let m = 0, mx = 0;
    for (const b of this.blocks) {
      const w = b.mass * (b.glued ? 0.15 : 1); // geklebte Blöcke tragen kaum Drehmoment bei
      for (const c of b.cells) {
        const leverage = 1 + (ROWS - 1 - c.y) * 0.02; // höher gelegene Zellen wiegen stärker
        const cw = w * leverage;
        m += cw;
        mx += cw * ((c.x - (COLS - 1) / 2) * CELL);
      }
    }
    this.comX = m > 0 ? mx / m : 0;

    const hNorm = Math.max(0, Math.min(1, (ROWS - pf.topRow) / ROWS));
    this._hNorm = hNorm;
    const balance = this.comX / SUPPORT;
    const bump = bumpiness(pf.heights) / (COLS * ROWS);
    const stress = Math.abs(balance) * (1 + 0.9 * hNorm) + 0.55 * (pf.holes / 24) + 0.3 * bump;
    this.stability = Math.max(0, Math.min(1, 1 - stress));
    const clamped = Math.max(-1.4, Math.min(1.4, balance));
    this.tiltTarget = clamped * MAX_TILT * (1 + 0.6 * hNorm);
  }

  // Erdbeben-Spell: kurzzeitig geringere Dämpfung + Rüttel-Drehmoment.
  quake(strength = 1) { this.quakeT = Math.max(this.quakeT, 1.4 * strength); }

  // extTorque: von der Map (Windkanal) oder anderen Effekten, pro Frame frisch.
  update(dt, extTorque = 0) {
    if (this.state === 'falling') { this._updateDebris(dt); return; }
    this._t += dt;

    let torque = extTorque;
    let damp = 3.4;
    if (this.quakeT > 0) {
      this.quakeT = Math.max(0, this.quakeT - dt);
      torque += Math.sin(this._t * 22) * 1.6;
      damp = 1.6;
    }
    const k = 26 * (1 - 0.45 * this._hNorm);
    const target = this.tiltTarget + this.ambientBias;
    this.angVel += ((target - this.angle) * k + torque) * dt - this.angVel * damp * dt;
    this.angle += this.angVel * dt;
    this.pivot.rotation.z = this.angle;

    const bad = Math.abs(this.angle) > LEAN_ANGLE || this.stability < 0.18;
    this.leanT = bad ? this.leanT + dt : Math.max(0, this.leanT - dt * 1.5);
    this.state = bad ? 'lean' : 'ok';
    if (Math.abs(this.angle) > COLLAPSE_ANGLE || this.leanT > GRACE) this.collapse();
  }

  collapse() {
    if (this.state === 'falling') return;
    this.state = 'falling';
    const dummy = this._dummy;
    const spread = this.reducedFx ? 0.35 : 1;
    this._debris = [];
    for (let i = 0; i < this._instCount; i++) {
      this.mesh.getMatrixAt(i, dummy.matrix);
      dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
      this._debris.push({
        x: dummy.position.x, y: dummy.position.y, z: dummy.position.z, rz: 0,
        vx: (this.angVel * dummy.position.y + (Math.random() * 2 - 1) * 2) * spread,
        vy: (2 + Math.random() * 3) * spread,
        vz: (Math.random() * 2 - 1) * 3 * spread,
        vr: this.reducedFx ? 0 : (Math.random() * 2 - 1) * 8,
      });
    }
    this._debrisT = 0;
    this._debrisDur = this.reducedFx ? 0.8 : 1.6;
  }

  _updateDebris(dt) {
    if (!this._debris) return;
    this._debrisT += dt;
    const dummy = this._dummy;
    for (let i = 0; i < this._debris.length; i++) {
      const d = this._debris[i];
      d.vy -= 22 * dt;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      d.rz += d.vr * dt;
      if (d.y < -2) d.y = -2;
      dummy.position.set(d.x, d.y, d.z);
      dummy.rotation.set(0, 0, d.rz);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  isCollapseDone() { return this.state === 'falling' && this._debrisT >= this._debrisDur; }

  // Online-Gast: baut die Instanzen direkt aus einem übertragenen Zellen-
  // Array neu auf (kein `blocks`-Bookkeeping, keine Physik — Winkel/Stabilität
  // kommen beim Gast bereits fertig aus dem Snapshot, s. main.js _stepReplica).
  rebuildFromCells(cellsArr, colorForIndex) {
    this._instCount = 0;
    const dummy = this._dummy;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const idx = cellsArr[y * COLS + x];
        if (idx < 0) continue;
        if (this._instCount >= CAP) break;
        dummy.position.set((x - (COLS - 1) / 2) * CELL, (ROWS - 1 - y) * CELL + CELL / 2, 0);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        this.mesh.setMatrixAt(this._instCount, dummy.matrix);
        this.mesh.setColorAt(this._instCount, new THREE.Color(colorForIndex(idx)));
        this._instCount++;
      }
    }
    this.mesh.count = this._instCount;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose() {
    if (this.pivot.parent) this.pivot.parent.remove(this.pivot);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
