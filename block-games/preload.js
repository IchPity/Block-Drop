// Brücke zwischen Main- und Renderer-Prozess.
// Bewusst minimal: aktuell nur App-Infos. IPC-Kanäle (z.B. Vollbild,
// Spielstand-Dateien) kommen hier rein, sobald sie gebraucht werden.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('blockGames', {
  version: '0.2.0',
  platform: process.platform
});
