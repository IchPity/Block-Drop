'use strict';

// ── Achievements ───────────────────────────────────────────────────────────
const ACH_DEFS = {
  bd_first:    { name: 'Anfänger',               desc: 'Dein erstes Spiel gestartet',         icon: '🎮' },
  bd_tetris:   { name: 'TETRIS!',                desc: '4 Zeilen auf einmal gelöscht',         icon: '✨' },
  bd_combo5:   { name: 'Combo Maniac',           desc: '5× Kombo erreicht',                    icon: '🔥' },
  bd_level10:  { name: 'Speed Junkie',           desc: 'Level 10 im Classic Modus erreicht',   icon: '⚡' },
  bd_score50k: { name: 'Großverdiener',          desc: '50.000 Punkte in einem Spiel',         icon: '💰' },
  bd_lines100: { name: 'Linienkiller',           desc: '100 Zeilen in einem Spiel gelöscht',   icon: '💥' },
  bd_harddrop: { name: 'Kein Zeit für Langsam', desc: '25 Hard Drops in einem Spiel',         icon: '⬇️' },
  bd_no_hold:  { name: 'Ich brauch kein Hold',  desc: 'Spiel ohne Hold beendet',              icon: '🙅' },
  bd_score250k:{ name: 'Legende',               desc: '250.000 Punkte in einem Spiel',        icon: '🏆' },
};

function showAchOverlay(id) {
  const def = ACH_DEFS[id];
  if (!def || !window.showAchToast) return;
  window.showAchToast(def);
}

// Speichern und Abgleich mit dem Konto übernimmt window.Achievements (auth.js)
const unlockedNow = new Set(); // in dieser Sitzung schon gemeldet: spart den Blick in den Speicher
if (window.Auth) window.Auth.onChange(() => unlockedNow.clear()); // anderes Konto, andere Erfolge
function tryUnlock(id) {
  if (unlockedNow.has(id)) return;
  unlockedNow.add(id);
  if (window.Achievements) { window.Achievements.unlock(id, ACH_DEFS[id]); return; }
  showAchOverlay(id);
}

// Ohne ADHS-Modus (Menü rechts oben, /fx.js) bleibt das Spielfeld ruhig: kein Wackeln, weniger Splitter.
// Blitze, Regen und Partikelmengen der Halle dämpft fx.js selbst.
const calmFx = () => !!(window.FX && FX.adhs === false);

// ── Tetris-Spezialeffekt (4 Zeilen auf einmal) ──────────────────────────────
// Vollflächiges Konfetti + "TETRIS!"-Banner + Screen-Shake aufs Spielfeld.
function celebrateTetris() {
  const reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const COLORS_CONFETTI = ['#2ee6ff', '#ffc93a', '#a35cff', '#6dff5a', '#ff3d6e', '#4d7dff', '#ff8a2e', '#ffffff'];

  // ── "TETRIS!"-Banner ──
  const banner = document.createElement('div');
  banner.className = 'tetris-banner';
  banner.textContent = 'TETRIS!';
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 1600);

  // ── Screen-Shake aufs Spielfeld ──
  if (!reduceMotion && window.FX) {
    FX.flash('#ffb000', 520); FX.pulse('#ffb000', 1.4); FX.streak(innerHeight * 0.4, '#ffb000');
    FX.rain({ kind: 'block', ms: 2000, per: 5, colors: COLORS_CONFETTI, bounce: true });
    FX.rain({ kind: 'confetti', ms: 1700, per: 6, colors: COLORS_CONFETTI, bounce: false });
    FX.shake(document.getElementById('wrapper'), 12, 600);
  }
  if (!reduceMotion && !calmFx()) {
    const area = document.getElementById('game-area');
    if (area) {
      area.classList.remove('tetris-shake');
      void area.offsetWidth; // Reflow erzwingen, damit die Animation neu startet
      area.classList.add('tetris-shake');
      setTimeout(() => area.classList.remove('tetris-shake'), 650);
    }
  }
}

// ── Constants ──────────────────────────────────────────────────────────────
const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const PREVIEW_COUNT = 5;

// ── Aussehen (Esc → Anpassen) ──────────────────────────────────────────────
// Neon sind die Phosphorfarben, die auch im Automaten auf der Startseite laufen
const PALETTES = {
  neon:     { name: 'Neon',     colors: { I: '#2ee6ff', O: '#ffc93a', T: '#a35cff', S: '#6dff5a', Z: '#ff3d6e', J: '#4d7dff', L: '#ff8a2e' } },
  klassik:  { name: 'Klassik',  colors: { I: '#00e0e0', O: '#f0e000', T: '#b030f0', S: '#00d840', Z: '#f02020', J: '#2050f0', L: '#f09000' } },
  pastell:  { name: 'Pastell',  colors: { I: '#9be7ff', O: '#ffe9a3', T: '#d3b3ff', S: '#b6f2a8', Z: '#ffa8bd', J: '#a9bdff', L: '#ffc79e' } },
  kontrast: { name: 'Kontrast', colors: { I: '#56b4e9', O: '#f0e442', T: '#cc79a7', S: '#009e73', Z: '#d55e00', J: '#0072b2', L: '#e69f00' } }, // auch bei Farbsehschwäche gut zu trennen
};
const STYLES = {
  glanz: { name: 'Glanz' },
  flach: { name: 'Flach' },
  neon:  { name: 'Röhre' },
  retro: { name: 'Retro' },
};
const BACKDROPS = {
  halle:   { name: 'Halle',   css: 'radial-gradient(ellipse 90% 60% at 50% 100%, #150a36, #05030c 72%)' },
  schwarz: { name: 'Schwarz', css: '#000' },
  tafel:   { name: 'Tafel',   css: 'radial-gradient(ellipse 90% 60% at 50% 100%, #1d3a2c, #0b1711 72%)' },
  meer:    { name: 'Tiefsee', css: 'linear-gradient(180deg, #04101f, #0a2f4a)' },
  glut:    { name: 'Glut',    css: 'linear-gradient(180deg, #0d0514 30%, #3a1030 78%, #5e2016)' },
};
const LOOK_DEFAULT = { style: 'glanz', bg: 'halle', ghost: true, grid: true };

// Die Farbe hängt am Steintyp (Feld und Steine merken sich nur I, O, T …):
// so färbt eine Änderung auch alles um, was schon liegt.
const COLORS = { ...PALETTES.neon.colors };
const look = { ...LOOK_DEFAULT };
const LOOK_KEY = 'blockdrop_look';
const HEX = /^#[0-9a-f]{6}$/i;
const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

(function loadLook() {
  let s;
  try { s = JSON.parse(localStorage.getItem(LOOK_KEY)); } catch (e) {}
  if (!s || typeof s !== 'object') return;
  for (const k in COLORS) if (s.colors && HEX.test(s.colors[k])) COLORS[k] = s.colors[k].toLowerCase();
  if (own(STYLES, s.style)) look.style = s.style;
  if (own(BACKDROPS, s.bg)) look.bg = s.bg;
  look.ghost = s.ghost !== false;
  look.grid  = s.grid !== false;
})();

