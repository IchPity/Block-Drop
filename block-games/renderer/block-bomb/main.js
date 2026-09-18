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
import { BlockCharacter } from '../game/characters.js';
import { Bomb } from './bomb.js';
import { applyMood, addLightRig } from '../game/theme.js';
import { buildMap, BOMB_MAPS } from './maps.js';
import { LocalHumanController, BotController, RemoteController } from '../game/controllers.js';
import { makeBotBrain } from './bots.js';
import { setDebugBots } from '../game/bots/botAI.js';

const SPEED = 6.4;        // Basistempo (gleich für alle — Fairness)
const PLAYER_R = 0.55;    // Kollisionsradius
const PASS_DIST = 1.3;    // Abstand für Bombenübergabe
const PASS_COOLDOWN = 0.75;

// Sprung (s. Steuerung/Einstellungen „walk.jump"): reine Höhenverschiebung,
// nur am Boden auslösbar. JUMP_V aus Zielwerten hergeleitet (v0 = g·T/2 für
// Flugzeit T bei Schwerkraft g) — ergibt ~0.45s Flugzeit, ~0.5 Einheiten
// Sprunghöhe. Für Block Bomb rein optisch/für Fallkanten; die eigentliche
// Sprung-Nutzlast (Laser überspringen) ist Laser Lines' checkHits().
const JUMP_GRAVITY = 20;
const JUMP_V = 4.5;
// Ab dieser Höhe gilt eine Figur als „in der Luft" — Maps nutzen das für
// Sprung-Elemente (Lücke auf sky, Förderband-Schub auf factory aussetzen,
// s. maps.js). Bewusst klein: schon ein kurzer Hüpfer zählt.
const JUMP_AIRBORNE_Y = 0.12;

// Splitscreen (2 lokale Menschen, Lobby-Toggle "Zwei Bilder", s. app.js
// buildMatchConfig/startRound): oben/unten, weil die Arenen breiter als hoch
// sind. SPLIT_ZOOM verkleinert die Übersichtsdistanz je Hälfte (weniger
// Bildhöhe pro Hälfte → näher ran); SPLIT_FOLLOW_CLAMP begrenzt, wie weit die
// Kamera einer Hälfte der eigenen Figur nachfährt (grobe, aber über alle
// Maps sichere Reichweite um die Mitte); SPLIT_FOLLOW_LAG ist die Dämpfung
// des Nachziehens (höher = schneller).
const SPLIT_ZOOM = 0.62;
const SPLIT_FOLLOW_CLAMP = 8;
const SPLIT_FOLLOW_LAG = 3;

// Adapter für RemoteController (s. game/controllers.js) — Bewegung {x,z} ist
// gehalten (letzter Stand reicht), `jump` ist ein Tastendruck-Zähler und wird
// wie bei Block Rush' RUSH_REMOTE_ADAPTER erst beim Lesen (update()) geleert,
// damit auch bei verpassten Polls kein Sprung verloren geht.
const WALK_REMOTE_ADAPTER = {
  initial: () => ({ x: 0, z: 0, jump: 0 }),
  merge: (pending, incoming) => ({
    x: incoming.x || 0,
    z: incoming.z || 0,
    jump: pending.jump + (incoming.jump || 0),
  }),
  drain: (pending) => ({
    value: pending,
    next: { x: pending.x, z: pending.z, jump: 0 },
  }),
};

class BlockBombGame {
  constructor(config) {
    this.config = config;
    this.host = config.host;
    // Online-Sessions (siehe app.js/net/session.js): 'host' simuliert normal
    // UND liefert getSnapshot() zum Broadcasten; 'guest' überspringt Physik/
    // Regeln komplett und rendert nur, was applySnapshot() liefert — der
    // Spielkern kennt NetSession dabei nicht, app.js reicht nur `role` durch.
    this.role = config.role === 'guest' ? 'guest' : 'host';
    this._netSnap = null;      // letzter über applySnapshot() erhaltener Stand (Gast)
    this._myIntent = WALK_REMOTE_ADAPTER.initial(); // eigener Intent, den app.js für 'input' abgreift
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
    this.debugBots = false;
    this.debugGroup = null;
    this.debugLines = [];
    // Eliminierungs-Reihenfolge (zuerst rausgeflogen = zuerst in der Liste).
    // Für die Platzierungen am Rundenende (Serien-Wertung in app.js).
    this.eliminationOrder = [];

    this._initThree();
    this._initMap();
    this._initPlayers();
    this._initViews();
    this._initHud();   // vor _initBomb: _assignBomb() nutzt das HUD (_message)
    this._initBomb();
    this._onResize = () => this._resize();
    this._onKeyDown = (e) => this._handleKeyDown(e);
    window.addEventListener('resize', this._onResize);
  }

