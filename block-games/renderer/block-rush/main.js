// Block Rush — Spielkern (3D-Runde).
//
// Tricky-Towers-artiges Party-Minigame: Alle Spieler bauen GLEICHZEITIG,
// nebeneinander in EINER Szene/Kamera, aus fallenden Blockteilen einen Turm
// auf ihrem eigenen Podest. Schlechte Balance lässt den Turm sichtbar kippen
// und einstürzen (eigene, vereinfachte Kippsimulation — KEINE Physik-Engine,
// s. tower.js). Wer einstürzt oder überläuft, scheidet sofort aus —
// Last-Man-Standing. Erreicht die Runde das Zeitlimit, gewinnt der höchste/
// stabilste Turm. Vier Spells (Kleber/Wachstum/Erdbeben/Blitzsturz) greifen
// ins eigene oder gegnerische Spiel ein. KEINE Line-Clears in v1 — der Turm
// wächst nur (vereinfacht Bot-Scoring UND Online-Snapshot).
//
// Wie Block Bomb/Laser Lines liest der Kern pro Frame NUR den Intent jedes
// Controllers (../game/controllers.js) — Mensch/Bot/Remote sind austauschbar.
// Das Genre braucht aber KEINEN {x,z}-Bewegungsintent, sondern einen
// Ereignis-Zähler seit der letzten Abfrage: { dx, rot, hard, cast, cycle,
// soft, seq }. Das ist nötig, weil app.js getMyInput() nur mit 20 Hz pollt —
// ein reiner Zustands-Intent würde Drehungen/Hard-Drops dazwischen
// verschlucken (s. LocalPieceController + RemoteController-Adapter in
// controllers.js).
//
//   start(config) — config:
//     host        DOM-Element für Canvas + HUD
//     players     [{ id, name, colorHex, type, difficulty, isLocal, keys, peerId }]
//     mapId       'halle' | 'sturm' | 'wippe'
//     fpsLimit()  → Zahl (0 = unbegrenzt)
//     reducedFx() → bool
//     sfx(name)   Soundeffekt
//     onResult(result) — result = { winner, placements } (1.→letzter)
//     onExit()    — vom Pausemenü (von app.js getriggert)

'use strict';

import * as THREE from '../vendor/three.module.js';
import { LocalPieceController, BotController, RemoteController } from '../game/controllers.js';
import { ROWS, CELL, Playfield, makeBag, hashSeed, PIECE_TYPES, PIECE_COLORS } from './pieces.js';
import { TowerSim } from './tower.js';
import { buildMap, BLOCK_RUSH_MAP_META } from './maps.js';
import { SpellSystem, SPELL_META } from './spells.js';
import { makeBlockRushBotBrain } from './bots.js';

const ROUND_TIME = 90; // Sekunden bis Zeitlimit (länger als Laser Lines — Stapeln ist langsamer als Ausweichen)

function round1(v) { return Math.round(v * 10) / 10; }
function round2(v) { return Math.round(v * 100) / 100; }

// Adapter für RemoteController (s. controllers.js): der Intent ist ein
// Ereignis-Zähler, kein {x,z} — Empfangenes wird AUFADDIERT statt ersetzt und
// erst beim Lesen (update()) geleert, damit auch bei verpassten Polls kein
// Tastendruck verloren geht.
const RUSH_REMOTE_ADAPTER = {
  initial: () => ({ dx: 0, rot: 0, hard: 0, cast: 0, cycle: 0, soft: false, seq: 0 }),
  merge: (pending, incoming) => ({
    dx: pending.dx + (incoming.dx || 0),
    rot: pending.rot + (incoming.rot || 0),
    hard: pending.hard + (incoming.hard || 0),
    cast: pending.cast + (incoming.cast || 0),
    cycle: pending.cycle + (incoming.cycle || 0),
    soft: !!incoming.soft,
    seq: incoming.seq || pending.seq,
  }),
  drain: (pending) => ({
    value: pending,
    next: { dx: 0, rot: 0, hard: 0, cast: 0, cycle: 0, soft: pending.soft, seq: pending.seq },
  }),
};