function saveLook() {
  try { localStorage.setItem(LOOK_KEY, JSON.stringify({ colors: COLORS, ...look })); } catch (e) {}
}

const HELD_USED = '#6a6190'; // gehaltener Stein, der in dieser Runde schon getauscht wurde

const PIECES = {
  I: { shape: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]] },
  O: { shape: [[1,1],[1,1]] },
  T: { shape: [[0,1,0],[1,1,1],[0,0,0]] },
  S: { shape: [[0,1,1],[1,1,0],[0,0,0]] },
  Z: { shape: [[1,1,0],[0,1,1],[0,0,0]] },
  J: { shape: [[1,0,0],[1,1,1],[0,0,0]] },
  L: { shape: [[0,0,1],[1,1,1],[0,0,0]] },
};

const KICKS_JLSTZ = {
  '0>1': [[-1,0],[-1,1],[0,-2],[-1,-2]],
  '1>0': [[1,0],[1,-1],[0,2],[1,2]],
  '1>2': [[1,0],[1,-1],[0,2],[1,2]],
  '2>1': [[-1,0],[-1,1],[0,-2],[-1,-2]],
  '2>3': [[1,0],[1,1],[0,-2],[1,-2]],
  '3>2': [[-1,0],[-1,-1],[0,2],[-1,2]],
  '3>0': [[-1,0],[-1,-1],[0,2],[-1,2]],
  '0>3': [[1,0],[1,1],[0,-2],[1,-2]],
};

const KICKS_I = {
  '0>1': [[-2,0],[1,0],[-2,-1],[1,2]],
  '1>0': [[2,0],[-1,0],[2,1],[-1,-2]],
  '1>2': [[-1,0],[2,0],[-1,2],[2,-1]],
  '2>1': [[1,0],[-2,0],[1,-2],[-2,1]],
  '2>3': [[2,0],[-1,0],[2,1],[-1,-2]],
  '3>2': [[-2,0],[1,0],[-2,-1],[1,2]],
  '3>0': [[1,0],[-2,0],[1,-2],[-2,1]],
  '0>3': [[-1,0],[2,0],[-1,2],[2,-1]],
};

const LINE_SCORES   = [0, 100, 300, 500, 800];
const STANDARD_SPEED = 800;
const SCROLL_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ']);

// Animation timing (ms)
const ANIM_FLASH   = 160;
const ANIM_EXPLODE = 320;
const ANIM_TOTAL   = ANIM_FLASH + ANIM_EXPLODE;

function dropInterval(level) {
  return Math.max(50, 1000 * Math.pow(0.85, level - 1));
}

// ── Utilities ──────────────────────────────────────────────────────────────
function rotate(matrix, dir = 1) {
  const N = matrix.length;
  const out = Array.from({length: N}, () => Array(N).fill(0));
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      out[c][N - 1 - r] = dir === 1 ? matrix[r][c] : matrix[N-1-c][r];
  return out;
}

function deepCopy(m) { return m.map(r => [...r]); }

function easeOut(t) { return 1 - (1 - t) * (1 - t); }

// ── Steine als Sprites ─────────────────────────────────────────────────────
// Jeder Stein wird pro Farbe und Größe einmal gezeichnet (Verlauf, Glanzkante,
// Schattenkante) und danach nur noch kopiert. Das ist schärfer als die alten
// Rechtecke und kostet pro Bild fast nichts. Ändert sich das Aussehen
// (Farbe, Stil), wird der Vorrat geleert: siehe refreshLook.
const DPR = Math.min(window.devicePixelRatio || 1, 2);
const SPRITES = new Map();
function shade(hex, k) { // k < 0 dunkler, k > 0 heller
  const n = parseInt(hex.slice(1), 16), t = k < 0 ? 0 : 255, a = Math.abs(k);
  const ch = v => Math.round(v + (t - v) * a);
  return 'rgb(' + ch(n >> 16 & 255) + ',' + ch(n >> 8 & 255) + ',' + ch(n & 255) + ')';
}
function sprite(color, bs, ghost) {
  const key = color + bs + (ghost ? 'g' : '');
  let cv = SPRITES.get(key);
  if (cv) return cv;
  cv = document.createElement('canvas');
  cv.width = cv.height = Math.round(bs * DPR);
  SPRITES.set(key, cv);
  const c = cv.getContext('2d');
  c.scale(DPR, DPR);
  const r = look.style === 'retro' ? 0 : Math.max(2, bs * 0.16), a = 1, b = bs - 1;
  const box = (x0, y0, x1, y1, rad) => {
    c.beginPath();
    if (c.roundRect) { c.roundRect(x0, y0, x1 - x0, y1 - y0, rad); return; }
    // ältere Browser (Safari < 16, Firefox < 112) kennen roundRect nicht
    c.moveTo(x0 + rad, y0);
    c.arcTo(x1, y0, x1, y1, rad); c.arcTo(x1, y1, x0, y1, rad);
    c.arcTo(x0, y1, x0, y0, rad); c.arcTo(x0, y0, x1, y0, rad);
    c.closePath();
  };
  if (ghost) {
    // Landeplatz: nur der Umriss in der Farbe des Steins
    box(a + 0.5, a + 0.5, b - 0.5, b - 0.5, r);
    c.fillStyle = color; c.globalAlpha = 0.1; c.fill();
    c.globalAlpha = 0.7; c.lineWidth = 1.5; c.strokeStyle = color; c.stroke();
    return cv;
  }
  if (look.style === 'flach') {
    box(a, a, b, b, r); c.fillStyle = color; c.fill();
    return cv;
  }
  if (look.style === 'neon') {
    // Leuchtröhre: dunkler Kern, der Rand leuchtet in der Farbe des Steins
    box(a + 1, a + 1, b - 1, b - 1, r); c.fillStyle = shade(color, -0.8); c.fill();
    c.lineWidth = 2; c.strokeStyle = color; c.stroke();
    box(a + 3.5, a + 3.5, b - 3.5, b - 3.5, Math.max(0, r - 2.5));
    c.globalAlpha = 0.45; c.lineWidth = 1; c.strokeStyle = shade(color, 0.5); c.stroke();
    return cv;
  }
  if (look.style === 'retro') {
    // Kantiger Stein mit hartem Licht von links oben
    const t = Math.max(2, Math.round(bs * 0.14)), w = b - a;
    c.fillStyle = color; c.fillRect(a, a, w, w);
    c.fillStyle = shade(color, 0.45); c.fillRect(a, a, w, t); c.fillRect(a, a, t, w);
    c.fillStyle = shade(color, -0.45); c.fillRect(a, b - t, w, t); c.fillRect(b - t, a, t, w);
    return cv;
  }
  const g = c.createLinearGradient(0, a, 0, b);
  g.addColorStop(0, shade(color, 0.22)); g.addColorStop(0.5, color); g.addColorStop(1, shade(color, -0.3));
  box(a, a, b, b, r); c.fillStyle = g; c.fill();
  // Glanz oben, Schatten unten, heller Rand
  c.save(); c.clip();
  c.fillStyle = 'rgba(255,255,255,0.34)'; c.fillRect(a, a, bs, bs * 0.16);
  c.fillStyle = 'rgba(255,255,255,0.16)'; c.fillRect(a, a, bs * 0.14, bs);
  c.fillStyle = 'rgba(5,3,12,0.3)'; c.fillRect(a, b - bs * 0.14, bs, bs * 0.14);
  c.restore();
  box(a + 0.5, a + 0.5, b - 0.5, b - 0.5, r - 0.5); c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 1; c.stroke();
  const m = bs * 0.3;
  box(m, m, bs - m, bs - m, r * 0.5); c.fillStyle = 'rgba(5,3,12,0.16)'; c.fill();
  return cv;
}
// Zeichenfläche in Gerätepixeln anlegen, gezeichnet wird weiter in den alten Maßen
function hidpi(canvas) {
  const w = canvas.width, h = canvas.height;
  canvas.width = Math.round(w * DPR); canvas.height = Math.round(h * DPR);
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);
  return { ctx, w, h };
}

