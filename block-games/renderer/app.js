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
const SFX_SELECTOR = '.auth-tab, .settings-tab, .party-btn, .minigame-card, .badge-id, .btn';

function setupSfx() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest(SFX_SELECTOR);
    if (!el || el.disabled) return;
    const isTab = el.classList.contains('auth-tab') || el.classList.contains('settings-tab');
    Sfx.play(isTab ? 'tab' : 'click');
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
  // Tastatur: Fokus auf einen Reiter (per Pfeil/WASD) schaltet ihn sofort um —
  // wie ein echtes Reiter-Menü, ganz ohne Maus.
  tabLogin.addEventListener('focus', () => activate(true));
  tabRegister.addEventListener('focus', () => activate(false));
}

// Auth-Screen zeigen, immer mit dem Login-Reiter, und den Cursor gleich ins
// erste Feld setzen, damit man sofort (auch ohne Maus) lostippen kann.
function showAuth() {
  document.getElementById('tabLogin').classList.add('active');
  document.getElementById('tabRegister').classList.remove('active');
  document.getElementById('formLogin').hidden = false;
  document.getElementById('formRegister').hidden = true;
  showAuthError('');
  showScreen('screen-auth');
  document.getElementById('loginId').focus();
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
      showAuth();
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

// ── Einstellungs-Reiter ──────────────────────────────────────────────
// Die Einstellungen sind in Kategorien aufgeteilt (Konto/Anzeige/Grafik/
// Audio), die oben als Reiter gewählt werden; darunter erscheinen nur die
// Optionen der aktiven Kategorie. Reiter UND Optionen sind per Maus wie per
// Pfeiltasten/WASD bedienbar.
function activateSettingsTab(tab) {
  if (!tab || tab.hidden) return;
  document.querySelectorAll('.settings-tab').forEach(t => {
    const on = t === tab;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', String(on));
    const panel = document.getElementById(t.dataset.panel);
    if (panel) {
      panel.hidden = !on;
      panel.classList.toggle('active', on);
    }
  });
}

function setupSettingsTabs() {
  document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', () => activateSettingsTab(tab));
    // Fokus per Pfeil/WASD schaltet die Kategorie direkt um.
    tab.addEventListener('focus', () => activateSettingsTab(tab));
  });
}

// Einstellungen öffnen und einen Start-Reiter wählen. `tabId` ist optional;
// ist der gewünschte Reiter ausgeblendet (z.B. Konto im Gast-Modus), fällt
// die Auswahl auf „Anzeige" zurück. Der aktive Reiter bekommt den Fokus,
// damit man sofort per Tastatur weiterblättern kann.
function openSettings(tabId) {
  syncAccountCard(); // Konto-Reiter/Panel je nach Login ein-/ausblenden
  const wanted = tabId && document.getElementById(tabId);
  const target = (wanted && !wanted.hidden) ? wanted : document.getElementById('stabDisplay');
  activateSettingsTab(target);
  showScreen('screen-settings');
  target.focus();
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

  // Zahnrad → allgemeine Einstellungen (Anzeige zuerst).
  document.getElementById('btnSettings').addEventListener('click', () => openSettings('stabDisplay'));
  document.getElementById('btnSettingsBack').addEventListener('click', () => showScreen('screen-menu'));
  // Esc → zurück ins Menü übernimmt der zentrale Tastatur-Handler (setupKeyboard).

  // Start IMMER im Vollbild — wie bei anderen Videospielen, ohne Taskleiste.
  // Das Fenster startet bereits im Vollbild (main.js); hier erzwingen wir es
  // unabhängig vom gespeicherten Wert noch einmal und ziehen Store + UI nach
  // (sonst würde ein zuvor gespeicherter Fenstermodus das Spiel beim Start
  // im Fenster — mit sichtbarer Taskleiste — öffnen). Fenstermodus bleibt
  // jederzeit per Schalter oder F11 erreichbar.
  Settings.set('fullscreen', true);
  chkFull.checked = true;
  selRes.disabled = true;
  window.blockGames.setFullscreen(true);
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

// ── Tastatur: Esc + Pfeil-/WASD-Navigation ───────────────────────────
// GRUNDSATZ: Die ganze App ist komplett ohne Maus bedienbar — JEDER Screen
// und JEDES Overlay (Login/Registrierung, Hauptmenü, Einstellungen, Credits,
// Konto/Freunde, Beenden) lässt sich per Pfeiltasten ODER WASD ansteuern,
// Enter/Leertaste löst aus. Wer neue Screens baut, hängt sie hier in die
// Container-Auswahl ein. Den Fokus-Ring zeichnet :focus-visible (style.css).
//
// Richtungstasten: Pfeile immer; W/A/S/D nur, wenn NICHT in einem Textfeld
// getippt wird (sonst könnte man keinen Namen mit „w" o.ä. eingeben).
const DIR_KEYS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', a: 'left', s: 'down', d: 'right',
  W: 'up', A: 'left', S: 'down', D: 'right',
};
const WASD = new Set(['w', 'a', 's', 'd', 'W', 'A', 'S', 'D']);

