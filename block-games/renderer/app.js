// Block Games — UI-Logik: Screen-Wechsel, Login-Pflicht, Hauptmenü.
'use strict';

// ── Minigame-Katalog ─────────────────────────────────────────────────
// Platzhalter: `available: false` = ausgegraut mit "Bald"-Badge.
// Sobald ein Minigame fertig ist, hier freischalten und `start` setzen.
const MINIGAMES = [
  { id: 'block-rush',   icon: '🧱', name: 'Block Rush',   desc: 'Staple schneller als die Gegner', available: false },
  { id: 'coin-grab',    icon: '🪙', name: 'Coin Grab',    desc: 'Sammle die meisten Münzen',       available: false },
  { id: 'memory-clash', icon: '🧠', name: 'Memory Clash', desc: 'Wer merkt sich mehr?',            available: false },
  { id: 'speed-tap',    icon: '⚡', name: 'Speed Tap',    desc: 'Reaktion entscheidet',            available: false },
  { id: 'bomb-pass',    icon: '💣', name: 'Bomb Pass',    desc: 'Halte die Bombe nicht zuletzt',   available: false },
  { id: 'quiz-blocks',  icon: '❓', name: 'Quiz Blocks',  desc: 'Wissen schlägt Würfelglück',      available: false },
];

// ── Screen-Verwaltung ────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── Animierter Hintergrund ───────────────────────────────────────────
function spawnBackgroundBlocks() {
  const colors = ['#ff5d5d', '#ffc93c', '#3ddc84', '#4db5ff', '#b06dff'];
  const container = document.getElementById('bgBlocks');
  for (let i = 0; i < 18; i++) {
    const b = document.createElement('div');
    const size = 24 + Math.random() * 56;
    b.className = 'bg-block';
    b.style.width = b.style.height = `${size}px`;
    b.style.left = `${Math.random() * 100}vw`;
    b.style.background = colors[i % colors.length];
    b.style.animationDuration = `${14 + Math.random() * 18}s`;
    b.style.animationDelay = `${-Math.random() * 20}s`;
    container.appendChild(b);
  }
}

// ── Auth-UI ──────────────────────────────────────────────────────────
const authError = document.getElementById('authError');

function showAuthError(msg) {
  authError.textContent = msg;
  authError.hidden = !msg;
}

function setupAuthTabs() {
  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');
  const formLogin = document.getElementById('formLogin');
  const formRegister = document.getElementById('formRegister');

  function activate(loginActive) {
    tabLogin.classList.toggle('active', loginActive);
    tabRegister.classList.toggle('active', !loginActive);
    formLogin.hidden = !loginActive;
    formRegister.hidden = loginActive;
    showAuthError('');
  }

  tabLogin.addEventListener('click', () => activate(true));
  tabRegister.addEventListener('click', () => activate(false));
}

function setupAuthForms() {
  document.getElementById('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    showAuthError('');
    const btn = document.getElementById('btnLogin');
    btn.disabled = true;
    const { error } = await Auth.signIn(
      document.getElementById('loginId').value,
      document.getElementById('loginPw').value
    );
    btn.disabled = false;
    if (error) showAuthError(error.message || 'Anmeldung fehlgeschlagen.');
    // Erfolg: onAuthStateChange wechselt automatisch ins Menü.
  });

  document.getElementById('formRegister').addEventListener('submit', async (e) => {
    e.preventDefault();
    showAuthError('');
    const username = document.getElementById('regUser').value.trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      showAuthError('Username: 3–20 Zeichen, nur Buchstaben, Zahlen und _');
      return;
    }
    const btn = document.getElementById('btnRegister');
    btn.disabled = true;
    const { error } = await Auth.signUp(
      document.getElementById('regMail').value,
      document.getElementById('regPw').value,
      username
    );
    btn.disabled = false;
    if (error) showAuthError(error.message || 'Registrierung fehlgeschlagen.');
  });

  document.getElementById('btnLogout').addEventListener('click', () => Auth.signOut());
}

// ── Hauptmenü ────────────────────────────────────────────────────────
function renderMenu() {
  const name = Auth.username;
  document.getElementById('menuUsername').textContent = name;
  document.getElementById('menuAvatar').textContent = name.charAt(0).toUpperCase();

  const grid = document.getElementById('minigameGrid');
  grid.innerHTML = '';
  for (const game of MINIGAMES) {
    const card = document.createElement('div');
    card.className = `minigame-card ${game.available ? 'available' : 'locked'}`;
    card.innerHTML = `
      <span class="minigame-icon">${game.icon}</span>
      <h3>${game.name}</h3>
      <p>${game.desc}</p>
      <span class="badge">${game.available ? 'Spielen' : 'Bald'}</span>
    `;
    if (game.available && game.start) card.addEventListener('click', game.start);
    grid.appendChild(card);
  }
}

// ── Start ────────────────────────────────────────────────────────────
async function boot() {
  spawnBackgroundBlocks();
  setupAuthTabs();
  setupAuthForms();
  document.getElementById('appVersion').textContent =
    `Block Games v${window.blockGames?.version || '?'}`;

  document.getElementById('btnParty').addEventListener('click', () => {
    alert('Der Party-Modus kommt bald! 🎲\n(4 Spieler — freie Plätze füllt die KI)');
  });

  // Login-Pflicht: ohne Session geht es nur zum Auth-Screen.
  Auth.onChange((auth) => {
    if (auth.user) {
      renderMenu();
      showScreen('screen-menu');
    } else {
      showScreen('screen-auth');
    }
  });

  const user = await Auth.init();
  if (user) {
    renderMenu();
    showScreen('screen-menu');
  } else {
    showScreen('screen-auth');
  }
}

boot();
