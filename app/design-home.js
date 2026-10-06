/* ─────────────────────────────────────────────────────────────────────────
   /design-home.js — die Bühne der Startseite im Design-Modus

   Ein Stapel aus Block Drop steht als Skulptur im Dunkeln (Canvas 2D,
   27 Würfel, von Hand projiziert). Eine einzige Zeitleiste:

     Einstieg   Steine fallen ins Bild, das Wort steigt Buchstabe für
                Buchstabe auf, danach Unterzeile, Knopf und Navigation.
     Scrollen   p = 0 … 1 über die Höhe von .dz-track. Das Wort zieht ab,
                der Stapel rückt in die Mitte, dreht sich und löst sich auf,
                der zweite Satz erscheint Wort für Wort. Danach bleibt das
                Feld gedimmt hinter dem Verzeichnis stehen.

   Bewegt werden nur transform und opacity. Ohne Bewegung
   (prefers-reduced-motion) steht ein Standbild.
   ───────────────────────────────────────────────────────────────────────── */
(() => {
  'use strict';
  const root = document.documentElement, dz = document.getElementById('dz');
  if (!dz || !root.classList.contains('fx-design')) return;

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = s => dz.querySelector(s);
  const cv = $('.dz-canvas'), c = cv.getContext('2d');
  const track = $('.dz-track'), h1 = $('.dz-h1'), sub = $('.dz-sub'), act = $('.dz-actions'), cue = $('.dz-cue');
  const say = $('.dz-say'), light = $('.dz-light'), dawn = $('.dz-dawn');
  const words = [...dz.querySelectorAll('.dz-w')];
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, v) => { v = clamp((v - a) / (b - a)); return v * v * (3 - 2 * v); };
  const mix = (a, b, k) => a + (b - a) * k;
  const expo = k => k >= 1 ? 1 : 1 - Math.pow(2, -10 * k);

  // ── Der Stapel: ein Spielfeld mitten in der Partie, darüber der nächste Stein ──
  const FIELD = ['.H....', 'HHHKKC', 'DDFFKC', 'DEFFKC', 'DEEE.C']; // oben → unten
  const TONE = { C: 0.97, D: 0.84, E: 0.93, F: 0.8, H: 0.9, K: 0.87 };
  const NEXT = [[2, 5], [3, 5], [3, 6], [4, 6]];
  const BONE = [236, 235, 230], BRASS = [233, 180, 84], VOID = [9, 9, 13];
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const cubes = [];
  const add = (x, y, tone, next) => {
    // Flugrichtung beim Auflösen: vom Stapel weg, stark in die Tiefe gestreut
    let dx = (x - 2.5) * 0.9 + (rnd() - 0.5) * 2.4, dy = (y - 3) * 0.7 + (rnd() - 0.5) * 2.4, dzz = (rnd() - 0.42) * 3.4;
    const l = Math.hypot(dx, dy, dzz) || 1;
    cubes.push({
      x: x - 2.5, y: y - 3.2, tone, next,
      dx: dx / l, dy: dy / l, dz: dzz / l, far: 5 + rnd() * 9,
      ra: (rnd() - 0.5) * 5, rb: (rnd() - 0.5) * 5, ph: rnd() * 6.283, lag: rnd(),
      at: next ? 1.55 + cubes.length * 0.02 : 0.2 + (y * 6 + x) * 0.03,
      sz: 0, a: 1, col: next ? BRASS : BONE, pts: new Float32Array(24), vz: new Float32Array(8),
    });
  };
  FIELD.forEach((row, r) => { for (let x = 0; x < row.length; x++) if (row[x] !== '.') add(x, FIELD.length - 1 - r, TONE[row[x]], false); });
  NEXT.forEach(([x, y]) => add(x, y, 1, true));

  const H = 0.468; // halbe Kantenlänge: zwischen den Würfeln bleibt eine feine Fuge
  const CORN = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
  const FACE = [[0, 1, 2, 3, 0, 0, -1], [5, 4, 7, 6, 0, 0, 1], [4, 0, 3, 7, -1, 0, 0], [1, 5, 6, 2, 1, 0, 0], [3, 2, 6, 7, 0, 1, 0], [4, 5, 1, 0, 0, -1, 0]];
  const LIGHT = (() => { const v = [-0.34, 0.62, -0.7], l = Math.hypot(...v); return v.map(n => n / l); })();
  const CAM = 26;

  let W = 0, Hh = 0, dpr = 1, wide = true, range = 1;
  function size() {
    W = innerWidth; Hh = innerHeight; wide = W > 760;
    dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr);
    range = Math.max(1, track.offsetHeight - Hh);
  }

  let t0 = 0, sp = 0, mx = 0, my = 0, tmx = 0, tmy = 0, lastP = -1, sx0 = 0, sy0 = 0;

  function draw(t, q) {
    const p = clamp(q), intro = REDUCED ? 99 : t;
    const centre = smooth(0, 0.46, p), burst = smooth(0.2, 0.84, p), rest = smooth(0.82, 1.2, q);
    const unit = Math.min(Hh * 0.058, W * (wide ? 0.05 : 0.088)) * mix(1, 1.55, centre);
    const cx = mix(W * (wide ? 0.73 : 0.62), W * 0.5, centre);
    const cy = mix(Hh * (wide ? 0.37 : 0.33), Hh * 0.5, centre) - Math.max(0, q - 1) * range * 0.1;
    sx0 = cx; sy0 = cy;
    const sway = REDUCED ? 0 : Math.sin(t * 0.23) * 0.07;
    const yaw = -0.6 + sway + p * 1.5 + mx * 0.22 + rest * (REDUCED ? 0 : t * 0.012);
    const pitch = mix(-0.4, -0.2, centre) + my * 0.1;
    const cyw = Math.cos(yaw), syw = Math.sin(yaw), cpt = Math.cos(pitch), spt = Math.sin(pitch);
    const field = 1 - 0.74 * rest;

    for (const q2 of cubes) {
      // Einstieg: jeder Stein fällt von oben an seinen Platz
      const k = expo(clamp((intro - q2.at) / 1.25));
      const e = smooth(0, 1, clamp(burst * 1.3 - q2.lag * 0.3));
      const drift = REDUCED ? 0 : e;
      let px = q2.x + q2.dx * q2.far * e + Math.sin(t * 0.17 + q2.ph) * 0.35 * drift;
      let py = q2.y + q2.dy * q2.far * e + (1 - k) * 9 + Math.cos(t * 0.13 + q2.ph) * 0.35 * drift;
      let pz = q2.dz * q2.far * 1.5 * e;
      if (q2.next) py += 0.9 + (REDUCED ? 0 : Math.sin(t * 0.8) * 0.13) * (1 - e);
      const a = q2.ra * e + t * 0.05 * drift * q2.ra, b = q2.rb * e + t * 0.04 * drift * q2.rb;
      const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      // Achsen des Würfels in Blickrichtung (eigene Drehung, dann Kamera)
      const ax = q2.ax || (q2.ax = new Float32Array(9));
      for (let i = 0; i < 3; i++) {
        let x = i === 0 ? 1 : 0, y = i === 1 ? 1 : 0, z = i === 2 ? 1 : 0;
        let y1 = y * ca - z * sa, z1 = y * sa + z * ca; y = y1; z = z1;        // um X
        let x1 = x * cb + z * sb; z1 = -x * sb + z * cb; x = x1; z = z1;        // um Y
        x1 = x * cyw + z * syw; z1 = -x * syw + z * cyw; x = x1; z = z1;        // Kamera: Gier
        y1 = y * cpt - z * spt; z1 = y * spt + z * cpt;                         // Kamera: Neigung
        ax[i * 3] = x; ax[i * 3 + 1] = y1; ax[i * 3 + 2] = z1;
      }
      let x1 = px * cyw + pz * syw, z1 = -px * syw + pz * cyw;
      const y1 = py * cpt - z1 * spt; z1 = py * spt + z1 * cpt;
      q2.cx = x1; q2.cy = y1; q2.sz = z1;
      for (let i = 0; i < 8; i++) {
        const u = CORN[i][0] * H, v = CORN[i][1] * H, w = CORN[i][2] * H;
        const X = x1 + ax[0] * u + ax[3] * v + ax[6] * w, Y = y1 + ax[1] * u + ax[4] * v + ax[7] * w, Z = z1 + ax[2] * u + ax[5] * v + ax[8] * w;
        const s = CAM / Math.max(2, CAM + Z) * unit;
        q2.pts[i * 3] = cx + X * s; q2.pts[i * 3 + 1] = cy - Y * s; q2.vz[i] = Z;
      }
      // zu nah an der Linse: ausblenden statt ins Bild schlagen
      q2.a = clamp((intro - q2.at) / 0.5) * field * clamp((z1 + CAM * 0.72) / 7);
      q2.fog = clamp((z1 - 5) / 30, 0, 0.82);
      q2.fall = 0.74 + 0.26 * clamp((q2.y + 3.4) / 6) + 0.26 * e;
    }
    cubes.sort((m, n) => n.sz - m.sz);

    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, Hh);
    c.lineJoin = 'round'; c.lineWidth = 0.75;
    for (const q2 of cubes) {
      if (q2.a <= 0.004) continue;
      const ax = q2.ax, P = q2.pts;
      c.globalAlpha = q2.a;
      for (const f of FACE) {
        const nx = ax[0] * f[4] + ax[3] * f[5] + ax[6] * f[6], ny = ax[1] * f[4] + ax[4] * f[5] + ax[7] * f[6], nz = ax[2] * f[4] + ax[5] * f[5] + ax[8] * f[6];
        // Rückseite: Flächennormale zeigt von der Kamera weg
        if (nx * (q2.cx + nx * H) + ny * (q2.cy + ny * H) + nz * (q2.sz + nz * H + CAM) >= 0) continue;
        const lit = Math.min(1, (0.2 + 0.86 * Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2])) * q2.tone * q2.fall);
        const g = 1 - q2.fog;
        const r = Math.round(mix(VOID[0], q2.col[0] * lit, g)), gr = Math.round(mix(VOID[1], q2.col[1] * lit, g)), bl = Math.round(mix(VOID[2], q2.col[2] * lit, g));
        c.beginPath();
        c.moveTo(P[f[0] * 3], P[f[0] * 3 + 1]); c.lineTo(P[f[1] * 3], P[f[1] * 3 + 1]); c.lineTo(P[f[2] * 3], P[f[2] * 3 + 1]); c.lineTo(P[f[3] * 3], P[f[3] * 3 + 1]);
        c.closePath();
        c.fillStyle = `rgb(${r},${gr},${bl})`; c.fill();
        c.strokeStyle = `rgba(255,255,255,${(0.05 + lit * 0.1).toFixed(3)})`; c.stroke();
      }
    }
    c.globalAlpha = 1;
  }

  // ── Was auf der Bühne mitzieht ──
  function stage(q, t) {
    const p = clamp(q);
    // Licht: steht hinter dem Stapel, geht beim Einstieg an
    const on = REDUCED ? 1 : smooth(0.1, 2.4, t), rest = smooth(0.82, 1.25, q);
    light.style.transform = `translate3d(${(sx0 - mx * 26).toFixed(1)}px, ${(sy0 + my * 18).toFixed(1)}px, 0) translate(-50%, -50%) scale(${(0.8 + 0.5 * smooth(0, 0.6, p)).toFixed(3)})`;
    light.style.opacity = (on * (1 - 0.72 * rest)).toFixed(3);
    if (Math.abs(q - lastP) < 0.0004) return;
    lastP = q;
    dawn.style.opacity = rest.toFixed(3);
    const k = clamp(p / 0.26), e = k * k * (3 - 2 * k);
    h1.style.transform = `translate3d(0, ${(-e * 20).toFixed(2)}vh, 0) scale(${(1 + e * 0.05).toFixed(4)})`;
    h1.style.opacity = (1 - e).toFixed(3);
    sub.style.transform = `translate3d(0, ${(-e * 34).toFixed(2)}vh, 0)`;
    sub.style.opacity = clamp(1 - k * 1.5).toFixed(3);
    act.style.transform = `translate3d(0, ${(-e * 48).toFixed(2)}vh, 0)`;
    act.style.opacity = clamp(1 - k * 1.9).toFixed(3);
    act.style.visibility = k > 0.55 ? 'hidden' : '';
    cue.style.opacity = clamp(1 - p * 14).toFixed(3);
    cue.style.transition = p > 0 ? 'none' : '';
    dz.classList.toggle('front', p < 0.27);
    say.style.transform = `translate3d(0, ${((0.62 - p) * 12).toFixed(2)}vh, 0)`;
    words.forEach((w, i) => {
      const v = smooth(0, 1, (p - 0.36 - i * 0.05) / 0.15);
      w.style.opacity = v.toFixed(3);
      w.style.transform = `translate3d(0, ${((1 - v) * 0.34).toFixed(3)}em, 0)`;
      w.style.filter = v > 0.001 && v < 0.999 ? `blur(${((1 - v) * 9).toFixed(1)}px)` : '';
    });
  }

  // ── Verzeichnis: Zeilen steigen einmal aus ihrer Linie ──
  const lists = dz.querySelectorAll('.dz-list');
  if ('IntersectionObserver' in window && !REDUCED) {
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: 0.12 });
    lists.forEach(l => io.observe(l));
  } else lists.forEach(l => l.classList.add('in'));

  size();
  if (REDUCED) {
    document.body.classList.add('dz-go');
    draw(0, 0); stage(0, 99);
    addEventListener('resize', () => { size(); draw(0, 0); stage(0, 99); });
    return;
  }

  let raf = 0, prev = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const t = (now - t0) / 1000, dt = Math.min(0.05, (now - prev) / 1000 || 0.016); prev = now;
    const q = Math.min(3, (window.scrollY || 0) / range);
    // Der Fortschritt läuft dem Scrollrad weich hinterher
    sp += (q - sp) * (1 - Math.pow(0.0006, dt));
    if (Math.abs(q - sp) < 0.0002) sp = q;
    mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05;
    draw(t, sp); stage(sp, t);
  }
  function start() {
    t0 = prev = performance.now();
    sp = Math.min(3, (window.scrollY || 0) / range);
    document.body.classList.add('dz-go');
    raf = requestAnimationFrame(frame);
  }
  addEventListener('resize', size);
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    addEventListener('pointermove', e => { tmx = e.clientX / W * 2 - 1; tmy = e.clientY / Hh * 2 - 1; }, { passive: true });
  }
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(raf);
    if (!document.hidden) { prev = performance.now(); raf = requestAnimationFrame(frame); }
  });
  // Erst starten, wenn die Schrift da ist: sonst springt das Wort mitten im Aufsteigen um
  // (das Stylesheet dafür hängt /mode.js selbst ein, es kann also noch unterwegs sein)
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const font = (async () => {
    if (!document.fonts || !document.fonts.load) return;
    for (let i = 0; i < 30; i++) {
      if ((await document.fonts.load('700 120px "Bricolage Grotesque"')).length) return;
      await wait(50);
    }
  })();
  Promise.race([font, wait(1600)]).then(start, start);
})();
