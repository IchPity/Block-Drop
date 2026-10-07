// ─────────────────────────────────────────────────────────────────────────────
// Arcade Auth: Supabase-basierter Login + Score-Sync
// Verwendung: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//             <script src="/auth.js"></script>
// In der Navbar irgendwo: <div data-auth-slot></div>
// ─────────────────────────────────────────────────────────────────────────────

// ─── Globale Mobile-Fixes ───────────────────────────────────────────────────
// Wird ans Ende des <head> appended, damit die Regeln Seiten-CSS überschreiben.
(function injectMobileFixes() {
  const css = `
  html {
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
  }
  body {
    /* dvh: kompensiert iOS Safari Adresszeile-Sprünge (fallback 100vh) */
    min-height: 100vh;
    min-height: 100dvh;
    overscroll-behavior-y: contain;
  }
  /* Kein blauer Tap-Flash, keine Doppel-Tap-Zoom-Verzögerung */
  button, a, [role="button"], .auth-chip, .game-card,
  .nav-back, .nav-btn, .nav-cta, .tab, .lb-tab,
  .mode-btn, .play-btn, .btn, .btn-primary, .btn-secondary,
  .fav-chip, .quick-btn, .recent-tag, .quick-tag,
  .tc-btn, .map-btn, .pip-btn, .promo-btn, .color-btn {
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  @media (max-width: 760px) {
    /* iOS Safe-Area (Notch / Home-Bar) — nur auf Mobile, damit Desktop-
       Padding wie 32px nicht versehentlich runtergestutzt wird. */
    @supports (padding: max(0px, env(safe-area-inset-left))) {
      .navbar {
        padding-left: max(14px, env(safe-area-inset-left));
        padding-right: max(14px, env(safe-area-inset-right));
        padding-top: max(10px, env(safe-area-inset-top));
      }
      .site-footer {
        padding-bottom: max(22px, env(safe-area-inset-bottom));
        padding-left: max(14px, env(safe-area-inset-left));
        padding-right: max(14px, env(safe-area-inset-right));
      }
    }

    /* iOS verhindert Auto-Zoom beim Input-Fokus nur wenn font-size >= 16px */
    input[type="text"], input[type="email"], input[type="password"],
    input[type="search"], input[type="number"], input[type="tel"],
    input[type="url"], textarea, select {
      font-size: 16px !important;
    }

    /* Größere Tap-Targets in der Navbar — Apple HIG empfiehlt 44px,
       wir gehen pragmatisch auf min 34px */
    .nav-back {
      min-height: 34px;
      padding: 8px 12px;
      font-size: 11px;
      display: inline-flex; align-items: center;
    }
    .nav-btn, .nav-cta { min-height: 34px; padding: 8px 14px; }
    .auth-chip { min-height: 40px; }
    .auth-login-btn { min-height: 40px; }
    .map-btn, .quick-tag, .recent-tag, .lb-tab, .fav-btn, .pip-btn, .mini-btn { min-height: 40px; }
    .fw-close { min-width: 36px; min-height: 36px; }

    /* Suggestion-/Dropdown-Listen scrollbar mit Trägheit */
    .suggestions, .auth-menu { -webkit-overflow-scrolling: touch; }
  }

  /* Touch-Geräte jeder Breite (auch Tablets): kleine Knöpfe gut treffbar */
  @media (pointer: coarse) {
    .map-btn, .quick-tag, .recent-tag, .lb-tab, .fav-btn, .pip-btn, .mini-btn { min-height: 40px; }
    .fw-close { min-width: 36px; min-height: 36px; }
  }

  /* Hover-Effekte auf Touch nicht "kleben lassen" */
  @media (hover: none) {
    .game-card.available:hover { transform: none !important; }
    .ach-card:hover, .daily-card:hover, .tracker-card:hover { transform: none !important; }
  }
  `;

  function inject() {
    if (document.getElementById('arcade-mobile-fixes')) return;
    const style = document.createElement('style');
    style.id = 'arcade-mobile-fixes';
    style.textContent = css;
    // Ans Ende des <head> hängen, damit unsere Regeln Seiten-CSS überschreiben.
    document.head.appendChild(style);
  }

  // Viewport-Meta absichern: manche alten Pages haben evtl. kein viewport-fit
  function ensureViewport() {
    let vp = document.querySelector('meta[name="viewport"]');
    if (!vp) {
      vp = document.createElement('meta');
      vp.name = 'viewport';
      document.head.appendChild(vp);
    }
    const current = vp.getAttribute('content') || '';
    if (!/viewport-fit/.test(current)) {
      vp.setAttribute('content',
        (current ? current + ', ' : 'width=device-width, initial-scale=1.0, ') + 'viewport-fit=cover');
    }
  }

  inject();
  ensureViewport();
})();

