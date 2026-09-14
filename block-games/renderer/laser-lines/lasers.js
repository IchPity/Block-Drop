// Laser Lines — Laser-System.
//
// Ein Laser durchläuft die Zustände  warning → active → cooldown  (zeitgesteuert)
// bzw. ist „persistent" (rotierende Strahlen der Spin Arena, dauerhaft aktiv und
// allein durch die sichtbare Rotation telegrafiert). Drei Formen:
//   • 'lane'  — achsenparalleler Strahl quer durch die Halle (Factory Grid)
//   • 'spoke' — radialer Strahl aus der Mitte, rotiert (Spin Arena)
//   • 'zone'  — rechteckiges Gefahrenfeld auf den Plattformen (Sky Warning)
//
// Fairness: In der warning-Phase erscheint eine Boden-Warnlinie + Warnton; erst
// danach ist der Strahl gefährlich (active). Es gibt NIE einen Treffer ohne
// vorherige, sichtbare Warnung. Tempo/Frequenz steigen langsam (LaserDirector,
// Level aus der Rundenzeit).
//
// Kollision (einfache, stabile Hitboxen, nur in der active-Phase):
//   lane/spoke → Abstand Punkt→Segment < (Strahlbreite/2 + Spielerradius)
//   zone       → Punkt-in-Rechteck (+ Spielerradius)
//
// Optik: rot/pink leuchtende Linie (emissive) + additives Glow-Mesh, Boden-
// Warnlinie, Funken beim Aktivieren — Glow/Funken entfallen bei reducedFx.

'use strict';

import * as THREE from '../vendor/three.module.js';

const WARN_COLOR = 0xff5bd0;   // pink — Warnphase
const FIRE_COLOR = 0xff2747;   // rot  — aktiver Strahl
const BEAM_Y = 1.1;            // Höhe des Strahls über dem Boden

