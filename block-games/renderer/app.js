// Block Games — UI-Logik: Screen-Wechsel, Login/Gast-Modus, Hauptmenü.
//
// Gast-Modus: Der Login ist überspringbar ("Als Gast spielen"). Ohne Konto
// gibt es ausschließlich Partien gegen Bots — kein Online-Spiel, kein
// gespeicherter Fortschritt. Die Sperre hängt an `isOnlineAllowed()`:
// JEDE künftige Online-Funktion muss diese Funktion prüfen.
'use strict';

// ── Minigame-Katalog ─────────────────────────────────────────────────
// Nur wirklich spielbare Minigames. Sobald ein neues fertig ist, hier
// freischalten (`id`/`nav`/`start` wie unten). `nav` = feste
// Navigations-ID für die Tastatur-Steuerung (siehe NAV_MENU).
//
// Spiele „in Arbeit" stehen NICHT hier als eigene, gleich gewichtete
// Karten — vier gesperrte Karten neben zwei spielbaren machten die
// Hauptmenü-Wahl auf 6 Optionen auf, obwohl nur 2 etwas taten. Sie laufen
// stattdessen gesammelt in UPCOMING_MINIGAMES als EINE Sammel-Kachel.
const MINIGAMES = [
  { id: 'laser-lines', nav: 'main_laserLines', icon: '🔺', name: 'Laser Lines', desc: 'Weiche den Lasern aus!', available: true, start: () => startTutorial('laser-lines') },
  { id: 'block-bomb',  nav: 'main_blockBomb',  icon: '💣', name: 'Block Bomb',  desc: 'Berühr die anderen – wer mit der Bombe hochgeht, fliegt raus', available: true, start: () => startTutorial('block-bomb') },
];