// ─── Site Footer (Impressum / Datenschutz) ──────────────────────────────────
// Wird auf jeder Seite injiziert, läuft unabhängig von Supabase.
(function injectSiteFooter() {
  const css = `
  .site-footer {
    position: relative; z-index: 1;
    margin-top: 48px;
    padding: 22px 24px 28px;
    border-top: 1px solid var(--board-line, rgba(196,178,255,0.09));
    text-align: center;
    font-family: 'Barlow', 'Barlow', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  .site-footer-inner {
    display: flex; justify-content: center; align-items: center;
    gap: 8px 18px; flex-wrap: wrap;
    font-size: 11px; color: var(--chalk-faint, rgba(255,255,255,0.28));
    letter-spacing: 0.3px;
  }
  .site-footer-inner a {
    color: var(--chalk-dim, rgba(255,255,255,0.5));
    text-decoration: none;
    font-weight: 600;
    transition: color 0.2s;
  }
  .site-footer-inner a:hover { color: var(--chalk, #fff); }
  .site-footer-inner .sep { color: var(--board-line, rgba(255,255,255,0.15)); }
  @media (max-width: 480px) {
    .site-footer { padding: 18px 14px 22px; }
    .site-footer-inner { gap: 6px 12px; font-size: 10px; }
  }
  `;

  function build() {
    if (document.querySelector('footer.site-footer')) return;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    const footer = document.createElement('footer');
    footer.className = 'site-footer';
    footer.innerHTML = `
      <div class="site-footer-inner">
        <span>&copy; Peter Scheikl</span>
        <span class="sep">&middot;</span>
        <a href="/impressum/">Impressum</a>
        <span class="sep">&middot;</span>
        <a href="/datenschutz/">Datenschutz</a>
      </div>
    `;
    document.body.appendChild(footer);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();

(function () {
  const SUPABASE_URL = 'https://yjyvqidjqksvagyxrwyf.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_9J1vJchMV6Ym-1btnintAw_zih4pdea';

  if (!window.supabase || !window.supabase.createClient) {
    console.error('[Auth] Supabase SDK fehlt. <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script> vor auth.js einbinden.');
    return;
  }

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });

  // ─── Styles ────────────────────────────────────────────────────────────────
  const css = `
  .auth-chip {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(196,178,255,0.05);
    border: 1px solid var(--board-line, rgba(196,178,255,0.09));
    border-radius: 999px; padding: 5px 12px 5px 5px;
    cursor: pointer; font-family: inherit;
    transition: all 0.2s;
  }
  .auth-chip:hover { background: rgba(196,178,255,0.08); border-color: rgba(196,178,255,0.2); }
  .auth-chip-avatar {
    width: 26px; height: 26px; border-radius: 50%;
    background: linear-gradient(135deg, var(--bell, #d7263d), #a81c30);
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 900; color: var(--chalk, #fff);
  }
  .auth-chip-avatar-img { object-fit: cover; }
  .auth-chip-name {
    font-size: 12px; font-weight: 700; color: var(--chalk, #fff);
    letter-spacing: 0.2px; max-width: 120px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .auth-chip-caret { font-size: 9px; color: var(--chalk-faint, rgba(255,255,255,0.4)); margin-left: 2px; }
  @media (max-width: 560px) {
    .auth-chip { padding: 4px 10px 4px 4px; }
    .auth-chip-name { max-width: 90px; font-size: 11px; }
    .auth-chip-avatar { width: 22px; height: 22px; font-size: 10px; }
    .auth-login-btn { padding: 7px 12px; font-size: 11px; }
  }

  .auth-menu {
    position: absolute; top: calc(100% + 8px); right: 0;
    background: var(--board-raised, rgba(18,10,48,0.98));
    border: 1px solid var(--board-line, rgba(196,178,255,0.1)); border-radius: 14px;
    padding: 8px; min-width: 200px;
    box-shadow: 0 16px 40px rgba(0,0,0,0.6);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    opacity: 0; transform: translateY(-6px) scale(0.97);
    transition: opacity 0.15s, transform 0.15s;
    pointer-events: none; z-index: 200;
  }
  .auth-menu.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: all; }
  .auth-menu-header {
    padding: 10px 12px 12px; border-bottom: 1px solid var(--board-line, rgba(196,178,255,0.06));
    margin-bottom: 6px;
  }
  .auth-menu-name { font-family: 'Kanit', inherit; font-size: 13px; font-weight: 700; color: var(--chalk, #fff); }
  .auth-menu-email { font-size: 10px; color: var(--chalk-faint, rgba(255,255,255,0.4)); margin-top: 2px; }
  .auth-menu-item {
    display: block; width: 100%; text-align: left;
    background: transparent; border: none;
    padding: 9px 12px; border-radius: 8px;
    font-family: inherit; font-size: 12px; font-weight: 600;
    color: var(--chalk-dim, rgba(255,255,255,0.7)); cursor: pointer;
    transition: all 0.15s;
  }
  .auth-menu-item:hover { background: rgba(196,178,255,0.06); color: var(--chalk, #fff); }
  .auth-menu-item.danger { color: #ff7a90; }
  .auth-menu-item.danger:hover { background: rgba(215,38,61,0.1); color: #ff97aa; }

  .auth-slot { position: relative; }

  /* gezeichnete Symbole (ersetzen Emojis, siehe ICONS unten) */
  .ico { display: inline-block; width: 1.15em; height: 1.15em; vertical-align: -0.2em; flex-shrink: 0; }
  .ach-toast-icon, .ach-card:not(.locked) .ach-icon { color: var(--marquee, #ffb000); }

  /* Einstellungen im Menü: Version (gilt für die ganze Seite, siehe /fx.js) */
  .auth-menu-label { padding: 6px 12px 8px; font-size: 12px; font-weight: 600; color: var(--chalk-dim, rgba(255,255,255,0.7)); }
  .auth-modes {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; margin: 0 8px 8px; padding: 2px;
    border-radius: 9px; background: rgba(196,178,255,0.08);
  }
  .auth-mode {
    border: 0; border-radius: 7px; padding: 0 8px; min-height: 32px; cursor: pointer;
    background: transparent; color: var(--chalk-dim, rgba(255,255,255,0.7));
    font-family: inherit; font-size: 12px; font-weight: 600;
    transition: background 0.18s, color 0.18s;
  }
  .auth-mode:hover { color: var(--chalk, #fff); }
  .auth-mode[aria-checked="true"] { background: var(--neon-pink, #ff3d9a); color: var(--ink, #0a0520); }
  .auth-menu-hint { padding: 0 12px 8px; max-width: 236px; font-size: 10px; line-height: 1.4; color: var(--chalk-faint, rgba(255,255,255,0.4)); }
  .auth-menu-sep { height: 1px; margin: 6px 0; background: var(--board-line, rgba(196,178,255,0.06)); }
  .auth-slot.has-gear { display: inline-flex; align-items: center; gap: 8px; }
  .auth-gear {
    width: 34px; height: 34px; border-radius: 10px; cursor: pointer;
    background: transparent; border: 1px solid var(--board-line, rgba(196,178,255,0.14));
    color: var(--chalk-dim, rgba(255,255,255,0.7)); font-size: 16px; line-height: 1;
    transition: color 0.15s, border-color 0.15s;
  }
  .auth-gear:hover { color: var(--chalk, #fff); border-color: rgba(196,178,255,0.3); }

  .auth-login-btn {
    display: inline-flex; align-items: center; gap: 6px;
    background: var(--bell, #d7263d); border: none; border-radius: 10px;
    padding: 8px 18px; color: var(--ink, #0a0520);
    font-family: inherit; font-size: 12px; font-weight: 700;
    letter-spacing: 0.3px;
    cursor: pointer; text-decoration: none;
    box-shadow: 0 4px 10px rgba(0,0,0,0.35);
    transition: all 0.2s;
  }
  .auth-login-btn:hover { background: #ff5c84; box-shadow: 0 6px 15px rgba(0,0,0,0.4); transform: translateY(-1px); }

  /* ─── Modal ──────────────────────────────────────────────────────────── */
  .auth-modal-backdrop {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(12,6,34,0.88);
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
    opacity: 0; pointer-events: none;
    transition: opacity 0.22s;
  }
  .auth-modal-backdrop.open { opacity: 1; pointer-events: all; }
  .auth-modal {
    background: var(--board-raised, rgba(18,10,48,0.98));
    border: 1px solid var(--board-line, rgba(196,178,255,0.1)); border-radius: 20px 20px 10px 10px;
    padding: 36px; width: 100%; max-width: 380px;
    max-height: calc(100vh - 32px); overflow-y: auto;
    box-shadow: 0 32px 80px rgba(0,0,0,0.8), 0 16px 40px rgba(0,0,0,0.4);
    transform: scale(0.9) translateY(20px); opacity: 0;
    transition: transform 0.3s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.22s;
  }
  @media (max-width: 480px) {
    .auth-modal { padding: 28px 22px; border-radius: 18px 18px 10px 10px; }
    .auth-modal h2 { font-size: 22px; }
    .auth-field input { font-size: 16px; padding: 12px 12px; }
  }
  .auth-modal-backdrop.open .auth-modal { transform: scale(1) translateY(0); opacity: 1; }
  .auth-modal-eyebrow {
    font-size: 11px; font-weight: 700;
    color: var(--marquee, #ffb703); margin-bottom: 10px;
  }
  .auth-modal h2 {
    font-family: 'Kanit', inherit;
    font-size: 24px; font-weight: 700; color: var(--chalk, #fff);
    margin: 0 0 6px;
  }
  .auth-modal-sub {
    font-size: 12px; color: var(--chalk-dim, rgba(255,255,255,0.4));
    margin-bottom: 24px; line-height: 1.5;
  }
  .auth-field { display: block; margin-bottom: 14px; }
  .auth-field label {
    display: block; font-size: 11px; font-weight: 600;
    color: var(--chalk-faint, rgba(255,255,255,0.35)); margin-bottom: 6px;
  }
  .auth-field input {
    width: 100%; background: rgba(196,178,255,0.04);
    border: 1px solid var(--board-line, rgba(196,178,255,0.1)); border-radius: 10px;
    padding: 12px 14px; color: var(--chalk, #fff);
    font-family: inherit; font-size: 14px; font-weight: 500;
    outline: none; transition: border-color 0.2s, background 0.2s;
  }
  .auth-field input:focus { border-color: rgba(215,38,61,0.5); background: rgba(196,178,255,0.06); }
  .auth-submit {
    width: 100%; background: var(--bell, #d7263d); color: var(--ink, #0a0520);
    border: none; border-radius: 10px; padding: 14px;
    font-family: inherit; font-size: 14px; font-weight: 700;
    letter-spacing: 0.3px; cursor: pointer;
    box-shadow: 0 5px 12px rgba(0,0,0,0.35);
    transition: all 0.2s;
    margin-top: 6px;
  }
  .auth-submit:hover:not(:disabled) { background: #ff5c84; box-shadow: 0 7px 18px rgba(0,0,0,0.4); transform: translateY(-1px); }
  .auth-submit:disabled { opacity: 0.5; cursor: not-allowed; }
  .auth-switch {
    text-align: center; margin-top: 18px;
    font-size: 12px; color: var(--chalk-faint, rgba(255,255,255,0.4));
  }
  .auth-switch a {
    color: var(--marquee, #ffb703); text-decoration: none;
    font-weight: 700; cursor: pointer;
  }
  .auth-switch a:hover { text-decoration: underline; }
  .auth-error {
    background: rgba(215,38,61,0.1); border: 1px solid rgba(215,38,61,0.3);
    border-radius: 10px; padding: 10px 14px;
    font-size: 12px; color: #ff97aa;
    margin-bottom: 14px; line-height: 1.4;
  }
  .auth-success {
    background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3);
    border-radius: 10px; padding: 10px 14px;
    font-size: 12px; color: #7ee2a3;
    margin-bottom: 14px; line-height: 1.4;
  }
  .auth-close {
    position: absolute; top: 14px; right: 14px;
    width: 40px; height: 40px; border-radius: 50%;
    background: rgba(196,178,255,0.04); border: 1px solid var(--board-line, rgba(196,178,255,0.08));
    color: var(--chalk-dim, rgba(255,255,255,0.5)); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-family: inherit;
    transition: all 0.2s;
  }
  .auth-close:hover { background: rgba(196,178,255,0.08); color: var(--chalk, #fff); }

  /* ─── Achievement Toasts ─────────────────────────────────────────────── */
  #ach-toast-container {
    position: fixed; bottom: 20px; right: 20px;
    z-index: 9999;
    display: flex; flex-direction: column; gap: 10px;
    pointer-events: none;
    max-width: 360px;
  }
  @media (max-width: 560px) {
    #ach-toast-container { right: 12px; left: 12px; bottom: 12px; max-width: none; }
    .ach-toast { min-width: 0; width: 100%; padding: 12px 14px; }
    .ach-toast-icon { font-size: 26px; }
    .ach-toast-name { font-size: 13px; }
    .ach-toast-desc { font-size: 11px; }
  }
  .ach-toast {
    pointer-events: all;
    background: var(--board-raised, rgba(18,10,48,0.96));
    border: 1px solid rgba(240,192,0,0.35);
    border-radius: 14px 14px 8px 8px;
    padding: 14px 18px;
    display: flex; align-items: center; gap: 14px;
    min-width: 280px;
    box-shadow: 0 16px 40px rgba(0,0,0,0.55), 0 6px 15px rgba(0,0,0,0.4);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    transform: translateX(120%); opacity: 0;
    transition: transform 0.45s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.3s;
    cursor: pointer;
    position: relative; overflow: hidden;
  }
  .ach-toast.show { transform: translateX(0); opacity: 1; }
  .ach-toast.exit { transform: translateX(120%); opacity: 0; }
  .ach-toast::after {
    content: ''; position: absolute; left: 0; bottom: 0;
    height: 2px; width: 100%;
    background: linear-gradient(90deg, #f0c000, var(--bell, #d7263d));
    transform-origin: left;
    animation: achToastProgress 4.5s linear forwards;
  }
  @keyframes achToastProgress {
    from { transform: scaleX(1); } to { transform: scaleX(0); }
  }
  .ach-toast-icon { font-size: 30px; flex-shrink: 0; line-height: 1; }
  .ach-toast-body { flex: 1; min-width: 0; }
  .ach-toast-label {
    font-size: 10px; font-weight: 700;
    color: #f0c000; margin-bottom: 3px;
  }
  .ach-toast-name { font-family: 'Kanit', inherit; font-size: 14px; font-weight: 700; color: var(--chalk, #fff); }
  .ach-toast-desc { font-size: 11px; color: var(--chalk-dim, rgba(255,255,255,0.5)); margin-top: 2px; line-height: 1.4; }
  `;
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ─── Modal-HTML ────────────────────────────────────────────────────────────
  // Zwei separate Forms (login + register), damit Passwort-Manager wie Proton Pass
  // sie korrekt klassifizieren — sie scannen einmal beim Anzeigen und merken sich
  // den Typ. Dynamisches Toggeln eines einzigen Forms verwirrt die Heuristiken.
  const modalHtml = `
    <div class="auth-modal-backdrop" id="auth-modal-backdrop">
      <div class="auth-modal" style="position:relative">
        <button class="auth-close" id="auth-close" type="button" aria-label="Schließen">✕</button>
        <div class="auth-modal-eyebrow" id="auth-eyebrow">Anmelden</div>
        <h2 id="auth-title">Willkommen zurück</h2>
        <div class="auth-modal-sub" id="auth-sub">Melde dich an, um deine Highscores geräteübergreifend zu speichern.</div>
        <div id="auth-msg"></div>

        <form id="auth-form-login" method="post" action="#login" autocomplete="on" data-form-type="login" aria-label="Anmelden">
          <div class="auth-field">
            <label for="login-email">Email oder Username</label>
            <input id="login-email" name="email" type="text" required autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" inputmode="email" />
          </div>
          <div class="auth-field">
            <label for="login-password">Passwort</label>
            <input id="login-password" name="password" type="password" required minlength="6" autocomplete="current-password" />
          </div>
          <button type="submit" class="auth-submit" id="login-submit">Anmelden</button>
        </form>

        <form id="auth-form-register" method="post" action="#register" autocomplete="on" data-form-type="register" aria-label="Registrieren" style="display:none">
          <div class="auth-field">
            <label for="register-username">Username</label>
            <input id="register-username" name="username" type="text" required minlength="3" maxlength="20" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" />
          </div>
          <div class="auth-field">
            <label for="register-email">Email</label>
            <input id="register-email" name="email" type="email" required autocomplete="email" autocapitalize="none" autocorrect="off" spellcheck="false" inputmode="email" />
          </div>
          <div class="auth-field">
            <label for="register-password">Passwort</label>
            <input id="register-password" name="new-password" type="password" required minlength="6" autocomplete="new-password" />
          </div>
          <div class="auth-field">
            <label for="register-password2">Passwort bestätigen</label>
            <input id="register-password2" name="new-password-confirm" type="password" required minlength="6" autocomplete="new-password" />
          </div>
          <button type="submit" class="auth-submit" id="register-submit">Account erstellen</button>
        </form>

        <div class="auth-switch">
          <span id="auth-switch-text">Noch kein Account?</span>
          <a id="auth-switch-link">Registrieren</a>
        </div>
      </div>
    </div>
  `;
  const modalWrap = document.createElement('div');
  modalWrap.innerHTML = modalHtml;
  document.body.appendChild(modalWrap.firstElementChild);

  const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/;
  const SYNTH_DOMAIN = 'blockdrop.local';
  const synthEmail = name => String(name || '').trim().toLowerCase() + '@' + SYNTH_DOMAIN;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // ─── Auth-Manager ──────────────────────────────────────────────────────────
  const Auth = {
    client,
    user: null,
    profile: null,
    _ready: false,
    _listeners: [],

    onChange(cb) {
      this._listeners.push(cb);
      if (this._ready) cb(this.user, this.profile);
    },
    _notify() {
      this._listeners.forEach(cb => {
        try { cb(this.user, this.profile); } catch (e) { console.error(e); }
      });
    },

    // Laufnummer: überholt eine ältere Antwort eine neuere, zählt nur die neueste
    _profSeq: 0,
    async _loadProfile() {
      const seq = ++this._profSeq;
      if (!this.user) { this.profile = null; return; }
      let data = null;
      try {
        const res = await client.from('profiles').select('*').eq('id', this.user.id).maybeSingle();
        if (res.error) console.warn('[Auth] Profile load:', res.error.message);
        data = res.data;
      } catch (e) { console.warn('[Auth] Profile load:', e); }
      if (seq !== this._profSeq) return;
      this.profile = data || null;
    },

    async init() {
      let session = null;
      try { ({ data: { session } } = await client.auth.getSession()); }
      catch (e) { console.warn('[Auth] Session:', e); }
      this.user = session?.user || null;
      await this._loadProfile();
      this._ready = true;
      this._notify();

      // Kein await im Callback (Supabase sperrt sonst den Auth-Lock) und nur bei echtem
      // User-Wechsel benachrichtigen: Token-Refresh und Tab-Fokus melden denselben User erneut.
      client.auth.onAuthStateChange((_event, session) => {
        const next = session?.user || null;
        const changed = (next ? next.id : null) !== (this.user ? this.user.id : null);
        this.user = next;
        if (!changed) return;
        // Mitten in der Registrierung gibt es das Profil noch nicht: signUp meldet selbst, wenn es fertig ist
        setTimeout(async () => { if (this._signingUp) return; await this._loadProfile(); this._notify(); }, 0);
      });
    },

    async signUp(email, password, username) {
      this._signingUp = true;
      try { return await this._signUp(email, password, username); }
      finally {
        this._signingUp = false;
        // Egal wie es ausging: Oberfläche auf den echten Stand bringen (eingeloggt mit/ohne Profil, oder gar nicht)
        await this._loadProfile();
        this._notify();
      }
    },
    async _signUp(email, password, username) {
      // Erst prüfen, dann anlegen: sonst bleibt bei vergebenem Namen ein Konto ohne Profil zurück
      if (await this.usernameTaken(username)) return { error: { message: 'Username schon vergeben' } };
      const { data, error } = await client.auth.signUp({ email, password, options: { data: { username: username.trim() } } });
      if (error) return { error };
      if (!data.user) return { error: { message: 'Registrierung fehlgeschlagen' } };

      // Sicherstellen dass wir wirklich eingeloggt sind — sonst RLS blockiert Profile-Insert
      if (!data.session) {
        const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
        if (signInErr) {
          return { error: { message: 'Account erstellt, aber Email muss erst bestätigt werden. Bestätigungs-Mail prüfen.' } };
        }
      }

      // Profile erstellen (RLS erlaubt nur insert für auth.uid() === id)
      const { error: pErr } = await client.from('profiles').insert({
        id: data.user.id,
        username: username.trim()
      });
      if (pErr) {
        if (pErr.code === '23505') return { error: { message: 'Username schon vergeben. Dein Konto ist angelegt: wähl oben rechts einen anderen Namen.' } };
        return { error: pErr };
      }
      this.user = data.user;
      return { data };
    },

    // true, wenn der Name (ohne Rücksicht auf Groß-/Kleinschreibung) schon jemand anderem gehört
    async usernameTaken(username) {
      const name = (username || '').trim();
      if (!USERNAME_RE.test(name)) return false;
      const { data, error } = await client.from('profiles').select('id').ilike('username', name.replace(/_/g, '\\_')).limit(2);
      if (error) { console.warn('[Auth] usernameTaken:', error.message); return false; }
      return (data || []).some(p => !(this.user && p.id === this.user.id));
    },

    // Eingeloggt, aber ohne Profilzeile (Registrierung war unterbrochen): Profil nachträglich anlegen
    async createProfile(username) {
      if (!this.user) return { error: { message: 'Nicht angemeldet' } };
      const name = (username || '').trim();
      if (!USERNAME_RE.test(name)) return { error: { message: 'Username: 3–20 Zeichen, nur Buchstaben, Zahlen, _ und -.' } };
      if (await this.usernameTaken(name)) return { error: { message: 'Username schon vergeben' } };
      const { error } = await client.from('profiles').insert({ id: this.user.id, username: name });
      if (error) return { error: error.code === '23505' ? { message: 'Username schon vergeben' } : error };
      await this._loadProfile();
      this._notify();
      return {};
    },

    // Login per E-Mail ODER Username. Konten aus Block Games haben keine echte Auth-Mail,
    // sondern <username>@blockdrop.local; dieselbe Kaskade wie in block-games/renderer/auth.js.
    async signIn(identifier, password) {
      const id = (identifier || '').trim();
      const first = await client.auth.signInWithPassword({ email: id.includes('@') ? id : synthEmail(id), password });
      if (!first.error) return first;
      // Username eines Kontos mit echter Auth-Mail: die Datenbank kennt die Zuordnung (falls die Funktion existiert)
      try {
        const { data: resolved, error } = await client.rpc('resolve_login_email', { identifier: id });
        if (!error && resolved && resolved !== id) return await client.auth.signInWithPassword({ email: resolved, password });
      } catch (e) { /* Funktion fehlt: beim ersten Fehler bleiben */ }
      return first;
    },

    async signOut() {
      await client.auth.signOut();
    },

    // ─── Score-API ──────────────────────────────────────────────────────────
    async saveScore({ game, mode, score, level, lines }) {
      if (!this.user) return { error: { message: 'Nicht angemeldet' } };
      return await client.from('scores').insert({
        user_id: this.user.id,
        game, mode, score,
        level: level ?? null,
        lines: lines ?? null
      });
    },

    // Genau EIN Bestwert pro Spieler und Spiel (Idle-Spiele): legt die Zeile an
    // oder hebt sie nur an, wenn der neue Wert höher ist. Braucht
    // blockpresser_scores_setup.sql (Update-Policy + Unique-Index).
    async saveBestScore({ game, mode, score }) {
      if (!this.user) return { error: { message: 'Nicht angemeldet' } };
      const { data: row, error: selErr } = await client.from('scores')
        .select('id, score').eq('user_id', this.user.id).eq('game', game).maybeSingle();
      if (selErr) return { error: selErr };
      if (!row) return await client.from('scores').insert({ user_id: this.user.id, game, mode, score });
      if (score <= row.score) return { data: row, error: null };
      return await client.from('scores').update({ score }).eq('id', row.id);
    },

    async getMyScores(game, mode, limit = 10) {
      if (!this.user) return [];
      let q = client.from('scores').select('*')
        .eq('user_id', this.user.id)
        .eq('game', game)
        .order('score', { ascending: false })
        .limit(limit);
      if (mode) q = q.eq('mode', mode);
      const { data } = await q;
      return data || [];
    },

    // Holt rohe scores im Zeitfenster für Verteilungen.
    // Caller dedupliziert/aggregiert clientseitig. Liest auch ohne Login (RLS: scores select = public).
    async getScoresInRange(game, mode, startIso, endIso) {
      let q = client.from('scores')
        .select('user_id, level, score, created_at')
        .eq('game', game)
        .gte('created_at', startIso)
        .lt('created_at', endIso);
      if (mode) q = q.eq('mode', mode);
      const { data, error } = await q;
      if (error) { console.warn('[Auth] ScoresInRange:', error.message); return []; }
      return data || [];
    },

    async getLeaderboard(game, mode, limit = 20) {
      let q = client.from('leaderboard').select('*')
        .eq('game', game)
        .order('best_score', { ascending: false })
        .limit(limit);
      if (mode) q = q.eq('mode', mode);
      const { data, error } = await q;
      if (error) console.warn('[Auth] Leaderboard:', error.message);
      return data || [];
    },

    // ─── Achievements ──────────────────────────────────────────────────────
    async saveAchievements(list) {
      if (!this.user) return;
      return await client.from('profiles')
        .update({ achievements: list })
        .eq('id', this.user.id);
    },

    async loadAchievements() {
      if (!this.user) return null;
      // null = Lesen fehlgeschlagen oder kein Profil (darf nicht als „Cloud ist leer" gelten)
      const { data, error } = await client.from('profiles')
        .select('achievements').eq('id', this.user.id).maybeSingle();
      if (error || !data) return null;
      return Array.isArray(data.achievements) ? data.achievements : [];
    },

    // ─── Profil bearbeiten ───────────────────────────────────────────────────
    // Username ändern. Gibt {error} zurück oder {} bei Erfolg.
    async updateUsername(newUsername) {
      if (!this.user) return { error: { message: 'Nicht angemeldet' } };
      const name = (newUsername || '').trim();
      if (name.length < 3) return { error: { message: 'Username muss mindestens 3 Zeichen haben.' } };
      if (name.length > 20) return { error: { message: 'Username darf höchstens 20 Zeichen haben.' } };
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) return { error: { message: 'Username darf nur Buchstaben, Zahlen, _ und - enthalten.' } };
      if (await this.usernameTaken(name)) return { error: { message: 'Username schon vergeben' } };
      const { error } = await client.from('profiles')
        .update({ username: name }).eq('id', this.user.id);
      if (error) {
        if (error.code === '23505') return { error: { message: 'Username schon vergeben' } };
        return { error };
      }
      // Block-Games-Konto: die künstliche Login-Mail zieht mit, sonst ginge der Login nur noch mit dem alten Namen
      if ((this.user.email || '').endsWith('@' + SYNTH_DOMAIN)) {
        const { error: aErr } = await client.auth.updateUser({ email: synthEmail(name), data: { ...(this.user.user_metadata || {}), username: name } });
        if (aErr) console.warn('[Auth] Login-Mail nicht nachgezogen:', aErr.message);
      }
      await this._loadProfile();
      this._notify();
      return {};
    },

    // Passwort ändern (Nutzer muss eingeloggt sein).
    async updatePassword(newPassword) {
      if (!this.user) return { error: { message: 'Nicht angemeldet' } };
      if (!newPassword || newPassword.length < 6) {
        return { error: { message: 'Passwort muss mindestens 6 Zeichen haben.' } };
      }
      const { error } = await client.auth.updateUser({ password: newPassword });
      if (error) return { error };
      return {};
    },

    // Profilbild hochladen → Supabase Storage Bucket "avatars". Pfad beginnt mit
    // der user.id, damit die Storage-RLS-Policy (foldername[1] === auth.uid) greift.
    async uploadAvatar(file) {
      if (!this.user) return { error: { message: 'Nicht angemeldet' } };
      if (!file) return { error: { message: 'Keine Datei gewählt' } };
      if (!file.type.startsWith('image/')) return { error: { message: 'Nur Bilddateien erlaubt.' } };
      if (file.size > 5 * 1024 * 1024) return { error: { message: 'Bild zu groß (max. 5 MB).' } };

      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
      const path = `${this.user.id}/avatar_${Date.now()}.${ext}`;
      const { error: upErr } = await client.storage.from('avatars')
        .upload(path, file, { upsert: true, cacheControl: '3600', contentType: file.type });
      if (upErr) return { error: upErr };

      const { data } = client.storage.from('avatars').getPublicUrl(path);
      const url = data.publicUrl;
      const { error: pErr } = await client.from('profiles')
        .update({ avatar_url: url }).eq('id', this.user.id);
      if (pErr) return { error: pErr };
      this._cleanAvatars(path);

      await this._loadProfile();
      this._notify();
      return { url };
    },

    // Alte Profilbilder aus dem Storage entfernen (alles im eigenen Ordner außer `keep`)
    async _cleanAvatars(keep) {
      try {
        const dir = this.user.id;
        const { data } = await client.storage.from('avatars').list(dir);
        const old = (data || []).map(o => dir + '/' + o.name).filter(p => p !== keep);
        if (old.length) await client.storage.from('avatars').remove(old);
      } catch (e) { /* Aufräumen ist nicht kritisch */ }
    },

    // Profilbild entfernen.
    async removeAvatar() {
      if (!this.user) return { error: { message: 'Nicht angemeldet' } };
      const { error } = await client.from('profiles')
        .update({ avatar_url: null }).eq('id', this.user.id);
      if (error) return { error };
      this._cleanAvatars(null);
      await this._loadProfile();
      this._notify();
      return {};
    },

    // ─── Freunde ─────────────────────────────────────────────────────────────
    // Beziehungs-Tabelle `friends`: requester_id, addressee_id, status
    // ('pending' | 'accepted'). Anfrage + Bestätigen. Egal welche Richtung —
    // wir fragen beide Richtungen ab.
    async _friendRow(otherId) {
      if (!this.user || !UUID_RE.test(otherId)) return null;
      const uid = this.user.id;
      const { data, error } = await client.from('friends')
        .select('*')
        .or(`and(requester_id.eq.${uid},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${uid})`);
      if (error) { console.warn('[Auth] friendRow:', error.message); return null; }
      const rows = data || [];
      if (!rows.length) return null;
      // Bei (theoretisch) doppelten Richtungen: accepted gewinnt.
      return rows.find(r => r.status === 'accepted') || rows[0];
    },

    // Status zu einem anderen User:
    // 'self' | 'none' | 'friends' | 'outgoing' (ich hab angefragt) | 'incoming' (er hat angefragt)
    async friendStatus(otherId) {
      if (!this.user) return 'none';
      if (otherId === this.user.id) return 'self';
      const row = await this._friendRow(otherId);
      if (!row) return 'none';
      if (row.status === 'accepted') return 'friends';
      return row.requester_id === this.user.id ? 'outgoing' : 'incoming';
    },

    async sendFriendRequest(otherId) {
      if (!this.user) return { error: { message: 'Nicht angemeldet' } };
      if (!UUID_RE.test(otherId)) return { error: { message: 'Ungültige ID' } };
      if (otherId === this.user.id) return { error: { message: 'Du kannst dich nicht selbst hinzufügen.' } };
      const existing = await this._friendRow(otherId);
      if (existing) {
        if (existing.status === 'accepted') return { error: { message: 'Ihr seid schon Freunde.' } };
        if (existing.requester_id === this.user.id) return { error: { message: 'Anfrage läuft bereits.' } };
        // Die andere Person hat uns schon angefragt → direkt annehmen.
        return await this.acceptFriendRequest(otherId);
      }
      const { error } = await client.from('friends').insert({
        requester_id: this.user.id, addressee_id: otherId, status: 'pending'
      });
      if (error) {
        if (error.code === '23505') return { error: { message: 'Anfrage existiert bereits.' } };
        return { error };
      }
      return {};
    },

    async acceptFriendRequest(otherId) {
      if (!this.user) return { error: { message: 'Nicht angemeldet' } };
      if (!UUID_RE.test(otherId)) return { error: { message: 'Ungültige ID' } };
      const { data, error } = await client.from('friends')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('requester_id', otherId).eq('addressee_id', this.user.id).eq('status', 'pending')
        .select('id');
      if (error) return { error };
      if (!data || !data.length) return { error: { message: 'Die Anfrage gibt es nicht mehr.' } };
      return {};
    },

    // Entfernt jede Beziehung: Freund entfernen / Anfrage zurückziehen / ablehnen.
    async removeFriend(otherId) {
      if (!this.user) return { error: { message: 'Nicht angemeldet' } };
      if (!UUID_RE.test(otherId)) return { error: { message: 'Ungültige ID' } };
      const uid = this.user.id;
      const { error } = await client.from('friends')
        .delete()
        .or(`and(requester_id.eq.${uid},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${uid})`);
      if (error) return { error };
      return {};
    },

    // Alle Beziehungen + Profile, gruppiert in { friends, incoming, outgoing }.
    async getFriendOverview() {
      const empty = { friends: [], incoming: [], outgoing: [] };
      if (!this.user) return empty;
      const uid = this.user.id;
      const { data, error } = await client.from('friends')
        .select('*')
        .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`)
        .order('created_at', { ascending: false });
      if (error) { console.warn('[Auth] friends:', error.message); return empty; }
      const rows = data || [];
      const otherIds = rows.map(r => r.requester_id === uid ? r.addressee_id : r.requester_id);
      let profMap = new Map();
      if (otherIds.length) {
        const { data: profs } = await client.from('profiles')
          .select('id, username, avatar_url').in('id', [...new Set(otherIds)]);
        profMap = new Map((profs || []).map(p => [p.id, p]));
      }
      const enrich = (row) => {
        const otherId = row.requester_id === uid ? row.addressee_id : row.requester_id;
        const p = profMap.get(otherId) || {};
        return {
          id: otherId,
          username: p.username || '—',
          avatar_url: p.avatar_url || null,
          since: row.responded_at || row.created_at,
        };
      };
      const res = { friends: [], incoming: [], outgoing: [] };
      for (const r of rows) {
        if (r.status === 'accepted') res.friends.push(enrich(r));
        else if (r.requester_id === uid) res.outgoing.push(enrich(r));
        else res.incoming.push(enrich(r));
      }
      return res;
    },

    // User per Username suchen (für "Freund hinzufügen"). Min. 2 Zeichen.
    async searchUsers(query, limit = 12) {
      const q = (query || '').trim();
      if (q.length < 2) return [];
      const { data, error } = await client.from('profiles')
        .select('id, username, avatar_url')
        .ilike('username', `%${q}%`)
        .limit(limit);
      if (error) { console.warn('[Auth] search:', error.message); return []; }
      let rows = data || [];
      if (this.user) rows = rows.filter(p => p.id !== this.user.id);
      return rows;
    },

    // Öffentliches Profil eines beliebigen Users laden (RLS: profiles select = public).
    async getPublicProfile(userId) {
      if (!userId) return null;
      const { data, error } = await client.from('profiles')
        .select('id, username, avatar_url, created_at, achievements')
        .eq('id', userId).maybeSingle();
      if (error) { console.warn('[Auth] publicProfile:', error.message); return null; }
      return data || null;
    },

    // Öffentliches Profil per Username (für Leaderboards, die nur den Namen haben).
    async getPublicProfileByUsername(username) {
      const name = (username || '').trim();
      if (!name) return null;
      const { data, error } = await client.from('profiles')
        .select('id, username, avatar_url, created_at, achievements')
        .eq('username', name).maybeSingle();
      if (error) { console.warn('[Auth] publicProfileByName:', error.message); return null; }
      return data || null;
    },

    // F1-Saison-Punkte eines Users (für öffentliches Profil). Liefert null wenn keine.
    async getF1Points(userId, season) {
      if (!userId) return null;
      let q = client.from('f1_points').select('season, points').eq('user_id', userId);
      if (season) q = q.eq('season', season);
      q = q.order('season', { ascending: false }).limit(1);
      const { data, error } = await q;
      if (error) { console.warn('[Auth] f1Points:', error.message); return null; }
      return (data && data[0]) || null;
    },

    // ─── UI ────────────────────────────────────────────────────────────────
    openLogin() { showModal('login'); },
    openRegister() { showModal('register'); }
  };

  // ─── Modal-Logik ───────────────────────────────────────────────────────────
  const backdrop = document.getElementById('auth-modal-backdrop');
  const loginForm = document.getElementById('auth-form-login');
  const registerForm = document.getElementById('auth-form-register');
  const loginEmail = document.getElementById('login-email');
  const loginPass  = document.getElementById('login-password');
  const loginSubmit = document.getElementById('login-submit');
  const regUser  = document.getElementById('register-username');
  const regEmail = document.getElementById('register-email');
  const regPass  = document.getElementById('register-password');
  const regPass2 = document.getElementById('register-password2');
  const regSubmit = document.getElementById('register-submit');
  const titleEl = document.getElementById('auth-title');
  const subEl = document.getElementById('auth-sub');
  const eyebrowEl = document.getElementById('auth-eyebrow');
  const switchText = document.getElementById('auth-switch-text');
  const switchLink = document.getElementById('auth-switch-link');
  const msgEl = document.getElementById('auth-msg');
  const closeBtn = document.getElementById('auth-close');

  let mode = 'login';

  function setMode(newMode) {
    mode = newMode;
    msgEl.innerHTML = '';
    if (mode === 'login') {
      eyebrowEl.textContent = 'Anmelden';
      titleEl.textContent = 'Willkommen zurück';
      subEl.textContent = 'Melde dich an, um deine Highscores geräteübergreifend zu speichern.';
      loginForm.style.display = '';
      registerForm.style.display = 'none';
      switchText.textContent = 'Noch kein Account?';
      switchLink.textContent = 'Registrieren';
    } else {
      eyebrowEl.textContent = 'Registrieren';
      titleEl.textContent = 'Account erstellen';
      subEl.textContent = 'Wähl einen Username und ein Passwort — Highscores + Achievements sind danach auf allen Geräten verfügbar.';
      loginForm.style.display = 'none';
      registerForm.style.display = '';
      switchText.textContent = 'Schon angemeldet?';
      switchLink.textContent = 'Anmelden';
    }
  }

  function showModal(m) {
    setMode(m || 'login');
    backdrop.classList.add('open');
    setTimeout(() => (mode === 'register' ? regUser : loginEmail).focus(), 250);
  }
  function hideModal() {
    backdrop.classList.remove('open');
    loginForm.reset();
    registerForm.reset();
    msgEl.innerHTML = '';
  }
  function showMsg(cls, text) {
    const d = document.createElement('div');
    d.className = cls; d.textContent = text;
    msgEl.replaceChildren(d);
  }
  function showErr(text) { showMsg('auth-error', text); }
  function showOk(text) { showMsg('auth-success', text); }

  closeBtn.addEventListener('click', hideModal);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) hideModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && backdrop.classList.contains('open')) hideModal();
  });
  switchLink.addEventListener('click', () => setMode(mode === 'login' ? 'register' : 'login'));

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    loginSubmit.disabled = true;
    const origLabel = loginSubmit.textContent;
    loginSubmit.textContent = '...';
    msgEl.innerHTML = '';
    try {
      const { error } = await Auth.signIn(loginEmail.value.trim(), loginPass.value);
      if (error) { showErr(translateError(error)); return; }
      hideModal();
    } finally {
      loginSubmit.disabled = false;
      loginSubmit.textContent = origLabel;
    }
  });

  registerForm.addEventListener('submit', async e => {
    e.preventDefault();
    regSubmit.disabled = true;
    const origLabel = regSubmit.textContent;
    regSubmit.textContent = '...';
    msgEl.innerHTML = '';
    try {
      const username = regUser.value.trim();
      const email = regEmail.value.trim();
      const password = regPass.value;
      if (username.length < 3) { showErr('Username muss mindestens 3 Zeichen haben.'); return; }
      if (username.length > 20) { showErr('Username darf höchstens 20 Zeichen haben.'); return; }
      if (!/^[a-zA-Z0-9_-]+$/.test(username)) { showErr('Username darf nur Buchstaben, Zahlen, _ und - enthalten.'); return; }
      if (regPass2.value !== password) { showErr('Passwörter stimmen nicht überein.'); return; }
      const { error } = await Auth.signUp(email, password, username);
      if (error) { showErr(translateError(error)); return; }
      hideModal();
    } finally {
      regSubmit.disabled = false;
      regSubmit.textContent = origLabel;
    }
  });

  function translateError(err) {
    const m = (err.message || '').toLowerCase();
    if (m.includes('invalid login')) return 'Email/Username oder Passwort falsch.';
    if (m.includes('already registered') || m.includes('user already')) return 'Diese Email ist schon registriert.';
    if (m.includes('password should be')) return 'Passwort muss mindestens 6 Zeichen haben.';
    if (m.includes('rate limit')) return 'Zu viele Versuche. Bitte kurz warten.';
    return err.message || 'Unbekannter Fehler';
  }

  // ─── Einstellungen im Menü ────────────────────────────────────────────────
  // Die Version gehört /fx.js (dort auch der Dialog beim ersten Besuch und das Cookie).
  const MODES = [
    ['standard', 'OG', 'Die Spielhalle in Neon, ruhig: keine Blitze, kein Wackeln.'],
    ['adhs', 'ADHS', 'Die Spielhalle mit Blitzen, Wackeln und Konfetti-Regen.'],
    ['design', 'Cinema', 'Dunkel, still, große Schrift. Die Halle bleibt aus.'],
  ];
  const modeNow = () => window.FX && 'mode' in window.FX ? window.FX.mode : 'adhs';
  const modeHint = m => (MODES.find(x => x[0] === m) || MODES[0])[2];
  const settingsHtml = () => {
    const now = modeNow();
    return `
            <div class="auth-menu-label">Version</div>
            <div class="auth-modes" role="radiogroup" aria-label="Version">${MODES.map(([id, name]) =>
              `<button class="auth-mode" data-mode="${id}" type="button" role="radio" aria-checked="${id === now}">${name}</button>`).join('')}</div>
            <div class="auth-menu-hint" data-mode-hint>${modeHint(now)}</div>
            <div class="auth-menu-label">Cookies</div>
            <div class="auth-modes" role="radiogroup" aria-label="Cookies">${[[1, 'Erlaubt'], [0, 'Aus']].map(([v, name]) =>
              `<button class="auth-mode" data-consent="${v}" type="button" role="radio" aria-checked="${!!v === consentNow()}">${name}</button>`).join('')}</div>
            <div class="auth-menu-hint" data-consent-hint>${consentHint()}</div>`;
  };
  const consentNow = () => !!(window.FX && window.FX.consent);
  const consentHint = () => consentNow() ? 'Version und Spielstände bleiben ein Jahr gemerkt.' : 'Nichts wird gemerkt. Beim nächsten Besuch fragt die Seite wieder.';
  const syncConsent = () => {
    document.querySelectorAll('[data-consent]').forEach(b => b.setAttribute('aria-checked', (b.dataset.consent === '1') === consentNow()));
    document.querySelectorAll('[data-consent-hint]').forEach(h => { h.textContent = consentHint(); });
  };
  const syncSettings = () => {
    const now = modeNow();
    document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-checked', b.dataset.mode === now));
    document.querySelectorAll('[data-mode-hint]').forEach(h => { h.textContent = modeHint(now); });
  };
  function bindSettings(slot) {
    slot.querySelectorAll('[data-mode]').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation(); // Menü bleibt offen
      const m = btn.dataset.mode;
      if (!window.FX || !window.FX.setMode) return;
      window.FX.setMode(m);
      // Der Wechsel in den oder aus dem Design-Modus lädt neu: bis dahin zeigt der Schalter schon die Wahl
      document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-checked', b.dataset.mode === m));
      document.querySelectorAll('[data-mode-hint]').forEach(h => { h.textContent = modeHint(m); });
    }));
    slot.querySelectorAll('[data-consent]').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      if (window.FX && window.FX.setConsent) window.FX.setConsent(btn.dataset.consent === '1');
    }));
  }
  window.addEventListener('fx:adhs', syncSettings);
  window.addEventListener('fx:consent', syncConsent);

  // ─── Auth-Slot in der Navbar mounten ──────────────────────────────────────
  function mountSlots() {
    document.querySelectorAll('[data-auth-slot]').forEach(slot => {
      slot.classList.add('auth-slot');
      slot.classList.toggle('has-gear', !(Auth.user && Auth.profile));
      slot.innerHTML = ''; // reset
      if (Auth.user && Auth.profile) {
        const name = Auth.profile.username || Auth.user.email;
        const initial = (name[0] || '?').toUpperCase();
        const avatarUrl = Auth.profile.avatar_url;
        const avatarHtml = avatarUrl
          ? `<img class="auth-chip-avatar auth-chip-avatar-img" src="${escapeHtml(avatarUrl)}" alt="" />`
          : `<span class="auth-chip-avatar">${initial}</span>`;
        slot.innerHTML = `
          <button class="auth-chip" type="button" aria-haspopup="true">
            ${avatarHtml}
            <span class="auth-chip-name">${escapeHtml(name)}</span>
            <span class="auth-chip-caret">▾</span>
          </button>
          <div class="auth-menu">
            <div class="auth-menu-header">
              <div class="auth-menu-name">${escapeHtml(name)}</div>
              <div class="auth-menu-email">${escapeHtml((Auth.user.email || '').endsWith('@' + SYNTH_DOMAIN) ? 'Block-Games-Konto' : Auth.user.email)}</div>
            </div>
            <button class="auth-menu-item" data-act="profile" type="button">Profil</button>
            <button class="auth-menu-item" data-act="friends" type="button">Freunde</button>
            <button class="auth-menu-item" data-act="achievements" type="button">Achievements</button>
            <button class="auth-menu-item" data-act="stundenplan" type="button">Stundenplan</button>
            <div class="auth-menu-sep"></div>${settingsHtml()}
            <div class="auth-menu-sep"></div>
            <button class="auth-menu-item danger" data-act="logout" type="button">Abmelden</button>
          </div>
        `;
        const chip = slot.querySelector('.auth-chip');
        const menu = slot.querySelector('.auth-menu');
        chip.addEventListener('click', e => {
          e.stopPropagation();
          menu.classList.toggle('open');
        });
        menu.querySelectorAll('[data-act]').forEach(btn => {
          btn.addEventListener('click', () => {
            const act = btn.dataset.act;
            if (act === 'logout') Auth.signOut();
            if (act === 'profile') window.location.href = '/profile/';
            if (act === 'friends') window.location.href = '/freunde/';
            if (act === 'achievements') {
              // Auf jeden Pfad funktionierender Link
              window.location.href = '/achievements/';
            }
            if (act === 'stundenplan') window.location.href = '/stundenplan/';
          });
        });
        bindSettings(slot);
      } else if (Auth.user) {
        // Eingeloggt, aber ohne Profil: Username nachholen statt wieder „Anmelden" zu zeigen
        slot.innerHTML = gearHtml() + `<button class="auth-login-btn" type="button">Username wählen</button>`;
        bindGear(slot);
        slot.querySelector('.auth-login-btn').addEventListener('click', async () => {
          const hint = (Auth.user.user_metadata && Auth.user.user_metadata.username) || '';
          const name = window.prompt('Dein Konto hat noch keinen Username. Wähl einen (3–20 Zeichen: Buchstaben, Zahlen, _ und -). „Abbrechen" meldet dich ab.', hint);
          if (name === null) { Auth.signOut(); return; }
          const { error } = await Auth.createProfile(name);
          if (error) window.alert(error.message || 'Das hat nicht geklappt.');
        });
      } else {
        slot.innerHTML = gearHtml() + `<button class="auth-login-btn" type="button">Anmelden</button>`;
        bindGear(slot);
        slot.querySelector('.auth-login-btn').addEventListener('click', () => Auth.openLogin());
      }
    });
  }
  // Ohne Konto: ein Zahnrad neben „Anmelden" öffnet dieselben Einstellungen
  const gearHtml = () => `
          <button class="auth-gear" type="button" aria-haspopup="true" aria-label="Einstellungen" title="Einstellungen">⚙</button>
          <div class="auth-menu">${settingsHtml()}
          </div>`;
  function bindGear(slot) {
    const menu = slot.querySelector('.auth-menu');
    slot.querySelector('.auth-gear').addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('open'); });
    menu.addEventListener('click', e => e.stopPropagation());
    bindSettings(slot);
  }
  // Ein einziger Listener schließt offene Konto-Menüs (statt einem neuen pro Auth-Änderung)
  document.addEventListener('click', () => {
    document.querySelectorAll('.auth-menu.open').forEach(m => m.classList.remove('open'));
  });

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  Auth.onChange(() => mountSlots());

  // ─── Achievement-Toast (global) ───────────────────────────────────────────
  function showAchToast(def) {
    if (!def) return;
    let container = document.getElementById('ach-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'ach-toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'ach-toast';
    toast.innerHTML = `
      <div class="ach-toast-icon">${def.icon || '🏆'}</div>
      <div class="ach-toast-body">
        <div class="ach-toast-label">Freigeschaltet</div>
        <div class="ach-toast-name">${escapeHtml(def.name || '')}</div>
        <div class="ach-toast-desc">${escapeHtml(def.desc || '')}</div>
      </div>
    `;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    const dismiss = () => {
      toast.classList.remove('show');
      toast.classList.add('exit');
      setTimeout(() => toast.remove(), 450);
    };
    const auto = setTimeout(dismiss, 4500);
    toast.addEventListener('click', () => { clearTimeout(auto); dismiss(); });
  }
  window.showAchToast = showAchToast;

  // ─── Erfolge: eine Stelle für alle Seiten ─────────────────────────────────
  // Lokal pro Konto getrennt (Gast: Schlüssel ohne ID). Beim Abgleich werden lokale und
  // Cloud-Liste vereinigt, nie überschrieben. Gast-Erfolge wandern beim ersten Login ins Konto.
  const ACH_KEY = 'arcade_achievements';
  const achKey = () => (Auth.user ? ACH_KEY + ':' + Auth.user.id : ACH_KEY);
  const achReadKey = k => { try { const l = JSON.parse(localStorage.getItem(k)); return Array.isArray(l) ? l.filter(a => a && a.id) : []; } catch (e) { return []; } };
  const achWrite = l => { try { localStorage.setItem(achKey(), JSON.stringify(l)); } catch (e) {} };
  const achMerge = (...lists) => { const m = new Map(); lists.flat().forEach(a => { if (a && a.id && !m.has(a.id)) m.set(a.id, a); }); return [...m.values()]; };
  let achSyncing = null, achAgain = false;
  const Achievements = {
    list() { return achReadKey(achKey()); },
    has(id) { return this.list().some(a => a.id === id); },
    // Schaltet frei und zeigt den Toast; false, wenn schon vorhanden
    unlock(id, def) {
      const list = this.list();
      if (list.some(a => a.id === id)) return false;
      list.push({ id, unlockedAt: new Date().toISOString() });
      achWrite(list);
      if (def) showAchToast(def);
      if (Auth.user) this.sync().catch(() => {});
      return true;
    },
    // Cloud lesen, mit lokal vereinigen, bei Bedarf hochladen. Liefert die vereinigte Liste.
    sync() {
      if (!Auth.user) return Promise.resolve(this.list());
      if (achSyncing) { achAgain = true; return achSyncing; }
      const uid = Auth.user.id;
      const run = async () => {
        const cloud = await Auth.loadAchievements();
        if (!Auth.user || Auth.user.id !== uid || cloud === null) return this.list();
        const guest = achReadKey(ACH_KEY);
        const merged = achMerge(this.list(), cloud, guest);
        achWrite(merged);
        if (guest.length) { try { localStorage.removeItem(ACH_KEY); } catch (e) {} }
        if (merged.length !== cloud.length) await Auth.saveAchievements(merged);
        return merged;
      };
      achSyncing = (async () => {
        try {
          let res = await run();
          // Während des Abgleichs kam ein neuer Erfolg dazu: noch eine Runde
          while (achAgain) { achAgain = false; res = await run(); }
          return res;
        } finally { achSyncing = null; achAgain = false; }
      })();
      return achSyncing;
    },
  };
  window.Achievements = Achievements;
  Auth.onChange(user => { if (user && Auth.profile) Achievements.sync().catch(() => {}); });

  // ─── Gezeichnete Symbole statt Emojis ─────────────────────────────────────
  // Die Seiten schreiben weiter Emojis in ihre Texte und Daten (Erfolge, Kartenköpfe,
  // Hinweise). Hier werden die bekannten beim Einhängen durch ein SVG in einer
  // Strichstärke ersetzt, in der Schriftfarbe der Umgebung. Unbekannte bleiben stehen.
  // Ein Bereich mit data-no-icons bleibt unangetastet.
  const ICONS = {
    '🎮': '<rect x="2" y="7" width="20" height="10" rx="5"/><path d="M7 10v4M5 12h4M15.5 11h.01M18 13h.01"/>',
    '✨': '<path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9zM19 15v5M16.500 17.500h5"/>',
    '🔥': '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z"/>',
    '⚡': '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    '💰': '<circle cx="9" cy="9" r="6"/><path d="M15.500 9.500a6 6 0 1 1-6 6M9 7v4"/>',
    '💥': '<path d="M12 2l2.200 5.300L20 5l-2.300 5.800L22 14l-5.600.6L17 21l-5-3.800L7 21l.6-6.400L2 14l4.300-3.200L4 5l5.800 2.300z"/>',
    '⬇': '<path d="M12 4v16M5 13l7 7 7-7"/>',
    '👆': '<path d="M12 20V4M5 11l7-7 7 7"/>',
    '🙅': '<circle cx="12" cy="12" r="9"/><path d="M5.600 5.600l12.800 12.800"/>',
    '🏆': '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4a4 4 0 0 0 4 4M16 6h4a4 4 0 0 1-4 4M12 13v5M8 20h8"/>',
    '🧱': '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 12h18M12 5v7M8 12v7M16 12v7"/>',
    '🏭': '<path d="M3 21V10l6 4v-4l6 4V5h4v16zM7 17h2M12 17h2"/>',
    '💎': '<path d="M6 4h12l4 6-10 11L2 10zM2 10h20M9 4l3 6 3-6M12 10v11"/>',
    '🔔': '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/>',
    '🕹': '<circle cx="12" cy="5" r="3"/><path d="M12 8v7M5 15h14v5H5z"/>',
    '🎓': '<path d="M2 9l10-5 10 5-10 5zM6 11.500V16c2 2 10 2 12 0v-4.500M22 9v6"/>',
    '🔧': '<path d="M15 6a4 4 0 0 0-5 5l-7 7 3 3 7-7a4 4 0 0 0 5-5l-3 3-2-2z"/>',
    '😴': '<path d="M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10zM14 4h4l-4 4h4"/>',
    '🎰': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M9 5v14M15 5v14M5.500 12h1M11.500 12h1M17.500 12h1"/>',
    '🎨': '<path d="M12 3a9 9 0 1 0 0 18c1.500 0 2-1 2-2 0-1.500 1-2 2-2h2a3 3 0 0 0 3-3c0-6-4-11-9-11z"/><path d="M7.500 12h.01M9.500 8h.01M14.500 7.500h.01"/>',
    '📷': '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.500"/>',
    '✏': '<path d="M4 20l1-5L16 4l4 4L9 19zM14 6l4 4"/>',
    '🔑': '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>',
    '🔎': '<circle cx="11" cy="11" r="6.500"/><path d="M16 16l5 5"/>',
    '📨': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    '🤝': '<circle cx="9" cy="8" r="3.500"/><path d="M2.500 20a6.500 6.500 0 0 1 13 0M16 4.600a3.500 3.500 0 0 1 0 6.800M18 14.500a6.500 6.500 0 0 1 3.500 5.500"/>',
    '📤': '<path d="M21 3L3 10l7 3 3 7zM10 13l5-5"/>',
    '🎉': '<path d="M4 20l4-12 8 8zM14 4v3M18 6l-2 2M20 10h-3"/>',
    '⏳': '<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>',
    '🤷': '<circle cx="12" cy="12" r="9"/><path d="M9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.7.4-1 .9-1 1.700M12 17h.01"/>',
    '⚠': '<path d="M12 3l10 18H2zM12 10v5M12 18h.01"/>',
    '🏁': '<path d="M5 21V4h13l-2 4 2 4H5"/>',
    '💀': '<path d="M5 11a7 7 0 0 1 14 0v4l-2 1v3H7v-3l-2-1zM9 12h.01M15 12h.01M10 19v-2M14 19v-2"/>',
    '🔺': '<path d="M12 4l9 16H3z"/>',
    '💣': '<circle cx="10" cy="14" r="7"/><path d="M15 9l3-3M18 6l2-3M18 6l3 1"/>',
  };
  ICONS['🔍'] = ICONS['🔎'];
  const ICON_RE = new RegExp('(' + Object.keys(ICONS).join('|') + ')\uFE0F?', 'u');
  const iconSvg = key => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[key]}</svg>`;
  function iconizeText(node) {
    const p = node.parentElement;
    if (!p || !ICON_RE.test(node.nodeValue) || p.closest('script, style, textarea, title, svg, [data-no-icons]')) return;
    const parts = node.nodeValue.split(new RegExp(ICON_RE.source, 'gu')), tpl = document.createElement('template');
    tpl.innerHTML = parts.map((s, i) => i % 2 ? iconSvg(s) : escapeHtml(s)).join('');
    node.replaceWith(tpl.content);
  }
  function iconize(root) {
    if (root.nodeType === 3) return iconizeText(root);
    if (root.nodeType !== 1) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = [];
    while (w.nextNode()) list.push(w.currentNode);
    list.forEach(iconizeText);
  }
  function startIcons() {
    iconize(document.body);
    new MutationObserver(muts => { for (const m of muts) { if (m.type === 'characterData') iconizeText(m.target); else m.addedNodes.forEach(iconize); } })
      .observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.body) startIcons(); else document.addEventListener('DOMContentLoaded', startIcons);

  // Expose
  window.Auth = Auth;

  // Auto-init
  Auth.init();
})();