// ── Bag randomizer ─────────────────────────────────────────────────────────
class Bag {
  constructor() { this.bag = []; }
  next() {
    if (!this.bag.length) this._refill();
    return this.bag.pop();
  }
  _refill() {
    this.bag = Object.keys(PIECES);
    for (let i = this.bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
    }
  }
  peek(n) {
    while (this.bag.length < n) this._refill();
    return this.bag.slice(this.bag.length - n).reverse();
  }
}

// ── High scores (localStorage + Cloud) ─────────────────────────────────────
function dbSaveScore(score, mode, level, lines) {
  let all;
  try { all = JSON.parse(localStorage.getItem('arcade_scores')) || {}; }
  catch(e) { all = {}; }
  if (!all[mode]) all[mode] = [];
  all[mode].push({ score, level, lines, date: new Date().toISOString() });
  all[mode].sort((a, b) => b.score - a.score);
  all[mode] = all[mode].slice(0, 10);
  try { localStorage.setItem('arcade_scores', JSON.stringify(all)); } catch (e) {}

  // Cloud-Save wenn eingeloggt (fire-and-forget)
  if (window.Auth && window.Auth.user && score > 0) {
    window.Auth.saveScore({
      game: 'blockdrop', mode, score, level, lines
    }).catch(() => {});
  }
}

function dbLoadScores(mode) {
  let all;
  try { all = JSON.parse(localStorage.getItem('arcade_scores')) || {}; }
  catch(e) { all = {}; }
  return (all[mode] || []).slice().sort((a, b) => b.score - a.score);
}

