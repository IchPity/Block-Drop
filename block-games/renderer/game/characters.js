// Gemeinsame, spiel-agnostische blockige 3D-Spielfigur (für ALLE Minigames).
//
// Eine Figur ist eine THREE.Group aus Box-Meshes (Beine, Körper, Arme,
// würfelförmiger Kopf mit Augen). Die Körperfarbe kommt aus der Lobby
// (colorHex). Animationen:
//   • Laufen      — Arme/Beine schwingen gegenläufig (Sinus auf Hüft-/Schulter-
//                   Pivots), Tempo abhängig von der Laufgeschwindigkeit
//   • Tragen/Glow — emissiver Tint-Glow (z.B. Block-Bomb-Träger), setHolderGlow
//   • Explosion   — Glieder fliegen mit Zufallsschwung auseinander und faden
//   • Unverwundbar— periodisches Blinken (Laser Lines), setInvulnBlink
//   • Ausgeschieden— ausgegraut/abgesunken (Laser Lines), setEliminated
//
// Die Figur weiß NICHTS über Spiellogik — sie wird vom Spielkern positioniert
// und über update() animiert. Verschiedene Minigames nutzen je nur die Methoden,
// die sie brauchen (Block Bomb: setHolderGlow/explode; Laser Lines:
// setInvulnBlink/setEliminated).
//
// Lag früher in renderer/block-bomb/characters.js; nach renderer/game/ gehoben,
// damit beide Minigames dieselbe Figur teilen (statt Duplikat).

'use strict';

import * as THREE from '../vendor/three.module.js';

// Etwas dunklere Variante einer Farbe (für Kontrast an Beinen/Armen).
function shade(hex, f) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return c;
}