function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    const quitOpen = !document.getElementById('quitOverlay').hidden;
    const isActive = (id) => document.getElementById(id).classList.contains('active');

    if (e.key === 'Escape') {
      // Esc schließt erst offene Overlays (Beenden / Konto), sonst führt es
      // aus Einstellungen bzw. der Credits-Seite zurück ins Hauptmenü.
      if (quitOpen) closeQuitDialog();
      else if (accountOpen()) closeAccount();
      else if (isActive('screen-settings') || isActive('screen-credits')) {
        showScreen('screen-menu');
      }
      return;
    }

    // Einstellungen: Enter auf einem Kategorie-Reiter springt direkt in dessen
    // erste Option (Schalter/Auswahl/Regler). So kommt man per Enter von den
    // Reitern oben zu den eigentlichen Einstellungen — z.B. zum Vollbild-
    // Schalter oder den Lautstärke-Reglern, ganz ohne Maus.
    if (e.key === 'Enter' && e.target.classList.contains('settings-tab')) {
      const panel = document.getElementById(e.target.dataset.panel);
      const first = panel && panel.querySelector(FOCUSABLE);
      if (first) { e.preventDefault(); first.focus(); Sfx.play('hover'); }
      return;
    }

    // Tastenkombis (Strg+W, Alt+←, …) NICHT als Navigation deuten.
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const dir = DIR_KEYS[e.key];
    if (!dir) return;
    // In einem Textfeld dürfen W/A/S/D nur tippen, nicht navigieren.
    const inText = e.target.matches('input:not([type=range]):not([type=checkbox]), textarea');
    if (inText && WASD.has(e.key)) return;

    // Container der aktuellen Ansicht (offene Overlays haben Vorrang).
    let container = null;
    if (quitOpen) container = document.getElementById('quitOverlay');
    else if (accountOpen()) container = document.getElementById('accountOverlay');
    else if (isActive('screen-auth')) container = document.getElementById('screen-auth');
    else if (isActive('screen-settings')) container = document.getElementById('screen-settings');
    else if (isActive('screen-menu')) container = document.getElementById('screen-menu');
    else if (isActive('screen-credits')) container = document.getElementById('screen-credits');
    if (!container) return;

    // In den Einstellungen die deterministische Reiter-/Options-Navigation
    // verwenden (zuverlässiger als die geometrische, s. handleSettingsKey).
    if (isActive('screen-settings') && !quitOpen && !accountOpen()) {
      if (handleSettingsKey(e, dir)) { e.preventDefault(); return; }
      // nicht behandelt (←/→ auf einer Option) → native Aufgabe behalten
      if (dir === 'left' || dir === 'right') return;
    }

    // Auf Bedienelementen (Textfeld, Regler, Auswahl, Schalter) bleibt die
    // WAAGERECHTE Pfeilbewegung ihre native Aufgabe: Cursor im Text, Regler
    // verstellen, Auswahl wechseln. Hoch/Runter springt immer zwischen Zeilen.
    if ((dir === 'left' || dir === 'right') && e.target.matches('input, select, textarea')) return;

    e.preventDefault();
    moveFocus(container, dir);
  });
}

