// Farbjagd — Spielkern (2D-DOM-Runde, bewusst KEIN Three.js: das Genre hat
// keine Bewegung/Kamera, eine volle 3D-Bühne wäre reiner Mehraufwand ohne
// Spielwert — s. ROADMAP/DOKUMENTATION).
//
// Rundenbasiert statt Last-Man-Standing: JEDER Spieler ist zweimal
// (TURNS_PER_PLAYER) der Jäger, die übrigen sind gleichzeitig Störer. Ein Zug
// hat vier Phasen: intro → show (Zielfarbe für alle sichtbar, Eingabe
// gesperrt) → mix (Zielfarbe verborgen, alle regeln live) → reveal (Auflösung
// + Punkte). NUR der Jäger punktet (scoreFor() aus color.js, CIEDE2000-
// basiert — s. dort). Nach dem letzten Zug entscheidet die Punktesumme
// (Gleichstand → bester Einzelzug, sonst Zufall), s. onResult-Vertrag unten.
//
// Wie die anderen drei Spiele liest der Kern pro Frame NUR den Intent jedes
// Controllers (../game/controllers.js) — Mensch/Bot/Remote sind austauschbar
// und der Kern kennt ihre Herkunft nicht. Intent-Form (KEIN {x,z}-Bewegungs-
// intent, s. LocalColorController dort): { d:[dr,dg,db], cur, lock, seq } —
// Ereignis-Zähler wie bei Block Rush, aus demselben Grund: 20-Hz-Online-
// Polling (app.js getMyInput()) darf keine Eingaben verschlucken.
//
//   start(config) — config:
//     host        DOM-Element für HUD + Bühne (reines DOM, kein Canvas)
//     players     [{ id, name, colorHex, type, difficulty, isLocal, keys, peerId, bindings }]
//     mapId       'atelier' | 'kaleido' | 'blitz'
//     fpsLimit()  → Zahl (0 = unbegrenzt)
//     reducedFx() → bool
//     sfx(name)   Soundeffekt
//     onResult(result) — result = { winner, placements } (1.→letzter, nach Gesamtpunkten)
//     onExit()    — vom Pausemenü (von app.js getriggert)

'use strict';

import { LocalColorController, BotController, RemoteController } from '../game/controllers.js';
import { mapMeta } from './maps.js';
import { scoreFor, randomTargetColor, clamp255 } from './color.js';
import { makeColorHuntBotBrain } from './bots.js';

const TURNS_PER_PLAYER = 2;
const PHASE_INTRO = 1.2;
const PHASE_REVEAL = 2.8;
const START_RGB = Object.freeze([125, 125, 125]);

function round1(v) { return Math.round(v * 10) / 10; }
function rgbCss([r, g, b]) { return `rgb(${r},${g},${b})`; }
function slim(p) { return { id: p.id, name: p.name, colorHex: p.colorHex }; }

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Adapter für RemoteController (s. controllers.js): der Intent ist ein
// Ereignis-Zähler, kein {x,z} — Empfangenes wird AUFADDIERT statt ersetzt und
// erst beim Lesen (update()) geleert, damit auch bei verpassten Polls kein
// Tastendruck verloren geht. Gleiches Muster wie RUSH_REMOTE_ADAPTER.
const COLOR_REMOTE_ADAPTER = {
  initial: () => ({ d: [0, 0, 0], cur: 0, lock: 0, seq: 0 }),
  merge: (pending, incoming) => ({
    d: [
      pending.d[0] + ((incoming.d && incoming.d[0]) || 0),
      pending.d[1] + ((incoming.d && incoming.d[1]) || 0),
      pending.d[2] + ((incoming.d && incoming.d[2]) || 0),
    ],
    cur: incoming.cur != null ? incoming.cur : pending.cur,
    lock: pending.lock + (incoming.lock || 0),
    seq: incoming.seq || pending.seq,
  }),
  drain: (pending) => ({
    value: pending,
    next: { d: [0, 0, 0], cur: pending.cur, lock: 0, seq: pending.seq },
  }),
};

