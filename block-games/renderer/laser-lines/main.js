// Laser Lines — Spielkern (3D-Runde).
//
// Schnelles Party-Minigame: Laserlinien fahren/rotieren über die Map. Wer
// getroffen wird, verliert ein Leben (kurze Unverwundbarkeit + Blinken). Bei 0
// Leben scheidet man aus — der letzte Überlebende gewinnt. Erreicht die Runde
// das Zeitlimit, gewinnt der Spieler mit den meisten Leben.
//
// Wie Block Bomb liest der Kern pro Frame NUR den Bewegungs-Intent jedes
// Controllers (../game/controllers.js) — Mensch/Bot/Remote sind austauschbar.
// Die Lobby kennt der Kern NICHT; app.js reicht eine entkoppelte matchConfig.
//
//   start(config) — config:
//     host        DOM-Element für Canvas + HUD
//     players     [{ id, name, colorHex, type, difficulty, isLocal }]
//     mapId       'spin' | 'grid' | 'sky'
//     fpsLimit()  → Zahl (0 = unbegrenzt)
//     reducedFx() → bool
//     sfx(name)   Soundeffekt
//     onResult(result) — result = { winner, placements } (1.→letzter)
//     onExit()    — vom Pausemenü (von app.js getriggert)

'use strict';

import * as THREE from '../vendor/three.module.js';
import { BlockCharacter } from '../game/characters.js';
import { LocalHumanController, BotController, RemoteController } from '../game/controllers.js';
import { buildMap, LASER_MAP_META } from './maps.js';
import { LaserDirector } from './lasers.js';
import { makeLaserBotBrain } from './bots.js';

const SPEED = 6.4;        // Basistempo (gleich für alle — Fairness)
const PLAYER_R = 0.55;    // Kollisionsradius
const START_LIVES = 3;
const INVULN = 1.5;       // Sekunden Unverwundbarkeit nach Treffer
const ROUND_TIME = 60;    // Sekunden bis Zeitlimit

class LaserLinesGame {
  constructor(config) {
    this.config = config;
    this.host = config.host;
    // Online-Sessions (siehe app.js/net/session.js): 'host' simuliert normal
    // UND liefert getSnapshot() zum Broadcasten; 'guest' überspringt Physik/
    // Regeln komplett und rendert nur, was applySnapshot() liefert.
    this.role = config.role === 'guest' ? 'guest' : 'host';
    this._netSnap = null;
    this._myIntent = { x: 0, z: 0 };
    this.running = false;
    this.paused = false;
    this.ended = false;
    this.last = 0;
    this.shake = 0;
    this.timeLeft = ROUND_TIME;
    this.introActive = true;
    this.introT = 0;
    this.introDuration = 2.2;
    this.introEl = null;
    this.eliminationOrder = [];

    this._initThree();
    this._initMap();
    this._initPlayers();
    this._initHud();
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
  }

  // ── Three.js-Grundgerüst ───────────────────────────────────────────
  _initThree() {
    const reduced = this.config.reducedFx();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c0a18);
    this.scene.fog = new THREE.Fog(0x0c0a18, 30, 56);

