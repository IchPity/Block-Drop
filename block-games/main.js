// Block Games — Electron-Hauptprozess.
// Erstellt das Fenster (startet immer im Vollbild) und lädt das Renderer-UI.
// Anzeige-Einstellungen (Vollbild, Fenstergröße) steuert der Renderer per IPC.
const { app, BrowserWindow, Menu, ipcMain, screen, shell } = require('electron');
const path = require('path');
const { version: APP_VERSION } = require('./package.json');

// ── Update-Check gegen GitHub Releases ────────────────────────────────
// Rein informativ: fragt beim Start die Releases-API ab und vergleicht mit
// der eigenen Version. Kein Auto-Download/-Install (noch keine
// electron-builder/Publish-Pipeline, s. ROADMAP.md) — der Renderer bietet
// bei einer neueren Version nur den Link zur GitHub-Release-Seite an.
const UPDATE_REPO = 'IchPity/Block-Drop';
const UPDATE_CHECK_TIMEOUT_MS = 5000;

function parseVersionParts(v) {
  return String(v || '').trim().replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
}

function isNewerVersion(remote, local) {
  const r = parseVersionParts(remote), l = parseVersionParts(local);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const rv = r[i] || 0, lv = l[i] || 0;
    if (rv !== lv) return rv > lv;
  }
  return false;
}

ipcMain.handle('update:check', async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPDATE_CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'block-games-update-check' },
      signal: controller.signal
    });
    if (!res.ok) return { available: false };
    const data = await res.json();
    const tag = data.tag_name || '';
    if (!tag || !isNewerVersion(tag, APP_VERSION)) return { available: false };
    return {
      available: true,
      version: tag.replace(/^v/i, ''),
      url: typeof data.html_url === 'string' ? data.html_url : `https://github.com/${UPDATE_REPO}/releases`,
      notes: data.name || tag
    };
  } catch {
    // Kein Internet, Rate-Limit, noch kein Release, etc. — Start darf davon
    // nie blockiert werden.
    return { available: false };
  } finally {
    clearTimeout(timer);
  }
});

// Nur Links auf das eigene Repo öffnen (Renderer schickt uns die URL aus
// der Releases-API-Antwort, die stammt also nicht von einer beliebigen Quelle).
ipcMain.handle('update:open', (e, url) => {
  // Als URL prüfen, nicht per Präfix: "…/Block-Drop-irgendwas" darf nicht durchrutschen
  let u;
  try { u = new URL(String(url)); } catch { return; }
  const base = `/${UPDATE_REPO}`;
  if (u.protocol === 'https:' && u.hostname === 'github.com' && (u.pathname === base || u.pathname.startsWith(base + '/'))) {
    shell.openExternal(u.href);
  }
});

// Eigenes Marken-Icon (goldener "Block Games"-Power-Block). Auf Windows
// bevorzugt die .ico (mehrere Auflösungen für die Taskleiste), sonst die .png.
const ICON_PATH = path.join(
  __dirname, 'renderer', 'assets',
  process.platform === 'win32' ? 'block-icon.ico' : 'block-icon.png'
);

// Eigene AppUserModelID, damit Windows Fenster + Taskleisten-Icon sauber dem
// Spiel zuordnet (statt dem generischen electron.exe-Eintrag).
if (process.platform === 'win32') app.setAppUserModelId('com.blockdrop.blockgames');

function createWindow() {
  const win = new BrowserWindow({
    // Fallback-Größe, falls der Spieler den Vollbildmodus verlässt (F11).
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    fullscreen: true,
    title: 'Block Games (Demo)',
    icon: ICON_PATH,
    backgroundColor: '#14142b',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Versionsnummer für preload.js (dort ist package.json nicht lesbar): eine Quelle statt zwei
      additionalArguments: ['--app-version=' + APP_VERSION]
    }
  });

  // Das Fenster zeigt nur die lokale Oberfläche: keine neuen Fenster, kein Wegnavigieren.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());

  // Kein Standard-Menü (File/Edit/View) — das ist ein Spiel, kein Editor.
  Menu.setApplicationMenu(null);

  // F11 schaltet den Vollbildmodus um (ohne Menü gibt es sonst keinen Weg).
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });

  // Einstellungs-Seite synchron halten — egal ob F11 oder die UI umschaltet.
  win.on('enter-full-screen', () => win.webContents.send('display:fullscreen-changed', true));
  win.on('leave-full-screen', () => win.webContents.send('display:fullscreen-changed', false));

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Erst zeigen wenn fertig gerendert — verhindert weißes Aufblitzen.
  win.once('ready-to-show', () => win.show());
}

// ── IPC: Anzeige-Einstellungen (genutzt von renderer/app.js) ─────────
ipcMain.handle('display:info', () => {
  const { width, height } = screen.getPrimaryDisplay().size;
  return { screenWidth: width, screenHeight: height };
});

ipcMain.handle('display:set-fullscreen', (e, on) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win) win.setFullScreen(!!on);
});

ipcMain.handle('display:set-size', (e, size) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!win || win.isFullScreen()) return; // Fenstergröße gilt nur im Fenstermodus
  const width = Number(size && size.width), height = Number(size && size.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return;
  win.setSize(Math.max(960, Math.round(width)), Math.max(640, Math.round(height)));
  win.center();
});

// Beenden aus dem Spiel heraus (⏻-Knopf im Hauptmenü, nach Bestätigung).
ipcMain.handle('app:quit', () => app.quit());

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