// Abstand Punkt (px,pz) zum Segment a→b.
function pointSegDist(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az;
  const wx = px - ax, wz = pz - az;
  const len2 = vx * vx + vz * vz;
  let t = len2 > 1e-6 ? (wx * vx + wz * vz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + vx * t, cz = az + vz * t;
  return Math.hypot(px - cx, pz - cz);
}

// ── Ein einzelner Laser ───────────────────────────────────────────────────
export class Laser {
  // opts: { shape, groundY, halfWidth, warnTime, activeTime, cooldownTime,
  //         persistent, length, reducedFx, ...geometrie }
  constructor(opts) {
    this.o = opts;
    this.groundY = opts.groundY;
    this.halfWidth = opts.halfWidth ?? 0.55;
    this.reducedFx = !!opts.reducedFx;
    this.persistent = !!opts.persistent;
    this.warnTime = opts.warnTime ?? 1.0;
    this.activeTime = opts.activeTime ?? 0.55;
    this.cooldownTime = opts.cooldownTime ?? 0.35;
    this.state = this.persistent ? 'active' : 'warning';
    this.t = 0;
    this.dead = false;
    this.angle = opts.angle ?? 0;          // spoke
    this.angularSpeed = opts.angularSpeed ?? 0; // spoke
    this.firedSound = false;

    this.group = new THREE.Group();
    this._buildMeshes();
    this._refreshGeometry();
    this._applyStateVisual();
  }

  _buildMeshes() {
    const o = this.o;
    if (o.shape === 'zone') {
      // Boden-Warnfeld + erhöhtes „Säulen"-Feld als aktiver Strahlbereich.
      const warnGeo = new THREE.BoxGeometry(o.w, 0.06, o.d);
      this.warnMesh = new THREE.Mesh(warnGeo, this._mat(WARN_COLOR, 0.5, true));
      this.warnMesh.position.set(o.x, this.groundY + 0.05, o.z);
      this.group.add(this.warnMesh);
      const beamGeo = new THREE.BoxGeometry(o.w, 3.2, o.d);
      this.beamMesh = new THREE.Mesh(beamGeo, this._mat(FIRE_COLOR, 0.0, true));
      this.beamMesh.position.set(o.x, this.groundY + 1.6, o.z);
      this.group.add(this.beamMesh);
    } else {
      // lane/spoke: lange dünne Box. Länge entlang +X, wird über Rotation/
      // Position passend gedreht/verschoben (in _refreshGeometry).
      const len = o.length ?? 24;
      this.len = len;
      const warnGeo = new THREE.BoxGeometry(len, 0.06, this.halfWidth * 2);
      this.warnMesh = new THREE.Mesh(warnGeo, this._mat(WARN_COLOR, 0.5, true));
      this.warnMesh.position.y = this.groundY + 0.05;
      this.group.add(this.warnMesh);
      const beamGeo = new THREE.BoxGeometry(len, this.halfWidth * 1.6, this.halfWidth * 1.6);
      this.beamMesh = new THREE.Mesh(beamGeo, this._mat(FIRE_COLOR, 0.0, false));
      this.beamMesh.position.y = this.groundY + BEAM_Y;
      this.group.add(this.beamMesh);
      if (!this.reducedFx) {
        const glowGeo = new THREE.BoxGeometry(len, this.halfWidth * 3.0, this.halfWidth * 3.0);
        this.glowMesh = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({
          color: FIRE_COLOR, transparent: true, opacity: 0.0,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        this.glowMesh.position.y = this.groundY + BEAM_Y;
        this.group.add(this.glowMesh);
      }
    }
  }

  _mat(color, emissiveIntensity, flat) {
    return new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity,
      transparent: true, opacity: flat ? 0.55 : 0.9,
      roughness: 0.4, metalness: 0.0, depthWrite: false,
    });
  }

  // Endpunkte (a,b) des Strahls in Weltkoordinaten (für Kollision + Geometrie).
  endpoints() {
    const o = this.o;
    if (o.shape === 'spoke') {
      const c = Math.cos(this.angle), s = Math.sin(this.angle);
      // Strahl von der Mitte (0,0) nach außen, Länge = radius.
      return { ax: 0, az: 0, bx: c * o.length, bz: s * o.length };
    }
    if (o.shape === 'lane') {
      if (o.axis === 'x') return { ax: -o.length / 2, az: o.pos, bx: o.length / 2, bz: o.pos };
      return { ax: o.pos, az: -o.length / 2, bx: o.pos, bz: o.length / 2 };
    }
    return null; // zone
  }

  _refreshGeometry() {
    const o = this.o;
    if (o.shape === 'zone') return;
    const e = this.endpoints();
    const cx = (e.ax + e.bx) / 2, cz = (e.az + e.bz) / 2;
    const ang = Math.atan2(e.bz - e.az, e.bx - e.ax);
    for (const m of [this.warnMesh, this.beamMesh, this.glowMesh]) {
      if (!m) continue;
      m.position.x = cx; m.position.z = cz;
      m.rotation.y = -ang;
    }
  }

  _applyStateVisual() {
    const warn = this.state === 'warning';
    const active = this.state === 'active';
    // Warn-Mesh pulsiert in der Warnphase, blasst sonst aus.
    if (this.warnMesh) {
      this.warnMesh.visible = warn || active;
      const base = warn ? 0.6 : 0.18;
      this.warnMesh.material.emissiveIntensity = base;
      this.warnMesh.material.opacity = warn ? 0.5 : 0.25;
    }
    if (this.beamMesh) {
      this.beamMesh.visible = active;
      this.beamMesh.material.emissiveIntensity = active ? 1.6 : 0.0;
    }
    if (this.glowMesh) this.glowMesh.material.opacity = active ? 0.32 : 0.0;
  }

  update(dt, onFire) {
    if (this.dead) return;
    if (this.persistent) {
      this.angle += this.angularSpeed * dt;
      this._refreshGeometry();
      // sanftes Pulsieren des aktiven Strahls
      if (this.beamMesh) this.beamMesh.material.emissiveIntensity = 1.4 + Math.sin(performance.now() / 90) * 0.25;
      return;
    }
    this.t += dt;
    if (this.state === 'warning') {
      // Warn-Mesh pulsiert
      if (this.warnMesh) this.warnMesh.material.emissiveIntensity = 0.4 + Math.abs(Math.sin(this.t * 9)) * 0.6;
      if (this.t >= this.warnTime) { this.state = 'active'; this.t = 0; this._applyStateVisual(); }
    } else if (this.state === 'active') {
      if (!this.firedSound) { this.firedSound = true; if (onFire) onFire(this); }
      if (this.t >= this.activeTime) { this.state = 'cooldown'; this.t = 0; this._applyStateVisual(); }
    } else if (this.state === 'cooldown') {
      if (this.t >= this.cooldownTime) { this.dead = true; }
    }
  }

  // Treffer-Test (nur active). r = Spielerradius.
  hits(px, pz, r) {
    if (this.state !== 'active') return false;
    const o = this.o;
    if (o.shape === 'zone') {
      return Math.abs(px - o.x) <= o.w / 2 + r && Math.abs(pz - o.z) <= o.d / 2 + r;
    }
    const e = this.endpoints();
    return pointSegDist(px, pz, e.ax, e.az, e.bx, e.bz) <= this.halfWidth + r;
  }

  // Gefahr für Bots: nächster Punkt auf dem Strahl (zum Wegfliehen) + ob bereits
  // sichtbar bedrohlich (warning oder active — beides ist für Menschen sichtbar,
  // also fair). Liefert null, wenn (noch) keine sichtbare Gefahr.
  threatPoint(px, pz) {
    if (this.dead) return null;
    if (!this.persistent && this.state === 'cooldown') return null;
    const o = this.o;
    if (o.shape === 'zone') {
      return { x: o.x, z: o.z, active: this.state === 'active' };
    }
    const e = this.endpoints();
    const vx = e.bx - e.ax, vz = e.bz - e.az;
    const len2 = vx * vx + vz * vz;
    let t = len2 > 1e-6 ? ((px - e.ax) * vx + (pz - e.az) * vz) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    return { x: e.ax + vx * t, z: e.az + vz * t, active: this.persistent || this.state === 'active' };
  }

  dispose() {
    this.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }
}

// ── Funken beim Aktivieren (kurzlebige Partikel, entfällt bei reducedFx) ────
class Sparks {
  constructor(scene, reducedFx) {
    this.scene = scene;
    this.reducedFx = reducedFx;
    this.items = [];
  }
  burst(x, y, z) {
    if (this.reducedFx) return;
    const n = 8;
    const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd0e6, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      const a = Math.random() * Math.PI * 2;
      m.userData.v = new THREE.Vector3(Math.cos(a) * (2 + Math.random() * 3), 2 + Math.random() * 3, Math.sin(a) * (2 + Math.random() * 3));
      m.userData.life = 0.4 + Math.random() * 0.3;
      m.userData.age = 0;
      this.scene.add(m);
      this.items.push(m);
    }
  }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const m = this.items[i];
      m.userData.age += dt;
      const k = m.userData.age / m.userData.life;
      if (k >= 1) { this.scene.remove(m); m.geometry.dispose(); this.items.splice(i, 1); continue; }
      m.userData.v.y -= 12 * dt;
      m.position.addScaledVector(m.userData.v, dt);
      m.material.opacity = 1 - k;
      m.scale.setScalar(1 - k * 0.5);
    }
  }
  dispose() {
    for (const m of this.items) { this.scene.remove(m); m.geometry.dispose(); }
    this.items = [];
  }
}

