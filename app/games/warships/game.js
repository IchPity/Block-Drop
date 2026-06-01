/* ════════════════════════════════════════════════════════════════════════
   WarShips — wellenbasiertes Seegefecht mit Schiffs-Upgrades
   Du steuerst nur das Schiff; Geschütze zielen & feuern automatisch.
   ════════════════════════════════════════════════════════════════════════ */

// ── High score (localStorage + Cloud) ───────────────────────────────────────
const HS_KEY = 'arcade_scores';
function loadBestWave() {
  try {
    const all = JSON.parse(localStorage.getItem(HS_KEY)) || {};
    const list = all.warships || [];
    return list.reduce((m, e) => Math.max(m, e.wave || 0), 0);
  } catch (e) { return 0; }
}
function saveRun(wave, scrapTotal) {
  let all;
  try { all = JSON.parse(localStorage.getItem(HS_KEY)) || {}; } catch (e) { all = {}; }
  if (!all.warships) all.warships = [];
  all.warships.push({ wave, scrap: scrapTotal, score: wave, date: new Date().toISOString() });
  all.warships.sort((a, b) => (b.wave - a.wave) || (b.scrap - a.scrap));
  all.warships = all.warships.slice(0, 10);
  localStorage.setItem(HS_KEY, JSON.stringify(all));

  if (window.Auth && window.Auth.user && wave > 0) {
    window.Auth.saveScore({ game: 'warships', mode: 'survival', score: wave, level: wave, lines: scrapTotal }).catch(() => {});
  }
}

// ── Schiffs-Tiers (Boot) ─────────────────────────────────────────────────────
// hp, speed, turrets (Anzahl Geschütze), radius, name
const HULLS = [
  { name: 'Schaluppe',     hp: 100, speed: 3.4, turrets: 1, radius: 15 },
  { name: 'Korvette',      hp: 175, speed: 3.2, turrets: 2, radius: 18 },
  { name: 'Fregatte',      hp: 290, speed: 3.0, turrets: 3, radius: 22 },
  { name: 'Kreuzer',       hp: 460, speed: 2.8, turrets: 4, radius: 26 },
  { name: 'Schlachtschiff',hp: 720, speed: 2.6, turrets: 5, radius: 31 },
];
const HULL_COSTS = [120, 280, 600, 1200]; // Kosten um auf Tier i+1 zu gehen

// ── Upgrades (außer Boot) ────────────────────────────────────────────────────
// level startet bei 0; max = Anzahl Kosten-Einträge
const UPGRADES = {
  damage:    { icon: '💥', name: 'Schaden',    desc: 'Mehr Durchschlag pro Treffer.',                costs: [60, 110, 190, 300, 460, 680, 980] },
  firerate:  { icon: '⚡', name: 'Kadenz',     desc: 'Geschütze feuern schneller.',                 costs: [70, 130, 220, 340, 520, 760] },
  targeting: { icon: '🎯', name: 'Zielsystem', desc: 'Reichweite, Projektil-Tempo & Vorhalten.',    costs: [80, 150, 250, 380, 560, 820] },
  multishot: { icon: '🔱', name: 'Salve',      desc: 'Jedes Geschütz feuert eine zusätzliche Kugel.', costs: [220, 420, 720] },
  armor:     { icon: '🛡️', name: 'Panzerung',  desc: 'Mehr Rumpf + langsame Reparatur.',            costs: [90, 160, 270, 420, 620] },
  engine:    { icon: '⚙️', name: 'Antrieb',    desc: 'Schnellere Bewegung & Wendigkeit.',           costs: [70, 130, 210, 320, 470] },
};

