/* ===================================================================
 *  Jedno — ein UNO-Klon fürs Arcade
 *  Du gegen 3 Bots. Sichtbar für alle, spielbar nur für Angemeldete.
 * =================================================================== */

const COLORS = ['red', 'yellow', 'green', 'blue'];
const COLOR_HEX = { red: '#ef4444', yellow: '#f5b50a', green: '#22c55e', blue: '#3b82f6' };
const COLOR_NAME = { red: 'Rot', yellow: 'Gelb', green: 'Grün', blue: 'Blau' };

const BOTS = [
  { name: 'Mila',  ava: '🦊', avaBg: '#3b82f6' },
  { name: 'Tobi',  ava: '🐼', avaBg: '#22c55e' },
  { name: 'Yuki',  ava: '🐱', avaBg: '#f5b50a' },
];

// ── DOM ────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const oppRow      = $('opponents');
const handEl      = $('hand');
const discardEl   = $('discard-card');
const drawPileEl  = $('draw-pile-card');
const statusEl    = $('status-text');
const unoBtn      = $('uno-btn');
const colorDot    = $('color-dot');
const colorSwatch = colorDot.querySelector('.swatch');
const colorLabel  = $('color-dot-label');
const newGameBtn  = $('new-game-btn');

// ── Spielzustand ───────────────────────────────────────────────────
let state = null;
let loggedIn = false;
let busy = false;        // blockt Eingaben während Bot-Zügen/Animationen
let pendingWildIdx = null;