const UPCOMING_MINIGAMES = [
  { icon: '🪙', name: 'Coin Grab' },
  { icon: '🧠', name: 'Memory Clash' },
  { icon: '⚡', name: 'Speed Tap' },
  { icon: '❓', name: 'Quiz Blocks' },
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

// Kurzer Hinweis DIREKT am betroffenen Element (Shake + roter Rand), damit
// eine verpasste/verblasste Toast-Meldung nicht die einzige Spur bleibt.
function flashInvalid(el) {
  if (!el) return;
  el.classList.remove('flash-invalid');
  void el.offsetWidth; // Reflow erzwingen, damit die Animation neu startet
  el.classList.add('flash-invalid');
  setTimeout(() => el.classList.remove('flash-invalid'), 450);
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
const SFX_SELECTOR = '.auth-tab, .settings-tab, .party-btn, .minigame-card, .badge-id, .btn, .lobby-mini-btn, .lobby-opt, .color-cell';

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

// Supabase liefert Fehlertexte auf Englisch — bekannte Fälle ins Deutsche
// übersetzen. Unbekannte Fehler zeigen NIE den rohen englischen Text,
// sondern den übergebenen deutschen Fallback (sonst rutscht mitten in der
// sonst komplett deutschen Oberfläche Englisch durch).
const AUTH_ERROR_MAP = [
  [/invalid login credentials/i, 'Benutzername oder Passwort falsch.'],
  [/(already registered|duplicate key value)/i, 'Dieser Name ist bereits vergeben.'],
  [/email not confirmed/i, 'E-Mail noch nicht bestätigt.'],
  [/new password should be different/i, 'Neues Passwort muss sich vom alten unterscheiden.'],
  [/password should be at least/i, 'Passwort muss mindestens 6 Zeichen haben.'],
  [/rate limit/i, 'Zu viele Versuche — kurz warten und nochmal.'],
  [/(failed to fetch|network|timeout)/i, 'Keine Verbindung zum Server.'],
];

function translateError(error, fallback) {
  const raw = error && error.message;
  if (!raw) return fallback;
  for (const [pattern, de] of AUTH_ERROR_MAP) {
    if (pattern.test(raw)) return de;
  }
  return fallback;
}

function showAuthError(msg) {
  authError.textContent = msg;
  authError.hidden = !msg;
  if (msg) Sfx.play('error');
}

// ── Zuletzt angemeldete Nutzer ───────────────────────────────────────
// Merkt sich (rein lokal) die Namen, mit denen man sich angemeldet hat, und
// bietet sie auf dem Login-Reiter als Vorschläge an. Gespeichert wird NUR der
// eingegebene Login-Name + ein Zeitstempel — niemals ein Passwort. Einträge,
// die 7 Tage nicht mehr für einen Login genutzt wurden, verschwinden beim
// Laden automatisch. Klick auf einen Vorschlag füllt das Namensfeld, das ✕
// entfernt ihn.
const RecentUsers = (() => {
  const KEY = 'blockgames.recentUsers';
  const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 Tage in Millisekunden
  const MAX = 5;                            // höchstens 5 Vorschläge

  function load() {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { /* kaputt → leer */ }
    if (!Array.isArray(list)) list = [];
    const now = Date.now();
    return list.filter(e => e && e.name && (now - (e.ts || 0)) < MAX_AGE);
  }

  function save(list) {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  }

  // Nach erfolgreichem Login/Registrierung: Name nach vorne, Zeit auffrischen
  // (so verlängert jede Anmeldung die 7-Tage-Frist).
  function remember(name) {
    const clean = String(name || '').trim();
    if (!clean) return;
    const list = load().filter(e => e.name.toLowerCase() !== clean.toLowerCase());
    list.unshift({ name: clean, ts: Date.now() });
    save(list);
  }

  function forget(name) {
    save(load().filter(e => e.name.toLowerCase() !== String(name).toLowerCase()));
  }

  return { remember, forget, list: load };
})();

// Vorschläge auf dem Login-Reiter aufbauen (oder den Block verstecken).
function renderRecentUsers() {
  const wrap = document.getElementById('recentUsers');
  const listEl = document.getElementById('recentUsersList');
  const entries = RecentUsers.list();
  listEl.innerHTML = '';
  if (!entries.length) { wrap.hidden = true; return; }
  entries.forEach(e => {
    const chip = document.createElement('div');
    chip.className = 'recent-chip';

    const pick = document.createElement('button');
    pick.type = 'button';
    pick.className = 'recent-chip-name';
    pick.textContent = e.name;
    pick.title = `Als „${e.name}" anmelden`;
    pick.addEventListener('click', () => {
      document.getElementById('loginId').value = e.name;
      document.getElementById('loginPw').focus();
    });

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'recent-chip-del';
    del.textContent = '✕';
    del.title = 'Vorschlag entfernen';
    del.addEventListener('click', (ev) => {
      ev.stopPropagation();
      RecentUsers.forget(e.name);
      renderRecentUsers();
    });

    chip.append(pick, del);
    listEl.appendChild(chip);
  });
  wrap.hidden = false;
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
  renderRecentUsers();
  showScreen('screen-auth');
  document.getElementById('loginId').focus();
}

function setupAuthForms() {
  document.getElementById('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    showAuthError('');
    const btn = document.getElementById('btnLogin');
    const loginId = document.getElementById('loginId').value;
    btn.disabled = true;
    const { error } = await Auth.signIn(
      loginId,
      document.getElementById('loginPw').value
    );
    btn.disabled = false;
    if (error) showAuthError(translateError(error, 'Anmeldung fehlgeschlagen.'));
    else { RecentUsers.remember(loginId); Sfx.play('success'); }
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
    if (error) showAuthError(translateError(error, 'Registrierung fehlgeschlagen.'));
    else { RecentUsers.remember(username); Sfx.play('success'); }
  });

  // Login überspringen → Gast-Modus (nur Bots).
  document.getElementById('btnGuest').addEventListener('click', () => {
    guestMode = true;
    renderMenu();
    goToMenu();
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
  document.getElementById('btnSettingsBack').addEventListener('click', goToMenu);
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
// Beim Beenden fragt der Dialog zusätzlich, ob man sich auch abmelden möchte
// (nur angemeldet sichtbar). Ohne Abmelden bleibt die Session erhalten und der
// nächste Start landet direkt im Menü; mit Abmelden erscheint wieder der Login.
function openQuitDialog() {
  // „Abmelden & Beenden" nur, wenn wirklich ein Konto angemeldet ist (kein Gast).
  document.getElementById('btnQuitLogout').hidden = !isOnlineAllowed();
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
  // „Abmelden & Beenden": erst die Session beenden, damit der nächste Start
  // wieder den Login zeigt, dann das Spiel schließen.
  document.getElementById('btnQuitLogout').addEventListener('click', async () => {
    if (isOnlineAllowed()) await Auth.signOut();
    window.blockGames.quitApp();
  });
  // „Beenden": Session bleibt erhalten, der nächste Start landet direkt im Menü.
  document.getElementById('btnQuitConfirm').addEventListener('click', () => {
    window.blockGames.quitApp();
  });
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

// ── Feste Navigations-Tabelle (navIds statt DOM-Reihenfolge) ─────────────
// GRUNDSATZ (s. Wunsch): Die Navigation läuft NICHT zufällig über die
// DOM-Reihenfolge, sondern über feste navIds (data-nav am Element) und diese
// klare Tabelle. Pro Richtung steht die navId des Ziels. Fehlt ein Eintrag
// (oder ist das Ziel gerade nicht sichtbar), bleibt der Fokus stehen — er
// springt nie „ins Leere". Werte (Tabelle-Eintrag = Funktion) verstellen eine
// Option statt zu navigieren. Dynamische Screens (Lobby) liefern ihre Tabelle
// zur Laufzeit über buildLobbyNav(); die Einstellungen nutzen weiterhin den
// eigenen, deterministischen Reiter-/Options-Handler (handleSettingsKey).
const NAV_MENU = {
  // Topbar oben rechts: Profil → Zahnrad → Anmelden → Power. ↓ führt immer
  // auf „Spielen". An den Rändern (links von Profil, rechts von Power) bleibt
  // der Fokus stehen (kein Eintrag).
  main_profile:  { right: 'main_settings', down: 'main_play' },
  main_settings: { left: 'main_profile',  right: 'main_account', down: 'main_play' },
  main_account:  { left: 'main_settings', right: 'main_power',   down: 'main_play' },
  main_power:    { left: 'main_account',   down: 'main_play' },
  // Hauptaktion „Spielen"
  main_play:     { up: 'main_settings', down: 'main_laserLines' },
  // Minigame-Karten: Laser Lines · Block Bomb · Sammel-Kachel „X weitere in
  // Arbeit". ↓ führt direkt zum Credits-Knopf — sonst wäre er nur per Tab
  // erreichbar (kleine, bewusste Abweichung von „bleibt stehen").
  main_laserLines: { up: 'main_play', right: 'main_blockBomb', down: 'main_credits' },
  main_blockBomb:  { up: 'main_play', left: 'main_laserLines', right: 'main_soonGames', down: 'main_credits' },
  main_soonGames:  { up: 'main_play', left: 'main_blockBomb',  down: 'main_credits' },
  // Credits-Knopf in der Fußzeile
  main_credits:    { up: 'main_soonGames' },
};

// Wird in buildLobbyNav() bei jedem renderLobby() neu erzeugt (dynamisch, weil
// die Karten je nach Slot-Typ unterschiedliche Knöpfe haben).
let lobbyNav = {};

// Aktive dynamische Tabelle (zurzeit nur die Lobby).
function getDynamicNav() {
  return document.getElementById('screen-lobby').classList.contains('active') ? lobbyNav : null;
}

// Ziel für (navId, Richtung): navId-String, Wert-Funktion oder undefined (=bleibt).
function navResolve(navId, dir) {
  const dyn = getDynamicNav();
  const table = (dyn && dyn[navId]) || NAV_MENU[navId];
  return table ? table[dir] : undefined;
}

// Element zu einer navId fokussieren (nur wenn sichtbar & aktiv). Gibt das
// Element zurück oder null.
function focusByNav(navId) {
  if (!navId) return null;
  const el = document.querySelector(`[data-nav="${navId}"]`);
  if (el && el.offsetParent !== null && !el.disabled) { el.focus(); return el; }
  return null;
}

// Zuletzt fokussiertes Hauptmenü-Element merken, damit man beim Zurückkehren
// (aus Einstellungen/Lobby/Credits) wieder dort landet. Start: „Spielen".
let menuFocusNav = 'main_play';

function goToMenu() {
  showScreen('screen-menu');
  if (!focusByNav(menuFocusNav)) focusByNav('main_play');
}

// Kleines Eingabe-Delay GEGEN gedrückt gehaltene Tasten: Eine bewusste
// Einzel-Eingabe (e.repeat == false) wird IMMER ausgeführt; nur die
// Auto-Wiederholung einer festgehaltenen Taste wird auf NAV_DELAY gedrosselt,
// damit der Fokus bei einem Tastendruck nicht gleich mehrere Felder weiter
// springt. Gibt true zurück, wenn diese (wiederholte) Bewegung übersprungen
// werden soll.
const NAV_DELAY = 90; // ms zwischen Auto-Wiederholungen
let lastNavTime = 0;
function navThrottled(e) {
  const now = Date.now();
  if (!e.repeat) { lastNavTime = now; return false; } // echte Eingabe → immer durch
  if (now - lastNavTime < NAV_DELAY) return true;     // gehaltene Taste → drosseln
  lastNavTime = now;
  return false;
}

function setupKeyboard() {
  // Zuletzt fokussiertes Hauptmenü-Element mitschreiben (für goToMenu()).
  document.getElementById('screen-menu').addEventListener('focusin', (e) => {
    const nav = e.target.dataset && e.target.dataset.nav;
    if (nav && nav.startsWith('main_')) menuFocusNav = nav;
  });

  document.addEventListener('keydown', (e) => {
    const quitOpen = !document.getElementById('quitOverlay').hidden;
    const isActive = (id) => document.getElementById(id).classList.contains('active');

    if (e.key === 'Escape') {
      // Minigame-Flow / Einladung haben Vorrang vor dem übrigen Esc-Verhalten.
      if (inviteOpen()) { declineInvite(); return; }                 // Einladung ablehnen
      if (mgVoteOpen()) { cancelMgFlow(); return; }                  // Voting → zurück (Lobby/Menü)
      if (mgRankingOpen()) { return; }                               // Ranking nur per Knopf
      if (mgResultOpen()) { return; }                                // Ergebnis nur per Knopf
      if (mgPauseOpen()) { resumeGame(); return; }                   // Pause → weiter
      if (isActive('screen-block-bomb') || isActive('screen-laser-lines')) { pauseGame(); return; } // im Spiel → Pause
      // Esc schließt erst offene Overlays (Beenden / Konto), sonst führt es
      // aus Einstellungen bzw. der Credits-Seite zurück ins Hauptmenü.
      if (quitOpen) closeQuitDialog();
      else if (accountOpen()) closeAccount();
      else if (lobbyPopupOpen()) { closeColorPicker(); closeSlotPicker(); }
      else if (isActive('screen-settings') || isActive('screen-credits') || isActive('screen-lobby')) {
        goToMenu();
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
    if (inviteOpen()) container = document.getElementById('inviteOverlay');
    else if (mgVoteOpen()) container = document.getElementById('mgMapVote');
    else if (mgPauseOpen()) container = document.getElementById('mgPause');
    else if (mgResultOpen()) container = document.getElementById('mgResult');
    else if (mgRankingOpen()) container = document.getElementById('mgRanking');
    else if (quitOpen) container = document.getElementById('quitOverlay');
    else if (accountOpen()) container = document.getElementById('accountOverlay');
    else if (colorPickerOpen()) container = document.getElementById('colorPicker');
    else if (slotPickerOpen()) container = document.getElementById('slotPicker');
    else if (isActive('screen-auth')) container = document.getElementById('screen-auth');
    else if (isActive('screen-settings')) container = document.getElementById('screen-settings');
    else if (isActive('screen-lobby')) container = document.getElementById('screen-lobby');
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

    // Feste navId-Navigation (Hauptmenü + Lobby) hat Vorrang vor der
    // geometrischen. Ein Element mit data-nav, für das eine Tabelle existiert,
    // wird vollständig hier geführt — fehlt für die Richtung ein Eintrag,
    // bleibt der Fokus stehen (springt nie ins Leere). Elemente OHNE data-nav
    // (Auth/Konto/Credits/Beenden/Popups) fallen weiter auf moveFocus zurück.
    const navId = e.target.dataset && e.target.dataset.nav;
    const dyn = getDynamicNav();
    if (navId && (NAV_MENU[navId] || (dyn && dyn[navId]))) {
      e.preventDefault();
      const target = navResolve(navId, dir);
      if (typeof target === 'function') {            // Wert verstellen (z.B. Bot-Grad)
        if (!navThrottled(e)) target(e.target);
      } else if (typeof target === 'string') {       // zu navId springen
        if (!navThrottled(e) && focusByNav(target)) Sfx.play('hover');
      }
      // target === undefined → Fokus bleibt stehen
      return;
    }

    // Auf Bedienelementen (Textfeld, Regler, Auswahl, Schalter) bleibt die
    // WAAGERECHTE Pfeilbewegung ihre native Aufgabe: Cursor im Text, Regler
    // verstellen, Auswahl wechseln. Hoch/Runter springt immer zwischen Zeilen.
    if ((dir === 'left' || dir === 'right') && e.target.matches('input, select, textarea')) return;

    e.preventDefault();
    if (!navThrottled(e)) moveFocus(container, dir);
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
//
// WICHTIG (deterministisch, kein 50/50): Es wird zuerst die NÄCHSTE Reihe bzw.
// Spalte in Pfeilrichtung gewählt (kleinstes `fwd` = Abstand IN Richtung), und
// erst innerhalb dieser „Bande" entscheidet die geringste seitliche Abweichung.
// Beispiel Hauptmenü: ↓ von den Buttons oben rechts landet zuverlässig auf dem
// breiten „Spielen"-Button (nächste Reihe) statt auf einer zufällig besser
// ausgerichteten Minigame-Karte zwei Reihen tiefer; ↓ vom „Spielen"-Button
// trifft immer dieselbe mittlere Karte (Gleichstand → DOM-Reihenfolge), ←/→
// die linke bzw. rechte Karte darunter.
function moveFocus(container, dir) {
  const items = [...container.querySelectorAll(FOCUSABLE)]
    .filter(el => el.offsetParent !== null || el === document.activeElement);
  if (!items.length) return;

  const current = document.activeElement;
  if (!items.includes(current)) { items[0].focus(); Sfx.play('hover'); return; }

  const c = current.getBoundingClientRect();
  const cx = c.left + c.width / 2;
  const cy = c.top + c.height / 2;
  const vertical = dir === 'up' || dir === 'down';

  // Alle Kandidaten in Pfeilrichtung mit Abstand (fwd) und seitlichem
  // Versatz (side) sammeln.
  const cands = [];
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
    cands.push({ el, fwd, side });
  });
  if (!cands.length) return;

  // Bande um die nächste Reihe/Spalte: Kandidaten, deren fwd nur wenig über dem
  // Minimum liegt (Toleranz ~ halbe Größe des aktuellen Elements). So gehören
  // alle Karten EINER Reihe zusammen, die nächste Reihe aber nicht mehr.
  const minFwd = Math.min(...cands.map(k => k.fwd));
  const tol = Math.max(12, (vertical ? c.height : c.width) * 0.5);
  const inBand = cands.filter(k => k.fwd <= minFwd + tol);

  // Innerhalb der Bande: geringster Seitenversatz, dann geringster Abstand,
  // dann DOM-Reihenfolge (stabiler Sort) → vollständig deterministisch.
  inBand.sort((a, b) => (a.side - b.side) || (a.fwd - b.fwd));

  inBand[0].el.focus();
  Sfx.play('hover');
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
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'minigame-card available';
    card.dataset.nav = game.nav; // feste Navigations-ID für die Tastatur
    card.style.setProperty('--card-i', i);
    card.innerHTML = `
      <span class="minigame-icon">${game.icon}</span>
      <h3>${game.name}</h3>
      <p>${game.desc}</p>
      <span class="badge">Spielen</span>
    `;
    card.addEventListener('click', () => game.start());
    grid.appendChild(card);
  });

  // EINE Sammel-Kachel für alle „Bald"-Spiele statt vier vollwertiger,
  // gleich gewichteter Karten (siehe /impeccable critique: 4 von 6 Karten
  // waren Sackgassen — bewusst kleiner/gedämpfter als die spielbaren Karten).
  const teaser = document.createElement('button');
  teaser.type = 'button';
  teaser.className = 'minigame-card minigame-teaser';
  teaser.dataset.nav = 'main_soonGames';
  teaser.style.setProperty('--card-i', MINIGAMES.length);
  teaser.innerHTML = `
    <span class="minigame-icon">${UPCOMING_MINIGAMES.map(g => g.icon).join('')}</span>
    <h3>${UPCOMING_MINIGAMES.length} weitere in Arbeit</h3>
    <p>${UPCOMING_MINIGAMES.map(g => g.name).join(' · ')}</p>
    <span class="badge">Bald</span>
  `;
  teaser.addEventListener('click', () => showToast('🛠️ Weitere Minigames sind in Arbeit — bald mehr!'));
  grid.appendChild(teaser);
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
  document.getElementById('btnCreditsBack').addEventListener('click', goToMenu);
  // Esc → zurück ins Menü übernimmt der zentrale Tastatur-Handler (setupKeyboard).
}

// ── Lobby (Vorbereitungsscreen vor einer Partie) ─────────────────────
// Geöffnet über den „Spielen"-Button. Vier Playercards: P1 ist IMMER man
// selbst (nicht entfernbar, nur Farbe änderbar), P2–P4 sind frei wählbar
// (Leer / Bot / Freund). Freunde nur angemeldet — jede Freundes-Funktion
// hängt an isOnlineAllowed(). Es ist eine rein LOKALE Konfiguration: kein
// echtes Spiel, keine neuen Supabase-Tabellen, keine Realtime-Lobby.

// Bot-Schwierigkeitsgrade (id = State-Wert, name = Anzeige). Bewusst nur
// MITTEL und SCHWER — leichte Bots gibt es absichtlich nicht (siehe ROADMAP/
// Doku: es soll immer mindestens mittlere und schwere Gegner geben). Default
// für neue Bots ist 'medium'. Die Bot-KI selbst kommt erst mit den Minigames;
// hier wird vorerst nur der gewählte Grad im lobbyState gehalten.
const BOT_DIFFICULTIES = [
  { id: 'medium', name: 'Mittel' },
  { id: 'hard',   name: 'Schwer' },
];
const difficultyName = (id) =>
  (BOT_DIFFICULTIES.find(d => d.id === id) || BOT_DIFFICULTIES[0]).name;

// Feste Farbpalette (id = State-Wert, var = CSS-Variable in style.css).
const LOBBY_COLORS = [
  { id: 'red',    name: 'Rot',    var: '--red'    },
  { id: 'blue',   name: 'Blau',   var: '--blue'   },
  { id: 'green',  name: 'Grün',   var: '--green'  },
  { id: 'yellow', name: 'Gelb',   var: '--yellow' },
  { id: 'purple', name: 'Lila',   var: '--purple' },
  { id: 'orange', name: 'Orange', var: '--orange' },
  { id: 'cyan',   name: 'Cyan',   var: '--cyan'   },
  { id: 'pink',   name: 'Pink',   var: '--pink'   },
];

// 300 lustige, kurze Party-Bot-Namen. Beim Erstellen eines Bots wird zufällig
// einer gewählt (getRandomBotName), innerhalb derselben Lobby möglichst ohne
// Dopplung.
const BOT_NAMES = [
  'Blocki','WürfelWilli','PixelPaul','TurboTom','Botbert','GlitchGustav','MegaMax','SuperSusi','RetroRudi','NeonNina',
  'DiscoDani','ZockerZoe','BlockBenno','WürfelWanda','TurboTina','GlitchGreta','MegaMia','RetroRobin','NeonNico','PixelPia',
  'ByteBert','ChipCharly','LagLena','PingPit','BugBruno','KnopfKalle','JoystickJonas','ArcadeArne','CoinCarlo','BomboBea',
  'FlipperFritz','PongPaula','BlobBob','GizmoGabi','RocketRolf','LaserLuis','CometCora','NovaNils','AstroAnna','CyberCem',
  'DataDavid','RoboRita','MechMarvin','NanoNele','QuantumQuirin','VoltViktor','AmpereAmy','JouleJojo','WattWalter','OhmOskar',
  'ZapZara','BoltBenny','SparkSina','FlashFynn','BlitzBjörn','ThunderThea','StormSteve','HagelHans','WolkeWim','RegenRosa',
  'SunnySandra','MondMona','SternStefan','GalaxyGabe','OrbitOtto','MeteorMila','PlanetPeer','RaketeRosa','SaturnSami','MarsMaja',
  'JellyJens','GummiGabi','BonbonBea','CandyCarl','LolliLena','ZuckerZeno','MarzipanMimi','KekseKlara','KuchenKurt','DonutDirk',
  'WaffelWim','MuffinMo','BrezelBea','PizzaPit','PommesPaul','BurgerBert','NudelNele','SuppeSusi','SalatSami','TacoTom',
  'KaffeeKai','TeeTina','KakaoKim','LimoLeo','SaftSven','ColaCora','EisEmil','SmoothieSophie','ShakeShawn','PunschPaula',
  'FuchsFelix','HaseHugo','BärBenno','WolfWalter','LöweLeo','TigerTom','PandaPia','KoalaKira','ZebraZoe','GiraffeGabi',
  'PinguPaul','RobbeRolf','WalWim','HaiHenry','KrakeKlara','QualleQuirin','KrabbeKira','SeesternSami','DelfinDani','OttoOtter',
  'IgelIda','MausMoritz','RatteRita','HamsterHans','EichiEmma','DachsDirk','BiberBert','MaulwurfMax','FrettiFynn','MurmelMia',
  'AdlerArne','EuleElla','FalkeFritz','RabeRudi','SpatzSina','MeiseMona','TaubeTilo','ReiherRosa','StorchSteve','SchwanSami',
  'DracheDirk','EinhornElla','GnomGustav','TrollThea','FeeFynn','ElfEmil','OgerOtto','ZwergZeno','RieseRolf','KoboldKim',
  'NinjaNils','PiratPit','RitterRudi','CowboyCarl','SamuraiSami','WikingerWim','GladiatorGabi','SpionSven','AgentArne','DetektivDani',
  'MagierMax','HexeHanna','ZaubererZeno','PriesterPit','SchamaneSami','OrakelOtto','SeherSina','MystikMia','RuneRosa','AmulettArne',
  'KapitänKalle','MatroseMo','SteuerSteve','AnkerAnni','MöweMona','LeuchtturmLeo','KompassClara','SegelSami','WelleWim','TiefseeTilo',
  'KönigKurt','PrinzPit','PrinzessinPia','HerzogHugo','GrafGustav','BaronBenno','RitterRosa','EdelmannEmil','HofnarrHans','BurgfräuleinBea',
  'RockerRudi','PunkPit','RapperRosa','DjDani','BassistBert','DrummerDirk','GitarreGabi','SängerSven','TänzerTom','BeatBenny',
  'MaestroMax','ViolaVivi','CelloClara','FlöteFynn','TrompeteTilo','PaukePaul','HarfeHanna','OboeOtto','KlavierKim','OrgelOlga',
  'SprinterSven','LäuferLeo','BoxerBert','TurnerTom','SchwimmerSami','RadlerRudi','KletterKira','SkaterSteve','SurferSophie','TaucherTilo',
  'TorwartTom','StürmerSven','LiberoLeo','KapitänKira','SchiriSami','FanFynn','TrainerTina','MaskottMax','PokalPit','MedailleMia',
  'ProfiPaul','RookieRosa','LegendeLeo','ChampionClara','MeisterMo','SiegerSami','UnderdogUwe','VeteranViktor','TalentTina','GenieGabi',
  'KaktusKalle','TulpeTina','RoseRosa','GänseblümGabi','SonnenblumeSami','FarnFynn','MoosMo','PilzPit','EfeuEmil','BambusBenno',
  'AhornArne','EicheEmma','BirkeBea','TanneTilo','PalmePia','KieferKurt','WeideWim','BucheBert','LindeLena','UlmeUwe',
  'RubinRudi','SaphirSami','SmaragdEmil','DiamantDani','PerlePia','GoldGustav','SilberSina','BronzeBenno','KristallKira','OpalOtto',
  'NebelNils','FrostFynn','TauTilo','ReifRosa','SchneeSven','GletscherGabi','LawineLeo','EiszapfenEmil','PolarPit','IglooIda',
  'VulkanViktor','LavaLena','MagmaMax','AscheAnni','KraterKira','GeysirGustav','QuelleQuirin','SchluchtSami','CanyonCarl','DüneDani',
  'KometKim','AsteroidArne','NebulaNele','PulsarPit','SupernovaSophie','KosmosKurt','GravitonGabi','PhotonPhil','NeutronNils','ProtonPaula',
];

// State: 4 Slots. Slot 1 (Index 0) ist immer man selbst.
const lobbyState = {
  slots: [
    { id: 1, type: 'self',  name: '', color: 'red',  userId: null, difficulty: null },
    { id: 2, type: 'empty', name: '', color: null,   userId: null, difficulty: null },
    { id: 3, type: 'empty', name: '', color: null,   userId: null, difficulty: null },
    { id: 4, type: 'empty', name: '', color: null,   userId: null, difficulty: null },
  ],
};

let pickerSlot = -1; // Slot, dessen Popup gerade offen ist (-1 = keins)

const colorById = (id) => LOBBY_COLORS.find(c => c.id === id) || null;
const isActiveSlot = (s) => s.type !== 'empty';
const slotPickerOpen  = () => !document.getElementById('slotPicker').hidden;
const colorPickerOpen = () => !document.getElementById('colorPicker').hidden;
const lobbyPopupOpen  = () => slotPickerOpen() || colorPickerOpen();

// Erste Palettenfarbe, die kein aktiver Slot belegt (exceptIdx ausgenommen).
function getNextFreeColor(exceptIdx = -1) {
  const used = new Set(
    lobbyState.slots
      .filter((s, i) => i !== exceptIdx && isActiveSlot(s) && s.color)
      .map(s => s.color)
  );
  const free = LOBBY_COLORS.find(c => !used.has(c.id));
  return free ? free.id : null;
}

// ZUFÄLLIGE freie Farbe — für Bots: ihre Farbe ist nicht einstellbar, sondern
// immer zufällig. Bevorzugt eine von keinem aktiven Slot belegte Farbe; ist
// keine mehr frei, wenigstens eine, die kein MENSCH (self/friend) hat; sonst
// irgendeine. So kollidieren Bots nicht mit den fest gewählten Spielerfarben.
function getRandomFreeColor(exceptIdx = -1) {
  const usedByActive = new Set(
    lobbyState.slots
      .filter((s, i) => i !== exceptIdx && isActiveSlot(s) && s.color)
      .map(s => s.color)
  );
  let pool = LOBBY_COLORS.filter(c => !usedByActive.has(c.id));
  if (!pool.length) {
    const usedByHuman = new Set(
      lobbyState.slots
        .filter((s, i) => i !== exceptIdx && (s.type === 'self' || s.type === 'friend') && s.color)
        .map(s => s.color)
    );
    pool = LOBBY_COLORS.filter(c => !usedByHuman.has(c.id));
  }
  if (!pool.length) pool = LOBBY_COLORS;
  return pool[Math.floor(Math.random() * pool.length)].id;
}

// Zufälliger Bot-Name, in der aktuellen Lobby möglichst ohne Dopplung.
function getRandomBotName() {
  const taken = new Set(lobbyState.slots.filter(s => s.type === 'bot').map(s => s.name));
  for (let i = 0; i < 40; i++) {
    const n = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    if (!taken.has(n)) return n;
  }
  return BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
}

// Lobby öffnen: Slot 1 mit dem aktuellen Spieler (bzw. „Gast") füllen.
function openLobby() {
  const self = lobbyState.slots[0];
  self.type = 'self';
  self.name = Auth.user ? Auth.username : 'Gast';
  self.userId = Auth.userId;
  if (!self.color) self.color = getNextFreeColor(0) || 'red';
  renderLobby();
  showScreen('screen-lobby');
  // Start-Fokus laut Vorgabe: P1 → Farbe.
  if (!focusByNav('lobby_p1_color')) focusSlotCard(0);
}

// Hilfs-Button für die Karten-Aktionen. `nav` = feste Navigations-ID (data-nav).
function miniBtn(text, onClick, nav) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'lobby-mini-btn';
  b.textContent = text;
  if (nav) b.dataset.nav = nav;
  b.addEventListener('click', onClick);
  return b;
}

// Baut die vier Playercards aus dem lobbyState neu auf. Namen kommen per
// textContent in die Karte (Freund-Usernamen sind nicht vertrauenswürdig).
function renderLobby() {
  const wrap = document.getElementById('lobbyCards');
  wrap.innerHTML = '';
  lobbyState.slots.forEach((slot, i) => {
    const col = colorById(slot.color);
    const card = document.createElement('div');
    card.className = 'lobby-card';
    card.style.setProperty('--card-i', i);
    if (col) card.style.setProperty('--slot', `var(${col.var})`);
    card.classList.toggle('is-active', isActiveSlot(slot));
    card.classList.toggle('is-empty', slot.type === 'empty');
    card.classList.toggle('is-self', slot.type === 'self');

    const no = document.createElement('span');
    no.className = 'lobby-slot-no';
    no.textContent = `P${slot.id}`;

    const av = document.createElement('span');
    av.className = 'lobby-avatar';
    if (slot.type === 'bot') av.textContent = '🤖';
    else if (slot.type === 'empty') av.textContent = '+';
    else av.textContent = (slot.name || '?').charAt(0).toUpperCase();

    const nm = document.createElement('span');
    nm.className = 'lobby-name';
    nm.textContent = slot.type === 'empty' ? 'Frei' : slot.name;

    const st = document.createElement('span');
    st.className = 'lobby-status';
    // Bots zeigen ihren Schwierigkeitsgrad direkt im Status-Badge an.
    st.textContent = slot.type === 'bot'
      ? `Bot · ${difficultyName(slot.difficulty)}`
      : { self: 'Du', friend: 'Freund', empty: 'Leer' }[slot.type];

    // navId-Präfix der Karte: lobby_p1 … lobby_p4 (feste Tastatur-Navigation).
    const p = `lobby_p${slot.id}`;
    const actions = document.createElement('div');
    actions.className = 'lobby-card-actions';
    if (slot.type === 'empty') {
      actions.appendChild(miniBtn('+ Platz wählen', () => openSlotPicker(i), `${p}_choose`));
    } else {
      if (slot.type !== 'self') actions.appendChild(miniBtn('Ändern', () => openSlotPicker(i), `${p}_change`));
      if (slot.type === 'bot') {
        actions.appendChild(miniBtn('🎲 Neuer Name', () => {
          lobbyState.slots[i].name = getRandomBotName();
          renderLobby();
          focusSlotCard(i);
        }, `${p}_newName`));
        // Bots bekommen KEINE Farbwahl (Farbe ist immer zufällig) — stattdessen
        // ist die Schwierigkeit einstellbar (Mittel ↔ Schwer).
        actions.appendChild(miniBtn(`⚙️ ${difficultyName(slot.difficulty)}`, () => cycleBotDifficulty(i), `${p}_difficulty`));
      } else {
        // self / friend (Menschen) → Farbe frei wählbar
        const cbtn = document.createElement('button');
        cbtn.type = 'button';
        cbtn.className = 'lobby-mini-btn';
        cbtn.dataset.nav = `${p}_color`;
        cbtn.innerHTML = '<span class="lobby-color-dot"></span>Farbe';
        cbtn.addEventListener('click', () => openColorPicker(i));
        actions.appendChild(cbtn);
      }
    }

    card.append(no, av, nm, st, actions);

    // Krone des letzten Gesamtsiegers der Serie (verschwindet bei Reset bzw.
    // wenn der Slot frei wird).
    if (lobbyCrownSlotId === slot.id && slot.type !== 'empty') {
      const crown = document.createElement('span');
      crown.className = 'lobby-crown';
      crown.textContent = '👑';
      crown.title = 'Letzter Gesamtsieger';
      card.appendChild(crown);
    }

    wrap.appendChild(card);
  });
  // Krone löschen, falls ihr Slot inzwischen leer ist.
  const crownSlot = lobbyState.slots.find(s => s.id === lobbyCrownSlotId);
  if (lobbyCrownSlotId != null && (!crownSlot || crownSlot.type === 'empty')) lobbyCrownSlotId = null;
  buildLobbyNav(); // Navigations-Tabelle passend zu den aktuellen Karten neu bauen
}

// Baut die dynamische Navigations-Tabelle der Lobby aus den gerade
// gerenderten Karten. Pro Karte stapeln sich die Knöpfe senkrecht (↑/↓ wechselt
// innerhalb der Karte); ←/→ springt zur Nachbarkarte (jeweils deren oberster
// Knopf). Am unteren Ende einer Karte führt ↓ in die Fußzeile, deren Knopf
// unter der jeweiligen Spalte „endet". Der Bot-Grad-Knopf verstellt mit ←/→
// die Schwierigkeit statt zu navigieren.
function buildLobbyNav() {
  const map = {};
  const cards = [...document.querySelectorAll('#lobbyCards .lobby-card')];
  const btns = cards.map(card =>
    [...card.querySelectorAll('.lobby-mini-btn')].map(b => b.dataset.nav).filter(Boolean)
  );
  const top  = (ci) => btns[ci] && btns[ci][0];
  const last = (ci) => btns[ci] && btns[ci][btns[ci].length - 1];
  // Welcher Fußzeilen-Knopf liegt „unter" Spalte 0…3:
  const footerDown = ['lobby_back', 'lobby_reset', 'lobby_start', 'lobby_start'];

  btns.forEach((list, ci) => {
    list.forEach((nav, bi) => {
      const entry = {};
      if (bi > 0) entry.up = list[bi - 1];                 // oberster Knopf → bleibt
      entry.down = bi < list.length - 1 ? list[bi + 1] : footerDown[ci];
      if (ci > 0) entry.left = top(ci - 1);                // sonst (Spalte 0) → bleibt
      if (ci < 3) entry.right = top(ci + 1);              // sonst (Spalte 3) → bleibt
      // Schwierigkeit: ←/→ verstellt den Grad (kein Karten-Wechsel).
      if (nav.endsWith('_difficulty')) {
        entry.left  = () => adjustBotDifficulty(ci, -1);
        entry.right = () => adjustBotDifficulty(ci, +1);
      }
      map[nav] = entry;
    });
  });

  // Fußzeile: ↑ führt zum untersten Knopf der zugehörigen Spalte.
  map.lobby_back  = { up: last(0), right: 'lobby_reset' };
  map.lobby_reset = { up: last(1), left: 'lobby_back', right: 'lobby_start' };
  map.lobby_start = { up: last(2), left: 'lobby_reset' };

  lobbyNav = map;
}

// Fokus zurück auf den ersten Button der Karte i (nach Popup/Re-Render).
function focusSlotCard(i) {
  if (i < 0) return;
  const card = document.querySelectorAll('#lobbyCards .lobby-card')[i];
  const btn = card && card.querySelector('.lobby-mini-btn');
  if (btn) btn.focus();
}

// Slots 2–4 zurück auf „Leer" (Slot 1 bleibt). Farben fallen frei.
function resetLobby() {
  lobbyState.slots.forEach((s, i) => {
    if (i === 0) return;
    s.type = 'empty'; s.name = ''; s.color = null; s.userId = null; s.difficulty = null;
  });
  lobbyCrownSlotId = null; // Krone des letzten Gesamtsiegers entfernen
  renderLobby();
  focusSlotCard(0);
}

// ── Platz-Popup (Leer / Bot / Freund) ───────────────────────────────────
// Positioniert das Popup über der jeweiligen Playercard und hält es im
// Sichtbereich. Vorher sichtbar machen, damit offsetWidth/Height stimmen.
function positionPopup(popupCard, slotIdx) {
  const card = document.querySelectorAll('#lobbyCards .lobby-card')[slotIdx];
  if (!card) return;
  const r = card.getBoundingClientRect();
  const pw = popupCard.offsetWidth;
  const ph = popupCard.offsetHeight;
  let left = r.left + r.width / 2 - pw / 2;
  let top = r.top + 14; // leicht überlappend auf der Karte
  left = Math.max(12, Math.min(left, window.innerWidth - pw - 12));
  top = Math.max(12, Math.min(top, window.innerHeight - ph - 12));
  popupCard.style.left = `${left}px`;
  popupCard.style.top = `${top}px`;
}

function openSlotPicker(i) {
  pickerSlot = i;
  document.getElementById('slotPicker').hidden = false;
  showSlotOptions(i);
  Sfx.play('tab');
}

// Die drei Grund-Optionen (auch nach „Zurück" aus der Freundesliste).
function showSlotOptions(i) {
  document.getElementById('slotPickerTitle').textContent = `Platz P${i + 1}`;
  const body = document.getElementById('slotPickerBody');
  body.innerHTML = '';
  body.appendChild(slotOpt('🚫 Leer lassen', '', () => { setSlotEmpty(i); closeSlotPicker(); }));
  body.appendChild(slotOpt('🤖 Bot hinzufügen', 'Zufälliger Gegner', () => { setSlotBot(i); closeSlotPicker(); }));
  body.appendChild(slotOpt(
    '👥 Freund auswählen',
    isOnlineAllowed() ? 'Aus deiner Freundesliste' : 'Nur angemeldet',
    () => {
      if (!isOnlineAllowed()) { showToast('Melde dich an, um Freunde einzuladen.'); return; }
      openFriendPicker(i);
    }
  ));
  positionPopup(document.getElementById('slotPickerCard'), i);
  const first = body.querySelector('button');
  if (first) first.focus();
}

function slotOpt(label, sub, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'lobby-opt';
  if (sub) {
    b.textContent = label;
    const s = document.createElement('small');
    s.textContent = sub;
    b.appendChild(s);
  } else {
    b.textContent = label;
  }
  b.addEventListener('click', onClick);
  return b;
}

// Freundesliste im selben Popup. Nur akzeptierte Freunde; bereits in einem
// anderen Slot belegte Freunde sind deaktiviert (Doppelauswahl verhindern).
async function openFriendPicker(i) {
  const titleEl = document.getElementById('slotPickerTitle');
  const body = document.getElementById('slotPickerBody');
  titleEl.textContent = 'Freund wählen';
  body.innerHTML = '<p class="lobby-empty-msg">Lade Freunde …</p>';
  positionPopup(document.getElementById('slotPickerCard'), i);

  const { friends } = await Auth.getFriendOverview();
  // Popup könnte inzwischen geschlossen / der Slot gewechselt sein.
  if (pickerSlot !== i || document.getElementById('slotPicker').hidden) return;

  body.innerHTML = '';
  body.appendChild(slotOpt('← Zurück', '', () => showSlotOptions(i)));

  if (!friends.length) {
    const msg = document.createElement('p');
    msg.className = 'lobby-empty-msg';
    msg.textContent = 'Noch keine Freunde gefunden.';
    body.appendChild(msg);
  } else {
    const usedIds = new Set(
      lobbyState.slots.filter(s => s.type === 'friend' && s.userId).map(s => s.userId)
    );
    friends.forEach(f => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'lobby-opt';
      const already = usedIds.has(f.userId);
      b.textContent = '👤 ' + f.username;
      if (already) {
        b.disabled = true;
        const s = document.createElement('small');
        s.textContent = '✓ schon in der Lobby';
        b.appendChild(s);
      } else {
        b.addEventListener('click', () => { setSlotFriend(i, f); closeSlotPicker(); });
      }
      body.appendChild(b);
    });
  }
  positionPopup(document.getElementById('slotPickerCard'), i);
  const first = body.querySelector('button:not([disabled])');
  if (first) first.focus();
}

function closeSlotPicker() {
  const popup = document.getElementById('slotPicker');
  if (popup.hidden) return;
  popup.hidden = true;
  focusSlotCard(pickerSlot);
  pickerSlot = -1;
}

function setSlotEmpty(i) {
  const s = lobbyState.slots[i];
  s.type = 'empty'; s.name = ''; s.color = null; s.userId = null; s.difficulty = null;
  renderLobby();
}

function setSlotBot(i) {
  const s = lobbyState.slots[i];
  s.type = 'bot'; s.userId = null; s.name = getRandomBotName();
  if (!s.difficulty) s.difficulty = 'medium';
  // Bot-Farbe ist nicht wählbar → immer zufällig (kollidiert nicht mit Menschen).
  s.color = getRandomFreeColor(i);
  renderLobby();
}

// Schwierigkeit eines Bots umschalten (Mittel ↔ Schwer, zyklisch). Für Klick/
// Enter/Leertaste auf dem ⚙️-Knopf. Der Fokus bleibt danach auf dem Grad-Knopf.
function cycleBotDifficulty(i) {
  const s = lobbyState.slots[i];
  if (s.type !== 'bot') return;
  const order = BOT_DIFFICULTIES.map(d => d.id);
  s.difficulty = order[(order.indexOf(s.difficulty) + 1) % order.length];
  renderLobby();
  if (!focusByNav(`lobby_p${s.id}_difficulty`)) focusSlotCard(i);
  Sfx.play('tab');
}

// Schwierigkeit per ←/→ verstellen (delta -1/+1), OHNE Umlauf — am Rand bleibt
// der Grad stehen (es gibt bewusst nur Mittel/Schwer, kein „Leicht").
function adjustBotDifficulty(i, delta) {
  const s = lobbyState.slots[i];
  if (s.type !== 'bot') return;
  const order = BOT_DIFFICULTIES.map(d => d.id);
  const idx = order.indexOf(s.difficulty);
  const next = Math.min(order.length - 1, Math.max(0, idx + delta));
  if (next === idx) return; // am Rand → bleibt
  s.difficulty = order[next];
  renderLobby();
  if (!focusByNav(`lobby_p${s.id}_difficulty`)) focusSlotCard(i);
  Sfx.play('tab');
}

function setSlotFriend(i, friend) {
  const s = lobbyState.slots[i];
  s.type = 'friend'; s.userId = friend.userId; s.name = friend.username;
  if (!s.color) s.color = getNextFreeColor(i);
  renderLobby();
}

// ── Farb-Popup ───────────────────────────────────────────────────────────
function openColorPicker(i) {
  pickerSlot = i;
  document.getElementById('colorPicker').hidden = false;
  renderColorCells(i);
  positionPopup(document.getElementById('colorPickerCard'), i);
  const cur = document.querySelector('#colorPickerBody .is-current')
    || document.querySelector('#colorPickerBody button:not([disabled])');
  if (cur) cur.focus();
  Sfx.play('tab');
}

function renderColorCells(i) {
  const slot = lobbyState.slots[i];
  const body = document.getElementById('colorPickerBody');
  body.innerHTML = '';
  // Von MENSCHEN (self/friend) belegte Farben sind für andere gesperrt (X).
  const humanColors = new Set(
    lobbyState.slots
      .filter((s, idx) => idx !== i && (s.type === 'self' || s.type === 'friend') && s.color)
      .map(s => s.color)
  );
  LOBBY_COLORS.forEach(c => {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'color-cell';
    cell.style.setProperty('--cc', `var(${c.var})`);
    if (humanColors.has(c.id)) { cell.classList.add('is-locked'); cell.disabled = true; }
    if (slot.color === c.id) cell.classList.add('is-current');
    cell.innerHTML = '<span class="color-swatch"></span>';
    const label = document.createElement('span');
    label.className = 'color-name';
    label.textContent = c.name;
    cell.appendChild(label);
    cell.addEventListener('click', () => { setSlotColor(i, c.id); closeColorPicker(); });
    body.appendChild(cell);
  });
}

function closeColorPicker() {
  const popup = document.getElementById('colorPicker');
  if (popup.hidden) return;
  popup.hidden = true;
  focusSlotCard(pickerSlot);
  pickerSlot = -1;
}

// Farbe setzen + Konflikte auflösen. Menschlich belegte Farben sind im Picker
// gesperrt; falls trotzdem aufgerufen, abbrechen mit Hinweis.
function setSlotColor(i, colorId) {
  const humanConflict = lobbyState.slots.some((s, idx) =>
    idx !== i && (s.type === 'self' || s.type === 'friend') && s.color === colorId);
  if (humanConflict) { showToast('Diese Farbe ist schon vergeben.'); return; }
  lobbyState.slots[i].color = colorId;
  resolveColorConflicts(i, colorId);
  renderLobby();
}

// Bots, die jetzt dieselbe Farbe wie Slot i hätten, weichen auf die nächste
// freie Farbe aus (mehrere Bots ohne Dopplung, da getNextFreeColor jeweils
// den aktuellen Stand liest). Keine freie Farbe mehr → Hinweis-Toast.
function resolveColorConflicts(changedIdx, colorId) {
  lobbyState.slots.forEach((s, idx) => {
    if (idx === changedIdx) return;
    if (s.type === 'bot' && s.color === colorId) {
      // Bot weicht auf eine zufällige freie Farbe aus (Bot-Farben sind zufällig).
      const free = getRandomFreeColor(idx);
      if (free) s.color = free;
      else { s.color = null; showToast('Keine freie Farbe verfügbar.'); }
    }
  });
}

function setupLobby() {
  document.getElementById('btnLobbyBack').addEventListener('click', goToMenu);
  document.getElementById('btnLobbyReset').addEventListener('click', () => {
    resetLobby();
    showToast('Lobby zurückgesetzt.');
  });
  document.getElementById('btnLobbyStart').addEventListener('click', () => {
    // „Spiel starten" startet die Party-Serie: ALLE verfügbaren Minigames in
    // zufälliger Reihenfolge, danach Gesamt-Ranking, dann Krone in der Lobby.
    startSeries();
  });
  // Klick auf den abgedunkelten Backdrop schließt das jeweilige Popup.
  document.getElementById('slotPicker').addEventListener('click', (e) => {
    if (e.target.id === 'slotPicker') closeSlotPicker();
  });
  document.getElementById('colorPicker').addEventListener('click', (e) => {
    if (e.target.id === 'colorPicker') closeColorPicker();
  });
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
      showToast(error ? translateError(error, 'Anfrage fehlgeschlagen.') : 'Anfrage gesendet! 🎉');
      Sfx.play(error ? 'error' : 'success');
      const box = document.getElementById('friendResults');
      box.hidden = true;
      box.innerHTML = '';
      document.getElementById('friendSearch').value = '';
      loadFriends();
    } else if (btn.dataset.accept) {
      const { error } = await Auth.acceptFriendRequest(btn.dataset.accept);
      if (error) { showToast(translateError(error, 'Fehlgeschlagen.')); btn.disabled = false; }
      else { Sfx.play('success'); loadFriends(); }
    } else if (btn.dataset.remove) {
      const { error } = await Auth.removeFriend(btn.dataset.remove);
      if (error) { showToast(translateError(error, 'Fehlgeschlagen.')); btn.disabled = false; }
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
    if (error) return { ok: false, msg: translateError(error, 'Name konnte nicht geändert werden.') };
    return { ok: true, msg: 'Name aktualisiert.' };
  });

  wire('formEmail', async () => {
    const { error } = await Auth.updateContactEmail(document.getElementById('accMail').value);
    if (error) return { ok: false, msg: translateError(error, 'E-Mail konnte nicht geändert werden.') };
    return { ok: true, msg: 'E-Mail gespeichert.' };
  });

  wire('formPw', async () => {
    const input = document.getElementById('accPw');
    const { error } = await Auth.updatePassword(input.value);
    if (error) return { ok: false, msg: translateError(error, 'Passwort konnte nicht geändert werden.') };
    input.value = '';
    return { ok: true, msg: 'Passwort geändert.' };
  });
}

// ══ Block Bomb — Ablauf (Map-Voting → Countdown → Runde → Ergebnis) ══════
//
// Der eigentliche 3D-Spielkern lebt im ES-Modul renderer/block-bomb/main.js
// und registriert window.BlockBomb. Dieser Abschnitt steuert nur den DROM-
// HERUM: Map-Auswahl, Countdown, Pause/Ergebnis-Overlays und die Einladung.
// Er reicht dem Spielkern eine ENTKOPPELTE matchConfig (kein Lobby-Zugriff im
// Spiel) — derselbe Einstieg trägt später Online-Lobbys.

// Map-Metadaten für die Voting-Ansicht (Geometrie liegt in maps.js).
const BOMB_MAP_META = [
  { id: 'arena',   name: 'Bomb Arena',    desc: 'Runde Arena mit leuchtendem Rand und Säulen zum Ausweichen.' },
  { id: 'sky',     name: 'Sky Platforms', desc: 'Schwebende Plattformen über dem Abgrund — Vorsicht am Rand!' },
  { id: 'factory', name: 'Factory Panic', desc: 'Förderbänder, Kisten und blinkende Warnlichter.' },
];

// Map-Metadaten von Laser Lines (Geometrie liegt in laser-lines/maps.js).
const LASER_MAP_META = [
  { id: 'spin', name: 'Spin Arena',   desc: 'Runde Arena — rotierende Laser werden immer schneller.' },
  { id: 'grid', name: 'Factory Grid', desc: 'Laser fahren nach kurzer Warnlinie quer durch. Kisten als Deckung.' },
  { id: 'sky',  name: 'Sky Warning',  desc: 'Warnfelder, dann Laser — nicht von den Plattformen fallen!' },
];

// Minigame-Registry: bindet jedes spielbare Minigame entkoppelt an den
// generischen Match-Flow. windowKey = globales Spiel-Objekt (window.BlockBomb /
// window.LaserLines, beide mit start/pause/resume/stop/isRunning), mapMeta =
// Maps fürs Voting, screenId/stageId = Vollbild-Spielscreen + Canvas-Host.
const GAME_REGISTRY = {
  'block-bomb': { id: 'block-bomb', name: 'Block Bomb', windowKey: 'BlockBomb',
                  mapMeta: BOMB_MAP_META, screenId: 'screen-block-bomb', stageId: 'bombStage' },
  'laser-lines': { id: 'laser-lines', name: 'Laser Lines', windowKey: 'LaserLines',
                   mapMeta: LASER_MAP_META, screenId: 'screen-laser-lines', stageId: 'laserStage' },
};
// Alle spielbaren Spiele (für den Serien-Modus), in der MINIGAMES-Reihenfolge.
function availableGames() {
  return MINIGAMES.filter(g => g.available && GAME_REGISTRY[g.id]).map(g => GAME_REGISTRY[g.id]);
}
function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// CSS-Variable einer Lobby-Farbe → echter Hex-Wert (bleibt synchron zum Theme).
function colorHex(id) {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--' + (id || 'cyan')).trim();
  return v || '#36d6e7';
}

// lobbyState.slots → entkoppelte Spielerliste fürs Minigame. WICHTIG: Die in
// der Lobby gewählten Farben werden hier zur echten Spielerfarbe im Spiel
// (gilt für ALLE Minigames). „friend" = (späterer) Online-Spieler → remote.
function buildMatchConfig() {
  return lobbyState.slots.filter(isActiveSlot).map(s => ({
    id: s.id,
    name: s.name || ('P' + s.id),
    colorId: s.color,
    colorHex: colorHex(s.color),
    type: s.type === 'self' ? 'human' : s.type === 'friend' ? 'remote' : 'bot',
    difficulty: s.difficulty || 'medium',
    isLocal: s.type === 'self',
  }));
}

// Overlay-Status-Helfer (für setupKeyboard).
const inviteOpen     = () => !document.getElementById('inviteOverlay').hidden;
const mgVoteOpen     = () => !document.getElementById('mgMapVote').hidden;
const mgPauseOpen    = () => !document.getElementById('mgPause').hidden;
const mgResultOpen   = () => !document.getElementById('mgResult').hidden;
const mgRankingOpen  = () => !document.getElementById('mgRanking').hidden;

// ── Zustand des generischen Match-Flows ───────────────────────────────────
let currentGame = null;     // Registry-Eintrag des gerade laufenden Spiels
let currentPlayers = [];    // entkoppelte Spielerliste (aus Lobby oder Tutorial)
let currentMapId = null;
let voteLocked = false;
// true = einzelne Tutorial-Runde aus dem „Games"-Bereich (kein Serien-Ranking).
let isTutorial = false;
// Serien-/Party-Modus
let inSeries = false;
let seriesQueue = [];       // [Registry-Einträge] in zufälliger Reihenfolge
let seriesIndex = 0;
let seriesStandings = {};   // playerId → { id, name, colorHex, points }
let lastGameResult = null;  // letztes Spielergebnis (für Gleichstand-Tiebreak)
let lobbyCrownSlotId = null; // Slot-Id des letzten Gesamtsiegers (Lobby-Krone)

// ── Serien-/Party-Modus (Einstieg aus der Lobby) ──────────────────────────
// „Spiel starten" spielt ALLE verfügbaren Minigames in zufälliger Reihenfolge
// hintereinander, wertet platzierungsbasiert über alle Spiele und zeigt am
// Ende ein Gesamt-Ranking. Der Gesamtsieger bekommt danach die Lobby-Krone.
function startSeries() {
  currentPlayers = buildMatchConfig();
  if (currentPlayers.length < 2) {
    showToast('Mindestens 2 Spieler — füge Bots hinzu.');
    flashInvalid(document.getElementById('btnLobbyStart'));
    return;
  }
  const games = availableGames();
  if (!games.length) { showToast('Kein Minigame verfügbar.'); return; }
  isTutorial = false;
  inSeries = true;
  seriesQueue = shuffled(games);
  seriesIndex = 0;
  seriesStandings = {};
  for (const p of currentPlayers) {
    seriesStandings[p.id] = { id: p.id, name: p.name, colorHex: p.colorHex, points: 0 };
  }
  startSeriesGame();
}

function startSeriesGame() {
  currentGame = seriesQueue[seriesIndex];
  if (!window[currentGame.windowKey]) { showToast(currentGame.name + ' lädt noch — gleich nochmal.'); return; }
  openMapVote();
}

// ── Tutorial-Schnellstart (aus dem „Games"-Bereich des Hauptmenüs) ────────
// Klick auf eine Minigame-Karte startet DIESES Spiel als Tutorial: SOFORT eine
// einzelne Runde — ohne Lobby, ohne Bot-Auswahl, ohne Map-Voting, ohne Serien-
// Ranking. Es spielen IMMER 3 Bots auf dem EINFACHSTEN Grad ('easy'), die Map
// wird zufällig gewählt. Bewusste Ausnahme zur Bot-Regel „immer Mittel/Schwer":
// im Tutorial soll man das Spiel in Ruhe gegen schwache Gegner lernen können.
const TUTORIAL_BOT_COUNT = 3;
const TUTORIAL_DIFFICULTY = 'easy';

function startTutorial(gameId) {
  const game = GAME_REGISTRY[gameId];
  if (!game) return;
  if (!window[game.windowKey]) { showToast(game.name + ' lädt noch — gleich nochmal.'); return; }
  isTutorial = true;
  inSeries = false;
  currentGame = game;
  currentPlayers = buildTutorialPlayers();
  currentMapId = game.mapMeta[Math.floor(Math.random() * game.mapMeta.length)].id;
  runCountdown(); // direkt in den Countdown — kein Voting
}

// Baut die Spielerliste fürs Tutorial: man selbst + 3 Bots. Farben werden
// (auch die eigene) zufällig und ohne Dopplung vergeben, Bot-Namen ebenso.
// Liefert dasselbe Format wie buildMatchConfig().
function buildTutorialPlayers() {
  const usedColors = new Set();
  const pickColor = () => {
    const pool = LOBBY_COLORS.filter(c => !usedColors.has(c.id));
    const src = pool.length ? pool : LOBBY_COLORS;
    const c = src[Math.floor(Math.random() * src.length)];
    usedColors.add(c.id);
    return c.id;
  };
  const usedNames = new Set();
  const pickBotName = () => {
    for (let i = 0; i < 40; i++) {
      const n = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
      if (!usedNames.has(n)) { usedNames.add(n); return n; }
    }
    return BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
  };

  const selfColor = pickColor();
  const players = [{
    id: 1,
    name: Auth.user ? Auth.username : 'Gast',
    colorId: selfColor,
    colorHex: colorHex(selfColor),
    type: 'human',
    difficulty: 'medium',
    isLocal: true,
  }];
  for (let i = 0; i < TUTORIAL_BOT_COUNT; i++) {
    const colorId = pickColor();
    players.push({
      id: i + 2,
      name: pickBotName(),
      colorId,
      colorHex: colorHex(colorId),
      type: 'bot',
      difficulty: TUTORIAL_DIFFICULTY,
      isLocal: false,
    });
  }
  return players;
}

// Kleiner HTML-Escaper für Namen (Freund-/Self-Usernamen sind nicht
// vertrauenswürdig) — fürs Ranking, das per innerHTML gebaut wird.
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Map-Voting (generisch, für currentGame) ───────────────────────────────
function openMapVote() {
  voteLocked = false;
  const grid = document.getElementById('mgMapGrid');
  grid.innerHTML = '';
  currentGame.mapMeta.forEach((m) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'mg-map-card';
    card.dataset.map = m.id;
    card.innerHTML = `
      <div class="mg-map-thumb mg-thumb-${currentGame.id}-${m.id}"></div>
      <h3>${escapeHtml(m.name)}</h3>
      <p>${escapeHtml(m.desc)}</p>
      <div class="mg-map-votes" data-votes="${m.id}"></div>`;
    card.addEventListener('click', () => castMapVote(m.id));
    grid.appendChild(card);
  });
  document.getElementById('mgVoteSub').textContent =
    currentPlayers.length > 1 ? 'Wähle deine Map — die Bots stimmen mit ab.' : 'Wähle deine Map.';
  const prog = document.getElementById('mgVoteProgress');
  if (prog) prog.textContent = inSeries
    ? `Spiel ${seriesIndex + 1}/${seriesQueue.length}: ${currentGame.name}`
    : currentGame.name;
  document.getElementById('mgMapVote').hidden = false;
  const first = grid.querySelector('.mg-map-card');
  if (first) first.focus();
}

// Der lokale Mensch wählt; Bots (+ vorerst Remote) wählen zufällig; Mehrheit
// gewinnt, Gleichstand → zufällig unter den Bestplatzierten.
function castMapVote(humanChoice) {
  if (voteLocked) return;
  voteLocked = true;
  const meta = currentGame.mapMeta;

  const tally = {}; // mapId → Liste der Wähler-Farben (für die Punkte-Anzeige)
  for (const p of currentPlayers) {
    const choice = p.type === 'human'
      ? humanChoice
      : meta[Math.floor(Math.random() * meta.length)].id;
    (tally[choice] || (tally[choice] = [])).push(p.colorHex);
  }
  for (const m of meta) {
    const box = document.querySelector(`[data-votes="${m.id}"]`);
    const voters = tally[m.id] || [];
    box.innerHTML = voters.map(c => `<span class="mg-vote-dot" style="--c:${c}"></span>`).join('');
  }
  let max = 0;
  for (const k in tally) max = Math.max(max, tally[k].length);
  const winners = Object.keys(tally).filter(k => tally[k].length === max);
  currentMapId = winners[Math.floor(Math.random() * winners.length)];

  const winCard = document.querySelector(`.mg-map-card[data-map="${currentMapId}"]`);
  if (winCard) winCard.classList.add('selected');
  Sfx.play('success');

  setTimeout(() => {
    document.getElementById('mgMapVote').hidden = true;
    runCountdown();
  }, 1300);
}

// Esc im Map-Voting/Countdown: Serie abbrechen → Lobby, sonst Tutorial → Menü.
function cancelMgFlow() {
  document.getElementById('mgMapVote').hidden = true;
  document.getElementById('mgCountdown').hidden = true;
  if (inSeries) { inSeries = false; showScreen('screen-lobby'); focusByNav('lobby_start'); }
  else goToMenu();
}

// ── 3 · 2 · 1 · GO! ──────────────────────────────────────────────────────
function runCountdown() {
  const overlay = document.getElementById('mgCountdown');
  const el = document.getElementById('mgCountNum');
  overlay.hidden = false;
  const seq = ['3', '2', '1', 'GO!'];
  let i = 0;
  (function tick() {
    el.textContent = seq[i];
    el.classList.remove('pop', 'go'); void el.offsetWidth; el.classList.add('pop');
    if (seq[i] === 'GO!') { el.classList.add('go'); Sfx.play('go'); }
    else Sfx.play('count');
    i++;
    if (i < seq.length) setTimeout(tick, 800);
    else setTimeout(() => { overlay.hidden = true; startRound(); }, 700);
  })();
}

// ── Runde starten (übergibt an den 3D-Kern des aktuellen Spiels) ──────────
function startRound() {
  showScreen(currentGame.screenId);
  const host = document.getElementById(currentGame.stageId);
  window[currentGame.windowKey].start({
    host,
    players: currentPlayers,
    mapId: currentMapId,
    fpsLimit: () => Settings.get('fpsLimit'),
    reducedFx: () => Settings.get('reducedFx'),
    sfx: (name) => Sfx.play(name),
    onResult: onGameResult,
    onExit: quitGameToMenu,
  });
}

// ── Ergebnis eines Spiels (generischer Vertrag { winner, placements }) ─────
function onGameResult(result) {
  lastGameResult = result;
  // Voting-/Countdown-Overlays sind im normalen Ablauf längst zu; defensiv
  // schließen, damit nie ein Overlay über Ranking/Ergebnis hängen bleibt.
  document.getElementById('mgMapVote').hidden = true;
  document.getElementById('mgCountdown').hidden = true;
  if (inSeries) {
    awardSeriesPoints(result);
    if (window[currentGame.windowKey]) window[currentGame.windowKey].stop();
    seriesIndex++;
    showRanking(seriesIndex >= seriesQueue.length);
  } else {
    showSingleResult(result);
  }
}

// Platzierungspunkte: bei N Spielern bekommt der 1. N Punkte … der letzte 1.
function awardSeriesPoints(result) {
  const list = (result && result.placements && result.placements.length)
    ? result.placements
    : (result && result.winner ? [result.winner] : []);
  const n = list.length;
  list.forEach((pl, idx) => {
    const s = seriesStandings[pl.id];
    if (s) s.points += (n - idx);
  });
}

// Zwischen- (isFinal=false) bzw. Gesamt-Ranking (isFinal=true) anzeigen.
function showRanking(isFinal) {
  const lastOrder = {};
  if (lastGameResult && lastGameResult.placements) {
    lastGameResult.placements.forEach((p, i) => { lastOrder[p.id] = i; });
  }
  const rows = Object.values(seriesStandings).slice().sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const la = lastOrder[a.id] ?? 99, lb = lastOrder[b.id] ?? 99;
    if (la !== lb) return la - lb;          // Gleichstand → besserer Platz zuletzt
    return Math.random() - 0.5;             // sonst zufällig
  });

  document.getElementById('mgRankTitle').textContent = isFinal
    ? '👑 Gesamtsieger'
    : `Zwischenstand — nächstes Spiel: ${seriesQueue[seriesIndex].name}`;
  document.getElementById('mgRankList').innerHTML = rows.map((r, i) => `
    <div class="mg-rank-row ${isFinal && i === 0 ? 'winner' : ''}">
      <span class="mg-rank-place">${i + 1}.</span>
      <span class="mg-rank-dot" style="--c:${r.colorHex}"></span>
      <span class="mg-rank-name">${isFinal && i === 0 ? '👑 ' : ''}${escapeHtml(r.name)}</span>
      <span class="mg-rank-pts">${r.points} Pkt</span>
    </div>`).join('');

  document.getElementById('mgRankInterim').hidden = isFinal;
  document.getElementById('mgRankFinal').hidden = !isFinal;
  if (isFinal) {
    inSeries = false;
    lobbyCrownSlotId = rows[0] ? rows[0].id : null; // Krone für den Gesamtsieger
    Sfx.play('success');
  }
  document.getElementById('mgRanking').hidden = false;
  const btn = isFinal ? document.getElementById('btnMgRankLobby') : document.getElementById('btnMgNext');
  if (btn) btn.focus();
}

