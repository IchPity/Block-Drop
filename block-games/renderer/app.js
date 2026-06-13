// Block Games — UI-Logik: Screen-Wechsel, Login/Gast-Modus, Hauptmenü.
//
// Gast-Modus: Der Login ist überspringbar ("Als Gast spielen"). Ohne Konto
// gibt es ausschließlich Partien gegen Bots — kein Online-Spiel, kein
// gespeicherter Fortschritt. Die Sperre hängt an `isOnlineAllowed()`:
// JEDE künftige Online-Funktion muss diese Funktion prüfen.
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

// ── Gast-Modus ───────────────────────────────────────────────────────
let guestMode = false;

// Online-Partien nur mit echtem Konto. Gäste spielen nur gegen Bots.
function isOnlineAllowed() {
  return !!Auth.user;
}

// ── Screen-Verwaltung ────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── Toast (kurze Einblend-Hinweise, ersetzt alert) ───────────────────
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => { t.hidden = true; }, 300);
  }, 3200);
}

// ── Animierter Bühnen-Hintergrund ────────────────────────────────────
// Schwebende Blöcke + 3D-Würfel (floatUp) und funkelnde Sterne (twinkle).
// Rein dekorativ; bei "Animationen reduzieren" blendet die CSS alle Layer
// aus (body.reduced-fx), die Elemente bleiben dann einfach unsichtbar.
const ARCADE_COLORS = ['#ff5d5d', '#ffc93c', '#3ddc84', '#4db5ff', '#b06dff'];

function spawnBackgroundBlocks() {
  const blocks = document.getElementById('bgBlocks');
  if (blocks) {
    for (let i = 0; i < 16; i++) {
      const b = document.createElement('div');
      const isCube = i % 3 === 0;          // jeder dritte ist ein 3D-Würfel
      const size = 30 + Math.random() * 64;
      const color = ARCADE_COLORS[i % ARCADE_COLORS.length];
      b.className = isCube ? 'bg-cube' : 'bg-block';
      b.style.width = `${size}px`;
      b.style.height = isCube ? `${size * 1.1}px` : `${size}px`;
      b.style.left = `${Math.random() * 100}vw`;
      if (isCube) b.style.setProperty('--c', color);
      else b.style.background = color;
      b.style.animationDuration = `${16 + Math.random() * 20}s`;
      b.style.animationDelay = `${-Math.random() * 24}s`;
      blocks.appendChild(b);
    }
  }

  const stars = document.getElementById('bgStars');
  if (stars) {
    for (let i = 0; i < 24; i++) {
      const s = document.createElement('div');
      const sz = 5 + Math.random() * 12;
      s.className = 'bg-star';
      s.style.width = s.style.height = `${sz}px`;
      s.style.left = `${Math.random() * 100}vw`;
      s.style.top = `${Math.random() * 100}vh`;
      s.style.setProperty('--c', ARCADE_COLORS[i % ARCADE_COLORS.length]);
      s.style.animationDuration = `${2.2 + Math.random() * 3.6}s`;
      s.style.animationDelay = `${-Math.random() * 6}s`;
      stars.appendChild(s);
    }
  }
}

// ── Sound-Verdrahtung ────────────────────────────────────────────────
// UI-Sounds laufen zentral über Event-Delegation — neue Buttons/Karten
// klingen damit automatisch, ohne dass jeder Listener Sfx.play() rufen muss.
const SFX_SELECTOR = '.auth-tab, .party-btn, .minigame-card.available, .btn';

function setupSfx() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest(SFX_SELECTOR);
    if (!el || el.disabled) return;
    Sfx.play(el.classList.contains('auth-tab') ? 'tab' : 'click');
  });

  // Hover nur beim Betreten des Elements (nicht bei jedem Kind-Wechsel)
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest(SFX_SELECTOR);
    if (!el || el.disabled || el.contains(e.relatedTarget)) return;
    Sfx.play('hover');
  });

  // Kippschalter und Auswahlfelder (Einstellungen)
  document.addEventListener('change', (e) => {
    if (e.target.matches('input[type="checkbox"]')) Sfx.play('toggle');
    else if (e.target.matches('select')) Sfx.play('tab');
  });
}

// ── Auth-UI ──────────────────────────────────────────────────────────
const authError = document.getElementById('authError');

function showAuthError(msg) {
  authError.textContent = msg;
  authError.hidden = !msg;
  if (msg) Sfx.play('error');
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
    else Sfx.play('success');
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
    else Sfx.play('success');
  });

  // Login überspringen → Gast-Modus (nur Bots).
  document.getElementById('btnGuest').addEventListener('click', () => {
    guestMode = true;
    renderMenu();
    showScreen('screen-menu');
  });

  // Im Menü: Gast → zurück zum Login; eingeloggt → abmelden.
  document.getElementById('btnAccount').addEventListener('click', () => {
    if (guestMode) {
      guestMode = false;
      showAuthError('');
      showScreen('screen-auth');
    } else {
      Auth.signOut();
    }
  });
}

