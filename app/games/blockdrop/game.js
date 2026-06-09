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

function tryUnlock(id) {
  let list;
  try { list = JSON.parse(localStorage.getItem('arcade_achievements')) || []; }
  catch(e) { list = []; }
  if (list.some(a => a.id === id)) return;
  list.push({ id, unlockedAt: new Date().toISOString() });
  localStorage.setItem('arcade_achievements', JSON.stringify(list));
  showAchOverlay(id);
  // Cloud-Sync (fire-and-forget)
  if (window.Auth && window.Auth.user) {
    window.Auth.saveAchievements(list).catch(() => {});
  }
}

// Beim Login: Cloud-Achievements mit lokalen mergen
function syncAchievementsFromCloud() {
  if (!window.Auth || !window.Auth.user) return;
  window.Auth.loadAchievements().then(cloud => {
    if (!cloud) return;
    let local = [];
    try { local = JSON.parse(localStorage.getItem('arcade_achievements')) || []; } catch(e) {}
    const byId = new Map();
    [...local, ...cloud].forEach(a => {
      if (!byId.has(a.id)) byId.set(a.id, a);
    });
    const merged = [...byId.values()];
    localStorage.setItem('arcade_achievements', JSON.stringify(merged));
    if (merged.length !== cloud.length) {
      window.Auth.saveAchievements(merged).catch(() => {});
    }
  }).catch(() => {});
}
if (window.Auth) window.Auth.onChange(u => { if (u) syncAchievementsFromCloud(); });

// ── Tetris-Spezialeffekt (4 Zeilen auf einmal) ──────────────────────────────
// Vollflächiges Konfetti + "TETRIS!"-Banner + Screen-Shake aufs Spielfeld.
function celebrateTetris() {
  const reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Konfetti ──
  const COLORS_CONFETTI = [
    '#00cfcf', '#f0c000', '#a000f0', '#00b800',
    '#e00000', '#0000e0', '#e07000', '#ffffff', '#e94560',
  ];
  // Persistente FX-Ebene (existiert dauerhaft im DOM). Wir hängen nur Kinder
  // ein/aus – die Ebene selbst bleibt, damit der Compositing-Baum stabil ist
  // und die fixed-Ebenen (Navbar/Scanlines) nicht neu rastern (kein Blitz).
  const layer = document.getElementById('tetris-fx');
  if (!layer) return;

  // Weniger Teilchen = kein Paint-Spike beim Einblenden (sonst ruckelt's kurz).
  const N = reduceMotion ? 28 : 80;
  const pieces = [];
  for (let i = 0; i < N; i++) {
    const piece = document.createElement('i');
    const color = COLORS_CONFETTI[Math.floor(Math.random() * COLORS_CONFETTI.length)];
    const w = 6 + Math.random() * 8;
    piece.style.left            = (Math.random() * 100) + 'vw';
    piece.style.width           = w + 'px';
    piece.style.height          = (w * (0.5 + Math.random())) + 'px';
    piece.style.background       = color;
    piece.style.borderRadius    = Math.random() < 0.3 ? '50%' : '2px';
    piece.style.setProperty('--xd',  ((Math.random() * 2 - 1) * 160) + 'px');
    piece.style.setProperty('--rot', ((Math.random() * 2 - 1) * 900) + 'deg');
    piece.style.animationDuration = (1.6 + Math.random() * 1.6) + 's';
    piece.style.animationDelay     = (Math.random() * 0.35) + 's';
    layer.appendChild(piece);
    pieces.push(piece);
  }
  setTimeout(() => pieces.forEach(p => p.remove()), 4000);

  // ── "TETRIS!"-Banner ──
  const banner = document.createElement('div');
  banner.className = 'tetris-banner';
  banner.textContent = 'TETRIS!';
  layer.appendChild(banner);
  setTimeout(() => banner.remove(), 1600);

  // ── Screen-Shake aufs Spielfeld ──
  if (!reduceMotion) {
    const area = document.getElementById('game-area');
    if (area) {
      area.classList.remove('tetris-shake');
      void area.offsetWidth; // Reflow erzwingen, damit die Animation neu startet
      area.classList.add('tetris-shake');
      setTimeout(() => area.classList.remove('tetris-shake'), 650);
    }
  }
}