// Kurze Tastenbeschriftung für den Steuerungs-Hinweis im Intro. Die App-Ebene
// (renderer/keybinds.js) ist ein klassisches Script und für dieses ES-Modul
// nicht erreichbar (kein window.Keybinds) — wie schon in game/controllers.js
// (LEGACY_*) und block-rush/main.js (KEY_LABELS) halten wir hier eine EIGENE,
// unabhängige Kurzkopie nur für die Beschriftung.
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
function colorControlHint(bindings) {
  const b = (bindings && bindings.color) || {};
  const k = labelKey;
  return `${k(b.left)}/${k(b.right)} Kanal · ${k(b.up)}/${k(b.down)} Wert · ${k(b.lock)} Fertig`;
}

class ColorHuntGame {
  constructor(config) {
    this.config = config;
    this.host = config.host;
    // Online-Sessions: 'host' simuliert normal UND liefert getSnapshot();
    // 'guest' überspringt die komplette Spiellogik und rendert nur den
    // zuletzt empfangenen Snapshot (s. _stepReplica).
    this.role = config.role === 'guest' ? 'guest' : 'host';
    this.map = mapMeta(config.mapId);

    this.running = false;
    this.paused = false;
    this.ended = false;
    this.last = 0;
    this.raf = null;

    this.phase = 'intro';
    this.phaseT = 0;
    this.turnIndex = -1;
    this.target = null;
    this._hunterLockedEarly = false;
    this._tickedSecond = null;
    this._netSnap = null;
    this._myIntent = COLOR_REMOTE_ADAPTER.initial();

    this._initPlayers();
    // Zugreihenfolge: TURNS_PER_PLAYER Runden, je eine frisch gemischte
    // Reihenfolge aller Spieler-IDs (kein Anspruch auf "nie zwei Züge
    // hintereinander gleich" über die Rundengrenze hinweg — nicht nötig).
    this.turnOrder = [];
    for (let round = 0; round < TURNS_PER_PLAYER; round++) {
      this.turnOrder.push(...shuffled(this.players.map((p) => p.id)));
    }

    this._initDom();
  }

  _initPlayers() {
    this.players = this.config.players.map((p) => {
      let controller;
      if (p.isLocal && p.type === 'human') controller = new LocalColorController(p.bindings?.color || p.keys || 'wasd');
      else if (p.type === 'remote') controller = new RemoteController(p.peerId || p.id, COLOR_REMOTE_ADAPTER);
      else controller = new BotController(makeColorHuntBotBrain(p.difficulty || 'medium'));
      if (controller.attach) controller.attach();
      return {
        id: p.id, name: p.name, colorHex: p.colorHex, isLocal: !!p.isLocal, type: p.type,
        bindings: p.bindings || null,
        controller,
        rgb: START_RGB.slice(), cur: 0, locked: false,
        isHunter: false, total: 0, last: null, bestTurn: -1,
      };
    });
  }

  // ── DOM-Aufbau (einmalig) ────────────────────────────────────────────
  _initDom() {
    this.host.innerHTML = '';
    this.host.classList.add('ch-stage');

    const hud = document.createElement('div');
    hud.className = 'ch-hud';
    hud.innerHTML = `
      <div class="ch-top">
        <span class="ch-title">Farbjagd</span>
        <span class="ch-turn" id="chTurn"></span>
        <span class="ch-timer" id="chTimer"></span>
      </div>
      <div class="ch-arena" id="chArena"></div>
      <div class="ch-reveal" id="chReveal" hidden>
        <div class="ch-reveal-swatches">
          <div class="ch-reveal-swatch" id="chRevealTarget"><span>Ziel</span></div>
          <div class="ch-reveal-vs">vs</div>
          <div class="ch-reveal-swatch" id="chRevealMix"><span>Mischung</span></div>
        </div>
        <div class="ch-reveal-score" id="chRevealScore"></div>
      </div>
      <div class="ch-chips" id="chChips"></div>
      <div class="ch-controls-hint" id="chControlsHint"></div>
      <div class="ch-message" id="chMessage"></div>
      <div class="ch-map-intro-name" id="chMapIntro"></div>
    `;
    this.host.appendChild(hud);

    this.elTurn = hud.querySelector('#chTurn');
    this.elTimer = hud.querySelector('#chTimer');
    this.elArena = hud.querySelector('#chArena');
    this.elReveal = hud.querySelector('#chReveal');
    this.elRevealTarget = hud.querySelector('#chRevealTarget');
    this.elRevealMix = hud.querySelector('#chRevealMix');
    this.elRevealScore = hud.querySelector('#chRevealScore');
    this.elChips = hud.querySelector('#chChips');
    this.elControlsHint = hud.querySelector('#chControlsHint');
    this.elMessage = hud.querySelector('#chMessage');
    this.elMapIntro = hud.querySelector('#chMapIntro');

    this.elArena.classList.add(`ch-layout-${this.map.layout}`);
    if (this.config.reducedFx && this.config.reducedFx()) this.host.classList.add('reduced-fx');

    this._buildChips();
    this._buildArenaShell();

    const localHumans = this.players.filter((p) => p.isLocal && p.type === 'human');
    this.elControlsHint.innerHTML = '';
    for (const p of localHumans) {
      const row = document.createElement('div');
      if (localHumans.length > 1) {
        const b = document.createElement('b');
        b.textContent = p.name + ': ';
        row.appendChild(b);
      }
      row.appendChild(document.createTextNode(colorControlHint(p.bindings)));
      this.elControlsHint.appendChild(row);
    }
  }