// ── Game ───────────────────────────────────────────────────────────────────
class BlockDrop {
  constructor() {
    this.boardCanvas = document.getElementById('board');
    this.nextCanvas  = document.getElementById('next-canvas');
    this.holdCanvas  = document.getElementById('hold-canvas');
    const b = hidpi(this.boardCanvas), n = hidpi(this.nextCanvas), h = hidpi(this.holdCanvas);
    this.ctx = b.ctx; this.W = b.w; this.H = b.h;
    this.nctx = n.ctx; this.nW = n.w; this.nH = n.h;
    this.hctx = h.ctx; this.hW = h.w; this.hH = h.h;
    // Gezeichnet wird nur, wenn sich etwas geändert hat (siehe draw)
    this.boardVer = 0; this.drawnKey = ''; this.nextKey = null; this.holdDrawn = null;
    this.boardCanvas.style.background = BACKDROPS[look.bg].css;
    this.grid = this.makeGrid();

    this.scoreEl   = document.getElementById('score-display');
    this.levelEl   = document.getElementById('level-display');
    this.linesEl   = document.getElementById('lines-display');
    this.levelBar  = document.getElementById('level-bar');
    this.modeBadge = document.getElementById('mode-badge');
    this.hsListEl  = document.getElementById('hs-list');
    this.overlay   = document.getElementById('overlay');
    this.startBtn  = document.getElementById('start-btn');

    this.selectedMode = 'standard';
    this.clearAnim    = null;
    this.shake        = null;

    this._bindModeButtons();
    this.startBtn.addEventListener('click', () => this.startGame(this.selectedMode));
    // „Anpassen" steht auf Start-, Pause- und Game-Over-Schirm; die werden neu gebaut, darum hier am Rahmen
    this.overlay.addEventListener('click', e => { if (e.target.closest('[data-custom]')) Custom.open(); });
    document.addEventListener('keydown', e => this.onKey(e));

    this.state = 'idle';
    this.renderHighScores('standard');
    // Deko-Steine des Startschirms: einmal würfeln, damit sie beim Umfärben liegen bleiben
    const types = Object.keys(PIECES);
    this.idleCells = [];
    for (let r = 14; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (Math.random() > 0.4) this.idleCells.push([c, r, types[Math.floor(Math.random() * types.length)]]);
    this.drawIdleBoard();
  }

  _bindModeButtons() {
    const btnClassic  = document.getElementById('mode-classic');
    const btnStandard = document.getElementById('mode-standard');
    if (!btnClassic) return;
    btnClassic.addEventListener('click', () => {
      this.selectedMode = 'classic';
      btnClassic.classList.add('selected');
      btnStandard.classList.remove('selected');
      this.renderHighScores('classic');
    });
    btnStandard.addEventListener('click', () => {
      this.selectedMode = 'standard';
      btnStandard.classList.add('selected');
      btnClassic.classList.remove('selected');
      this.renderHighScores('standard');
    });
  }

  startGame(mode) {
    if (mode === undefined) mode = this.selectedMode || 'classic';
    this.mode = mode;
    this.selectedMode = mode;
    this.board     = Array.from({length: ROWS}, () => Array(COLS).fill(null));
    this.boardVer++;
    this.score     = 0;
    this.lines     = 0;
    this.level     = 1;
    this.combo     = -1;
    this.bag       = new Bag();
    this.holdKey       = null;
    this.holdUsed      = false;
    this.holdEverUsed  = false;
    this.hardDropCount = 0;
    this.lockDelay = 500;
    this.clearLockDelay();
    cancelAnimationFrame(this.animFrame);
    this.animFrame = null;
    this.lastDrop  = 0;
    this.clearAnim = null;
    this.shake     = null;
    this.state     = 'playing';
    Custom.close();

    this.queue = [];
    for (let i = 0; i < PREVIEW_COUNT; i++) this.queue.push(this.bag.next());

    this.spawnPiece();
    this.overlay.style.display = 'none';
    this.updateUI();
    tryUnlock('bd_first');
    this.loop();
  }

  spawnPiece() {
    const type = this.queue.shift();
    this.queue.push(this.bag.next());
    const def = PIECES[type];
    this.current = {
      type,
      shape: deepCopy(def.shape),
      x: Math.floor(COLS / 2) - Math.floor(def.shape[0].length / 2),
      y: -1,
      rot: 0,
    };
    this.holdUsed = false;
    if (!this.isValid(this.current.shape, this.current.x, this.current.y)) {
      this.gameOver();
    }
  }

  currentDropInterval() {
    return this.mode === 'standard' ? STANDARD_SPEED : dropInterval(this.level);
  }

  loop(ts = 0) {
    if (this.state === 'clearing') {
      this.updateClearAnim(ts);
      this.draw(true);
      this.animFrame = requestAnimationFrame(t => this.loop(t));
      return;
    }
    if (this.state !== 'playing') return;
    const elapsed = ts - this.lastDrop;
    if (elapsed >= this.currentDropInterval()) {
      this.softDrop(false);
      this.lastDrop = ts;
    }
    if (this.state !== 'playing' && this.state !== 'clearing') return; // softDrop kann das Spiel beenden
    this.draw();
    this.animFrame = requestAnimationFrame(t => this.loop(t));
  }

  // ── Movement ──────────────────────────────────────────────────────────────
  // Alle Züge wirken nur im laufenden Spiel: Touch-Knöpfe, Auto-Repeat und der
  // Lock-Timer rufen sie direkt auf, auch in der Pause oder während des Räumens.
  get live() { return this.state === 'playing'; }
  moveLeft()  { if (this.live) this.tryMove(-1, 0); }
  moveRight() { if (this.live) this.tryMove(1, 0); }

  tryMove(dx, dy) {
    const nx = this.current.x + dx;
    const ny = this.current.y + dy;
    if (this.isValid(this.current.shape, nx, ny)) {
      this.current.x = nx;
      this.current.y = ny;
      if (dy === 0) this.resetLockDelay();
      return true;
    }
    return false;
  }

  softDrop(byUser = true) {
    if (!this.live) return;
    if (!this.tryMove(0, 1)) {
      this.scheduleLock();
    } else {
      if (byUser) { this.score += 1; this.scoreEl.textContent = this.score; }
      this.clearLockDelay();
    }
  }

  hardDrop() {
    if (!this.live) return;
    let dropped = 0;
    while (this.tryMove(0, 1)) dropped++;
    this.score += dropped * 2;
    this.hardDropCount++;
    if (this.hardDropCount === 25) tryUnlock('bd_harddrop');
    // Aufschlag: Staub unter dem Stein, das Spielfeld ruckt kurz
    if (window.FX && !FX.reduced && dropped > 1 && this.current) {
      const br = this.boardCanvas.getBoundingClientRect(), cell = br.width / COLS, sh = this.current.shape;
      const bottom = sh.reduce((m, row, i) => (row.some(v => v) ? i : m), 0);
      const x = br.left + (this.current.x + sh[0].length / 2) * cell, y = br.top + (this.current.y + bottom + 1) * cell;
      FX.burst(x, y, { kind: 'spark', n: 8 + Math.min(18, dropped), speed: 6 + dropped * 0.35, spread: 3.3, radius: cell * sh[0].length / 2, radiusY: 1, color: COLORS[this.current.type] });
      if (dropped > 6) FX.shake(document.getElementById('game-area'), Math.min(7, dropped / 3), 160);
    }
    this.lock();
  }

  rotate(dir = 1) {
    if (!this.live) return;
    const prev = this.current.rot;
    const newShape = rotate(this.current.shape, dir);
    const newRot = ((prev + dir) + 4) % 4;
    const key = `${prev}>${newRot}`;
    const kicks = this.current.type === 'I' ? KICKS_I : KICKS_JLSTZ;
    const tests = kicks[key] || [];

    if (this.isValid(newShape, this.current.x, this.current.y)) {
      this.applyRotation(newShape, 0, 0, newRot); return;
    }
    for (const [kx, ky] of tests) {
      if (this.isValid(newShape, this.current.x + kx, this.current.y - ky)) {
        this.applyRotation(newShape, kx, -ky, newRot); return;
      }
    }
  }

  applyRotation(shape, dx, dy, rot) {
    this.current.shape = shape;
    this.current.x += dx;
    this.current.y += dy;
    this.current.rot = rot;
    this.resetLockDelay();
  }

  resetLockDelay() {
    this.clearLockDelay();
    if (!this.isValid(this.current.shape, this.current.x, this.current.y + 1))
      this.scheduleLock();
  }

  scheduleLock() {
    if (this.lockTimer) return;
    this.lockTimer = setTimeout(() => this.lock(), this.lockDelay);
  }

  clearLockDelay() {
    if (this.lockTimer) { clearTimeout(this.lockTimer); this.lockTimer = null; }
  }

  lock() {
    this.clearLockDelay();
    if (!this.live) return;
    const p = this.current;
    for (let r = 0; r < p.shape.length; r++)
      for (let c = 0; c < p.shape[r].length; c++)
        if (p.shape[r][c]) {
          const by = p.y + r;
          if (by < 0) { this.gameOver(); return; }
          this.board[by][p.x + c] = p.type;
        }
    this.boardVer++;

    const clearedRows = this.findClearedRows();
    if (clearedRows.length > 0) {
      this.startLineClearAnim(clearedRows);
    } else {
      this.calcScore(0);
      this.spawnPiece();
      this.lastDrop = performance.now();
    }
  }

  findClearedRows() {
    const rows = [];
    for (let r = 0; r < ROWS; r++)
      if (this.board[r].every(c => c !== null)) rows.push(r);
    return rows;
  }

  removeLines(rows) {
    const rowSet = new Set(rows);
    this.boardVer++;
    this.board = this.board.filter((_, i) => !rowSet.has(i));
    while (this.board.length < ROWS) {
      this.board.unshift(Array(COLS).fill(null));
    }
  }

  // ── Line-clear animation ───────────────────────────────────────────────────
  startLineClearAnim(rows) {
    this.state = 'clearing';
    const lineCount = rows.length;

    const particles = [];
    for (const r of rows) {
      for (let c = 0; c < COLS; c++) {
        const color = COLORS[this.board[r][c]];
        if (!color) continue;
        const cx = (c + 0.5) * BLOCK;
        const cy = (r + 0.5) * BLOCK;
        const count = calmFx() ? 2 + Math.floor(Math.random() * 2) : 5 + Math.floor(Math.random() * 4);
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 0.04 + Math.random() * 0.18;
          particles.push({
            x: cx, y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 0.12,
            color,
            alpha: 1,
            size: 3 + Math.random() * 7,
            rot: Math.random() * Math.PI * 2,
            rotV: (Math.random() - 0.5) * 0.01,
          });
        }
      }
    }

    // Funken und Splitter fliegen aus jeder geräumten Reihe über die ganze Seite
    if (window.FX && !FX.reduced) {
      const br = this.boardCanvas.getBoundingClientRect(), cell = br.height / ROWS, cx = br.left + br.width / 2;
      const NEON = ['#2ee6ff', '#ffb000', '#ff3d9a', '#b8ff3d', '#a78bfa', '#ffffff'];
      rows.forEach((r, i) => setTimeout(() => {
        const y = br.top + (r + 0.5) * cell;
        FX.burst(cx, y, { kind: 'spark', n: 34, speed: 16, radius: br.width / 2, radiusY: 2, colors: NEON });
        FX.burst(cx, y, { kind: 'block', n: 12, speed: 13, lift: -5, radius: br.width / 2, radiusY: 2, size: 5, life: 1.4, colors: NEON });
      }, i * 45));
      const mid = br.top + (rows[0] + rows.length / 2) * cell;
      FX.pulse(NEON[lineCount % NEON.length], 0.4 + lineCount * 0.3);
      if (lineCount >= 2) FX.ring(cx, mid, '#2ee6ff', { to: 380 + lineCount * 90, width: 4 + lineCount, dur: 0.6 });
      if (lineCount >= 3) { FX.streak(mid, '#2ee6ff'); FX.flash('#2ee6ff', 260); }
    }
    const shakeIntensity = calmFx() ? 0 : [0, 0, 4, 7, 13][lineCount] || 13;
    if (shakeIntensity > 0) {
      this.shake = { intensity: shakeIntensity, start: performance.now(), duration: 350 };
    }

    this.clearAnim = {
      rows,
      lineCount,
      particles,
      startTime: performance.now(),
      lastTs: performance.now(),
    };
  }

