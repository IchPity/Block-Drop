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
        { id: 'seven',   name: 'Sieben',  w: 2,  m: 32 },
        { id: 'diamond', name: 'Diamant', w: 3,  m: 13 },
        { id: 'bell',    name: 'Glocke',  w: 5,  m: 6.5 },
        { id: 'star',    name: 'Stern (Wild)', w: 5, m: 0 },
        { id: 'cherry',  name: 'Kirsche', w: 9,  m: 3 },
        { id: 'lemon',   name: 'Zitrone', w: 11, m: 2.3 },
        { id: 'grape',   name: 'Traube',  w: 12, m: 2 },
        { id: 'bar',     name: 'BAR',     w: 13, m: 1.3 },
      ],
      pair: 0.2, lenMult: { 4: 3, 5: 10 }, anyRun: true, strayPay: 0.1, splitPair: 0.02,
      rules: [
        'Drei gleiche in Folge auf einer Linie;Wert × Linieneinsatz, egal wo sie beginnen',
        'Vier / fünf gleiche in Folge;Wert ×3 / ×10',
        'Weiteres gleiches Symbol auf der Linie;je ×0,1 des Werts dazu',
        'Zwei gleiche nebeneinander;×0,2',
        'Zwei gleiche getrennt;×0,02',
        'Verschiedene Symbole auf einer Linie;Gewinne addieren sich',
        'Stern;ersetzt alle außer Sieben',
      ],
    },

    enya: {
      id: 'enya', name: 'Enya Special', tag: 'Spezial',
      note: '5 Linien · Enya ist Wild · nur 1 Stunde pro Tag',
      reels: 5, lines: FIVE, top: 'crown', wild: 'enya', wildPays: 'crown', expand: 2,
      syms: [
        { id: 'crown', name: 'Krone',  w: 2,  m: 15 },
        { id: 'harp',  name: 'Harfe',  w: 3,  m: 6 },
        { id: 'moon',  name: 'Mond',   w: 5,  m: 3 },
        { id: 'note',  name: 'Note',   w: 8,  m: 2 },
        { id: 'wave',  name: 'Welle',  w: 11, m: 1.2 },
        { id: 'star',  name: 'Stern',  w: 14, m: 1.2 },
        { id: 'enya',  name: 'Enya (Wild)', w: 3, m: 0 },
      ],
      pair: 0.03, anyRun: true, strayPay: 0.1, splitPair: 0.01,
      lenMult: { 4: 3, 5: 10 },
      scatter: { sym: 'enya', awards: { 4: 3, 5: 5, 6: 8, 7: 12 } },
      freeMult: 2, scatterLuck: true,
      rules: [
        'Drei gleiche in Folge auf einer Linie;Wert × Linieneinsatz, egal wo sie beginnen',
        'Vier / fünf gleiche in Folge;Wert ×3 / ×10',
        'Weiteres gleiches Symbol auf der Linie;je ×0,1 des Werts dazu',
        'Zwei gleiche nebeneinander;×0,03',
        'Zwei gleiche getrennt;×0,01',
        'Verschiedene Symbole auf einer Linie;Gewinne addieren sich',
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
      reels: 5, lines: [[1, 1, 1, 1, 1]], cluster: { 3: 0.11, 4: 0.28, 5: 0.55, 6: 1, 7: 1.65, 8: 2.75, 9: 4.4 }, clusterScale: 1, pair: 0.04,
      m: { seven: 100, diamond: 40, bell: 18, enya: 14, star: 9, cherry: 6, lemon: 4, grape: 4, bar: 2.5 },
      note: 'Cluster-Gewinn: Gleiche, die sich berühren, zählen · egal auf welcher Reihe',
      rules: [
        'Gleiche Symbole, die sich berühren (oben, unten, seitlich);bilden ein Cluster',
        'Zwei im Cluster;×0,04',
        'Drei / vier / fünf im Cluster;Wert ×0,11 / ×0,28 / ×0,55',
        'Sechs / sieben / acht / neun+ im Cluster;Wert ×1 / ×1,65 / ×2,75 / ×4,4',
        'Mehrere Cluster;Gewinne addieren sich',
        'Zwei / drei Sterne von links;+2 / +5 Frei',
        '1 / 2 / 3+ Enya in der Mitte;15 Sek ×1,2 / 20 Sek ×1,3 / 30 Sek ×1,5',
      ],
    } },
    fruit: { 3: {
      reels: 3, lines: FIVE.map(l => l.slice(0, 3)), lenMult: null, anyRun: false, pair: 1.2,
      m: { seven: 85, diamond: 34, bell: 17, cherry: 9, lemon: 7, grape: 5, bar: 4 },
      rules: [
        'Drei gleiche auf einer Linie;Wert × Linieneinsatz',
        'Zwei gleiche von links;×1',
        'Stern;ersetzt alle außer Sieben',
      ],
    } },
    enya: { 3: {
      reels: 3, lines: FIVE.map(l => l.slice(0, 3)), lenMult: null, anyRun: false, expand: 1, pair: 0.4,
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
        // Je Symbol zählt die beste Kombi; verschiedene Symbole zahlen nebeneinander (BAR-Serie + Trauben an den Rändern)
        const per = {};
        const take = (mult, cells, id, kind) => { if (pays(id) && (!per[id] || mult > per[id].mult)) per[id] = { mult, cells, sym: id, kind }; };
        for (let i = 0; i < ids.length;) {
          let j = i + 1; while (j < ids.length && ids[j] === ids[i]) j++;
          const n = j - i, cells = ids.slice(i, j).map((_, x) => i + x);
          if (n >= 3) take(mode.by[ids[i]].m * ((mode.lenMult && mode.lenMult[n]) || 1), cells, ids[i], 'trio');
          else if (n === 2) take(mode.pair, cells, ids[i], 'pair');
          i = j;
        }
        for (const id of new Set(ids)) {
          const cells = ids.map((x, i) => (x === id ? i : -1)).filter(i => i >= 0);
          const run = per[id];
          if (run && run.kind === 'trio' && run.cells.length >= 3 && cells.length > run.cells.length) { // Serie plus Einzelne auf der Linie
            run.mult += mode.by[id].m * mode.strayPay * (cells.length - run.cells.length);
            run.cells = cells;
          } else if (cells.length >= 3) take(mode.by[id].m * mode.scatterPay, cells, id, 'trio');
          else if (cells.length === 2) take(mode.splitPair, cells, id, 'pair');
        }
        const all = Object.values(per);
        if (!all.length) return null;
        const top = all.reduce((a, b) => (b.mult > a.mult ? b : a));
        return { mult: all.reduce((s, r) => s + r.mult, 0), cells: all.flatMap(r => r.cells), sym: top.sym, kind: top.kind };
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
    if (mode.anyRun) { // Serie egal wo, Einzelne dazu, verschiedene Symbole addieren sich (Wilds nur für ein Symbol)
      const used = new Set(), found = [];
      const reals = [...new Set(ids.filter(id => !isW(id)))].sort((a, b) => mode.by[b].m - mode.by[a].m);
      if (!reals.length) reals.push(mode.wildPays);
      for (const b of reals) {
        let bestRun = null;
        for (let i = 0; i < ids.length;) {
          if (used.has(i) || !fits(ids[i], b)) { i++; continue; }
          let j = i; while (j < ids.length && !used.has(j) && fits(ids[j], b)) j++;
          if (ids.slice(i, j).some(id => id === b || reals.length === 1 && b === mode.wildPays) && (!bestRun || j - i > bestRun[1] - bestRun[0])) bestRun = [i, j];
          i = j;
        }
        const own = ids.map((id, i) => (id === b && !used.has(i) ? i : -1)).filter(i => i >= 0);
        let r = null;
        if (bestRun && bestRun[1] - bestRun[0] >= 3) {
          const n = bestRun[1] - bestRun[0], cells = ids.slice(bestRun[0], bestRun[1]).map((_, x) => bestRun[0] + x);
          const stray = own.filter(i => !cells.includes(i));
          r = { mult: mode.by[b].m * ((mode.lenMult && mode.lenMult[n]) || 1) + mode.by[b].m * mode.strayPay * stray.length, cells: cells.concat(stray), sym: b, kind: 'trio' };
        } else if (bestRun && bestRun[1] - bestRun[0] === 2 && mode.pair) {
          r = { mult: mode.pair, cells: [bestRun[0], bestRun[0] + 1], sym: b, kind: 'pair' };
        } else if (own.length === 2 && mode.splitPair) {
          r = { mult: mode.splitPair, cells: own, sym: b, kind: 'pair' };
        }
        if (r) { r.cells.forEach(c => used.add(c)); found.push(r); }
      }
      if (!found.length) return null;
      const top = found.reduce((a, b) => (b.mult > a.mult ? b : a));
      return { mult: found.reduce((t, r) => t + r.mult, 0), cells: found.flatMap(r => r.cells), sym: top.sym, kind: top.kind };
    }
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

  // Cluster-Gewinn: zusammenhängende Gruppen gleicher Symbole (oben/unten/links/rechts), egal auf welcher Reihe
  function scoreCluster(mode, g) {
    const seen = new Set(), found = [];
    const R = g.length;
    for (let i = 0; i < R; i++) for (let row = 0; row < 3; row++) {
      if (seen.has(i * 3 + row)) continue;
      const id = g[i][row], cells = [], stack = [[i, row]];
      seen.add(i * 3 + row);
      while (stack.length) {
        const [x, y] = stack.pop();
        cells.push([x, y]);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= R || ny < 0 || ny > 2 || seen.has(nx * 3 + ny) || g[nx][ny] !== id) continue;
          seen.add(nx * 3 + ny);
          stack.push([nx, ny]);
        }
      }
      if (cells.length < 2 || (mode.noPay && mode.noPay.includes(id))) continue;
      const n = cells.length;
      const mult = n === 2 ? mode.pair : mode.by[id].m * mode.cluster[Math.min(n, 9)] * mode.clusterScale;
      found.push({ mult, cells, sym: id, kind: n === 2 ? 'pair' : 'trio' });
    }
    return found;
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
    if (mode.cluster) {
      for (const r of scoreCluster(mode, g)) {
        sum += r.mult; out.lines++;
        r.cells.forEach(([x, y]) => hit.add(x + ':' + y));
        if (!best || r.mult > best.mult) best = r;
        if (r.kind === 'trio' && r.sym === mode.top) out.jackpot = true;
      }
    }
    else for (const ln of mode.lines) {
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
