// Block Games — Electron-Hauptprozess.
// Erstellt das Fenster (startet immer im Vollbild) und lädt das Renderer-UI.
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    // Fallback-Größe, falls der Spieler den Vollbildmodus verlässt (F11).
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    fullscreen: true,
    title: 'Block Games',
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

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Erst zeigen wenn fertig gerendert — verhindert weißes Aufblitzen.
  win.once('ready-to-show', () => win.show());
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