// ── Einstellungen ────────────────────────────────────────────────────
// Die Werte leben im zentralen Settings-Store (settings.js). Diese Seite
// ist nur die UI dafür; künftige In-Game-Einstellungs-Overlays nutzen
// denselben Store und bleiben dadurch automatisch synchron.

// Auswählbare Fenstergrößen — gefiltert auf das, was auf den Bildschirm passt.
const RESOLUTIONS = [
  [1024, 768], [1280, 720], [1280, 800], [1366, 768],
  [1600, 900], [1920, 1080], [2560, 1440], [3840, 2160],
];

const FPS_OPTIONS = [
  [30, '30 FPS'], [60, '60 FPS'], [120, '120 FPS'],
  [144, '144 FPS'], [240, '240 FPS'], [0, 'Unbegrenzt'],
];

function applyReducedFx() {
  document.body.classList.toggle('reduced-fx', Settings.get('reducedFx'));
}

async function setupSettings() {
  const chkFull = document.getElementById('setFullscreen');
  const selRes = document.getElementById('setResolution');
  const selFps = document.getElementById('setFps');
  const chkFx = document.getElementById('setReducedFx');
  const volumes = [
    ['setVolMaster', 'valVolMaster', 'volMaster'],
    ['setVolMusic', 'valVolMusic', 'volMusic'],
    ['setVolSfx', 'valVolSfx', 'volSfx'],
  ];

  const info = await window.blockGames.getDisplayInfo();
  RESOLUTIONS
    .filter(([w, h]) => w <= info.screenWidth && h <= info.screenHeight)
    .forEach(([w, h]) => {
      const opt = document.createElement('option');
      opt.value = `${w}x${h}`;
      opt.textContent = `${w} × ${h}`;
      selRes.appendChild(opt);
    });

  FPS_OPTIONS.forEach(([value, label]) => {
    const opt = document.createElement('option');
    opt.value = String(value);
    opt.textContent = label;
    selFps.appendChild(opt);
  });

  // Store → UI (beim Öffnen und nach "Zurücksetzen")
  function syncUi() {
    chkFull.checked = Settings.get('fullscreen');
    selRes.value = Settings.get('resolution');
    if (!selRes.value) selRes.value = selRes.options[0]?.value || ''; // gespeicherte Größe passt nicht mehr
    selRes.disabled = chkFull.checked;
    selFps.value = String(Settings.get('fpsLimit'));
    chkFx.checked = Settings.get('reducedFx');
    volumes.forEach(([inputId, valId, key]) => {
      document.getElementById(inputId).value = Settings.get(key);
      document.getElementById(valId).textContent = `${Settings.get(key)}%`;
    });
  }
  syncUi();

  function applyResolution() {
    const [w, h] = String(Settings.get('resolution')).split('x').map(Number);
    if (w && h) window.blockGames.setWindowSize(w, h);
  }

  chkFull.addEventListener('change', () => {
    Settings.set('fullscreen', chkFull.checked);
    selRes.disabled = chkFull.checked;
    window.blockGames.setFullscreen(chkFull.checked);
  });

  selRes.addEventListener('change', () => {
    Settings.set('resolution', selRes.value);
    if (!Settings.get('fullscreen')) applyResolution();
  });

  selFps.addEventListener('change', () => Settings.set('fpsLimit', Number(selFps.value)));

  chkFx.addEventListener('change', () => {
    Settings.set('reducedFx', chkFx.checked);
    applyReducedFx();
  });

  // Beim Ziehen eines Reglers einen kurzen Test-Blip spielen (gedrosselt),
  // damit man die eingestellte Lautstärke direkt hört.
  let lastVolBlip = 0;
  volumes.forEach(([inputId, valId, key]) => {
    const input = document.getElementById(inputId);
    input.addEventListener('input', () => {
      Settings.set(key, Number(input.value));
      document.getElementById(valId).textContent = `${input.value}%`;
      const now = Date.now();
      if (now - lastVolBlip > 150) {
        lastVolBlip = now;
        Sfx.play('blip', key === 'volMusic' ? 'music' : 'sfx');
      }
    });
  });

  // F11 (Main-Prozess) hat umgeschaltet → Store + UI nachziehen.
  // Beim Verlassen des Vollbilds die gespeicherte Fenstergröße herstellen.
  window.blockGames.onFullscreenChange((on) => {
    Settings.set('fullscreen', on);
    chkFull.checked = on;
    selRes.disabled = on;
    if (!on) applyResolution();
  });

  document.getElementById('btnSettingsReset').addEventListener('click', () => {
    Settings.reset();
    syncUi();
    applyReducedFx();
    window.blockGames.setFullscreen(Settings.get('fullscreen'));
    showToast('Einstellungen zurückgesetzt.');
  });

  document.getElementById('btnSettings').addEventListener('click', () => showScreen('screen-settings'));
  document.getElementById('btnSettingsBack').addEventListener('click', () => showScreen('screen-menu'));
  // Esc → zurück ins Menü übernimmt der zentrale Tastatur-Handler (setupKeyboard).

  // Gespeicherte Einstellungen beim Start anwenden. Das Fenster startet
  // immer im Vollbild (main.js); wer Fenstermodus gespeichert hat, landet
  // hier sofort wieder dort (Größe setzt der onFullscreenChange-Handler).
  if (!Settings.get('fullscreen')) window.blockGames.setFullscreen(false);
  applyReducedFx();
}