class BlockRushGame {
  constructor(config) {
    this.config = config;
    this.host = config.host;
    // Online-Sessions: 'host' simuliert normal UND liefert getSnapshot();
    // 'guest' überspringt Physik/Regeln, rendert nur applySnapshot()-Stand.
    this.role = config.role === 'guest' ? 'guest' : 'host';
    this._netSnap = null;
    this._myIntent = RUSH_REMOTE_ADAPTER.initial();
    this.running = false;
    this.paused = false;
    this.ended = false;
    this.last = 0;
    this.timeLeft = ROUND_TIME;
    this.introActive = true;
    this.introT = 0;
    this.introDuration = 2.2;
    this.introEl = null;
    this.eliminationOrder = [];
    this._envT = 0;
    // Seed aus den Spieler-IDs abgeleitet (keine Extra-Netz-Nachricht nötig —
    // Host und Gast kommen so ohne Protokolländerung auf dieselbe Teilefolge).
    this.roundSeed = hashSeed(config.players.map((p) => p.id).join('|'));

    this._initThree();
    this._initMap();
    this._initPlayers();
    this.spellSystem = new SpellSystem(this.players.map((p) => p.id));
    for (const p of this.players) p.spells = this.spellSystem.stateOf(p.id);
    this._initHud();
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
  }

  // ── Three.js-Grundgerüst ───────────────────────────────────────────
  _initThree() {
    const reduced = this.config.reducedFx();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c1220);
    this.scene.fog = new THREE.Fog(0x0c1220, 26, 54);

    const w = this.host.clientWidth || window.innerWidth;
    const h = this.host.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(46, w / h, 0.1, 120);
    this.camBase = new THREE.Vector3(0, 7.5, 18);
    const s = 1.7;
    this.camOverview = new THREE.Vector3(this.camBase.x * s, this.camBase.y * s + 5, this.camBase.z * s);
    this.camera.position.copy(this.camOverview);
    this.camera.lookAt(0, 1, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: !reduced, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, reduced ? 1 : 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = !reduced;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'rush-canvas';
    this.host.appendChild(this.canvas);
  }

  _initMap() {
    const reduced = this.config.reducedFx();
    this.map = buildMap(this.config.mapId, reduced);
    this.scene.add(this.map.group);
    this.podiumPositions = this.map.podiums(this.config.players.length);
  }

  _initPlayers() {
    const reduced = this.config.reducedFx();
    this.players = this.config.players.map((p, i) => {
      const seed = (this.roundSeed ^ ((i + 1) * 0x9E3779B1)) >>> 0;
      const field = new Playfield(makeBag(seed));
      const pos = this.podiumPositions[i % this.podiumPositions.length];
      const tower = new TowerSim(this.scene, new THREE.Vector3(pos.x, this.map.podiumY, pos.z), reduced);

      let controller;
      if (p.isLocal && p.type === 'human') controller = new LocalPieceController(p.keys || 'wasd');
      else if (p.type === 'remote') controller = new RemoteController(p.peerId || p.id, RUSH_REMOTE_ADAPTER);
      else controller = new BotController(makeBlockRushBotBrain(p.difficulty || 'medium'));
      if (controller.attach) controller.attach();

      return {
        id: p.id, name: p.name, colorHex: p.colorHex, isLocal: !!p.isLocal,
        controller, field, tower, podiumIndex: i,
        driftX: 0, alive: true, eliminated: false,
        gridVer: 0, _lastSentGridVer: -1,
      };
    });
  }

  // ── HUD ─────────────────────────────────────────────────────────────
  _initHud() {
    const hud = document.createElement('div');
    hud.className = 'rush-hud';
    hud.innerHTML = `
      <div class="rush-top">
        <div class="rush-title">🧱 Block Rush</div>
        <div class="rush-timer" id="rushTimer">${this.timeLeft.toFixed(1)}</div>
      </div>
      <div class="rush-chips" id="rushChips"></div>
      <div class="rush-message" id="rushMessage"></div>
      <div class="rush-labels" id="rushLabels"></div>`;
    this.host.appendChild(hud);
    this.hud = hud;
    this.elTimer = hud.querySelector('#rushTimer');
    this.elChips = hud.querySelector('#rushChips');
    this.elMessage = hud.querySelector('#rushMessage');
    this.elLabels = hud.querySelector('#rushLabels');

    this.labels = new Map();
    for (const p of this.players) {
      const el = document.createElement('div');
      el.className = 'rush-name-label';
      el.style.setProperty('--c', p.colorHex);
      el.textContent = p.name;
      this.elLabels.appendChild(el);
      this.labels.set(p.id, el);
    }
    this._renderHud();
  }

