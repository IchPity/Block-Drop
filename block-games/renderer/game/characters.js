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
// Aussehen („Look"): Kopf-/Körperform, Augen, Kopfschmuck und Oberfläche sind
// anpassbar (Esc → „Anpassen", renderer/custom.js). Figuren, die mit
// `opts.mine` (eigene, lokale Spieler) oder `opts.seed` (Bots/Mitspieler)
// erzeugt werden, folgen dem Custom-Store LIVE — auch mitten im pausierten
// Match. Der Look ist rein optisch: Trefferbox, Tempo und Sprung bleiben für
// alle Formen identisch.
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

// Kantige Formen (Pyramide & Co.) brauchen Flächen- statt Punktnormalen, sonst
// verschmiert die Beleuchtung über die Kanten.
function flat(geo) {
  const g = geo.toNonIndexed();
  g.computeVertexNormals();
  geo.dispose();
  return g;
}

const DEFAULT_LOOK = { head: 'cube', body: 'block', eyes: 'normal', hat: 'none', finish: 'matt' };

// Kopfformen: Geometrie + wo die Augen sitzen (z = Vorderseite der Form auf
// Augenhöhe y) + Höhe der Oberkante für den Kopfschmuck.
const HEADS = {
  cube:     { geo: () => new THREE.BoxGeometry(0.56, 0.56, 0.56),            eyeY: 0.04,  eyeZ: 0.29, top: 0.28 },
  sphere:   { geo: () => new THREE.SphereGeometry(0.33, 20, 14),             eyeY: 0.04,  eyeZ: 0.3,  top: 0.31 },
  cylinder: { geo: () => new THREE.CylinderGeometry(0.3, 0.3, 0.56, 20),     eyeY: 0.04,  eyeZ: 0.28, top: 0.28 },
  pyramid:  { geo: () => flat(new THREE.ConeGeometry(0.44, 0.64, 4).rotateY(Math.PI / 4)), eyeY: -0.14, eyeZ: 0.24, top: 0.26, eyeTilt: -0.45 },
  diamond:  { geo: () => new THREE.OctahedronGeometry(0.4),                  eyeY: 0,     eyeZ: 0.28, top: 0.36 },
  wide:     { geo: () => new THREE.BoxGeometry(0.78, 0.5, 0.5),              eyeY: 0.02,  eyeZ: 0.26, top: 0.25, eyeGap: 0.19 },
};

const BODIES = {
  block:  () => new THREE.BoxGeometry(0.72, 0.7, 0.46),
  barrel: () => new THREE.CylinderGeometry(0.34, 0.34, 0.7, 18),
  vshape: () => flat(new THREE.CylinderGeometry(0.4, 0.24, 0.7, 4).rotateY(Math.PI / 4).scale(1, 1, 0.72)),
  slim:   () => new THREE.BoxGeometry(0.54, 0.74, 0.36),
};

// Oberfläche: Rauheit/Metall + Faktor auf das Eigenleuchten der Spielerfarbe.
const FINISHES = {
  matt:   { rough: 0,     metal: 0,    glow: 1 },
  glossy: { rough: -0.36, metal: 0.1,  glow: 1 },
  metal:  { rough: -0.28, metal: 0.62, glow: 1.6 },
  neon:   { rough: 0,     metal: 0,    glow: 4.5 },
};
const BASE_ROUGH = { limb: 0.6, body: 0.5, head: 0.45 };
const BASE_METAL = { limb: 0.05, body: 0.08, head: 0.05 };
const BASE_EMISSIVE = { limb: 0.06, body: 0.12, head: 0.1 };

// Alle Figuren, die dem Custom-Store folgen (s. Kopfkommentar). Der Store
// wird beim ersten Bedarf EINMAL abonniert; dispose() trägt die Figur aus.
const liveChars = new Set();
let subscribed = false;
const store = () => (typeof Custom !== 'undefined' ? Custom : null);

function lookFor(opts) {
  const c = store();
  if (!c) return null;
  return opts.mine ? c.look() : c.botLook(opts.seed);
}

export class BlockCharacter {
  // opts: { mine } → eigener Look aus „Anpassen"; { seed } → Bot/Mitspieler
  // (je nach Einstellung Standard/zufällig/wie ich); { look } → fester Look.
  constructor(colorHex, reducedFx = false, opts = null) {
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
    this._baseEmissive = { ...BASE_EMISSIVE };
    this._holderOn = false;

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

    // Augen + Kopfschmuck hängen am Kopf (fliegen bei der Explosion mit) und
    // werden von setLook() je nach Look neu gebaut.
    this.face = new THREE.Group();
    head.add(this.face);

    // Teile, die bei der Explosion auseinanderfliegen.
    this.parts = [this.legL, this.legR, torso, this.armL, this.armR, head];

    this.setLook((opts && (opts.look || lookFor(opts))) || DEFAULT_LOOK);
    if (opts && (opts.mine || opts.seed !== undefined) && store()) {
      this._follow = opts;
      liveChars.add(this);
      if (!subscribed) {
        subscribed = true;
        store().onChange(() => liveChars.forEach(ch => ch.setLook(lookFor(ch._follow) || DEFAULT_LOOK)));
      }
    }
  }

