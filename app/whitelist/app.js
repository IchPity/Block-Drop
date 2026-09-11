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

    const delBtn = button(entry.claimed_at ? "Konto entfernen" : "Entfernen", async () => {
      if (entry.claimed_at && !window.confirm(
        `${entry.email} hat schon ein Konto. Entfernen löscht das Konto komplett — kein Login mehr, kein Reset-Mail, weg aus den Apps Rang und Passwords. Das lässt sich nicht rückgängig machen. Wirklich entfernen?`
      )) {
        return;
      }

      delBtn.disabled = true;
      notice.textContent = "";
      const { error } = await client.rpc("admin_remove_access", { p_email: entry.email });
      if (error) {
        notice.textContent = error.code === "P0001" ? error.message : window.SmashinErrors.friendly(error);
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
      renderState(list, "Fehler", window.SmashinErrors.friendly(error));
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
        : window.SmashinErrors.friendly(error);
      return;
    }

    form.reset();
    loadList();
  });

  loadList();
})();
