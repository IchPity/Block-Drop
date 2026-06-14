// Block Games — Sound-System (UI-Effekte).
//
// Alle Sounds werden per WebAudio synthetisiert — es gibt KEINE Audio-Dateien,
// die App bleibt komplett offline-fähig und CSP-konform. Die Lautstärke kommt
// bei jedem Abspielen frisch aus dem zentralen Settings-Store
// (Settings.effectiveVolume, Master eingerechnet) und ist dadurch automatisch
// live — Regler-Änderungen wirken sofort, ohne onChange-Verdrahtung.
//
// Benutzung: Sfx.play('click')          → Effekt auf dem SFX-Kanal
//            Sfx.play('blip', 'music')  → Pegel-Test auf dem Musik-Kanal
//
// WICHTIG für künftige Minigames: Effekte über DIESES Modul abspielen
// (oder eigene Sounds, aber immer mit Settings.effectiveVolume skaliert).
// Hintergrundmusik (volMusic) ist noch ungenutzt und kommt mit den Minigames.
//
// (Name "Sfx" statt "Audio" — `Audio` ist ein DOM-Built-in.)
'use strict';

const Sfx = (() => {
  let ctx = null;

  // AudioContext lazy erzeugen (Autoplay-Policy: braucht eine User-Geste;
  // der erste play() kommt praktisch immer aus einem Klick).
  function ensureCtx() {
    if (!ctx) {
      try { ctx = new AudioContext(); } catch { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Jeder Sound ist eine Liste von Teiltönen:
  // [Wellenform, Startfrequenz, Endfrequenz, Startzeit, Dauer, Pegel 0–1]
  const SOUNDS = {
    click:   [['square',   520,  520, 0,    0.05, 0.30]],
    hover:   [['sine',     480,  480, 0,    0.03, 0.12]],
    tab:     [['triangle', 600,  880, 0,    0.07, 0.30]],
    toggle:  [['square',   330,  660, 0,    0.06, 0.25]],
    blip:    [['sine',     700,  700, 0,    0.08, 0.45]],
    error:   [['sawtooth', 220,  150, 0,    0.20, 0.25]],
    success: [['triangle', 523,  523, 0,    0.09, 0.35],   // C5-E5-G5-Arpeggio
              ['triangle', 659,  659, 0.09, 0.09, 0.35],
              ['triangle', 784,  784, 0.18, 0.18, 0.35]],

    // ── Block Bomb ──────────────────────────────────────────────────────
    // Zünder-Tick (kurzer trockener Klick — wird je nach Restzeit häufiger
    // abgespielt, die Beschleunigung steuert der Spielkern).
    bombTick:    [['square',   880,  880, 0, 0.03, 0.22]],
    // Weitergabe: schneller Aufwärts-Whoosh.
    bombPass:    [['triangle', 300, 900, 0, 0.12, 0.32]],
    // Explosion: tiefer Sägezahn-Abfall, mehrschichtig (knalliger).
    bombExplode: [['sawtooth', 220,  40, 0, 0.45, 0.4],
                  ['square',   140,  30, 0, 0.4,  0.3],
                  ['sawtooth', 90,   20, 0, 0.55, 0.25]],
    // Countdown-Piep (3·2·1) und das helle „GO!".
    count:       [['square',   520, 520, 0, 0.12, 0.3]],
    go:          [['triangle', 660, 990, 0, 0.18, 0.4],
                  ['triangle', 990, 990, 0.1, 0.18, 0.35]],
  };

  function play(name, channel = 'sfx') {
    const def = SOUNDS[name];
    if (!def) return;
    const vol = Settings.effectiveVolume(channel);
    if (vol <= 0) return;
    const ac = ensureCtx();
    if (!ac) return;

    const now = ac.currentTime;
    def.forEach(([type, f0, f1, at, dur, level]) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f0, now + at);
      if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, now + at + dur);
      // Kurze Attack-/Release-Hüllkurve gegen Knackser
      const peak = Math.max(0.0001, level * vol);
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(peak, now + at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + dur);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(now + at);
      osc.stop(now + at + dur + 0.02);
    });
  }

  return { play };
})();
