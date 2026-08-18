/* ==========================================================================
   Gemeinsame Oberflächen-Logik: Anmelde-Dialog + Supabase Auth.

   Login-Formular hat nur EIN Formular für beide Fälle (wiederkehrend /
   erstes Mal): erst wird `signInWithPassword` versucht; schlägt das fehl,
   wird `signUp` versucht. Schlägt auch das fehl, weil der Account schon
   existiert ("User already registered"), war schlicht das Passwort falsch.
   Das Whitelist-Gate (DB-Trigger, siehe db/ranks_whitelist_setup.sql)
   entscheidet serverseitig, ob eine E-Mail überhaupt registrieren darf.
   ========================================================================== */
(() => {
  "use strict";

  const SUPABASE_URL = "https://yjyvqidjqksvagyxrwyf.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_9J1vJchMV6Ym-1btnintAw_zih4pdea";

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  const RANK_LABELS = {
    admin: "Admin",
    stellvertreter: "Stellvertreter",
    mitarbeiter: "Mitarbeiter",
  };

  const dialog = document.getElementById("login");
  if (!dialog) return;

  const form         = document.getElementById("login-form");
  const notice       = document.getElementById("login-notice");
  const emailInput   = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");
  const submitBtn    = form.querySelector('button[type="submit"]');

  const openLoginBtns  = document.querySelectorAll("[data-open-login]");
  const closeLoginBtns = document.querySelectorAll("[data-close-login]");
  const accountEl      = document.querySelector("[data-account]");
  const accountEmailEl = document.querySelector("[data-account-email]");
  const accountRankEl  = document.querySelector("[data-account-rank]");
  const logoutBtn      = document.querySelector("[data-logout]");

  const open = () => {
    if (dialog.open) return;
    notice.textContent = "";
    form.reset();
    dialog.showModal();
    // Erst nach dem Öffnen fokussieren, sonst scrollt Safari die Seite.
    requestAnimationFrame(() => emailInput.focus());
  };

  const close = () => dialog.close();

  openLoginBtns.forEach((el) => el.addEventListener("click", open));
  closeLoginBtns.forEach((el) => el.addEventListener("click", close));

  // Klick auf den Hintergrund schließt den Dialog.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });

  async function showLoggedIn(user) {
    openLoginBtns.forEach((el) => { el.hidden = true; });
    if (!accountEl) return;
    accountEl.hidden = false;
    accountEmailEl.textContent = user.email;

    const { data, error } = await client
      .from("members")
      .select("rank")
      .eq("id", user.id)
      .single();

    accountRankEl.textContent = !error && data ? (RANK_LABELS[data.rank] || data.rank) : "";
  }

  function showLoggedOut() {
    openLoginBtns.forEach((el) => { el.hidden = false; });
    if (accountEl) accountEl.hidden = true;
  }

  client.auth.getSession().then(({ data }) => {
    if (data.session?.user) showLoggedIn(data.session.user);
  });

  client.auth.onAuthStateChange((_event, session) => {
    if (session?.user) showLoggedIn(session.user);
    else showLoggedOut();
  });

  logoutBtn?.addEventListener("click", async () => {
    logoutBtn.disabled = true;
    await client.auth.signOut();
    logoutBtn.disabled = false;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const emailValue    = emailInput.value.trim();
    const passwordValue = passwordInput.value;

    if (!emailValue || !passwordValue) {
      notice.textContent = "Bitte E-Mail und Passwort ausfüllen.";
      return;
    }

    submitBtn.disabled = true;
    notice.textContent = "Einen Moment …";

    const { error: signInError } = await client.auth.signInWithPassword({
      email: emailValue,
      password: passwordValue,
    });

    if (!signInError) {
      submitBtn.disabled = false;
      close();
      return;
    }

    // Kein bestehendes Konto mit diesem Passwort — könnte das erste
    // Anmelden sein. Whitelist-Gate entscheidet serverseitig (DB-Trigger).
    const { error: signUpError } = await client.auth.signUp({
      email: emailValue,
      password: passwordValue,
    });

    submitBtn.disabled = false;

    if (!signUpError) {
      close();
      return;
    }

    if (signUpError.message.includes("already registered")) {
      notice.textContent = "Falsches Passwort.";
    } else if (signUpError.message.includes("nicht freigeschaltet")) {
      notice.textContent = "Diese E-Mail ist nicht freigeschaltet.";
    } else if (signUpError.message.toLowerCase().includes("password")) {
      notice.textContent = "Passwort zu kurz — mindestens 6 Zeichen.";
    } else {
      notice.textContent = signUpError.message;
    }
  });
})();
