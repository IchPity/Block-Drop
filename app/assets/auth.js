/* ==========================================================================
   Gemeinsame Auth-Grundlage für alle Seiten: Supabase-Client, Konto-Anzeige
   im Kopfband (Avatar + Name + Rang), Profil-Fenster (Anzeigename, Avatar,
   Passwort, Abmelden), Rang-Absicherung für App-Seiten.
   Muss VOR jedem seitenspezifischen Skript eingebunden werden.
   ========================================================================== */
window.SmashinAuth = (() => {
  "use strict";

  const SUPABASE_URL = "https://yjyvqidjqksvagyxrwyf.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_9J1vJchMV6Ym-1btnintAw_zih4pdea";
  const DEFAULT_AVATAR = "/assets/cat-default.svg";

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  const RANK_LABELS = {
    admin: "Admin",
    stellvertreter: "Stellvertreter",
    mitarbeiter: "Mitarbeiter",
  };

  // Registry aller Apps + welcher Rang sie sehen darf. Admin sieht immer
  // alles, auch ohne hier explizit gelistet zu sein (Filter unten).
  const APPS = [
    { slug: "meilensteine", name: "Meilensteine", desc: "Fortschritt der Diplomarbeit", ranks: ["admin", "stellvertreter", "mitarbeiter"] },
    { slug: "whitelist", name: "Whitelist", desc: "Neue E-Mails freischalten", ranks: ["admin", "stellvertreter"] },
    { slug: "rang",      name: "Rang",      desc: "Ränge der Teammitglieder vergeben", ranks: ["admin"] },
    { slug: "passwords", name: "Passwords", desc: "Zugangsstatus & Anmeldungen", ranks: ["admin"] },
  ];

  function appsFor(rank) {
    return APPS.filter((app) => rank === "admin" || app.ranks.includes(rank));
  }

  const openLoginBtns = document.querySelectorAll("[data-open-login]");
  const accountEl     = document.querySelector("[data-account]");
  const accountNameEl = document.querySelector("[data-account-name]");
  const accountRankEl = document.querySelector("[data-account-rank]");
  const accountAvatarEl = document.querySelector("[data-account-avatar]");
  const guestEls      = document.querySelectorAll("[data-guest]");
  const appsSection   = document.querySelector("[data-apps]");
  const appsList      = document.querySelector("[data-apps-list]");

  let currentMember = null; // { id, email, rank, displayName, avatarUrl } | null

  async function fetchMember(user) {
    const { data, error } = await client
      .from("members")
      .select("rank, display_name, avatar_url")
      .eq("id", user.id)
      .single();
    if (error || !data) return null;
    return {
      id: user.id,
      email: user.email,
      rank: data.rank,
      displayName: data.display_name,
      avatarUrl: data.avatar_url,
    };
  }

  function renderApps(rank) {
    if (!appsSection || !appsList) return;
    const apps = appsFor(rank);
    appsList.innerHTML = "";
    apps.forEach((app, index) => {
      const badge = app.ranks.length >= 3
        ? "Alle"
        : app.ranks.map((r) => RANK_LABELS[r] || r).join(" + ");
      const a = document.createElement("a");
      a.className = "apps__tile";
      a.href = `/${app.slug}/`;
      a.style.setProperty("--tile-step", index);
      a.innerHTML = `
        <span class="apps__badge">${badge}</span>
        <span class="apps__name">${app.name}</span>
        <span class="apps__desc">${app.desc}</span>
      `;
      appsList.appendChild(a);
    });
    appsSection.hidden = apps.length === 0;
  }

  function renderLoggedIn(member) {
    openLoginBtns.forEach((el) => { el.hidden = true; });
    guestEls.forEach((el) => { el.hidden = true; });
    if (accountEl) {
      accountEl.hidden = false;
      accountNameEl.textContent = member.displayName || member.email;
      accountRankEl.textContent = RANK_LABELS[member.rank] || member.rank;
      if (accountAvatarEl) accountAvatarEl.src = member.avatarUrl || DEFAULT_AVATAR;
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

  /* ── Profil-Fenster: einmalig ins DOM injiziert, auf jeder Seite ──────── */
  function buildProfileDialog() {
    const dialog = document.createElement("dialog");
    dialog.className = "sheet";
    dialog.id = "profile-dialog";
    dialog.setAttribute("aria-labelledby", "profile-title");
    dialog.innerHTML = `
      <h2 class="sheet__title" id="profile-title">Profil</h2>
      <p class="sheet__intro">Anzeigename, Profilbild und Passwort verwalten.</p>

      <div class="profile__avatar-row">
        <img class="profile__avatar" id="profile-avatar-preview" alt="">
        <div class="profile__avatar-actions">
          <label class="btn btn--quiet" for="profile-avatar-input">Bild wählen</label>
          <span class="profile__avatar-hint" id="profile-avatar-hint"></span>
        </div>
        <input type="file" id="profile-avatar-input" accept="image/png,image/jpeg,image/webp" hidden>
      </div>

      <form class="sheet__form" id="profile-form" novalidate>
        <div class="field">
          <label class="field__label" for="profile-name">Anzeigename</label>
          <input class="field__input" id="profile-name" type="text" maxlength="40" placeholder="z. B. Peter">
        </div>

        <div class="field">
          <label class="field__label" for="profile-password">Neues Passwort</label>
          <input class="field__input" id="profile-password" type="password"
                 autocomplete="new-password" placeholder="leer lassen = unverändert">
        </div>

        <p class="notice" id="profile-notice" role="status" aria-live="polite"></p>

        <button class="btn btn--lamp" type="submit">Speichern</button>
      </form>

      <div class="sheet__foot">
        <button class="btn btn--quiet" type="button" id="profile-logout">Abmelden</button>
        <button class="btn btn--quiet" type="button" id="profile-close">Schließen</button>
      </div>
    `;
    document.body.appendChild(dialog);

    const avatarPreview = dialog.querySelector("#profile-avatar-preview");
    const avatarInput   = dialog.querySelector("#profile-avatar-input");
    const avatarHint    = dialog.querySelector("#profile-avatar-hint");
    const nameInput     = dialog.querySelector("#profile-name");
    const passwordInput = dialog.querySelector("#profile-password");
    const notice        = dialog.querySelector("#profile-notice");
    const form           = dialog.querySelector("#profile-form");
    const submitBtn      = form.querySelector('button[type="submit"]');
    const logoutBtn      = dialog.querySelector("#profile-logout");
    const closeBtn       = dialog.querySelector("#profile-close");

    function openDialog() {
      if (dialog.open || !currentMember) return;
      notice.textContent = "";
      nameInput.value = currentMember.displayName || "";
      passwordInput.value = "";
      avatarPreview.src = currentMember.avatarUrl || DEFAULT_AVATAR;
      avatarHint.textContent = "";
      dialog.showModal();
    }

    closeBtn.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });

    avatarInput.addEventListener("change", async () => {
      const file = avatarInput.files?.[0];
      if (!file || !currentMember) return;

      avatarHint.textContent = "Lädt hoch …";
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${currentMember.id}/avatar_${Date.now()}.${ext}`;

      const { error: uploadError } = await client.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        avatarHint.textContent = uploadError.message;
        return;
      }

      const { data: pub } = client.storage.from("avatars").getPublicUrl(path);
      const { error: rpcError } = await client.rpc("update_own_profile", {
        p_avatar_url: pub.publicUrl,
      });

      if (rpcError) {
        avatarHint.textContent = rpcError.message;
        return;
      }

      avatarHint.textContent = "Gespeichert.";
      avatarPreview.src = pub.publicUrl;
      await refresh();
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      submitBtn.disabled = true;
      notice.textContent = "Einen Moment …";

      const { error: nameError } = await client.rpc("update_own_profile", {
        p_display_name: nameInput.value.trim(),
      });

      if (nameError) {
        submitBtn.disabled = false;
        notice.textContent = nameError.message;
        return;
      }

      if (passwordInput.value) {
        const { error: pwError } = await client.auth.updateUser({
          password: passwordInput.value,
        });
        if (pwError) {
          submitBtn.disabled = false;
          notice.textContent = pwError.message.toLowerCase().includes("password")
            ? "Passwort zu kurz — mindestens 6 Zeichen."
            : pwError.message;
          return;
        }
      }

      submitBtn.disabled = false;
      await refresh();
      dialog.close();
    });

    logoutBtn.addEventListener("click", async () => {
      logoutBtn.disabled = true;
      await client.auth.signOut();
      logoutBtn.disabled = false;
      dialog.close();
    });

    document.querySelectorAll("[data-open-profile]").forEach((el) =>
      el.addEventListener("click", openDialog)
    );
  }

  if (accountEl) buildProfileDialog();

  return { client, ready, requireRank, appsFor, RANK_LABELS, getMember: () => currentMember };
})();