// ── Regie: spawnt & steuert die Laser einer Map, ramped die Schwierigkeit ───
export class LaserDirector {
  // cfg = map.laserConfig (siehe maps.js). scene = THREE.Scene (für Funken).
  constructor(cfg, groundY, scene, reducedFx, sfx) {
    this.cfg = cfg;
    this.groundY = groundY;
    this.scene = scene;
    this.reducedFx = reducedFx;
    this.sfx = sfx || (() => {});
    this.group = new THREE.Group();
    this.lasers = [];
    this.elapsed = 0;
    this.level = 1;
    this.spawnTimer = (cfg.firstDelay ?? 1.0);
    this.sparks = new Sparks(scene, reducedFx);
    this.onLevelUp = null;

    if (cfg.kind === 'spin') this._initSpin();
  }

  // Spin Arena: persistente, rotierende Speichen.
  _initSpin() {
    this._spinBeams = [];
    this._ensureSpinBeams();
  }
  _ensureSpinBeams() {
    const want = Math.min(this.cfg.maxBeams, this.cfg.beams(this.level));
    while (this._spinBeams.length < want) {
      const i = this._spinBeams.length;
      const angle = (i / Math.max(1, want)) * Math.PI * 2 + Math.random() * 0.4;
      const laser = new Laser({
        shape: 'spoke', persistent: true, groundY: this.groundY,
        length: this.cfg.radius, halfWidth: this.cfg.halfWidth,
        angle, angularSpeed: this.cfg.angularSpeed(this.level) * (i % 2 ? -1 : 1),
        reducedFx: this.reducedFx,
      });
      this.group.add(laser.group);
      this._spinBeams.push(laser);
      this.lasers.push(laser);
    }
    // Tempo aller Speichen an das aktuelle Level anpassen.
    for (let i = 0; i < this._spinBeams.length; i++) {
      const sign = i % 2 ? -1 : 1;
      this._spinBeams[i].angularSpeed = this.cfg.angularSpeed(this.level) * sign;
    }
  }