// Alles, was per Tastatur fokussierbar ist (nicht nur Buttons): Schalter,
// Regler, Auswahlfelder und Eingaben gehören zur Navigation dazu.
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]';

// ── Einstellungen: deterministische Tastatur-Navigation ──────────────────
// In den Einstellungen ist die geometrische Navigation zu unzuverlässig: nach
// dem Verstellen einer Option (Regler/Auswahl) kam man nicht mehr sicher zu
// den Reitern zurück (Hoch landete schlimmstenfalls auf „Zurücksetzen"), und
// ←/→ verstellte nur die Option, statt den Reiter zu wechseln. Diese Funktion
// regelt die Navigation klar:
//   • Auf einem Reiter:  ←/→ wechselt den Reiter, ↓/Enter springt in die Optionen.
//   • Auf einer Option:  ↑/↓ wechselt die Option, an der obersten zurück zum Reiter.
//                        ←/→ bleibt native (Regler verstellen / Auswahl wechseln).
// Gibt true zurück, wenn die Taste behandelt wurde (dann kein moveFocus mehr).
// Back/Reset im Header bleiben per Tab-Taste erreichbar (Tab ist nicht belegt).
function handleSettingsKey(e, dir) {
  const tabs = [...document.querySelectorAll('.settings-tab')].filter(t => !t.hidden);
  if (!tabs.length) return false;
  const activeTab = tabs.find(t => t.classList.contains('active')) || tabs[0];
  const panel = activeTab && document.getElementById(activeTab.dataset.panel);
  const controls = panel
    ? [...panel.querySelectorAll(FOCUSABLE)].filter(c => c.offsetParent !== null)
    : [];
  const onTab = e.target.classList.contains('settings-tab');
  const ctlIndex = controls.indexOf(e.target);

  if (onTab) {
    if (dir === 'left' || dir === 'right') {
      const next = tabs[tabs.indexOf(e.target) + (dir === 'right' ? 1 : -1)];
      if (next) { activateSettingsTab(next); next.focus(); Sfx.play('tab'); }
      return true;
    }
    if (dir === 'down') {
      if (controls[0]) { controls[0].focus(); Sfx.play('hover'); }
      return true;
    }
    return true; // ↑ ganz oben — nichts darüber (kein Sprung auf „Zurücksetzen")
  }

  if (ctlIndex !== -1) {
    if (dir === 'up') {
      (ctlIndex === 0 ? activeTab : controls[ctlIndex - 1]).focus();
      Sfx.play('hover');
      return true;
    }
    if (dir === 'down') {
      const next = controls[ctlIndex + 1];
      if (next) { next.focus(); Sfx.play('hover'); }
      return true; // an der untersten Option bleiben
    }
    return false; // ←/→ → native (Regler/Auswahl)
  }

  return false; // weder Reiter noch Option (z.B. Header-Buttons) → geometrisch
}

