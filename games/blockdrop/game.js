'use strict';

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

// ── Database (scores.json via server.ps1) ─────────────────────────────────
async function dbSaveScore(score, mode, level, lines) {
  await fetch('/api/scores', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ mode, score, level, lines, date: new Date().toISOString() }),
  });
}

async function dbLoadScores(mode) {
  const res = await fetch(`/api/scores?mode=${mode}`);
  return res.json();
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

    this.selectedMode = 'classic';
    this.hsViewMode   = 'classic';
    this.clearAnim    = null;
    this.shake        = null;

    this._bindModeButtons();
    this.startBtn.addEventListener('click', () => this.startGame(this.selectedMode));
    document.addEventListener('keydown', e => this.onKey(e));

    this.state = 'idle';
    this.renderHighScores('classic');
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
    });
    btnStandard.addEventListener('click', () => {
      this.selectedMode = 'standard';
      btnStandard.classList.add('selected');
      btnClassic.classList.remove('selected');
    });

    const tabClassic  = document.getElementById('hs-tab-classic');
    const tabStandard = document.getElementById('hs-tab-standard');
    if (!tabClassic) return;
    tabClassic.addEventListener('click', () => {
      this.hsViewMode = 'classic';
      tabClassic.classList.add('active');
      tabStandard.classList.remove('active');
      this.renderHighScores('classic');
    });
    tabStandard.addEventListener('click', () => {
      this.hsViewMode = 'standard';
      tabStandard.classList.add('active');
      tabClassic.classList.remove('active');
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
    this.holdKey   = null;
    this.holdUsed  = false;
    this.lockDelay = 500;
    this.lockTimer = null;
    this.animFrame = null;
    this.lastDrop  = 0;
    this.clearAnim = null;
    this.shake     = null;
    this.state     = 'playing';

    this.queue = [];
    for (let i = 0; i < PREVIEW_COUNT; i++) this.queue.push(this.bag.next());

    this.spawnPiece();
    this.overlay.style.display = 'none';
    this.updateUI();
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
    this.draw();
    this.animFrame = requestAnimationFrame(t => this.loop(t));
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
    let dropped = 0;
    while (this.tryMove(0, 1)) dropped++;
    this.score += dropped * 2;
    this.lock();
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
    for (let r = 0; r < p.shape.length; r++)
      for (let c = 0; c < p.shape[r].length; c++)
        if (p.shape[r][c]) {
          const by = p.y + r;
          if (by < 0) { this.gameOver(); return; }
          this.board[by][p.x + c] = p.color;
        }

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
      this.level = Math.floor(this.lines / 10) + 1;
    } else {
      this.combo = -1;
    }
    this.updateUI();
  }

  holdPiece() {
    if (this.holdUsed) return;
    this.clearLockDelay();
    const type = this.current.type;
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

    if (this.current && !isClearing) {
      const gy = this.ghostY();
      this.drawPiece(ctx, this.current.shape, this.current.x, gy, COLORS.ghost, BLOCK);
      this.drawPiece(ctx, this.current.shape, this.current.x, this.current.y, this.current.color, BLOCK);
    }

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

  drawPiece(ctx, shape, ox, oy, color, bs) {
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        if (shape[r][c]) this.drawCell(ctx, ox + c, oy + r, color, bs);
  }

  drawCell(ctx, cx, cy, color, bs) {
    if (cy < 0) return;
    const x = cx * bs, y = cy * bs;
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, bs - 2, bs - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x + 1, y + 1, bs - 2, 3);
    ctx.fillRect(x + 1, y + 1, 3, bs - 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x + 1, y + bs - 4, bs - 2, 3);
    ctx.fillRect(x + bs - 4, y + 1, 3, bs - 2);
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
    this.drawPiece(ctx, shape, ox, oy, this.holdUsed ? 'rgba(150,150,150,0.5)' : def.color, bs);
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

  async renderHighScores(mode = 'classic') {
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
    await dbSaveScore(this.score, this.mode, this.level, this.lines);
    await this.renderHighScores(this.mode);
    this._setHsTab(this.mode);
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

  _setHsTab(mode) {
    const tabClassic  = document.getElementById('hs-tab-classic');
    const tabStandard = document.getElementById('hs-tab-standard');
    if (!tabClassic) return;
    if (mode === 'standard') {
      tabStandard.classList.add('active'); tabClassic.classList.remove('active');
      this.hsViewMode = 'standard';
    } else {
      tabClassic.classList.add('active'); tabStandard.classList.remove('active');
      this.hsViewMode = 'classic';
    }
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
      case 'ArrowLeft':  e.preventDefault(); this.moveLeft();   break;
      case 'ArrowRight': e.preventDefault(); this.moveRight();  break;
      case 'ArrowDown':  e.preventDefault(); this.softDrop();   break;
      case 'ArrowUp':
      case 'z': case 'Z': e.preventDefault(); this.rotate(1);  break;
      case 'x': case 'X': e.preventDefault(); this.rotate(-1); break;
      case ' ':           e.preventDefault(); this.hardDrop();  break;
      case 'c': case 'C': e.preventDefault(); this.holdPiece(); break;
      case 'p': case 'P': case 'Escape': this.togglePause();   break;
    }
  }
}

// ── DAS (Delayed Auto Shift) ───────────────────────────────────────────────
(function addDAS() {
  const DAS_DELAY = 150, DAS_REPEAT = 50;
  let dasTimer = null, dasDir = 0;

  document.addEventListener('keydown', e => {
    if (!window._game || window._game.state !== 'playing') return;
    if (e.key === 'ArrowLeft' && dasDir !== -1) {
      clearInterval(dasTimer); dasDir = -1;
      dasTimer = setTimeout(() => {
        dasTimer = setInterval(() => window._game.moveLeft(), DAS_REPEAT);
      }, DAS_DELAY);
    } else if (e.key === 'ArrowRight' && dasDir !== 1) {
      clearInterval(dasTimer); dasDir = 1;
      dasTimer = setTimeout(() => {
        dasTimer = setInterval(() => window._game.moveRight(), DAS_REPEAT);
      }, DAS_REPEAT);
    }
  });

  document.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      clearInterval(dasTimer); dasTimer = null; dasDir = 0;
    }
  });
})();

// ── Boot ──────────────────────────────────────────────────────────────────
window._game = new BlockDrop();
