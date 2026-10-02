/* ─────────────────────────────────────────────────────────────────────────
   /fx.js — die bewegte Ebene der Arcade („Die Halle nach Ladenschluss")
   Seitenweit eingebunden. Stellt window.FX bereit:

     FX.burst(x, y, opts)      Partikel (spark | coin | confetti | block | ember)
     FX.rain(opts)             Regen von oben (Münzen, Konfetti)
     FX.ring(x, y, color)      Druckwelle
     FX.streak(y, color)       Lichtstreifen quer übers Bild
     FX.flash(color, ms)       Blitz über den ganzen Bildschirm
     FX.shake(el, mag, ms)     Element wackelt
     FX.pulse(color, amt)      Die ganze Halle leuchtet kurz auf
     FX.count(el, a, b, opts)  Zahl hochzählen
     FX.cinema(opts)           Kino-Screen (Belohnung, Gutschrift) → Promise
     FX.credits(opts)          Abspann → Promise
     FX.tilt(nodes)            3D-Neigung mit Lichtreflex
     FX.go(url)                Seitenwechsel mit Röhre-aus

   Alles respektiert prefers-reduced-motion; ohne WebGL bleibt das
   Standbild aus theme.css stehen. Styles dazu: theme.css.
   ───────────────────────────────────────────────────────────────────────── */