  update(dt) {
    this.elapsed += dt;
    // Level-Anstieg alle cfg.levelEvery Sekunden.
    const newLevel = 1 + Math.floor(this.elapsed / this.cfg.levelEvery);
    if (newLevel > this.level) {
      this.level = newLevel;
      this.sfx('laserSpeedUp');
      if (this.onLevelUp) this.onLevelUp(this.level);
      if (this.cfg.kind === 'spin') this._ensureSpinBeams();
    }

    if (this.cfg.kind !== 'spin') {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this._spawnTimed();
        this.spawnTimer = this.cfg.interval(this.level);
      }
    }

    const onFire = (laser) => {
      this.sfx('laserFire');
      const e = laser.endpoints ? laser.endpoints() : null;
      if (e) this.sparks.burst((e.ax + e.bx) / 2, this.groundY + BEAM_Y, (e.az + e.bz) / 2);
      else if (laser.o.shape === 'zone') this.sparks.burst(laser.o.x, this.groundY + 0.6, laser.o.z);
    };

    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const l = this.lasers[i];
      l.update(dt, onFire);
      if (l.dead) {
        this.group.remove(l.group);
        l.dispose();
        this.lasers.splice(i, 1);
      }
    }
    this.sparks.update(dt);
  }

  _spawnTimed() {
    const cfg = this.cfg;
    let laser;
    if (cfg.kind === 'lane') {
      const axis = Math.random() < 0.5 ? 'x' : 'z';
      const half = axis === 'x' ? cfg.hd : cfg.hw; // Position quer zur Strahlrichtung
      const span = (half - cfg.margin) * (Math.random() * 2 - 1);
      laser = new Laser({
        shape: 'lane', axis, pos: span, length: cfg.beamLength,
        groundY: this.groundY, halfWidth: cfg.halfWidth,
        warnTime: cfg.warn(this.level), activeTime: cfg.active, cooldownTime: 0.3,
        reducedFx: this.reducedFx,
      });
    } else { // zone
      const z = cfg.zones[Math.floor(Math.random() * cfg.zones.length)];
      laser = new Laser({
        shape: 'zone', x: z.x, z: z.z, w: z.w, d: z.d,
        groundY: this.groundY, halfWidth: 0,
        warnTime: cfg.warn(this.level), activeTime: cfg.active, cooldownTime: 0.3,
        reducedFx: this.reducedFx,
      });
    }
    this.group.add(laser.group);
    this.lasers.push(laser);
    this.sfx('laserWarn');
  }

  // Treffer prüfen: liefert Liste getroffener Spieler (nur verwundbare; die
  // Invuln-Logik liegt im Spielkern). players: [{ x, z, alive, invuln, ref }]
  checkHits(players, radius) {
    const hit = [];
    for (const p of players) {
      if (!p.alive || p.invuln > 0) continue;
      for (const l of this.lasers) {
        if (l.hits(p.x, p.z, radius)) { hit.push(p); break; }
      }
    }
    return hit;
  }

  // Bot-Gefahr an (x,z): stärkste sichtbare Bedrohung in Reichweite.
  // Liefert { point:{x,z}, dist, active } der nächsten Gefahr oder null.
  dangerFor(x, z, range = 6) {
    let best = null;
    for (const l of this.lasers) {
      const tp = l.threatPoint(x, z);
      if (!tp) continue;
      const d = Math.hypot(x - tp.x, z - tp.z);
      if (d > range) continue;
      // aktive Laser höher gewichten als bloße Warnungen
      const score = d - (tp.active ? 2.5 : 0);
      if (!best || score < best.score) best = { point: { x: tp.x, z: tp.z }, dist: d, active: tp.active, score };
    }
    return best;
  }

  dispose() {
    for (const l of this.lasers) l.dispose();
    this.lasers = [];
    this.sparks.dispose();
  }
}