  // ── Three.js-Grundgerüst ───────────────────────────────────────────
  _initThree() {
    const reduced = this.config.reducedFx();
    // Hintergrund/Nebel/Licht sind Sache der Map (mood-Objekt, s.
    // game/theme.js) — werden in _initMap() gesetzt, NACHDEM die Map gebaut
    // ist (buildMap() liefert das mood-Objekt zurück). Hier nur das
    // Three.js-Grundgerüst ohne jede Farb-/Licht-Entscheidung.
    this.scene = new THREE.Scene();

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
    // Splitscreen rendert die Szene zweimal pro Frame — Pixel-Ratio dann auf
    // 1 deckeln, sonst verdoppelt sich die Fill-Rate-Last unnötig.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, (reduced || this.config.split) ? 1 : 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = !reduced;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'bomb-canvas';
    this.host.appendChild(this.canvas);

    // Debug group for waypoints + bot-target lines (initially hidden)
    this.debugGroup = new THREE.Group();
    this.debugGroup.visible = false;
    this.scene.add(this.debugGroup);
  }

  _initMap() {
    const reduced = this.config.reducedFx();
    this.map = buildMap(this.config.mapId, reduced);
    this.scene.add(this.map.group);
    applyMood(this.scene, this.map.mood);
    // castShadow hängt vom Live-reducedFx-Wert ab (Performance-Schalter),
    // nicht von der Map — deshalb hier statt im mood-Objekt überschrieben.
    addLightRig(this.scene, { ...this.map.mood, castShadow: !reduced });
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
      if (p.isLocal && p.type === 'human') controller = new LocalHumanController(p.bindings?.walk || p.keys || 'wasd');
      else if (p.type === 'remote') controller = new RemoteController(p.peerId || p.id, WALK_REMOTE_ADAPTER);
      else controller = new BotController(makeBotBrain(p.difficulty || 'medium'));
      if (controller.attach) controller.attach();

      return {
        id: p.id, name: p.name, colorHex: p.colorHex, isLocal: !!p.isLocal,
        controller, char,
        x: spawn.x, z: spawn.z, facing: 0,
        alive: true, isHolder: false, falling: false, fallT: 0,
        jumpY: 0, jumpVy: 0,
      };
    });
    this.aliveStart = this.players.length;
  }

  // Splitscreen-Views (s. app.js: config.split nur bei genau 2 lokalen
  // Menschen + Host + Lobby-Toggle). Ohne Split ist views[0].camera === this.
  // camera und rect deckt die volle Bühne — der Einzelbild-Pfad in _loop/
  // _resize/_updateLabels bleibt dadurch exakt der alte Code, nur einmal
  // durch die (dann einelementige) views-Liste geschleift.
  _initViews() {
    const localIds = this.players.filter((p) => p.isLocal).map((p) => p.id);
    const split = this.config.split && localIds.length === 2;
    // toggle statt add: host-Element wird pro start() neu befüllt, aber die
    // CSS-Klasse muss explizit auch wieder WEG, falls das nächste Match in
    // der Serie kein Splitscreen mehr ist.
    this.host.classList.toggle('split-h', !!split);
    if (split) {
      const cam2 = this.camera.clone();
      this.views = [
        { playerId: localIds[0], camera: this.camera, rect: { x: 0, y: 0.5, w: 1, h: 0.5 }, base: this.camBase.clone().multiplyScalar(SPLIT_ZOOM) },
        { playerId: localIds[1], camera: cam2, rect: { x: 0, y: 0, w: 1, h: 0.5 }, base: this.camBase.clone().multiplyScalar(SPLIT_ZOOM) },
      ];
    } else {
      this.views = [{ playerId: localIds[0] ?? null, camera: this.camera, rect: { x: 0, y: 0, w: 1, h: 1 } }];
    }
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
    window.addEventListener('keydown', this._onKeyDown);
    this.raf = requestAnimationFrame((t) => this._loop(t));
  }

  _startIntro() {
    this.introActive = true;
    this.introT = 0;
    // Ein gemeinsamer introT für alle Views — beide Splitscreen-Hälften
    // fliegen synchron ein und landen gleichzeitig (s. _updateIntro).
    for (const v of this.views) { v.camera.position.copy(this.camOverview); v.camera.lookAt(0, 1, 0); }
    this._showMapIntro();
  }

  _updateIntro(dt) {
    this.introT += dt;
    const t = Math.min(1, this.introT / this.introDuration);
    const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
    for (const v of this.views) {
      v.camera.position.lerpVectors(this.camOverview, this.camBase, eased);
      v.camera.lookAt(0, 1, 0);
    }
    if (t >= 1) {
      this.introActive = false;
      for (const v of this.views) v.camera.position.copy(this.camBase);
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
    let fps = this.config.fpsLimit();
    // Splitscreen rendert zweimal pro Frame — ein unbegrenztes Limit wäre
    // dann ein echtes Perf-Risiko, deshalb intern auf 60 klemmen.
    if (this.config.split && fps === 0) fps = 60;
    if (fps > 0 && elapsed < 1000 / fps - 0.5) return; // FPS-Limit
    this.last = now;
    const dt = Math.min(0.05, elapsed / 1000);

    if (!this.paused) {
      if (this.introActive) {
        this._updateIntro(dt);
      } else if (this.running) {
        if (this.role === 'guest') this._stepReplica(dt);
        else this._step(dt);
      }
    }
    this._animate(dt);
    if (this.debugBots) {
      this._updateDebugViz();
    }
    this._renderViews();
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
      if (p.jumpY <= 0 && (intent.jump || 0) > 0) p.jumpVy = JUMP_V;
      if (p.jumpY > 0 || p.jumpVy > 0) {
        p.jumpY += p.jumpVy * dt;
        p.jumpVy -= JUMP_GRAVITY * dt;
        if (p.jumpY <= 0) { p.jumpY = 0; p.jumpVy = 0; }
      }
      p.char.setJumpOffset(p.jumpY);
      const airborne = p.jumpY > JUMP_AIRBORNE_Y;
      let vx = intent.x * SPEED, vz = intent.z * SPEED;
      const push = this.map.conveyor(p.x, p.z, airborne);
      vx += push.x; vz += push.z;
      const nx = p.x + vx * dt, nz = p.z + vz * dt;
      const r = this.map.resolve(nx, nz, PLAYER_R, airborne);
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

  // ── Gast-Wiedergabe (Online-Session) ────────────────────────────────
  // KEINE Physik/Kollision/Spielregeln — nur weiches Nachziehen der Figuren
  // zum letzten per applySnapshot() empfangenen Stand des Hosts. Der eigene
  // Intent wird trotzdem berechnet (LocalHumanController braucht dafür kein
  // Wissen über Netzwerk), aber NICHT auf die eigene Figur angewandt: die
  // bewegt sich erst, wenn der Host den Intent verarbeitet hat und seinen
  // nächsten Snapshot schickt — bewusst ohne Client-Prediction in v1
  // (spürbar als Eingabelatenz, siehe DOKUMENTATION.md).
  _stepReplica(dt) {
    const world = this._world();
    for (const p of this.players) {
      if (p.isLocal) this._myIntent = p.controller.update(p, world, dt) || { x: 0, z: 0 };
    }
    if (!this._netSnap) return;

    this.timeLeft = this._netSnap.timeLeft;
    const urgency = 1 - Math.max(0, Math.min(1, this.timeLeft / 6));
    this.bomb.setUrgency(urgency);
    this.elTimer.textContent = Math.max(0, this.timeLeft).toFixed(1);
    this.elTimerBox.classList.toggle('urgent', this.timeLeft < 3);

    const lerp = Math.min(1, dt * 12); // ~80ms Angleichung — glättet 20Hz-Snapshots
    const byId = new Map(this._netSnap.p.map(row => [row[0], row]));
    for (const p of this.players) {
      const row = byId.get(p.id);
      if (!row) continue;
      // row[5] (jumpY) ist neu (v0.23.0) — defensiv lesen, damit ein älterer
      // Host (ohne Sprung-Feld im Snapshot) einen neueren Gast nicht bricht.
      const [, x, z, facing, flags, jumpY] = row;
      const wasAlive = p.alive;
      p.alive = !!(flags & 1);
      const isHolder = !!(flags & 2);
      p.x += (x - p.x) * lerp; p.z += (z - p.z) * lerp;
      p.char.group.position.x = p.x; p.char.group.position.z = p.z;
      p.char.setJumpOffset(jumpY ?? 0);
      p.facing = facing;
      if (wasAlive && !p.alive) { p.char.explode(); this.config.sfx('bombExplode'); }
      if (isHolder !== p.isHolder) { p.isHolder = isHolder; p.char.setHolderGlow(isHolder); }
      if (isHolder) this.bomb.group.position.set(p.x, this.map.groundY + 2.5, p.z);
    }
  }

  // Host: kompakter Stand für den 20Hz-Broadcast (app.js pollt das). Flags-
  // Bitfeld: 1 = lebt, 2 = trägt die Bombe. Koordinaten gerundet, damit die
  // Nachricht klein bleibt (Supabase-Realtime-Ratenbudget, s. DOKUMENTATION.md).
  getSnapshot() {
    return {
      timeLeft: Math.round(this.timeLeft * 10) / 10,
      p: this.players.map(p => [
        p.id, Math.round(p.x * 100) / 100, Math.round(p.z * 100) / 100,
        Math.round(p.facing * 100) / 100,
        (p.alive ? 1 : 0) | (p.id === this.holderId ? 2 : 0),
        Math.round(p.jumpY * 100) / 100, // neu (v0.23.0), s. applySnapshot()
      ]),
    };
  }
  // Gast: letzten Host-Stand übernehmen (von app.js bei jeder 'snap'-Nachricht gerufen).
  applySnapshot(payload) { this._netSnap = payload; }
  // Host: Eingabe eines entfernten Spielers an dessen RemoteController weiterreichen.
  feedRemoteInput(peerId, intent) {
    const p = this.players.find(pl => pl.controller && pl.controller.peerId === peerId);
    if (p) p.controller.feed(intent);
  }
  // Gast: eigener Intent, den app.js für die 'input'-Nachricht an den Host abgreift.
  getMyInput() { return this._myIntent; }

  // Host: verlorene Verbindung eines Online-Mitspielers → Bot übernimmt die
  // Figur, damit die laufende Serie nicht abbricht (Disconnect-Regel, s.
  // DOKUMENTATION.md). Nur der Controller wechselt, Figur/Position/HUD bleiben.
  convertToBot(peerId) {
    const p = this.players.find(pl => pl.controller && pl.controller.peerId === peerId);
    if (!p) return;
    if (p.controller.detach) p.controller.detach();
    p.controller = new BotController(makeBotBrain('medium'));
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
    this.eliminationOrder.push(holder);
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
    this.eliminationOrder.push(p);
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
      this.config.onResult(this._buildResult(winner));
    }, 1400);
  }

  // Ergebnis im generischen Format { winner, placements } (1.→letzter).
  // placements: Sieger zuerst, dann die Eliminierten in UMGEKEHRTER Reihenfolge
  // (zuletzt rausgeflogen = besserer Platz). winner bleibt abwärtskompatibel.
  _buildResult(winner) {
    const slim = (p) => p && { id: p.id, name: p.name, colorHex: p.colorHex };
    const placements = [];
    if (winner) placements.push(slim(winner));
    for (let i = this.eliminationOrder.length - 1; i >= 0; i--) {
      placements.push(slim(this.eliminationOrder[i]));
    }
    return { winner: winner ? slim(winner) : null, placements };
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

    if (this.views.length > 1) {
      this._updateSplitCameras(dt);
      return;
    }
    // Kamera-Shake nach Explosion (Einzelbild-Pfad, unverändert ggü. v0.22)
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

  // Splitscreen-Kameras: je Hälfte der eigenen Figur nachziehen (gedämpft,
  // geklemmt auf SPLIT_FOLLOW_CLAMP) statt der fixen Übersicht. Shake ist ein
  // globales Ereignis (Explosion) und bekommt EINEN gemeinsamen Zufalls-
  // Versatz für beide Hälften, statt pro Hälfte unabhängig zu wackeln.
  _updateSplitCameras(dt) {
    if (this.introActive) return; // Intro fährt beide Kameras synchron, s. _updateIntro
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
    const s = this.shake;
    const jitter = s > 0
      ? new THREE.Vector3((Math.random() * 2 - 1) * s, (Math.random() * 2 - 1) * s, (Math.random() * 2 - 1) * s)
      : null;
    for (const v of this.views) {
      const p = this.players.find((pl) => pl.id === v.playerId);
      const cx = p ? Math.max(-SPLIT_FOLLOW_CLAMP, Math.min(SPLIT_FOLLOW_CLAMP, p.x)) : 0;
      const cz = p ? Math.max(-SPLIT_FOLLOW_CLAMP, Math.min(SPLIT_FOLLOW_CLAMP, p.z)) : 0;
      const target = new THREE.Vector3(v.base.x + cx * 0.4, v.base.y, v.base.z + cz * 0.4);
      v.camera.position.lerp(target, Math.min(1, dt * SPLIT_FOLLOW_LAG));
      if (jitter) v.camera.position.add(jitter);
      v.camera.lookAt(cx, 1, cz);
    }
  }

  // Rendert entweder die volle Bühne (Einzelbild, exakt der alte Aufruf) oder
  // teilt Viewport+Scissor pro Splitscreen-Hälfte auf. rect ist wie WebGL
  // selbst von UNTEN gezählt (y=0=unten) — dadurch KEIN Flip hier nötig; der
  // Flip passiert einzig in _viewPixelRect (Bildschirm-Pixel „von oben").
  _renderViews() {
    if (this.views.length < 2) {
      this.renderer.setScissorTest(false);
      this.renderer.render(this.scene, this.views[0].camera);
      return;
    }
    const w = this.host.clientWidth || window.innerWidth;
    const h = this.host.clientHeight || window.innerHeight;
    this.renderer.setScissorTest(true);
    for (const v of this.views) {
      const vx = Math.round(v.rect.x * w);
      const vy = Math.round(v.rect.y * h);
      const vw = Math.round(v.rect.w * w);
      const vh = Math.round(v.rect.h * h);
      this.renderer.setViewport(vx, vy, vw, vh);
      this.renderer.setScissor(vx, vy, vw, vh);
      this.renderer.render(this.scene, v.camera);
    }
    this.renderer.setScissorTest(false);
  }

  // rect (Bottom-Up, s. _renderViews) → Bildschirm-Pixel-Rechteck von OBEN
  // gezählt, für die DOM-Label-Platzierung in _updateLabels.
  _viewPixelRect(v, w, h) {
    return {
      left: v.rect.x * w,
      top: (1 - v.rect.y - v.rect.h) * h,
      width: v.rect.w * w,
      height: v.rect.h * h,
    };
  }

  _updateLabels() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const vec = new THREE.Vector3();
    for (const p of this.players) {
      const el = this.labels.get(p.id);
      if (!p.alive) { el.style.display = 'none'; continue; }
      el.style.display = '';
      // Splitscreen: Label folgt der Kamera-Hälfte des jeweiligen Spielers;
      // Bots/Remote (keine eigene Hälfte) werden immer über views[0] projiziert.
      const view = this.views.find((vw) => vw.playerId === p.id) || this.views[0];
      const rect = this._viewPixelRect(view, w, h);
      vec.set(p.x, this.map.groundY + 2.4, p.z).project(view.camera);
      const sx = rect.left + (vec.x * 0.5 + 0.5) * rect.width;
      const sy = rect.top + (-vec.y * 0.5 + 0.5) * rect.height;
      el.style.transform = `translate(-50%,-100%) translate(${sx}px,${sy}px)`;
      el.classList.toggle('holder', p.isHolder);
      if (p.debug) {
        const flags = (p.debug.stuck ? '!' : '') + (p.debug.edgeAhead ? 'E' : '');
        el.textContent = `${p.name} [${p.debug.state}${flags}]`;
      } else if (el.textContent !== p.name) {
        el.textContent = p.name;
      }
    }
  }

  _handleKeyDown(e) {
    if (e.key === 'F9' || e.code === 'F9') {
      this.debugBots = !this.debugBots;
      setDebugBots(this.debugBots);
      if (this.debugBots) {
        this._initDebugViz();
      } else {
        this._clearDebugViz();
      }
      this.debugGroup.visible = this.debugBots;
    }
  }

  _initDebugViz() {
    // Create waypoint markers
    if (this.map.waypoints?.length) {
      for (const wp of this.map.waypoints) {
        let color = 0x22cc22; // safe = green
        if (wp.tags?.includes('corner')) color = 0xffcc00; // yellow
        if (wp.tags?.includes('bridge')) color = 0xff9900; // orange
        const geo = new THREE.CircleGeometry(0.3, 12);
        const mat = new THREE.MeshBasicMaterial({ color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(wp.x, this.map.groundY + 0.02, wp.z);
        this.debugGroup.add(mesh);
      }
    }
    // Pre-allocate line objects for bot-to-waypoint visualization
    for (let i = 0; i < this.players.filter(p => p.controller.constructor.name === 'BotController').length; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const mat = new THREE.LineBasicMaterial({ color: 0x4488ff, linewidth: 2 });
      const line = new THREE.Line(geo, mat);
      this.debugGroup.add(line);
      this.debugLines.push({ line, geo });
    }
  }

  _clearDebugViz() {
    if (this.debugGroup) {
      while (this.debugGroup.children.length) {
        const child = this.debugGroup.children[0];
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
        this.debugGroup.remove(child);
      }
    }
    this.debugLines = [];
  }

  _updateDebugViz() {
    if (!this.debugBots || !this.debugGroup.visible) return;
    let lineIdx = 0;
    for (const p of this.players) {
      if (p.debug?.waypoint && lineIdx < this.debugLines.length) {
        const positions = [p.x, this.map.groundY + 0.1, p.z, p.debug.waypoint.x, this.map.groundY + 0.1, p.debug.waypoint.z];
        this.debugLines[lineIdx].geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
        this.debugLines[lineIdx].geo.attributes.position.needsUpdate = true;
        lineIdx++;
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
    for (const v of this.views) {
      v.camera.aspect = (w * v.rect.w) / (h * v.rect.h);
      v.camera.updateProjectionMatrix();
    }
    this.renderer.setSize(w, h);
  }

  destroy() {
    this.running = false;
    this.ended = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('keydown', this._onKeyDown);
    this._clearDebugViz();
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
  isPaused() { return !!current && current.paused; },
  // ── Online-Sessions (app.js/net/session.js) ──────────────────────────
  getSnapshot() { return current ? current.getSnapshot() : null; },
  applySnapshot(payload) { if (current) current.applySnapshot(payload); },
  feedRemoteInput(peerId, intent) { if (current) current.feedRemoteInput(peerId, intent); },
  getMyInput() { return current ? current.getMyInput() : WALK_REMOTE_ADAPTER.initial(); },
  convertToBot(peerId) { if (current) current.convertToBot(peerId); },
  getPlayers() {
    if (!current) return [];
    return current.players.map(p => ({
      id: p.id,
      x: p.x,
      z: p.z,
      alive: p.alive,
      isHolder: p.isHolder,
      state: p.debug?.state,
    }));
  },
};
