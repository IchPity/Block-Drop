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

  const member = await window.SmashinAuth.requireRank(["admin", "stellvertreter", "mitarbeiter", "zuschauer"]);
  if (!member) return; // requireRank hat schon auf "/" umgeleitet

  const client = window.SmashinAuth.client;
  const isAdmin = member.rank === "admin";
  const { fmt, button } = window.SmashinList;
  const { ampel, shiftDays, summarize, conflicts, runwayRange, runwayPercent, monthTicks } = window.SmashinProgress;

  const notice = document.getElementById("milestones-notice");
  const list   = document.getElementById("milestones-list");
  const filterCount = document.getElementById("filter-count");
  const fmtDate = (iso) => new Date(iso).toLocaleDateString("de-AT", { dateStyle: "medium" });

  list.appendChild(window.SmashinList.state("Lädt", "Meilensteine werden geladen …"));

  let milestones = [];
  let conflictIds = new Set();
  let assigneeOptions = [];
  let filter = "alle";
  let editingId = null;
  let openEditDialog = () => {};
  const openRowIds = new Set(); // welche <details> offen sind, bleibt über Re-Renders erhalten

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
  const progressBarWrap = progressBar.parentElement;
  const progressPeople = document.getElementById("progress-people");

  function renderProgress() {
    const { total, done, people } = summarize(milestones);
    const pct = total ? Math.round((done / total) * 100) : 0;
    progressStat.textContent = `${done} / ${total}`;
    progressBar.style.width = `${pct}%`;
    progressBarWrap.setAttribute("aria-valuenow", String(pct));

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

      const personPct = p.total ? Math.round((p.done / p.total) * 100) : 0;
      const bar = document.createElement("div");
      bar.className = "progress__bar";
      bar.setAttribute("role", "progressbar");
      bar.setAttribute("aria-valuemin", "0");
      bar.setAttribute("aria-valuemax", "100");
      bar.setAttribute("aria-valuenow", String(personPct));
      bar.setAttribute("aria-label", `Fortschritt ${p.name}`);
      const fill = document.createElement("div");
      fill.className = "progress__bar-fill";
      fill.style.width = `${personPct}%`;
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
    li.id = `milestone-${m.id}`;
    li.className = "milestone-item";
    if (conflictIds.has(m.id)) li.classList.add("milestone-item--conflict");

    const wasOpen = openRowIds.has(m.id);
    const details = document.createElement("details");
    details.className = "milestone";
    details.open = wasOpen;
    details.addEventListener("toggle", () => {
      if (details.open) openRowIds.add(m.id);
      else openRowIds.delete(m.id);
    });

    const summary = document.createElement("summary");

    const info = ampel(m);
    const dot = document.createElement("span");
    dot.className = "milestone__dot"
      + (info.key === "fertig" ? " milestone__dot--fertig" : "")
      + (info.key === "delayed_critical" ? " milestone__dot--kritisch" : "");
    summary.appendChild(dot);

    const num = document.createElement("span");
    num.className = "milestone__num";
    num.textContent = `#${m.id}`;
    summary.appendChild(num);

    const title = document.createElement("span");
    title.className = "milestone__title";
    title.textContent = m.title;
    summary.appendChild(title);

    const person = document.createElement("span");
    person.className = "milestone__person";
    person.textContent = m.person_name;
    summary.appendChild(person);

    const shift = shiftDays(m);
    const due = document.createElement("span");
    due.className = "milestone__due";
    due.textContent = fmtDate(m.due_date) + (shift !== 0 ? ` (${shift > 0 ? "+" : ""}${shift} Tg)` : "");
    summary.appendChild(due);

    const tag = document.createElement("span");
    tag.className = "tag"
      + (info.key === "fertig" ? " tag--fertig" : "")
      + (info.key === "delayed_critical" ? " tag--kritisch" : "");
    tag.textContent = info.label;
    summary.appendChild(tag);

    if (m.admin_note) {
      const noteFlag = document.createElement("span");
      noteFlag.className = "milestone__note-flag";
      noteFlag.textContent = "✎";
      noteFlag.title = m.admin_note;
      summary.appendChild(noteFlag);
    }

    details.appendChild(summary);

    const body = document.createElement("div");
    body.className = "milestone__body";

    const deliverable = document.createElement("p");
    deliverable.className = "datalist__detail";
    deliverable.textContent = m.deliverable;
    body.appendChild(deliverable);

    if (shift !== 0) {
      const shiftNote = document.createElement("p");
      shiftNote.className = "datalist__detail";
      shiftNote.textContent = `Ursprünglich fällig am ${fmtDate(m.original_due_date)}.`;
      body.appendChild(shiftNote);
    }

    if (conflictIds.has(m.id)) {
      const dep = milestones.find((x) => x.id === m.depends_on);
      const warn = document.createElement("p");
      warn.className = "datalist__detail datalist__detail--note";
      warn.textContent = `⚠ Vorgänger „${dep ? dep.title : m.dependency_note}" ist jetzt später fällig.`;
      body.appendChild(warn);
    }

    if (m.admin_note) {
      const adminNote = document.createElement("p");
      adminNote.className = "datalist__detail datalist__detail--note";
      adminNote.textContent = `Admin: ${m.admin_note}`;
      body.appendChild(adminNote);
    }

    const actions = document.createElement("div");
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
        renderRunway();
        renderList();
      });

      checkboxLabel.appendChild(checkbox);
      checkboxLabel.appendChild(document.createTextNode("Erledigt"));
      actions.appendChild(checkboxLabel);
    }

    body.appendChild(actions);
    details.appendChild(body);
    li.appendChild(details);
    return li;
  }

  function renderList() {
    conflictIds = conflicts(milestones);
    list.innerHTML = "";
    const rows = milestones.filter(matchesFilter);

    if (filterCount) {
      filterCount.textContent = rows.length === 1
        ? "1 Meilenstein angezeigt."
        : `${rows.length} Meilensteine angezeigt.`;
    }

    if (!rows.length) {
      list.appendChild(window.SmashinList.state("Leer", "Keine Meilensteine in diesem Filter."));
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

  /* ── Fahrplan: eine Spur je Person, Position = Termin ───────────────────── */
  const runwaySection = document.getElementById("runway");
  const runwayScale    = document.getElementById("runway-scale");
  const runwayLanes    = document.getElementById("runway-lanes");

  function jumpToMilestone(id) {
    filter = "alle";
    filterBtns.forEach((b) => b.classList.toggle("btn--active", b.dataset.filter === "alle"));
    openRowIds.add(id);
    renderList();
    const row = document.getElementById(`milestone-${id}`);
    if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function renderRunway() {
    if (!runwaySection || !milestones.length) return;

    const range = runwayRange(milestones);

    runwayScale.innerHTML = "";
    monthTicks(range).forEach((tick) => {
      const mark = document.createElement("span");
      mark.className = "runway__scale-mark";
      mark.style.left = `${tick.pct}%`;
      mark.textContent = tick.label;
      runwayScale.appendChild(mark);
    });

    runwayLanes.innerHTML = "";

    const today = document.createElement("div");
    today.className = "runway__today";
    today.style.left = `${runwayPercent(new Date().toISOString(), range)}%`;
    const todayLabel = document.createElement("span");
    todayLabel.className = "runway__today-label";
    todayLabel.textContent = "Heute";
    today.appendChild(todayLabel);
    runwayLanes.appendChild(today);

    const people = [...new Set(milestones.map((m) => m.person_name))];
    people.forEach((personName) => {
      const lane = document.createElement("div");
      lane.className = "runway__lane";

      const label = document.createElement("span");
      label.className = "runway__lane-label";
      label.textContent = personName.split(" ")[0];
      lane.appendChild(label);

      const track = document.createElement("div");
      track.className = "runway__track";

      milestones
        .filter((m) => m.person_name === personName)
        .forEach((m) => {
          const info = ampel(m);
          const mark = document.createElement("button");
          mark.type = "button";
          mark.className = "runway__mark"
            + (info.key === "fertig" ? " runway__mark--fertig" : "")
            + (info.key === "delayed_critical" ? " runway__mark--kritisch" : "");
          mark.style.left = `${runwayPercent(m.due_date, range)}%`;
          mark.title = `#${m.id} ${m.title} — ${fmtDate(m.due_date)} — ${info.label}`;
          mark.addEventListener("click", () => jumpToMilestone(m.id));
          track.appendChild(mark);
        });

      lane.appendChild(track);
      runwayLanes.appendChild(lane);
    });

    runwaySection.hidden = false;
  }

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
      renderRunway();
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
    window.SmashinList.renderState(
      list, "Fehler",
      msError ? msError.message : "Meilensteine konnten nicht geladen werden."
    );
    return;
  }

  milestones = msData;
  renderReport(reportData);
  renderProgress();
  renderRunway();
  renderList();
})();
