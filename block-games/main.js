// Block Games — Electron-Hauptprozess.
// Erstellt das Fenster (startet immer im Vollbild) und lädt das Renderer-UI.
// Anzeige-Einstellungen (Vollbild, Fenstergröße) steuert der Renderer per IPC.
const { app, BrowserWindow, Menu, ipcMain, screen } = require('electron');
const path = require('path');

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
    title: 'Block Games',
    icon: ICON_PATH,
    backgroundColor: '#14142b',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

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

ipcMain.handle('display:set-size', (e, { width, height }) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!win || win.isFullScreen()) return; // Fenstergröße gilt nur im Fenstermodus
  win.setSize(Math.round(width), Math.round(height));
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