  // Roster-Streifen: ein Chip pro Spieler mit Name (Lobby-Farbe), Rolle,
  // R/G/B-Balken (Text+Balken, nicht nur die Farbfläche — hilft z.B. bei
  // Farbsehschwäche) und Eingeloggt-Haken. Jeden Frame aktualisiert.
  _buildChips() {
    this.elChips.innerHTML = '';
    this.chipEls = new Map();
    for (const p of this.players) {
      const chip = document.createElement('div');
      chip.className = 'ch-chip';
      chip.style.setProperty('--c', p.colorHex);

      const name = document.createElement('span');
      name.className = 'ch-chip-name';
      name.textContent = p.name;

      const role = document.createElement('span');
      role.className = 'ch-chip-role';

      const bars = document.createElement('span');
      bars.className = 'ch-chip-bars';
      const fills = [];
      for (const cls of ['ch-bar-r', 'ch-bar-g', 'ch-bar-b']) {
        const bar = document.createElement('span');
        bar.className = `ch-bar ${cls}`;
        const fill = document.createElement('span');
        bar.appendChild(fill);
        bars.appendChild(bar);
        fills.push(fill);
      }

      const lock = document.createElement('span');
      lock.className = 'ch-chip-lock';
      lock.textContent = '✓';

      chip.append(name, role, bars, lock);
      this.elChips.appendChild(chip);
      this.chipEls.set(p.id, { root: chip, role, fills, lock });
    }
  }

  // Arena-Kacheln je Layout einmalig aufbauen — nur die Zuordnung
  // Kachel→Spieler ändert sich pro Zug (s. _assignArenaRoles()). Die
  // Jäger-Kachel ist in allen drei Layouts die optisch größte/zentrale
  // (dort steht in Phase "show" die Zielfarbe groß für alle sichtbar).
  _buildArenaShell() {
    this.elArena.innerHTML = '';
    this.arenaTiles = []; // { el, role: 'hunter'|'decoy', decoyIndex?, playerId }
    const decoyCount = Math.max(1, this.players.length - 1);

    if (this.map.layout === 'blitz') {
      // 5×5-Mosaik: Mitte 3×3 = Jäger (explizit platziert), die restlichen
      // 16 Randzellen fließen automatisch um den belegten Block herum (CSS-
      // Grid-Auto-Placement überspringt besetzte Zellen von selbst) und
      // gehen reihum an die Störer.
      const grid = document.createElement('div');
      grid.className = 'ch-blitz-grid';
      const hunterCell = document.createElement('div');
      hunterCell.className = 'ch-tile ch-blitz-hunter';
      grid.appendChild(hunterCell);
      this.arenaTiles.push({ el: hunterCell, role: 'hunter' });
      for (let i = 0; i < 16; i++) {
        const cell = document.createElement('div');
        cell.className = 'ch-tile ch-blitz-cell';
        grid.appendChild(cell);
        this.arenaTiles.push({ el: cell, role: 'decoy', decoyIndex: i % decoyCount });
      }
      this.elArena.appendChild(grid);
    } else {
      // Eigener Wrapper für die Störer-Kacheln (statt CSS-Geschwister-
      // Selektoren auf flache Kinder von .ch-ring) — so bleibt die Anordnung
      // je Layout (Atelier: Reihe unterhalb; Kaleidoskop: Ring drumherum)
      // in CSS robust, unabhängig von der Störer-Anzahl (2 oder 3).
      const ring = document.createElement('div');
      ring.className = 'ch-ring';
      const hunterTile = document.createElement('div');
      hunterTile.className = 'ch-tile ch-hunter-tile';
      ring.appendChild(hunterTile);
      this.arenaTiles.push({ el: hunterTile, role: 'hunter' });
      const decoyWrap = document.createElement('div');
      decoyWrap.className = 'ch-decoy-wrap';
      for (let i = 0; i < decoyCount; i++) {
        const tile = document.createElement('div');
        tile.className = 'ch-tile ch-decoy-tile';
        if (this.map.layout === 'kaleido') {
          tile.style.setProperty('--angle', `${(360 / decoyCount) * i}deg`);
        }
        decoyWrap.appendChild(tile);
        this.arenaTiles.push({ el: tile, role: 'decoy', decoyIndex: i });
      }
      ring.appendChild(decoyWrap);
      this.elArena.appendChild(ring);
    }
  }

