/* ==========================================================================
   Gemeinsame Auth-Grundlage für alle Seiten: Supabase-Client, Konto-Anzeige
   im Kopfband (E-Mail + Rang + Abmelden), Rang-Absicherung für App-Seiten.
   Muss VOR jedem seitenspezifischen Skript eingebunden werden.
   ========================================================================== */
window.SmashinAuth = (() => {
  "use strict";

  const SUPABASE_URL = "https://yjyvqidjqksvagyxrwyf.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_9J1vJchMV6Ym-1btnintAw_zih4pdea";

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  const RANK_LABELS = {
    admin: "Admin",
    stellvertreter: "Stellvertreter",
    mitarbeiter: "Mitarbeiter",
  };

  // Registry aller Apps + welcher Rang sie sehen darf. Admin sieht immer
  // alles, auch ohne hier explizit gelistet zu sein (Filter unten).
  const APPS = [
    { slug: "whitelist", name: "Whitelist", desc: "Neue E-Mails freischalten", ranks: ["admin", "stellvertreter"] },
    { slug: "rang",      name: "Rang",      desc: "Ränge der Teammitglieder vergeben", ranks: ["admin"] },
    { slug: "passwords", name: "Passwords", desc: "Zugangsstatus & Anmeldungen", ranks: ["admin"] },
  ];

  function appsFor(rank) {
    return APPS.filter((app) => rank === "admin" || app.ranks.includes(rank));
  }

  const openLoginBtns  = document.querySelectorAll("[data-open-login]");
  const accountEl      = document.querySelector("[data-account]");
  const accountEmailEl = document.querySelector("[data-account-email]");
  const accountRankEl  = document.querySelector("[data-account-rank]");
  const logoutBtn      = document.querySelector("[data-logout]");
  const guestEls       = document.querySelectorAll("[data-guest]");
  const appsSection    = document.querySelector("[data-apps]");
  const appsList       = document.querySelector("[data-apps-list]");

  let currentMember = null; // { id, email, rank } | null

  async function fetchMember(user) {
    const { data, error } = await client
      .from("members")
      .select("rank")
      .eq("id", user.id)
      .single();
    if (error || !data) return null;
    return { id: user.id, email: user.email, rank: data.rank };
  }

  function renderApps(rank) {
    if (!appsSection || !appsList) return;
    const apps = appsFor(rank);
    appsList.innerHTML = "";
    apps.forEach((app) => {
      const li = document.createElement("li");
      li.className = "apps__item";
      li.innerHTML = `
        <a class="apps__link" href="/${app.slug}/">${app.name}</a>
        <span class="apps__desc">${app.desc}</span>
      `;
      appsList.appendChild(li);
    });
    appsSection.hidden = apps.length === 0;
  }

  function renderLoggedIn(member) {
    openLoginBtns.forEach((el) => { el.hidden = true; });
    guestEls.forEach((el) => { el.hidden = true; });
    if (accountEl) {
      accountEl.hidden = false;
      accountEmailEl.textContent = member.email;
      accountRankEl.textContent = RANK_LABELS[member.rank] || member.rank;
    }
    renderApps(member.rank);
    document.dispatchEvent(new CustomEvent("smashin:member", { detail: member }));
  }

  function renderLoggedOut() {
    openLoginBtns.forEach((el) => { el.hidden = false; });
    guestEls.forEach((el) => { el.hidden = false; });
    if (accountEl) accountEl.hidden = true;
    if (appsSection) appsSection.hidden = true;
    document.dispatchEvent(new CustomEvent("smashin:member", { detail: null }));
  }

  async function refresh() {
    const { data } = await client.auth.getSession();
    const user = data.session?.user;
    currentMember = user ? await fetchMember(user) : null;
    if (currentMember) renderLoggedIn(currentMember);
    else renderLoggedOut();
    return currentMember;
  }

  const ready = refresh();

  client.auth.onAuthStateChange(() => { refresh(); });

  logoutBtn?.addEventListener("click", async () => {
    logoutBtn.disabled = true;
    await client.auth.signOut();
    logoutBtn.disabled = false;
  });

  /**
   * Für App-Seiten (Whitelist/Rang/Passwords): wartet auf den ersten
   * Auth-Check, leitet auf `redirectTo` um, wenn nicht eingeloggt oder
   * Rang nicht in `allowedRanks`. Gibt bei Erfolg das Member-Objekt zurück,
   * sonst null (Aufrufer sollte in dem Fall nichts weiter rendern).
   */
  async function requireRank(allowedRanks, redirectTo = "/") {
    const member = await ready;
    if (!member || !allowedRanks.includes(member.rank)) {
      window.location.replace(redirectTo);
      return null;
    }
    return member;
  }

  return { client, ready, requireRank, appsFor, RANK_LABELS, getMember: () => currentMember };
})();
