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
import { COLS, ROWS, CELL, Playfield, makeBag, hashSeed, shapeCells, PIECE_TYPES, PIECE_COLORS } from './pieces.js';
import { TowerSim } from './tower.js';
import { buildMap, BLOCK_RUSH_MAP_META } from './maps.js';
import { SpellSystem, SPELL_META } from './spells.js';
import { makeBlockRushBotBrain } from './bots.js';

const ROUND_TIME = 90; // Sekunden bis Zeitlimit (länger als Laser Lines — Stapeln ist langsamer als Ausweichen)

// Splitscreen (2 lokale Menschen, Lobby-Toggle "Zwei Bilder", s. app.js
// buildMatchConfig/startRound): links/rechts, weil die Podeste hoch/schmal
// sind (anders als Block Bomb/Laser Lines, die oben/unten splitten).

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

// ── Fallendes Teil sichtbar machen (Kernfehler, s. Plan Phase 9) ──────────
// TowerSim (tower.js) zeichnet NUR bereits eingerastete Blöcke — ohne dies
// bewegt der Spieler ein komplett unsichtbares Teil. Eine PieceView-Instanz
// pro Spieler, am TOWER-PIVOT aufgehängt (dieselbe lokale Koordinatenformel
// wie TowerSim.lock()) — dadurch teilt sich das fallende Teil automatisch
// Position UND Kippwinkel mit dem eigenen Turm, ohne eigene Transform-Logik.
class PieceView {
  constructor(pivot, ghost = false) {
    this._ghost = ghost;
    this.group = new THREE.Group();
    this.cubes = [];
    this._geo = new THREE.BoxGeometry(CELL * 0.92, CELL * 0.92, CELL * 0.92);
    for (let i = 0; i < 4; i++) {
      const mat = ghost
        ? new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, depthWrite: false })
        : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.08 });
      const mesh = new THREE.Mesh(this._geo, mat);
      if (!ghost) mesh.castShadow = true;
      this.group.add(mesh);
      this.cubes.push(mesh);
    }
    this.group.visible = false;
    pivot.add(this.group);
    if (ghost) {
      // Spaltenmarkierung auf dem Podest, unter der Landeposition.
      this.marker = new THREE.Mesh(
        new THREE.BoxGeometry(CELL, 0.03, CELL * 3),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false }),
      );
      this.marker.visible = false;
      pivot.add(this.marker);
    }
    this._smoothCol = null;
    this._smoothRow = null;
  }

  setColor(hex) {
    for (const m of this.cubes) m.material.color.setHex(hex);
    if (this.marker) this.marker.material.color.setHex(hex);
  }

  _place(col, row, type, rot) {
    const cells = shapeCells(type, rot);
    for (let i = 0; i < 4; i++) {
      const [dx, dy] = cells[i];
      const x = (col + dx - (COLS - 1) / 2) * CELL;
      const y = (ROWS - 1 - (row + dy)) * CELL + CELL / 2;
      this.cubes[i].position.set(x, y, 0);
    }
  }

  hide() {
    this.group.visible = false;
    this._smoothCol = null;
    this._smoothRow = null;
    if (this.marker) this.marker.visible = false;
  }

  // Fallendes Teil: sanft zur logischen col/row interpolieren — sonst würde
  // jeder Zeilenschritt/Sidestep im 3D-Blick hart "springen".
  update(piece, dt) {
    if (!piece) { this.hide(); return; }
    this.group.visible = true;
    if (this._smoothCol === null) { this._smoothCol = piece.col; this._smoothRow = piece.row; }
    const t = Math.min(1, dt * 18);
    this._smoothCol += (piece.col - this._smoothCol) * t;
    this._smoothRow += (piece.row - this._smoothRow) * t;
    this._place(this._smoothCol, this._smoothRow, piece.type, piece.rot);
  }

  // Geisterteil: KEINE Glättung — die Landevorschau muss exakt sitzen.
  updateGhost(piece, landRow) {
    if (!piece || landRow < 0) { this.hide(); return; }
    this.group.visible = true;
    this._place(piece.col, landRow, piece.type, piece.rot);
    if (this.marker) {
      const cells = shapeCells(piece.type, piece.rot);
      let minDx = Infinity, maxDx = -Infinity;
      for (const [dx] of cells) { if (dx < minDx) minDx = dx; if (dx > maxDx) maxDx = dx; }
      const spanCols = maxDx - minDx + 1;
      const centerCol = piece.col + (minDx + maxDx) / 2;
      this.marker.scale.x = spanCols;
      this.marker.position.set((centerCol - (COLS - 1) / 2) * CELL, 0.02, 0);
      this.marker.visible = true;
    }
  }

  dispose() {
    this._geo.dispose();
    for (const m of this.cubes) m.material.dispose();
    if (this.marker) {
      this.marker.geometry.dispose();
      this.marker.material.dispose();
      if (this.marker.parent) this.marker.parent.remove(this.marker);
    }
    if (this.group.parent) this.group.parent.remove(this.group);
  }
}

