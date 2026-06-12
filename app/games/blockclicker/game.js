// Block Clicker — Cookie Clicker mit Blöcken.
// Lesbare Quelle; wird vor Deploy via tools/_obfuscate.js verschleiert.
(() => {
  'use strict';

  // ── Definitionen ───────────────────────────────────────────────────────────

  const BUILDINGS = [
    { id: 'klicker', name: 'Auto-Klicker',    ico: '👆', desc: 'Ein müder Finger, der den Block für dich anstupst.',        cost: 15,     bps: 0.1 },
    { id: 'presse',  name: 'Block-Presse',    ico: '🔨', desc: 'Presst stetig frische Blöcke aus Rohmasse.',                cost: 100,    bps: 1 },
    { id: 'fabrik',  name: 'Block-Fabrik',    ico: '🏭', desc: 'Massenproduktion am Fließband, drei Schichten.',            cost: 1100,   bps: 8 },
    { id: 'mine',    name: 'Block-Mine',      ico: '⛏️', desc: 'Gräbt naturbelassene Blöcke aus der Tiefe.',                cost: 12000,  bps: 47 },
    { id: 'labor',   name: 'Tetromino-Labor', ico: '🧪', desc: 'Forscht an verbotenen Block-Formen.',                       cost: 130000, bps: 260 },
    { id: 'portal',  name: 'Block-Portal',    ico: '🌀', desc: 'Importiert Blöcke aus der Block-Dimension.',                cost: 1.4e6,  bps: 1400 },
    { id: 'zeit',    name: 'Zeitmaschine',    ico: '⏰', desc: 'Holt Blöcke aus Runden, die du noch gar nicht gespielt hast.', cost: 20e6,  bps: 7800 },
    { id: 'quanten', name: 'Quanten-Block',   ico: '⚛️', desc: 'Ist gleichzeitig geklickt und nicht geklickt.',             cost: 330e6,  bps: 44000 },
  ];

  // Gebäude-Upgrades: ab N Stück kaufbar, verdoppeln die Produktion des Gebäudes.
  const BLD_TIERS = [
    { need: 1,  costMult: 10,   adj: 'Verstärkte' },
    { need: 10, costMult: 60,   adj: 'Vergoldete' },
    { need: 25, costMult: 600,  adj: 'Verzauberte' },
    { need: 50, costMult: 6000, adj: 'Singuläre' },
  ];

  // Klick-Upgrades: verdoppeln die Blöcke pro Klick.
  const CLICK_UPGRADES = [
    { cost: 100,   name: 'Fester Finger' },
    { cost: 1500,  name: 'Stahl-Handschuh' },
    { cost: 25000, name: 'Presslufthammer' },
    { cost: 4e5,   name: 'Hydraulik-Faust' },
    { cost: 8e6,   name: 'Meteoriten-Schlag' },
    { cost: 2e8,   name: 'Urknall im Kleinformat' },
  ];

  // Alle Upgrades in eine flache Liste mit stabiler ID.
  const UPGRADES = [];
  for (const b of BUILDINGS) {
    BLD_TIERS.forEach((t, i) => {
      UPGRADES.push({
        id: `${b.id}-${i}`, ico: b.ico, cost: b.cost * t.costMult,
        name: `${t.adj} ${b.name}`, desc: `${b.name} produzieren doppelt so viel.`,
        isUnlocked: s => (s.owned[b.id] || 0) >= t.need,
        apply: () => {},                       // wirkt über buildingMult()
        bId: b.id,
      });
    });
  }
  CLICK_UPGRADES.forEach((u, i) => {
    UPGRADES.push({
      id: `click-${i}`, ico: '✊', cost: u.cost,
      name: u.name, desc: 'Doppelt so viele Blöcke pro Klick.',
      isUnlocked: s => s.totalBlocks >= u.cost / 4,
      clickUp: true,
    });
  });
  UPGRADES.sort((a, b) => a.cost - b.cost);

  const SAVE_KEY = 'blockclicker-save';
  const GOLD_BONUS_SECONDS = 900;   // Sofort-Bonus: bis zu 15 min Produktion
  const FRENZY_SECONDS = 30;        // Klick-Rausch-Dauer
  const FRENZY_MULT = 7;

  // ── Zustand ────────────────────────────────────────────────────────────────

  let state = {
    blocks: 0,            // aktueller Kontostand
    totalBlocks: 0,       // jemals produziert
    clicks: 0,
    goldClicks: 0,
    owned: {},            // buildingId -> Anzahl
    upgrades: {},         // upgradeId -> true
    playSeconds: 0,
    lastSeen: Date.now(),
  };
  let frenzyUntil = 0;    // Timestamp, bis wann der Klick-Rausch läuft

  // ── Berechnungen ───────────────────────────────────────────────────────────

  function buildingMult(bId) {
    let m = 1;
    for (const u of UPGRADES) if (u.bId === bId && state.upgrades[u.id]) m *= 2;
    return m;
  }

  function totalBps() {
    let sum = 0;
    for (const b of BUILDINGS) sum += (state.owned[b.id] || 0) * b.bps * buildingMult(b.id);
    return sum;
  }

  function clickPower() {
    let p = 1;
    for (const u of UPGRADES) if (u.clickUp && state.upgrades[u.id]) p *= 2;
    if (Date.now() < frenzyUntil) p *= FRENZY_MULT;
    return p;
  }

  function buildingCost(b) {
    return Math.ceil(b.cost * Math.pow(1.15, state.owned[b.id] || 0));
  }

  // ── Zahlenformat (deutsch) ─────────────────────────────────────────────────

  const SCALES = [
    [1e15, 'Brd.'], [1e12, 'Bio.'], [1e9, 'Mrd.'], [1e6, 'Mio.'],
  ];
  function fmt(n) {
    n = Math.floor(n);
    for (const [v, suffix] of SCALES) {
      if (n >= v) {
        const x = n / v;
        return (x >= 100 ? Math.floor(x).toLocaleString('de-DE')
                         : x.toLocaleString('de-DE', { maximumFractionDigits: x >= 10 ? 1 : 2 })) + ' ' + suffix;
      }
    }
    return n.toLocaleString('de-DE');
  }
  function fmtBps(n) {
    if (n >= 1e6) return fmt(n);
    return n.toLocaleString('de-DE', { maximumFractionDigits: 1 });
  }

  // ── DOM ────────────────────────────────────────────────────────────────────

  const $ = id => document.getElementById(id);
  const elCounter = $('counter-num'), elBps = $('bps-num'), elFrenzy = $('frenzy-line');
  const elBlock = $('big-block'), elStage = $('block-stage');
  const elUpgRow = $('upgrade-row'), elBldList = $('building-list');
  const elTooltip = $('tooltip'), elToast = $('toast'), elGold = $('gold-block');

  // Gebäudezeilen einmalig bauen, danach nur Werte aktualisieren.
  const bldEls = {};
  for (const b of BUILDINGS) {
    const btn = document.createElement('button');
    btn.className = 'bld hidden-bld';
    btn.innerHTML = `
      <div class="bld-ico">${b.ico}</div>
      <div class="bld-info">
        <div class="bld-name">${b.name}</div>
        <div class="bld-cost"></div>
      </div>
      <div class="bld-meta">
        <div class="bld-count">0</div>
        <div class="bld-bps"></div>
      </div>`;
    btn.addEventListener('click', () => buyBuilding(b));
    attachTooltip(btn, () => ({
      name: b.name, desc: b.desc,
      cost: buildingCost(b),
      extra: `+${fmtBps(b.bps * buildingMult(b.id))} Blöcke/s pro Stück`,
    }));
    elBldList.appendChild(btn);
    bldEls[b.id] = btn;
  }

  // ── Tooltip ────────────────────────────────────────────────────────────────

  function attachTooltip(el, getInfo) {
    el.addEventListener('mouseenter', () => {
      const info = getInfo();
      elTooltip.innerHTML = `
        <div class="tt-name">${info.name}</div>
        <div class="tt-desc">${info.desc}</div>
        ${info.extra ? `<div class="tt-desc">${info.extra}</div>` : ''}
        ${info.cost != null ? `<div class="tt-cost ${state.blocks < info.cost ? 'too-expensive' : ''}">${fmt(info.cost)} Blöcke</div>` : ''}`;
      elTooltip.classList.add('show');
    });
    el.addEventListener('mousemove', e => {
      const w = elTooltip.offsetWidth, h = elTooltip.offsetHeight;
      let x = e.clientX - w - 14, y = e.clientY + 10;
      if (x < 8) x = e.clientX + 14;
      if (y + h > innerHeight - 8) y = innerHeight - h - 8;
      elTooltip.style.left = x + 'px';
      elTooltip.style.top = y + 'px';
    });
    el.addEventListener('mouseleave', () => elTooltip.classList.remove('show'));
  }

  // ── Kaufen ─────────────────────────────────────────────────────────────────

  function buyBuilding(b) {
    const cost = buildingCost(b);
    if (state.blocks < cost) return;
    state.blocks -= cost;
    state.owned[b.id] = (state.owned[b.id] || 0) + 1;
    renderShop();
    renderAll();
  }

  function buyUpgrade(u) {
    if (state.upgrades[u.id] || state.blocks < u.cost) return;
    state.blocks -= u.cost;
    state.upgrades[u.id] = true;
    toast(`${u.ico} ${u.name} gekauft!`);
    renderShop();
    renderAll();
  }

  // ── Klicken ────────────────────────────────────────────────────────────────

  elBlock.addEventListener('pointerdown', e => {
    const gain = clickPower();
    state.blocks += gain;
    state.totalBlocks += gain;
    state.clicks++;

    elBlock.classList.add('squish');
    setTimeout(() => elBlock.classList.remove('squish'), 80);

    // +N-Partikel an der Klickposition
    const rect = elStage.getBoundingClientRect();
    const ft = document.createElement('div');
    ft.className = 'float-txt';
    ft.textContent = '+' + fmt(gain);
    ft.style.left = (e.clientX - rect.left - 14 + (Math.random() * 24 - 12)) + 'px';
    ft.style.top = (e.clientY - rect.top - 22) + 'px';
    elStage.appendChild(ft);
    setTimeout(() => ft.remove(), 1100);

    renderAll();
  });

  // ── Goldener Block ─────────────────────────────────────────────────────────

  let goldTimer = null;
  function scheduleGold() {
    clearTimeout(goldTimer);
    goldTimer = setTimeout(showGold, (60 + Math.random() * 120) * 1000);
  }
  function showGold() {
    elGold.style.left = (10 + Math.random() * 75) + 'vw';
    elGold.style.top = (18 + Math.random() * 60) + 'vh';
    elGold.classList.add('show');
    // verschwindet nach 13 s wieder
    goldTimer = setTimeout(() => { elGold.classList.remove('show'); scheduleGold(); }, 13000);
  }
  elGold.addEventListener('pointerdown', () => {
    elGold.classList.remove('show');
    state.goldClicks++;
    if (Math.random() < 0.5 || totalBps() === 0) {
      // Klick-Rausch
      frenzyUntil = Date.now() + FRENZY_SECONDS * 1000;
      toast(`⚡ Klick-Rausch! ${FRENZY_MULT}× Klick-Power für ${FRENZY_SECONDS} Sekunden!`);
    } else {
      // Sofort-Blöcke: Produktion von bis zu 15 min, mind. 13 + 10 % vom Konto
      const gain = Math.max(totalBps() * GOLD_BONUS_SECONDS, 13 + state.blocks * 0.1);
      state.blocks += gain;
      state.totalBlocks += gain;
      toast(`✨ Goldener Block! +${fmt(gain)} Blöcke!`);
    }
    scheduleGold();
    renderAll();
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  function renderAll() {
    elCounter.textContent = fmt(state.blocks);
    elBps.textContent = fmtBps(totalBps());
    document.title = `${fmt(state.blocks)} Blöcke — Block Clicker`;

    $('st-total').textContent = fmt(state.totalBlocks);
    $('st-clicks').textContent = fmt(state.clicks);
    $('st-click-power').textContent = fmt(clickPower());
    $('st-gold').textContent = state.goldClicks;
    const min = Math.floor(state.playSeconds / 60);
    $('st-time').textContent = min >= 90 ? `${(min / 60).toFixed(1)} h` : `${min} min`;

    // Kauf-Zustände
    for (const b of BUILDINGS) {
      const el = bldEls[b.id], cost = buildingCost(b), n = state.owned[b.id] || 0;
      // Sichtbar, sobald man es sich mal halb leisten konnte oder eins besitzt
      if (n > 0 || state.totalBlocks >= b.cost * 0.4) el.classList.remove('hidden-bld');
      el.classList.toggle('cant', state.blocks < cost);
      el.querySelector('.bld-cost').textContent = fmt(cost) + ' Blöcke';
      el.querySelector('.bld-count').textContent = n;
      el.querySelector('.bld-bps').textContent = n > 0 ? `${fmtBps(n * b.bps * buildingMult(b.id))}/s` : '';
    }
  }

  // Upgrade-Leiste neu aufbauen (nur wenn sich Sichtbarkeit/Kaufbarkeit ändert,
  // sonst reißt das Rebuild offene Tooltips und Hover-Zustände ab)
  let shopSig = '';
  function renderShop() {
    const visible = UPGRADES.filter(u => !state.upgrades[u.id] && u.isUnlocked(state)).slice(0, 8);
    const sig = visible.map(u => u.id + (state.blocks < u.cost ? '!' : '')).join(',');
    if (sig === shopSig) return;
    shopSig = sig;
    elTooltip.classList.remove('show');
    elUpgRow.innerHTML = '';
    if (!visible.length) {
      elUpgRow.innerHTML = '<div class="upg-empty">Bald gibt es hier neue Upgrades …</div>';
      return;
    }
    for (const u of visible) {
      const d = document.createElement('div');
      d.className = 'upg' + (state.blocks < u.cost ? ' locked' : '');
      d.textContent = u.ico;
      d.addEventListener('click', () => buyUpgrade(u));
      attachTooltip(d, () => ({ name: u.name, desc: u.desc, cost: u.cost }));
      elUpgRow.appendChild(d);
    }
  }

  // ── Toast ──────────────────────────────────────────────────────────────────

  let toastTimer = null;
  function toast(msg) {
    elToast.textContent = msg;
    elToast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => elToast.classList.remove('show'), 3200);
  }

  // ── Speichern / Laden ──────────────────────────────────────────────────────

  function save(silent) {
    state.lastSeen = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* Speicher voll/blockiert */ }
    if (!silent) toast('💾 Gespeichert!');
  }

  function load() {
    let raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) {}
    if (!raw) return;
    try {
      const s = JSON.parse(raw);
      state = Object.assign(state, s);
      state.owned = s.owned || {};
      state.upgrades = s.upgrades || {};
      // Offline-Produktion: 25 % der BPS, höchstens 4 Stunden
      const away = Math.min((Date.now() - (s.lastSeen || Date.now())) / 1000, 4 * 3600);
      const gain = Math.floor(totalBps() * away * 0.25);
      if (gain > 0) {
        state.blocks += gain;
        state.totalBlocks += gain;
        setTimeout(() => toast(`🌙 Willkommen zurück! Deine Gebäude haben ${fmt(gain)} Blöcke produziert.`), 600);
      }
    } catch (e) { /* kaputter Save — frisch starten */ }
  }

  $('save-btn').addEventListener('click', () => save(false));
  $('reset-btn').addEventListener('click', () => {
    if (!confirm('Wirklich ALLES zurücksetzen? Alle Blöcke, Gebäude und Upgrades gehen verloren.')) return;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    location.reload();
  });
  addEventListener('beforeunload', () => save(true));
  setInterval(() => save(true), 15000);

  // ── Game-Loop ──────────────────────────────────────────────────────────────

  let lastTick = performance.now();
  function tick(now) {
    const dt = Math.min((now - lastTick) / 1000, 1);   // Tab-Wechsel nicht doppelt zählen
    lastTick = now;
    const gain = totalBps() * dt;
    state.blocks += gain;
    state.totalBlocks += gain;
    state.playSeconds += dt;

    if (frenzyUntil) {
      const left = (frenzyUntil - Date.now()) / 1000;
      elFrenzy.textContent = left > 0 ? `⚡ Klick-Rausch: ${FRENZY_MULT}× für ${Math.ceil(left)} s` : '';
      if (left <= 0) frenzyUntil = 0;
    }

    renderAll();
    requestAnimationFrame(tick);
  }

  // Upgrade-Leiste regelmäßig auffrischen (Unlocks & Kaufbarkeit)
  setInterval(renderShop, 1500);

  // Deko: fallende Blöcke im Hintergrund
  for (let i = 0; i < 10; i++) {
    const d = document.createElement('div');
    d.className = 'fall-block';
    d.style.left = Math.random() * 100 + 'vw';
    d.style.animationDuration = (9 + Math.random() * 14) + 's';
    d.style.animationDelay = (-Math.random() * 20) + 's';
    d.style.transform = `scale(${0.6 + Math.random()})`;
    document.body.appendChild(d);
  }

  // ── Start ──────────────────────────────────────────────────────────────────

  load();
  renderShop();
  renderAll();
  scheduleGold();
  requestAnimationFrame(tick);
})();
