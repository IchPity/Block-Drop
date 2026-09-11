/* ==========================================================================
   App "Rang" — Admin vergibt Ränge an angemeldete Teammitglieder.
   ========================================================================== */
(async () => {
  "use strict";

  const member = await window.SmashinAuth.requireRank(["admin"]);
  if (!member) return; // requireRank hat schon auf "/" umgeleitet

  const client = window.SmashinAuth.client;
  const { fmt, row, button, renderList, renderState } = window.SmashinList;

  const notice = document.getElementById("rang-notice");
  const list   = document.getElementById("rang-list");

  const RANKS = [
    { value: "zuschauer", label: "Zuschauer" },
    { value: "mitarbeiter", label: "Mitarbeiter" },
    { value: "stellvertreter", label: "Stellvertreter" },
    { value: "admin", label: "Admin" },
  ];

  const fmtDue = (iso) => new Date(iso).toLocaleDateString("de-AT", { dateStyle: "medium" });

  // Einmal geladen, von allen Zuweisungs-Panels geteilt (schont Requests).
  let milestonesPromise = null;
  function loadMilestones() {
    if (!milestonesPromise) {
      milestonesPromise = client
        .from("milestones")
        .select("id, title, due_date, assignee_email")
        .order("id")
        .then(({ data, error }) => {
          if (error) throw error;
          return data;
        });
    }
    return milestonesPromise;
  }

  function renderAssignPanel(entry) {
    const details = document.createElement("details");
    details.className = "rang-assign";

    const summary = document.createElement("summary");
    summary.textContent = "Meilensteine zuweisen";
    details.appendChild(summary);

    const body = document.createElement("div");
    body.className = "rang-assign__body";
    details.appendChild(body);

    details.addEventListener("toggle", async () => {
      if (!details.open || body.dataset.loaded) return;
      body.dataset.loaded = "1";
      body.textContent = "Lädt …";

      let milestones;
      try {
        milestones = await loadMilestones();
      } catch (err) {
        body.textContent = "";
        notice.textContent = window.SmashinErrors.friendly(err);
        return;
      }

      body.innerHTML = "";
      milestones.forEach((m) => {
        const item = document.createElement("label");
        item.className = "rang-assign__item";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = m.assignee_email === entry.email;
        checkbox.addEventListener("change", async () => {
          checkbox.disabled = true;
          const newEmail = checkbox.checked ? entry.email : null;

          const { error } = await client
            .from("milestones")
            .update({ assignee_email: newEmail, updated_at: new Date().toISOString() })
            .eq("id", m.id);

          checkbox.disabled = false;

          if (error) {
            notice.textContent = window.SmashinErrors.friendly(error);
            checkbox.checked = !checkbox.checked;
            return;
          }
          m.assignee_email = newEmail;
        });

        const text = document.createElement("span");
        text.textContent = `#${m.id} ${m.title}`;

        const due = document.createElement("span");
        due.className = "rang-assign__item-due";
        due.textContent = fmtDue(m.due_date);

        item.append(checkbox, text, due);
        body.appendChild(item);
      });
    });

    return details;
  }

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
        notice.textContent = window.SmashinErrors.friendly(error);
        select.value = entry.rank; // zurücksetzen
        return;
      }
      entry.rank = newRank;
    });

    const actions = [select];

    if (entry.id !== member.id) {
      const delBtn = button("Konto entfernen", async () => {
        if (!window.confirm(
          `${entry.email} wirklich entfernen? Das löscht das Konto komplett — kein Login mehr, kein Reset-Mail, weg aus Rang und Passwords. Das lässt sich nicht rückgängig machen.`
        )) return;

        delBtn.disabled = true;
        select.disabled = true;
        notice.textContent = "";
        const { error } = await client.rpc("admin_remove_access", { p_email: entry.email });
        if (error) {
          notice.textContent = error.code === "P0001" ? error.message : window.SmashinErrors.friendly(error);
          delBtn.disabled = false;
          select.disabled = false;
          return;
        }
        loadList();
      });
      actions.push(delBtn);
    }

    const li = row({ primary: entry.email, meta: `Mitglied seit ${fmt(entry.created_at)}`, actions });
    li.appendChild(renderAssignPanel(entry));
    return li;
  }

  async function loadList() {
    renderState(list, "Lädt", "Mitgliederliste wird geladen …");

    const { data, error } = await client
      .from("members")
      .select("id, email, rank, created_at")
      .order("created_at", { ascending: true });

    if (error) {
      renderState(list, "Fehler", window.SmashinErrors.friendly(error));
      return;
    }

    renderList(list, data, { emptyText: "Noch niemand angemeldet.", row: renderRow });
  }

  loadList();
})();
