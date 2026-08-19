/* ==========================================================================
   App "Meilensteine" — Plan-Übersicht für alle Ränge.
   Admin bearbeitet Titel/Termin/Zuweisung/Status/Kommentar sowie den
   Lagebericht direkt über die Tabellen (RLS: nur Admin darf schreiben).
   Alle anderen können ausschließlich den EIGENEN Meilenstein auf "Erledigt"
   setzen, über die RPC set_own_milestone_status() — die prüft serverseitig,
   dass assignee_email zum eigenen Konto gehört (siehe db/milestones_setup.sql).
   ========================================================================== */
(async () => {
  "use strict";

  const member = await window.SmashinAuth.requireRank(["admin", "stellvertreter", "mitarbeiter"]);
  if (!member) return; // requireRank hat schon auf "/" umgeleitet

  const client = window.SmashinAuth.client;
  const isAdmin = member.rank === "admin";
  const { fmt, button } = window.SmashinList;
  const { ampel, shiftDays, summarize, conflicts } = window.SmashinProgress;

  const notice = document.getElementById("milestones-notice");
  const list   = document.getElementById("milestones-list");
  const fmtDate = (iso) => new Date(iso).toLocaleDateString("de-AT", { dateStyle: "medium" });

  let milestones = [];
  let conflictIds = new Set();
  let assigneeOptions = [];
  let filter = "alle";
  let editingId = null;
  let openEditDialog = () => {};

  /* ── Lagebericht ──────────────────────────────────────────────────────── */
  const reportBody     = document.getElementById("report-body");
  const reportMeta     = document.getElementById("report-meta");
  const reportEditBtn  = document.getElementById("report-edit-btn");
  const reportForm     = document.getElementById("report-form");
  const reportInput    = document.getElementById("report-input");
  const reportCancelBtn = document.getElementById("report-cancel-btn");

  function renderReport(report) {
    if (report && report.body) {
      reportBody.textContent = report.body;
      reportBody.classList.remove("report__body--empty");
      reportMeta.textContent = `Zuletzt aktualisiert am ${fmt(report.updated_at)}`;
    } else {
      reportBody.textContent = "Noch kein Lagebericht.";
      reportBody.classList.add("report__body--empty");
      reportMeta.textContent = "";
    }
  }

  function closeReportEditor() {
    reportForm.hidden = true;
    reportBody.hidden = false;
    reportMeta.hidden = false;
    reportEditBtn.hidden = false;
  }

  if (isAdmin) {
    reportEditBtn.hidden = false;

    reportEditBtn.addEventListener("click", () => {
      reportInput.value = reportBody.classList.contains("report__body--empty") ? "" : reportBody.textContent;
      reportBody.hidden = true;
      reportMeta.hidden = true;
      reportEditBtn.hidden = true;
      reportForm.hidden = false;
      reportInput.focus();
    });

    reportCancelBtn.addEventListener("click", closeReportEditor);

    reportForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitBtn = reportForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      const { data, error } = await client
        .from("status_report")
        .update({ body: reportInput.value.trim(), updated_at: new Date().toISOString(), updated_by: member.id })
        .eq("id", true)
        .select("body, updated_at")
        .single();

      submitBtn.disabled = false;

      if (error) {
        notice.textContent = error.message;
        return;
      }

      renderReport(data);
      closeReportEditor();
    });
  }

  /* ── Fortschritt ──────────────────────────────────────────────────────── */
  const progressStat   = document.getElementById("progress-stat");
  const progressBar    = document.getElementById("progress-bar");
  const progressPeople = document.getElementById("progress-people");

  function renderProgress() {
    const { total, done, people } = summarize(milestones);
    progressStat.textContent = `${done} / ${total}`;
    progressBar.style.width = total ? `${Math.round((done / total) * 100)}%` : "0%";

    progressPeople.innerHTML = "";
    people.forEach((p) => {
      const row = document.createElement("div");
      row.className = "progress__person";

      const name = document.createElement("span");
      name.className = "progress__person-name";
      name.textContent = p.name;

      const frac = document.createElement("span");
      frac.className = "progress__person-frac";
      frac.textContent = `${p.done} / ${p.total}`;

      const bar = document.createElement("div");
      bar.className = "progress__bar";
      const fill = document.createElement("div");
      fill.className = "progress__bar-fill";
      fill.style.width = p.total ? `${Math.round((p.done / p.total) * 100)}%` : "0%";
      bar.appendChild(fill);

      row.append(name, frac, bar);
      progressPeople.appendChild(row);
    });
  }

  /* ── Liste ────────────────────────────────────────────────────────────── */
  function matchesFilter(m) {
    if (filter === "meine") return m.assignee_email === member.email;
    if (filter === "offen") return m.status !== "fertig";
    return true;
  }

  function renderRow(m) {
    const li = document.createElement("li");
    li.className = "datalist__row";
    if (conflictIds.has(m.id)) li.classList.add("datalist__row--conflict");

    const primary = document.createElement("span");
    primary.className = "datalist__primary";

    const title = document.createElement("span");
    title.className = "datalist__title";
    title.textContent = `#${m.id} ${m.title}`;
    primary.appendChild(title);

    const info = ampel(m);
    const tag = document.createElement("span");
    tag.className = "tag"
      + (info.key === "fertig" ? " tag--fertig" : "")
      + (info.key === "delayed_critical" ? " tag--kritisch" : "");
    tag.textContent = `${info.icon} ${info.label}`;
    primary.appendChild(tag);

    const shift = shiftDays(m);
    const meta = document.createElement("span");
    meta.className = "datalist__meta";
    meta.textContent = `Fällig ${fmtDate(m.due_date)}`
      + (shift !== 0 ? ` (ursprünglich ${fmtDate(m.original_due_date)}, ${shift > 0 ? "+" : ""}${shift} Tage)` : "")
      + ` · ${m.person_name}`;
    primary.appendChild(meta);

    const deliverable = document.createElement("span");
    deliverable.className = "datalist__detail";
    deliverable.textContent = m.deliverable;
    primary.appendChild(deliverable);

    if (conflictIds.has(m.id)) {
      const dep = milestones.find((x) => x.id === m.depends_on);
      const warn = document.createElement("span");
      warn.className = "datalist__detail datalist__detail--note";
      warn.textContent = `⚠ Vorgänger „${dep ? dep.title : m.dependency_note}" ist jetzt später fällig.`;
      primary.appendChild(warn);
    }

    if (m.admin_note) {
      const adminNote = document.createElement("span");
      adminNote.className = "datalist__detail datalist__detail--note";
      adminNote.textContent = `Admin: ${m.admin_note}`;
      primary.appendChild(adminNote);
    }

    li.appendChild(primary);

    const actions = document.createElement("span");
    actions.className = "datalist__actions";

    if (isAdmin) {
      actions.appendChild(button("Bearbeiten", () => openEditDialog(m)));
    } else if (m.assignee_email === member.email) {
      const checkboxLabel = document.createElement("label");
      checkboxLabel.className = "btn btn--quiet";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = m.status === "fertig";
      checkbox.addEventListener("change", async () => {
        checkbox.disabled = true;
        const newStatus = checkbox.checked ? "fertig" : "offen";
        const { error } = await client.rpc("set_own_milestone_status", { p_id: m.id, p_status: newStatus });
        checkbox.disabled = false;
        if (error) {
          notice.textContent = error.message;
          checkbox.checked = !checkbox.checked;
          return;
        }
        m.status = newStatus;
        m.done_at = newStatus === "fertig" ? new Date().toISOString() : null;
        renderProgress();
        renderList();
      });

      checkboxLabel.appendChild(checkbox);
      checkboxLabel.appendChild(document.createTextNode("Erledigt"));
      actions.appendChild(checkboxLabel);
    }

    li.appendChild(actions);
    return li;
  }

  function renderList() {
    conflictIds = conflicts(milestones);
    list.innerHTML = "";
    const rows = milestones.filter(matchesFilter);

    if (!rows.length) {
      const empty = document.createElement("li");
      empty.className = "datalist__empty";
      empty.textContent = "Keine Meilensteine in diesem Filter.";
      list.appendChild(empty);
      return;
    }

    rows.forEach((m) => list.appendChild(renderRow(m)));
  }

  const filterBtns = document.querySelectorAll("[data-filter]");
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filter = btn.dataset.filter;
      filterBtns.forEach((b) => b.classList.toggle("btn--active", b === btn));
      renderList();
    });
  });

  /* ── Admin: Bearbeiten-Dialog ─────────────────────────────────────────── */
  if (isAdmin) {
    const editDialog        = document.getElementById("edit-dialog");
    const editForm           = document.getElementById("edit-form");
    const titleInput         = document.getElementById("edit-title-input");
    const deliverableInput   = document.getElementById("edit-deliverable-input");
    const assigneeInput      = document.getElementById("edit-assignee-input");
    const dueInput           = document.getElementById("edit-due-input");
    const statusInput        = document.getElementById("edit-status-input");
    const noteInput          = document.getElementById("edit-note-input");
    const editNotice         = document.getElementById("edit-notice");
    const closeBtn           = document.getElementById("edit-close-btn");

    closeBtn.addEventListener("click", () => editDialog.close());
    editDialog.addEventListener("click", (event) => {
      if (event.target === editDialog) editDialog.close();
    });

    editForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitBtn = editForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      editNotice.textContent = "Einen Moment …";

      const m = milestones.find((x) => x.id === editingId);
      const newStatus = statusInput.value;
      let doneAt = m.done_at;
      if (newStatus === "fertig" && m.status !== "fertig") doneAt = new Date().toISOString();
      if (newStatus !== "fertig") doneAt = null;

      const patch = {
        title: titleInput.value.trim(),
        deliverable: deliverableInput.value.trim(),
        assignee_email: assigneeInput.value || null,
        due_date: dueInput.value,
        status: newStatus,
        admin_note: noteInput.value.trim() || null,
        done_at: doneAt,
        updated_at: new Date().toISOString(),
      };

      const { error } = await client.from("milestones").update(patch).eq("id", editingId);

      submitBtn.disabled = false;

      if (error) {
        editNotice.textContent = error.message;
        return;
      }

      Object.assign(m, patch);
      renderProgress();
      renderList();
      editDialog.close();
    });

    openEditDialog = (m) => {
      editingId = m.id;
      editNotice.textContent = "";
      titleInput.value = m.title;
      deliverableInput.value = m.deliverable;
      dueInput.value = m.due_date;
      statusInput.value = m.status;
      noteInput.value = m.admin_note || "";

      assigneeInput.innerHTML = "";
      const noneOpt = document.createElement("option");
      noneOpt.value = "";
      noneOpt.textContent = `— kein Konto (${m.person_name}) —`;
      assigneeInput.appendChild(noneOpt);
      assigneeOptions.forEach((email) => {
        const opt = document.createElement("option");
        opt.value = email;
        opt.textContent = email;
        assigneeInput.appendChild(opt);
      });
      assigneeInput.value = m.assignee_email || "";

      editDialog.showModal();
    };
  }

  async function loadAssigneeOptions() {
    const [{ data: whitelist }, { data: members }] = await Promise.all([
      client.from("whitelist").select("email"),
      client.from("members").select("email"),
    ]);
    const emails = new Set();
    (whitelist || []).forEach((r) => emails.add(r.email));
    (members || []).forEach((r) => emails.add(r.email));
    assigneeOptions = [...emails].sort();
  }

  /* ── Laden ────────────────────────────────────────────────────────────── */
  const tasks = [
    client.from("milestones").select("*").order("id"),
    client.from("status_report").select("body, updated_at").eq("id", true).single(),
  ];
  if (isAdmin) tasks.push(loadAssigneeOptions());

  const [{ data: msData, error: msError }, { data: reportData }] = await Promise.all(tasks);

  if (msError || !msData) {
    notice.textContent = msError ? msError.message : "Meilensteine konnten nicht geladen werden.";
    return;
  }

  milestones = msData;
  renderReport(reportData);
  renderProgress();
  renderList();
})();