// ── Level-Up-Feier ──────────────────────────────────────────────────────────
function celebrateLevelUp(level) {
  const area = document.getElementById('game-area');
  if (area) {
    area.classList.remove('level-pulse');
    void area.offsetWidth;
    area.classList.add('level-pulse');
    setTimeout(() => area.classList.remove('level-pulse'), 700);
  }
  const banner = document.createElement('div');
  banner.className = 'levelup-banner';
  banner.innerHTML = `<span>LEVEL</span><b>${level}</b>`;
  (area || document.body).appendChild(banner);
  setTimeout(() => banner.remove(), 1300);
}

// ── Constants ──────────────────────────────────────────────────────────────
const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const PREVIEW_COUNT = 5;

const COLORS = {
  I: '#00cfcf',
  O: '#f0c000',
  T: '#a000f0',
  S: '#00b800',
  Z: '#e00000',
  J: '#0000e0',
  L: '#e07000',
  ghost: 'rgba(255,255,255,0.12)',
};

const PIECES = {
  I: { shape: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], color: COLORS.I },
  O: { shape: [[1,1],[1,1]], color: COLORS.O },
  T: { shape: [[0,1,0],[1,1,1],[0,0,0]], color: COLORS.T },
  S: { shape: [[0,1,1],[1,1,0],[0,0,0]], color: COLORS.S },
  Z: { shape: [[1,1,0],[0,1,1],[0,0,0]], color: COLORS.Z },
  J: { shape: [[1,0,0],[1,1,1],[0,0,0]], color: COLORS.J },
  L: { shape: [[0,0,1],[1,1,1],[0,0,0]], color: COLORS.L },
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
function easeOutBack(t) { const s = 1.70158; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); }

// ── Farb-Helfer ──────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const n = parseInt(hex, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
const _shadeCache = new Map();
function shade(hex, t) {
  // t > 0 = aufhellen, t < 0 = abdunkeln
  const key = hex + '|' + t;
  let v = _shadeCache.get(key);
  if (v) return v;
  const c = hexToRgb(hex);
  const tgt = t >= 0 ? 255 : 0;
  const a = Math.abs(t);
  const r = Math.round(c.r + (tgt - c.r) * a);
  const g = Math.round(c.g + (tgt - c.g) * a);
  const b = Math.round(c.b + (tgt - c.b) * a);
  v = `rgb(${r},${g},${b})`;
  _shadeCache.set(key, v);
  return v;
}