  updateClearAnim(ts) {
    const anim = this.clearAnim;
    const elapsed = ts - anim.startTime;
    const dt = ts - anim.lastTs;
    anim.lastTs = ts;

    if (elapsed >= ANIM_FLASH) {
      const gravity = 0.00025;
      for (const p of anim.particles) {
        p.x   += p.vx * dt;
        p.y   += p.vy * dt;
        p.vy  += gravity * dt;
        p.rot += p.rotV * dt;
        p.alpha = Math.max(0, p.alpha - 0.0028 * dt);
        p.size  = Math.max(0, p.size  - 0.012  * dt);
      }
    }

    if (elapsed >= ANIM_TOTAL) {
      this.finishClearAnim();
    }
  }

  finishClearAnim() {
    const rows = this.clearAnim.rows;
    const count = rows.length;
    this.clearAnim = null;
    this.removeLines(rows);
    this.calcScore(count);
    this.spawnPiece();
    this.lastDrop = performance.now();
    this.state = 'playing';
  }

  calcScore(lines) {
    if (lines > 0) {
      this.combo++;
      const base = LINE_SCORES[lines] * this.level;
      const comboBonus = this.combo > 0 ? 50 * this.combo * this.level : 0;
      this.score += base + comboBonus;
      this.lines += lines;
      const levelBefore = this.level;
      this.level = Math.floor(this.lines / 10) + 1;
      if (this.level > levelBefore && window.FX && !FX.reduced) {
        // Levelaufstieg: Lichtstreifen und Einblendung
        FX.streak(innerHeight * 0.3, '#ffb000'); FX.pulse('#ffb000', 1.2);
        const lb = document.createElement('div');
        lb.className = 'tetris-banner level-banner'; lb.textContent = 'LEVEL ' + this.level;
        document.body.appendChild(lb); setTimeout(() => lb.remove(), 1600);
      }

      if (lines === 4)                               { tryUnlock('bd_tetris'); celebrateTetris(); }
      if (this.combo >= 4)                             tryUnlock('bd_combo5');
      if (this.level >= 10 && this.mode === 'classic') tryUnlock('bd_level10');
      if (this.score >= 50000)                         tryUnlock('bd_score50k');
      if (this.score >= 250000)                        tryUnlock('bd_score250k');
      if (this.lines >= 100)                           tryUnlock('bd_lines100');
    } else {
      this.combo = -1;
    }
    this.updateUI();
  }

  holdPiece() {
    if (!this.live || this.holdUsed) return;
    this.clearLockDelay();
    const type = this.current.type;
    this.holdEverUsed = true;
    if (this.holdKey) {
      const tmp = this.holdKey;
      this.holdKey = type;
      const def = PIECES[tmp];
      this.current = {
        type: tmp, shape: deepCopy(def.shape),
        x: Math.floor(COLS / 2) - Math.floor(def.shape[0].length / 2),
        y: -1, rot: 0,
      };
      this.holdUsed = true;
      // Kein Platz mehr für den getauschten Stein: Spiel vorbei (wie beim normalen Spawn)
      if (!this.isValid(this.current.shape, this.current.x, this.current.y)) { this.gameOver(); return; }
    } else {
      this.holdKey = type;
      this.spawnPiece();
    }
    this.holdUsed = true;
  }

  // ── Validation ────────────────────────────────────────────────────────────
  isValid(shape, ox, oy) {
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        if (shape[r][c]) {
          const x = ox + c, y = oy + r;
          if (x < 0 || x >= COLS || y >= ROWS) return false;
          if (y >= 0 && this.board[y][x]) return false;
        }
    return true;
  }

  ghostY() {
    let gy = this.current.y;
    while (this.isValid(this.current.shape, this.current.x, gy + 1)) gy++;
    return gy;
  }

  // ── Drawing ───────────────────────────────────────────────────────────────
  // Das Raster ändert sich nie: einmal malen, danach nur kopieren
  makeGrid() {
    const cv = document.createElement('canvas');
    cv.width = this.boardCanvas.width; cv.height = this.boardCanvas.height;
    const c = cv.getContext('2d');
    c.scale(DPR, DPR);
    if (!look.grid) return cv;
    c.fillStyle = 'rgba(196,178,255,0.022)';
    for (let col = 1; col < COLS; col += 2) c.fillRect(col * BLOCK, 0, BLOCK, this.H);
    c.fillStyle = 'rgba(196,178,255,0.1)';
    for (let col = 1; col < COLS; col++) for (let r = 1; r < ROWS; r++) c.fillRect(col * BLOCK - 1, r * BLOCK - 1, 2, 2);
    return cv;
  }

  // force: Animation läuft (Räumen); sonst wird nur neu gemalt, wenn sich das Bild geändert hat
  draw(force) {
    const cur = this.current;
    const key = cur ? cur.x + ',' + cur.y + ',' + cur.rot + cur.type + this.boardVer : 'x' + this.boardVer;
    if (force || this.shake || key !== this.drawnKey) { this.drawnKey = key; this.drawBoard(); }
    const nk = this.queue.join('');
    if (nk !== this.nextKey) { this.nextKey = nk; this.drawNextQueue(); }
    const hk = this.holdKey + (this.holdUsed ? '!' : '');
    if (hk !== this.holdDrawn) { this.holdDrawn = hk; this.drawHold(); }
  }