// Ergebnis einer einzelnen Tutorial-Runde (kein Serien-Ranking).
function showSingleResult(result) {
  const winner = result && result.winner;
  document.getElementById('mgResultTitle').textContent =
    winner ? `${winner.name} gewinnt!` : 'Unentschieden!';
  document.getElementById('btnMgSecondary').textContent = 'Zum Menü';
  document.getElementById('mgResult').hidden = false;
  document.getElementById('btnMgAgain').focus();
}

// ── Pause (Esc im Spiel) ─────────────────────────────────────────────────
function pauseGame() {
  if (!currentGame) return;
  const g = window[currentGame.windowKey];
  if (!g || !g.isRunning()) return;
  g.pause();
  document.getElementById('mgPause').hidden = false;
  document.getElementById('btnMgResume').focus();
}
function resumeGame() {
  document.getElementById('mgPause').hidden = true;
  if (currentGame && window[currentGame.windowKey]) window[currentGame.windowKey].resume();
}
function quitGameToMenu() {
  document.getElementById('mgPause').hidden = true;
  document.getElementById('mgResult').hidden = true;
  document.getElementById('mgRanking').hidden = true;
  if (currentGame && window[currentGame.windowKey]) window[currentGame.windowKey].stop();
  inSeries = false;
  goToMenu();
}