/* ─── Deck-Aufbau (108 Karten, Standard-UNO) ────────────────────── */
function buildDeck() {
  const deck = [];
  for (const c of COLORS) {
    deck.push({ color: c, value: '0' });
    for (let n = 1; n <= 9; n++) { deck.push({ color: c, value: String(n) }); deck.push({ color: c, value: String(n) }); }
    for (const a of ['skip', 'reverse', 'draw2']) { deck.push({ color: c, value: a }); deck.push({ color: c, value: a }); }
  }
  for (let i = 0; i < 4; i++) { deck.push({ color: 'wild', value: 'wild' }); deck.push({ color: 'wild', value: 'wild4' }); }
  return deck;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ─── Neues Spiel ──────────────────────────────────────────────── */
function newGame() {
  if (!loggedIn) { $('login-banner').classList.add('show'); return; }
  closeAllOverlays();

  const deck = shuffle(buildDeck());
  // 4 Spieler: 0 = Du, 1..3 = Bots. Jeder 7 Karten.
  const hands = [[], [], [], []];
  for (let i = 0; i < 7; i++) for (let p = 0; p < 4; p++) hands[p].push(deck.pop());

  // Startkarte: erste Nicht-Wild-Karte auf die Ablage
  let start;
  do { start = deck.pop(); if (start.value === 'wild' || start.value === 'wild4') deck.unshift(start); }
  while (start.value === 'wild' || start.value === 'wild4');

  state = {
    deck,
    discard: [start],
    hands,
    current: start.color,         // aktive Farbe (relevant nach Wild)
    turn: 0,                       // wessen Zug
    dir: 1,                        // 1 = im Uhrzeigersinn
    saidUno: [false, false, false, false],
    over: false,
  };

  busy = false;
  document.body.classList.remove('locked');
  render();
  setStatus('Du bist dran — leg eine passende Karte ab.');
}

/* ─── Hilfsfunktionen Regeln ───────────────────────────────────── */
function topCard() { return state.discard[state.discard.length - 1]; }

function canPlay(card) {
  if (card.color === 'wild') return true;
  const top = topCard();
  return card.color === state.current || card.value === top.value;
}

function drawFromDeck() {
  if (state.deck.length === 0) {
    // Ablage (außer oberster Karte) zurück in den Stapel mischen
    const top = state.discard.pop();
    state.deck = shuffle(state.discard);
    state.discard = [top];
    if (state.deck.length === 0) return null; // praktisch unmöglich
  }
  return state.deck.pop();
}

function nextTurn(step = 1) {
  state.turn = (state.turn + state.dir * step + 4) % 4;
}

/* ─── Rendering ────────────────────────────────────────────────── */
function cardHTML(card, opts = {}) {
  const cls = card.color === 'wild' ? 'wild' : card.color;
  const label = labelFor(card);
  const isAction = ['skip', 'reverse', 'draw2', 'wild', 'wild4'].includes(card.value);
  const inner = isAction
    ? `<div class="oval"></div><span class="pip">${label}</span>`
    : `<div class="oval"></div><span class="oval-text">${label}</span>`;
  return `<div class="card ${cls} ${opts.extra || ''}" ${opts.attrs || ''}>
            <span class="corner tl">${label}</span>
            ${inner}
            <span class="corner br">${label}</span>
          </div>`;
}

function labelFor(card) {
  if (card.value === 'wild')  return '★';
  if (card.value === 'wild4') return '+4';
  if (card.value === 'skip')  return '⊘';
  if (card.value === 'reverse') return '⇄';
  if (card.value === 'draw2') return '+2';
  return card.value;
}

function render() {
  renderOpponents();
  renderDiscard();
  renderHand();
  renderColorDot();
}

function renderOpponents() {
  oppRow.innerHTML = BOTS.map((b, i) => {
    const p = i + 1;
    const n = state ? state.hands[p].length : 7;
    const minis = Array.from({ length: Math.min(n, 7) }, () => '<div class="mini"></div>').join('');
    const uno = n === 1 ? '<span class="opp-uno">JEDNO!</span>' : `${n} Karten`;
    const active = state && state.turn === p ? 'active' : '';
    return `<div class="opp ${active}" data-opp="${p}">
              <div class="opp-name"><span class="opp-ava" style="background:${b.avaBg}33">${b.ava}</span>${b.name}</div>
              <div class="opp-cards">${minis}</div>
              <div class="opp-count">${uno}</div>
            </div>`;
  }).join('');
}

function renderDiscard() {
  if (!state) { discardEl.innerHTML = ''; return; }
  discardEl.innerHTML = cardHTML(topCard());
}

function renderColorDot() {
  if (!state) { colorDot.style.opacity = '0'; return; }
  colorDot.style.opacity = '1';
  colorSwatch.style.background = COLOR_HEX[state.current];
  colorSwatch.style.color = COLOR_HEX[state.current];
  colorLabel.textContent = COLOR_NAME[state.current];
}

function renderHand() {
  if (!state) { handEl.innerHTML = ''; return; }
  const myTurn = state.turn === 0 && !state.over && !busy;
  handEl.innerHTML = state.hands[0].map((card, idx) => {
    const playable = myTurn && canPlay(card);
    const extra = myTurn ? (playable ? 'playable' : 'disabled') : '';
    return cardHTML(card, { extra, attrs: `data-idx="${idx}"` });
  }).join('');
  // Jedno-Button: sichtbar, wenn ich genau 2 Karten habe und noch nicht gerufen habe
  unoBtn.style.display = (state.hands[0].length === 2 && !state.saidUno[0] && myTurn) ? 'inline-block' : 'none';
}

function setStatus(html) { statusEl.innerHTML = html; }

/* ─── Spieler-Aktionen ─────────────────────────────────────────── */
handEl.addEventListener('click', e => {
  const cardEl = e.target.closest('.card');
  if (!cardEl || busy || !state || state.over || state.turn !== 0) return;
  const idx = Number(cardEl.dataset.idx);
  const card = state.hands[0][idx];
  if (!canPlay(card)) { toast('Diese Karte passt nicht.', 'bad'); return; }

  if (card.color === 'wild') {
    pendingWildIdx = idx;
    openOnly('color-overlay');
    return;
  }
  playCard(0, idx, card.color);
});

drawPileEl.addEventListener('click', () => {
  if (busy || !state || state.over || state.turn !== 0) return;
  if (state.mustDecideDrawn) { state.mustDecideDrawn = false; passTurn(); return; }
  playerDraw();
});

unoBtn.addEventListener('click', () => {
  if (!state || state.turn !== 0) return;
  state.saidUno[0] = true;
  unoBtn.style.display = 'none';
  toast('Du hast „Jedno!“ gerufen 🎉');
});

// Farbwahl-Buttons
document.querySelectorAll('.color-pick').forEach(btn => {
  btn.addEventListener('click', () => {
    const color = btn.dataset.color;
    closeAllOverlays();
    if (pendingWildIdx !== null) {
      const idx = pendingWildIdx; pendingWildIdx = null;
      playCard(0, idx, color);
    }
  });
});

function playerDraw() {
  const card = drawFromDeck();
  if (!card) { passTurn(); return; }
  state.hands[0].push(card);
  if (canPlay(card)) {
    state.mustDecideDrawn = true;
    render();
    setStatus(`Du hast <b>${labelText(card)}</b> gezogen — leg sie ab oder klick erneut auf den Stapel zum Passen.`);
    return;
  }
  toast('Nichts Passendes gezogen — weiter geht\'s.');
  render();
  passTurn();
}

/* ─── Karte legen (für Spieler & Bots) ─────────────────────────── */
function playCard(player, idx, chosenColor) {
  const hand = state.hands[player];
  const card = hand.splice(idx, 1)[0];
  state.discard.push(card);
  state.mustDecideDrawn = false;

  // Farbe aktualisieren
  state.current = (card.color === 'wild') ? chosenColor : card.color;

  // „Jedno!“-Strafe-Check für Spieler: hatte 2, jetzt 1, nicht gerufen
  if (player === 0 && hand.length === 1 && !state.saidUno[0]) {
    // kleine Gnade: automatisch +2 als Strafe fürs Vergessen
    const p1 = drawFromDeck(); const p2 = drawFromDeck();
    if (p1) hand.push(p1); if (p2) hand.push(p2);
    toast('„Jedno!“ vergessen — 2 Strafkarten!', 'warn');
  }
  if (player !== 0 && hand.length === 1) state.saidUno[player] = true;
  if (hand.length !== 1) state.saidUno[player] = false;

  render();

  // Gewonnen?
  if (hand.length === 0) { endGame(player); return; }

  applyEffectAndAdvance(card, player);
}

function applyEffectAndAdvance(card, player) {
  const announce = m => setStatus(m);

  switch (card.value) {
    case 'skip': {
      nextTurn();
      announce(`${who(player)} legt <b>Aussetzen</b> — ${who(state.turn)} muss pausieren.`);
      break;
    }
    case 'reverse': {
      state.dir *= -1;
      // bei 2 Spielern wäre es wie Skip; bei 4 nur Richtungswechsel
      announce(`${who(player)} dreht die Richtung um ↺`);
      break;
    }
    case 'draw2': {
      nextTurn();
      forceDraw(state.turn, 2);
      announce(`${who(player)} verpasst ${who(state.turn)} <b>+2</b>!`);
      break;
    }
    case 'wild': {
      announce(`${who(player)} wählt <b>${COLOR_NAME[state.current]}</b>.`);
      break;
    }
    case 'wild4': {
      nextTurn();
      forceDraw(state.turn, 4);
      announce(`${who(player)} knallt <b>+4</b> auf ${who(state.turn)} — Farbe ${COLOR_NAME[state.current]}!`);
      break;
    }
    default:
      announce(`${who(player)} legt <b>${labelText(card)}</b>.`);
  }

  nextTurn();
  render();
  advance();
}

function forceDraw(player, count) {
  for (let i = 0; i < count; i++) {
    const c = drawFromDeck();
    if (c) state.hands[player].push(c);
  }
  if (state.hands[player].length !== 1) state.saidUno[player] = false;
}

function passTurn() {
  nextTurn();
  render();
  advance();
}

/* ─── Ablauf-Steuerung ─────────────────────────────────────────── */
function advance() {
  if (state.over) return;
  if (state.turn === 0) {
    busy = false;
    render();
    setStatus('Du bist dran — leg eine passende Karte ab oder zieh.');
    if (!state.hands[0].some(canPlay)) {
      setStatus('Keine passende Karte — <b>zieh</b> vom Stapel.');
    }
    return;
  }
  // Bot ist dran
  busy = true;
  document.body.classList.add('locked');
  render();
  setTimeout(botTurn, 850);
}

/* ─── Bot-KI ───────────────────────────────────────────────────── */
function botTurn() {
  if (!state || state.over) return;
  const p = state.turn;
  const hand = state.hands[p];
  const playableIdx = hand.map((c, i) => canPlay(c) ? i : -1).filter(i => i >= 0);

  if (playableIdx.length === 0) {
    // Bot muss ziehen
    const c = drawFromDeck();
    if (c) hand.push(c);
    render();
    if (c && canPlay(c)) {
      setStatus(`${who(p)} zieht und legt direkt.`);
      setTimeout(() => botPlay(p, hand.length - 1), 650);
    } else {
      setStatus(`${who(p)} zieht eine Karte.`);
      setTimeout(() => { nextTurn(); render(); advance(); }, 650);
    }
    return;
  }

  // Heuristik: bevorzugt Aktionskarten, sonst höchste Zahl der passenden Farbe
  const pick = chooseBotCard(hand, playableIdx);
  botPlay(p, pick);
}

function chooseBotCard(hand, idxs) {
  // Punktbewertung: Aktionskarten höher, Wild4 nur wenn nötig
  let best = idxs[0], bestScore = -1;
  for (const i of idxs) {
    const c = hand[i];
    let s = 0;
    if (c.value === 'draw2') s = 7;
    else if (c.value === 'skip') s = 6;
    else if (c.value === 'reverse') s = 5;
    else if (c.value === 'wild4') s = 2;   // teuer, spar es auf
    else if (c.value === 'wild') s = 3;
    else s = 4 + Number(c.value) / 100;     // Zahlkarten: höhere zuerst weg
    if (s > bestScore) { bestScore = s; best = i; }
  }
  return best;
}

function botPlay(p, idx) {
  if (!state || state.over) return;
  const card = state.hands[p][idx];
  let color = card.color;
  if (card.color === 'wild') color = botPickColor(p);
  playCard(p, idx, color);
}

function botPickColor(p) {
  const counts = { red: 0, yellow: 0, green: 0, blue: 0 };
  for (const c of state.hands[p]) if (c.color !== 'wild') counts[c.color]++;
  return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
}

/* ─── Spielende ────────────────────────────────────────────────── */
function endGame(winner) {
  state.over = true;
  busy = true;
  document.body.classList.add('locked');
  render();

  const youWon = winner === 0;
  // Punkte: Summe der Restkarten-Werte aller anderen (UNO-typisch)
  const points = scoreRemaining();

  $('over-icon').textContent = youWon ? '🏆' : '😵';
  $('over-title').textContent = youWon ? 'Gewonnen!' : `${who(winner)} gewinnt`;
  $('over-text').innerHTML = youWon
    ? `Du hast alle Karten abgeworfen! <strong>+${points} Punkte</strong> kassiert.`
    : `${who(winner)} war zuerst leer. Du hattest noch <strong>${state.hands[0].length}</strong> Karten. Nochmal?`;
  openOnly('over-overlay');

  // Score speichern (nur bei Sieg, fire-and-forget)
  if (youWon && window.Auth && window.Auth.user) {
    window.Auth.saveScore({ game: 'jedno', mode: 'classic', score: points }).catch(() => {});
    unlockAch('jedno_first_win');
  }
}

function scoreRemaining() {
  let pts = 0;
  for (let p = 1; p < 4; p++) {
    for (const c of state.hands[p]) {
      if (c.value === 'wild' || c.value === 'wild4') pts += 50;
      else if (['skip', 'reverse', 'draw2'].includes(c.value)) pts += 20;
      else pts += Number(c.value);
    }
  }
  return pts;
}

/* ─── Achievements (localStorage + Cloud-Sync wie im Rest der App) ─ */
const ACH_DEFS = {
  jedno_first_win: { name: 'Jedno, zwei, weg', desc: 'Gewinne deine erste Runde Jedno', icon: '🃏' },
};
function unlockAch(id) {
  const def = ACH_DEFS[id];
  if (!def) return;
  let list;
  try { list = JSON.parse(localStorage.getItem('arcade_achievements')) || []; } catch (e) { list = []; }
  if (list.some(a => a.id === id)) return;
  list.push({ id, unlockedAt: new Date().toISOString() });
  localStorage.setItem('arcade_achievements', JSON.stringify(list));
  if (window.showAchToast) window.showAchToast(def);
  if (window.Auth && window.Auth.user) window.Auth.saveAchievements(list).catch(() => {});
}

/* ─── kleine Helfer ────────────────────────────────────────────── */
function who(p) { return p === 0 ? 'Du' : BOTS[p - 1].name; }
function labelText(card) {
  const v = card.value;
  if (v === 'wild')  return 'Farbwahl';
  if (v === 'wild4') return '+4 Farbwahl';
  if (v === 'skip')  return 'Aussetzen';
  if (v === 'reverse') return 'Richtungswechsel';
  if (v === 'draw2') return '+2';
  return `${COLOR_NAME[card.color]} ${v}`;
}

function toast(msg, kind = '') {
  const c = $('toast-container');
  const t = document.createElement('div');
  t.className = `game-toast ${kind}`;
  t.textContent = msg;
  c.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600);
}

