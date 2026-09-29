'use strict';
// Spielmodi des Automaten: reine Regeln ohne DOM, damit sie sich auch in Node durchrechnen lassen.
(function (root) {
  const FIVE = [[1, 1, 1], [0, 0, 0], [2, 2, 2], [0, 1, 2], [2, 1, 0]]; // Zeile je Walze
  const MAX_X = 200; // Gewinn pro Runde nie über das 200-Fache des Einsatzes

  const MODES = {
    classic: {
      id: 'classic', name: 'Klassik', tag: '1 Linie',
      note: 'Nur die mittlere Linie zählt',
      lines: [[1, 1, 1]], top: 'seven',
      syms: [
        { id: 'seven',   name: 'Sieben',  w: 1,  m: 200 },
        { id: 'diamond', name: 'Diamant', w: 2,  m: 80 },
        { id: 'bell',    name: 'Glocke',  w: 4,  m: 40 },
        { id: 'enya',    name: 'Enya',    w: 2,  m: 30 },
        { id: 'star',    name: 'Stern',   w: 6,  m: 20 },
        { id: 'cherry',  name: 'Kirsche', w: 9,  m: 12 },
        { id: 'lemon',   name: 'Zitrone', w: 10, m: 8 },
        { id: 'grape',   name: 'Traube',  w: 12, m: 8 },
        { id: 'bar',     name: 'BAR',     w: 14, m: 6 },
      ],
      pair: 1.6, pairAny: true, noPay: ['enya'],
      starAward: { trio: 5, pair: 2 },
      luckSym: 'enya',
      rules: [
        'Zwei gleiche;×1,6',
        'Zwei / drei Sterne;+2 / +5 Frei',
        '1 / 2 / 3 Enya;15 Sek ×1,2 / 20 Sek ×1,3 / 30 Sek ×1,5',
      ],
    },

    fruit: {
      id: 'fruit', name: 'Fruchtfieber', tag: '5 Linien',
      note: '5 Linien · Stern ist Wild (außer für die Sieben)',
      lines: FIVE, top: 'seven', wild: 'star', wildPays: 'diamond', noWild: ['seven'],
      syms: [
        { id: 'seven',   name: 'Sieben',  w: 2,  m: 100 },
        { id: 'diamond', name: 'Diamant', w: 3,  m: 40 },
        { id: 'bell',    name: 'Glocke',  w: 5,  m: 20 },
        { id: 'star',    name: 'Stern (Wild)', w: 5, m: 0 },
        { id: 'cherry',  name: 'Kirsche', w: 9,  m: 10 },
        { id: 'lemon',   name: 'Zitrone', w: 11, m: 6 },
        { id: 'grape',   name: 'Traube',  w: 12, m: 6 },
        { id: 'bar',     name: 'BAR',     w: 13, m: 4 },
      ],
      pair: 1.3,
      rules: [
        'Drei gleiche auf einer Linie;Wert × Linieneinsatz',
        'Zwei gleiche von links;×1,3',
        'Stern;ersetzt alle außer Sieben',
      ],
    },

    enya: {
      id: 'enya', name: 'Enya Special', tag: 'Spezial',
      note: '5 Linien · Enya ist Wild, breitet sich in der Mitte aus',
      lines: FIVE, top: 'crown', wild: 'enya', wildPays: 'crown', expand: 1,
      syms: [
        { id: 'crown', name: 'Krone',  w: 2,  m: 50 },
        { id: 'harp',  name: 'Harfe',  w: 3,  m: 25 },
        { id: 'moon',  name: 'Mond',   w: 5,  m: 12 },
        { id: 'note',  name: 'Note',   w: 8,  m: 6 },
        { id: 'wave',  name: 'Welle',  w: 11, m: 5 },
        { id: 'star',  name: 'Stern',  w: 14, m: 3 },
        { id: 'enya',  name: 'Enya (Wild)', w: 3, m: 0 },
      ],
      pair: 0.1,
      scatter: { sym: 'enya', awards: { 3: 5, 4: 8, 5: 12, 6: 15 } },
      freeMult: 2, scatterLuck: true,
      rules: [
        'Drei gleiche auf einer Linie;Wert × Linieneinsatz',
        'Zwei gleiche von links;×0,1',
        'Enya;Wild, ersetzt alles',
        'Enya in der Mitte;füllt die ganze Walze',
        '3 / 4 / 5+ Enya irgendwo;5 / 8 / 12 Freispiele + 30 Sek ×1,5 Glück',
        'Im Freispiel;alle Gewinne ×2',
      ],
    },
  };

  const ORDER = ['classic', 'fruit', 'enya'];
  for (const m of Object.values(MODES)) {
    m.by = Object.fromEntries(m.syms.map(s => [s.id, s]));
    m.pool = m.syms.flatMap(s => Array(s.w).fill(s.id));
  }
  const ALL_IDS = new Set(Object.values(MODES).flatMap(m => m.syms.map(s => s.id)));

  const pick = (mode, rnd) => mode.pool[Math.floor((rnd || Math.random)() * mode.pool.length)];
  const makeGrid = (mode, rnd) => [0, 1, 2].map(() => [pick(mode, rnd), pick(mode, rnd), pick(mode, rnd)]);

  // Eine Linie: { mult, cells (Walzen-Indizes), sym, kind } oder null
  function scoreLine(mode, ids) {
    if (!mode.wild) {
      const [a, b, c] = ids;
      let cells = null, sym = null, kind = null;
      if (a === b && b === c) { cells = [0, 1, 2]; sym = a; kind = 'trio'; }
      else if (mode.pairAny && a === b) { cells = [0, 1]; sym = a; kind = 'pair'; }
      else if (mode.pairAny && b === c) { cells = [1, 2]; sym = b; kind = 'pair'; }
      else if (mode.pairAny && a === c) { cells = [0, 2]; sym = a; kind = 'pair'; }
      if (!cells) return null;
      if (mode.noPay && mode.noPay.includes(sym)) return { mult: 0, cells: [], sym, kind };
      return { mult: kind === 'trio' ? mode.by[sym].m : mode.pair, cells, sym, kind };
    }
    const isW = id => id === mode.wild;
    const subst = base => !(mode.noWild && mode.noWild.includes(base));
    const fits = (id, base) => id === base || (isW(id) && subst(base));
    const firstReal = ids.find(id => !isW(id));
    const base = firstReal || mode.wildPays;
    if (ids.every(id => fits(id, base))) return { mult: mode.by[base].m, cells: [0, 1, 2], sym: base, kind: 'trio' };
    const real2 = ids.slice(0, 2).find(id => !isW(id));
    const b2 = real2 || mode.wildPays;
    if (mode.pair && ids.slice(0, 2).every(id => fits(id, b2))) return { mult: mode.pair, cells: [0, 1], sym: b2, kind: 'pair' };
    return null;
  }

  // Rechnet ein 3x3-Gitter aus (grid[walze][zeile]). Glück und Deckel kommen erst in finalWin.
  function resolve(mode, grid, stake, freeSpin) {
    const g = grid.map(r => r.slice());
    const out = { grid: g, raw: 0, hits: [], kind: 'none', sym: null, jackpot: false, award: 0, luckCount: 0, expanded: false, lines: 0 };
    const scat = mode.scatter ? g.flat().filter(id => id === mode.scatter.sym).length : 0;
    if (mode.expand !== undefined && g[mode.expand].includes(mode.wild)) {
      g[mode.expand] = g[mode.expand].map(() => mode.wild);
      out.expanded = true;
    }
    const lineStake = stake / mode.lines.length;
    let sum = 0;
    const hit = new Set();
    let best = null;
    for (const ln of mode.lines) {
      const r = scoreLine(mode, ln.map((row, i) => g[i][row]));
      if (!r) continue;
      if (r.mult > 0) { sum += r.mult; out.lines++; }
      r.cells.forEach(i => hit.add(i + ':' + ln[i]));
      if (r.mult > 0 && (!best || r.mult > best.mult)) best = r;
      if (r.kind === 'trio' && r.sym === mode.top) out.jackpot = true;
    }
    if (best) { out.kind = best.kind; out.sym = best.sym; }
    out.raw = sum * lineStake * (freeSpin && mode.freeMult ? mode.freeMult : 1);
    out.hits = [...hit].map(k => k.split(':').map(Number));

    if (mode.starAward && out.sym === 'star') out.award = out.kind === 'trio' ? mode.starAward.trio : out.kind === 'pair' ? mode.starAward.pair : 0;
    if (mode.scatter) {
      const keys = Object.keys(mode.scatter.awards).map(Number).sort((a, b) => a - b);
      const k = keys.filter(n => scat >= n).pop();
      if (k) {
        out.award = mode.scatter.awards[k];
        out.scatter = scat;
        if (mode.scatterLuck) out.luckCount = 3;
        g.forEach((reel, i) => reel.forEach((id, row) => { if (id === mode.scatter.sym && !out.expanded) hit.add(i + ':' + row); }));
        out.hits = [...hit].map(x => x.split(':').map(Number));
      }
    }
    if (mode.luckSym) {
      const at = [0, 1, 2].filter(i => g[i][1] === mode.luckSym);
      out.luckCount = at.length;
      at.forEach(i => hit.add(i + ':1'));
      out.hits = [...hit].map(x => x.split(':').map(Number));
    }
    return out;
  }

  const finalWin = (raw, stake, luckMult) => Math.min(Math.round(raw * (luckMult > 1 ? luckMult : 1)), stake * MAX_X);

  root.Slots = { MODES, ORDER, ALL_IDS, pick, makeGrid, resolve, finalWin, MAX_X };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Slots;
})(typeof window !== 'undefined' ? window : globalThis);
