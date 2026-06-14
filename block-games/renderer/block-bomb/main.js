// Block Bomb — Spielkern (3D-Runde).
//
// Verantwortlich für: Three.js-Szene/Renderer/Kamera/Licht, Map laden, Figuren
// + Controller anlegen, die Spielschleife (mit FPS-Limit + „Animationen
// reduzieren"), die Bomben-Weitergabe-Mechanik (Last-Man-Standing) und das
// HUD (Namen über den Köpfen, Timer, verbleibende Spieler, Meldungen).
//
// Der Kern liest pro Frame NUR den Bewegungs-Intent jedes Controllers
// (controllers.js) — er unterscheidet nicht zwischen Mensch, Bot und (später)
// entferntem Spieler. Genau das macht späteres Online-Spiel zum reinen
// Controller-Tausch.
//
// Brücke zu app.js: app.js ruft window.BlockBomb.start(config). config liefert
// entkoppelt alles Nötige (Spieler mit Hex-Farbe, Map, Callbacks, Settings-
// Zugriff per Funktion), damit dieses Modul die Lobby/Settings nicht kennt.
//
//   start(config) — config:
//     host        DOM-Element, in das Canvas + HUD gehängt werden
//     players     [{ id, name, colorHex, type, difficulty, isLocal }]
//     mapId       'arena' | 'sky' | 'factory'
//     fpsLimit()  → Zahl (0 = unbegrenzt)
//     reducedFx() → bool
//     sfx(name)   Soundeffekt abspielen
//     onResult(winner) — winner = { name, colorHex } | null
//     onExit()    — (vom Pausemenü, von app.js getriggert)

'use strict';

import * as THREE from '../vendor/three.module.js';
import { BlockCharacter } from './characters.js';
import { Bomb } from './bomb.js';
import { buildMap, BOMB_MAPS } from './maps.js';
import { LocalHumanController, BotController, RemoteController } from './controllers.js';

const SPEED = 6.4;        // Basistempo (gleich für alle — Fairness)
const PLAYER_R = 0.55;    // Kollisionsradius
const PASS_DIST = 1.3;    // Abstand für Bombenübergabe
const PASS_COOLDOWN = 0.75;

class BlockBombGame {
  constructor(config) {
    this.config = config;
    this.host = config.host;
    this.running = false;
    this.paused = false;
    this.ended = false;
    this.last = 0;
    this.tickAcc = 0;
    this.shake = 0;
    this.introActive = true;
    this.introT = 0;
    this.introDuration = 2.2;
    this.introEl = null;

    this._initThree();
    this._initMap();
    this._initPlayers();
    this._initHud();   // vor _initBomb: _assignBomb() nutzt das HUD (_message)
    this._initBomb();
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
  }

  // ── Three.js-Grundgerüst ───────────────────────────────────────────
  _initThree() {
    const reduced = this.config.reducedFx();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d0f1c);
    this.scene.fog = new THREE.Fog(0x0d0f1c, 28, 52);