// Geometrische Fokus-Navigation: springt zum nächstgelegenen sichtbaren
// Element in Richtung `dir` ('up'|'down'|'left'|'right'). Funktioniert dadurch
// auch im Karten-Grid und über gemischte Bedienelemente hinweg.
function moveFocus(container, dir) {
  const items = [...container.querySelectorAll(FOCUSABLE)]
    .filter(el => el.offsetParent !== null || el === document.activeElement);
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
    if (dir === 'right')     { fwd = dx;  side = Math.abs(dy); }
    else if (dir === 'left') { fwd = -dx; side = Math.abs(dy); }
    else if (dir === 'down') { fwd = dy;  side = Math.abs(dx); }
    else                     { fwd = -dy; side = Math.abs(dx); }
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
    // <button> statt <div>: per Tab/Pfeiltasten fokussierbar (Tastatur-Nav).
    // Karten sind IMMER auswählbar/fokussierbar — auch noch nicht spielbare
    // („Bald"). Klick/Enter auf ein „Bald"-Spiel zeigt nur einen Hinweis-Toast,
    // gestartet wird (noch) nichts.
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `minigame-card ${game.available ? 'available' : 'locked'}`;
    card.style.setProperty('--card-i', i);
    card.innerHTML = `
      <span class="minigame-icon">${game.icon}</span>
      <h3>${game.name}</h3>
      <p>${game.desc}</p>
      <span class="badge">${game.available ? 'Spielen' : 'Bald'}</span>
    `;
    card.addEventListener('click', () => {
      if (game.available && game.start) game.start();
      else showToast(`🎮 „${game.name}" kommt bald!`);
    });
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

// ── Konto & Freunde ──────────────────────────────────────────────────
// Overlay (Profil + Freundesliste + Anfragen + Freund-Suche), geöffnet über
// das Spieler-Badge im Menü. Die eigentliche Konto-Bearbeitung (Name/E-Mail/
// Passwort) liegt in den Einstellungen — der „Konto bearbeiten"-Knopf hier
// springt nur dorthin. Im Gast-Modus gibt es kein Konto → Hinweis.

function accountOpen() {
  return !document.getElementById('accountOverlay').hidden;
}

function openAccount() {
  if (!isOnlineAllowed()) {
    showToast('Im Gast-Modus gibt es kein Konto — melde dich an, um Freunde zu sehen.');
    return;
  }
  renderAccountHeader();
  document.getElementById('accountOverlay').hidden = false;
  document.getElementById('btnAccountClose').focus();
  loadFriends();
}

function closeAccount() {
  document.getElementById('accountOverlay').hidden = true;
  const results = document.getElementById('friendResults');
  results.hidden = true;
  results.innerHTML = '';
  document.getElementById('friendSearch').value = '';
  document.getElementById('btnAccountPanel').focus();
}

function renderAccountHeader() {
  const name = Auth.username;
  document.getElementById('accUsername').textContent = name;
  document.getElementById('accAvatar').textContent = name.charAt(0).toUpperCase();
  const mail = Auth.contactEmail;
  const mailEl = document.getElementById('accEmail');
  mailEl.textContent = mail || 'keine E-Mail hinterlegt';
  mailEl.classList.toggle('muted', !mail);
}

// Eine Freundes-/Anfrage-Zeile bauen (Avatar-Initiale + Name + Aktionen).
// `kind`: 'friend' | 'incoming' | 'outgoing'
function buildFriendRow(entry, kind) {
  const row = document.createElement('div');
  row.className = 'friend-row';

  const av = document.createElement('span');
  av.className = 'avatar friend-avatar';
  av.textContent = entry.username.charAt(0).toUpperCase();

  const name = document.createElement('span');
  name.className = 'friend-name';
  name.textContent = entry.username;

  const actions = document.createElement('span');
  actions.className = 'friend-actions';

  if (kind === 'incoming') {
    const accept = document.createElement('button');
    accept.className = 'btn btn-primary btn-sm';
    accept.textContent = 'Annehmen';
    accept.dataset.accept = entry.rowId;
    const decline = document.createElement('button');
    decline.className = 'btn btn-ghost btn-sm';
    decline.textContent = 'Ablehnen';
    decline.dataset.remove = entry.rowId;
    actions.append(accept, decline);
  } else if (kind === 'outgoing') {
    const pending = document.createElement('span');
    pending.className = 'friend-pending';
    pending.textContent = 'Angefragt';
    const cancel = document.createElement('button');
    cancel.className = 'btn btn-ghost btn-sm';
    cancel.textContent = 'Abbrechen';
    cancel.dataset.remove = entry.rowId;
    actions.append(pending, cancel);
  } else {
    const remove = document.createElement('button');
    remove.className = 'btn btn-ghost btn-sm';
    remove.textContent = 'Entfernen';
    remove.dataset.remove = entry.rowId;
    actions.append(remove);
  }

  row.append(av, name, actions);
  return row;
}

async function loadFriends() {
  const reqBox = document.getElementById('friendRequests');
  const listBox = document.getElementById('friendList');
  const { friends, incoming, outgoing } = await Auth.getFriendOverview();

  // Overlay könnte inzwischen geschlossen sein → nichts mehr tun.
  if (!accountOpen()) return;

  // Anfragen: eingehende (mit Annehmen/Ablehnen) + eigene offene.
  reqBox.innerHTML = '';
  if (!incoming.length && !outgoing.length) {
    reqBox.innerHTML = '<p class="friend-empty">Keine offenen Anfragen.</p>';
  } else {
    incoming.forEach(e => reqBox.appendChild(buildFriendRow(e, 'incoming')));
    outgoing.forEach(e => reqBox.appendChild(buildFriendRow(e, 'outgoing')));
  }

  listBox.innerHTML = '';
  if (!friends.length) {
    listBox.innerHTML = '<p class="friend-empty">Noch keine Freunde — such oben jemanden!</p>';
  } else {
    friends.forEach(e => listBox.appendChild(buildFriendRow(e, 'friend')));
  }

  setCountChip('reqCount', incoming.length);
  setCountChip('friendCount', friends.length);
}

function setCountChip(id, n) {
  const chip = document.getElementById(id);
  chip.textContent = n;
  chip.hidden = n === 0;
}

// Suchergebnisse für „Freund hinzufügen". Knöpfe schicken eine Anfrage.
async function runFriendSearch(query) {
  const box = document.getElementById('friendResults');
  const users = await Auth.searchUsers(query);
  if (!accountOpen()) return;
  box.innerHTML = '';
  if (!users.length) {
    box.hidden = false;
    box.innerHTML = '<p class="friend-empty">Niemand gefunden.</p>';
    return;
  }
  users.forEach(u => {
    const row = document.createElement('div');
    row.className = 'friend-row';
    const av = document.createElement('span');
    av.className = 'avatar friend-avatar';
    av.textContent = (u.username || '?').charAt(0).toUpperCase();
    const name = document.createElement('span');
    name.className = 'friend-name';
    name.textContent = u.username;
    const add = document.createElement('button');
    add.className = 'btn btn-primary btn-sm';
    add.textContent = '+ Hinzufügen';
    add.dataset.add = u.id;
    row.append(av, name, add);
    box.appendChild(row);
  });
  box.hidden = false;
}

function setupAccount() {
  document.getElementById('btnAccountPanel').addEventListener('click', openAccount);
  document.getElementById('btnAccountClose').addEventListener('click', closeAccount);

  // Klick auf den abgedunkelten Hintergrund schließt das Overlay.
  document.getElementById('accountOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'accountOverlay') closeAccount();
  });

  document.getElementById('btnSignOut').addEventListener('click', () => {
    closeAccount();
    Auth.signOut(); // onChange wechselt zum Auth-Screen
  });

  document.getElementById('btnAccountSettings').addEventListener('click', () => {
    closeAccount();
    openSettings('stabAccount'); // „Konto bearbeiten" → direkt zum Konto-Reiter
  });

  // Freund-Suche (entprellt).
  let searchTimer = null;
  const searchInput = document.getElementById('friendSearch');
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim();
    clearTimeout(searchTimer);
    if (q.length < 2) {
      const box = document.getElementById('friendResults');
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    searchTimer = setTimeout(() => runFriendSearch(q), 300);
  });

  // Aktionen in Listen + Suchergebnissen (Event-Delegation).
  document.getElementById('accountOverlay').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-add], button[data-accept], button[data-remove]');
    if (!btn) return;
    btn.disabled = true;

    if (btn.dataset.add) {
      const { error } = await Auth.sendFriendRequest(btn.dataset.add);
      showToast(error ? (error.message || 'Anfrage fehlgeschlagen.') : 'Anfrage gesendet! 🎉');
      Sfx.play(error ? 'error' : 'success');
      const box = document.getElementById('friendResults');
      box.hidden = true;
      box.innerHTML = '';
      document.getElementById('friendSearch').value = '';
      loadFriends();
    } else if (btn.dataset.accept) {
      const { error } = await Auth.acceptFriendRequest(btn.dataset.accept);
      if (error) { showToast(error.message || 'Fehlgeschlagen.'); btn.disabled = false; }
      else { Sfx.play('success'); loadFriends(); }
    } else if (btn.dataset.remove) {
      const { error } = await Auth.removeFriend(btn.dataset.remove);
      if (error) { showToast(error.message || 'Fehlgeschlagen.'); btn.disabled = false; }
      else loadFriends();
    }
  });
}

