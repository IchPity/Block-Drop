/* ==========================================================================
   App "Whitelist" — Admin + Stellvertreter schalten neue E-Mails frei.
   ========================================================================== */
(async () => {
  "use strict";

  const member = await window.SmashinAuth.requireRank(["admin", "stellvertreter"]);
  if (!member) return; // requireRank hat schon auf "/" umgeleitet

  const client = window.SmashinAuth.client;

  const form      = document.getElementById("whitelist-form");
  const emailInput = document.getElementById("whitelist-email");
  const notice    = document.getElementById("whitelist-notice");
  const list      = document.getElementById("whitelist-list");

  const fmt = (iso) =>
    new Date(iso).toLocaleString("de-AT", { dateStyle: "medium", timeStyle: "short" });

  function renderRow(row) {
    const li = document.createElement("li");
    li.className = "datalist__row";

    const status = row.claimed_at
      ? `Beigetreten am ${fmt(row.claimed_at)}`
      : `Eingeladen am ${fmt(row.created_at)} — noch offen`;

    li.innerHTML = `
      <span class="datalist__primary">
        <span class="datalist__email">${row.email}</span>
        <span class="datalist__meta">${status}</span>
      </span>
    `;

    const actions = document.createElement("span");
    actions.className = "datalist__actions";
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn btn--quiet";
    delBtn.textContent = "Entfernen";
    delBtn.addEventListener("click", async () => {
      delBtn.disabled = true;
      const { error } = await client.from("whitelist").delete().eq("email", row.email);
      if (error) {
        notice.textContent = error.message;
        delBtn.disabled = false;
        return;
      }
      loadList();
    });
    actions.appendChild(delBtn);
    li.appendChild(actions);

    return li;
  }

  async function loadList() {
    const { data, error } = await client
      .from("whitelist")
      .select("email, created_at, claimed_at")
      .order("created_at", { ascending: false });

    list.innerHTML = "";

    if (error) {
      notice.textContent = error.message;
      return;
    }

    if (!data.length) {
      const empty = document.createElement("li");
      empty.className = "datalist__empty";
      empty.textContent = "Noch niemand freigeschaltet.";
      list.appendChild(empty);
      return;
    }

    data.forEach((row) => list.appendChild(renderRow(row)));
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim().toLowerCase();
    if (!email) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    notice.textContent = "";

    const { error } = await client
      .from("whitelist")
      .insert({ email, invited_by: member.id });

    submitBtn.disabled = false;

    if (error) {
      notice.textContent = error.code === "23505"
        ? "Diese E-Mail ist schon freigeschaltet."
        : error.message;
      return;
    }

    form.reset();
    loadList();
  });

  loadList();
})();