/* ─── Overlays ─────────────────────────────────────────────────── */
function openOnly(id) {
  document.querySelectorAll('.overlay').forEach(o => o.classList.toggle('open', o.id === id));
}
function closeAllOverlays() {
  document.querySelectorAll('.overlay').forEach(o => o.classList.remove('open'));
}

/* ─── Login-Gate / Init ────────────────────────────────────────── */
$('login-gate-btn').addEventListener('click', () => window.Auth?.openLogin());
$('start-btn').addEventListener('click', newGame);
$('over-again').addEventListener('click', newGame);
newGameBtn.addEventListener('click', newGame);

function applyAuthState(user) {
  loggedIn = !!user;
  newGameBtn.disabled = !loggedIn;

  const banner = $('login-banner');

  if (!loggedIn) {
    // Vorschau zeigen, aber gesperrt + Login-Hinweis
    state = null;
    document.body.classList.add('locked');
    renderPreview();
    closeAllOverlays();
    banner.classList.add('show');
    return;
  }

  banner.classList.remove('show');
  // Eingeloggt: wenn noch kein Spiel läuft, Startmenü zeigen
  if (!state) {
    renderPreview();
    openOnly('start-overlay');
  } else {
    closeAllOverlays();
  }
}

// Eine hübsche, statische Vorschau-Auslage, damit die Seite nicht leer wirkt
function renderPreview() {
  oppRow.innerHTML = BOTS.map(b => {
    const minis = Array.from({ length: 7 }, () => '<div class="mini"></div>').join('');
    return `<div class="opp"><div class="opp-name"><span class="opp-ava" style="background:${b.avaBg}33">${b.ava}</span>${b.name}</div>
            <div class="opp-cards">${minis}</div><div class="opp-count">7 Karten</div></div>`;
  }).join('');

  const demo = { color: 'red', value: '7' };
  discardEl.innerHTML = cardHTML(demo);
  colorDot.style.opacity = '1';
  colorSwatch.style.background = COLOR_HEX.red; colorSwatch.style.color = COLOR_HEX.red;
  colorLabel.textContent = 'Rot';

  const demoHand = [
    { color: 'red', value: '7' }, { color: 'red', value: 'skip' }, { color: 'green', value: '4' },
    { color: 'blue', value: 'draw2' }, { color: 'yellow', value: '2' }, { color: 'wild', value: 'wild' },
    { color: 'blue', value: '9' },
  ];
  handEl.innerHTML = demoHand.map(c => cardHTML(c, { extra: 'disabled' })).join('');
  unoBtn.style.display = 'none';
  setStatus('Vorschau — melde dich an, um zu spielen.');
}

// Auf Auth warten
if (window.Auth) {
  window.Auth.onChange(user => applyAuthState(user));
} else {
  // Auth-Skript nicht geladen → trotzdem Vorschau + Hinweis
  renderPreview();
  $('login-banner').classList.add('show');
}
