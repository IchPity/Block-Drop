/* ==========================================================================
   App "Passwords" — Admin sieht Zugangsstatus, kein Klartext-Passwort.
   Nutzt die RPC public.admin_access_overview() (siehe
   db/admin_access_overview_setup.sql), die serverseitig auf Admin prüft.
   ========================================================================== */
(async () => {
  "use strict";

  const member = await window.SmashinAuth.requireRank(["admin"]);
  if (!member) return; // requireRank hat schon auf "/" umgeleitet

  const client = window.SmashinAuth.client;
  const RANK_LABELS = window.SmashinAuth.RANK_LABELS;
  const { fmt, row, button, renderList, renderState } = window.SmashinList;

  const notice = document.getElementById("passwords-notice");
  const list   = document.getElementById("passwords-list");

  function renderRow(entry) {
    const meta = `${RANK_LABELS[entry.rank] || entry.rank} · zuletzt angemeldet: ${fmt(entry.last_sign_in_at, "noch nie")}`;

    const resetBtn = button("Reset-Mail senden", async () => {
      resetBtn.disabled = true;
      notice.textContent = "";
      const { error } = await client.auth.resetPasswordForEmail(entry.email);
      resetBtn.disabled = false;
      notice.textContent = error ? error.message : `Reset-Mail an ${entry.email} angefordert.`;
    });

    return row({ primary: entry.email, meta, actions: resetBtn });
  }

  async function loadList() {
    renderState(list, "Lädt", "Zugangsstatus wird geladen …");

    const { data, error } = await client.rpc("admin_access_overview");

    if (error) {
      renderState(list, "Fehler", error.message);
      return;
    }

    renderList(list, data, { emptyText: "Noch niemand angemeldet.", row: renderRow });
  }

  loadList();
})();
