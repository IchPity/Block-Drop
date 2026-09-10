/* ==========================================================================
   App "Whitelist" — Admin + Stellvertreter schalten neue E-Mails frei.
   ========================================================================== */
(async () => {
  "use strict";

  const member = await window.SmashinAuth.requireRank(["admin", "stellvertreter"]);
  if (!member) return; // requireRank hat schon auf "/" umgeleitet

  const client = window.SmashinAuth.client;
  const { fmt, row, button, renderList, renderState } = window.SmashinList;

  const form      = document.getElementById("whitelist-form");
  const emailInput = document.getElementById("whitelist-email");
  const notice    = document.getElementById("whitelist-notice");
  const list      = document.getElementById("whitelist-list");

  function renderRow(entry) {
    const meta = entry.claimed_at
      ? `Beigetreten am ${fmt(entry.claimed_at)}`
      : `Eingeladen am ${fmt(entry.created_at)} — noch offen`;

    const delBtn = button("Entfernen", async () => {
      delBtn.disabled = true;
      const { error } = await client.from("whitelist").delete().eq("email", entry.email);
      if (error) {
        notice.textContent = error.message;
        delBtn.disabled = false;
        return;
      }
      loadList();
    });

    return row({ primary: entry.email, meta, actions: delBtn });
  }

  async function loadList() {
    renderState(list, "Lädt", "Whitelist wird geladen …");

    const { data, error } = await client
      .from("whitelist")
      .select("email, created_at, claimed_at")
      .order("created_at", { ascending: false });

    if (error) {
      renderState(list, "Fehler", error.message);
      return;
    }

    renderList(list, data, { emptyText: "Noch niemand freigeschaltet.", row: renderRow });
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