  // Look (neu) anwenden: tauscht nur Geometrien und Material-Kennwerte — die
  // Meshes, ihre Positionen und der Spielzustand (Glow, Blinken, Explosion)
  // bleiben unberührt, deshalb geht das auch mitten im Match.
  setLook(look) {
    const l = { ...DEFAULT_LOOK, ...(look || {}) };
    const headDef = HEADS[l.head] || HEADS.cube;

    this.head.geometry.dispose();
    this.head.geometry = headDef.geo();
    this.torso.geometry.dispose();
    this.torso.geometry = (BODIES[l.body] || BODIES.block)();

    const f = FINISHES[l.finish] || FINISHES.matt;
    ['limb', 'body', 'head'].forEach((part, i) => {
      const m = this._mats[i];
      m.roughness = Math.max(0.08, BASE_ROUGH[part] + f.rough);
      m.metalness = BASE_METAL[part] + f.metal;
      this._baseEmissive[part] = BASE_EMISSIVE[part] * f.glow;
    });
    if (!this.eliminated) {
      const k = this._holderOn ? 1 : 0; // gleiche Aufschläge wie setHolderGlow()
      this._mats[0].emissiveIntensity = this._baseEmissive.limb + k * 0.5;
      this._mats[1].emissiveIntensity = this._baseEmissive.body + k * 0.8;
      this._mats[2].emissiveIntensity = this._baseEmissive.head + k * 0.6;
    }

    this._clearFace();
    this._buildEyes(l.eyes, headDef);
    this._buildHat(l.hat, headDef.top);
  }

  _clearFace() {
    this.face.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    this.face.clear();
  }

  _faceMesh(geo, mat, x, y, z) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    this.face.add(mesh);
    return mesh;
  }

  _buildEyes(style, headDef) {
    const glow = style === 'glow';
    const mat = new THREE.MeshStandardMaterial(glow
      ? { color: 0xffffff, emissive: 0xbff6ff, emissiveIntensity: 1.6, roughness: 0.3 }
      : { color: 0x14142b, roughness: 0.3 });
    const gap = headDef.eyeGap || 0.13;
    const sizes = { big: [0.16, 0.2], sleepy: [0.15, 0.05], cyclops: [0.22, 0.2], angry: [0.13, 0.08] };
    const [w, h] = sizes[style] || [0.1, 0.13];
    const xs = style === 'cyclops' ? [0] : [-gap, gap];
    for (const ex of xs) {
      const eye = this._faceMesh(new THREE.BoxGeometry(w, h, 0.05), mat, ex, headDef.eyeY, headDef.eyeZ);
      eye.rotation.x = headDef.eyeTilt || 0;
      if (style === 'angry') eye.rotation.z = ex < 0 ? -0.5 : 0.5; // zur Mitte hin abfallend
    }
  }

  _buildHat(style, top) {
    const std = (color, extra) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, ...(extra || {}) });
    if (style === 'crown') {
      const gold = std(0xffc93c, { metalness: 0.5, roughness: 0.3, emissive: 0xffc93c, emissiveIntensity: 0.25 });
      this._faceMesh(new THREE.CylinderGeometry(0.22, 0.2, 0.1, 10), gold, 0, top + 0.05, 0);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        this._faceMesh(new THREE.ConeGeometry(0.05, 0.13, 4), gold, Math.sin(a) * 0.18, top + 0.16, Math.cos(a) * 0.18);
      }
    } else if (style === 'tophat') {
      const felt = std(0x1c1c2e, { roughness: 0.7 });
      this._faceMesh(new THREE.CylinderGeometry(0.33, 0.33, 0.04, 18), felt, 0, top + 0.02, 0);
      this._faceMesh(new THREE.CylinderGeometry(0.2, 0.21, 0.3, 18), felt, 0, top + 0.19, 0);
      this._faceMesh(new THREE.CylinderGeometry(0.215, 0.215, 0.06, 18), std(0xff5d5d), 0, top + 0.08, 0);
    } else if (style === 'party') {
      this._faceMesh(new THREE.ConeGeometry(0.18, 0.4, 14), std(0xff6ec7, { emissive: 0xff6ec7, emissiveIntensity: 0.2 }), 0, top + 0.2, 0);
      this._faceMesh(new THREE.SphereGeometry(0.06, 10, 8), std(0xffc93c), 0, top + 0.42, 0);
    } else if (style === 'antenna') {
      this._faceMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), std(0x9a9abd, { metalness: 0.6 }), 0, top + 0.15, 0);
      this._faceMesh(new THREE.SphereGeometry(0.07, 12, 10), std(this.colorHex, { emissive: this.colorHex, emissiveIntensity: 1.2 }), 0, top + 0.34, 0);
    } else if (style === 'horns') {
      const bone = std(0xf2f2fa, { roughness: 0.35 });
      for (const side of [-1, 1]) {
        const horn = this._faceMesh(new THREE.ConeGeometry(0.07, 0.26, 8), bone, side * 0.2, top + 0.08, 0);
        horn.rotation.z = -side * 0.5;
      }
    } else if (style === 'halo') {
      const halo = this._faceMesh(new THREE.TorusGeometry(0.21, 0.03, 8, 24),
        std(0xffe27a, { emissive: 0xffd24a, emissiveIntensity: 1.4 }), 0, top + 0.2, 0);
      halo.rotation.x = Math.PI / 2;
    }
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

  // Sprung (s. Sprung-Mechanik in block-bomb/main.js + laser-lines/main.js):
  // reine Höhenverschiebung über dem Boden, komponiert additiv mit den
  // übrigen Y-Bewegungen unten (Trage-Hibbeln, Sieg-Hüpfer, Ausscheiden-Absinken).
  _baseY() { return (this._groundY || 0) + (this._jumpOffset || 0); }
  setGroundY(y) { this._groundY = y; this.group.position.y = this._baseY(); }
  setJumpOffset(dy) { this._jumpOffset = dy; }

  // Roter Träger-Glow an/aus (emissive hochfahren) — Block Bomb.
  setHolderGlow(on) {
    this._holderOn = !!on;
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
    liveChars.delete(this);
    this.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }
}