// ── Beenden (⏻ im Hauptmenü, mit Bestätigung) ────────────────────────
function openQuitDialog() {
  document.getElementById('quitOverlay').hidden = false;
  document.getElementById('btnQuitCancel').focus();
}

function closeQuitDialog() {
  document.getElementById('quitOverlay').hidden = true;
  document.getElementById('btnQuit').focus();
}

function setupQuit() {
  document.getElementById('btnQuit').addEventListener('click', openQuitDialog);
  document.getElementById('btnQuitCancel').addEventListener('click', closeQuitDialog);
  document.getElementById('btnQuitConfirm').addEventListener('click', () => window.blockGames.quitApp());
  // Klick auf den abgedunkelten Hintergrund bricht ebenfalls ab
  document.getElementById('quitOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'quitOverlay') closeQuitDialog();
  });
}

// ── Tastatur: Esc + Pfeil-Navigation ─────────────────────────────────
// Das Menü ist komplett ohne Maus bedienbar: Pfeiltasten springen zum
// nächstgelegenen Button in Pfeilrichtung, Enter/Leertaste löst aus
// (Button-Standard). Den Fokus-Ring zeichnet :focus-visible (style.css).
function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    const quitOpen = !document.getElementById('quitOverlay').hidden;
    const isActive = (id) => document.getElementById(id).classList.contains('active');

    if (e.key === 'Escape') {
      // Esc schließt erst den Dialog, sonst führt es aus Einstellungen
      // bzw. der Credits-Seite zurück ins Hauptmenü.
      if (quitOpen) closeQuitDialog();
      else if (isActive('screen-settings') || isActive('screen-credits')) {
        showScreen('screen-menu');
      }
      return;
    }

    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    // In Eingabefeldern/Slidern/Selects behalten die Pfeile ihre normale Aufgabe
    if (e.target.matches('input, select, textarea')) return;

    // Pfeil-Navigation gilt im Beenden-Dialog, im Hauptmenü und auf Credits
    let container = null;
    if (quitOpen) container = document.getElementById('quitOverlay');
    else if (isActive('screen-menu')) container = document.getElementById('screen-menu');
    else if (isActive('screen-credits')) container = document.getElementById('screen-credits');
    if (!container) return;

    e.preventDefault();
    moveFocus(container, e.key);
  });
}

// Geometrische Fokus-Navigation: springt zum nächstgelegenen sichtbaren
// Button in Pfeilrichtung (funktioniert dadurch auch im Karten-Grid).
function moveFocus(container, key) {
  const items = [...container.querySelectorAll('button:not([disabled])')]
    .filter(el => el.offsetParent !== null);
  if (!items.length) return;

  const current = document.activeElement;
  if (!items.includes(current)) { items[0].focus(); Sfx.play('hover'); return; }

  const c = current.getBoundingClientRect();
  const cx = c.left + c.width / 2;
  const cy = c.top + c.height / 2;
  let best = null;
  let bestScore = Infinity;

  items.forEach(el => {
    if (el === current) return;
    const r = el.getBoundingClientRect();
    const dx = r.left + r.width / 2 - cx;
    const dy = r.top + r.height / 2 - cy;
    let fwd, side;
    if (key === 'ArrowRight')     { fwd = dx;  side = Math.abs(dy); }
    else if (key === 'ArrowLeft') { fwd = -dx; side = Math.abs(dy); }
    else if (key === 'ArrowDown') { fwd = dy;  side = Math.abs(dx); }
    else                          { fwd = -dy; side = Math.abs(dx); }
    if (fwd <= 4) return;             // nur Elemente in Pfeilrichtung
    const score = fwd + side * 2.5;   // seitlicher Versatz zählt stärker
    if (score < bestScore) { bestScore = score; best = el; }
  });

  if (best) { best.focus(); Sfx.play('hover'); }
}