    const w = this.host.clientWidth || window.innerWidth;
    const h = this.host.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(52, w / h, 0.1, 120);
    this.camBase = new THREE.Vector3(0, 18, 18);
    const overviewScale = 1.9;
    this.camOverview = new THREE.Vector3(
      this.camBase.x * overviewScale,
      this.camBase.y * overviewScale + 6,
      this.camBase.z * overviewScale,
    );
    this.camera.position.copy(this.camBase);
    this.camera.lookAt(0, 1, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: !reduced, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, reduced ? 1 : 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = !reduced;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'bomb-canvas';
    this.host.appendChild(this.canvas);

    this.scene.add(new THREE.AmbientLight(0x8088aa, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(12, 24, 10);
    if (!reduced) {
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      const s = 24;
      key.shadow.camera.left = -s; key.shadow.camera.right = s;
      key.shadow.camera.top = s; key.shadow.camera.bottom = -s;
      key.shadow.camera.far = 80;
    }
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x4db5ff, 0.4);
    rim.position.set(-10, 8, -12);
    this.scene.add(rim);
  }

  _initMap() {
    this.map = buildMap(this.config.mapId, this.config.reducedFx());
    this.scene.add(this.map.group);
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
      if (p.isLocal && p.type === 'human') controller = new LocalHumanController();
      else if (p.type === 'remote') controller = new RemoteController(p.id);
      else controller = new BotController(p.difficulty || 'medium');
      if (controller.attach) controller.attach();

      return {
        id: p.id, name: p.name, colorHex: p.colorHex, isLocal: !!p.isLocal,
        controller, char,
        x: spawn.x, z: spawn.z, facing: 0,
        alive: true, isHolder: false, falling: false, fallT: 0,
      };
    });
    this.aliveStart = this.players.length;
  }

  _initBomb() {
    this.bomb = new Bomb(this.config.reducedFx());
    this.scene.add(this.bomb.group);
    this._assignBomb(this.players[Math.floor(Math.random() * this.players.length)], true);
    this.timeLeft = this._roundTime();
    this.passCooldown = 0.4;
  }

  _roundTime() {
    const gone = this.aliveStart - this._alivePlayers().length;
    return Math.max(5, 11 - gone * 1.6);
  }

  _assignBomb(player, silent) {
    for (const p of this.players) { p.isHolder = false; p.char.setHolderGlow(false); }
    player.isHolder = true;
    player.char.setHolderGlow(true);
    this.holderId = player.id;
    if (!silent) { player.char.flash(); this.config.sfx('bombPass'); }
    this._message(`${player.name} hat die Bombe!`);
  }

  // ── HUD ─────────────────────────────────────────────────────────────
  _initHud() {
    const hud = document.createElement('div');
    hud.className = 'bomb-hud';
    hud.innerHTML = `
      <div class="bomb-top">
        <div class="bomb-remaining" id="bombRemaining"></div>
        <div class="bomb-timer" id="bombTimer"><span class="bomb-timer-icon">💣</span><span id="bombTimerNum">0.0</span>s</div>
      </div>
      <div class="bomb-message" id="bombMessage"></div>
      <div class="bomb-labels" id="bombLabels"></div>`;
    this.host.appendChild(hud);
    this.hud = hud;
    this.elTimer = hud.querySelector('#bombTimerNum');
    this.elTimerBox = hud.querySelector('#bombTimer');
    this.elRemaining = hud.querySelector('#bombRemaining');
    this.elMessage = hud.querySelector('#bombMessage');
    this.elLabels = hud.querySelector('#bombLabels');

    this.labels = new Map();
    for (const p of this.players) {
      const el = document.createElement('div');
      el.className = 'bomb-name-label';
      el.style.setProperty('--c', p.colorHex);
      el.textContent = p.name;
      this.elLabels.appendChild(el);
      this.labels.set(p.id, el);
    }
    this._renderRemaining();
  }

  _renderRemaining() {
    this.elRemaining.innerHTML = this.players.map(p =>
      `<span class="bomb-chip ${p.alive ? '' : 'dead'}" style="--c:${p.colorHex}">${p.name}</span>`
    ).join('');
  }

  _message(text) {
    this.elMessage.textContent = text;
    this.elMessage.classList.remove('show');
    // Reflow, damit die Animation neu startet.
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
    this._showMapIntro();
  }

  _updateIntro(dt) {
    this.introT += dt;
    const t = Math.min(1, this.introT / this.introDuration);
    const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
    this.camera.position.lerpVectors(this.camOverview, this.camBase, eased);
    this.camera.lookAt(0, 1, 0);
    if (t >= 1) {
      this.introActive = false;
      this.camera.position.copy(this.camBase);
      this._hideMapIntro();
    }
  }

  _showMapIntro() {
    const meta = BOMB_MAPS.find(m => m.id === this.config.mapId);
    const el = document.createElement('div');
    el.className = 'bomb-map-intro-name';
    el.textContent = meta ? meta.name : '';
    this.host.appendChild(el);
    this.introEl = el;
    requestAnimationFrame(() => el.classList.add('show'));
  }

  _hideMapIntro() {
    if (!this.introEl) return;
    const el = this.introEl;
    el.classList.remove('show');
    el.classList.add('hide');
    setTimeout(() => el.remove(), 600);
    this.introEl = null;
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
    if (fps > 0 && elapsed < 1000 / fps - 0.5) return; // FPS-Limit
    this.last = now;
    const dt = Math.min(0.05, elapsed / 1000);

    if (this.introActive) {
      this._updateIntro(dt);
    } else if (!this.paused && this.running) {
      this._step(dt);
    }
    this._animate(dt);
    this.renderer.render(this.scene, this.camera);
    this._updateLabels();
  }

  // Spiel-Logik (nur wenn nicht pausiert / beendet)
  _step(dt) {
    if (this.map.update) this.map.update(dt);

    // Timer
    this.timeLeft -= dt;
    const urgency = 1 - Math.max(0, Math.min(1, this.timeLeft / 6));
    this.bomb.setUrgency(urgency);
    this._tickSound(dt, urgency);
    this.elTimer.textContent = Math.max(0, this.timeLeft).toFixed(1);
    this.elTimerBox.classList.toggle('urgent', this.timeLeft < 3);

    // Bewegung aller lebenden Figuren
    const world = this._world();
    for (const p of this.players) {
      if (!p.alive) { if (p.falling) this._updateFall(p, dt); continue; }
      const intent = p.controller.update(p, world, dt) || { x: 0, z: 0 };
      let vx = intent.x * SPEED, vz = intent.z * SPEED;
      const push = this.map.conveyor(p.x, p.z);
      vx += push.x; vz += push.z;
      const nx = p.x + vx * dt, nz = p.z + vz * dt;
      const r = this.map.resolve(nx, nz, PLAYER_R);
      if (r.fell) { this._fall(p); continue; }
      p.x = r.x; p.z = r.z;
      if (intent.x || intent.z) p.facing = Math.atan2(intent.x, intent.z);
      p.char.group.position.x = p.x;
      p.char.group.position.z = p.z;
      p._speed01 = Math.min(1, Math.hypot(vx, vz) / SPEED);
    }

    // Bombenübergabe bei Berührung
    if (this.passCooldown > 0) this.passCooldown -= dt;
    const holder = this.players.find(p => p.id === this.holderId && p.alive);
    if (holder && this.passCooldown <= 0) {
      for (const p of this.players) {
        if (!p.alive || p === holder) continue;
        const d = Math.hypot(p.x - holder.x, p.z - holder.z);
        if (d < PASS_DIST) {
          this._assignBomb(p, false);
          this.passCooldown = PASS_COOLDOWN;
          this._message('Bombe weitergegeben!');
          break;
        }
      }
    }

    // Bombe über dem Kopf des Trägers
    if (holder) {
      this.bomb.group.position.set(holder.x, this.map.groundY + 2.5, holder.z);
    }

    // Explosion bei Ablauf
    if (this.timeLeft <= 0 && !this.ended) this._explodeHolder();
  }

  _tickSound(dt, urgency) {
    this.tickAcc -= dt;
    if (this.tickAcc <= 0) {
      this.config.sfx('bombTick');
      this.tickAcc = 0.6 - urgency * 0.48; // 0.6s → 0.12s
    }
  }

  _explodeHolder() {
    const holder = this.players.find(p => p.id === this.holderId && p.alive);
    if (!holder) return;
    holder.alive = false;
    holder.isHolder = false;
    holder.char.explode();
    this.config.sfx('bombExplode');
    this.shake = 0.6;
    this.bomb.group.visible = false;
    this._message(`${holder.name} ist explodiert!`);
    this._renderRemaining();
    this._afterElimination();
  }

  _fall(p) {
    if (!p.alive) return;
    p.alive = false;
    p.falling = true;
    p.fallT = 0;
    const wasHolder = p.isHolder;
    p.isHolder = false;
    this.config.sfx('bombExplode');
    this._message(`${p.name} ist abgestürzt!`);
    this._renderRemaining();
    if (wasHolder) this.bomb.group.visible = false;
    this._afterElimination(wasHolder);
  }

  _updateFall(p, dt) {
    p.fallT += dt;
    p.char.group.position.y -= dt * (6 + p.fallT * 10);
    p.char.group.rotation.z += dt * 4;
    if (p.fallT > 1.4) { p.char.group.visible = false; p.falling = false; }
  }

  _afterElimination(wasHolder = true) {
    const alive = this._alivePlayers();
    if (alive.length <= 1) {
      this._finish(alive[0] || null);
      return;
    }
    // Neue Bombenrunde: neuer Zufallsträger unter den Überlebenden.
    setTimeout(() => {
      if (this.ended) return;
      this.bomb.group.visible = true;
      const next = alive[Math.floor(Math.random() * alive.length)];
      this._assignBomb(next, true);
      this.timeLeft = this._roundTime();
      this.passCooldown = 0.5;
    }, 900);
  }

  _finish(winner) {
    if (this.ended) return;
    this.ended = true;
    this.running = false;
    if (winner) {
      this._message(`${winner.name} gewinnt!`);
      this.config.sfx('go');
      // kleiner Siegeshüpfer
      winner._victory = true;
    } else {
      this._message('Unentschieden!');
    }
    setTimeout(() => {
      this.config.onResult(winner ? { name: winner.name, colorHex: winner.colorHex } : null);
    }, 1400);
  }

  // ── reine Optik (läuft auch in der End-/Siegesphase) ────────────────
  _animate(dt) {
    for (const p of this.players) {
      if (p.char.exploding) { p.char.update(dt); continue; }
      if (p.falling) continue;
      let sp = p._speed01 || 0;
      if (p._victory) { p.char.group.position.y = this.map.groundY + Math.abs(Math.sin(performance.now() / 140)) * 0.6; sp = 1; }
      p.char.update(dt, p.facing, sp, p.isHolder);
    }
    this.bomb.update(dt);

    // Kamera-Shake nach Explosion
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
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
      if (!p.alive) { el.style.display = 'none'; continue; }
      el.style.display = '';
      v.set(p.x, this.map.groundY + 2.4, p.z).project(this.camera);
      const sx = (v.x * 0.5 + 0.5) * w;
      const sy = (-v.y * 0.5 + 0.5) * h;
      el.style.transform = `translate(-50%,-100%) translate(${sx}px,${sy}px)`;
      el.classList.toggle('holder', p.isHolder);
      if (p.debug) {
        el.textContent = `${p.name} [${p.debug.state}${p.debug.stuck ? '!' : ''}]`;
      } else if (el.textContent !== p.name) {
        el.textContent = p.name;
      }
    }
  }

  _world() {
    return {
      players: this.players.map(p => ({ id: p.id, x: p.x, z: p.z, alive: p.alive, isHolder: p.isHolder })),
      holderId: this.holderId,
      timeLeft: this.timeLeft,
      map: this.map,
      obstacles: this.map.obstacles || [],
      radius: PLAYER_R,
      speed: SPEED,
    };
  }

  _alivePlayers() { return this.players.filter(p => p.alive); }

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
    if (this.bomb) this.bomb.dispose();
    for (const p of this.players) p.char.dispose();
    if (this.renderer) { this.renderer.dispose(); }
    if (this.introEl) { this.introEl = null; }
    if (this.host) this.host.innerHTML = '';
  }
}

let current = null;
window.BlockBomb = {
  start(config) {
    if (current) current.destroy();
    current = new BlockBombGame(config);
    current.begin();
    return current;
  },
  pause() { if (current) current.pause(); },
  resume() { if (current) current.resume(); },
  stop() { if (current) { current.destroy(); current = null; } },
  isRunning() { return !!current && current.running; },
};