    const w = this.host.clientWidth || window.innerWidth;
    const h = this.host.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(52, w / h, 0.1, 120);
    this.camBase = new THREE.Vector3(0, 19, 19);
    const s = 1.9;
    this.camOverview = new THREE.Vector3(this.camBase.x * s, this.camBase.y * s + 6, this.camBase.z * s);
    this.camera.position.copy(this.camBase);
    this.camera.lookAt(0, 1, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: !reduced, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, reduced ? 1 : 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = !reduced;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'laser-canvas';
    this.host.appendChild(this.canvas);

    this.scene.add(new THREE.AmbientLight(0x8a82b0, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(10, 24, 12);
    if (!reduced) {
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      const sz = 24;
      key.shadow.camera.left = -sz; key.shadow.camera.right = sz;
      key.shadow.camera.top = sz; key.shadow.camera.bottom = -sz;
      key.shadow.camera.far = 80;
    }
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xff5bd0, 0.35);
    rim.position.set(-10, 8, -12);
    this.scene.add(rim);
  }

  _initMap() {
    const reduced = this.config.reducedFx();
    this.map = buildMap(this.config.mapId, reduced);
    this.scene.add(this.map.group);
    this.director = new LaserDirector(
      this.map.laserConfig, this.map.groundY, this.scene, reduced,
      (name) => this.config.sfx(name),
    );
    this.director.onLevelUp = (lvl) => { if (this.elLevel) this.elLevel.textContent = 'Tempo ' + lvl; };
    this.scene.add(this.director.group);
  }

  _initPlayers() {
    const reduced = this.config.reducedFx();
    this.players = this.config.players.map((p, i) => {
      const char = new BlockCharacter(p.colorHex, reduced);
      char.setGroundY(this.map.groundY);
      this.scene.add(char.group);
      const spawn = this.map.spawns[i % this.map.spawns.length];
      char.group.position.set(spawn.x, this.map.groundY, spawn.z);

      let controller;
      if (p.isLocal && p.type === 'human') controller = new LocalHumanController(p.keys || 'wasd');
      else if (p.type === 'remote') controller = new RemoteController(p.peerId || p.id);
      else controller = new BotController(makeLaserBotBrain(p.difficulty || 'medium'));
      if (controller.attach) controller.attach();

      return {
        id: p.id, name: p.name, colorHex: p.colorHex, isLocal: !!p.isLocal,
        controller, char,
        x: spawn.x, z: spawn.z, facing: 0,
        alive: true, lives: START_LIVES, invuln: 0, eliminated: false,
        lastHitT: -1,
      };
    });
    this.aliveStart = this.players.length;
  }

  // ── HUD ─────────────────────────────────────────────────────────────
  _initHud() {
    const hud = document.createElement('div');
    hud.className = 'laser-hud';
    hud.innerHTML = `
      <div class="laser-top">
        <div class="laser-lives" id="laserLives"></div>
        <div class="laser-info">
          <div class="laser-title">⚡ Laser Lines</div>
          <div class="laser-meta"><span class="laser-level" id="laserLevel">Tempo 1</span> · <span class="laser-timer" id="laserTimer">0.0</span>s</div>
        </div>
      </div>
      <div class="laser-warn" id="laserWarn">⚠ Laser incoming!</div>
      <div class="laser-message" id="laserMessage"></div>
      <div class="laser-labels" id="laserLabels"></div>
      <div class="laser-vignette" id="laserVignette"></div>`;
    this.host.appendChild(hud);
    this.hud = hud;
    this.elLives = hud.querySelector('#laserLives');
    this.elTimer = hud.querySelector('#laserTimer');
    this.elLevel = hud.querySelector('#laserLevel');
    this.elWarn = hud.querySelector('#laserWarn');
    this.elMessage = hud.querySelector('#laserMessage');
    this.elLabels = hud.querySelector('#laserLabels');
    this.elVignette = hud.querySelector('#laserVignette');

    this.elTimer.textContent = this.timeLeft.toFixed(1); // Startwert (während Intro)

    this.labels = new Map();
    for (const p of this.players) {
      const el = document.createElement('div');
      el.className = 'laser-name-label';
      el.style.setProperty('--c', p.colorHex);
      el.textContent = p.name;
      this.elLabels.appendChild(el);
      this.labels.set(p.id, el);
    }
    this._renderLives();
  }

  _renderLives() {
    this.elLives.innerHTML = this.players.map(p => {
      const hearts = p.eliminated
        ? '<span class="laser-life-out">✕</span>'
        : '♥'.repeat(p.lives) + '<span class="laser-life-lost">' + '♡'.repeat(START_LIVES - p.lives) + '</span>';
      return `<span class="laser-chip ${p.eliminated ? 'dead' : ''}" style="--c:${p.colorHex}">
        <span class="laser-chip-name">${p.name}</span><span class="laser-chip-lives">${hearts}</span></span>`;
    }).join('');
  }

  _message(text) {
    this.elMessage.textContent = text;
    this.elMessage.classList.remove('show');
    void this.elMessage.offsetWidth;
    this.elMessage.classList.add('show');
  }

  // ── Lebenszyklus ────────────────────────────────────────────────────
  begin() {
    this.running = true;
    this.last = performance.now();
    this._resize();
    this._startIntro();
    this.raf = requestAnimationFrame((t) => this._loop(t));
  }

  _startIntro() {
    this.introActive = true;
    this.introT = 0;
    this.camera.position.copy(this.camOverview);
    this.camera.lookAt(0, 1, 0);
    const meta = LASER_MAP_META.find(m => m.id === this.config.mapId);
    const el = document.createElement('div');
    el.className = 'laser-map-intro-name';
    el.textContent = meta ? meta.name : '';
    this.host.appendChild(el);
    this.introEl = el;
    requestAnimationFrame(() => el.classList.add('show'));
  }

  _updateIntro(dt) {
    this.introT += dt;
    const t = Math.min(1, this.introT / this.introDuration);
    const eased = 1 - Math.pow(1 - t, 3);
    this.camera.position.lerpVectors(this.camOverview, this.camBase, eased);
    this.camera.lookAt(0, 1, 0);
    if (t >= 1) {
      this.introActive = false;
      this.camera.position.copy(this.camBase);
      if (this.introEl) {
        const el = this.introEl;
        el.classList.remove('show'); el.classList.add('hide');
        setTimeout(() => el.remove(), 600);
        this.introEl = null;
      }
    }
  }

  pause() {
    if (this.ended) return;
    this.paused = true;
    for (const p of this.players) if (p.controller.clear) p.controller.clear();
  }
  resume() {
    if (this.ended) return;
    this.paused = false;
    this.last = performance.now();
  }

  _loop(now) {
    this.raf = requestAnimationFrame((t) => this._loop(t));
    const elapsed = now - this.last;
    const fps = this.config.fpsLimit();
    if (fps > 0 && elapsed < 1000 / fps - 0.5) return;
    this.last = now;
    const dt = Math.min(0.05, elapsed / 1000);

    if (this.introActive) this._updateIntro(dt);
    else if (!this.paused && this.running) {
      if (this.role === 'guest') this._stepReplica(dt);
      else this._step(dt);
    }

    this._animate(dt);
    this.renderer.render(this.scene, this.camera);
    this._updateLabels();
  }

  _step(dt) {
    if (this.map.update) this.map.update(dt);
    this.director.update(dt);

    // Timer
    this.timeLeft -= dt;
    this.elTimer.textContent = Math.max(0, this.timeLeft).toFixed(1);

    // Warnbanner: sichtbar, wenn ein Laser gerade in der Warnphase ist.
    const warning = this.director.lasers.some(l => l.state === 'warning');
    this.elWarn.classList.toggle('show', warning);

    // Bewegung aller lebenden Figuren
    const world = this._world();
    for (const p of this.players) {
      if (!p.alive) continue;
      if (p.invuln > 0) {
        p.invuln = Math.max(0, p.invuln - dt);
        if (p.invuln === 0) p.char.setInvulnBlink(false);
      }
      const intent = p.controller.update(p, world, dt) || { x: 0, z: 0 };
      const vx = intent.x * SPEED, vz = intent.z * SPEED;
      const nx = p.x + vx * dt, nz = p.z + vz * dt;
      const r = this.map.resolve(nx, nz, PLAYER_R);
      if (r.fell) { this._hit(p, true); continue; }
      p.x = r.x; p.z = r.z;
      if (intent.x || intent.z) p.facing = Math.atan2(intent.x, intent.z);
      p.char.group.position.x = p.x;
      p.char.group.position.z = p.z;
      p._speed01 = Math.min(1, Math.hypot(vx, vz) / SPEED);
    }

    // Laser-Treffer
    const data = this.players.map(p => ({ ref: p, x: p.x, z: p.z, alive: p.alive, invuln: p.invuln }));
    const hits = this.director.checkHits(data, PLAYER_R);
    for (const d of hits) this._hit(d.ref, false);

    // Zeitlimit
    if (this.timeLeft <= 0 && !this.ended) this._finishByTime();
  }

  // ── Gast-Wiedergabe (Online-Session) ────────────────────────────────
  // Wie bei Block Bomb: keine Physik/Regeln, nur weiches Nachziehen zum
  // letzten Host-Snapshot. `extra` trägt hier die Lebenszahl (0–3) statt
  // eines Bomben-Flags — Laser-Warnbanner/-Treffer selbst werden für Gäste
  // in v1 NICHT repliziert (rein kosmetisch, s. DOKUMENTATION.md), nur
  // Position/Facing/Leben/Ausscheiden.
  _stepReplica(dt) {
    const world = this._world();
    for (const p of this.players) {
      if (p.isLocal) this._myIntent = p.controller.update(p, world, dt) || { x: 0, z: 0 };
    }
    if (!this._netSnap) return;

    this.timeLeft = this._netSnap.timeLeft;
    this.elTimer.textContent = Math.max(0, this.timeLeft).toFixed(1);

    const lerp = Math.min(1, dt * 12);
    const byId = new Map(this._netSnap.p.map(row => [row[0], row]));
    let livesChanged = false;
    for (const p of this.players) {
      const row = byId.get(p.id);
      if (!row) continue;
      const [, x, z, facing, flags, lives] = row;
      const wasAlive = p.alive;
      p.alive = !!(flags & 1);
      p.x += (x - p.x) * lerp; p.z += (z - p.z) * lerp;
      p.char.group.position.x = p.x; p.char.group.position.z = p.z;
      p.facing = facing;
      if (p.lives !== lives) { p.lives = lives; livesChanged = true; }
      if (wasAlive && !p.alive) {
        p.eliminated = true;
        p.char.setEliminated(true);
        this.config.sfx('laserEliminate');
        livesChanged = true;
      }
    }
    if (livesChanged) this._renderLives();
  }

  // Host: kompakter Stand für den 20Hz-Broadcast. Flags-Bitfeld: 1 = lebt
  // (2 bleibt reserviert/ungenutzt, s. Block Bomb); `extra` = Lebenszahl.
  getSnapshot() {
    return {
      timeLeft: Math.round(this.timeLeft * 10) / 10,
      p: this.players.map(p => [
        p.id, Math.round(p.x * 100) / 100, Math.round(p.z * 100) / 100,
        Math.round(p.facing * 100) / 100, (p.alive ? 1 : 0), p.lives,
      ]),
    };
  }
  applySnapshot(payload) { this._netSnap = payload; }
  feedRemoteInput(peerId, intent) {
    const p = this.players.find(pl => pl.controller && pl.controller.peerId === peerId);
    if (p) p.controller.feed(intent);
  }
  getMyInput() { return this._myIntent; }

  // Host: verlorene Verbindung eines Online-Mitspielers → Bot übernimmt.
  convertToBot(peerId) {
    const p = this.players.find(pl => pl.controller && pl.controller.peerId === peerId);
    if (!p) return;
    if (p.controller.detach) p.controller.detach();
    p.controller = new BotController(makeLaserBotBrain('medium'));
  }

  // Treffer (Laser oder Sturz). fromFall=true ⇒ zurück auf sicheren Punkt.
  _hit(p, fromFall) {
    if (!p.alive || p.invuln > 0) return;
    p.lives -= 1;
    p.invuln = INVULN;
    p.lastHitT = performance.now();
    p.char.setInvulnBlink(true);
    this.config.sfx('laserHit');
    this.shake = this.config.reducedFx() ? 0.18 : 0.45;
    this._flashVignette();
    this._renderLives();

    if (fromFall) {
      const rp = this.map.respawn ? this.map.respawn(p.x, p.z) : (this.map.spawns[0] || { x: 0, z: 0 });
      p.x = rp.x; p.z = rp.z;
      p.char.group.position.set(p.x, this.map.groundY, p.z);
      this._message(`${p.name} ist abgestürzt!`);
    } else {
      this._message(`${p.name} getroffen!`);
    }

    if (p.lives <= 0) this._eliminate(p);
  }

  _eliminate(p) {
    p.alive = false;
    p.eliminated = true;
    p.invuln = 0;
    p.char.setInvulnBlink(false);
    p.char.setEliminated(true);
    this.eliminationOrder.push(p);
    this.config.sfx('laserEliminate');
    this._message(`${p.name} ist ausgeschieden!`);
    this._renderLives();
    const alive = this.players.filter(q => q.alive);
    if (alive.length <= 1) this._finish();
  }

  _flashVignette() {
    if (this.config.reducedFx()) return;
    this.elVignette.classList.remove('show');
    void this.elVignette.offsetWidth;
    this.elVignette.classList.add('show');
  }

  _finishByTime() {
    this._finish();
  }

  // Ergebnis: Überlebende nach Leben (Gleichstand → zuletzt getroffen, sonst
  // zufällig), dann die Ausgeschiedenen in umgekehrter Reihenfolge.
  _finish() {
    if (this.ended) return;
    this.ended = true;
    this.running = false;

    const alive = this.players.filter(p => p.alive);
    alive.sort((a, b) => {
      if (b.lives !== a.lives) return b.lives - a.lives;
      if (b.lastHitT !== a.lastHitT) return b.lastHitT - a.lastHitT; // zuletzt getroffen gewinnt
      return Math.random() - 0.5;
    });
    const elimRev = [...this.eliminationOrder].reverse();
    const ordered = [...alive, ...elimRev];

    const slim = (p) => ({ id: p.id, name: p.name, colorHex: p.colorHex });
    const placements = ordered.map(slim);
    const winner = ordered[0] || null;
    if (winner) {
      winner._victory = true;
      this._message(`${winner.name} gewinnt!`);
      this.config.sfx('laserWin');
    } else {
      this._message('Unentschieden!');
    }
    setTimeout(() => {
      this.config.onResult({ winner: winner ? slim(winner) : null, placements });
    }, 1400);
  }

  // ── reine Optik ─────────────────────────────────────────────────────
  _animate(dt) {
    for (const p of this.players) {
      if (p.eliminated) {
        // langsam absinken (in den Boden), bleibt grau sichtbar
        p.char.group.position.y = Math.max(this.map.groundY - 0.6, p.char.group.position.y - dt * 0.6);
        continue;
      }
      let sp = p._speed01 || 0;
      if (p._victory) { p.char.group.position.y = this.map.groundY + Math.abs(Math.sin(performance.now() / 140)) * 0.6; sp = 1; }
      p.char.update(dt, p.facing, sp, false);
    }

    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.2);
      const s = this.shake;
      this.camera.position.set(
        this.camBase.x + (Math.random() * 2 - 1) * s,
        this.camBase.y + (Math.random() * 2 - 1) * s,
        this.camBase.z + (Math.random() * 2 - 1) * s,
      );
      this.camera.lookAt(0, 1, 0);
    } else if (!this.introActive && this.camera.position.distanceToSquared(this.camBase) > 1e-4) {
      this.camera.position.copy(this.camBase);
      this.camera.lookAt(0, 1, 0);
    }
  }

  _updateLabels() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const v = new THREE.Vector3();
    for (const p of this.players) {
      const el = this.labels.get(p.id);
      v.set(p.x, this.map.groundY + 2.4, p.z).project(this.camera);
      const sx = (v.x * 0.5 + 0.5) * w;
      const sy = (-v.y * 0.5 + 0.5) * h;
      el.style.transform = `translate(-50%,-100%) translate(${sx}px,${sy}px)`;
      el.classList.toggle('eliminated', p.eliminated);
    }
  }

  _world() {
    return {
      players: this.players.map(p => ({ id: p.id, x: p.x, z: p.z, alive: p.alive })),
      map: this.map,
      obstacles: this.map.obstacles || [],
      radius: PLAYER_R,
      speed: SPEED,
      laserDanger: (x, z) => this.director.dangerFor(x, z, 7),
    };
  }

  _resize() {
    const w = this.host.clientWidth || window.innerWidth;
    const h = this.host.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  destroy() {
    this.running = false;
    this.ended = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this._onResize);
    for (const p of this.players) if (p.controller.detach) p.controller.detach();
    if (this.director) this.director.dispose();
    for (const p of this.players) p.char.dispose();
    if (this.renderer) this.renderer.dispose();
    if (this.introEl) this.introEl = null;
    if (this.host) this.host.innerHTML = '';
  }
}

let current = null;
window.LaserLines = {
  start(config) {
    if (current) current.destroy();
    current = new LaserLinesGame(config);
    current.begin();
    return current;
  },
  pause() { if (current) current.pause(); },
  resume() { if (current) current.resume(); },
  stop() { if (current) { current.destroy(); current = null; } },
  isRunning() { return !!current && current.running; },
  // ── Online-Sessions (app.js/net/session.js) ──────────────────────────
  getSnapshot() { return current ? current.getSnapshot() : null; },
  applySnapshot(payload) { if (current) current.applySnapshot(payload); },
  feedRemoteInput(peerId, intent) { if (current) current.feedRemoteInput(peerId, intent); },
  getMyInput() { return current ? current.getMyInput() : { x: 0, z: 0 }; },
  convertToBot(peerId) { if (current) current.convertToBot(peerId); },
};