// ── Konto bearbeiten (in den Einstellungen) ──────────────────────────
// Die Karte ist nur für angemeldete Nutzer sichtbar und wird beim Öffnen
// der Einstellungen mit den aktuellen Werten gefüllt.
function syncAccountCard() {
  const loggedIn = isOnlineAllowed();
  const tab = document.getElementById('stabAccount');
  tab.hidden = !loggedIn;

  if (!loggedIn) {
    // Konto-Reiter weg → war er aktiv, auf „Anzeige" zurückfallen.
    document.getElementById('panel-account').hidden = true;
    if (tab.classList.contains('active')) {
      activateSettingsTab(document.getElementById('stabDisplay'));
    }
    return;
  }
  document.getElementById('accName').value = Auth.username;
  document.getElementById('accMail').value = Auth.contactEmail;
  document.getElementById('accPw').value = '';
  hideAccountMsg();
}

let accountMsgTimer = null;
function showAccountMsg(msg, ok) {
  const el = document.getElementById('accountMsg');
  el.textContent = msg;
  el.hidden = false;
  el.classList.toggle('ok', !!ok);
  el.classList.toggle('err', !ok);
  Sfx.play(ok ? 'success' : 'error');
  clearTimeout(accountMsgTimer);
  accountMsgTimer = setTimeout(hideAccountMsg, 4000);
}
function hideAccountMsg() {
  const el = document.getElementById('accountMsg');
  el.hidden = true;
  el.textContent = '';
}

