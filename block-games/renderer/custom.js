// Block Games — „Anpassen": Figur-Formen, Farben, Hintergründe, Spielwelt.
//
// Erreichbar über Esc: im Hauptmenü öffnet Esc das Anpassen-Fenster direkt,
// im Spiel über Esc → Pause → „Anpassen" (s. setupKeyboard/pauseGame in
// app.js). Alles hier ist rein kosmetisch und lokal — gespeichert in
// localStorage, getrennt vom Einstellungs-Store (settings.js), damit
// „Einstellungen zurücksetzen" den eigenen Look nicht mit löscht.
//
// Wer liest was:
//   • Oberfläche (Akzentfarben, Schrift, Ecken, Bühnen-Hintergrund, Muster,
//     Schwebe-Formen) wendet apply() unten direkt auf :root/body an.
//   • Figur-Look → game/characters.js (Custom.look()/Custom.botLook()).
//   • Himmel/Nebel der 3D-Kulissen → game/theme.js (Custom.get('sky') …).
//   Beide Module hängen sich per Custom.onChange() ein und ziehen Änderungen
//   live nach — die Spielkerne rendern auch im Pause-Zustand weiter.
'use strict';

const Custom = (() => {
  const STORAGE_KEY = 'blockgames.custom';

  const DEFAULTS = {
    // Figur
    head: 'cube', body: 'block', eyes: 'normal', hat: 'none', finish: 'matt',
    botLooks: 'default',
    // Farben & Stil
    accent: '#ffc93c', accent2: '#ff5d5d', font: 'impact', corners: 'normal',
    // Hintergrund (Menü-Bühne)
    bgTheme: 'stage', bgCustom: '#1c2f4a',
    shapes: 'blocks', shapeColor: 'multi', shapeCount: 'normal', pattern: 'dots',
    // Spielwelt (3D-Kulissen der Minigames)
    sky: 'map', skyCustom: '#1a2a4a', fog: 'normal',
  };

  // ── Optionen (eine Quelle für UI, Zufall und Validierung) ──────────────
  const SWATCHES = [
    ['#ffc93c', 'Gelb'], ['#ff5d5d', 'Rot'], ['#ff944d', 'Orange'], ['#3ddc84', 'Grün'],
    ['#36d6e7', 'Cyan'], ['#4db5ff', 'Blau'], ['#b06dff', 'Lila'], ['#ff6ec7', 'Pink'],
    ['#f2f2fa', 'Weiß'],
  ];

  // Bühnen-Themes: [bg, bgDeep, card, card2, line] + drei Spotlight-Farben.
  const BG_THEMES = {
    stage:  { label: 'Bühne',     c: ['#14142b', '#0d0d1e', '#222241', '#2d2d52', '#3a3a66'], s: ['77, 181, 255', '176, 109, 255', '255, 93, 93'] },
    space:  { label: 'Weltraum',  c: ['#070714', '#020208', '#14142e', '#1d1d40', '#2c2c5a'], s: ['120, 90, 255', '54, 214, 231', '255, 110, 199'] },
    sunset: { label: 'Sonnenuntergang', c: ['#2b1426', '#160a18', '#41203a', '#55294a', '#6d3a5e'], s: ['255, 148, 77', '255, 93, 93', '255, 201, 60'] },
    ocean:  { label: 'Ozean',     c: ['#0b2233', '#06131f', '#123247', '#18425c', '#245a78'], s: ['54, 214, 231', '77, 181, 255', '61, 220, 132'] },
    forest: { label: 'Wald',      c: ['#10261a', '#08160f', '#1a3828', '#224a34', '#2f6347'], s: ['61, 220, 132', '255, 201, 60', '54, 214, 231'] },
    lava:   { label: 'Lava',      c: ['#2a100c', '#160705', '#401a13', '#54231a', '#703225'], s: ['255, 93, 93', '255, 148, 77', '255, 201, 60'] },
    candy:  { label: 'Bonbon',    c: ['#2e1638', '#1b0c22', '#45224f', '#582c65', '#734083'], s: ['255, 110, 199', '176, 109, 255', '77, 181, 255'] },
    mono:   { label: 'Graphit',   c: ['#17171a', '#0c0c0e', '#26262b', '#323238', '#45454d'], s: ['200, 200, 210', '150, 150, 165', '110, 110, 125'] },
  };

  // Himmel der 3D-Kulissen: Hintergrund-/Nebelfarbe + Tönung des Umgebungs-
  // lichts. 'map' = jede Map behält ihre eigene Stimmung (game/theme.js).
  const SKIES = {
    map:    { label: 'Wie die Map' },
    night:  { label: 'Nacht',     bg: '#05060f', ambient: '#6b78b8' },
    dusk:   { label: 'Abendrot',  bg: '#4a2233', ambient: '#ffb38a' },
    day:    { label: 'Tag',       bg: '#4f8fc4', ambient: '#ffffff' },
    ice:    { label: 'Eis',       bg: '#16324a', ambient: '#a8d8ff' },
    toxic:  { label: 'Giftgrün',  bg: '#0f2a18', ambient: '#9dffb0' },
    dream:  { label: 'Traum',     bg: '#2a1446', ambient: '#d0a8ff' },
    candy:  { label: 'Zuckerwatte', bg: '#4a1c3c', ambient: '#ffb0dc' },
  };

  const FONTS = {
    impact:  { label: 'Plakat',   css: "Impact, 'Arial Black', 'Segoe UI', sans-serif" },
    round:   { label: 'Rund',     css: "'Comic Sans MS', 'Trebuchet MS', 'Segoe UI', sans-serif" },
    pixel:   { label: 'Terminal', css: "Consolas, 'Courier New', monospace" },
    elegant: { label: 'Edel',     css: "Georgia, 'Times New Roman', serif" },
    clean:   { label: 'Schlicht', css: "'Segoe UI Black', 'Segoe UI', Arial, sans-serif" },
  };

  const CORNERS = { sharp: ['Eckig', '4px'], normal: ['Normal', '18px'], round: ['Rund', '30px'] };
  const SHAPE_COUNTS = { none: 0, few: 8, normal: 16, many: 34 };

  const opt = (v, label, icon) => ({ v, label, icon });
  const fromMap = (map) => Object.entries(map).map(([v, o]) => opt(v, o.label || o[0]));

  // Reiter → Zeilen. `color` nennt den Schlüssel einer frei wählbaren Farbe:
  // bei `colorSets` wird beim Wählen zusätzlich der Hauptwert auf diesen Wert
  // gestellt (z.B. bgTheme → 'custom'); ohne ist die Farbe selbst der Wert.
  const TABS = [
    { id: 'figure', label: '🧍 Figur', rows: [
      { key: 'head', label: 'Kopf', options: [
        opt('cube', 'Würfel', '🟦'), opt('sphere', 'Kugel', '🔵'), opt('cylinder', 'Tonne', '🥫'),
        opt('pyramid', 'Pyramide', '🔺'), opt('diamond', 'Diamant', '💎'), opt('wide', 'Bildschirm', '📺') ] },
      { key: 'body', label: 'Körper', options: [
        opt('block', 'Block', '🧱'), opt('barrel', 'Rund', '🛢️'), opt('vshape', 'Sportlich', '🔻'), opt('slim', 'Schmal', '📏') ] },
      { key: 'eyes', label: 'Augen', options: [
        opt('normal', 'Normal'), opt('big', 'Groß'), opt('cyclops', 'Zyklop'),
        opt('sleepy', 'Müde'), opt('glow', 'Leuchtend'), opt('angry', 'Grimmig') ] },
      { key: 'hat', label: 'Kopfschmuck', options: [
        opt('none', 'Keiner', '🚫'), opt('crown', 'Krone', '👑'), opt('tophat', 'Zylinder', '🎩'),
        opt('party', 'Partyhut', '🥳'), opt('antenna', 'Antenne', '📡'), opt('horns', 'Hörner', '😈'),
        opt('halo', 'Heiligenschein', '😇') ] },
      { key: 'finish', label: 'Oberfläche', options: [
        opt('matt', 'Matt'), opt('glossy', 'Glänzend'), opt('metal', 'Metall'), opt('neon', 'Neon') ] },
      { key: 'botLooks', label: 'Bots & Mitspieler', hint: 'Deine Farbe wählst du weiter in der Lobby.', options: [
        opt('default', 'Standard'), opt('random', 'Zufällig'), opt('same', 'Wie ich') ] },
    ] },
    { id: 'style', label: '🎨 Farben & Stil', rows: [
      { key: 'accent', label: 'Akzentfarbe', hint: 'Logo, Fokus-Rahmen, Hervorhebungen', swatches: true, color: 'accent' },
      { key: 'accent2', label: 'Zweitfarbe', hint: 'Schatten der Überschriften', swatches: true, color: 'accent2' },
      { key: 'font', label: 'Überschriften', options: fromMap(FONTS) },
      { key: 'corners', label: 'Ecken', options: fromMap(CORNERS) },
    ] },
    { id: 'bg', label: '🌄 Hintergrund', rows: [
      { key: 'bgTheme', label: 'Bühne', options: fromMap(BG_THEMES), themeSwatch: true, color: 'bgCustom', colorSets: 'custom' },
      { key: 'shapes', label: 'Schwebe-Formen', options: [
        opt('blocks', 'Blöcke', '🟥'), opt('circle', 'Kreise', '⚪'), opt('triangle', 'Dreiecke', '🔺'),
        opt('diamond', 'Rauten', '🔷'), opt('hex', 'Waben', '⬡'), opt('star', 'Sterne', '⭐'),
        opt('heart', 'Herzen', '❤️'), opt('plus', 'Plus', '➕'), opt('mix', 'Gemischt', '🎲') ] },
      { key: 'shapeCount', label: 'Menge', options: [
        opt('none', 'Keine'), opt('few', 'Wenige'), opt('normal', 'Normal'), opt('many', 'Viele') ] },
      { key: 'shapeColor', label: 'Formfarbe', options: [
        opt('multi', 'Bunt'), opt('accent', 'Akzentfarbe'), opt('white', 'Weiß') ] },
      { key: 'pattern', label: 'Muster', options: [
        opt('dots', 'Punkte'), opt('grid', 'Gitter'), opt('stripes', 'Streifen'),
        opt('checker', 'Karo'), opt('none', 'Keins') ] },
    ] },
    { id: 'world', label: '🎮 Spielwelt', rows: [
      { key: 'sky', label: 'Himmel', hint: 'gilt in Laser Lines, Block Bomb und Block Rush', options: fromMap(SKIES), skySwatch: true, color: 'skyCustom', colorSets: 'custom' },
      { key: 'fog', label: 'Nebel', options: [
        opt('clear', 'Klar'), opt('normal', 'Normal'), opt('thick', 'Dicht') ] },
    ] },
  ];

  // ── Store ──────────────────────────────────────────────────────────────
  let data = { ...DEFAULTS };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    // Nur bekannte Schlüssel mit passendem Typ übernehmen (alte/kaputte Daten).
    for (const k of Object.keys(DEFAULTS)) if (typeof saved[k] === 'string') data[k] = saved[k];
  } catch { /* kaputte gespeicherte Daten → Defaults */ }

  const listeners = new Set();
  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  const get = (key) => data[key];

  function set(key, value) {
    if (!(key in DEFAULTS) || data[key] === value) return;
    data[key] = value;
    save();
    apply([key]);
    listeners.forEach(fn => fn(key));
  }

  function setMany(values) {
    data = { ...data, ...values };
    save();
    apply(Object.keys(values));
    listeners.forEach(fn => fn(null)); // null = alles neu lesen
  }

  // fn(key) — nach Sammel-Änderungen (Zufall/Zurücksetzen) einmalig mit null.
  function onChange(fn) { listeners.add(fn); }

  // ── Farb-Helfer ────────────────────────────────────────────────────────
  const isHex = (s) => /^#[0-9a-f]{6}$/i.test(s || '');

  function hexToHsl(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    const l = (max + min) / 2;
    if (!d) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(h * 60 + 360) % 360, s, l];
  }

  function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
      : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [r, g, b].map(v => Math.round((v + m) * 255));
  }

  const rgbToHex = (rgb) => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');

  // Eigene Bühnenfarbe → komplettes Theme. Die Helligkeit wird gedeckelt, weil
  // die ganze Oberfläche helle Schrift auf dunklem Grund voraussetzt.
  function themeFromColor(hex) {
    const [h, s0, l0] = hexToHsl(isHex(hex) ? hex : DEFAULTS.bgCustom);
    const s = Math.min(s0, 0.6), l = Math.min(Math.max(l0, 0.05), 0.2);
    const tone = (dl, ds = 1) => rgbToHex(hslToRgb(h, s * ds, Math.max(0.02, l + dl)));
    const spot = (dh) => hslToRgb((h + dh + 360) % 360, 0.85, 0.66).join(', ');
    return {
      c: [tone(0), tone(-l * 0.45), tone(0.07), tone(0.12), tone(0.2, 0.8)],
      s: [spot(0), spot(45), spot(-45)],
    };
  }

  const bgTheme = () => (data.bgTheme === 'custom' ? themeFromColor(data.bgCustom) : (BG_THEMES[data.bgTheme] || BG_THEMES.stage));

  // ── Anwenden: Oberfläche ───────────────────────────────────────────────
  const SHAPE_KEYS = new Set(['shapes', 'shapeColor', 'shapeCount']);

  // keys: geänderte Schlüssel (null = alles) — die Schwebe-Formen werden nur
  // neu verteilt, wenn sie wirklich betroffen sind (sonst würden sie z.B. beim
  // Ziehen im Farbwähler bei jedem Schritt springen).
  function apply(keys) {
    const root = document.documentElement.style;
    root.setProperty('--hl', isHex(data.accent) ? data.accent : DEFAULTS.accent);
    root.setProperty('--hl-2', isHex(data.accent2) ? data.accent2 : DEFAULTS.accent2);
    root.setProperty('--font-display', (FONTS[data.font] || FONTS.impact).css);
    root.setProperty('--radius', (CORNERS[data.corners] || CORNERS.normal)[1]);

    const t = bgTheme();
    ['--bg', '--bg-deep', '--bg-card', '--bg-card-2', '--line'].forEach((v, i) => root.setProperty(v, t.c[i]));
    t.s.forEach((v, i) => root.setProperty(`--spot-${i + 1}`, v));

    if (document.body) {
      ['grid', 'stripes', 'checker', 'none'].forEach(p => document.body.classList.toggle('pat-' + p, data.pattern === p));
      if (!keys || keys.some(k => SHAPE_KEYS.has(k))) spawnBackground();
    }
  }

  // ── Animierter Bühnen-Hintergrund ──────────────────────────────────────
  // Schwebende Formen (floatUp) und funkelnde Sterne (twinkle). Rein
  // dekorativ; bei „Animationen reduzieren" blendet die CSS alle Layer aus
  // (body.reduced-fx), die Elemente bleiben dann einfach unsichtbar.
  const ARCADE_COLORS = ['#ff5d5d', '#ffc93c', '#3ddc84', '#4db5ff', '#b06dff'];
  const MIX_SHAPES = ['circle', 'triangle', 'diamond', 'hex', 'star', 'heart', 'plus'];

  function shapeColorAt(i) {
    if (data.shapeColor === 'accent') return 'var(--hl)'; // folgt der Akzentfarbe live
    if (data.shapeColor === 'white') return '#f2f2fa';
    return ARCADE_COLORS[i % ARCADE_COLORS.length];
  }

  function spawnBackground() {
    const blocks = document.getElementById('bgBlocks');
    const stars = document.getElementById('bgStars');
    if (!blocks || !stars) return;
    blocks.textContent = '';
    stars.textContent = '';
    const count = SHAPE_COUNTS[data.shapeCount] ?? SHAPE_COUNTS.normal;

    for (let i = 0; i < count; i++) {
      const b = document.createElement('div');
      const size = 30 + Math.random() * 64;
      const color = shapeColorAt(i);
      let h = size;
      if (data.shapes === 'blocks') {
        const isCube = i % 3 === 0;        // jeder dritte ist ein 3D-Würfel
        b.className = isCube ? 'bg-cube' : 'bg-block';
        if (isCube) { h = size * 1.1; b.style.setProperty('--c', color); }
        else b.style.background = color;
      } else {
        const shape = data.shapes === 'mix' ? MIX_SHAPES[i % MIX_SHAPES.length] : data.shapes;
        b.className = `bg-shape sh-${shape}`;
        b.style.background = color;
      }
      b.style.width = `${size}px`;
      b.style.height = `${h}px`;
      b.style.left = `${Math.random() * 100}vw`;
      b.style.animationDuration = `${16 + Math.random() * 20}s`;
      b.style.animationDelay = `${-Math.random() * 24}s`;
      blocks.appendChild(b);
    }

    for (let i = 0; i < Math.round(count * 1.5); i++) {
      const s = document.createElement('div');
      const sz = 5 + Math.random() * 12;
      s.className = 'bg-star';
      s.style.width = s.style.height = `${sz}px`;
      s.style.left = `${Math.random() * 100}vw`;
      s.style.top = `${Math.random() * 100}vh`;
      s.style.setProperty('--c', shapeColorAt(i));
      s.style.animationDuration = `${2.2 + Math.random() * 3.6}s`;
      s.style.animationDelay = `${-Math.random() * 6}s`;
      stars.appendChild(s);
    }
  }

  // ── Figur-Look (für game/characters.js) ────────────────────────────────
  const FIGURE_KEYS = ['head', 'body', 'eyes', 'hat', 'finish'];
  const figureRow = (key) => TABS[0].rows.find(r => r.key === key);

  function look() {
    const out = {};
    FIGURE_KEYS.forEach(k => { out[k] = data[k]; });
    return out;
  }

  // Look für Bots/Mitspieler: null = Standardfigur. „Zufällig" ist über die
  // Spieler-ID geseedet, damit ein Bot die ganze Serie über gleich aussieht.
  function botLook(seed) {
    if (data.botLooks === 'same') return look();
    if (data.botLooks !== 'random') return null;
    let h = 2166136261;
    for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const out = {};
    FIGURE_KEYS.forEach(k => {
      h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
      const opts = figureRow(k).options;
      out[k] = opts[h % opts.length].v;
    });
    return out;
  }

  // ── Himmel/Nebel (für game/theme.js) ───────────────────────────────────
  // Liefert { bg, ambient } als Hex-Strings oder null („wie die Map").
  function sky() {
    if (data.sky === 'custom') {
      const hex = isHex(data.skyCustom) ? data.skyCustom : DEFAULTS.skyCustom;
      const [h, s] = hexToHsl(hex);
      return { bg: hex, ambient: rgbToHex(hslToRgb(h, Math.min(s, 0.7), 0.8)) };
    }
    const s = SKIES[data.sky];
    return (s && s.bg) ? { bg: s.bg, ambient: s.ambient } : null;
  }
  const fogScale = () => (data.fog === 'clear' ? 1.9 : data.fog === 'thick' ? 0.62 : 1);

  // ── Anpassen-Fenster ───────────────────────────────────────────────────
  let activeTab = TABS[0].id;
  let fromPause = false;
  let previewColor = '#36d6e7';
  let returnFocus = null;

  const overlay = () => document.getElementById('customOverlay');
  const isOpen = () => { const o = overlay(); return !!o && !o.hidden; };

  function swatchStyle(row, o) {
    if (row.themeSwatch) { const t = BG_THEMES[o.v]; return `background:linear-gradient(135deg, ${t.c[2]}, ${t.c[1]}); box-shadow: inset 0 -4px 0 rgb(${t.s[0]})`; }
    if (row.skySwatch) { const s = SKIES[o.v]; return s.bg ? `background:${s.bg}` : 'background:conic-gradient(#ff5d5d, #ffc93c, #3ddc84, #4db5ff, #b06dff, #ff5d5d)'; }
    return '';
  }

  function rowHtml(row) {
    let chips;
    if (row.swatches) {
      chips = SWATCHES.map(([hex, name]) =>
        `<button type="button" class="cz-chip cz-swatch" data-key="${row.key}" data-v="${hex}" title="${name}" aria-label="${name}"><span class="cz-dot" style="background:${hex}"></span></button>`).join('');
    } else {
      chips = row.options.map(o => {
        const sw = swatchStyle(row, o);
        const lead = sw ? `<span class="cz-dot" style="${sw}"></span>` : (o.icon ? `<span aria-hidden="true">${o.icon}</span>` : '');
        return `<button type="button" class="cz-chip" data-key="${row.key}" data-v="${o.v}">${lead}${o.label}</button>`;
      }).join('');
    }
    if (row.color) {
      chips += `<label class="cz-chip cz-color" title="Eigene Farbe"><span aria-hidden="true">🖌️</span> Eigene
        <input type="color" data-color="${row.color}"${row.colorSets ? ` data-sets="${row.key}" data-sets-v="${row.colorSets}"` : ''} aria-label="${row.label}: eigene Farbe"></label>`;
    }
    return `<div class="cz-row">
      <div class="cz-label"><strong>${row.label}</strong>${row.hint ? `<small>${row.hint}</small>` : ''}</div>
      <div class="cz-chips">${chips}</div>
    </div>`;
  }

  function build() {
    const o = overlay();
    o.querySelector('#czTabs').innerHTML = TABS.map(t =>
      `<button type="button" class="settings-tab cz-tab" data-tab="${t.id}" role="tab">${t.label}</button>`).join('');
    o.querySelector('#czPanels').innerHTML = TABS.map(t =>
      `<div class="cz-panel" data-panel="${t.id}" role="tabpanel">${t.rows.map(rowHtml).join('')}</div>`).join('');

    o.addEventListener('click', (e) => {
      if (e.target === o) { close(); return; }
      const tab = e.target.closest('.cz-tab');
      if (tab) { showTab(tab.dataset.tab); return; }
      const chip = e.target.closest('.cz-chip[data-key]');
      if (chip) set(chip.dataset.key, chip.dataset.v);
    });
    // Reiter wechseln schon beim Fokus (wie die Einstellungs-Reiter).
    o.addEventListener('focusin', (e) => {
      const tab = e.target.closest('.cz-tab');
      if (tab) showTab(tab.dataset.tab);
    });
    o.addEventListener('input', (e) => {
      const inp = e.target.closest('input[type="color"]');
      if (!inp) return;
      const values = { [inp.dataset.color]: inp.value };
      if (inp.dataset.sets) values[inp.dataset.sets] = inp.dataset.setsV;
      setMany(values);
    });
    o.querySelector('#btnCzClose').addEventListener('click', () => close());
    o.querySelector('#btnCzDone').addEventListener('click', () => close());
    o.querySelector('#btnCzRandom').addEventListener('click', randomizeTab);
    o.querySelector('#btnCzReset').addEventListener('click', () => {
      setMany({ ...DEFAULTS });
      if (typeof showToast === 'function') showToast('Alles wieder auf Standard.');
    });
    onChange(syncUi);
  }

  function showTab(id) {
    activeTab = id;
    const o = overlay();
    o.querySelectorAll('.cz-tab').forEach(t => {
      const on = t.dataset.tab === id;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
    });
    o.querySelectorAll('.cz-panel').forEach(p => { p.hidden = p.dataset.panel !== id; });
    // Die Figur-Vorschau gibt es nur im Figur-Reiter.
    o.querySelector('#czPreview').hidden = id !== 'figure';
  }

  function syncUi() {
    const o = overlay();
    if (!o) return;
    o.querySelectorAll('.cz-chip[data-key]').forEach(chip => {
      const on = String(data[chip.dataset.key]).toLowerCase() === chip.dataset.v.toLowerCase();
      chip.classList.toggle('is-on', on);
      chip.setAttribute('aria-pressed', String(on));
    });
    o.querySelectorAll('input[type="color"]').forEach(inp => {
      const key = inp.dataset.color;
      inp.value = isHex(data[key]) ? data[key] : DEFAULTS[key];
      // „Eigene" ist aktiv, wenn kein Preset-Chip der Zeile passt.
      const row = inp.closest('.cz-row');
      inp.closest('.cz-color').classList.toggle('is-on', !row.querySelector('.cz-chip[data-key].is-on'));
    });
  }

  // 🎲 würfelt nur den gerade offenen Reiter neu.
  function randomizeTab() {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const values = {};
    TABS.find(t => t.id === activeTab).rows.forEach(row => {
      if (row.key === 'botLooks' || row.key === 'shapeCount') return; // keine Überraschungen bei Verhalten/Leistung
      values[row.key] = row.swatches ? pick(SWATCHES)[0] : pick(row.options).v;
    });
    if (values.shapes && data.shapeCount === 'none') values.shapeCount = 'normal';
    setMany(values);
    if (typeof Sfx !== 'undefined') Sfx.play('success');
  }

  // opts: { fromPause, color } — fromPause blendet das Pause-Fenster solange
  // aus; color ist die Lobby-Farbe von Spieler 1 für die Figur-Vorschau.
  function open(opts = {}) {
    if (isOpen()) return;
    fromPause = !!opts.fromPause;
    previewColor = opts.color || previewColor;
    returnFocus = document.activeElement;
    if (fromPause) document.getElementById('mgPause').hidden = true;
    const o = overlay();
    o.hidden = false;
    showTab(activeTab);
    syncUi();
    if (typeof CustomPreview !== 'undefined') CustomPreview.start(o.querySelector('#czPreviewCanvas'), previewColor);
    o.querySelector(`.cz-tab[data-tab="${activeTab}"]`).focus();
  }

  // silent: nur zumachen (z.B. weil das Match gerade endet) — das Pause-
  // Fenster kommt dann NICHT wieder, und der Fokus bleibt, wo der Aufrufer ihn setzt.
  function close(silent = false) {
    if (!isOpen()) return;
    overlay().hidden = true;
    if (typeof CustomPreview !== 'undefined') CustomPreview.stop();
    if (silent) return;
    if (fromPause) {
      document.getElementById('mgPause').hidden = false;
      document.getElementById('btnMgCustom').focus();
    } else if (returnFocus && returnFocus.isConnected && returnFocus !== document.body) {
      returnFocus.focus();
    }
  }

  function init() {
    apply(null);
    build();
  }

  return { get, set, onChange, look, botLook, sky, fogScale, open, close, isOpen, init, DEFAULTS };
})();