export class BlockCharacter {
  constructor(colorHex, reducedFx = false) {
    this.colorHex = colorHex;
    this.reducedFx = reducedFx;
    this.group = new THREE.Group();
    this.walkPhase = Math.random() * Math.PI * 2;
    this.bob = 0;
    this.exploding = false;
    this.explodeT = 0;
    this.parts = [];
    this.invulnBlink = false;
    this.blinkT = 0;
    this.eliminated = false;

    const body = new THREE.Color(colorHex);
    const limbMat = new THREE.MeshStandardMaterial({
      color: shade(colorHex, 0.7), roughness: 0.6, metalness: 0.05,
      emissive: body, emissiveIntensity: 0.06,
    });
    const bodyMat = new THREE.MeshStandardMaterial({
      color: body, roughness: 0.5, metalness: 0.08,
      emissive: body, emissiveIntensity: 0.12,
    });
    const headMat = new THREE.MeshStandardMaterial({
      color: shade(colorHex, 1.12), roughness: 0.45, metalness: 0.05,
      emissive: body, emissiveIntensity: 0.1,
    });
    this._mats = [limbMat, bodyMat, headMat];
    this._baseEmissive = { body: 0.12, head: 0.1, limb: 0.06 };

    // ── Beine (Pivot an der Hüfte, damit sie um die Hüfte schwingen) ──
    this.legL = this._limb(limbMat, -0.17, 0.58, 0.30, 0.6, 0.30);
    this.legR = this._limb(limbMat,  0.17, 0.58, 0.30, 0.6, 0.30);

    // ── Körper ──
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.7, 0.46), bodyMat);
    torso.position.y = 0.95; torso.castShadow = true;
    this.group.add(torso);
    this.torso = torso;

    // ── Arme (Pivot an der Schulter) ──
    this.armL = this._limb(limbMat, -0.47, 1.22, 0.22, 0.6, 0.22);
    this.armR = this._limb(limbMat,  0.47, 1.22, 0.22, 0.6, 0.22);

    // ── Kopf + Augen ──
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.56, 0.56), headMat);
    head.position.y = 1.62; head.castShadow = true;
    this.group.add(head);
    this.head = head;

    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x14142b, roughness: 0.3 });
    const eyeGeo = new THREE.BoxGeometry(0.1, 0.13, 0.05);
    for (const ex of [-0.13, 0.13]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(ex, 1.66, 0.29);
      this.group.add(eye);
    }

    // Teile, die bei der Explosion auseinanderfliegen.
    this.parts = [this.legL, this.legR, torso, this.armL, this.armR, head];
  }

  // Ein Glied als Pivot-Group: das Mesh hängt unter dem Drehpunkt, sodass
  // Rotation um X ein Schwingen aus der Hüfte/Schulter ergibt.
  _limb(mat, x, pivotY, w, h, d) {
    const pivot = new THREE.Group();
    pivot.position.set(x, pivotY, 0);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.y = -h / 2;
    mesh.castShadow = true;
    pivot.add(mesh);
    this.group.add(pivot);
    return pivot;
  }

  // facing: Blickrichtung (rad) um Y; speed01: 0..1 Lauftempo; isHolder: Glow.
  update(dt, facing, speed01, isHolder) {
    if (this.exploding) { this._updateExplosion(dt); return; }

    this.group.rotation.y = facing;

    // Laufzyklus
    this.walkPhase += dt * (6 + speed01 * 10);
    const swing = Math.sin(this.walkPhase) * (0.2 + speed01 * 0.7);
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;

    if (isHolder) {
      // Trag-Pose: Arme nach vorn-oben, nervöses Hibbeln.
      this.bob += dt * 14;
      const j = Math.sin(this.bob) * 0.12;
      this.armL.rotation.x = -2.1 + j;
      this.armR.rotation.x = -2.1 - j;
      this.group.position.y = this._baseY() + Math.abs(Math.sin(this.bob)) * 0.05;
    } else {
      this.armL.rotation.x = -swing * 0.8;
      this.armR.rotation.x = swing * 0.8;
      this.group.position.y = this._baseY();
    }

    // Unverwundbarkeits-Blinken (Laser Lines): Sichtbarkeit pulsiert.
    if (this.invulnBlink) {
      this.blinkT += dt;
      this.group.visible = (Math.sin(this.blinkT * 22) > -0.3);
    }
  }

  _baseY() { return this._groundY || 0; }
  setGroundY(y) { this._groundY = y; this.group.position.y = y; }

  // Roter Träger-Glow an/aus (emissive hochfahren) — Block Bomb.
  setHolderGlow(on) {
    const k = on ? 1 : 0;
    this._mats[0].emissiveIntensity = this._baseEmissive.limb + k * 0.5;
    this._mats[1].emissiveIntensity = this._baseEmissive.body + k * 0.8;
    this._mats[2].emissiveIntensity = this._baseEmissive.head + k * 0.6;
    const tint = on ? new THREE.Color(0xff3b30) : new THREE.Color(this.colorHex);
    this._mats[1].emissive.lerp(tint, on ? 0.55 : 0); // bei aus zurücksetzen
    if (!on) this._mats.forEach((m) => m.emissive.set(this.colorHex));
  }

  // Unverwundbarkeit nach Treffer (Laser Lines): Figur blinkt.
  setInvulnBlink(on) {
    this.invulnBlink = on;
    this.blinkT = 0;
    if (!on && !this.eliminated) this.group.visible = true;
  }

  // Ausgeschieden (Laser Lines): grau, abgesunken, halbtransparent „Geist".
  setEliminated(on) {
    this.eliminated = on;
    this.invulnBlink = false;
    if (on) {
      this.group.visible = true;
      const grey = new THREE.Color(0x6a6a7a);
      this._mats.forEach((m) => {
        m.color.lerp(grey, 0.7);
        m.emissive.set(0x000000);
        m.emissiveIntensity = 0;
        m.transparent = true;
        m.opacity = 0.45;
      });
    }
  }

  // Kurzes Aufleuchten (z.B. Bombenempfang).
  flash() {
    this._mats.forEach(m => { m.emissiveIntensity = 1.0; });
    setTimeout(() => {
      if (this.eliminated) return;
      this._mats[0].emissiveIntensity = this._baseEmissive.limb;
      this._mats[1].emissiveIntensity = this._baseEmissive.body;
      this._mats[2].emissiveIntensity = this._baseEmissive.head;
    }, 160);
  }

  explode() {
    if (this.exploding) return;
    this.exploding = true;
    this.explodeT = 0;
    // Jedem Teil eine Zufallsgeschwindigkeit + Drall geben.
    for (const part of this.parts) {
      part.userData.vel = new THREE.Vector3(
        (Math.random() * 2 - 1) * 4,
        2 + Math.random() * 5,
        (Math.random() * 2 - 1) * 4,
      );
      part.userData.spin = new THREE.Vector3(
        (Math.random() * 2 - 1) * 8,
        (Math.random() * 2 - 1) * 8,
        (Math.random() * 2 - 1) * 8,
      );
    }
  }

  _updateExplosion(dt) {
    this.explodeT += dt;
    for (const part of this.parts) {
      const v = part.userData.vel; if (!v) continue;
      v.y -= 14 * dt; // Schwerkraft
      part.position.x += v.x * dt;
      part.position.y += v.y * dt;
      part.position.z += v.z * dt;
      const s = part.userData.spin;
      part.rotation.x += s.x * dt;
      part.rotation.y += s.y * dt;
      part.rotation.z += s.z * dt;
    }
    // Ausblenden
    const a = Math.max(0, 1 - this.explodeT / 1.1);
    this._mats.forEach(m => { m.transparent = true; m.opacity = a; });
    if (this.explodeT > 1.1) this.group.visible = false;
  }

  dispose() {
    this.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }
}