function setupAccountSettings() {
  // Hilfsfunktion: Formular absenden, Knopf sperren, Ergebnis melden.
  function wire(formId, run) {
    document.getElementById(formId).addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true;
      const { ok, msg } = await run();
      btn.disabled = false;
      showAccountMsg(msg, ok);
    });
  }

  wire('formName', async () => {
    const { error } = await Auth.updateUsername(document.getElementById('accName').value);
    if (error) return { ok: false, msg: error.message || 'Name konnte nicht geändert werden.' };
    return { ok: true, msg: 'Name aktualisiert.' };
  });

  wire('formEmail', async () => {
    const { error } = await Auth.updateContactEmail(document.getElementById('accMail').value);
    if (error) return { ok: false, msg: error.message || 'E-Mail konnte nicht geändert werden.' };
    return { ok: true, msg: 'E-Mail gespeichert.' };
  });

  wire('formPw', async () => {
    const input = document.getElementById('accPw');
    const { error } = await Auth.updatePassword(input.value);
    if (error) return { ok: false, msg: error.message || 'Passwort konnte nicht geändert werden.' };
    input.value = '';
    return { ok: true, msg: 'Passwort geändert.' };
  });
}

// ── Start ────────────────────────────────────────────────────────────
async function boot() {
  spawnBackgroundBlocks();
  setupSfx();
  setupAuthTabs();
  setupAuthForms();
  setupQuit();
  setupCredits();
  setupAccount();
  setupAccountSettings();
  setupSettingsTabs();
  setupKeyboard();
  await setupSettings();
  document.getElementById('appVersion').textContent =
    `Block Games v${window.blockGames?.version || '?'}`;

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
      // Nur beim Login (vom Lade-/Auth-Screen) ins Menü springen. Profil-
      // Updates (Name/E-Mail/Passwort) feuern denselben Event — dabei darf
      // die aktuelle Seite (z.B. die Einstellungen) NICHT verlassen werden.
      const isActive = (id) => document.getElementById(id).classList.contains('active');
      if (isActive('screen-auth') || isActive('screen-loading')) showScreen('screen-menu');
      // Konto-Overlay-Kopf nachziehen (z.B. Name geändert); die Konto-Karte
      // in den Einstellungen wird bewusst NICHT neu gefüllt, damit die
      // Erfolgsmeldung und laufende Eingaben nicht überschrieben werden.
      if (accountOpen()) renderAccountHeader();
    } else {
      // Abgemeldet: evtl. offenes Konto-Overlay schließen + Konto-Karte
      // in den Einstellungen verstecken.
      if (accountOpen()) closeAccount();
      syncAccountCard();
      if (!guestMode) showAuth();
    }
  });

  const user = await Auth.init();
  if (user) {
    renderMenu();
    showScreen('screen-menu');
  } else {
    showAuth();
  }
}

boot();