  _renderHud() {
    this.elChips.innerHTML = this.players.map((p) => {
      const heightPct = Math.round(((ROWS - p.field.topRow) / ROWS) * 100);
      const stabPct = Math.round(p.tower.stability * 100);
      const warn = p.alive && p.tower.state === 'lean';
      const spellIcons = (p.spells ? p.spells.inventory : []).map((id) => SPELL_META[id].icon).join(' ') || '—';
      return `<div class="rush-chip ${p.eliminated ? 'dead' : ''} ${warn ? 'warn' : ''}" style="--c:${p.colorHex}">
        <span class="rush-chip-name">${p.name}</span>
        <span class="rush-chip-bar"><span class="rush-chip-fill" style="width:${heightPct}%"></span></span>
        <span class="rush-chip-stab">${p.eliminated ? '✕' : stabPct + '%'}</span>
        <span class="rush-chip-spells">${spellIcons}</span>
      </div>`;
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
    const meta = BLOCK_RUSH_MAP_META.find((m) => m.id === this.config.mapId);
    const el = document.createElement('div');
    el.className = 'rush-map-intro-name';
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

  _gravityScale(p) {
    let g = this.map.gravityScale || 1;
    if (p.spells.fx.slowT > 0) g *= 2.6; // Blitzsturz-Spell
    return g;
  }

  _step(dt) {
    this._envT += dt;
    if (this.map.update) this.map.update(dt, this._envT);

    this.timeLeft -= dt;
    this.elTimer.textContent = Math.max(0, this.timeLeft).toFixed(1);

    const world = this._world();
    const aliveIds = this.players.filter((p) => p.alive).map((p) => p.id);
    this.spellSystem.update(dt, aliveIds);

    for (const p of this.players) {
      if (!p.alive) { if (!p.tower.isCollapseDone()) p.tower.update(dt, 0); continue; }

      const intent = p.controller.update(p, world, dt) || {};

      for (let i = 0; i < (intent.rot || 0); i++) p.field.tryRotate(1);
      if (intent.dx) {
        const dir = Math.sign(intent.dx);
        for (let i = 0; i < Math.abs(intent.dx); i++) p.field.tryShift(dir);
      }

      const lockResult = intent.hard
        ? p.field.hardDrop()
        : p.field.step(dt, this._gravityScale(p), !!intent.soft);

      if (lockResult === 'overflow') {
        this._eliminate(p, 'overflow');
        continue;
      }
      if (lockResult && lockResult.locked) {
        const glued = p.spells.fx.glueT > 0;
        p.tower.lock(lockResult, glued, { heights: p.field.heights, topRow: p.field.topRow, holes: p.field.countHoles() });
        p.gridVer++;
        this.spellSystem.onLock(p.id);
        this.config.sfx('rushLock');
      }

      if (intent.cycle) this.spellSystem.cycle(p.id, aliveIds);
      if (intent.cast) this._castSpell(p);

      // Windkanal (Sturmklippe): schiebt das FALLENDE Teil seitlich —
      // Kleber neutralisiert die Böe für den eigenen Turm.
      const wind = this.map.windAt ? this.map.windAt(this._envT, p.podiumIndex) : 0;
      if (wind && !(p.spells.fx.glueT > 0)) {
        p.driftX += wind * dt * 0.9;
        if (Math.abs(p.driftX) >= 1) { p.field.pushSide(Math.sign(p.driftX)); p.driftX = 0; }
      }

      const wasFalling = p.tower.state === 'falling';
      p.tower.ambientBias = this.map.ambientTilt ? this.map.ambientTilt(this._envT, p.podiumIndex) : 0;
      p.tower.update(dt, wind * 0.4);
      if (!wasFalling && p.tower.state === 'falling') this._eliminate(p, 'collapse');
    }

    this._renderHud();
    if (this.timeLeft <= 0 && !this.ended) this._finishByTime();
  }

  _castSpell(p) {
    const aliveIds = this.players.filter((pl) => pl.alive).map((pl) => pl.id);
    const action = this.spellSystem.cast(p.id, aliveIds);
    if (!action) return;
    const target = this.players.find((pl) => pl.id === action.targetId);
    if (!target) return;
    if (action.spellId === 'growth') target.field.requestGrowth();
    if (action.spellId === 'quake') target.tower.quake();
    this.config.sfx('rushSpell');
    this._message(`${p.name}: ${SPELL_META[action.spellId].name} → ${target.name}`);
  }

  _eliminate(p, reason) {
    if (p.eliminated) return;
    if (p.tower.state !== 'falling') p.tower.collapse();
    p.alive = false;
    p.eliminated = true;
    this.eliminationOrder.push(p);
    this.config.sfx('rushCollapse');
    this._message(reason === 'overflow' ? `${p.name} ist übergelaufen!` : `${p.name} ist eingestürzt!`);
    this._renderHud();
    const alive = this.players.filter((q) => q.alive);
    if (alive.length <= 1 && !this.ended) this._finish();
  }

  _finishByTime() { this._finish(); }

  // Ergebnis: Überlebende nach Höhe (kleineres topRow = höher gebaut), dann
  // Stabilität; Ausgeschiedene in umgekehrter Einsturz-Reihenfolge angehängt.
  _finish() {
    if (this.ended) return;
    this.ended = true;
    this.running = false;

    const alive = this.players.filter((p) => p.alive);
    alive.sort((a, b) => {
      const ha = ROWS - a.field.topRow, hb = ROWS - b.field.topRow;
      if (hb !== ha) return hb - ha;
      if (b.tower.stability !== a.tower.stability) return b.tower.stability - a.tower.stability;
      return Math.random() - 0.5;
    });
    const elimRev = [...this.eliminationOrder].reverse();
    const ordered = [...alive, ...elimRev];

    const slim = (p) => ({ id: p.id, name: p.name, colorHex: p.colorHex });
    const placements = ordered.map(slim);
    const winner = ordered[0] || null;
    if (winner) {
      this._message(`${winner.name} gewinnt!`);
      this.config.sfx('rushWin');
    } else {
      this._message('Unentschieden!');
    }
    setTimeout(() => {
      this.config.onResult({ winner: winner ? slim(winner) : null, placements });
    }, 1400);
  }

  // ── Gast-Wiedergabe (Online-Session) ────────────────────────────────
  // Eigenes Teil wird lokal weiterbewegt (Rotation/Spalte), damit sich die
  // Steuerung nicht verzögert anfühlt — alles andere kommt vom Snapshot.
  _stepReplica(dt) {
    const world = this._world();
    for (const p of this.players) {
      if (p.isLocal) this._myIntent = p.controller.update(p, world, dt) || this._myIntent;
    }
    if (!this._netSnap) return;

    this.timeLeft = this._netSnap.t;
    this.elTimer.textContent = Math.max(0, this.timeLeft).toFixed(1);

    const lerp = Math.min(1, dt * 10);
    let changed = false;
    for (const row of this._netSnap.p) {
      const [id, flags, angle, stability, topRow] = row;
      const p = this.players.find((pl) => pl.id === id);
      if (!p) continue;
      const wasAlive = p.alive;
      p.alive = !!(flags & 1);
      const falling = !!(flags & 2);
      p.tower.angle += (angle - p.tower.angle) * lerp;
      p.tower.pivot.rotation.z = p.tower.angle;
      p.tower.stability = stability;
      p.field.topRow = topRow;
      if (falling && p.tower.state !== 'falling') p.tower.collapse();
      if (wasAlive && !p.alive) { p.eliminated = true; changed = true; }
    }
    if (this._netSnap.g) {
      for (const id in this._netSnap.g) this._applyGridString(id, this._netSnap.g[id]);
    }
    if (changed) this._renderHud();
  }

  _applyGridString(id, str) {
    const p = this.players.find((pl) => pl.id === id);
    if (!p) return;
    const arr = new Int8Array(str.length);
    for (let i = 0; i < str.length; i++) arr[i] = str[i] === '.' ? -1 : Number(str[i]);
    p.tower.rebuildFromCells(arr, (idx) => PIECE_COLORS[PIECE_TYPES[idx]] || 0xffffff);
  }

  // Host: kompakter Stand für den Broadcast. Rasterdaten (die sich seltener
  // ändern als Winkel/Timer) werden NUR bei Änderung mitgeschickt.
  getSnapshot() {
    return {
      t: round1(this.timeLeft),
      p: this.players.map((p) => [
        p.id,
        (p.alive ? 1 : 0) | (p.tower.state === 'falling' ? 2 : 0),
        round2(p.tower.angle), round2(p.tower.stability), p.field.topRow,
      ]),
      g: this._changedGrids(),
    };
  }

  _changedGrids() {
    const out = {};
    for (const p of this.players) {
      if (p.gridVer !== p._lastSentGridVer) {
        out[p.id] = Array.from(p.field.cells).map((v) => (v < 0 ? '.' : String(v))).join('');
        p._lastSentGridVer = p.gridVer;
      }
    }
    return out;
  }

  applySnapshot(payload) { this._netSnap = payload; }
  feedRemoteInput(peerId, intent) {
    const p = this.players.find((pl) => pl.controller && pl.controller.peerId === peerId);
    if (p) p.controller.feed(intent);
  }
  getMyInput() { return this._myIntent; }

  // Host: verlorene Verbindung eines Online-Mitspielers → Bot übernimmt.
  convertToBot(peerId) {
    const p = this.players.find((pl) => pl.controller && pl.controller.peerId === peerId);
    if (!p) return;
    if (p.controller.detach) p.controller.detach();
    p.controller = new BotController(makeBlockRushBotBrain('medium'));
  }

  // ── reine Optik ─────────────────────────────────────────────────────
  _animate(dt) {
    let tallest = 0;
    for (const p of this.players) tallest = Math.max(tallest, (ROWS - p.field.topRow) * CELL);
    if (!this.introActive) {
      const dolly = Math.min(10, tallest * 0.35);
      const riseY = Math.min(6, tallest * 0.25);
      const target = new THREE.Vector3(this.camBase.x, this.camBase.y + riseY, this.camBase.z + dolly);
      this.camera.position.lerp(target, Math.min(1, dt * 2));
      this.camera.lookAt(0, Math.min(6, tallest * 0.5), 0);
    }
  }

  _updateLabels() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const v = new THREE.Vector3();
    for (const p of this.players) {
      const el = this.labels.get(p.id);
      const height = (ROWS - p.field.topRow) * CELL;
      v.set(p.tower.pivot.position.x, this.map.podiumY + height + 1.0, p.tower.pivot.position.z).project(this.camera);
      const sx = (v.x * 0.5 + 0.5) * w;
      const sy = (-v.y * 0.5 + 0.5) * h;
      el.style.transform = `translate(-50%,-100%) translate(${sx}px,${sy}px)`;
      el.classList.toggle('eliminated', p.eliminated);
    }
  }

  _world() {
    return {
      towers: this.players.map((p) => ({ id: p.id, alive: p.alive, stability: p.tower.stability, topRow: p.field.topRow })),
      spellActions: (id) => this.spellSystem.actionsFor(id, this.players.filter((p) => p.alive).map((p) => p.id)),
      spellCursor: (id) => { const s = this.spellSystem.stateOf(id); return s ? s.cursor : 0; },
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
    for (const p of this.players) {
      if (p.controller.detach) p.controller.detach();
      p.tower.dispose();
    }
    if (this.map.dispose) this.map.dispose();
    if (this.renderer) this.renderer.dispose();
    if (this.introEl) this.introEl = null;
    if (this.host) this.host.innerHTML = '';
  }
}

let current = null;
window.BlockRush = {
  start(config) {
    if (current) current.destroy();
    current = new BlockRushGame(config);
    current.begin();
    return current;
  },
  pause() { if (current) current.pause(); },
  resume() { if (current) current.resume(); },
  stop() { if (current) { current.destroy(); current = null; } },
  isRunning() { return !!current && current.running; },
  getSnapshot() { return current ? current.getSnapshot() : null; },
  applySnapshot(payload) { if (current) current.applySnapshot(payload); },
  getMyInput() { return current ? current.getMyInput() : RUSH_REMOTE_ADAPTER.initial(); },
  feedRemoteInput(peerId, intent) { if (current) current.feedRemoteInput(peerId, intent); },
  convertToBot(peerId) { if (current) current.convertToBot(peerId); },
};