  // ── Zug-Lebenszyklus (nur Host) ───────────────────────────────────────
  _startTurn() {
    this.turnIndex++;
    if (this.turnIndex >= this.turnOrder.length) { this._finish(); return; }
    const hunterId = this.turnOrder[this.turnIndex];
    for (const p of this.players) {
      p.rgb = START_RGB.slice();
      p.cur = 0;
      p.locked = false;
      p.isHunter = p.id === hunterId;
      p.last = null;
      if (p.controller.clear) p.controller.clear();
    }
    this.target = randomTargetColor();
    this.phase = 'intro';
    this.phaseT = PHASE_INTRO;
    this._hunterLockedEarly = false;
    this._tickedSecond = null;
    this._assignArenaRoles();
    const hunter = this.players.find((p) => p.isHunter);
    this._message(`Zug ${this.turnIndex + 1}/${this.turnOrder.length} — ${hunter.name} jagt!`);
  }

  _assignArenaRoles() {
    const hunter = this.players.find((p) => p.isHunter);
    const decoys = this.players.filter((p) => !p.isHunter);
    if (!hunter) return;
    for (const tile of this.arenaTiles) {
      tile.playerId = tile.role === 'hunter' ? hunter.id : (decoys[tile.decoyIndex % decoys.length] || decoys[0] || hunter).id;
    }
  }

  begin() {
    this.running = true;
    this.last = performance.now();
    if (this.role !== 'guest') this._startTurn();
    this._showMapIntro();
    this.raf = requestAnimationFrame((t) => this._loop(t));
  }

  _showMapIntro() {
    this.elMapIntro.textContent = this.map.name;
    requestAnimationFrame(() => this.elMapIntro.classList.add('show'));
    setTimeout(() => {
      this.elMapIntro.classList.remove('show');
    }, 1800);
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

    if (!this.paused && this.running) {
      if (this.role === 'guest') this._stepReplica(dt);
      else this._step(dt);
    }
  }

  // ── Host: Zustandsautomat ──────────────────────────────────────────
  _step(dt) {
    this._pollControllers(dt);

    this.phaseT -= dt;
    if (this.phase === 'intro') {
      if (this.phaseT <= 0) { this.phase = 'show'; this.phaseT = this.map.showTime; this.config.sfx('colorShow'); }
    } else if (this.phase === 'show') {
      if (this.phaseT <= 0) { this.phase = 'mix'; this.phaseT = this.map.mixTime; this._tickedSecond = Math.ceil(this.phaseT); }
    } else if (this.phase === 'mix') {
      const secLeft = Math.ceil(Math.max(0, this.phaseT));
      if (secLeft <= 3 && secLeft !== this._tickedSecond) {
        this._tickedSecond = secLeft;
        if (secLeft > 0) this.config.sfx('colorTick');
      }
      if (this.phaseT <= 0 || this._hunterLockedEarly) this._endMix();
    } else if (this.phase === 'reveal') {
      if (this.phaseT <= 0) this._startTurn();
    }
    this._renderFrame();
  }