function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ── Block-Sprites (einmal rendern, dann nur noch blitten) ────────────────────
// Glänzende, abgeschrägte Neon-Steine mit Verlauf + Glanzlicht. Pro Farbe/Größe
// nur einmal gezeichnet und gecacht → flüssig, auch bei vollem Brett.
const _blockSprites = new Map();
function renderBlockTo(ctx, bs, color) {
  const pad = Math.max(1, bs * 0.05);
  const x = pad, y = pad, s = bs - pad * 2;
  const r = Math.max(2, bs * 0.18);

  // Körper-Verlauf
  const g = ctx.createLinearGradient(x, y, x, y + s);
  g.addColorStop(0,    shade(color, 0.42));
  g.addColorStop(0.5,  color);
  g.addColorStop(1,    shade(color, -0.36));
  roundRectPath(ctx, x, y, s, s, r);
  ctx.fillStyle = g;
  ctx.fill();

  // Glanzlicht oben
  const sheen = ctx.createLinearGradient(x, y, x, y + s * 0.55);
  sheen.addColorStop(0, 'rgba(255,255,255,0.55)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  roundRectPath(ctx, x + s * 0.13, y + s * 0.1, s * 0.74, s * 0.42, r * 0.55);
  ctx.fillStyle = sheen;
  ctx.fill();

  // heller Neon-Rand
  roundRectPath(ctx, x + 0.8, y + 0.8, s - 1.6, s - 1.6, r);
  ctx.strokeStyle = shade(color, 0.55);
  ctx.lineWidth = Math.max(1, bs * 0.045);
  ctx.stroke();

  // dunkle Innenkante unten/rechts für Tiefe
  ctx.save();
  roundRectPath(ctx, x, y, s, s, r);
  ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = Math.max(1.5, bs * 0.07);
  ctx.beginPath();
  ctx.moveTo(x, y + s);
  ctx.lineTo(x + s, y + s);
  ctx.lineTo(x + s, y);
  ctx.stroke();
  ctx.restore();
}
function getBlockSprite(color, bs) {
  bs = Math.round(bs);
  const key = color + '|' + bs;
  let cv = _blockSprites.get(key);
  if (cv) return cv;
  cv = document.createElement('canvas');
  cv.width = bs; cv.height = bs;
  renderBlockTo(cv.getContext('2d'), bs, color);
  _blockSprites.set(key, cv);
  return cv;
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
  localStorage.setItem('arcade_scores', JSON.stringify(all));

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
    this.ctx         = this.boardCanvas.getContext('2d');
    this.nextCanvas  = document.getElementById('next-canvas');
    this.nctx        = this.nextCanvas.getContext('2d');
    this.holdCanvas  = document.getElementById('hold-canvas');
    this.hctx        = this.holdCanvas.getContext('2d');

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
    document.addEventListener('keydown', e => this.onKey(e));

    this.state = 'idle';
    this.renderHighScores('standard');
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
    this.lockTimer = null;
    this.animFrame = null;
    this.lastDrop  = 0;
    this.clearAnim = null;
    this.shake     = null;
    // Effekt-Systeme
    this.particles   = [];   // freie Funken/Staub
    this.flashes     = [];   // kurzes Aufblitzen abgelegter Steine
    this.dropTrail   = null; // Schweif beim Hard Drop
    this.spawn       = null; // Einblend-Animation des neuen Steins
    this.lastFrameTs = 0;
    this.state     = 'playing';

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
      color: def.color,
      x: Math.floor(COLS / 2) - Math.floor(def.shape[0].length / 2),
      y: -1,
      rot: 0,
    };
    this.holdUsed = false;
    this.spawn = { start: performance.now(), dur: 130 };
    if (!this.isValid(this.current.shape, this.current.x, this.current.y)) {
      this.gameOver();
    }
  }

  currentDropInterval() {
    return this.mode === 'standard' ? STANDARD_SPEED : dropInterval(this.level);
  }

  loop(ts = 0) {
    const dt = this.lastFrameTs ? Math.min(50, ts - this.lastFrameTs) : 16;
    this.lastFrameTs = ts;

    if (this.state === 'clearing') {
      this.updateClearAnim(ts);
      this.updateFx(dt);
      this.draw();
      this.animFrame = requestAnimationFrame(t => this.loop(t));
      return;
    }
    if (this.state !== 'playing') return;
    const elapsed = ts - this.lastDrop;
    if (elapsed >= this.currentDropInterval()) {
      this.softDrop(false);
      this.lastDrop = ts;
    }
    this.updateFx(dt);
    this.draw();
    this.animFrame = requestAnimationFrame(t => this.loop(t));
  }

  // ── Effekte aktualisieren ───────────────────────────────────────────────────
  updateFx(dt) {
    if (this.particles.length) {
      const grav = 0.00055;
      for (const p of this.particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += grav * dt;
        p.life -= dt;
        p.alpha = Math.max(0, p.life / p.maxLife);
      }
      this.particles = this.particles.filter(p => p.life > 0);
    }
  }

  // ── Movement ──────────────────────────────────────────────────────────────
  moveLeft()  { this.tryMove(-1, 0); }
  moveRight() { this.tryMove(1, 0); }

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
    if (!this.tryMove(0, 1)) {
      this.scheduleLock();
    } else {
      if (byUser) this.score += 1;
      this.clearLockDelay();
    }
  }

  hardDrop() {
    const startY = this.current.y;
    let dropped = 0;
    while (this.tryMove(0, 1)) dropped++;
    this.score += dropped * 2;
    this.hardDropCount++;
    if (this.hardDropCount === 25) tryUnlock('bd_harddrop');

    if (dropped > 0) {
      this.addDropTrail(startY, this.current.y);
      this.spawnLandingDust(this.current, Math.min(1, 0.4 + dropped * 0.06));
      if (dropped >= 3) {
        this.shake = {
          intensity: Math.min(7, 2 + dropped * 0.35),
          start: performance.now(), duration: 220,
        };
      }
    }
    this.lock();
  }

  // ── Hard-Drop-Schweif ───────────────────────────────────────────────────────
  addDropTrail(fromY, toY) {
    const shape = this.current.shape;
    const cols = [];
    for (let c = 0; c < shape[0].length; c++) {
      let top = -1;
      for (let r = 0; r < shape.length; r++) if (shape[r][c]) { top = r; break; }
      if (top >= 0) cols.push({ x: this.current.x + c, top });
    }
    this.dropTrail = {
      cols, fromY, toY, color: this.current.color,
      start: performance.now(), dur: 230,
    };
  }

  // ── Aufprall-Staub am unteren Rand des gelandeten Steins ─────────────────────
  spawnLandingDust(piece, intensity) {
    const shape = piece.shape;
    const bottomByCol = {};
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        if (shape[r][c]) bottomByCol[c] = Math.max(bottomByCol[c] ?? -1, r);

    for (const c in bottomByCol) {
      const r = bottomByCol[c];
      const bx = (piece.x + (+c) + 0.5) * BLOCK;
      const by = (piece.y + r + 1) * BLOCK;
      if (by < 0) continue;
      const n = 2 + Math.floor(Math.random() * 3 * intensity);
      for (let i = 0; i < n; i++) {
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
        const sp  = (0.04 + Math.random() * 0.12) * (0.6 + intensity);
        const life = 220 + Math.random() * 260;
        this.particles.push({
          x: bx + (Math.random() - 0.5) * BLOCK * 0.7,
          y: by - 2,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          life, maxLife: life, alpha: 1,
          size: 2 + Math.random() * 3,
          color: Math.random() < 0.5 ? piece.color : '#ffffff',
        });
      }
    }
  }

  rotate(dir = 1) {
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
    const p = this.current;
    const flashCells = [];
    for (let r = 0; r < p.shape.length; r++)
      for (let c = 0; c < p.shape[r].length; c++)
        if (p.shape[r][c]) {
          const by = p.y + r;
          if (by < 0) { this.gameOver(); return; }
          this.board[by][p.x + c] = p.color;
          flashCells.push({ x: p.x + c, y: by });
        }
    this.flashes.push({ cells: flashCells, start: performance.now(), dur: 160 });
    this.spawn = null;

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
        const color = this.board[r][c];
        if (!color) continue;
        const cx = (c + 0.5) * BLOCK;
        const cy = (r + 0.5) * BLOCK;
        const count = 5 + Math.floor(Math.random() * 4);
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

    const shakeIntensity = [0, 0, 4, 7, 13][lineCount] || 13;
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
      const prevLevel = this.level;
      this.level = Math.floor(this.lines / 10) + 1;
      if (this.level > prevLevel) celebrateLevelUp(this.level);

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
    if (this.holdUsed) return;
    this.clearLockDelay();
    const type = this.current.type;
    this.holdEverUsed = true;
    if (this.holdKey) {
      const tmp = this.holdKey;
      this.holdKey = type;
      const def = PIECES[tmp];
      this.current = {
        type: tmp, shape: deepCopy(def.shape), color: def.color,
        x: Math.floor(COLS / 2) - Math.floor(def.shape[0].length / 2),
        y: -1, rot: 0,
      };
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
  draw() {
    const ctx = this.ctx;
    const W = this.boardCanvas.width;
    const H = this.boardCanvas.height;

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

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * BLOCK, 0); ctx.lineTo(c * BLOCK, H); ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * BLOCK); ctx.lineTo(W, r * BLOCK); ctx.stroke();
    }

    const isClearing = this.state === 'clearing' && this.clearAnim;
    const clearedSet = isClearing ? new Set(this.clearAnim.rows) : null;

    for (let r = 0; r < ROWS; r++) {
      if (clearedSet && clearedSet.has(r)) continue;
      for (let c = 0; c < COLS; c++)
        if (this.board[r][c]) this.drawCell(ctx, c, r, this.board[r][c], BLOCK);
    }

    if (!isClearing) this.drawDropTrail(ctx);
    if (!isClearing) this.drawFlashes(ctx);

    if (this.current && !isClearing) {
      const gy = this.ghostY();
      if (gy !== this.current.y)
        this.drawGhostPiece(ctx, this.current.shape, this.current.x, gy, this.current.color, BLOCK);

      // Einblenden des frisch gespawnten Steins
      let alpha = 1;
      if (this.spawn) {
        const t = (performance.now() - this.spawn.start) / this.spawn.dur;
        if (t >= 1) this.spawn = null;
        else alpha = 0.35 + 0.65 * easeOut(t);
      }
      ctx.save();
      ctx.globalAlpha = alpha;
      this.drawPiece(ctx, this.current.shape, this.current.x, this.current.y, this.current.color, BLOCK, true);
      ctx.restore();
    }

    this.drawParticles(ctx);

    if (isClearing) this.drawClearAnim(ctx);

    ctx.restore();

    this.drawNextQueue();
    this.drawHold();
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
            const color = this.board[r][c];
            if (color) this.drawCell(ctx, c, r, color, BLOCK);
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

  drawDropTrail(ctx) {
    const tr = this.dropTrail;
    if (!tr) return;
    const t = (performance.now() - tr.start) / tr.dur;
    if (t >= 1) { this.dropTrail = null; return; }
    const fade = 1 - t;
    const c = hexToRgb(tr.color);
    for (const col of tr.cols) {
      const x = col.x * BLOCK;
      const y1 = (tr.fromY + col.top) * BLOCK;
      const y2 = (tr.toY + col.top) * BLOCK;
      if (y2 <= y1) continue;
      const grad = ctx.createLinearGradient(0, y1, 0, y2 + BLOCK);
      grad.addColorStop(0, `rgba(${c.r},${c.g},${c.b},0)`);
      grad.addColorStop(1, `rgba(${c.r},${c.g},${c.b},${0.5 * fade})`);
      ctx.fillStyle = grad;
      ctx.fillRect(x + BLOCK * 0.2, Math.max(0, y1), BLOCK * 0.6, y2 - y1 + BLOCK);
    }
  }

  drawFlashes(ctx) {
    if (!this.flashes.length) return;
    const now = performance.now();
    const r = Math.max(2, BLOCK * 0.18);
    const pad = Math.max(1, BLOCK * 0.05);
    for (const f of this.flashes) {
      const t = (now - f.start) / f.dur;
      if (t >= 1) continue;
      const a = (1 - t) * 0.85;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      for (const cell of f.cells) {
        if (cell.y < 0) continue;
        roundRectPath(ctx, cell.x * BLOCK + pad, cell.y * BLOCK + pad, BLOCK - pad * 2, BLOCK - pad * 2, r);
        ctx.fill();
      }
    }
    this.flashes = this.flashes.filter(f => (now - f.start) / f.dur < 1);
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      if (p.alpha <= 0) continue;
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  drawPiece(ctx, shape, ox, oy, color, bs, glow = false) {
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        if (shape[r][c]) this.drawCell(ctx, ox + c, oy + r, color, bs, glow);
  }

  drawCell(ctx, cx, cy, color, bs, glow = false) {
    if (cy < 0) return;
    const sprite = getBlockSprite(color, bs);
    const x = cx * bs, y = cy * bs;
    if (glow) {
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = bs * 0.55;
      ctx.drawImage(sprite, x, y);
      ctx.restore();
    } else {
      ctx.drawImage(sprite, x, y);
    }
  }

  // Ghost: nur Umriss in der Stein-Farbe, dezent gefüllt
  drawGhostPiece(ctx, shape, ox, oy, color, bs) {
    const c = hexToRgb(color);
    const pad = Math.max(1, bs * 0.05);
    const r = Math.max(2, bs * 0.18);
    ctx.save();
    ctx.setLineDash([bs * 0.22, bs * 0.16]);
    ctx.lineWidth = Math.max(1, bs * 0.06);
    for (let rr = 0; rr < shape.length; rr++)
      for (let cc = 0; cc < shape[rr].length; cc++) {
        if (!shape[rr][cc]) continue;
        const gy = oy + rr;
        if (gy < 0) continue;
        const x = (ox + cc) * bs + pad, y = gy * bs + pad, s = bs - pad * 2;
        roundRectPath(ctx, x, y, s, s, r);
        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},0.08)`;
        ctx.fill();
        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},0.55)`;
        ctx.stroke();
      }
    ctx.restore();
  }

  drawNextQueue() {
    const ctx = this.nctx;
    ctx.clearRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
    const bs = 18, slotH = 52;
    for (let i = 0; i < Math.min(PREVIEW_COUNT, this.queue.length); i++) {
      const type = this.queue[i];
      const def  = PIECES[type];
      const shape = def.shape;
      const ox = Math.floor((this.nextCanvas.width / bs - shape[0].length) / 2);
      const oy = Math.round((slotH / bs - shape.length) / 2) + i * Math.floor(slotH / bs);
      this.drawPiece(ctx, shape, ox, oy, def.color, bs);
    }
  }

  drawHold() {
    const ctx = this.hctx;
    ctx.clearRect(0, 0, this.holdCanvas.width, this.holdCanvas.height);
    if (!this.holdKey) return;
    const bs = 18;
    const def = PIECES[this.holdKey];
    const shape = def.shape;
    const ox = Math.floor((this.holdCanvas.width  / bs - shape[0].length) / 2);
    const oy = Math.floor((this.holdCanvas.height / bs - shape.length)    / 2);
    if (this.holdUsed) {
      ctx.save();
      ctx.globalAlpha = 0.4;
      this.drawPiece(ctx, shape, ox, oy, '#8088aa', bs);
      ctx.restore();
    } else {
      this.drawPiece(ctx, shape, ox, oy, def.color, bs);
    }
  }

  drawIdleBoard() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.boardCanvas.width, this.boardCanvas.height);
    const types = Object.keys(PIECES);
    for (let r = 14; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (Math.random() > 0.4)
          this.drawCell(ctx, c, r, PIECES[types[Math.floor(Math.random() * types.length)]].color, BLOCK);
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  updateUI() {
    this.scoreEl.textContent = this.score;
    this.levelEl.textContent = this.level;
    this.linesEl.textContent = this.lines;
    this.levelBar.style.width = `${(this.lines % 10) / 10 * 100}%`;
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
          `<small style="color:#555;font-size:10px"> &nbsp;L${s.level} · ${s.lines}ln</small>`
        ).join('<br>')
      : '<em style="color:#555">None yet</em>';
  }

  async gameOver() {
    this.state = 'gameover';
    cancelAnimationFrame(this.animFrame);
    this.clearLockDelay();
    this.clearAnim = null;
    if (!this.holdEverUsed && this.score > 0) tryUnlock('bd_no_hold');
    await dbSaveScore(this.score, this.mode, this.level, this.lines);
    await this.renderHighScores(this.mode);
    const modeLabel = this.mode === 'standard' ? 'Standard' : 'Classic';
    this.overlay.innerHTML = `
      <h1 style="color:#e94560">GAME OVER</h1>
      <p>Mode: <strong>${modeLabel}</strong></p>
      <p>Score: <strong>${this.score.toLocaleString()}</strong></p>
      <p>Level: <strong>${this.level}</strong> &nbsp; Lines: <strong>${this.lines}</strong></p>
      <div class="mode-btns">
        <button class="mode-btn ${this.mode === 'classic'  ? 'selected' : ''}" id="mode-classic">Classic<small>Speed increases</small></button>
        <button class="mode-btn ${this.mode === 'standard' ? 'selected' : ''}" id="mode-standard">Standard<small>Fixed speed</small></button>
      </div>
      <button class="btn" id="start-btn">Play Again</button>
    `;
    this.overlay.style.display = 'flex';
    this._bindModeButtons();
    document.getElementById('start-btn').addEventListener('click', () => this.startGame(this.selectedMode));
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      cancelAnimationFrame(this.animFrame);
      this.clearLockDelay();
      const modeLabel = this.mode === 'standard' ? 'Standard' : 'Classic';
      this.overlay.innerHTML = `
        <h1>PAUSED</h1>
        <p style="color:#888">Mode: ${modeLabel}</p>
        <button class="btn" id="start-btn">Resume</button>
      `;
      this.overlay.style.display = 'flex';
      document.getElementById('start-btn').addEventListener('click', () => this.resume());
    }
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.overlay.style.display = 'none';
    this.lastDrop = performance.now();
    this.loop(performance.now());
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  onKey(e) {
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

// ── DAS (Delayed Auto Shift) ───────────────────────────────────────────────
(function addDAS() {
  const DAS_DELAY = 150, DAS_REPEAT = 50;
  const SOFT_DROP_REPEAT = 25; // Soft-Drop: instant + sehr schnelle Wiederholung
  let dasTimer = null, dasDir = 0;
  let downTimer = null;

  document.addEventListener('keydown', e => {
    if (e.repeat) return; // Native Browser-Repeat ignorieren — DAS macht das
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

// ── Boot ──────────────────────────────────────────────────────────────────
window._game = new BlockDrop();
