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
    .auth-chip { min-height: 34px; }
    .auth-login-btn { min-height: 34px; }

    /* Suggestion-/Dropdown-Listen scrollbar mit Trägheit */
    .suggestions, .auth-menu { -webkit-overflow-scrolling: touch; }
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
    border-top: 1px solid rgba(255,255,255,0.05);
    text-align: center;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  .site-footer-inner {
    display: flex; justify-content: center; align-items: center;
    gap: 8px 18px; flex-wrap: wrap;
    font-size: 11px; color: rgba(255,255,255,0.28);
    letter-spacing: 0.3px;
  }
  .site-footer-inner a {
    color: rgba(255,255,255,0.5);
    text-decoration: none;
    font-weight: 600;
    transition: color 0.2s;
  }
  .site-footer-inner a:hover { color: #fff; }
  .site-footer-inner .sep { color: rgba(255,255,255,0.15); }
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

  // ─── Username-basierter Login ───────────────────────────────────────────────
  // Supabase Auth verlangt technisch eine Email. Wer ohne echte Email registriert,
  // bekommt eine synthetische Adresse <username>@blockdrop.local als Auth-Identität.
  // Eine optional angegebene echte Email landet nur als privates user_metadata
  // (contact_email) — nie als Auth-Mail, nie öffentlich. Login per Username oder
  // Kontakt-Mail löst serverseitig (RPC) zur synthetischen Mail auf; echte Mails
  // werden dabei nie an den Client zurückgegeben.
  const SYNTH_DOMAIN = 'blockdrop.local';
  const syntheticEmail = (username) =>
    `${String(username || '').trim().toLowerCase()}@${SYNTH_DOMAIN}`;
  const looksLikeEmail = (s) => /@/.test(String(s || ''));

  // ─── Styles ────────────────────────────────────────────────────────────────
  const css = `
  .auth-chip {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 999px; padding: 5px 12px 5px 5px;
    cursor: pointer; font-family: inherit;
    transition: all 0.2s;
  }
  .auth-chip:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.18); }
  .auth-chip-avatar {
    width: 26px; height: 26px; border-radius: 50%;
    background: linear-gradient(135deg, #e94560, #b8334a);
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 900; color: #fff;
  }
  .auth-chip-avatar-img { object-fit: cover; }
  .auth-chip-name {
    font-size: 12px; font-weight: 700; color: #fff;
    letter-spacing: 0.2px; max-width: 120px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .auth-chip-caret { font-size: 9px; color: rgba(255,255,255,0.4); margin-left: 2px; }
  @media (max-width: 560px) {
    .auth-chip { padding: 4px 10px 4px 4px; }
    .auth-chip-name { max-width: 90px; font-size: 11px; }
    .auth-chip-avatar { width: 22px; height: 22px; font-size: 10px; }
    .auth-login-btn { padding: 7px 12px; font-size: 11px; }
  }

  .auth-menu {
    position: absolute; top: calc(100% + 8px); right: 0;
    background: rgba(12,12,28,0.98);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 14px;
    padding: 8px; min-width: 200px;
    box-shadow: 0 16px 40px rgba(0,0,0,0.6);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    opacity: 0; transform: translateY(-6px) scale(0.97);
    transition: opacity 0.15s, transform 0.15s;
    pointer-events: none; z-index: 200;
  }
  .auth-menu.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: all; }
  .auth-menu-header {
    padding: 10px 12px 12px; border-bottom: 1px solid rgba(255,255,255,0.06);
    margin-bottom: 6px;
  }
  .auth-menu-name { font-size: 13px; font-weight: 800; color: #fff; }
  .auth-menu-email { font-size: 10px; color: rgba(255,255,255,0.4); margin-top: 2px; }
  .auth-menu-item {
    display: block; width: 100%; text-align: left;
    background: transparent; border: none;
    padding: 9px 12px; border-radius: 8px;
    font-family: inherit; font-size: 12px; font-weight: 600;
    color: rgba(255,255,255,0.7); cursor: pointer;
    transition: all 0.15s;
  }
  .auth-menu-item:hover { background: rgba(255,255,255,0.06); color: #fff; }
  .auth-menu-item.danger { color: #ff7a90; }
  .auth-menu-item.danger:hover { background: rgba(233,69,96,0.1); color: #ff97aa; }

  .auth-slot { position: relative; }

  .auth-login-btn {
    display: inline-flex; align-items: center; gap: 6px;
    background: var(--red, #e94560); border: none; border-radius: 10px;
    padding: 8px 18px; color: #fff;
    font-family: inherit; font-size: 12px; font-weight: 700;
    letter-spacing: 0.3px;
    cursor: pointer; text-decoration: none;
    box-shadow: 0 0 20px rgba(233,69,96,0.3);
    transition: all 0.2s;
  }
  .auth-login-btn:hover { background: #f05672; box-shadow: 0 0 30px rgba(233,69,96,0.5); transform: translateY(-1px); }

  /* ─── Modal ──────────────────────────────────────────────────────────── */
  .auth-modal-backdrop {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
    opacity: 0; pointer-events: none;
    transition: opacity 0.22s;
  }
  .auth-modal-backdrop.open { opacity: 1; pointer-events: all; }
  .auth-modal {
    background: rgba(12,12,28,0.98);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 24px;
    padding: 36px; width: 100%; max-width: 380px;
    max-height: calc(100vh - 32px); overflow-y: auto;
    box-shadow: 0 32px 80px rgba(0,0,0,0.8), 0 0 80px rgba(233,69,96,0.08);
    transform: scale(0.9) translateY(20px); opacity: 0;
    transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.22s;
  }
  @media (max-width: 480px) {
    .auth-modal { padding: 28px 22px; border-radius: 20px; }
    .auth-modal h2 { font-size: 22px; }
    .auth-field input { font-size: 16px; padding: 12px 12px; }
  }
  .auth-modal-backdrop.open .auth-modal { transform: scale(1) translateY(0); opacity: 1; }
  .auth-modal-eyebrow {
    font-size: 10px; font-weight: 700; letter-spacing: 4px;
    text-transform: uppercase; color: var(--red, #e94560); margin-bottom: 10px;
  }
  .auth-modal h2 {
    font-size: 26px; font-weight: 900; color: #fff;
    letter-spacing: -1px; margin: 0 0 6px;
  }
  .auth-modal-sub {
    font-size: 12px; color: rgba(255,255,255,0.4);
    margin-bottom: 24px; line-height: 1.5;
  }
  .auth-field { display: block; margin-bottom: 14px; }
  .auth-field label {
    display: block; font-size: 10px; font-weight: 700;
    letter-spacing: 2px; text-transform: uppercase;
    color: rgba(255,255,255,0.35); margin-bottom: 6px;
  }
  .auth-field input {
    width: 100%; background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
    padding: 12px 14px; color: #fff;
    font-family: inherit; font-size: 14px; font-weight: 500;
    outline: none; transition: border-color 0.2s, background 0.2s;
  }
  .auth-field input:focus { border-color: rgba(233,69,96,0.5); background: rgba(255,255,255,0.06); }
  .auth-submit {
    width: 100%; background: var(--red, #e94560); color: #fff;
    border: none; border-radius: 12px; padding: 14px;
    font-family: inherit; font-size: 14px; font-weight: 800;
    letter-spacing: 0.3px; cursor: pointer;
    box-shadow: 0 0 24px rgba(233,69,96,0.35);
    transition: all 0.2s;
    margin-top: 6px;
  }
  .auth-submit:hover:not(:disabled) { background: #f05672; box-shadow: 0 0 36px rgba(233,69,96,0.5); transform: translateY(-1px); }
  .auth-submit:disabled { opacity: 0.5; cursor: not-allowed; }
  .auth-switch {
    text-align: center; margin-top: 18px;
    font-size: 12px; color: rgba(255,255,255,0.4);
  }
  .auth-switch a {
    color: var(--red, #e94560); text-decoration: none;
    font-weight: 700; cursor: pointer;
  }
  .auth-switch a:hover { text-decoration: underline; }
  .auth-error {
    background: rgba(233,69,96,0.1); border: 1px solid rgba(233,69,96,0.3);
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
    width: 30px; height: 30px; border-radius: 50%;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.5); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-family: inherit;
    transition: all 0.2s;
  }
  .auth-close:hover { background: rgba(255,255,255,0.08); color: #fff; }

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
    background: rgba(10,10,24,0.96);
    border: 1px solid rgba(240,192,0,0.35);
    border-radius: 14px;
    padding: 14px 18px;
    display: flex; align-items: center; gap: 14px;
    min-width: 280px;
    box-shadow: 0 16px 40px rgba(0,0,0,0.55), 0 0 30px rgba(240,192,0,0.08);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    transform: translateX(120%); opacity: 0;
    transition: transform 0.45s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s;
    cursor: pointer;
    position: relative; overflow: hidden;
  }
  .ach-toast.show { transform: translateX(0); opacity: 1; }
  .ach-toast.exit { transform: translateX(120%); opacity: 0; }
  .ach-toast::after {
    content: ''; position: absolute; left: 0; bottom: 0;
    height: 2px; width: 100%;
    background: linear-gradient(90deg, #f0c000, #e94560);
    transform-origin: left;
    animation: achToastProgress 4.5s linear forwards;
  }
  @keyframes achToastProgress {
    from { transform: scaleX(1); } to { transform: scaleX(0); }
  }
  .ach-toast-icon { font-size: 30px; flex-shrink: 0; line-height: 1; }
  .ach-toast-body { flex: 1; min-width: 0; }
  .ach-toast-label {
    font-size: 9px; font-weight: 800;
    letter-spacing: 2.5px; text-transform: uppercase;
    color: #f0c000; margin-bottom: 3px;
  }
  .ach-toast-name { font-size: 14px; font-weight: 800; color: #fff; letter-spacing: -0.2px; }
  .ach-toast-desc { font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 2px; line-height: 1.4; }
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
            <input id="login-email" name="username" type="text" required autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" />
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
            <label for="register-email">Email <span style="opacity:.5;font-weight:400">(optional)</span></label>
            <input id="register-email" name="email" type="email" autocomplete="email" autocapitalize="none" autocorrect="off" spellcheck="false" inputmode="email" placeholder="Nur falls du sie als zweiten Login willst" />
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

    async _loadProfile() {
      if (!this.user) { this.profile = null; return; }
      const { data, error } = await client
        .from('profiles').select('*').eq('id', this.user.id).maybeSingle();
      if (error) console.warn('[Auth] Profile load:', error.message);
      this.profile = data || null;
    },

    async init() {
      const { data: { session } } = await client.auth.getSession();
      this.user = session?.user || null;
      // Realtime mit dem User-Token autorisieren, damit RLS-gefilterte
      // postgres_changes (Chat) ankommen.
      if (session?.access_token) { try { client.realtime.setAuth(session.access_token); } catch (e) {} }
      await this._loadProfile();
      this._ready = true;
      this._notify();

      client.auth.onAuthStateChange(async (_event, session) => {
        this.user = session?.user || null;
        try { client.realtime.setAuth(session?.access_token || null); } catch (e) {}
        await this._loadProfile();
        this._notify();
      });
    },

    // Registrierung. `email` ist optional — fehlt sie, wird der Account allein
    // über den Username (via synthetischer Auth-Mail) angelegt.
    async signUp(email, password, username) {
      const uname = (username || '').trim();
      const contact = (email || '').trim();
      const authEmail = syntheticEmail(uname);

      const { data, error } = await client.auth.signUp({
        email: authEmail,
        password,
        options: { data: { username: uname, contact_email: contact || null } }
      });
      if (error) {
        // Synthetische Mail kollidiert → Username (case-insensitiv) schon vergeben.
        const m = (error.message || '').toLowerCase();
        if (m.includes('already registered') || m.includes('already exists') || m.includes('user already')) {
          return { error: { message: 'Username schon vergeben' } };
        }
        return { error };
      }
      if (!data.user) return { error: { message: 'Registrierung fehlgeschlagen' } };

      // Sicherstellen dass wir wirklich eingeloggt sind — sonst RLS blockiert Profile-Insert
      if (!data.session) {
        const { error: signInErr } = await client.auth.signInWithPassword({ email: authEmail, password });
        if (signInErr) return { error: signInErr };
      }

      // Profile erstellen (RLS erlaubt nur insert für auth.uid() === id)
      const { error: pErr } = await client.from('profiles').insert({
        id: data.user.id,
        username: uname
      });
      if (pErr) {
        if (pErr.code === '23505') return { error: { message: 'Username schon vergeben' } };
        return { error: pErr };
      }

      // Wichtig: onAuthStateChange feuert direkt nach signUp — also BEVOR die
      // profiles-Zeile oben existiert — und lädt darum ein leeres Profil. Ohne
      // Profil zeigt die Navbar trotz gültiger Session weiter "Anmelden".
      // Jetzt, wo das Profil steht, den Auth-State frisch übernehmen, damit man
      // sofort eingeloggt ist (kein zweiter manueller Login nötig).
      this.user = data.user;
      await this._loadProfile();
      this._notify();
      return { data };
    },

    // Login per Email ODER Username. Reihenfolge:
    //  1. Email-artig → direkter Versuch (deckt Alt-Accounts mit echter Auth-Mail ab).
    //  2. Username → synthetische Mail client-seitig ableiten und versuchen
    //     (funktioniert ohne Backend für alle neuen Accounts).
    //  3. Fallback: RPC `resolve_login_email` löst Kontakt-Mail bzw. Username zur
    //     synthetischen Auth-Mail auf (gibt nie echte Mails zurück).
    async signIn(identifier, password) {
      const id = (identifier || '').trim();
      let directErr = null;

      if (looksLikeEmail(id)) {
        const r = await client.auth.signInWithPassword({ email: id, password });
        if (!r.error) return r;
        directErr = r.error;
      } else {
        const r = await client.auth.signInWithPassword({ email: syntheticEmail(id), password });
        if (!r.error) return r;
        directErr = r.error;
      }

      const { data: resolved, error: rpcErr } = await client.rpc('resolve_login_email', { identifier: id });
      if (!rpcErr && resolved) {
        return await client.auth.signInWithPassword({ email: resolved, password });
      }

      return { error: directErr || { message: 'Email/Username oder Passwort falsch.' } };
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

    // Holt rohe scores im Zeitfenster für Verteilungen (z. B. Wörtle "Versuche heute").
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
      const { data } = await client.from('profiles')
        .select('achievements').eq('id', this.user.id).maybeSingle();
      return data?.achievements || [];
    },

    // ─── Profil bearbeiten ───────────────────────────────────────────────────
    // Username ändern. Gibt {error} zurück oder {} bei Erfolg.
    async updateUsername(newUsername) {
      if (!this.user) return { error: { message: 'Nicht angemeldet' } };
      const name = (newUsername || '').trim();
      if (name.length < 3) return { error: { message: 'Username muss mindestens 3 Zeichen haben.' } };
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) return { error: { message: 'Username darf nur Buchstaben, Zahlen, _ und - enthalten.' } };
      const { error } = await client.from('profiles')
        .update({ username: name }).eq('id', this.user.id);
      if (error) {
        if (error.code === '23505') return { error: { message: 'Username schon vergeben' } };
        return { error };
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

      await this._loadProfile();
      this._notify();
      return { url };
    },

    // Profilbild entfernen.
    async removeAvatar() {
      if (!this.user) return { error: { message: 'Nicht angemeldet' } };
      const { error } = await client.from('profiles')
        .update({ avatar_url: null }).eq('id', this.user.id);
      if (error) return { error };
      await this._loadProfile();
      this._notify();
      return {};
    },

    // ─── Freunde ─────────────────────────────────────────────────────────────
    // Beziehungs-Tabelle `friends`: requester_id, addressee_id, status
    // ('pending' | 'accepted'). Anfrage + Bestätigen. Egal welche Richtung —
    // wir fragen beide Richtungen ab.
    async _friendRow(otherId) {
      if (!this.user || !otherId) return null;
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
      const { error } = await client.from('friends')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('requester_id', otherId).eq('addressee_id', this.user.id).eq('status', 'pending');
      if (error) return { error };
      return {};
    },

    // Entfernt jede Beziehung: Freund entfernen / Anfrage zurückziehen / ablehnen.
    async removeFriend(otherId) {
      if (!this.user) return { error: { message: 'Nicht angemeldet' } };
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

    // ─── Chat / Direktnachrichten ─────────────────────────────────────────────
    // Tabelle `messages` (sender_id, recipient_id, body, read_at, created_at).
    // Senden erlaubt RLS nur zwischen bestätigten Freunden. Setup: messages_setup.sql.

    // Nachricht an einen Freund senden. Gibt { data } (die eingefügte Zeile) oder { error }.
    async sendMessage(recipientId, body) {
      if (!this.user) return { error: { message: 'Nicht angemeldet' } };
      if (!recipientId) return { error: { message: 'Kein Empfänger' } };
      const text = (body || '').trim();
      if (!text) return { error: { message: 'Leere Nachricht' } };
      if (text.length > 2000) return { error: { message: 'Nachricht zu lang (max. 2000 Zeichen).' } };
      const { data, error } = await client.from('messages')
        .insert({ sender_id: this.user.id, recipient_id: recipientId, body: text })
        .select().single();
      if (error) {
        // RLS-Verstoß = keine (bestätigte) Freundschaft.
        if (error.code === '42501') return { error: { message: 'Du kannst nur Freunden schreiben.' } };
        return { error };
      }
      return { data };
    },

    // Kompletter Verlauf zwischen mir und otherId, chronologisch (älteste zuerst).
    async getConversation(otherId, limit = 200) {
      if (!this.user || !otherId) return [];
      const uid = this.user.id;
      const { data, error } = await client.from('messages')
        .select('*')
        .or(`and(sender_id.eq.${uid},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${uid})`)
        .order('created_at', { ascending: true })
        .limit(limit);
      if (error) { console.warn('[Auth] getConversation:', error.message); return []; }
      return data || [];
    },

    // Meine letzten Nachrichten (gesendet + empfangen), neueste zuerst.
    // Dient dem Chat-Sidebar (letzte Nachricht + Ungelesen pro Freund).
    async getRecentMessages(limit = 400) {
      if (!this.user) return [];
      const uid = this.user.id;
      const { data, error } = await client.from('messages')
        .select('*')
        .or(`sender_id.eq.${uid},recipient_id.eq.${uid}`)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) { console.warn('[Auth] getRecentMessages:', error.message); return []; }
      return data || [];
    },

    // Alle von otherId an mich gesendeten, noch ungelesenen Nachrichten als gelesen markieren.
    async markMessagesRead(otherId) {
      if (!this.user || !otherId) return;
      const { error } = await client.from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('sender_id', otherId).eq('recipient_id', this.user.id).is('read_at', null);
      if (error) console.warn('[Auth] markMessagesRead:', error.message);
    },

    // Realtime: ruft cb(msg) bei jeder neuen Nachricht auf, die an MICH geht.
    // Gibt das Channel-Objekt zurück — channel.unsubscribe() zum Beenden.
    subscribeMessages(cb) {
      if (!this.user) return null;
      const uid = this.user.id;
      const channel = client.channel('dm-inbox-' + uid)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${uid}` },
          payload => { try { cb(payload.new); } catch (e) { console.error(e); } })
        .subscribe();
      return channel;
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
      subEl.textContent = 'Username + Passwort genügen — eine Email ist optional. Highscores + Achievements sind danach auf allen Geräten verfügbar.';
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
  function showErr(text) {
    msgEl.innerHTML = `<div class="auth-error">${text}</div>`;
  }
  function showOk(text) {
    msgEl.innerHTML = `<div class="auth-success">${text}</div>`;
  }

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

  // ─── Auth-Slot in der Navbar mounten ──────────────────────────────────────
  function mountSlots() {
    document.querySelectorAll('[data-auth-slot]').forEach(slot => {
      slot.classList.add('auth-slot');
      slot.innerHTML = ''; // reset
      if (Auth.user && Auth.profile) {
        const name = Auth.profile.username || Auth.user.email;
        // Synthetische Auth-Mails (<username>@blockdrop.local) nicht anzeigen —
        // stattdessen die echte Kontakt-Mail, falls vorhanden, sonst nichts.
        const rawEmail = Auth.user.email || '';
        const contactEmail = Auth.user.user_metadata?.contact_email || '';
        const displayEmail = rawEmail.endsWith('@' + SYNTH_DOMAIN) ? contactEmail : rawEmail;
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
              ${displayEmail ? `<div class="auth-menu-email">${escapeHtml(displayEmail)}</div>` : ''}
            </div>
            <button class="auth-menu-item" data-act="profile" type="button">Profil</button>
            <button class="auth-menu-item" data-act="friends" type="button">Freunde</button>
            <button class="auth-menu-item" data-act="chat" type="button">Nachrichten</button>
            <button class="auth-menu-item" data-act="achievements" type="button">Achievements</button>
            <button class="auth-menu-item danger" data-act="logout" type="button">Abmelden</button>
          </div>
        `;
        const chip = slot.querySelector('.auth-chip');
        const menu = slot.querySelector('.auth-menu');
        chip.addEventListener('click', e => {
          e.stopPropagation();
          menu.classList.toggle('open');
        });
        document.addEventListener('click', () => menu.classList.remove('open'));
        menu.querySelectorAll('[data-act]').forEach(btn => {
          btn.addEventListener('click', () => {
            const act = btn.dataset.act;
            if (act === 'logout') Auth.signOut();
            if (act === 'profile') window.location.href = '/profile/';
            if (act === 'friends') window.location.href = '/freunde/';
            if (act === 'chat') window.location.href = '/chat/';
            if (act === 'achievements') {
              // Auf jeden Pfad funktionierender Link
              window.location.href = '/achievements/';
            }
          });
        });
      } else {
        slot.innerHTML = `<button class="auth-login-btn" type="button">Anmelden</button>`;
        slot.querySelector('button').addEventListener('click', () => Auth.openLogin());
      }
    });
  }

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

  // Expose
  window.Auth = Auth;

  // Auto-init
  Auth.init();
})();