// Kurze Tastenbeschriftung für den Steuerungs-Hinweis im Intro. Die App-Ebene
// (renderer/keybinds.js) ist ein klassisches Script und für dieses ES-Modul
// nicht erreichbar (kein window.Keybinds) — wie schon in game/controllers.js
// (LEGACY_*) halten wir hier eine EIGENE, unabhängige Kurzkopie nur für die
// Beschriftung. Bei Änderungen an keybinds.js LABELS ggf. auch hier nachziehen.
const KEY_LABELS = {
  Space: 'Leertaste', ShiftRight: 'Shift rechts', ShiftLeft: 'Shift links',
  ControlRight: 'Strg rechts', ControlLeft: 'Strg links',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Slash: '-/#',
};
function labelKey(code) {
  if (!code) return '–';
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  return code;
}
function pieceControlHint(bindings) {
  const b = bindings || {};
  const k = labelKey;
  return `${k(b.left)}/${k(b.right)} Bewegen · ${k(b.rotate)} Drehen · ${k(b.down)} Sinken · `
    + `${k(b.hard)} Fallen · ${k(b.cast)} Zauber · ${k(b.cycle)} Ziel`;
}

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
    this._initViews();
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
    // Splitscreen rendert die Szene zweimal pro Frame — Pixel-Ratio dann auf
    // 1 deckeln, sonst verdoppelt sich die Fill-Rate-Last unnötig.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, (reduced || this.config.split) ? 1 : 2));
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
      if (p.isLocal && p.type === 'human') controller = new LocalPieceController(p.bindings?.piece || p.keys || 'wasd');
      else if (p.type === 'remote') controller = new RemoteController(p.peerId || p.id, RUSH_REMOTE_ADAPTER);
      else controller = new BotController(makeBlockRushBotBrain(p.difficulty || 'medium'));
      if (controller.attach) controller.attach();

      return {
        id: p.id, name: p.name, colorHex: p.colorHex, isLocal: !!p.isLocal,
        controller, field, tower, podiumIndex: i,
        driftX: 0, alive: true, eliminated: false,
        gridVer: 0, _lastSentGridVer: -1,
        pieceView: new PieceView(tower.pivot, false),
        ghostView: new PieceView(tower.pivot, true),
        // Gast: letztes vom Host übertragenes {col,row,type,rot} dieses
        // Spielers (s. getSnapshot/_stepReplica) — auf einem Gast läuft
        // KEINE eigene Playfield-Simulation (auch nicht für den eigenen
        // lokalen Spieler, s. Kommentar bei _stepReplica), field.piece ist
        // dort also dauerhaft veraltet und darf für die Optik nicht benutzt
        // werden.
        _netPiece: null,
      };
    });
  }

  // Splitscreen-Views (links/rechts statt oben/unten, s. Kommentar oben) —
  // sonst identisches Muster zu block-bomb/main.js _initViews().
  _initViews() {
    const localIds = this.players.filter((p) => p.isLocal).map((p) => p.id);
    const split = this.config.split && localIds.length === 2;
    this.host.classList.toggle('split-v', !!split);
    if (split) {
      const cam2 = this.camera.clone();
      this.views = [
        { playerId: localIds[0], camera: this.camera, rect: { x: 0, y: 0, w: 0.5, h: 1 } },
        { playerId: localIds[1], camera: cam2, rect: { x: 0.5, y: 0, w: 0.5, h: 1 } },
      ];
    } else {
      this.views = [{ playerId: localIds[0] ?? null, camera: this.camera, rect: { x: 0, y: 0, w: 1, h: 1 } }];
    }
  }

  // ── HUD ─────────────────────────────────────────────────────────────
  // Chip-DOM wird EINMAL pro Spieler gebaut (_initHud) und danach nur noch
  // gezielt aktualisiert (_renderHud) — vorher baute _renderHud() jeden
  // Frame die komplette Chip-Reihe per innerHTML neu, was mehr kostete als
  // das eigentliche Spiel (s. Plan Phase 9 Punkt 8).
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
      <div class="rush-labels" id="rushLabels"></div>
      <div class="rush-controls-hint" id="rushControlsHint"></div>`;
    this.host.appendChild(hud);
    this.hud = hud;
    this.elTimer = hud.querySelector('#rushTimer');
    this.elChips = hud.querySelector('#rushChips');
    this.elMessage = hud.querySelector('#rushMessage');
    this.elLabels = hud.querySelector('#rushLabels');
    this.elControlsHint = hud.querySelector('#rushControlsHint');

    this.labels = new Map();
    this.chips = new Map();
    for (const p of this.players) {
      const el = document.createElement('div');
      el.className = 'rush-name-label';
      el.style.setProperty('--c', p.colorHex);
      el.textContent = p.name;
      this.elLabels.appendChild(el);
      this.labels.set(p.id, el);

      const chip = document.createElement('div');
      chip.className = 'rush-chip';
      chip.style.setProperty('--c', p.colorHex);
      chip.innerHTML = `
        <span class="rush-chip-name"></span>
        <span class="rush-chip-bar"><span class="rush-chip-fill"></span></span>
        <span class="rush-chip-stab"></span>
        <span class="rush-chip-spells"></span>
        <span class="rush-chip-next" title="Nächstes Teil"><span class="rush-mini-grid"></span></span>
        <span class="rush-chip-cursor"></span>`;
      chip.querySelector('.rush-chip-name').textContent = p.name;
      this.elChips.appendChild(chip);
      const miniCells = [];
      const miniGrid = chip.querySelector('.rush-mini-grid');
      for (let i = 0; i < 16; i++) {
        const cell = document.createElement('span');
        cell.className = 'rush-mini-cell';
        miniGrid.appendChild(cell);
        miniCells.push(cell);
      }
      this.chips.set(p.id, {
        root: chip,
        fill: chip.querySelector('.rush-chip-fill'),
        stab: chip.querySelector('.rush-chip-stab'),
        spells: chip.querySelector('.rush-chip-spells'),
        cursor: chip.querySelector('.rush-chip-cursor'),
        miniCells,
        _h: -1, _s: '', _sp: '', _cu: '', _next: undefined, _warn: null, _dead: null,
      });
    }
    this._renderHud();
  }

  _renderHud() {
    const aliveIds = this.players.filter((p) => p.alive).map((p) => p.id);
    for (const p of this.players) {
      const c = this.chips.get(p.id);
      if (!c) continue;
      const dead = p.eliminated;
      if (dead !== c._dead) { c.root.classList.toggle('dead', dead); c._dead = dead; }
      const warn = p.alive && p.tower.state === 'lean';
      if (warn !== c._warn) { c.root.classList.toggle('warn', warn); c._warn = warn; }

      const heightPct = Math.round(((ROWS - p.field.topRow) / ROWS) * 100);
      if (heightPct !== c._h) { c.fill.style.width = heightPct + '%'; c._h = heightPct; }

      const stabText = dead ? '✕' : Math.round(p.tower.stability * 100) + '%';
      if (stabText !== c._s) { c.stab.textContent = stabText; c._s = stabText; }

      const spellIcons = (p.spells ? p.spells.inventory : []).map((id) => SPELL_META[id].icon).join(' ') || '—';
      if (spellIcons !== c._sp) { c.spells.textContent = spellIcons; c._sp = spellIcons; }

      // Nächstes Teil (4x4-Mini-Raster) — bisher nirgends sichtbar.
      const nextType = !dead && p.field.next ? p.field.next : null;
      if (nextType !== c._next) {
        c._next = nextType;
        const cells = nextType ? shapeCells(nextType, 0) : [];
        const filled = new Set(cells.map(([dx, dy]) => dy * 4 + dx));
        const colorHex = nextType ? '#' + PIECE_COLORS[nextType].toString(16).padStart(6, '0') : '';
        c.miniCells.forEach((cell, i) => {
          const on = filled.has(i);
          cell.classList.toggle('on', on);
          cell.style.background = on ? colorHex : '';
        });
      }

      // Zauber-Cursor: armierter Zauber + Ziel — bisher nirgends sichtbar
      // (spells.cursor existierte, wurde aber nie angezeigt).
      let cursorText = '';
      if (!dead && p.spells && p.spells.inventory.length) {
        const action = this.spellSystem.currentAction(p.id, aliveIds);
        if (action) {
          const target = this.players.find((q) => q.id === action.targetId);
          const meta = SPELL_META[action.spellId];
          const targetName = target ? (target.id === p.id ? 'Selbst' : target.name) : '?';
          cursorText = `${meta.icon} ${meta.name} → ${targetName}`;
        }
      }
      if (cursorText !== c._cu) { c.cursor.textContent = cursorText; c._cu = cursorText; }
    }
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
    // Ein gemeinsamer introT für alle Views — beide Splitscreen-Hälften
    // fliegen synchron ein und landen zunächst gemeinsam auf camBase; danach
    // dollyt jede Hälfte per _updateSplitCameras() sanft auf ihr EIGENES
    // Podest auseinander (s. dort).
    for (const v of this.views) { v.camera.position.copy(this.camOverview); v.camera.lookAt(0, 1, 0); }
    const meta = BLOCK_RUSH_MAP_META.find((m) => m.id === this.config.mapId);
    const el = document.createElement('div');
    el.className = 'rush-map-intro-name';
    el.textContent = meta ? meta.name : '';
    this.host.appendChild(el);
    this.introEl = el;
    requestAnimationFrame(() => el.classList.add('show'));

    // Kurzer Tastenhinweis, generiert aus den TATSÄCHLICHEN Bindings des
    // jeweiligen Spielers (Keybinds/Presets, s. Phase 5/6) — kein hart
    // codierter Text. Blendet mit dem Intro-Ende wieder aus.
    if (this.elControlsHint) {
      const localHumans = this.config.players.filter((p) => p.isLocal && p.type === 'human');
      this.elControlsHint.innerHTML = localHumans.map((p) => {
        const prefix = localHumans.length > 1 ? `<b>${p.name}:</b> ` : '';
        return `<div>${prefix}${pieceControlHint(p.bindings?.piece)}</div>`;
      }).join('');
      this.elControlsHint.classList.toggle('show', localHumans.length > 0);
    }
  }

  _updateIntro(dt) {
    this.introT += dt;
    const t = Math.min(1, this.introT / this.introDuration);
    const eased = 1 - Math.pow(1 - t, 3);
    for (const v of this.views) {
      v.camera.position.lerpVectors(this.camOverview, this.camBase, eased);
      v.camera.lookAt(0, 1, 0);
    }
    if (t >= 1) {
      this.introActive = false;
      for (const v of this.views) v.camera.position.copy(this.camBase);
      if (this.introEl) {
        const el = this.introEl;
        el.classList.remove('show'); el.classList.add('hide');
        setTimeout(() => el.remove(), 600);
        this.introEl = null;
      }
      if (this.elControlsHint) this.elControlsHint.classList.remove('show');
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
    let fps = this.config.fpsLimit();
    // Splitscreen rendert zweimal pro Frame — ein unbegrenztes Limit wäre
    // dann ein echtes Perf-Risiko, deshalb intern auf 60 klemmen.
    if (this.config.split && fps === 0) fps = 60;
    if (fps > 0 && elapsed < 1000 / fps - 0.5) return;
    this.last = now;
    const dt = Math.min(0.05, elapsed / 1000);

    if (!this.paused) {
      if (this.introActive) this._updateIntro(dt);
      else if (this.running) {
        if (this.role === 'guest') this._stepReplica(dt);
        else this._step(dt);
      }
    }

    this._animate(dt);
    this._updatePieceViews(dt);
    this._renderViews();
    this._updateLabels();
  }

  // Fallendes Teil + Geistervorschau JEDER Spieler, jeden Frame — unabhängig
  // von Pause (sitzt dann einfach unverändert an der letzten Position).
  // Host: Playfield.piece ist live. Gast: Playfield läuft für NIEMANDEN lokal
  // (auch nicht für den eigenen Spieler, s. Kommentar bei _netPiece) — dort
  // kommt piece IMMER aus dem zuletzt empfangenen Snapshot.
  _updatePieceViews(dt) {
    for (const p of this.players) {
      const piece = this.role === 'guest' ? p._netPiece : p.field.piece;
      if (p.eliminated || !piece) { p.pieceView.hide(); p.ghostView.hide(); continue; }
      const color = PIECE_COLORS[piece.type] || 0xffffff;
      p.pieceView.setColor(color);
      p.pieceView.update(piece, dt);
      // dropRow() ist eine reine Funktion von (type,rot,col) gegen das
      // aktuelle Zellenraster — beim Gast ist das Raster über die Grid-
      // Snapshots (s. _applyGridString) synchron, auch wenn field.piece
      // selbst dort nicht mitläuft. Funktioniert daher für Host UND Gast
      // identisch, ohne den Sonderfall gesondert zu behandeln.
      const landRow = p.field.dropRow(piece.type, piece.rot, piece.col);
      p.ghostView.setColor(color);
      p.ghostView.updateGhost(piece, landRow);
    }
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
    for (const row of this._netSnap.p) {
      const [id, flags, angle, stability, topRow, pCol, pRow, pTypeIdx, pRot] = row;
      const p = this.players.find((pl) => pl.id === id);
      if (!p) continue;
      p.alive = !!(flags & 1);
      const falling = !!(flags & 2);
      p.tower.angle += (angle - p.tower.angle) * lerp;
      p.tower.pivot.rotation.z = p.tower.angle;
      p.tower.stability = stability;
      p.field.topRow = topRow;
      if (falling && p.tower.state !== 'falling') p.tower.collapse();
      if (!p.alive) p.eliminated = true;
      // Fallendes Teil des Spielers für die Optik (s. PieceView/_updatePieceViews)
      // — trailing Felder, defensiv geprüft (ältere Host-Snapshots ohne diese
      // vier Felder liefern einfach kein Teil, statt zu crashen).
      p._netPiece = (pTypeIdx !== undefined && pTypeIdx >= 0)
        ? { col: pCol, row: pRow, type: PIECE_TYPES[pTypeIdx], rot: pRot || 0 }
        : null;
    }
    if (this._netSnap.g) {
      for (const id in this._netSnap.g) this._applyGridString(id, this._netSnap.g[id]);
    }
    // Jetzt billig (gecachtes DOM, s. _renderHud) — läuft deshalb wie beim
    // Host bedenkenlos jeden Frame, statt nur bei einer Alive-Änderung.
    this._renderHud();
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
      p: this.players.map((p) => {
        const piece = p.field.piece;
        return [
          p.id,
          (p.alive ? 1 : 0) | (p.tower.state === 'falling' ? 2 : 0),
          round2(p.tower.angle), round2(p.tower.stability), p.field.topRow,
          // Trailing: fallendes Teil (für PieceView beim Gast, s. _stepReplica).
          // typeIdx -1 = kein Teil (eliminiert/gerade eingerastet).
          piece ? piece.col : 0, piece ? piece.row : 0,
          piece ? PIECE_TYPES.indexOf(piece.type) : -1, piece ? piece.rot : 0,
        ];
      }),
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
    if (this.views.length > 1) {
      this._updateSplitCameras(dt);
      return;
    }
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

  // Splitscreen-Kameras: jede Hälfte dollyt auf den EIGENEN Turm (statt wie
  // im Einzelbild-Pfad auf den global höchsten) und schaut aufs eigene
  // Podest statt auf den Ursprung — sonst identische Dolly-Formel wie oben,
  // nur um das eigene Podest statt (0,0) zentriert.
  _updateSplitCameras(dt) {
    if (this.introActive) return;
    for (const v of this.views) {
      const p = this.players.find((pl) => pl.id === v.playerId);
      if (!p) continue;
      const pos = this.podiumPositions[p.podiumIndex % this.podiumPositions.length];
      const height = (ROWS - p.field.topRow) * CELL;
      const dolly = Math.min(10, height * 0.35);
      const riseY = Math.min(6, height * 0.25);
      const target = new THREE.Vector3(pos.x + this.camBase.x, this.camBase.y + riseY, pos.z + this.camBase.z + dolly);
      v.camera.position.lerp(target, Math.min(1, dt * 2));
      v.camera.lookAt(pos.x, Math.min(6, height * 0.5), pos.z);
    }
  }

  // Rendert entweder die volle Bühne (Einzelbild, exakt der alte Aufruf) oder
  // teilt Viewport+Scissor pro Splitscreen-Hälfte auf — s. block-bomb/main.js
  // _renderViews() für die Begründung des Bottom-Up-rect (kein Flip hier).
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
      const height = (ROWS - p.field.topRow) * CELL;
      // Splitscreen: Label folgt der Kamera-Hälfte des jeweiligen Spielers;
      // Bots/Remote (keine eigene Hälfte) werden immer über views[0] projiziert.
      const view = this.views.find((vw) => vw.playerId === p.id) || this.views[0];
      const rect = this._viewPixelRect(view, w, h);
      vec.set(p.tower.pivot.position.x, this.map.podiumY + height + 1.0, p.tower.pivot.position.z).project(view.camera);
      const sx = rect.left + (vec.x * 0.5 + 0.5) * rect.width;
      const sy = rect.top + (-vec.y * 0.5 + 0.5) * rect.height;
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
    for (const p of this.players) {
      if (p.controller.detach) p.controller.detach();
      p.tower.dispose();
      p.pieceView.dispose();
      p.ghostView.dispose();
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
  isPaused() { return !!current && current.paused; },
  getSnapshot() { return current ? current.getSnapshot() : null; },
  applySnapshot(payload) { if (current) current.applySnapshot(payload); },
  getMyInput() { return current ? current.getMyInput() : RUSH_REMOTE_ADAPTER.initial(); },
  feedRemoteInput(peerId, intent) { if (current) current.feedRemoteInput(peerId, intent); },
  convertToBot(peerId) { if (current) current.convertToBot(peerId); },
};