  // Intents werden JEDEN Frame abgefragt (sonst würden während der Sperre
  // gedrückt gehaltene Tasten Eingaben aufstauen, die beim Phasenwechsel
  // schlagartig ausgelöst würden — der Controller kennt die Spielphase
  // nicht, s. controllers.js), aber nur in "mix" wirklich angewendet.
  _pollControllers(dt) {
    const world = this._world();
    for (const p of this.players) {
      const intent = p.controller.update(p, world, dt);
      if (this.phase !== 'mix' || !intent) continue;
      for (let c = 0; c < 3; c++) {
        if (intent.d && intent.d[c]) p.rgb[c] = clamp255(p.rgb[c] + intent.d[c]);
      }
      if (typeof intent.cur === 'number') p.cur = intent.cur;
      if (intent.lock && p.isHunter && !p.locked) {
        p.locked = true;
        this._hunterLockedEarly = true;
        this.config.sfx('colorLock');
      }
    }
  }

  // Zielfarbe nur in "show" sichtbar — exakt so lange, wie ein Mensch sie
  // auch sieht (gilt für Bots genauso, s. bots.js: kein Cheaten).
  _world() {
    return {
      phase: this.phase,
      turnIndex: this.turnIndex,
      target: this.phase === 'show' ? this.target : null,
    };
  }

  _endMix() {
    if (this.phase !== 'mix') return;
    const hunter = this.players.find((p) => p.isHunter);
    const score = scoreFor(hunter.rgb, this.target);
    hunter.total += score;
    hunter.last = score;
    hunter.bestTurn = Math.max(hunter.bestTurn, score);
    this.phase = 'reveal';
    this.phaseT = PHASE_REVEAL;
    this._hunterLockedEarly = false;
    this.config.sfx(score >= 90 ? 'colorPerfect' : 'colorReveal');
    this._message(`${hunter.name}: ${score} Punkte!`);
  }

