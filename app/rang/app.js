/* ==========================================================================
   App "Rang" — Admin vergibt Ränge an angemeldete Teammitglieder.
   ========================================================================== */
(async () => {
  "use strict";

  const member = await window.SmashinAuth.requireRank(["admin"]);
  if (!member) return; // requireRank hat schon auf "/" umgeleitet

  const client = window.SmashinAuth.client;
  const { fmt, row, renderList } = window.SmashinList;

  const notice = document.getElementById("rang-notice");
  const list   = document.getElementById("rang-list");

  const RANKS = [
    { value: "mitarbeiter", label: "Mitarbeiter" },
    { value: "stellvertreter", label: "Stellvertreter" },
    { value: "admin", label: "Admin" },
  ];

  function renderRow(entry) {
    const select = document.createElement("select");
    select.className = "field__input";
    RANKS.forEach(({ value, label }) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      if (value === entry.rank) option.selected = true;
      select.appendChild(option);
    });

    select.addEventListener("change", async () => {
      const newRank = select.value;
      select.disabled = true;
      notice.textContent = "";

      const { error } = await client
        .from("members")
        .update({ rank: newRank })
        .eq("id", entry.id);

      select.disabled = false;

      if (error) {
        notice.textContent = error.message;
        select.value = entry.rank; // zurücksetzen
        return;
      }
      entry.rank = newRank;
    });

    return row({ primary: entry.email, meta: `Mitglied seit ${fmt(entry.created_at)}`, actions: select });
  }

  async function loadList() {
    const { data, error } = await client
      .from("members")
      .select("id, email, rank, created_at")
      .order("created_at", { ascending: true });

    if (error) {
      list.innerHTML = "";
      notice.textContent = error.message;
      return;
    }

    renderList(list, data, { emptyText: "Noch niemand angemeldet.", row: renderRow });
  }

  loadList();
})();
