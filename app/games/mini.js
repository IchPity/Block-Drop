/* ─────────────────────────────────────────────────────────────────────────
   /games/mini.js — gemeinsame Technik der kleinen Automaten
   (Snake, Pong, Space Blaster, Memory Match, Minesweeper). Aussehen dazu
   in /games/mini.css.

   const M = Mini.init({ game: 'snake', accent: '#b8ff3d', modes: [...] });
     M.pal()                 Farben fürs Canvas (Halle oder Cinema)
     M.fit(canvas, w, h)     Canvas scharf stellen, liefert den 2D-Kontext
     M.meter(id, wert)       Zählwerk setzen
     M.show({ title, text, cta, onGo })   Startbild oder Spielende zeigen
     M.hide()
     M.end(score, { text, lower })        Runde werten: Bestwert, Bestenliste, Konto
     M.burst(canvas, x, y, o), M.shake(), M.flash(farbe)   Effekte (nur mit /fx.js)
     M.mode                  gewählte Variante
   ───────────────────────────────────────────────────────────────────────── */
window.Mini = (() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const design = () => document.documentElement.classList.contains('fx-design');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nf = new Intl.NumberFormat('de-AT');

  function init(cfg) {
    const game = cfg.game, modes = cfg.modes || [], lower = !!cfg.lower; // lower: kleiner ist besser (Zeit)
    const fmt = cfg.fmt || (v => nf.format(v));
    const screen = document.querySelector('.mg-screen'), over = $('mgOver');
    const M = { mode: null, game };
    try { M.mode = localStorage.getItem('mini.' + game + '.mode'); } catch (e) {}
    if (!modes.some(m => m[0] === M.mode)) M.mode = modes.length ? modes[0][0] : 'standard';

    // Farben: in der Halle der Akzent der Seite, im Cinema Knochenweiß und Messing
    M.pal = () => design()
      ? { bg: '#060608', grid: 'rgba(236,235,230,0.06)', a: '#ecebe6', b: '#e9b454', c: '#8a8b93', d: '#c8554c', text: '#ecebe6', dim: '#8a8b93', glow: 0 }
      : { bg: '#05030c', grid: 'rgba(196,178,255,0.07)', a: cfg.accent, b: '#ffb000', c: '#ff3d9a', d: '#ff2e63', text: '#f3eeff', dim: '#aaa0cc', glow: 1 };

    M.fit = (canvas, w, h) => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.aspectRatio = w + ' / ' + h;
      const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return ctx;
    };
    M.meter = (id, v) => { const el = $(id); if (el && el.textContent !== String(v)) el.textContent = v; };

    // Bestwert pro Gerät und Variante
    const bestKey = () => 'mini.' + game + '.best.' + M.mode;
    M.best = () => { try { const v = parseFloat(localStorage.getItem(bestKey())); return Number.isFinite(v) ? v : null; } catch (e) { return null; } };
    const showBest = () => { const b = M.best(); M.meter('mBest', b == null ? '–' : fmt(b)); };

    // Effekte laufen über /fx.js und dessen Dämpfung je Version
    const clientPt = (canvas, x, y) => { const r = canvas.getBoundingClientRect(), s = r.width / (canvas.width / Math.min(devicePixelRatio || 1, 2)); return [r.left + x * s, r.top + y * s]; };
    M.burst = (canvas, x, y, o) => { if (!window.FX) return; const p = clientPt(canvas, x, y); FX.burst(p[0], p[1], o || {}); };
    M.burstEl = (el, o) => { if (!window.FX || !el) return; const r = el.getBoundingClientRect(); FX.burst(r.left + r.width / 2, r.top + r.height / 2, o || {}); };
    M.flash = c => { if (window.FX) FX.flash(c, 160); };
    M.shake = () => { if (reduced || (window.FX && !FX.adhs)) return; screen.classList.remove('shake'); void screen.offsetWidth; screen.classList.add('shake'); };

    // Startbild / Spielende
    let onGo = null;
    M.show = o => {
      onGo = o.onGo || null;
      over.innerHTML = '<h1>' + esc(o.title) + '</h1>' + (o.text ? '<p>' + o.text + '</p>' : '') +
        (modes.length > 1 ? '<div class="mg-opts" role="group" aria-label="Variante">' + modes.map(m =>
          '<button type="button" class="mg-opt" data-m="' + m[0] + '" aria-pressed="' + (m[0] === M.mode) + '">' + esc(m[1]) + (m[2] ? '<small>' + esc(m[2]) + '</small>' : '') + '</button>').join('') + '</div>' : '') +
        '<button type="button" class="mg-go" id="mgGo">' + esc(o.cta || 'Spielen') + '</button>';
      over.hidden = false;
      $('mgGo').focus({ preventScroll: true });
    };
    M.hide = () => { over.hidden = true; };
    M.open = () => !over.hidden;
    const go = () => { if (over.hidden || !onGo) return; const f = onGo; M.hide(); f(); };
    over.addEventListener('click', e => {
      const opt = e.target.closest('.mg-opt');
      if (opt) {
        M.mode = opt.dataset.m; try { localStorage.setItem('mini.' + game + '.mode', M.mode); } catch (err) {}
        over.querySelectorAll('.mg-opt').forEach(b => b.setAttribute('aria-pressed', b === opt));
        showBest(); board(); if (cfg.onMode) cfg.onMode(M.mode);
        return;
      }
      if (e.target.closest('.mg-go')) go();
    });
    addEventListener('keydown', e => {
      if (window.FX && FX.cinemaOpen && FX.cinemaOpen()) return;
      if (!over.hidden && (e.key === 'Enter' || e.key === ' ') && !e.target.closest('button, input, a')) { e.preventDefault(); go(); }
    });

    // Bestenliste
    async function board() {
      const ul = $('mgLb'); if (!ul) return;
      const mode = M.mode;
      let rows = [];
      try { if (window.Auth) rows = await Auth.getLeaderboard(game, mode, lower ? 200 : 8); } catch (e) {}
      if (mode !== M.mode) return;
      if (lower) rows = rows.filter(r => r.best_score > 0); // bei Zeiten zählt die kleinste: die Ansicht liefert nur das Maximum, siehe end()
      rows = rows.slice(0, 8);
      const me = window.Auth && Auth.user ? Auth.user.id : null;
      ul.innerHTML = rows.length ? rows.map((r, i) => '<li' + (r.user_id === me ? ' class="me"' : '') + '><span>' + (i + 1) + '.</span><span class="n">' + esc(r.username || '?') + '</span><span class="s">' + fmt(lower ? cfg.unstore(r.best_score) : r.best_score) + '</span></li>').join('')
        : '<li><span class="n" style="color:var(--chalk-dim)">Noch niemand. Hol dir Platz 1.</span></li>';
      const note = $('mgLbNote'); if (note) note.hidden = !!me;
    }
    M.board = board;
    if (window.Auth && Auth.onChange) Auth.onChange(() => board());

    // Runde werten. Zeiten (lower) werden als „je größer, desto besser" gespeichert (cfg.store),
    // weil die Bestenliste im Backend immer das Maximum nimmt.
    M.end = async (score, o) => {
      o = o || {};
      const prev = M.best(), better = o.counts !== false && (lower || score > 0) && (prev == null || (lower ? score < prev : score > prev));
      if (better) { try { localStorage.setItem(bestKey(), String(score)); } catch (e) {} showBest(); }
      if (o.counts !== false && window.Auth && Auth.user && Auth.profile && (lower || score > 0)) {
        try { await Auth.saveScore({ game, mode: M.mode, score: Math.round(lower ? cfg.store(score) : score), level: o.level }); } catch (e) {}
        board();
      }
      return better && prev != null;
    };

    showBest(); board();
    return M;
  }

  // Wischen auf dem Handy: liefert 'left' | 'right' | 'up' | 'down'
  function swipe(el, cb) {
    let sx = 0, sy = 0, on = false;
    el.addEventListener('touchstart', e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; on = true; }, { passive: true });
    el.addEventListener('touchmove', e => {
      if (!on) return; const t = e.touches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
      on = false; cb(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    }, { passive: true });
    el.addEventListener('touchend', () => { on = false; }, { passive: true });
  }

  return { init, swipe, design, reduced, esc };
})();
