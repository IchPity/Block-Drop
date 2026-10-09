/* ════════════════════════════════════════════════════════════════════
   Startseite: 3D-Objekte der Halle (OG und ADHS)

   Jedes Spiel hat einen Körper aus Würfeln, die Zelle der Röhren im
   Raum weitergedacht: auf den großen Automaten dreht er sich als
   Aufsatz an der Stange, bei den kleinen ragt er aus der Röhre.
   Gezeichnet wird auf <canvas class="v3" data-model="…"> mit Canvas 2D
   (eigene Perspektive, Flächen nach Tiefe sortiert), also auch ohne
   WebGL. Licht wie überall: UV von oben, von unten die Akzentfarbe
   des Geräts. Bei prefers-reduced-motion steht ein Standbild.
   ════════════════════════════════════════════════════════════════════ */
(() => {
  const root = document.documentElement;
  if (root.classList.contains('fx-design')) return; // Cinema hat seine eigene Bühne
  const canvases = [...document.querySelectorAll('canvas.v3')];
  if (!canvases.length || !canvases[0].getContext) return;
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Matrizen: 3 Zeilen, 4 Spalten ──
  const mul = (a, b) => [
    a[0] * b[0] + a[1] * b[4] + a[2] * b[8], a[0] * b[1] + a[1] * b[5] + a[2] * b[9], a[0] * b[2] + a[1] * b[6] + a[2] * b[10], a[0] * b[3] + a[1] * b[7] + a[2] * b[11] + a[3],
    a[4] * b[0] + a[5] * b[4] + a[6] * b[8], a[4] * b[1] + a[5] * b[5] + a[6] * b[9], a[4] * b[2] + a[5] * b[6] + a[6] * b[10], a[4] * b[3] + a[5] * b[7] + a[6] * b[11] + a[7],
    a[8] * b[0] + a[9] * b[4] + a[10] * b[8], a[8] * b[1] + a[9] * b[5] + a[10] * b[9], a[8] * b[2] + a[9] * b[6] + a[10] * b[10], a[8] * b[3] + a[9] * b[7] + a[10] * b[11] + a[11],
  ];
  const T = (x, y, z) => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z];
  const S = (x, y, z) => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0];
  const RX = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0]; };
  const RY = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0]; };
  const RZ = a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0]; };
  // verschieben, drehen (x, y, z) und strecken um einen Drehpunkt
  const trs = (p, r, s, pv = [0, 0, 0]) => {
    let m = T(-pv[0], -pv[1], -pv[2]);
    if (s) m = mul(S(s[0], s[1], s[2]), m);
    if (r) { if (r[0]) m = mul(RX(r[0]), m); if (r[2]) m = mul(RZ(r[2]), m); if (r[1]) m = mul(RY(r[1]), m); }
    return mul(T(pv[0] + p[0], pv[1] + p[1], pv[2] + p[2]), m);
  };

  const fr = x => x - Math.floor(x);
  const tri = x => 1 - 4 * Math.abs(fr(x) - 0.5);            // Dreieck -1 … 1
  const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  const box = (x, y, z, w, h, d, c) => { const v = []; for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) for (let k = 0; k < d; k++) v.push([x + i, y + j, z + k, c]); return v; };
  // Zeilen von oben nach unten, ein Zeichen je Würfel
  const rows = (map, pal, z = 0, d = 1) => { const v = []; map.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (pal[r[i]]) for (let k = 0; k < d; k++) v.push([i, map.length - 1 - j, z + k, pal[r[i]]]); }); return v; };

  // ── Die Körper ──
  // c: Mittelpunkt, ex: halbe Breite und Höhe fürs Einpassen, spin (rad/s) oder swing [Ausschlag, Tempo]
  const MODELS = {
    // Block Drop: der T-Stein fällt in die Lücke, drei Reihen blitzen und sind weg
    blockdrop: () => {
      const stack = rows(['...B', 'A.BB', 'AAAB'], { A: '#ff8a2e', B: '#2ee6ff' });
      const piece = rows(['TTT', '.T.'], { T: '#a35cff' });
      const ph = t => fr(t / 3.6) * 3.6;
      const flash = a => a > 2.3 && a < 3.1 && Math.floor(a / 0.13) % 2 ? 2 : 1;
      return { c: [2, 3.1, 0.5], ex: [3.3, 3.7], spin: 0.7, still: 2, groups: [
        { v: stack, vis: t => { const a = ph(t); return a >= 3.1 ? 0 : flash(a); } },
        { v: piece, at: t => T(0, 1 + (3 - Math.min(3, Math.floor(Math.max(0, ph(t) - 0.5) / 0.4))), 0),
          vis: t => { const a = ph(t); return a < 0.5 || a >= 3.1 ? 0 : flash(a); } },
      ] };
    },
    // Block Presser: der Stempel fährt herunter und staucht den Block
    presser: () => {
      const ram = t => { const p = fr(t / 1.7); return p < 0.5 ? 3.9 : p < 0.6 ? 3.9 - 1.9 * Math.pow((p - 0.5) / 0.1, 2) : p < 0.74 ? 2 : 2 + 1.9 * smooth((p - 0.74) / 0.26); };
      return { c: [2.5, 3, 1.5], ex: [3.9, 4.1], swing: [0.95, 0.6], pitch: 0.26, still: 0.95, groups: [
        { v: [...box(0, 0, 0, 5, 1, 3, '#8f86b3'), ...box(0, 5, 0, 5, 1, 3, '#cfc8ea'), ...box(0, 1, 1, 1, 4, 1, '#5a517c'), ...box(4, 1, 1, 1, 4, 1, '#5a517c')] },
        { v: box(1, 1, 0, 3, 2, 3, '#ffb000'), at: t => { const h = Math.min(2, ram(t) - 1) / 2; return trs([0, 0, 0], null, [1 + (1 - h) * 0.3, h, 1 + (1 - h) * 0.5], [2.5, 1, 1.5]); } },
        { v: box(1, 0, 0, 3, 1, 3, '#cfc8ea'), at: t => T(0, ram(t), 0) },
        { v: box(2, 4, 1, 1, 1, 1, '#8f86b3'), at: t => trs([0, 0, 0], null, [1, 4 - ram(t), 1], [2.5, 5, 1.5]) },
      ] };
    },
    // Casino: die rote Sieben, zwei Münzen kreisen
    casino: () => {
      const coin = rows(['.##.', '####', '####', '.##.'], { '#': '#ffd23f' });
      const orbit = ph => t => { const a = t * 1.5 + ph; return trs([2.5 + Math.cos(a) * 3.9 - 2, 3.5 + Math.sin(a * 2) * 0.6 - 2, 1 + Math.sin(a) * 3.9 - 0.5], [0, a * 2.4, 0], [0.62, 0.62, 0.3], [2, 2, 0.5]); };
      return { c: [2.5, 3.5, 1], ex: [5.2, 4.4], spin: 0.6, yaw0: 0.5, groups: [
        { v: rows(['#####', '#####', '...##', '..##.', '..##.', '.##..', '.##..'], { '#': '#e0102f' }, 0, 2) },
        { v: coin, at: orbit(0) }, { v: coin, at: orbit(Math.PI) },
      ] };
    },
    // Block Games: zwei Würfel rollen durch die Luft
    dice: () => {
      const P = { 1: [[3, 3]], 2: [[1, 1], [5, 5]], 3: [[1, 1], [3, 3], [5, 5]], 4: [[1, 1], [1, 5], [5, 1], [5, 5]], 5: [[1, 1], [1, 5], [3, 3], [5, 1], [5, 5]], 6: [[1, 1], [1, 3], [1, 5], [5, 1], [5, 3], [5, 5]] };
      const pip = (n, u, w) => P[n].some(q => q[0] === u && q[1] === w);
      const die = (col, ink) => { const v = []; for (let x = 0; x < 7; x++) for (let y = 0; y < 7; y++) for (let z = 0; z < 7; z++) {
        const on = (z === 6 && pip(1, x, y)) || (z === 0 && pip(6, x, y)) || (x === 6 && pip(3, y, z)) || (x === 0 && pip(4, y, z)) || (y === 6 && pip(5, x, z)) || (y === 0 && pip(2, x, z));
        v.push([x, y, z, on ? ink : col]);
      } return v; };
      const roll = (x, ph, k) => t => trs([x - 3.5, Math.sin(t * 1.6 + ph) * 0.7 - 3.5, -3.5], [t * 0.9 * k + ph, t * 1.25 * k, t * 0.5 + ph], null, [3.5, 3.5, 3.5]);
      return { c: [0, 0, 0], ex: [13.6, 8.6], swing: [0.25, 0.6], pitch: 0.2, groups: [
        { v: die('#fff6dc', '#1a1000'), at: roll(-6, 0.6, 1) },
        { v: die('#ffb000', '#1a1000'), at: roll(6, 2.4, -0.85) },
      ] };
    },
    // Snake: läuft Zelle für Zelle um das Feld, die Münze liegt in der Mitte
    snake: () => {
      const path = []; for (let i = 0; i < 4; i++) path.push([i, 0]); for (let i = 0; i < 4; i++) path.push([4, i]); for (let i = 4; i > 0; i--) path.push([i, 4]); for (let i = 4; i > 0; i--) path.push([0, i]);
      const board = []; for (let x = 0; x < 5; x++) for (let z = 0; z < 5; z++) board.push([x, 0, z, (x + z) % 2 ? '#2b2068' : '#3d2f92']);
      const seg = i => ({ v: [[0, 1, 0, i ? (i % 2 ? '#b8ff3d' : '#8fd61f') : '#efffc4']], at: t => { const p = path[((Math.floor(t / 0.17) - i) % 16 + 16) % 16]; return trs([p[0], 0, p[1]], null, i ? [0.86, 0.86, 0.86] : null, [0.5, 1.5, 0.5]); } });
      return { c: [2.5, 1.1, 2.5], ex: [4.3, 3.3], spin: 0.45, pitch: 0.66, yaw0: 0.6, groups: [
        { v: board, at: () => trs([0, 0, 0], null, [1, 0.3, 1], [2.5, 1, 2.5]) },
        ...[0, 1, 2, 3, 4, 5, 6].map(seg),
        { v: [[2, 1, 2, '#ffb000']], glow: true, at: t => trs([0, 0.25 + Math.sin(t * 3) * 0.12, 0], [0, t * 2.6, 0], [0.7, 0.7, 0.26], [2.5, 1.5, 2.5]) },
      ] };
    },
    // Pong: zwei Schläger, der Ball geht hin und her
    pong: () => {
      const by = t => 3 + tri(t * 0.37 + 0.2) * 3, pad = t => Math.max(0, Math.min(4, by(t) - 1));
      return { c: [5, 3.5, 0.5], ex: [6.1, 4.5], swing: [0.7, 0.7], pitch: 0.24, groups: [
        { v: box(0, 0, 0, 1, 3, 1, '#2ee6ff'), at: t => T(0, pad(t - 0.06), 0) },
        { v: box(9, 0, 0, 1, 3, 1, '#ff3d9a'), at: t => T(0, pad(t - 0.1), 0) },
        { v: [0, 2, 4, 6].map(y => [4.5, y, 0, '#8d82c8']), at: () => trs([0, 0, 0], null, [0.3, 1, 0.3], [5, 0, 0.5]) },
        { v: [[0, 0, 0, '#ffb000']], glow: true, at: t => T(4.5 + tri(t * 0.55) * 3.5, by(t), 0) },
      ] };
    },
    // Space Blaster: das Schiff schießt auf die Noten
    space: () => {
      const hit = t => fr(t / 0.62);
      const foe = (x, col, target) => ({ v: [[x, 6.6, 0, col]], at: t => T(Math.floor(t / 0.55) % 2 ? 0.3 : -0.3, 0, 0), vis: target ? (t => hit(t) > 0.82 ? 2 : 1) : null });
      return { c: [2.5, 3.3, 0.5], ex: [4, 5.7], swing: [0.75, 0.8], pitch: 0.3, groups: [
        { v: [...rows(['..#..', '..#..', '.###.', 'W###W', 'W.#.W'], { '#': '#f3eeff', W: '#9b7bff' }), [2, 2, 1, '#2ee6ff'], [2, 3, 1, '#2ee6ff']] },
        { v: [[0, -1, 0, '#ffb000'], [2, -1, 0, '#ffb000'], [4, -1, 0, '#ffb000']], glow: true, at: t => trs([0, 0, 0], null, [0.6, 0.55 + fr(t * 9) * 0.6, 0.6], [2.5, 0, 0.5]) },
        { v: [[2, 5, 0, '#ff2e63']], glow: true, at: t => trs([0, hit(t) * 1.4, 0], null, [0.3, 0.9, 0.3], [2.5, 5.5, 0.5]) },
        foe(0, '#9b7bff'), foe(2, '#ff2e63', true), foe(4, '#9b7bff'),
      ] };
    },
    // Memory Match: zwei Karten drehen sich um, es ist ein Paar
    memory: () => {
      const face = rows(['....', '.##.', '####', '.##.', '....'], { '.': '#f3eeff', '#': '#ffb000' }, 0);
      const card = (x, back, lite, t0, lean) => ({
        v: [...face, ...rows(['####', '#oo#', '#oo#', '#oo#', '####'], { '#': back, o: lite }, 1)],
        at: t => { const a = fr(t / 4.2) * 4.2, flip = smooth((a - t0) / 0.5) - smooth((a - 3.2) / 0.5), hop = a > 1.7 && a < 2.2 ? Math.sin((a - 1.7) / 0.5 * Math.PI) * 0.7 : 0;
          return trs([x - 2, hop - 2.5, -1], [0, flip * Math.PI, lean], [1, 1, 0.22], [2, 2.5, 1]); },
      });
      return { c: [0, 0, 0], ex: [5.6, 3.7], swing: [0.45, 0.55], pitch: 0.16, still: 2.5, groups: [
        card(-2.6, '#ff3d9a', '#ff9cc9', 0.4, 0.1), card(2.6, '#2ee6ff', '#aef5ff', 1.0, -0.1),
      ] };
    },
    // Minesweeper: die Stinkbombe, die Lunte brennt
    mines: () => {
      const ball = []; for (let x = 0; x < 7; x++) for (let y = 0; y < 7; y++) for (let z = 0; z < 7; z++) if ((x - 3) ** 2 + (y - 3) ** 2 + (z - 3) ** 2 <= 10) ball.push([x, y, z, x <= 2 && y >= 4 && z >= 4 ? '#b3a8f0' : '#5547a6']);
      return { c: [3.5, 4.7, 3.5], ex: [5.2, 6.4], spin: 0.6, yaw0: -0.4, groups: [
        { v: [...ball, [3, 7, 3, '#cfc8ea'], [3, 8, 3, '#c9b98a'], [4, 9, 3, '#c9b98a']], at: t => { const k = 1 + Math.max(0, Math.sin(t * 4.5)) * 0.05; return trs([0, 0, 0], null, [k, k, k], [3.5, 3.5, 3.5]); } },
        { v: [[4, 10, 3, '#ffb000']], glow: true, vis: t => Math.floor(t / 0.09) % 2 ? 2 : 1, at: t => { const k = 0.7 + fr(t * 7.3) * 0.6; return trs([0, 0, 0], [0, 0, t * 5], [k, k, k], [4.5, 10.3, 3.5]); } },
      ] };
    },
  };

  // ── Würfel in Flächen zerlegen: nur was außen liegt ──
  const FACES = [ // Normale +x, -x, +y, -y, +z, -z und je vier Ecken
    [1, 0, 0, [1, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1]], [-1, 0, 0, [0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0]],
    [0, 1, 0, [0, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0]], [0, -1, 0, [0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1]],
    [0, 0, 1, [0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1]], [0, 0, -1, [0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0]],
  ];
  const hex = h => { h = h.replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  function build(model) {
    let total = 0;
    model.groups.forEach(g => {
      const occ = new Set(g.v.map(v => v[0] + ',' + v[1] + ',' + v[2]));
      const cols = [], vs = [], ns = [], cs = [];
      g.v.forEach(([x, y, z, col]) => {
        let ci = cols.indexOf(col); if (ci < 0) ci = cols.push(col) - 1;
        FACES.forEach((f, ni) => {
          if (occ.has((x + f[0]) + ',' + (y + f[1]) + ',' + (z + f[2]))) return;
          for (let i = 0; i < 12; i += 3) vs.push(x + f[3][i], y + f[3][i + 1], z + f[3][i + 2]);
          ns.push(ni); cs.push(ci);
        });
      });
      g.fv = new Float32Array(vs); g.fn = ns; g.fc = cs; g.rgb = cols.map(hex); g.n = ns.length;
      total += g.n;
    });
    model.total = total;
    return model;
  }

  // ── Zeichnen ──
  const L = [-0.42, 0.78, 0.46]; // Licht von oben links vorn
  const P = new Float32Array(8 * 900), DEP = new Float32Array(900), STY = new Array(900), ORD = [];
  const NRM = new Float32Array(18), sty = [];
  function render(o) {
    const { ctx, W, H, model: m, acc } = o, t = o.t;
    ctx.clearRect(0, 0, W, H);
    const D = m.dist || Math.max(m.ex[0], m.ex[1]) * 3.4;
    const u = Math.min(W / (2 * m.ex[0]), H / (2 * m.ex[1])) * 0.86;
    const G = mul(RX(m.pitch == null ? 0.32 : m.pitch), mul(RY(o.yaw), T(-m.c[0], -m.c[1], -m.c[2])));
    let n = 0;
    for (const g of m.groups) {
      const vis = g.vis ? g.vis(t) : 1;
      if (!vis) continue;
      const M = g.at ? mul(G, g.at(t)) : G;
      for (let k = 0; k < 3; k++) { // die sechs Normalen sind die Spalten der Matrix
        const x = M[k], y = M[4 + k], z = M[8 + k], l = Math.hypot(x, y, z) || 1;
        NRM[k * 6] = x / l; NRM[k * 6 + 1] = y / l; NRM[k * 6 + 2] = z / l;
        NRM[k * 6 + 3] = -x / l; NRM[k * 6 + 4] = -y / l; NRM[k * 6 + 5] = -z / l;
      }
      for (let ni = 0; ni < 6; ni++) { // eine Farbe je Richtung und Würfelfarbe
        const nx = NRM[ni * 3], ny = NRM[ni * 3 + 1], nz = NRM[ni * 3 + 2];
        const d = nx * L[0] + ny * L[1] + nz * L[2], lit = 0.45 + 0.55 * Math.max(0, d), dark = 1 - lit;
        const under = Math.max(0, -ny) * 0.6 + Math.max(0, -d) * 0.12; // Schein des Geräts von unten
        sty[ni] = g.rgb.map(c => vis === 2 ? '#ffffff' : g.glow ? `rgb(${c[0]},${c[1]},${c[2]})` :
          `rgb(${Math.min(255, c[0] * lit * (1 - under * 0.6) + acc[0] * under * 0.8 + dark * 16) | 0},${Math.min(255, c[1] * lit * (1 - under * 0.6) + acc[1] * under * 0.8 + dark * 9) | 0},${Math.min(255, c[2] * lit * (1 - under * 0.6) + acc[2] * under * 0.8 + dark * 44) | 0})`);
      }
      const fv = g.fv;
      for (let f = 0; f < g.n && n < 900; f++) {
        const ni = g.fn[f], nx = NRM[ni * 3], ny = NRM[ni * 3 + 1], nz = NRM[ni * 3 + 2], b = f * 12;
        let cx = 0, cy = 0, cz = 0;
        for (let i = 0; i < 4; i++) {
          const x = fv[b + i * 3], y = fv[b + i * 3 + 1], z = fv[b + i * 3 + 2];
          const X = M[0] * x + M[1] * y + M[2] * z + M[3], Y = M[4] * x + M[5] * y + M[6] * z + M[7], Z = M[8] * x + M[9] * y + M[10] * z + M[11];
          const k = D / (D - Z) * u;
          P[n * 8 + i * 2] = W / 2 + X * k; P[n * 8 + i * 2 + 1] = H / 2 - Y * k;
          cx += X; cy += Y; cz += Z;
        }
        cx /= 4; cy /= 4; cz /= 4;
        if (nx * -cx + ny * -cy + nz * (D - cz) <= 0) continue; // zeigt von der Kamera weg
        DEP[n] = cz; STY[n] = sty[ni][g.fc[f]] + (g.glow || vis === 2 ? '*' : ''); n++;
      }
    }
    ORD.length = n; for (let i = 0; i < n; i++) ORD[i] = i;
    ORD.sort((a, b) => DEP[a] - DEP[b]);
    ctx.lineWidth = Math.max(1, o.dpr * 0.9); ctx.lineJoin = 'round';
    for (let j = 0; j < n; j++) {
      const i = ORD[j] * 8; let s = STY[ORD[j]];
      const lamp = s.charCodeAt(s.length - 1) === 42; if (lamp) s = s.slice(0, -1);
      ctx.beginPath(); ctx.moveTo(P[i], P[i + 1]); ctx.lineTo(P[i + 2], P[i + 3]); ctx.lineTo(P[i + 4], P[i + 5]); ctx.lineTo(P[i + 6], P[i + 7]); ctx.closePath();
      ctx.fillStyle = s; ctx.fill();
      ctx.strokeStyle = lamp ? s : 'rgba(10,5,32,0.6)'; ctx.stroke(); // die Fuge zwischen den Zellen
    }
  }

  // ── Einhängen ──
  const objs = canvases.map((cv, i) => {
    const make = MODELS[cv.dataset.model]; if (!make) return null;
    const host = cv.closest('a');
    let acc = [255, 176, 0];
    try { const a = getComputedStyle(host || cv).getPropertyValue('--accent').trim(); if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(a)) acc = hex(a); } catch (e) {}
    const model = build(make());
    return { cv, i, host, acc, model, ctx: cv.getContext('2d'), W: 0, H: 0, dpr: 1, t: model.still || 0, spin: 0, yaw: model.yaw0 || 0, near: 0, vis: true };
  }).filter(Boolean);
  if (!objs.length) return;
  root.classList.add('js-3d');

  const yawOf = o => (o.model.yaw0 || 0) + (o.model.swing ? Math.sin(o.spin * o.model.swing[1]) * o.model.swing[0] : o.spin * (o.model.spin || 0));
  function measure() {
    objs.forEach(o => {
      const dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(o.cv.clientWidth * dpr), h = Math.round(o.cv.clientHeight * dpr);
      if (w === o.W && h === o.H) return;
      o.dpr = dpr; o.W = o.cv.width = w; o.H = o.cv.height = h;
      if (w && h) render(o);
    });
  }
  measure(); addEventListener('resize', measure);
  if (REDUCED) return; // Standbild

  if ('IntersectionObserver' in window) {
    const seen = new IntersectionObserver(es => es.forEach(en => { const o = objs.find(x => x.cv === en.target); if (o) o.vis = en.isIntersecting; }), { rootMargin: '60px' });
    objs.forEach(o => seen.observe(o.cv));
  }
  let last = 0, frame = 0;
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; frame++;
    const calm = root.classList.contains('fx-calm') ? 0.75 : 1.15; // OG ruhiger, ADHS schneller
    for (const o of objs) {
      if (!o.vis || !o.W || !o.H) continue;
      const want = o.host && (o.host.classList.contains('is-near') || o.host === document.activeElement) ? 1 : 0;
      o.near += (want - o.near) * Math.min(1, dt * 7);
      o.t += dt * calm * (1 + o.near * 0.9);
      o.spin += dt * calm * (1 + o.near * 2.4);
      if (o.near < 0.02 && (frame + o.i) % 2) continue; // im Leerlauf reicht jedes zweite Bild
      o.yaw = yawOf(o);
      render(o);
    }
  }
  requestAnimationFrame(tick);
})();