  drawBoard() {
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;

    ctx.save();

    if (this.shake) {
      const elapsed = performance.now() - this.shake.start;
      if (elapsed < this.shake.duration) {
        const t = 1 - elapsed / this.shake.duration;
        const mag = this.shake.intensity * t;
        ctx.translate(
          (Math.random() * 2 - 1) * mag,
          (Math.random() * 2 - 1) * mag
        );
      } else {
        this.shake = null;
      }
    }

    ctx.clearRect(-20, -20, W + 40, H + 40);
    ctx.drawImage(this.grid, 0, 0, W, H);

    const isClearing = this.state === 'clearing' && this.clearAnim;
    const clearedSet = isClearing ? new Set(this.clearAnim.rows) : null;

    for (let r = 0; r < ROWS; r++) {
      if (clearedSet && clearedSet.has(r)) continue;
      const row = this.board[r];
      for (let c = 0; c < COLS; c++)
        if (row[c]) this.drawCell(ctx, c, r, COLORS[row[c]], BLOCK);
    }

    if (this.current && !isClearing) {
      const p = this.current, gy = this.ghostY(), color = COLORS[p.type];
      // Fallspur: ein schwacher Lichtschacht vom Stein bis zum Landeplatz
      if (look.ghost && gy > p.y) {
        ctx.globalAlpha = 0.07; ctx.fillStyle = color;
        for (let c = 0; c < p.shape[0].length; c++) {
          let bottom = -1;
          for (let r = 0; r < p.shape.length; r++) if (p.shape[r][c]) bottom = r;
          if (bottom < 0) continue;
          const y0 = Math.max(0, (p.y + bottom + 1) * BLOCK), y1 = (gy + bottom) * BLOCK;
          if (y1 > y0) ctx.fillRect((p.x + c) * BLOCK + 1, y0, BLOCK - 2, y1 - y0);
        }
        ctx.globalAlpha = 1;
        this.drawPiece(ctx, p.shape, p.x, gy, color, BLOCK, true);
      }
      this.drawPiece(ctx, p.shape, p.x, p.y, color, BLOCK);
    }

    if (isClearing) this.drawClearAnim(ctx);

    ctx.restore();
  }

