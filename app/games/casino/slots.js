'use strict';
// Spielmodi des Automaten: reine Regeln ohne DOM, damit sie sich auch in Node durchrechnen lassen.
(function (root) {
  const FIVE = [[1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2]]; // Zeile je Walze
  const MAX_X = 200; // Gewinn pro Runde nie über das 200-Fache des Einsatzes

  const MODES = {
    classic: {
      id: 'classic', name: 'Klassik', tag: '1 Linie',
      note: 'Nur die mittlere Linie zählt',
      reels: 3, lines: [[1, 1, 1]], top: 'seven',
      syms: [
        { id: 'seven',   name: 'Sieben',  w: 1,  m: 200 },
        { id: 'diamond', name: 'Diamant', w: 2,  m: 80 },
        { id: 'bell',    name: 'Glocke',  w: 4,  m: 40 },
        { id: 'enya',    name: 'Enya',    w: 2,  m: 30 },
        { id: 'star',    name: 'Stern',   w: 6,  m: 20 },
        { id: 'cherry',  name: 'Kirsche', w: 9,  m: 12 },
        { id: 'lemon',   name: 'Zitrone', w: 10, m: 8 },
        { id: 'grape',   name: 'Traube',  w: 12, m: 8 },
        { id: 'bar',     name: 'BAR',     w: 18, m: 6 },
      ],
      pair: 1.4, pairAny: true, noPay: ['enya'],
      starAward: { trio: 5, pair: 2 },
      luckSym: 'enya',
      rules: [
        'Zwei gleiche;×1,4',
        'Zwei / drei Sterne;+2 / +5 Frei',
        '1 / 2 / 3 Enya;15 Sek ×1,2 / 20 Sek ×1,3 / 30 Sek ×1,5',
      ],
    },

    fruit: {
      id: 'fruit', name: 'Fruchtfieber', tag: '5 Linien',
      note: '5 Linien · Stern ist Wild (außer für die Sieben)',
      reels: 5, lines: FIVE, top: 'seven', wild: 'star', wildPays: 'diamond', noWild: ['seven'],
      syms: [
        { id: 'seven',   name: 'Sieben',  w: 2,  m: 50 },
        { id: 'diamond', name: 'Diamant', w: 3,  m: 20 },
        { id: 'bell',    name: 'Glocke',  w: 5,  m: 10 },
        { id: 'star',    name: 'Stern (Wild)', w: 5, m: 0 },
        { id: 'cherry',  name: 'Kirsche', w: 9,  m: 5 },
        { id: 'lemon',   name: 'Zitrone', w: 11, m: 4 },
        { id: 'grape',   name: 'Traube',  w: 12, m: 3 },
        { id: 'bar',     name: 'BAR',     w: 13, m: 2 },
      ],
      pair: 1.0, lenMult: { 4: 3, 5: 10 },
      rules: [
        'Drei gleiche auf einer Linie;Wert × Linieneinsatz',
        'Vier / fünf gleiche;Wert ×3 / ×10',
        'Zwei gleiche von links;×1,2',
        'Stern;ersetzt alle außer Sieben',
      ],
    },

    enya: {
      id: 'enya', name: 'Enya Special', tag: 'Spezial',
      note: '5 Linien · Enya ist Wild · nur 1 Stunde pro Tag',
      reels: 5, lines: FIVE, top: 'crown', wild: 'enya', wildPays: 'crown', expand: 2,
      syms: [
        { id: 'crown', name: 'Krone',  w: 2,  m: 25 },
        { id: 'harp',  name: 'Harfe',  w: 3,  m: 10 },
        { id: 'moon',  name: 'Mond',   w: 5,  m: 5 },
        { id: 'note',  name: 'Note',   w: 8,  m: 3 },
        { id: 'wave',  name: 'Welle',  w: 11, m: 2 },
        { id: 'star',  name: 'Stern',  w: 14, m: 2 },
        { id: 'enya',  name: 'Enya (Wild)', w: 3, m: 0 },
      ],
      pair: 0.1,
      lenMult: { 4: 3, 5: 10 },
      scatter: { sym: 'enya', awards: { 4: 3, 5: 5, 6: 8, 7: 12 } },
      freeMult: 2, scatterLuck: true,
      rules: [
        'Drei gleiche auf einer Linie;Wert × Linieneinsatz',
        'Vier / fünf gleiche;Wert ×3 / ×10',
        'Zwei gleiche von links;×0,1',
        'Enya;Wild, ersetzt alles',
        'Enya in der Mitte;füllt die ganze Walze',
        '4 / 5 / 6 / 7+ Enya irgendwo;3 / 5 / 8 / 12 Freispiele + 30 Sek ×1,5 Glück',
        'Im Freispiel;alle Gewinne ×2',
      ],
    },
  };

  // Walzenzahl je Modus: Standard steht oben, die andere Variante hier als Überschreibung.
  // Auszahlungswerte sind per Simulation auf die Ziel-Quote nachgestellt (siehe RTP).
  const ALT = {
    classic: { 5: {
      reels: 5, lines: [[1, 1, 1, 1, 1]], lenMult: { 4: 3, 5: 10 }, pair: 0.5, anyRun: true, scatterPay: 0.4,
      m: { seven: 100, diamond: 40, bell: 18, enya: 14, star: 9, cherry: 6, lemon: 4, grape: 4, bar: 2.5 },
      note: 'Nur die mittlere Linie zählt · Gewinn auch mitten auf der Linie',
      rules: [
        'Drei gleiche in Folge;Wert, egal wo sie beginnen',
        'Vier / fünf gleiche in Folge;Wert ×3 / ×10',
        'Drei gleiche verstreut auf der Linie;Wert ×0,4',
        'Zwei gleiche nebeneinander, egal wo;×0,5',
        'Zwei / drei Sterne von links;+2 / +5 Frei',
        '1 / 2 / 3+ Enya in der Mitte;15 Sek ×1,2 / 20 Sek ×1,3 / 30 Sek ×1,5',
      ],
    } },
    fruit: { 3: {
      reels: 3, lines: FIVE.map(l => l.slice(0, 3)), lenMult: null, pair: 1.2,
      m: { seven: 85, diamond: 34, bell: 17, cherry: 9, lemon: 7, grape: 5, bar: 4 },
      rules: [
        'Drei gleiche auf einer Linie;Wert × Linieneinsatz',
        'Zwei gleiche von links;×1',
        'Stern;ersetzt alle außer Sieben',
      ],
    } },
    enya: { 3: {
      reels: 3, lines: FIVE.map(l => l.slice(0, 3)), lenMult: null, expand: 1, pair: 0.4,
      m: { crown: 50, harp: 20, moon: 10, note: 6, wave: 3, star: 3 },
      scatter: { sym: 'enya', awards: { 3: 3, 4: 5, 5: 8, 6: 12 } },
      rules: [
        'Drei gleiche auf einer Linie;Wert × Linieneinsatz',
        'Zwei gleiche von links;×0,4',
        'Enya;Wild, ersetzt alles',
        'Enya in der Mitte;füllt die ganze Walze',
        '3 / 4 / 5 / 6+ Enya irgendwo;3 / 5 / 8 / 12 Freispiele + 30 Sek ×1,5 Glück',
        'Im Freispiel;alle Gewinne ×2',
      ],
    } },
  };
  const ORDER = ['classic', 'fruit', 'enya'];
  for (const m of Object.values(MODES)) {
    m.by = Object.fromEntries(m.syms.map(s => [s.id, s]));
    m.pool = m.syms.flatMap(s => Array(s.w).fill(s.id));
  }
  // Modus mit gewünschter Walzenzahl (3 oder 5)
  const cache = {};
  function forReels(id, n) {
    const base = MODES[id];
    if (!n || n === base.reels || !ALT[id] || !ALT[id][n]) return base;
    const key = id + n;
    if (!cache[key]) {
      const m = Object.assign({}, base, ALT[id][n]);
      if (m.m) {
        m.syms = base.syms.map(x => (m.m[x.id] ? { ...x, m: m.m[x.id] } : x));
        m.by = Object.fromEntries(m.syms.map(x => [x.id, x]));
      }
      cache[key] = m;
    }
    return cache[key];
  }
  const ALL_IDS = new Set(Object.values(MODES).flatMap(m => m.syms.map(s => s.id)));

  const pick = (mode, rnd) => mode.pool[Math.floor((rnd || Math.random)() * mode.pool.length)];
  const makeGrid = (mode, rnd) => Array.from({ length: mode.reels }, () => [pick(mode, rnd), pick(mode, rnd), pick(mode, rnd)]);

  // Eine Linie: { mult, cells (Walzen-Indizes), sym, kind } oder null
  function scoreLine(mode, ids) {
    if (!mode.wild && ids.length > 3) {
      let k = 1;
      while (k < ids.length && ids[k] === ids[0]) k++;
      let sym = ids[0];
      if (mode.anyRun) { // mehr Kombis auf der Mittellinie: Serie, Paar und verstreute Gleiche irgendwo
        const pays = id => !(mode.noPay && mode.noPay.includes(id));
        let best = null;
        const take = (mult, cells, id, kind) => { if (pays(id) && (!best || mult > best.mult)) best = { mult, cells, sym: id, kind }; };
        for (let i = 0; i < ids.length;) {
          let j = i + 1; while (j < ids.length && ids[j] === ids[i]) j++;
          const n = j - i, cells = ids.slice(i, j).map((_, x) => i + x);
          if (n >= 3) take(mode.by[ids[i]].m * ((mode.lenMult && mode.lenMult[n]) || 1), cells, ids[i], 'trio');
          else if (n === 2) take(mode.pair, cells, ids[i], 'pair');
          i = j;
        }
        for (const id of new Set(ids)) {
          const cells = ids.map((x, i) => (x === id ? i : -1)).filter(i => i >= 0);
          if (cells.length >= 3) take(mode.by[id].m * mode.scatterPay, cells, id, 'trio');
        }
        return best;
      }
      if (k < 2 || (k < 3 && !mode.pair)) return null;
      if (mode.noPay && mode.noPay.includes(sym)) return { mult: 0, cells: [], sym, kind: k >= 3 ? 'trio' : 'pair' };
      if (k < 3) return { mult: mode.pair, cells: [0, 1], sym, kind: 'pair' };
      return { mult: mode.by[sym].m * ((mode.lenMult && mode.lenMult[k]) || 1), cells: ids.slice(0, k).map((_, i) => i), sym, kind: 'trio' };
    }
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
    // Serie von links: Basis ist das erste echte Symbol (nur Wilds: wildPays), gezählt wird, solange es passt
    const base = ids.find(id => !isW(id)) || mode.wildPays;
    let k = 0;
    while (k < ids.length && fits(ids[k], base)) k++;
    if (k >= 3) {
      const lm = (mode.lenMult && mode.lenMult[k]) || 1;
      return { mult: mode.by[base].m * lm, cells: ids.slice(0, k).map((_, i) => i), sym: base, kind: 'trio' };
    }
    const real2 = ids.slice(0, 2).find(id => !isW(id));
    const b2 = real2 || mode.wildPays;
    if (mode.pair && ids.slice(0, 2).every(id => fits(id, b2))) return { mult: mode.pair, cells: [0, 1], sym: b2, kind: 'pair' };
    return null;
  }

  // Rechnet ein Gitter (3 oder 5 Walzen à 3 Zeilen) aus (grid[walze][zeile]). Glück und Deckel kommen erst in finalWin.
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
      const at = g.map((_, i) => i).filter(i => g[i][1] === mode.luckSym);
      out.luckCount = Math.min(at.length, 3);
      at.forEach(i => hit.add(i + ':1'));
      out.hits = [...hit].map(x => x.split(':').map(Number));
    }
    return out;
  }

  const finalWin = (raw, stake, luckMult) => Math.min(Math.round(raw * (luckMult > 1 ? luckMult : 1)), stake * MAX_X);

  root.Slots = { MODES, ORDER, forReels, ALL_IDS, pick, makeGrid, resolve, finalWin, MAX_X };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Slots;
})(typeof window !== 'undefined' ? window : globalThis);
