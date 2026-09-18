// Block Games — Tastenbelegung.
//
// Modell: Jeder lokale Spieler hat ein PRESET (wasd|arrows) plus optionale
// Übersteuerungen je Aktion. Spieler 1 wählt das Preset in den Einstellungen
// (Reiter „Steuerung"); Spieler 2 bekommt automatisch das jeweils ANDERE
// Preset — beide Layouts sind nie gleichzeitig frei wählbar, sonst könnten
// sich beide Spieler versehentlich dieselben Tasten geben.
//
// Alles hier arbeitet mit event.code (nicht event.key) — QWERTZ-fest, siehe
// die Begründung in game/controllers.js. Gespeichert wird ausschließlich über
// den zentralen Store (renderer/settings.js, Keys keysPreset/keysP1/keysP2) —
// kein zweiter Speicherort.
'use strict';

const Keybinds = (() => {
  const ACTIONS = Object.freeze({
    walk:  Object.freeze(['left', 'right', 'up', 'down', 'jump']),
    piece: Object.freeze(['left', 'right', 'rotate', 'down', 'hard', 'cast', 'cycle']),
  });

  // Deutsche Beschriftung je Aktion (für den Steuerung-Reiter).
  const ACTION_LABELS = Object.freeze({
    'walk.left': 'Links', 'walk.right': 'Rechts', 'walk.up': 'Vor', 'walk.down': 'Zurück',
    'walk.jump': 'Springen',
    'piece.left': 'Links', 'piece.right': 'Rechts', 'piece.rotate': 'Drehen',
    'piece.down': 'Sinken (weich)', 'piece.hard': 'Fallen lassen (hart)',
    'piece.cast': 'Zauber wirken', 'piece.cycle': 'Ziel wechseln',
  });

  function freezeDeep(obj) {
    Object.values(obj).forEach((v) => { if (v && typeof v === 'object') Object.freeze(v); });
    return Object.freeze(obj);
  }

  // Referenz-Layouts. Diese Tabellen sind die Wahrheit — game/controllers.js
  // hält für den String-Fallback (alte Aufrufe ohne Keybinds) eine eigene,
  // unabhängige Kopie (LEGACY_WALK/LEGACY_PIECE), damit der Spielkern nie auf
  // dieses App-Level-Modul zugreifen muss. Bei Änderungen hier IMMER auch dort
  // nachziehen.
  const PRESETS = freezeDeep({
    wasd: freezeDeep({
      walk:  freezeDeep({ left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS', jump: 'Space' }),
      piece: freezeDeep({ left: 'KeyA', right: 'KeyD', rotate: 'KeyW', down: 'KeyS', hard: 'KeyQ', cast: 'KeyE', cycle: 'KeyR' }),
    }),
    arrows: freezeDeep({
      walk:  freezeDeep({ left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', jump: 'ShiftRight' }),
      piece: freezeDeep({ left: 'ArrowLeft', right: 'ArrowRight', rotate: 'ArrowUp', down: 'ArrowDown', hard: 'ShiftRight', cast: 'ControlRight', cycle: 'Slash' }),
    }),
  });

  // Tasten, die nie belegbar sein dürfen (Systemfunktionen des Spiels).
  const BLOCKED = new Set(['Escape', 'F5', 'F6', 'F9', 'F11', 'Tab', 'MetaLeft', 'MetaRight']);

  // Kurze deutsche Anzeige eines Tastencodes.
  const LABELS = Object.freeze({
    Space: 'Leertaste',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    ShiftRight: 'Shift rechts', ShiftLeft: 'Shift links',
    ControlRight: 'Strg rechts', ControlLeft: 'Strg links',
    // QWERTZ: physisch neben Enter (US-Layout meldet den Code trotzdem als
    // "Slash", s. game/controllers.js).
    Slash: '-/#',
  });

  function overrideKey(player) { return player === 'p2' ? 'keysP2' : 'keysP1'; }

  // P1 → das in den Einstellungen gewählte Preset. P2 → automatisch das
  // jeweils ANDERE (nie separat wählbar).
  function basePreset(player) {
    const p1Preset = Settings.get('keysPreset') === 'arrows' ? 'arrows' : 'wasd';
    if (player === 'p2') return p1Preset === 'arrows' ? 'wasd' : 'arrows';
    return p1Preset;
  }

  function overrides(player) { return Settings.get(overrideKey(player)) || {}; }

  // Preset + Übersteuerungen zusammengeführt → { walk:{…}, piece:{…} }.
  function resolve(player) {
    const preset = PRESETS[basePreset(player)];
    const ov = overrides(player);
    const out = {};
    for (const group of Object.keys(ACTIONS)) {
      out[group] = { ...preset[group] };
      for (const action of ACTIONS[group]) {
        const key = group + '.' + action;
        if (ov[key]) out[group][action] = ov[key];
      }
    }
    return out;
  }

  // Welche Aktion IN DIESER GRUPPE hat der Spieler schon auf `code` liegen?
  // (Konflikte werden bewusst nur innerhalb einer Gruppe geprüft — Laufspiele
  // und Block Rush sind nie gleichzeitig aktiv, doppelte Belegung über beide
  // Gruppen hinweg wäre also nur lästig, nie ein echtes Problem.)
  function findBindingInGroup(player, group, code) {
    const bound = resolve(player)[group];
    for (const action of ACTIONS[group]) {
      if (bound[action] === code) return action;
    }
    return null;
  }

  // Belegt `code` für (player, group, action). Konflikt mit einer ANDEREN
  // Aktion desselben Spielers/derselben Gruppe → Tausch (nie unbelegt lassen).
  // Konflikt mit dem anderen Spieler (gleiche Gruppe) → ablehnen.
  function set(player, group, action, code) {
    if (BLOCKED.has(code)) return { ok: false, reason: 'blocked' };
    const other = player === 'p2' ? 'p1' : 'p2';
    if (findBindingInGroup(other, group, code)) return { ok: false, reason: 'taken-by-other' };

    const next = { ...overrides(player) };
    const clashAction = findBindingInGroup(player, group, code);
    let swapped = null;
    if (clashAction && clashAction !== action) {
      const currentCode = resolve(player)[group][action];
      next[group + '.' + clashAction] = currentCode;
      swapped = clashAction;
    }
    next[group + '.' + action] = code;
    Settings.set(overrideKey(player), next);
    return { ok: true, swapped };
  }

  function clearOverrides(player) {
    Settings.set(overrideKey(player), {});
  }

  function label(code) {
    if (!code) return '–';
    if (LABELS[code]) return LABELS[code];
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit[0-9]$/.test(code)) return code.slice(5);
    return code;
  }

  function actionLabel(group, action) {
    return ACTION_LABELS[group + '.' + action] || action;
  }

  return { ACTIONS, PRESETS, BLOCKED, basePreset, resolve, set, clearOverrides, label, actionLabel };
})();