// ── Gegner-Typen ─────────────────────────────────────────────────────────────
const ENEMIES = {
  scout:     { name: 'Späher',      hp: 22,  speed: 1.9,  radius: 11, reward: 6,   color: '#fbbf24', touch: 14, fire: 0 },
  gunboat:   { name: 'Kanonenboot', hp: 50,  speed: 1.05, radius: 14, reward: 14,  color: '#f97316', touch: 16, fire: 1700, bullet: 7,  bspeed: 3.1 },
  destroyer: { name: 'Zerstörer',   hp: 130, speed: 0.78, radius: 19, reward: 34,  color: '#ef4444', touch: 22, fire: 1100, bullet: 12, bspeed: 3.6 },
  boss:      { name: 'Flaggschiff', hp: 1400,speed: 0.55, radius: 40, reward: 320, color: '#c026d3', touch: 40, fire: 700,  bullet: 18, bspeed: 3.4 },
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

// ── Game ─────────────────────────────────────────────────────────────────────
class WarShips {
  constructor() {
    this.canvas = document.getElementById('board');
    this.ctx = this.canvas.getContext('2d');
    this.W = this.canvas.width;
    this.H = this.canvas.height;

    this.overlay     = document.getElementById('overlay');
    this.intro       = document.getElementById('ov-intro');
    this.shopOverlay = document.getElementById('overlay-shop');
    this.shopGrid    = document.getElementById('shop-grid');
    this.toastEl     = document.getElementById('toast');

    this.state = 'idle'; // idle | playing | shop | paused | gameover
    this.keys = {};
    this.pointer = { active: false, x: 0, y: 0 };
    this.lastT = 0;
    this.bestWave = loadBestWave();

    this.initWater();
    this.bindInput();
    this.bindUI();
    this.showIntro();

    requestAnimationFrame((t) => this.loop(t));
  }

  // ── Setup / reset ──────────────────────────────────────────────────────────
  resetRun() {
    this.upg = { damage: 0, firerate: 0, targeting: 0, multishot: 0, armor: 0, engine: 0 };
    this.hullTier = 0;
    this.scrap = 0;
    this.scrapTotal = 0;
    this.wave = 0;
    this.makeShip(true);
  }

  makeShip(full) {
    const hull = HULLS[this.hullTier];
    const maxHp = hull.hp + this.upg.armor * 45;
    this.ship = {
      x: this.W / 2, y: this.H / 2,
      angle: -Math.PI / 2,
      radius: hull.radius,
      maxHp,
      hp: full ? maxHp : Math.min(this.ship ? this.ship.hp : maxHp, maxHp),
      turrets: hull.turrets,
      hitFlash: 0,
    };
    if (full) this.ship.hp = maxHp;
  }

  get shipSpeed() { return HULLS[this.hullTier].speed + this.upg.engine * 0.42; }
  get fireInterval() { return Math.max(170, 720 * Math.pow(0.86, this.upg.firerate)); }
  get damage() { return 11 * (1 + this.upg.damage * 0.32); }
  get range() { return 230 + this.upg.targeting * 34; }
  get bulletSpeed() { return 6.4 + this.upg.targeting * 0.45; }
  get shotsPerTurret() { return 1 + this.upg.multishot; }
  get repairPerSec() { return this.upg.armor * 1.6; }

  // ── Input ────────────────────────────────────────────────────────────────────
  bindInput() {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      this.keys[k] = true;
      if (k === 'p') this.togglePause();
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });

    const area = document.getElementById('game-area');
    const toLocal = (cx, cy) => {
      const r = this.canvas.getBoundingClientRect();
      return { x: (cx - r.left) / r.width * this.W, y: (cy - r.top) / r.height * this.H };
    };
    const down = (cx, cy) => { const p = toLocal(cx, cy); this.pointer.active = true; this.pointer.x = p.x; this.pointer.y = p.y; };
    const move = (cx, cy) => { if (!this.pointer.active) return; const p = toLocal(cx, cy); this.pointer.x = p.x; this.pointer.y = p.y; };
    const up = () => { this.pointer.active = false; };

    this.canvas.addEventListener('mousedown', (e) => down(e.clientX, e.clientY));
    window.addEventListener('mousemove', (e) => move(e.clientX, e.clientY));
    window.addEventListener('mouseup', up);
    area.addEventListener('touchstart', (e) => { e.preventDefault(); const t = e.touches[0]; down(t.clientX, t.clientY); }, { passive: false });
    area.addEventListener('touchmove', (e) => { e.preventDefault(); const t = e.touches[0]; move(t.clientX, t.clientY); }, { passive: false });
    area.addEventListener('touchend', up);
    area.addEventListener('touchcancel', up);
  }

  bindUI() {
    document.getElementById('start-btn').addEventListener('click', () => this.startRun());
    document.getElementById('next-wave-btn').addEventListener('click', () => this.startWave());
  }

  // ── Screens ──────────────────────────────────────────────────────────────────
  showIntro() {
    this.state = 'idle';
    this.intro.style.display = '';
    this.shopOverlay.style.display = 'none';
    this.overlay.classList.remove('hidden');
    const hs = document.getElementById('hs-line');
    hs.textContent = this.bestWave > 0 ? `🏆 Bisher weitester Vorstoß: Welle ${this.bestWave}` : '';
    document.getElementById('nav-best').textContent = this.bestWave;
  }

  startRun() {
    this.resetRun();
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.particles = [];
    this.floaters = [];
    this.overlay.classList.add('hidden');
    this.shopOverlay.style.display = 'none';
    this.startWave();
  }

  startWave() {
    this.wave++;
    this.makeShip(false);
    this.spawnWave(this.wave);
    this.overlay.classList.add('hidden');
    this.shopOverlay.style.display = 'none';
    this.state = 'playing';
    this.updateHUD();
    this.toast(`Welle ${this.wave}`, this.isBossWave(this.wave) ? '#c026d3' : '#38bdf8');
  }

  isBossWave(w) { return w % 5 === 0; }

  // ── Wellen-Aufbau ──────────────────────────────────────────────────────────
  spawnWave(w) {
    const q = [];
    if (this.isBossWave(w)) {
      q.push({ type: 'boss', hpScale: 1 + (w / 5 - 1) * 0.7 });
      const escorts = 2 + Math.floor(w / 5);
      for (let i = 0; i < escorts; i++) q.push({ type: i % 2 ? 'gunboat' : 'destroyer' });
    } else {
      const scouts    = 3 + Math.floor(w * 1.4);
      const gunboats  = Math.max(0, Math.floor(w * 0.9) - 1);
      const destroyers = Math.max(0, Math.floor((w - 2) * 0.5));
      for (let i = 0; i < scouts; i++) q.push({ type: 'scout' });
      for (let i = 0; i < gunboats; i++) q.push({ type: 'gunboat' });
      for (let i = 0; i < destroyers; i++) q.push({ type: 'destroyer' });
    }
    // Mehr HP pro Welle, damit es zieht
    const hpMul = 1 + (w - 1) * 0.12;
    this.spawnQueue = q.map((e) => ({ ...e, hpMul }));
    this.spawnTimer = 0;
    this.spawnGap = this.isBossWave(w) ? 700 : Math.max(280, 760 - w * 18);
  }

  spawnEnemy(spec) {
    const base = ENEMIES[spec.type];
    // Rand-Spawn
    const side = Math.floor(rand(0, 4));
    let x, y;
    const m = 40;
    if (side === 0) { x = rand(0, this.W); y = -m; }
    else if (side === 1) { x = this.W + m; y = rand(0, this.H); }
    else if (side === 2) { x = rand(0, this.W); y = this.H + m; }
    else { x = -m; y = rand(0, this.H); }

    const hp = base.hp * (spec.hpMul || 1) * (spec.hpScale || 1);
    this.enemies.push({
      type: spec.type, x, y,
      hp, maxHp: hp,
      speed: base.speed, radius: base.radius,
      reward: Math.round(base.reward * (spec.hpScale || 1)),
      color: base.color, touch: base.touch,
      fire: base.fire, fireTimer: rand(400, base.fire || 1000),
      bullet: base.bullet, bspeed: base.bspeed,
      angle: 0, hitFlash: 0,
      wobble: rand(0, TAU),
    });
  }

  // ── Game over ──────────────────────────────────────────────────────────────
  gameOver() {
    this.state = 'gameover';
    if (this.wave - 1 > this.bestWave) this.bestWave = this.wave - 1;
    saveRun(this.wave, this.scrapTotal);
    this.bestWave = Math.max(this.bestWave, loadBestWave());

    this.intro.style.display = 'none';
    this.shopOverlay.style.display = 'none';
    this.overlay.classList.remove('hidden');

    // Render a game-over panel into intro slot
    this.intro.style.display = '';
    this.intro.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:16px">
        <div class="ov-eyebrow" style="color:#e94560">Schiff versenkt</div>
        <div class="ov-title">Welle <em>${this.wave}</em></div>
        <div class="ov-sub">
          Dein <strong>${HULLS[this.hullTier].name}</strong> ging unter.
          Gesammelter Schrott: <strong>${this.scrapTotal}</strong>.
          ${this.wave - 1 >= this.bestWave && this.wave > 1 ? '<br>🏆 <strong>Neuer Rekord!</strong>' : `<br>Rekord: Welle ${this.bestWave}`}
        </div>
        <button class="btn" id="restart-btn">Nochmal auslaufen &nbsp;→</button>
      </div>`;
    document.getElementById('restart-btn').addEventListener('click', () => {
      // Restore intro markup minimal then start
      this.startRun();
    });
    document.getElementById('nav-best').textContent = this.bestWave;
  }

  // ── Shop ─────────────────────────────────────────────────────────────────────
  openShop() {
    this.state = 'shop';
    this.overlay.classList.add('hidden');
    this.shopOverlay.style.display = 'flex';
    document.getElementById('shop-eyebrow').textContent =
      `Werft · Welle ${this.wave} geschafft` + (this.waveBonus ? ` · +${this.waveBonus} Bonus` : '');
    this.renderShop();
  }

  renderShop() {
    document.getElementById('shop-scrap').textContent = this.scrap;
    const cards = [];

    // Boot (Hull) card
    const atMax = this.hullTier >= HULLS.length - 1;
    const next = atMax ? null : HULLS[this.hullTier + 1];
    const hullCost = atMax ? null : HULL_COSTS[this.hullTier];
    cards.push(this.upgradeCard({
      key: 'hull', icon: '⛴️', name: `Boot · ${HULLS[this.hullTier].name}`,
      desc: atMax ? 'Maximale Klasse erreicht.' : `Aufstieg zur ${next.name}: +Rumpf, +Geschütz, mehr Wucht.`,
      level: this.hullTier, max: HULLS.length - 1,
      cost: hullCost, atMax,
    }));

    // Other upgrades
    for (const key of Object.keys(UPGRADES)) {
      const u = UPGRADES[key];
      const lvl = this.upg[key];
      const max = u.costs.length;
      const isMax = lvl >= max;
      cards.push(this.upgradeCard({
        key, icon: u.icon, name: u.name, desc: u.desc,
        level: lvl, max, cost: isMax ? null : u.costs[lvl], atMax: isMax,
      }));
    }

    this.shopGrid.innerHTML = cards.join('');
    // wire buttons
    this.shopGrid.querySelectorAll('.uc-buy').forEach((btn) => {
      btn.addEventListener('click', () => this.buy(btn.dataset.key));
    });
  }

  upgradeCard({ key, icon, name, desc, level, max, cost, atMax }) {
    const pips = Array.from({ length: max }, (_, i) =>
      `<div class="pip ${i < level ? 'on' : ''}"></div>`).join('');
    let btn;
    if (atMax) {
      btn = `<button class="uc-buy" disabled>✓ Max</button>`;
    } else {
      const afford = this.scrap >= cost;
      btn = `<button class="uc-buy" data-key="${key}" ${afford ? '' : 'disabled'}>${cost} ⬡ Schrott</button>`;
    }
    return `
      <div class="up-card ${atMax ? 'maxed' : ''}">
        <div class="uc-top"><span class="uc-icon">${icon}</span><span class="uc-name">${name}</span></div>
        <div class="uc-desc">${desc}</div>
        <div class="uc-pips">${pips}</div>
        ${btn}
      </div>`;
  }

  buy(key) {
    let cost;
    if (key === 'hull') {
      if (this.hullTier >= HULLS.length - 1) return;
      cost = HULL_COSTS[this.hullTier];
      if (this.scrap < cost) return;
      this.scrap -= cost;
      this.hullTier++;
      this.makeShip(false); // behält HP-Anteil, erhöht max
      this.toast(`Aufgestiegen: ${HULLS[this.hullTier].name}!`, '#4ade80');
    } else {
      const u = UPGRADES[key];
      const lvl = this.upg[key];
      if (lvl >= u.costs.length) return;
      cost = u.costs[lvl];
      if (this.scrap < cost) return;
      this.scrap -= cost;
      this.upg[key]++;
      if (key === 'armor') this.makeShip(false);
      this.toast(`${u.name} Stufe ${this.upg[key]}`, '#38bdf8');
    }
    this.updateHUD();
    this.renderShop();
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  togglePause() {
    if (this.state === 'playing') { this.state = 'paused'; this.toast('Pause — P zum Fortsetzen', '#cbd5e1'); }
    else if (this.state === 'paused') { this.state = 'playing'; this.toast('Weiter!', '#4ade80'); }
  }

  loop(t) {
    const dt = Math.min(50, t - (this.lastT || t));
    this.lastT = t;
    if (this.state === 'playing') this.update(dt);
    this.render(dt);
    requestAnimationFrame((nt) => this.loop(nt));
  }

  update(dt) {
    const f = dt / 16.67; // frame-skalierter Faktor
    const s = this.ship;

    // Bewegung — Tasten
    let mx = 0, my = 0;
    if (this.keys['a'] || this.keys['arrowleft']) mx -= 1;
    if (this.keys['d'] || this.keys['arrowright']) mx += 1;
    if (this.keys['w'] || this.keys['arrowup']) my -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) my += 1;

    // Pointer-Steuerung (zieht Schiff zum Finger/Maus)
    if (this.pointer.active) {
      const dx = this.pointer.x - s.x, dy = this.pointer.y - s.y;
      const d = Math.hypot(dx, dy);
      if (d > 4) { mx += dx / d; my += dy / d; }
    }

    const ml = Math.hypot(mx, my);
    if (ml > 0) {
      mx /= ml; my /= ml;
      const sp = this.shipSpeed * f;
      s.x = clamp(s.x + mx * sp, s.radius, this.W - s.radius);
      s.y = clamp(s.y + my * sp, s.radius, this.H - s.radius);
      s.angle = Math.atan2(my, mx);
    }

    // Reparatur
    if (this.repairPerSec > 0 && s.hp < s.maxHp) {
      s.hp = Math.min(s.maxHp, s.hp + this.repairPerSec * dt / 1000);
    }
    if (s.hitFlash > 0) s.hitFlash -= dt;

    // Spawnen aus Queue
    if (this.spawnQueue && this.spawnQueue.length) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnEnemy(this.spawnQueue.shift());
        this.spawnTimer = this.spawnGap;
      }
    }

    this.updateTurrets(dt);
    this.updateBullets(f, dt);
    this.updateEnemies(f, dt);
    this.updateEnemyBullets(f);
    this.updateParticles(f, dt);
    this.updateFloaters(dt);
    this.updateWater(f);

    // Wellenende?
    if (this.spawnQueue && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      const bonus = 30 + this.wave * 15; // Bonus fürs Überstehen der Welle
      this.scrap += bonus; this.scrapTotal += bonus;
      this.waveBonus = bonus;
      this.openShop();
    }

    this.updateHUD();
  }

  // ── Geschütze: Auto-Ziel + Feuer ─────────────────────────────────────────────
  updateTurrets(dt) {
    if (!this.turretTimers) this.turretTimers = [];
    const n = this.ship.turrets;
    while (this.turretTimers.length < n) this.turretTimers.push(rand(0, 200));
    this.turretTimers.length = n;

    const interval = this.fireInterval;
    for (let i = 0; i < n; i++) {
      this.turretTimers[i] -= dt;
      if (this.turretTimers[i] > 0) continue;

      const target = this.acquireTarget(i, n);
      if (!target) { this.turretTimers[i] = 120; continue; }
      this.turretTimers[i] = interval;
      this.fireAt(target, i, n);
    }
  }

  acquireTarget(i, n) {
    // Jedes Geschütz nimmt nach Möglichkeit ein anderes Ziel (Fokus-Verteilung),
    // sonst das nächste in Reichweite.
    const inRange = this.enemies
      .map((e) => ({ e, d: Math.hypot(e.x - this.ship.x, e.y - this.ship.y) }))
      .filter((o) => o.d <= this.range)
      .sort((a, b) => a.d - b.d);
    if (!inRange.length) return null;
    if (this.upg.multishot >= 0 && inRange.length > 1) {
      return inRange[i % inRange.length].e;
    }
    return inRange[0].e;
  }

  fireAt(target, i, n) {
    const s = this.ship;
    // Mündungsposition leicht versetzt pro Geschütz
    const spread = n > 1 ? (i / (n - 1) - 0.5) : 0;
    const perp = s.angle + Math.PI / 2;
    const off = spread * s.radius * 1.4;
    const mx = s.x + Math.cos(perp) * off;
    const my = s.y + Math.sin(perp) * off;

    // Vorhalten (Lead) — abhängig vom Zielsystem
    const bs = this.bulletSpeed;
    let aimX = target.x, aimY = target.y;
    if (this.upg.targeting >= 1) {
      const dist = Math.hypot(target.x - mx, target.y - my);
      const tof = dist / bs; // time of flight in frames
      const lead = Math.min(this.upg.targeting * 0.22, 1);
      // Gegner bewegen sich grob Richtung Schiff
      const tvx = (s.x - target.x), tvy = (s.y - target.y);
      const tl = Math.hypot(tvx, tvy) || 1;
      aimX = target.x + (tvx / tl) * target.speed * tof * lead;
      aimY = target.y + (tvy / tl) * target.speed * tof * lead;
    }

    const baseAng = Math.atan2(aimY - my, aimX - mx);
    const shots = this.shotsPerTurret;
    const dmg = this.damage;
    const homing = this.upg.targeting >= 4;
    for (let k = 0; k < shots; k++) {
      const a = baseAng + (shots > 1 ? (k - (shots - 1) / 2) * 0.10 : 0);
      this.bullets.push({
        x: mx, y: my,
        vx: Math.cos(a) * bs, vy: Math.sin(a) * bs,
        dmg, life: 1400, homing, speed: bs,
        r: 3.2 + Math.min(this.upg.damage * 0.25, 3),
      });
    }
    // Mündungsfunke
    this.spawnParticles(mx, my, 2, '#bff0ff', 1.4);
  }

  updateBullets(f, dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      if (b.homing) {
        // sanftes Zielen auf nächsten Gegner
        let nearest = null, nd = 1e9;
        for (const e of this.enemies) {
          const d = Math.hypot(e.x - b.x, e.y - b.y);
          if (d < nd) { nd = d; nearest = e; }
        }
        if (nearest) {
          const desired = Math.atan2(nearest.y - b.y, nearest.x - b.x);
          const cur = Math.atan2(b.vy, b.vx);
          let diff = ((desired - cur + Math.PI * 3) % TAU) - Math.PI;
          const turn = clamp(diff, -0.08 * f, 0.08 * f);
          const na = cur + turn;
          b.vx = Math.cos(na) * b.speed; b.vy = Math.sin(na) * b.speed;
        }
      }
      b.x += b.vx * f; b.y += b.vy * f;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > this.W + 20 || b.y < -20 || b.y > this.H + 20) {
        this.bullets.splice(i, 1); continue;
      }
      // Treffer?
      for (const e of this.enemies) {
        if (Math.hypot(e.x - b.x, e.y - b.y) <= e.radius + b.r) {
          e.hp -= b.dmg; e.hitFlash = 90;
          this.spawnParticles(b.x, b.y, 3, '#ffd98a', 1.8);
          this.bullets.splice(i, 1);
          break;
        }
      }
    }
  }

  updateEnemies(f, dt) {
    const s = this.ship;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.hitFlash > 0) e.hitFlash -= dt;

      // Tot?
      if (e.hp <= 0) {
        this.killEnemy(e);
        this.enemies.splice(i, 1);
        continue;
      }

      // Bewegung Richtung Schiff (mit leichtem Wackeln)
      const dx = s.x - e.x, dy = s.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.angle = Math.atan2(dy, dx);
      e.wobble += 0.05 * f;

      // Kanonenboote/Zerstörer halten Abstand und feuern
      const standoff = e.fire ? (e.type === 'boss' ? 180 : 240) : 0;
      let mv = 1;
      if (e.fire && d < standoff) mv = -0.35; // zurückweichen
      const perpWob = Math.sin(e.wobble) * (e.fire ? 0.5 : 0.25);
      const ang = e.angle + perpWob;
      e.x += Math.cos(ang) * e.speed * mv * f;
      e.y += Math.sin(ang) * e.speed * mv * f;

      // Feuern
      if (e.fire) {
        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && d < 520) {
          e.fireTimer = e.fire;
          this.enemyShoot(e, s);
        }
      }

      // Kollision mit Schiff (Rammen)
      if (d <= e.radius + s.radius) {
        this.damageShip(e.touch);
        if (e.type === 'scout') { // Späher zersplittern beim Rammen
          this.killEnemy(e, true);
          this.enemies.splice(i, 1);
        } else {
          // abprallen
          e.x -= Math.cos(e.angle) * 12;
          e.y -= Math.sin(e.angle) * 12;
        }
      }
    }
  }

  enemyShoot(e, s) {
    const ang = Math.atan2(s.y - e.y, s.x - e.x);
    const shots = e.type === 'boss' ? 3 : 1;
    for (let k = 0; k < shots; k++) {
      const a = ang + (shots > 1 ? (k - (shots - 1) / 2) * 0.22 : 0);
      this.enemyBullets.push({
        x: e.x + Math.cos(ang) * e.radius,
        y: e.y + Math.sin(ang) * e.radius,
        vx: Math.cos(a) * e.bspeed, vy: Math.sin(a) * e.bspeed,
        dmg: e.bullet, r: 4, life: 4000,
      });
    }
  }

  updateEnemyBullets(f) {
    const s = this.ship;
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      b.x += b.vx * f; b.y += b.vy * f;
      b.life -= 16 * f;
      if (b.life <= 0 || b.x < -20 || b.x > this.W + 20 || b.y < -20 || b.y > this.H + 20) {
        this.enemyBullets.splice(i, 1); continue;
      }
      if (Math.hypot(s.x - b.x, s.y - b.y) <= s.radius + b.r) {
        this.damageShip(b.dmg);
        this.spawnParticles(b.x, b.y, 4, '#ff9aa8', 2);
        this.enemyBullets.splice(i, 1);
      }
    }
  }

  damageShip(amount) {
    const s = this.ship;
    s.hp -= amount;
    s.hitFlash = 120;
    this.shake = Math.min(10, (this.shake || 0) + amount * 0.18);
    if (s.hp <= 0) { s.hp = 0; this.explode(s.x, s.y, 40, '#ff8aa0'); this.gameOver(); }
  }

  killEnemy(e, ram) {
    if (!ram || e.type !== 'scout') {
      this.scrap += e.reward;
      this.scrapTotal += e.reward;
      this.addFloater(e.x, e.y, `+${e.reward}`, '#f0c000');
    } else {
      this.scrap += e.reward; this.scrapTotal += e.reward;
      this.addFloater(e.x, e.y, `+${e.reward}`, '#f0c000');
    }
    this.explode(e.x, e.y, e.radius, e.color);
  }

  // ── Partikel / Floater / Explosionen ──────────────────────────────────────────
  spawnParticles(x, y, n, color, spread) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), sp = rand(0.5, spread);
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(180, 420), max: 420, color, r: rand(1, 2.5) });
    }
  }
  explode(x, y, size, color) {
    const n = Math.round(size * 0.8);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), sp = rand(1, 4 + size * 0.08);
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(300, 700), max: 700, color: Math.random() < 0.5 ? color : '#ffd98a', r: rand(1.5, 4) });
    }
    this.shake = Math.min(14, (this.shake || 0) + size * 0.18);
  }
  updateParticles(f, dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * f; p.y += p.vy * f; p.vx *= 0.94; p.vy *= 0.94;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }
  addFloater(x, y, text, color) { this.floaters.push({ x, y, text, color, life: 900, max: 900 }); }
  updateFloaters(dt) {
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const fl = this.floaters[i];
      fl.y -= 0.4; fl.life -= dt;
      if (fl.life <= 0) this.floaters.splice(i, 1);
    }
  }

  // ── Wasser-Hintergrund ───────────────────────────────────────────────────────
  initWater() {
    this.waves = [];
    for (let i = 0; i < 26; i++) {
      this.waves.push({ x: rand(0, this.W), y: rand(0, this.H), len: rand(20, 60), ph: rand(0, TAU), sp: rand(0.2, 0.6) });
    }
    this.wake = [];
  }
  updateWater(f) {
    for (const w of this.waves) { w.ph += 0.02 * f; w.x -= w.sp * f; if (w.x < -70) { w.x = this.W + 40; w.y = rand(0, this.H); } }
    // Kielwasser hinter dem Schiff
    if (this.ship && (this.frame = (this.frame || 0) + 1) % 3 === 0) {
      const s = this.ship;
      this.wake.push({ x: s.x - Math.cos(s.angle) * s.radius, y: s.y - Math.sin(s.angle) * s.radius, life: 700, max: 700, r: s.radius * 0.5 });
    }
    for (let i = this.wake.length - 1; i >= 0; i--) { this.wake[i].life -= 16 * f; this.wake[i].r += 0.3 * f; if (this.wake[i].life <= 0) this.wake.splice(i, 1); }
  }

  // ── HUD ──────────────────────────────────────────────────────────────────────
  updateHUD() {
    const s = this.ship;
    if (!s) return;
    const pct = clamp(s.hp / s.maxHp * 100, 0, 100);
    document.getElementById('hp-fill').style.width = pct + '%';
    document.getElementById('hp-text').textContent = `${Math.ceil(s.hp)} / ${Math.round(s.maxHp)}`;
    document.getElementById('hud-wave').textContent = this.wave;
    document.getElementById('hud-scrap').textContent = this.scrap;
    document.getElementById('hud-enemies').textContent = (this.enemies ? this.enemies.length : 0) + (this.spawnQueue ? this.spawnQueue.length : 0);
  }

  toast(text, color) {
    this.toastEl.textContent = text;
    this.toastEl.style.color = color || '#fff';
    this.toastEl.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.toastEl.classList.remove('show'), 1400);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  render(dt) {
    const c = this.ctx;
    c.save();
    // Shake
    if (this.shake > 0.2) {
      c.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));
      this.shake *= 0.86;
    } else this.shake = 0;

    // Wasser
    const g = c.createLinearGradient(0, 0, 0, this.H);
    g.addColorStop(0, '#0a3553'); g.addColorStop(1, '#04253b');
    c.fillStyle = g; c.fillRect(-20, -20, this.W + 40, this.H + 40);

    // Wellenlinien
    c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 2;
    for (const w of this.waves) {
      c.beginPath();
      c.moveTo(w.x, w.y + Math.sin(w.ph) * 3);
      c.quadraticCurveTo(w.x + w.len / 2, w.y - 4 + Math.sin(w.ph) * 3, w.x + w.len, w.y + Math.sin(w.ph) * 3);
      c.stroke();
    }

    if (this.state === 'idle') { c.restore(); return; }

    // Kielwasser
    if (this.wake) for (const wk of this.wake) {
      c.globalAlpha = (wk.life / wk.max) * 0.25;
      c.fillStyle = '#bfe6ff';
      c.beginPath(); c.arc(wk.x, wk.y, wk.r, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;

    // Reichweiten-Ring (dezent)
    if (this.ship && this.state === 'playing') {
      c.strokeStyle = 'rgba(56,189,248,0.08)'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(this.ship.x, this.ship.y, this.range, 0, TAU); c.stroke();
    }

    // Gegner-Projektile
    if (this.enemyBullets) for (const b of this.enemyBullets) {
      c.fillStyle = '#ff7a8a';
      c.shadowColor = '#ff7a8a'; c.shadowBlur = 8;
      c.beginPath(); c.arc(b.x, b.y, b.r, 0, TAU); c.fill();
    }
    c.shadowBlur = 0;

    // Eigene Projektile
    if (this.bullets) for (const b of this.bullets) {
      c.fillStyle = '#cdebff';
      c.shadowColor = '#7dd3fc'; c.shadowBlur = 8;
      c.beginPath(); c.arc(b.x, b.y, b.r, 0, TAU); c.fill();
    }
    c.shadowBlur = 0;

    // Gegner
    if (this.enemies) for (const e of this.enemies) this.drawEnemy(c, e);

    // Schiff
    if (this.ship) this.drawShip(c);

    // Partikel
    if (this.particles) for (const p of this.particles) {
      c.globalAlpha = clamp(p.life / p.max, 0, 1);
      c.fillStyle = p.color;
      c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;

    // Floater (+Schrott)
    if (this.floaters) for (const fl of this.floaters) {
      c.globalAlpha = clamp(fl.life / fl.max, 0, 1);
      c.fillStyle = fl.color; c.font = '800 13px Inter, sans-serif'; c.textAlign = 'center';
      c.fillText(fl.text, fl.x, fl.y);
    }
    c.globalAlpha = 1; c.textAlign = 'left';

    // Pause-Schild
    if (this.state === 'paused') {
      c.fillStyle = 'rgba(2,16,28,0.6)'; c.fillRect(0, 0, this.W, this.H);
      c.fillStyle = '#fff'; c.font = '900 42px Inter, sans-serif'; c.textAlign = 'center';
      c.fillText('PAUSE', this.W / 2, this.H / 2);
      c.textAlign = 'left';
    }

    c.restore();
  }

  drawShip(c) {
    const s = this.ship;
    c.save();
    c.translate(s.x, s.y);
    c.rotate(s.angle + Math.PI / 2); // Modell zeigt nach oben
    const r = s.radius;

    // Rumpf
    c.beginPath();
    c.moveTo(0, -r * 1.5);
    c.quadraticCurveTo(r * 0.85, -r * 0.4, r * 0.7, r);
    c.quadraticCurveTo(0, r * 1.25, -r * 0.7, r);
    c.quadraticCurveTo(-r * 0.85, -r * 0.4, 0, -r * 1.5);
    c.closePath();
    c.fillStyle = s.hitFlash > 0 ? '#ffd0d8' : '#d7e3ee';
    c.fill();
    c.lineWidth = 2; c.strokeStyle = '#7d92a6'; c.stroke();

    // Deckaufbau
    c.fillStyle = '#8fa6ba';
    c.fillRect(-r * 0.4, -r * 0.5, r * 0.8, r * 0.9);

    // Brücke
    c.fillStyle = '#5d748a';
    c.fillRect(-r * 0.25, -r * 0.3, r * 0.5, r * 0.5);

    // Geschütztürme entsprechend Tier
    c.fillStyle = '#3f5266';
    const n = s.turrets;
    for (let i = 0; i < n; i++) {
      const yy = n === 1 ? -r * 0.2 : (-r * 0.8 + i * (r * 1.5 / Math.max(1, n - 1)));
      c.beginPath(); c.arc(0, yy, r * 0.22, 0, TAU); c.fill();
      c.fillRect(-r * 0.06, yy - r * 0.55, r * 0.12, r * 0.55);
      c.fillStyle = '#3f5266';
    }

    c.restore();

    // Schaden-Rauch wenn HP niedrig
    if (s.hp / s.maxHp < 0.35 && Math.random() < 0.3) {
      this.particles.push({ x: s.x + rand(-r * 0.5, r * 0.5), y: s.y, vx: rand(-0.4, 0.4), vy: -rand(0.4, 1), life: 600, max: 600, color: 'rgba(60,60,70,0.8)', r: rand(2, 4) });
    }
  }

  drawEnemy(c, e) {
    c.save();
    c.translate(e.x, e.y);
    c.rotate(e.angle + Math.PI / 2);
    const r = e.radius;

    c.beginPath();
    c.moveTo(0, -r * 1.4);
    c.quadraticCurveTo(r * 0.8, -r * 0.3, r * 0.65, r);
    c.quadraticCurveTo(0, r * 1.2, -r * 0.65, r);
    c.quadraticCurveTo(-r * 0.8, -r * 0.3, 0, -r * 1.4);
    c.closePath();
    c.fillStyle = e.hitFlash > 0 ? '#ffffff' : e.color;
    c.fill();
    c.lineWidth = 2; c.strokeStyle = 'rgba(0,0,0,0.35)'; c.stroke();

    // Aufbau
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.fillRect(-r * 0.3, -r * 0.3, r * 0.6, r * 0.7);

    c.restore();

    // HP-Balken über größeren Gegnern
    if (e.maxHp > 40 && e.hp < e.maxHp) {
      const w = r * 2, h = 4;
      const x = e.x - w / 2, y = e.y - r - 10;
      c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(x, y, w, h);
      c.fillStyle = e.type === 'boss' ? '#c026d3' : '#ff6b81';
      c.fillRect(x, y, w * clamp(e.hp / e.maxHp, 0, 1), h);
    }
  }
}

window._game = new WarShips();