// ── Hauptmenü ────────────────────────────────────────────────────────
function renderMenu() {
  const guest = !Auth.user;
  const name = guest ? 'Gast' : Auth.username;

  document.getElementById('menuUsername').textContent = name;
  const avatar = document.getElementById('menuAvatar');
  avatar.textContent = name.charAt(0).toUpperCase();
  avatar.classList.toggle('guest', guest);

  document.getElementById('guestBanner').hidden = !guest;
  document.getElementById('btnAccount').textContent = guest ? 'Anmelden' : 'Abmelden';
  document.getElementById('partyHint').textContent = guest
    ? 'Brettspiel-Modus · du + 3 Bots · bald verfügbar'
    : 'Brettspiel-Modus · 4 Spieler · bald verfügbar';

  const grid = document.getElementById('minigameGrid');
  grid.innerHTML = '';
  MINIGAMES.forEach((game, i) => {
    // <button> statt <div>: per Tab/Pfeiltasten fokussierbar (Tastatur-Nav)
    const card = document.createElement('button');
    card.type = 'button';
    card.disabled = !game.available;
    card.className = `minigame-card ${game.available ? 'available' : 'locked'}`;
    card.style.setProperty('--card-i', i);
    card.innerHTML = `
      <span class="minigame-icon">${game.icon}</span>
      <h3>${game.name}</h3>
      <p>${game.desc}</p>
      <span class="badge">${game.available ? 'Spielen' : 'Bald'}</span>
    `;
    if (game.available && game.start) card.addEventListener('click', game.start);
    grid.appendChild(card);
  });
}

// ── Credits ──────────────────────────────────────────────────────────
// Bewusst datengetrieben, damit die Seite leicht erweiterbar bleibt:
// neue Rolle = ein Eintrag mehr. Aktuell überall nur Peter Scheikl.
const CREDITS = [
  { role: 'Game Design',    name: 'Peter Scheikl' },
  { role: 'Development',    name: 'Peter Scheikl' },
  { role: 'UI/UX Design',   name: 'Peter Scheikl' },
  { role: 'Art Direction',  name: 'Peter Scheikl' },
  { role: 'Sound Design',   name: 'Peter Scheikl' },
  { role: 'Project Lead',   name: 'Peter Scheikl' },
  { role: 'Testing',        name: 'Peter Scheikl' },
  { role: 'Special Thanks', name: 'Peter Scheikl' },
  { role: 'Powered by',     name: 'Peter Scheikl' },
];

function renderCredits() {
  const grid = document.getElementById('creditsGrid');
  grid.innerHTML = ''; // neu aufbauen → gestaffelte Einblendung bei jedem Öffnen
  CREDITS.forEach((c, i) => {
    const card = document.createElement('div');
    card.className = 'credit-card';
    card.style.setProperty('--card-i', i);
    const role = document.createElement('span');
    role.className = 'credit-role';
    role.textContent = c.role;
    const name = document.createElement('span');
    name.className = 'credit-name';
    name.textContent = c.name;
    card.append(role, name);
    grid.appendChild(card);
  });
}

function setupCredits() {
  document.getElementById('btnCredits').addEventListener('click', () => {
    renderCredits();
    showScreen('screen-credits');
    // Fokus auf "Zurück" — der Ring erscheint nur bei Tastatur-Bedienung.
    document.getElementById('btnCreditsBack').focus();
  });
  document.getElementById('btnCreditsBack').addEventListener('click', () => showScreen('screen-menu'));
  // Esc → zurück ins Menü übernimmt der zentrale Tastatur-Handler (setupKeyboard).
}

// ── Start ────────────────────────────────────────────────────────────
async function boot() {
  spawnBackgroundBlocks();
  setupSfx();
  setupAuthTabs();
  setupAuthForms();
  setupQuit();
  setupCredits();
  setupKeyboard();
  await setupSettings();
  document.getElementById('appVersion').textContent =
    `Block Games v${window.blockGames?.version || '?'} · F11 = Vollbild an/aus`;

  document.getElementById('btnParty').addEventListener('click', () => {
    showToast(isOnlineAllowed()
      ? 'Der Party-Modus kommt bald! 🎲 (4 Spieler — freie Plätze füllt die KI)'
      : 'Der Party-Modus kommt bald! 🎲 (Als Gast spielst du gegen 3 Bots)');
  });

  // Auth-Änderungen steuern die Screens. Der Gast-Modus bleibt aktiv,
  // bis sich der Spieler anmeldet oder selbst zum Login zurückgeht.
  Auth.onChange(() => {
    if (Auth.user) {
      guestMode = false;
      renderMenu();
      showScreen('screen-menu');
    } else if (!guestMode) {
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
