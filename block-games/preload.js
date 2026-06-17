// Brücke zwischen Main- und Renderer-Prozess.
// Neben App-Infos: Anzeige-Steuerung für die Einstellungsseite
// (Vollbild, Fenstergröße, Bildschirm-Infos, Vollbild-Events).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('blockGames', {
  version: '0.14.0',
  platform: process.platform,

  // App beenden (Bestätigungs-Dialog macht der Renderer)
  quitApp: () => ipcRenderer.invoke('app:quit'),

  // Anzeige-Einstellungen (siehe IPC-Handler in main.js)
  getDisplayInfo: () => ipcRenderer.invoke('display:info'),
  setFullscreen: (on) => ipcRenderer.invoke('display:set-fullscreen', on),
  setWindowSize: (width, height) => ipcRenderer.invoke('display:set-size', { width, height }),
  // cb(true/false) — feuert auch bei F11, damit die UI synchron bleibt.
  onFullscreenChange: (cb) => ipcRenderer.on('display:fullscreen-changed', (_e, on) => cb(on)),
});
