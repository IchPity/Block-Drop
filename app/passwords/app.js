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

  const notice = document.getElementById("passwords-notice");
  const list   = document.getElementById("passwords-list");

  const fmt = (iso) =>
    iso ? new Date(iso).toLocaleString("de-AT", { dateStyle: "medium", timeStyle: "short" }) : "noch nie";

  function renderRow(row) {
    const li = document.createElement("li");
    li.className = "datalist__row";

    li.innerHTML = `
      <span class="datalist__primary">
        <span class="datalist__email">${row.email}</span>
        <span class="datalist__meta">${RANK_LABELS[row.rank] || row.rank} · zuletzt angemeldet: ${fmt(row.last_sign_in_at)}</span>
      </span>
    `;

    const actions = document.createElement("span");
    actions.className = "datalist__actions";
    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "btn btn--quiet";
    resetBtn.textContent = "Reset-Mail senden";
    resetBtn.addEventListener("click", async () => {
      resetBtn.disabled = true;
      notice.textContent = "";
      const { error } = await client.auth.resetPasswordForEmail(row.email);
      resetBtn.disabled = false;
      notice.textContent = error ? error.message : `Reset-Mail an ${row.email} angefordert.`;
    });
    actions.appendChild(resetBtn);
    li.appendChild(actions);

    return li;
  }

  async function loadList() {
    const { data, error } = await client.rpc("admin_access_overview");

    list.innerHTML = "";

    if (error) {
      notice.textContent = error.message;
      return;
    }

    if (!data.length) {
      const empty = document.createElement("li");
      empty.className = "datalist__empty";
      empty.textContent = "Noch niemand angemeldet.";
      list.appendChild(empty);
      return;
    }

    data.forEach((row) => list.appendChild(renderRow(row)));
  }

  loadList();
})();