// ── Online-Einladung (UI vorbereitet, noch ohne echte Netz-Anbindung) ─────
// Mehrere Einladungen werden als Warteschlange nacheinander gezeigt. Auslösen
// zum Testen über window.BombInvite.test('Name'). Die echte Online-Anbindung
// (Lobby beitreten) hängt später an isOnlineAllowed().
const inviteQueue = [];
function showInvite(fromName) {
  inviteQueue.push(fromName || 'Ein Freund');
  if (inviteQueue.length === 1) renderInvite();
}
function renderInvite() {
  const from = inviteQueue[0];
  document.getElementById('inviteText').textContent =
    `Du wurdest von ${from} zu einer Block Games Lobby eingeladen.`;
  document.getElementById('inviteOverlay').hidden = false;
  document.getElementById('btnInviteAccept').focus();
}
function nextInvite() {
  inviteQueue.shift();
  if (inviteQueue.length) renderInvite();
  else document.getElementById('inviteOverlay').hidden = true;
}
function acceptInvite() {
  showToast(isOnlineAllowed() ? 'Einladung angenommen — Online-Lobby folgt.' : 'Melde dich an, um online zu spielen.');
  nextInvite();
}
function declineInvite() { nextInvite(); }

function setupGameFlow() {
  // Pause-Overlay
  document.getElementById('btnMgResume').addEventListener('click', resumeGame);
  document.getElementById('btnMgQuit').addEventListener('click', quitGameToMenu);

  // Ergebnis einer Tutorial-Runde
  document.getElementById('btnMgAgain').addEventListener('click', () => {
    document.getElementById('mgResult').hidden = true;
    if (currentGame && window[currentGame.windowKey]) window[currentGame.windowKey].stop();
    startTutorial(currentGame.id); // neue Schnellstart-Runde (neue Random-Map)
  });
  document.getElementById('btnMgSecondary').addEventListener('click', () => {
    document.getElementById('mgResult').hidden = true;
    if (currentGame && window[currentGame.windowKey]) window[currentGame.windowKey].stop();
    goToMenu(); // Tutorial hat keine Lobby → zurück ins Hauptmenü
  });

  // Zwischen-Ranking → nächstes Spiel der Serie
  document.getElementById('btnMgNext').addEventListener('click', () => {
    document.getElementById('mgRanking').hidden = true;
    startSeriesGame();
  });
  // Gesamt-Ranking
  document.getElementById('btnMgRankAgain').addEventListener('click', () => {
    document.getElementById('mgRanking').hidden = true;
    startSeries(); // komplett neue Serie
  });
  document.getElementById('btnMgRankLobby').addEventListener('click', () => {
    document.getElementById('mgRanking').hidden = true;
    showScreen('screen-lobby');
    renderLobby(); // Krone des Gesamtsiegers anzeigen
    focusByNav('lobby_start');
  });
  document.getElementById('btnMgRankMenu').addEventListener('click', () => {
    document.getElementById('mgRanking').hidden = true;
    goToMenu();
  });

  // Online-Einladung
  document.getElementById('btnInviteAccept').addEventListener('click', acceptInvite);
  document.getElementById('btnInviteDecline').addEventListener('click', declineInvite);
  window.BombInvite = { test: (name) => showInvite(name) };
}

// ── Start ────────────────────────────────────────────────────────────
async function boot() {
  spawnBackgroundBlocks();
  setupSfx();
  setupAuthTabs();
  setupAuthForms();
  setupQuit();
  setupCredits();
  setupLobby();
  setupAccount();
  setupAccountSettings();
  setupSettingsTabs();
  setupGameFlow();
  setupKeyboard();
  await setupSettings();
  document.getElementById('appVersion').textContent =
    `Block Games v${window.blockGames?.version || '?'}`;

  // „Spielen" führt jetzt auf den Lobby-Vorbereitungsscreen (statt Toast).
  document.getElementById('btnParty').addEventListener('click', openLobby);

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
      if (isActive('screen-auth') || isActive('screen-loading')) goToMenu();
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
    goToMenu();
  } else {
    showAuth();
  }
}

boot();
