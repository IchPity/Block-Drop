// Block Games — zentraler Einstellungs-Store.
//
// Alle Einstellungen (Anzeige, Grafik, Audio) leben hier und werden in
// localStorage gespeichert. Screens und Spiele lesen Werte über
// Settings.get() und reagieren mit Settings.onChange() auf Änderungen.
//
// WICHTIG für künftige Minigames: Jedes Spiel bekommt später ein eigenes,
// kleineres Einstellungs-Overlay (z.B. im Pause-Menü). Dieses Overlay nutzt
// GENAU DIESEN Store — gleiche Keys, gleiche onChange-Events — damit z.B.
// die Lautstärke im Spiel und auf der Haupt-Einstellungsseite immer synchron
// bleibt. Spiele lesen ihre Lautstärke über Settings.effectiveVolume() und
// ihr Bildraten-Limit über Settings.get('fpsLimit').
'use strict';

const Settings = (() => {
  const STORAGE_KEY = 'blockgames.settings';

  const DEFAULTS = {
    // Anzeige
    fullscreen: true,
    resolution: '1280x800',   // Fenstergröße — gilt nur im Fenstermodus
    // Grafik
    fpsLimit: 60,             // 0 = unbegrenzt; Spiele müssen das selbst umsetzen
    reducedFx: false,         // Hintergrund-/Glanz-Animationen im Menü aus
    // Audio (0–100)
    volMaster: 80,
    volMusic: 70,
    volSfx: 80,
  };

  let data = { ...DEFAULTS };
  try {
    data = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch { /* kaputte gespeicherte Daten → Defaults */ }

  const listeners = new Set();

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function get(key) { return data[key]; }

  function set(key, value) {
    if (data[key] === value) return;
    data[key] = value;
    save();
    listeners.forEach(fn => fn(key, value));
  }

  function reset() {
    data = { ...DEFAULTS };
    save();
    listeners.forEach(fn => fn(null, null)); // (null, null) = alles neu lesen
  }

  // fn(key, value) — bei reset() einmalig mit (null, null) aufgerufen.
  function onChange(fn) { listeners.add(fn); }

  // Effektive Lautstärke 0–1 für Spiele — Master wirkt immer mit.
  function effectiveVolume(channel /* 'music' | 'sfx' */) {
    const ch = channel === 'music' ? data.volMusic : data.volSfx;
    return (data.volMaster / 100) * (ch / 100);
  }

  return { get, set, reset, onChange, effectiveVolume, DEFAULTS };
})();