  drawClearAnim(ctx) {
    const anim = this.clearAnim;
    const elapsed = performance.now() - anim.startTime;
    const flashT   = Math.min(1, elapsed / ANIM_FLASH);
    const explodeT = Math.max(0, (elapsed - ANIM_FLASH) / ANIM_EXPLODE);

    if (elapsed < ANIM_FLASH) {
      const pulse = Math.sin(flashT * Math.PI * 5) * 0.5 + 0.5;
      const flashAlpha = (1 - flashT * 0.4) * pulse;

      for (const r of anim.rows) {
        const y = r * BLOCK;
        ctx.fillStyle = `rgba(255,255,255,${flashAlpha * 0.85})`;
        ctx.fillRect(0, y + 1, COLS * BLOCK, BLOCK - 2);

        const cx = (COLS * BLOCK) / 2;
        const spread = cx * easeOut(flashT);
        const grad = ctx.createLinearGradient(cx - spread, y, cx + spread, y);
        grad.addColorStop(0,   'rgba(255,255,220,0)');
        grad.addColorStop(0.3, `rgba(255,255,220,${flashAlpha * 0.6})`);
        grad.addColorStop(0.5, `rgba(255,255,255,${flashAlpha})`);
        grad.addColorStop(0.7, `rgba(255,255,220,${flashAlpha * 0.6})`);
        grad.addColorStop(1,   'rgba(255,255,220,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, y, COLS * BLOCK, BLOCK);

        ctx.strokeStyle = `rgba(255,255,180,${flashAlpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, y + 1); ctx.lineTo(COLS * BLOCK, y + 1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, y + BLOCK - 1); ctx.lineTo(COLS * BLOCK, y + BLOCK - 1); ctx.stroke();
      }

      ctx.fillStyle = `rgba(255,255,255,${(1 - flashT) * 0.15})`;
      ctx.fillRect(0, 0, COLS * BLOCK, ROWS * BLOCK);

    } else {
      const rowFade = Math.max(0, 1 - explodeT * 3);
      if (rowFade > 0) {
        for (const r of anim.rows) {
          ctx.globalAlpha = rowFade;
          for (let c = 0; c < COLS; c++) {
            const type = this.board[r][c];
            if (type) this.drawCell(ctx, c, r, COLORS[type], BLOCK);
          }
          ctx.globalAlpha = 1;
        }
      }
    }

    if (elapsed >= ANIM_FLASH) {
      for (const p of anim.particles) {
        if (p.alpha <= 0 || p.size <= 0) continue;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        const h = p.size;
        ctx.fillRect(-h / 2, -h / 2, h, h);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(-h / 2, -h / 2, h, h * 0.3);
        ctx.restore();
      }
    }
  }

  drawPiece(ctx, shape, ox, oy, color, bs, ghost) {
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        if (shape[r][c]) this.drawCell(ctx, ox + c, oy + r, color, bs, ghost);
  }

  drawCell(ctx, cx, cy, color, bs, ghost) {
    if (cy < 0) return;
    ctx.drawImage(sprite(color, bs, ghost), cx * bs, cy * bs, bs, bs);
  }

  // Stein mittig in ein Feld setzen (Vorschau und Halten): leere Zeilen und Spalten zählen nicht mit
  drawCentered(ctx, type, color, x0, y0, w, h, bs) {
    const shape = PIECES[type].shape;
    let r0 = 9, r1 = -1, c0 = 9, c1 = -1;
    shape.forEach((row, r) => row.forEach((v, c) => { if (v) { r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c); } }));
    const ox = Math.round(x0 + (w - (c1 - c0 + 1) * bs) / 2), oy = Math.round(y0 + (h - (r1 - r0 + 1) * bs) / 2);
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++)
        if (shape[r][c]) ctx.drawImage(sprite(color, bs), ox + (c - c0) * bs, oy + (r - r0) * bs, bs, bs);
  }

  drawNextQueue() {
    const ctx = this.nctx;
    ctx.clearRect(0, 0, this.nW, this.nH);
    const n = Math.min(PREVIEW_COUNT, this.queue.length), slotH = this.nH / PREVIEW_COUNT;
    for (let i = 0; i < n; i++) {
      // der nächste Stein steht groß und hell, die weiteren kleiner und zurückgenommen
      ctx.globalAlpha = i === 0 ? 1 : 0.78 - i * 0.09;
      this.drawCentered(ctx, this.queue[i], COLORS[this.queue[i]], 0, i * slotH, this.nW, slotH, i === 0 ? 20 : 16);
    }
    ctx.globalAlpha = 1;
  }

  drawHold() {
    const ctx = this.hctx;
    ctx.clearRect(0, 0, this.hW, this.hH);
    if (!this.holdKey) return;
    this.drawCentered(ctx, this.holdKey, this.holdUsed ? HELD_USED : COLORS[this.holdKey], 0, 0, this.hW, this.hH, 20);
  }

  drawIdleBoard() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.drawImage(this.grid, 0, 0, this.W, this.H);
    for (const [c, r, type] of this.idleCells) this.drawCell(ctx, c, r, COLORS[type], BLOCK);
  }

  // Aussehen geändert (Anpassen-Fenster): Sprites verwerfen und alles neu malen
  refreshLook() {
    SPRITES.clear();
    this.boardCanvas.style.background = BACKDROPS[look.bg].css;
    this.grid = this.makeGrid();
    if (this.state === 'idle') { this.drawIdleBoard(); return; }
    this.nextKey = this.holdDrawn = null;
    this.draw(true);
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  updateUI() {
    this.scoreEl.textContent = this.score;
    this.levelEl.textContent = this.level;
    this.linesEl.textContent = this.lines;
    this.levelBar.style.transform = `scaleX(${(this.lines % 10) / 10})`;
    if (this.modeBadge) {
      this.modeBadge.textContent = this.mode === 'standard' ? 'Standard' : 'Classic';
      this.modeBadge.className   = this.mode;
      this.modeBadge.id = 'mode-badge';
    }
  }

  async renderHighScores(mode = 'standard') {
    const labelEl = document.getElementById('hs-mode-label');
    if (labelEl) labelEl.textContent = mode === 'standard' ? 'Standard' : 'Classic';
    const hs = await dbLoadScores(mode);
    this.hsListEl.innerHTML = hs.length
      ? hs.slice(0, 5).map((s, i) =>
          `${i + 1}. <span>${s.score.toLocaleString()}</span>` +
          `<small> &nbsp;L${s.level} · ${s.lines} R.</small>`
        ).join('<br>')
      : '<em>Noch keine</em>';
  }

  async gameOver() {
    this.state = 'gameover';
    cancelAnimationFrame(this.animFrame);
    this.clearLockDelay();
    this.clearAnim = null;
    this.draw(true);
    // Game Over: roter Blitz, das Feld zerbröselt
    if (window.FX && !FX.reduced) {
      const br = this.boardCanvas.getBoundingClientRect();
      FX.flash('#ff2e63', 520); FX.pulse('#ff2e63', 1.4); FX.shake(document.getElementById('wrapper'), 14, 620);
      FX.burst(br.left + br.width / 2, br.top + br.height * 0.3, { kind: 'block', n: 90, speed: 12, lift: -3, radius: br.width / 2, radiusY: br.height * 0.3, size: 7, life: 2.2, colors: Object.values(COLORS), bounce: true });
      FX.ring(br.left + br.width / 2, br.top + br.height / 2, '#ff2e63', { width: 9 });
    }
    if (!this.holdEverUsed && this.score > 0) tryUnlock('bd_no_hold');
    await dbSaveScore(this.score, this.mode, this.level, this.lines);
    await this.renderHighScores(this.mode);
    const modeLabel = this.mode === 'standard' ? 'Standard' : 'Classic';
    this.overlay.innerHTML = `
      <h1>Game Over</h1>
      <p>Modus: <strong>${modeLabel}</strong></p>
      <p>Score: <strong>${this.score.toLocaleString()}</strong></p>
      <p>Level: <strong>${this.level}</strong> &nbsp; Reihen: <strong>${this.lines}</strong></p>
      <div class="mode-btns">
        <button class="mode-btn ${this.mode === 'classic'  ? 'selected' : ''}" id="mode-classic">Classic<small>Wird schneller</small></button>
        <button class="mode-btn ${this.mode === 'standard' ? 'selected' : ''}" id="mode-standard">Standard<small>Festes Tempo</small></button>
      </div>
      <button class="btn" id="start-btn">Nochmal spielen</button>
      <button class="btn-alt" type="button" data-custom>🎨 Anpassen</button>
    `;
    this.overlay.style.display = 'flex';
    this._bindModeButtons();
    document.getElementById('start-btn').addEventListener('click', () => this.startGame(this.selectedMode));
  }

  togglePause() {
    if (this.state === 'paused') { this.resume(); return; }
    if (this.state === 'playing') {
      this.state = 'paused';
      cancelAnimationFrame(this.animFrame);
      this.clearLockDelay();
      const modeLabel = this.mode === 'standard' ? 'Standard' : 'Classic';
      this.overlay.innerHTML = `
        <h1>Pause</h1>
        <p>Modus: ${modeLabel}</p>
        <button class="btn" id="start-btn">Weiter</button>
        <button class="btn-alt" type="button" data-custom>🎨 Anpassen</button>
      `;
      this.overlay.style.display = 'flex';
      document.getElementById('start-btn').addEventListener('click', () => this.resume());
    }
  }

  resume() {
    if (this.state !== 'paused') return;
    Custom.close();
    this.state = 'playing';
    this.overlay.style.display = 'none';
    this.lastDrop = performance.now();
    this.loop(performance.now());
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  onKey(e) {
    if (Custom.isOpen()) {
      // Esc schließt das Fenster, auch wenn gerade ein Farbfeld den Fokus hat; das Spiel bekommt keine Taste
      if (e.key === 'Escape' && !e.repeat && (!typing(e) || Custom.panel.contains(e.target))) Custom.close();
      return;
    }
    if (typing(e)) return;
    // Ohne laufendes Spiel öffnet Esc direkt das Anpassen-Fenster
    if (e.key === 'Escape' && !e.repeat && (this.state === 'idle' || this.state === 'gameover')) { Custom.open(); return; }
    // Pfeiltasten/Space scrollen sonst die Seite — auch während Pause/Räum-Animation,
    // nicht nur während 'playing' (wo der switch weiter unten preventDefault ruft)
    if (SCROLL_KEYS.has(e.key) && this.state !== 'idle' && this.state !== 'gameover') {
      e.preventDefault();
    }

    if (this.state === 'paused') {
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') this.resume();
      return;
    }
    if (this.state === 'clearing') return;
    if (this.state !== 'playing') return;

    switch (e.key) {
      // Bewegung: nur beim ersten Druck reagieren — DAS übernimmt das Auto-Repeat
      case 'ArrowLeft':  e.preventDefault(); if (!e.repeat) this.moveLeft();  break;
      case 'ArrowRight': e.preventDefault(); if (!e.repeat) this.moveRight(); break;
      case 'ArrowDown':  e.preventDefault(); if (!e.repeat) this.softDrop(); break;
      case 'ArrowUp':
      case 'z': case 'Z': e.preventDefault(); if (!e.repeat) this.rotate(1);  break;
      case 'x': case 'X': e.preventDefault(); if (!e.repeat) this.rotate(-1); break;
      case ' ':           e.preventDefault(); if (!e.repeat) this.hardDrop(); break;
      case 'Shift':       e.preventDefault(); if (!e.repeat) this.holdPiece(); break;
      case 'p': case 'P': case 'Escape': if (!e.repeat) this.togglePause();   break;
    }
  }
}

// Tippt jemand gerade in ein Eingabefeld (z. B. Login über dem laufenden Spiel)?
function typing(e) {
  const t = e.target;
  return !!(t && t.closest && t.closest('input, textarea, select, [contenteditable="true"], .auth-modal-backdrop.open'));
}

// ── DAS (Delayed Auto Shift) ───────────────────────────────────────────────
(function addDAS() {
  const DAS_DELAY = 150, DAS_REPEAT = 50;
  const SOFT_DROP_REPEAT = 25; // Soft-Drop: instant + sehr schnelle Wiederholung
  let dasTimer = null, dasDir = 0;
  let downTimer = null;

  // Verliert das Fenster den Fokus, kommt kein keyup mehr: Wiederholung beenden
  const stopAll = () => {
    clearTimeout(dasTimer); clearInterval(dasTimer); dasTimer = null; dasDir = 0;
    clearInterval(downTimer); downTimer = null;
  };
  window.addEventListener('blur', stopAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopAll(); });

  document.addEventListener('keydown', e => {
    if (e.repeat) return; // Native Browser-Repeat ignorieren — DAS macht das
    if (typing(e)) return;
    if (!window._game || window._game.state !== 'playing') return;
    if (e.key === 'ArrowLeft' && dasDir !== -1) {
      clearTimeout(dasTimer); clearInterval(dasTimer); dasDir = -1;
      dasTimer = setTimeout(() => {
        dasTimer = setInterval(() => window._game.moveLeft(), DAS_REPEAT);
      }, DAS_DELAY);
    } else if (e.key === 'ArrowRight' && dasDir !== 1) {
      clearTimeout(dasTimer); clearInterval(dasTimer); dasDir = 1;
      dasTimer = setTimeout(() => {
        dasTimer = setInterval(() => window._game.moveRight(), DAS_REPEAT);
      }, DAS_DELAY);
    } else if (e.key === 'ArrowDown' && !downTimer) {
      // Soft Drop: ohne Initial-Delay direkt durchgängig dropen
      downTimer = setInterval(() => {
        if (window._game && window._game.state === 'playing') window._game.softDrop();
      }, SOFT_DROP_REPEAT);
    }
  });

  document.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      clearTimeout(dasTimer); clearInterval(dasTimer); dasTimer = null; dasDir = 0;
    } else if (e.key === 'ArrowDown') {
      clearInterval(downTimer); downTimer = null;
    }
  });
})();

// ── Anpassen-Fenster (Esc) ────────────────────────────────────────────────
// Liegt über dem Start-, Pause- oder Game-Over-Schirm. Jede Änderung wirkt
// sofort auf Spielfeld, Vorschau und Halten und wird im Browser gemerkt.
const Custom = (() => {
  const $ = id => document.getElementById(id);
  const panel = $('custom-panel'), overlay = $('overlay');
  const pv = hidpi($('custom-preview'));
  const inputs = {};
  let opener = null;

  function chips(boxId, defs, pick) {
    for (const id in defs) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.id = id; b.textContent = defs[id].name;
      b.addEventListener('click', () => { pick(id); changed(); });
      $(boxId).appendChild(b);
    }
  }
  const press = (b, on) => { b.classList.toggle('selected', on); b.setAttribute('aria-pressed', on); };
  const mark = (boxId, id) => { for (const b of $(boxId).children) press(b, b.dataset.id === id); };

  chips('custom-palettes', PALETTES, id => Object.assign(COLORS, PALETTES[id].colors));
  chips('custom-styles', STYLES, id => { look.style = id; });
  chips('custom-bgs', BACKDROPS, id => { look.bg = id; });
  for (const type in COLORS) {
    const inp = document.createElement('input');
    inp.type = 'color'; inp.title = 'Stein ' + type; inp.setAttribute('aria-label', 'Farbe für Stein ' + type);
    inp.addEventListener('input', () => { if (HEX.test(inp.value)) { COLORS[type] = inp.value.toLowerCase(); changed(); } });
    $('custom-colors').appendChild(inputs[type] = inp);
  }
  $('custom-ghost').addEventListener('click', () => { look.ghost = !look.ghost; changed(); });
  $('custom-grid').addEventListener('click', () => { look.grid = !look.grid; changed(); });
  $('custom-reset').addEventListener('click', () => {
    Object.assign(COLORS, PALETTES.neon.colors); Object.assign(look, LOOK_DEFAULT); changed();
  });
  $('custom-done').addEventListener('click', close);

  function changed() {
    saveLook();
    window._game.refreshLook();
    sync();
  }

  // Knöpfe, Farbfelder und Vorschau auf den aktuellen Stand bringen
  function sync() {
    mark('custom-palettes', Object.keys(PALETTES).find(id => Object.keys(COLORS).every(k => PALETTES[id].colors[k] === COLORS[k])));
    mark('custom-styles', look.style);
    mark('custom-bgs', look.bg);
    press($('custom-ghost'), look.ghost);
    press($('custom-grid'), look.grid);
    for (const type in inputs) inputs[type].value = COLORS[type];

    // Vorschau: alle sieben Steine nebeneinander, auf dem gewählten Hintergrund
    const { ctx, w, h } = pv, bs = 10, gap = 6, types = Object.keys(PIECES);
    const cols = t => (t === 'I' ? 4 : t === 'O' ? 2 : 3);
    ctx.canvas.style.background = BACKDROPS[look.bg].css;
    ctx.clearRect(0, 0, w, h);
    let x = (w - types.reduce((sum, t) => sum + cols(t) * bs, 0) - gap * (types.length - 1)) / 2;
    for (const t of types) {
      window._game.drawCentered(ctx, t, COLORS[t], x, 0, cols(t) * bs, h, bs);
      x += cols(t) * bs + gap;
    }
  }

  function open() {
    if (!panel.hidden) return;
    opener = document.activeElement;
    panel.hidden = false;
    overlay.inert = true; // der Schirm darunter ist solange nicht per Tab erreichbar
    panel.scrollTop = 0;
    sync();
    $('custom-done').focus();
  }

  function close() {
    if (panel.hidden) return;
    panel.hidden = true;
    overlay.inert = false;
    if (opener && opener.isConnected) opener.focus();
    opener = null;
  }

  return { panel, open, close, isOpen: () => !panel.hidden };
})();

// ── Boot ──────────────────────────────────────────────────────────────────
window._game = new BlockDrop();