  // Platzierung: Punktesumme über beide Züge, Gleichstand → besserer
  // Einzelzug, sonst Zufall (analog zum Serien-Tiebreak in app.js).
  _finish() {
    if (this.ended) return;
    this.ended = true;
    this.running = false;
    const ranked = this.players.slice().sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      if (b.bestTurn !== a.bestTurn) return b.bestTurn - a.bestTurn;
      return Math.random() - 0.5;
    });
    const placements = ranked.map(slim);
    const winner = placements[0] || null;
    if (winner) this._message(`🏆 ${winner.name} gewinnt Farbjagd!`);
    this.config.sfx('colorWin');
    setTimeout(() => {
      this.config.onResult({ winner, placements });
    }, 1400);
  }

  // ── Gast-Wiedergabe (Online-Session) ─────────────────────────────────
  // Eigener Regler wird lokal weiterbedient (Eingabe wird gesammelt und per
  // getMyInput() an den Host geschickt) — alles andere kommt aus dem
  // Snapshot. Turn-Ansage/Punkte-Meldung werden aus dem Phasenwechsel
  // hergeleitet statt über ein eigenes Netz-Event (s. Kommentar unten).
  _stepReplica(dt) {
    const world = this._world();
    for (const p of this.players) {
      if (p.isLocal) this._myIntent = p.controller.update(p, world, dt) || this._myIntent;
    }
    if (!this._netSnap) { this._renderFrame(); return; }
    const snap = this._netSnap;
    const turnChanged = this.turnIndex !== snap.ti;
    const prevPhase = this.phase;
    this.phase = snap.ph;
    this.turnIndex = snap.ti;
    this.phaseT = snap.t;
    this.target = snap.tg;
    for (const row of snap.p) {
      const [id, r, g, b, cur, locked, total, last] = row;
      const p = this.players.find((pl) => pl.id === id);
      if (!p) continue;
      p.rgb = [r, g, b];
      p.cur = cur;
      p.locked = !!locked;
      p.total = total;
      p.last = last === -1 ? null : last;
      p.isHunter = id === snap.hu;
    }
    const hunter = this.players.find((p) => p.isHunter);
    if (turnChanged) {
      this._assignArenaRoles();
      if (hunter) this._message(`Zug ${this.turnIndex + 1}/${this.turnOrder.length} — ${hunter.name} jagt!`);
    } else if (prevPhase !== 'reveal' && this.phase === 'reveal' && hunter && hunter.last != null) {
      this._message(`${hunter.name}: ${hunter.last} Punkte!`);
    }
    this._renderFrame();
  }

  // Host: kompakter Stand für den Broadcast.
  getSnapshot() {
    return {
      ph: this.phase,
      ti: this.turnIndex,
      t: round1(Math.max(0, this.phaseT)),
      hu: (this.players.find((p) => p.isHunter) || {}).id ?? null,
      // Zielfarbe nur übertragen, wenn ein Gast sie auch sehen dürfte
      // (show: aktiv jagen; reveal: Auflösung) — sonst kein Cheat-Vektor.
      tg: (this.phase === 'show' || this.phase === 'reveal') ? this.target : null,
      p: this.players.map((p) => [p.id, p.rgb[0], p.rgb[1], p.rgb[2], p.cur, p.locked ? 1 : 0, p.total, p.last == null ? -1 : p.last]),
    };
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
    p.controller = new BotController(makeColorHuntBotBrain('medium'));
  }

  // ── reine Optik ───────────────────────────────────────────────────
  _message(text) {
    if (!text) { this.elMessage.classList.remove('show'); return; }
    this.elMessage.textContent = text;
    this.elMessage.classList.remove('show');
    void this.elMessage.offsetWidth;
    this.elMessage.classList.add('show');
  }

  _renderFrame() {
    const total = this.turnOrder.length;
    this.elTurn.textContent = this.turnIndex >= 0 ? `Zug ${Math.min(this.turnIndex + 1, total)}/${total}` : '';

    const showTimer = this.phase === 'show' || this.phase === 'mix';
    this.elTimer.textContent = showTimer ? String(Math.max(0, Math.ceil(this.phaseT))) : '';
    this.elTimer.classList.toggle('warn', this.phase === 'mix' && this.phaseT <= 3);

    this.elArena.classList.toggle('input-locked', this.phase !== 'mix');
    this.elControlsHint.classList.toggle('show', this.phase === 'intro' || this.phase === 'show');

    // Arena: in "show" zeigt die Jäger-Kachel die Zielfarbe (für ALLE
    // sichtbar), sonst überall die jeweils eigene aktuelle Mischung.
    for (const tile of this.arenaTiles) {
      const p = this.players.find((pl) => pl.id === tile.playerId);
      if (!p) continue;
      const rgb = (this.phase === 'show' && tile.role === 'hunter' && this.target) ? this.target : p.rgb;
      tile.el.style.setProperty('--c', rgbCss(rgb));
      tile.el.classList.toggle('locked', !!p.locked);
    }

    // Reveal-Panel: wird aus dem laufenden Stand hergeleitet (this.target
    // bleibt bis zum nächsten Zug erhalten, hunter.rgb ist die zuletzt
    // eingeloggte Mischung) — funktioniert identisch für Host UND Gast,
    // ohne einen separaten "letztes Ergebnis"-Zwischenspeicher.
    const inReveal = this.phase === 'reveal';
    this.elReveal.hidden = !inReveal;
    this.elArena.classList.toggle('hidden', inReveal);
    if (inReveal && this.target) {
      const hunter = this.players.find((p) => p.isHunter);
      if (hunter) {
        this.elRevealTarget.style.setProperty('--c', rgbCss(this.target));
        this.elRevealMix.style.setProperty('--c', rgbCss(hunter.rgb));
        this.elRevealScore.textContent = hunter.last != null ? `${hunter.name}: ${hunter.last} Punkte` : '';
      }
    }

    // Roster-Chips
    for (const p of this.players) {
      const ce = this.chipEls.get(p.id);
      if (!ce) continue;
      ce.role.textContent = p.isHunter ? '🎯' : '🌀';
      ce.root.classList.toggle('is-hunter', p.isHunter);
      ce.root.classList.toggle('locked', p.locked);
      ce.fills.forEach((fill, i) => { fill.style.width = `${(p.rgb[i] / 255) * 100}%`; });
      ce.lock.classList.toggle('show', p.locked);
    }
  }

  destroy() {
    this.running = false;
    this.ended = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    for (const p of this.players) if (p.controller.detach) p.controller.detach();
    if (this.host) this.host.innerHTML = '';
  }
}

let current = null;
window.ColorHunt = {
  start(config) {
    if (current) current.destroy();
    current = new ColorHuntGame(config);
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
  getMyInput() { return current ? current.getMyInput() : COLOR_REMOTE_ADAPTER.initial(); },
  feedRemoteInput(peerId, intent) { if (current) current.feedRemoteInput(peerId, intent); },
  convertToBot(peerId) { if (current) current.convertToBot(peerId); },
};