(() => {
  'use strict';
  if (window.FX) return;

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const doc = document, root = doc.documentElement;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const hex = c => {
    c = String(c || '').trim();
    if (/^#[0-9a-f]{3}$/i.test(c)) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
    const m = /^#([0-9a-f]{6})$/i.exec(c);
    if (!m) return [1, 0.69, 0];
    const n = parseInt(m[1], 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  };
  const NEON = ['#ff3d9a', '#2ee6ff', '#b8ff3d', '#ffb000', '#7b4dff', '#ffffff'];

  // ═══════════════════════════════════════════════════════════════════
  // Die Halle: ein Gang zwischen zwei Automatenreihen, Teppich unter
  // Schwarzlicht, Röhren an der Decke. Ein Fragment-Shader, bewusst in
  // halber Auflösung gerendert (weiche Tiefenunschärfe, wenig GPU-Last).
  // ═══════════════════════════════════════════════════════════════════
  const hall = { gl: null, pulse: 0, pulseCol: [1, 1, 1], mx: 0, my: 0, tx: 0, ty: 0, scale: 0.6, acc: [1, 0.24, 0.6] };

  const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes; uniform float uT; uniform vec2 uM; uniform float uScroll;
uniform vec3 uAcc; uniform vec4 uPulse; uniform vec3 uAisle;
float h1(float n){ return fract(sin(n*127.1)*43758.5453); }
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
vec3 neon(float h){
  h = fract(h)*5.0;
  if (h < 1.0) return vec3(1.0,0.24,0.60);
  if (h < 2.0) return vec3(0.18,0.90,1.0);
  if (h < 3.0) return vec3(0.72,1.0,0.24);
  if (h < 4.0) return vec3(1.0,0.69,0.0);
  return vec3(0.48,0.30,1.0);
}
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c,-s,s,c); }
// Teppich: jede Zelle bekommt eine Konfetti-Form (Punkt, Ring, Dreieck, Zickzack, Balken)
vec3 carpet(vec2 p, float aa){
  vec3 col = vec3(0.0);
  for (int L = 0; L < 2; L++){
    float sc = L == 0 ? 1.0 : 2.7;
    vec2 q = p*sc + float(L)*17.3;
    vec2 id = floor(q); vec2 f = fract(q) - 0.5;
    float r = h2(id + float(L)*3.1);
    if (r < 0.34) continue;
    f = rot(h2(id + 9.2)*6.283) * (f + (vec2(h2(id + 1.7), h2(id + 4.3)) - 0.5)*0.3);
    float t = h2(id + 5.5), d;
    if (t < 0.22) d = length(f) - 0.16;
    else if (t < 0.42) d = abs(length(f) - 0.2) - 0.045;
    else if (t < 0.62) { vec2 g = vec2(abs(f.x), f.y); d = max(g.x*0.866 + g.y*0.5, -g.y) - 0.13; }
    else if (t < 0.82) d = abs(f.y - 0.1*sin(f.x*16.0)) - 0.04 + step(0.34, abs(f.x));
    else d = max(abs(f.x) - 0.3, abs(f.y) - 0.05);
    col += neon(h2(id + 2.9) + float(L)*0.37) * smoothstep(aa*sc, 0.0, d) * (L == 0 ? 1.0 : 0.7);
  }
  return col;
}
float box(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
const float W = 5.2; const float CEIL = 3.3; const float CAB = 2.3;
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
  float asp = uRes.x / uRes.y;
  vec3 ro = vec3(uM.x*0.7, 1.45 + uM.y*0.12, uT*0.22 + uScroll*2.6);
  vec3 rd = normalize(vec3(uv.x + uM.x*0.1, uv.y - 0.03 + uM.y*0.04, 0.55 + 0.55*min(1.0, asp*0.75)));
  float t = 1e4; int hit = 0;
  if (rd.y < -0.001){ float tf = ro.y / -rd.y; if (tf < t){ t = tf; hit = 1; } }
  if (rd.y > 0.001){ float tc = (CEIL - ro.y) / rd.y; if (tc < t){ t = tc; hit = 2; } }
  if (abs(rd.x) > 0.001){ float tw = (sign(rd.x)*W - ro.x) / rd.x; if (tw > 0.0 && tw < t){ t = tw; hit = 3; } }
  vec3 p = ro + rd*t;
  vec3 col = vec3(0.0);
  float pulse = uPulse.a;
  if (hit == 1){
    // Boden: Teppich, beleuchtet von den Bildschirmen links und rechts
    vec3 light = vec3(0.10, 0.05, 0.22);
    float k0 = floor(p.z / CAB);
    for (int i = -1; i <= 1; i++){
      float k = k0 + float(i);
      for (int s = 0; s < 2; s++){
        float sd = s == 0 ? -1.0 : 1.0;
        float on = step(0.22, h1(k*3.7 + sd*11.0));
        vec2 dv = vec2(p.x - sd*(W - 0.5), p.z - (k + 0.5)*CAB);
        float fl = 0.75 + 0.25*sin(uT*(2.0 + 5.0*h1(k + sd)) + k*4.0);
        light += neon(h1(k*1.3 + sd*5.0)) * on * fl * 1.5 / (1.0 + dot(dv, dv)*0.55);
      }
    }
    vec3 cp = carpet(p.xz*0.9, 0.012 + t*0.006);
    col = vec3(0.012, 0.006, 0.03) + light*0.07 + cp*(0.16 + dot(light, vec3(0.33))*0.5 + pulse*0.5);
    // nasser Glanz Richtung Fluchtpunkt
    col += light*0.05*smoothstep(4.0, 26.0, t);
  } else if (hit == 2){
    // Decke: Schwarzlichtröhren in zwei Bahnen
    float seg = step(0.3, fract(p.z/4.2));
    float tb = exp(-abs(abs(p.x) - 2.1)*7.0) * seg;
    col = vec3(0.03, 0.016, 0.085) + vec3(0.42, 0.24, 1.0)*tb*(0.8 + pulse);
  } else if (hit == 3){
    // Wand: eine Reihe Automaten
    float sd = sign(rd.x);
    float k = floor(p.z / CAB);
    vec2 q = vec2((fract(p.z / CAB) - 0.5)*CAB, p.y);
    float on = step(0.22, h1(k*3.7 + sd*11.0));
    vec3 sc = neon(h1(k*1.3 + sd*5.0));
    float body = step(abs(q.x), 0.92) * step(q.y, 2.75);
    col = vec3(0.022, 0.012, 0.06) + vec3(0.02, 0.011, 0.055) * body;
    float ds = box(q - vec2(0.0, 1.55), vec2(0.56, 0.42));
    float fl = 0.75 + 0.25*sin(uT*(2.0 + 5.0*h1(k + sd)) + k*4.0);
    // Attract-Modus: grobe Pixel, die auf dem Schirm umspringen
    vec2 px = floor(vec2(q.x, q.y)*9.0);
    float pat = 0.45 + 0.55*step(0.5, h2(px + floor(uT*(1.0 + 2.0*h1(k*7.0 + sd)))*13.0 + k));
    float scan = 0.8 + 0.2*sin(q.y*90.0);
    col += sc * on * fl * (smoothstep(0.02, 0.0, ds)*pat*scan*1.25 + exp(-max(ds, 0.0)*3.2)*0.38);
    float dm = box(q - vec2(0.0, 2.42), vec2(0.72, 0.16));
    vec3 mc = neon(h1(k*2.1 + sd*8.0) + 0.4);
    col += mc * (0.35 + 0.65*on) * (smoothstep(0.02, 0.0, dm)*0.9 + exp(-max(dm, 0.0)*4.5)*0.3);
    // Münzlampen
    float dl = length(q - vec2(-0.3, 0.72)) - 0.05;
    float dl2 = length(q - vec2(0.3, 0.72)) - 0.05;
    float blink = step(0.5, fract(uT*0.9 + h1(k)));
    col += vec3(1.0, 0.55, 0.05) * on * (smoothstep(0.02, 0.0, dl)*blink + smoothstep(0.02, 0.0, dl2)*(1.0 - blink) + exp(-max(min(dl, dl2), 0.0)*14.0)*0.25);
    col *= 1.0 + pulse*0.8;
  }
  // Dunst zum Fluchtpunkt
  vec3 fog = vec3(0.062, 0.03, 0.17) + uAcc*0.03 + uPulse.rgb*pulse*0.22;
  col = mix(col, fog, 1.0 - exp(-t*0.05));
  // Lichtkegel der Seitenakzentfarbe am Ende des Gangs
  col += uAcc * 0.05 * exp(-dot(uv, uv)*5.0);
  // in der Bildmitte liegt der Seiteninhalt: dort dunkler, damit Text ruhig steht
  // gedimmt wird Richtung Schwarzlicht-Indigo, nie Richtung Schwarz
  vec3 ground = vec3(0.05, 0.026, 0.145);
  col = mix(ground, col, mix(uAisle.x, 1.0, smoothstep(uAisle.y, uAisle.z, abs(uv.x)/max(asp*0.5, 0.3))));
  col = mix(ground*0.8, col, 1.0 - 0.35*dot(uv, uv));
  col += (h2(gl_FragCoord.xy + fract(uT)*91.0) - 0.5)*0.022;
  col = pow(max(col, 0.0), vec3(0.86));
  gl_FragColor = vec4(col, 1.0);
}`;

  function startHall() {
    const cv = doc.createElement('canvas');
    cv.id = 'fx-hall'; cv.setAttribute('aria-hidden', 'true');
    let gl;
    try { gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: false }); } catch (e) {}
    if (!gl) return;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const vs = sh(gl.VERTEX_SHADER, 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }');
    const fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const pr = gl.createProgram();
    gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'a');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = n => gl.getUniformLocation(pr, n);
    const uRes = U('uRes'), uT = U('uT'), uM = U('uM'), uScroll = U('uScroll'), uAcc = U('uAcc'), uPulse = U('uPulse'), uAisle = U('uAisle');
    // Unterseiten: der Gang in der Mitte bleibt dunkel, damit Tabellen und Text ruhig stehen.
    // Die Startseite (data-hall="open") zeigt die Halle offen, dort stehen deckende Automaten davor.
    const open = doc.body.dataset.hall === 'open';
    gl.uniform3f(uAisle, open ? 0.42 : 0.16, open ? 0.12 : 0.34, open ? 0.8 : 0.98);
    doc.body.prepend(cv);
    hall.gl = gl;

    const acc = getComputedStyle(root).getPropertyValue('--accent') || getComputedStyle(doc.body).getPropertyValue('--accent');
    if (acc.trim()) hall.acc = hex(acc);

    function size() {
      const w = Math.max(2, Math.round(innerWidth * hall.scale)), h = Math.max(2, Math.round(innerHeight * hall.scale));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
    }
    size();
    addEventListener('resize', size);
    addEventListener('pointermove', e => { hall.tx = e.clientX / innerWidth * 2 - 1; hall.ty = -(e.clientY / innerHeight * 2 - 1); }, { passive: true });

    const t0 = performance.now();
    let last = 0, slow = 0, running = true;
    function frame(now) {
      if (!running) return;
      requestAnimationFrame(frame);
      const dt = now - last;
      if (dt < 30) return; // ~33 fps reichen für die langsame Kamerafahrt
      // Schwache Geräte: Auflösung schrittweise senken statt ruckeln
      if (last && dt > 70) { if (++slow > 12 && hall.scale > 0.3) { hall.scale = Math.max(0.3, hall.scale - 0.1); slow = 0; size(); } } else slow = Math.max(0, slow - 1);
      last = now;
      hall.mx += (hall.tx - hall.mx) * 0.05; hall.my += (hall.ty - hall.my) * 0.05;
      hall.pulse *= 0.93;
      gl.uniform2f(uRes, cv.width, cv.height);
      gl.uniform1f(uT, (now - t0) / 1000);
      gl.uniform2f(uM, hall.mx, hall.my);
      gl.uniform1f(uScroll, (window.scrollY || 0) / 1000);
      gl.uniform3fv(uAcc, hall.acc);
      gl.uniform4f(uPulse, hall.pulseCol[0], hall.pulseCol[1], hall.pulseCol[2], hall.pulse);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    if (REDUCED) { last = -100; running = true; frame(t0 + 40000); running = false; return; }
    requestAnimationFrame(frame);
    doc.addEventListener('visibilitychange', () => {
      if (doc.hidden) running = false;
      else if (!running) { running = true; last = 0; requestAnimationFrame(frame); }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // Partikel-Ebene (Canvas 2D über allem)
  // ═══════════════════════════════════════════════════════════════════
  let layer, lx, parts = [], rings = [], raf = 0, dpr = 1;
  function getLayer() {
    if (layer) return lx;
    layer = doc.createElement('canvas');
    layer.id = 'fx-layer'; layer.setAttribute('aria-hidden', 'true');
    doc.body.appendChild(layer);
    lx = layer.getContext('2d');
    const size = () => { dpr = Math.min(devicePixelRatio || 1, 1.5); layer.width = innerWidth * dpr; layer.height = innerHeight * dpr; };
    size(); addEventListener('resize', size);
    return lx;
  }
  let stepAt = 0;
  function step(now) {
    // Zeitbasiert, damit Partikel auf langsamen Geräten nicht in Zeitlupe fliegen
    const f = stepAt ? clamp((now - stepAt) / 16.67, 0.5, 3) : 1; stepAt = now;
    const c = lx, w = innerWidth, h = innerHeight;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    c.globalCompositeOperation = 'lighter';
    for (const r of rings) {
      r.t += f / (60 * r.dur);
      const k = 1 - Math.pow(1 - r.t, 3), a = Math.max(0, 1 - r.t);
      c.globalAlpha = a * 0.7; c.strokeStyle = r.col; c.lineWidth = r.w * a + 1;
      c.beginPath(); c.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * k, 0, 6.2832); c.stroke();
    }
    rings = rings.filter(r => r.t < 1);
    for (const p of parts) {
      p.life -= p.decay * f;
      const dg = Math.pow(p.drag, f);
      p.vy += p.g * f; p.vx *= dg; p.vy *= dg;
      p.px = p.x; p.py = p.y;
      p.x += p.vx * f; p.y += p.vy * f; p.rot += p.vr * f;
      if (p.bounce && p.y > h - 6 && p.vy > 0) { p.y = h - 6; p.vy *= -0.42; p.vx *= 0.7; if (Math.abs(p.vy) < 1.2) p.bounce = false; }
      const a = clamp(p.life * 2.2, 0, 1);
      if (a <= 0) continue;
      c.globalAlpha = a;
      if (p.kind === 'spark' || p.kind === 'ember') {
        c.globalCompositeOperation = 'lighter';
        c.strokeStyle = p.col; c.lineWidth = p.s * (0.5 + p.life * 0.5); c.lineCap = 'round';
        c.beginPath(); c.moveTo(p.px - p.vx * 2.2, p.py - p.vy * 2.2); c.lineTo(p.x, p.y); c.stroke();
      } else {
        c.globalCompositeOperation = 'source-over';
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
        if (p.kind === 'coin') {
          const sx = Math.abs(Math.cos(p.rot * 3.1)) * 0.92 + 0.08;
          c.scale(sx, 1);
          c.fillStyle = '#b87400'; c.beginPath(); c.arc(0, 0, p.s, 0, 6.2832); c.fill();
          c.fillStyle = '#ffc93a'; c.beginPath(); c.arc(0, 0, p.s * 0.82, 0, 6.2832); c.fill();
          c.fillStyle = '#fff3b0'; c.beginPath(); c.arc(-p.s * 0.25, -p.s * 0.28, p.s * 0.3, 0, 6.2832); c.fill();
        } else if (p.kind === 'block') {
          c.fillStyle = p.col; const s = p.s;
          c.beginPath(); c.roundRect(-s, -s, s * 2, s * 2, s * 0.3); c.fill();
          c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(-s, -s, s * 2, s * 0.55);
        } else { // confetti
          c.fillStyle = p.col; c.scale(1, Math.cos(p.rot * 2.3));
          c.fillRect(-p.s, -p.s * 0.45, p.s * 2, p.s * 0.9);
        }
        c.restore();
      }
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    parts = parts.filter(p => p.life > 0 && p.y < h + 60 && p.x > -60 && p.x < w + 60);
    raf = parts.length || rings.length ? requestAnimationFrame(step) : 0;
    if (!raf) { c.clearRect(0, 0, w, h); stepAt = 0; }
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(step); };
  // Im Kino-Screen und im Abspann fliegen Partikel hinter Text und Knopf durch
  function dock(host) { getLayer(); host.insertBefore(layer, host.querySelector('.fxc-stage, .fxr-roll')); layer.classList.add('docked'); }
  function undock() { if (layer && layer.parentNode !== doc.body) { doc.body.appendChild(layer); layer.classList.remove('docked'); } }
  const MAXP = 900;

  function burst(x, y, o = {}) {
    if (REDUCED) return;
    getLayer();
    const small = innerWidth < 640 && (o.n || 40) > 8;
    const kind = o.kind || 'spark', n = Math.min(Math.ceil((o.n || 40) * (small ? 0.5 : 1)), MAXP - parts.length);
    const cols = o.colors || (o.color ? [o.color, '#ffffff'] : NEON);
    const sp = o.speed || 9, spread = o.spread == null ? 6.2832 : o.spread, ang = o.angle == null ? -1.5708 : o.angle;
    for (let i = 0; i < n; i++) {
      const a = ang + (Math.random() - 0.5) * spread, v = sp * (0.25 + Math.random() * 0.9);
      const heavy = kind !== 'spark' && kind !== 'ember';
      parts.push({
        kind, x: x + rand(-1, 1) * (o.radius || 0), y: y + rand(-1, 1) * (o.radiusY == null ? (o.radius || 0) : o.radiusY),
        vx: Math.cos(a) * v, vy: Math.sin(a) * v + (o.lift || 0),
        g: o.gravity == null ? (kind === 'ember' ? -0.04 : heavy ? 0.42 : 0.16) : o.gravity,
        drag: heavy ? 0.992 : 0.955, life: 1, decay: 1 / (60 * (o.life || (heavy ? 2.4 : 0.9)) * rand(0.7, 1.2)),
        s: (o.size || (kind === 'coin' ? 9 : kind === 'block' ? 6 : kind === 'confetti' ? 6 : 2.2)) * rand(0.6, 1.3),
        rot: rand(0, 6.28), vr: rand(-0.3, 0.3), col: cols[n === 1 ? Math.floor(Math.random() * cols.length) : i % cols.length], bounce: !!o.bounce, px: x, py: y,
      });
    }
    kick();
  }
  function rain(o = {}) {
    if (REDUCED) return;
    const dur = o.ms || 1800, per = o.per || 7, t0 = performance.now();
    (function drop() {
      if (performance.now() - t0 > dur) return;
      for (let i = 0; i < per; i++) burst(rand(0, innerWidth), -20, { kind: o.kind || 'coin', n: 1, speed: 3, angle: 1.5708, spread: 0.8, life: 3.2, colors: o.colors, bounce: o.bounce !== false, size: o.size });
      setTimeout(drop, 50);
    })();
  }
  function ring(x, y, color, o = {}) {
    if (REDUCED) return;
    getLayer();
    rings.push({ x, y, col: color || '#fff', t: 0, dur: o.dur || 0.8, r0: o.from || 10, r1: o.to || Math.max(innerWidth, innerHeight) * 0.6, w: o.width || 10 });
    kick();
  }
  function flash(color, ms) {
    if (REDUCED) return;
    const d = doc.createElement('div');
    d.className = 'fx-flash'; d.style.background = color || '#fff';
    doc.body.appendChild(d);
    d.animate([{ opacity: 0.85 }, { opacity: 0 }], { duration: ms || 420, easing: 'cubic-bezier(0.16,1,0.3,1)' }).onfinish = () => d.remove();
  }
  function streak(y, color) {
    if (REDUCED) return;
    const d = doc.createElement('div');
    d.className = 'fx-streak'; d.style.top = (y == null ? innerHeight * 0.44 : y) + 'px'; d.style.setProperty('--rc', color || '#fff');
    doc.body.appendChild(d);
    d.animate([
      { transform: 'scaleX(0.02) scaleY(0.6)', opacity: 0 },
      { transform: 'scaleX(1.5) scaleY(1)', opacity: 1, offset: 0.22 },
      { transform: 'scaleX(2.4) scaleY(0.25)', opacity: 0 },
    ], { duration: 900, easing: 'cubic-bezier(0.16,1,0.3,1)' }).onfinish = () => d.remove();
  }
  function shake(el, mag, ms) {
    if (REDUCED) return;
    el = el || doc.querySelector('main, .wrap, .container, #wrapper');
    if (!el || !el.animate) return;
    const m = mag || 8, n = 9, kf = [];
    for (let i = 0; i <= n; i++) {
      const k = 1 - i / n;
      kf.push({ transform: i === n ? 'translate(0,0) rotate(0deg)' : `translate(${rand(-m, m) * k}px, ${rand(-m, m) * k}px) rotate(${rand(-0.5, 0.5) * k * m / 8}deg)` });
    }
    el.animate(kf, { duration: ms || 420, easing: 'linear' });
  }
  function pulse(color, amt) {
    hall.pulseCol = hex(color || '#ffffff');
    hall.pulse = Math.min(1.4, hall.pulse + (amt == null ? 1 : amt));
  }
  function count(el, from, to, o = {}) {
    const fmt = o.fmt || (v => Math.round(v).toLocaleString('de-AT'));
    if (REDUCED || from === to) { el.textContent = fmt(to); return Promise.resolve(); }
    return new Promise(res => {
      const t0 = performance.now(), dur = o.ms || 1100;
      let lastTick = -1;
      (function f(now) {
        const k = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 4);
        el.textContent = fmt(from + (to - from) * e);
        const tk = Math.floor(e * (o.ticks || 14));
        if (tk !== lastTick) { lastTick = tk; if (o.onTick) o.onTick(tk); }
        if (k < 1) requestAnimationFrame(f); else res();
      })(t0);
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // Kino-Screen
  // ═══════════════════════════════════════════════════════════════════
  let cine, cineQueue = [], cineOpen = false, cineDone = null, cineAt = 0;
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function split(text) {
    let i = 0;
    return String(text).split(' ').map(w =>
      '<span class="w">' + Array.from(w).map(ch => '<span class="l" style="animation-delay:' + (0.5 + (i++) * 0.032 + Math.random() * 0.12).toFixed(3) + 's">' + esc(ch) + '</span>').join('') + '</span>'
    ).join(' ');
  }
  function buildCinema() {
    cine = doc.createElement('div');
    cine.className = 'fxc'; cine.setAttribute('role', 'dialog'); cine.setAttribute('aria-modal', 'true'); cine.setAttribute('aria-labelledby', 'fxc-title');
    cine.innerHTML =
      '<div class="fxc-bar fxc-bar-t"></div><div class="fxc-bar fxc-bar-b"></div><div class="fxc-rays"></div>' +
      '<div class="fxc-stage"><div class="fxc-icon"></div><h2 class="fxc-title" id="fxc-title"></h2><div class="fxc-count"></div>' +
      '<p class="fxc-text"></p><div class="fxc-chips"></div><button type="button" class="fxc-go"></button><div class="fxc-hint">Enter oder Klick</div></div>';
    doc.body.appendChild(cine);
    cine.querySelector('.fxc-go').addEventListener('click', closeCinema);
    cine.addEventListener('click', e => { if (e.target === cine && performance.now() - cineAt > 900) closeCinema(); });
    // Tasten im Capture abfangen, damit das Spiel dahinter nichts davon mitbekommt
    doc.addEventListener('keydown', e => {
      if (!cineOpen) return;
      if (e.key === 'Tab') { e.preventDefault(); cine.querySelector('.fxc-go').focus(); return; }
      if (e.key !== 'Enter' && e.key !== 'Escape' && e.code !== 'Space') return;
      e.preventDefault(); e.stopImmediatePropagation();
      // Wer gerade die Leertaste hämmert, soll den Screen nicht versehentlich wegdrücken
      if (e.repeat || performance.now() - cineAt < (e.code === 'Space' ? 1300 : 500)) return;
      closeCinema();
    }, true);
  }
  function showCinema(o) {
    if (!cine) buildCinema();
    cineOpen = true; cineAt = performance.now();
    dock(cine);
    const q = s => cine.querySelector(s), col = o.color || '#ffb000', epic = o.tier === 'epic';
    cine.style.setProperty('--rc', col);
    cine.classList.toggle('lite', !epic);
    q('.fxc-icon').innerHTML = o.iconHtml || esc(o.icon || '');
    const title = String(o.title || '');
    q('.fxc-title').style.setProperty('--fs', title.length > 34 ? 'clamp(26px, 4.4vw, 52px)' : title.length > 20 ? 'clamp(30px, 5.4vw, 64px)' : '');
    q('.fxc-title').innerHTML = split(title);
    q('.fxc-title').setAttribute('aria-label', title);
    q('.fxc-text').textContent = o.text || '';
    q('.fxc-count').textContent = '';
    q('.fxc-chips').innerHTML = (o.chips || []).map((t, i) => '<span style="animation-delay:' + (1 + i * 0.16) + 's">' + esc(t) + '</span>').join('');
    q('.fxc-go').textContent = o.cta || 'Weiter';
    cine.classList.remove('off'); cine.classList.remove('on'); void cine.offsetWidth; cine.classList.add('on');
    q('.fxc-go').focus({ preventScroll: true });

    const cx = innerWidth / 2, cy = innerHeight * 0.34;
    const timers = showCinema.timers = [];
    const at = (ms, fn) => timers.push(setTimeout(() => { if (cineOpen) fn(); }, ms));
    streak(cy, col); pulse(col, 0.6);
    at(380, () => {
      // Einschlag des Icons
      flash(col, epic ? 520 : 300); ring(cx, cy, col, { width: epic ? 9 : 6 }); pulse(col, 1.2);
      shake(doc.querySelector('main, .wrap, .container, #wrapper'), epic ? 14 : 7, 420);
      burst(cx, cy, { kind: 'spark', n: epic ? 150 : 70, speed: epic ? 22 : 15, colors: [col, '#ffffff', col] });
      burst(cx, cy, { kind: o.particles || 'confetti', n: epic ? 120 : 40, speed: epic ? 20 : 14, lift: -6, colors: [col, '#ffffff'].concat(NEON) });
    });
    if (epic) {
      at(620, () => ring(cx, cy, '#ffffff', { width: 4, dur: 1.1 }));
      at(900, () => rain({ kind: o.particles || 'confetti', ms: 2600, per: 5 }));
      at(1500, () => { burst(innerWidth * 0.14, innerHeight * 0.82, { kind: 'spark', n: 70, speed: 20, angle: -1.2, spread: 0.9, color: col }); burst(innerWidth * 0.86, innerHeight * 0.82, { kind: 'spark', n: 70, speed: 20, angle: -1.94, spread: 0.9, color: col }); });
    }
    (o.chips || []).forEach((_, i) => at(1000 + i * 160, () => {
      const el = q('.fxc-chips').children[i]; if (!el) return;
      const r = el.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, { kind: 'spark', n: 14, speed: 6, color: col });
    }));
    if (o.count) {
      const el = q('.fxc-count'), c = o.count;
      el.textContent = (c.fmt || String)(c.from || 0);
      at(820, () => count(el, c.from || 0, c.to, {
        ms: c.ms || 1600, fmt: c.fmt, ticks: 22, onTick: () => {
          const r = el.getBoundingClientRect();
          burst(r.left + r.width * Math.random(), r.top + r.height / 2, { kind: o.particles === 'coin' ? 'coin' : 'spark', n: o.particles === 'coin' ? 2 : 6, speed: 7, color: col, lift: -4 });
          if (c.onTick) c.onTick();
        },
      }));
    }
    // Glut steigt auf, solange der Screen steht
    (function embers() {
      if (!cineOpen || REDUCED) return;
      burst(rand(0, innerWidth), innerHeight + 10, { kind: 'ember', n: 2, speed: 2.4, angle: -1.5708, spread: 0.7, life: 3.4, color: col, size: 1.8 });
      timers.push(setTimeout(embers, 90));
    })();
    return new Promise(res => { cineDone = res; });
  }
  function closeCinema() {
    if (!cineOpen) return;
    cineOpen = false;
    (showCinema.timers || []).forEach(clearTimeout);
    cine.classList.add('off');
    const done = cineDone; cineDone = null;
    if (doc.activeElement && cine.contains(doc.activeElement)) doc.activeElement.blur();
    setTimeout(() => {
      cine.classList.remove('on', 'off');
      undock();
      if (done) done();
      if (cineQueue.length) { const n = cineQueue.shift(); showCinema(n.o).then(n.res); }
    }, REDUCED ? 0 : 230);
  }
  function cinema(o) {
    if (cineOpen || credOpen) return new Promise(res => cineQueue.push({ o, res }));
    return showCinema(o);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Abspann
  // ═══════════════════════════════════════════════════════════════════
  let credOpen = false;
  function credits(o) {
    if (credOpen) return Promise.resolve();
    credOpen = true;
    const col = o.color || '#ffb000';
    const el = doc.createElement('div');
    el.className = 'fxr'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Abspann');
    el.style.setProperty('--rc', col);
    const sec = s => {
      if (s.logo) return '<div class="fxr-logo">' + esc(s.logo) + '</div>' + (s.tag ? '<div class="fxr-tag">' + esc(s.tag) + '</div>' : '');
      let h = '<div class="fxr-sec">' + (s.head ? '<div class="fxr-head">' + esc(s.head) + '</div>' : '');
      if (s.big) h += '<div class="fxr-big">' + esc(s.big) + (s.small ? '<small>' + esc(s.small) + '</small>' : '') + '</div>';
      if (s.rows) h += s.rows.map(r => '<div class="fxr-row"><span class="r">' + esc(r[0]) + '</span><span class="n">' + esc(r[1]) + (r[2] ? '<small>' + esc(r[2]) + '</small>' : '') + '</span></div>').join('');
      if (s.stats) h += '<div>' + s.stats.map(r => '<div class="fxr-stat"><b>' + esc(r[0]) + '</b><span>' + esc(r[1]) + '</span></div>').join('') + '</div>';
      if (s.note) h += '<p class="fxr-note">' + esc(s.note) + '</p>';
      return h + '</div>';
    };
    const end = o.end || {};
    el.innerHTML =
      '<div class="fxc-bar fxc-bar-t"></div><div class="fxc-bar fxc-bar-b"></div>' +
      '<div class="fxr-roll">' + o.sections.map(sec).join('') + '</div>' +
      '<div class="fxr-end"><div><h2 class="fxc-title"></h2><p class="fxc-text">' + esc(end.text || '') + '</p><button type="button" class="fxc-go">' + esc(end.cta || 'Weiter') + '</button></div></div>' +
      '<div class="fxr-ui"><span>Halten = schneller</span><button type="button" class="fxr-skip">Überspringen</button></div>';
    doc.body.appendChild(el);
    void el.offsetWidth; el.classList.add('on');
    dock(el);
    const roll = el.querySelector('.fxr-roll');
    let anim = null, embT = 0, finished = false, resolve;
    const p = new Promise(r => { resolve = r; });

    function finish() {
      if (finished) return; finished = true;
      if (anim) anim.cancel();
      el.classList.add('ended');
      const t = el.querySelector('.fxr-end .fxc-title');
      t.innerHTML = split(end.title || 'Ende'); t.setAttribute('aria-label', end.title || 'Ende');
      el.querySelector('.fxr-end .fxc-go').focus({ preventScroll: true });
      const cx = innerWidth / 2, cy = innerHeight * 0.42;
      streak(cy, col); pulse(col, 1.2);
      setTimeout(() => { flash(col, 500); ring(cx, cy, col, { width: 8 }); burst(cx, cy, { kind: 'spark', n: 160, speed: 22, colors: [col, '#fff'] }); rain({ kind: 'confetti', ms: 3200, per: 5 }); }, 520);
    }
    function close() {
      credOpen = false; clearInterval(embT);
      doc.removeEventListener('keydown', onKey, true); doc.removeEventListener('keyup', onUp, true);
      el.classList.add('off');
      setTimeout(() => { undock(); el.remove(); resolve(); if (cineQueue.length) { const n = cineQueue.shift(); showCinema(n.o).then(n.res); } }, REDUCED ? 0 : 480);
    }
    const fast = on => { if (anim) anim.playbackRate = on ? 6 : 1; };
    function onKey(e) {
      if (e.key === 'Tab') return;
      e.stopImmediatePropagation();
      if (e.key === 'Escape') { e.preventDefault(); if (finished) close(); else finish(); }
      else if (e.code === 'Space' || e.key === 'Enter') { if (finished) return; e.preventDefault(); fast(true); }
    }
    function onUp(e) { if (e.code === 'Space' || e.key === 'Enter') fast(false); }
    doc.addEventListener('keydown', onKey, true); doc.addEventListener('keyup', onUp, true);
    roll.addEventListener('pointerdown', () => fast(true));
    el.addEventListener('pointerup', () => fast(false));
    el.addEventListener('pointercancel', () => fast(false));
    el.querySelector('.fxr-skip').addEventListener('click', finish);
    el.querySelector('.fxr-end .fxc-go').addEventListener('click', close);
    el.querySelector('.fxr-skip').focus({ preventScroll: true });

    if (REDUCED) {
      // Ohne Bewegung: der ganze Abspann als ruhige, scrollbare Seite mit dem Schluss am Ende
      finished = true; el.classList.add('still');
      const t = el.querySelector('.fxr-end .fxc-title'); t.textContent = end.title || 'Ende';
      el.querySelector('.fxr-skip').textContent = 'Schließen';
      el.querySelector('.fxr-skip').addEventListener('click', close);
      return p;
    }
    const H = roll.offsetHeight, vh = innerHeight;
    anim = roll.animate([{ transform: `translateY(${vh * 0.62}px)` }, { transform: `translateY(${-H - vh * 0.1}px)` }], { duration: (H + vh * 0.72) / 62 * 1000, easing: 'linear', fill: 'both' });
    anim.onfinish = finish;
    embT = setInterval(() => { if (!finished) burst(rand(0, innerWidth), innerHeight + 10, { kind: 'ember', n: 1, speed: 2, angle: -1.5708, spread: 0.6, life: 4, color: col, size: 1.6 }); }, 160);
    pulse(col, 0.8);
    return p;
  }

  // ═══════════════════════════════════════════════════════════════════
  // 3D-Neigung mit Lichtreflex (setzt --rx, --ry, --gx, --gy am Element)
  // ═══════════════════════════════════════════════════════════════════
  function tilt(nodes, o = {}) {
    if (REDUCED || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const max = o.max || 9;
    nodes.forEach(el => {
      let raf2 = 0, tx = 0, ty = 0, cx = 0, cy = 0, over = false;
      const loop = () => {
        cx += (tx - cx) * 0.14; cy += (ty - cy) * 0.14;
        el.style.setProperty('--ry', (cx * max).toFixed(2) + 'deg');
        el.style.setProperty('--rx', (-cy * max * 0.8).toFixed(2) + 'deg');
        el.style.setProperty('--gx', ((cx + 0.5) * 100).toFixed(1) + '%');
        el.style.setProperty('--gy', ((cy + 0.5) * 100).toFixed(1) + '%');
        raf2 = over || Math.abs(cx) > 0.002 || Math.abs(cy) > 0.002 ? requestAnimationFrame(loop) : 0;
      };
      el.addEventListener('pointerenter', () => { over = true; el.classList.add('is-near'); if (!raf2) raf2 = requestAnimationFrame(loop); });
      el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); tx = (e.clientX - r.left) / r.width - 0.5; ty = (e.clientY - r.top) / r.height - 0.5; });
      el.addEventListener('pointerleave', () => { over = false; tx = ty = 0; el.classList.remove('is-near'); });
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // Seitenwechsel: Röhre aus, dann navigieren
  // ═══════════════════════════════════════════════════════════════════
  let leaving = false;
  function go(url) {
    if (leaving) return;
    if (REDUCED) { location.href = url; return; }
    leaving = true;
    root.classList.add('fx-leaving');
    setTimeout(() => { location.href = url; }, 280);
  }
  doc.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target || a.hasAttribute('download') || a.dataset.fxNav === 'off') return;
    let u; try { u = new URL(a.href, location.href); } catch (err) { return; }
    if (u.origin !== location.origin || !/^https?:$/.test(u.protocol)) return;
    if (u.pathname === location.pathname && u.search === location.search) return; // nur Anker
    if (/\.(jar|zip|exe|pdf|png|jpg|svg)$/i.test(u.pathname)) return;
    e.preventDefault();
    go(u.href);
  });
  // Zurück aus dem Seitencache: die Röhre muss wieder an sein
  addEventListener('pageshow', () => { leaving = false; root.classList.remove('fx-leaving'); });

  window.FX = { burst, rain, ring, streak, flash, shake, pulse, count, cinema, credits, tilt, go, reduced: REDUCED, NEON,
    cinemaOpen: () => cineOpen || credOpen, closeCinema };

  if (doc.body) startHall(); else doc.addEventListener('DOMContentLoaded', startHall);
})();
