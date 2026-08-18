/* ==========================================================================
   App "Rang" — Admin vergibt Ränge an angemeldete Teammitglieder.
   ========================================================================== */
(async () => {
  "use strict";

  const member = await window.SmashinAuth.requireRank(["admin"]);
  if (!member) return; // requireRank hat schon auf "/" umgeleitet

  const client = window.SmashinAuth.client;

  const notice = document.getElementById("rang-notice");
  const list   = document.getElementById("rang-list");

  const RANKS = [
    { value: "mitarbeiter", label: "Mitarbeiter" },
    { value: "stellvertreter", label: "Stellvertreter" },
    { value: "admin", label: "Admin" },
  ];

  const fmt = (iso) =>
    new Date(iso).toLocaleString("de-AT", { dateStyle: "medium", timeStyle: "short" });

  function renderRow(row) {
    const li = document.createElement("li");
    li.className = "datalist__row";

    li.innerHTML = `
      <span class="datalist__primary">
        <span class="datalist__email">${row.email}</span>
        <span class="datalist__meta">Mitglied seit ${fmt(row.created_at)}</span>
      </span>
    `;

    const actions = document.createElement("span");
    actions.className = "datalist__actions";

    const select = document.createElement("select");
    select.className = "field__input";
    RANKS.forEach(({ value, label }) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      if (value === row.rank) option.selected = true;
      select.appendChild(option);
    });

    select.addEventListener("change", async () => {
      const newRank = select.value;
      select.disabled = true;
      notice.textContent = "";

      const { error } = await client
        .from("members")
        .update({ rank: newRank })
        .eq("id", row.id);

      select.disabled = false;

      if (error) {
        notice.textContent = error.message;
        select.value = row.rank; // zurücksetzen
        return;
      }
      row.rank = newRank;
    });

    actions.appendChild(select);
    li.appendChild(actions);

    return li;
  }

  async function loadList() {
    const { data, error } = await client
      .from("members")
      .select("id, email, rank, created_at")
      .order("created_at", { ascending: true });

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
