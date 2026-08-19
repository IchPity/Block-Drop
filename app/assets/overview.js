/* ==========================================================================
   Startseiten-Kurzübersicht (Lagebericht + Fortschritt) — reine Anzeige,
   Bearbeiten passiert in der App "Meilensteine". Rendert nur im
   angemeldeten Zustand, react auf das smashin:member-Event aus auth.js
   (genau wie die Apps-Kacheln — siehe auth.js renderLoggedIn/renderLoggedOut).
   Muss NACH auth.js und progress.js eingebunden werden.
   ========================================================================== */
(() => {
  "use strict";

  const grid            = document.querySelector("[data-overview-grid]");
  const reportSection   = document.querySelector("[data-overview]");
  const progressSection = document.querySelector("[data-overview-progress]");
  if (!grid || !reportSection || !progressSection) return;

  const client = window.SmashinAuth.client;
  const { summarize } = window.SmashinProgress;

  const reportBody = reportSection.querySelector("[data-overview-report]");
  const reportMeta = reportSection.querySelector("[data-overview-meta]");
  const statEl     = progressSection.querySelector("[data-overview-stat]");
  const barEl      = progressSection.querySelector("[data-overview-bar]");
  const peopleEl   = progressSection.querySelector("[data-overview-people]");

  const fmtDate = (iso) => new Date(iso).toLocaleDateString("de-AT", { dateStyle: "medium" });

  async function render(member) {
    if (!member) {
      grid.hidden = true;
      return;
    }

    const [{ data: milestones, error }, { data: report }] = await Promise.all([
      client.from("milestones").select("id, person_name, status"),
      client.from("status_report").select("body, updated_at").eq("id", true).single(),
    ]);

    if (error || !milestones) return;

    if (report && report.body) {
      reportBody.textContent = report.body;
      reportBody.classList.remove("report__body--empty");
      reportMeta.textContent = `Zuletzt aktualisiert am ${fmtDate(report.updated_at)}`;
    } else {
      reportBody.textContent = "Noch kein Lagebericht.";
      reportBody.classList.add("report__body--empty");
      reportMeta.textContent = "";
    }

    const { total, done, people } = summarize(milestones);
    statEl.textContent = `${done} / ${total}`;
    barEl.style.width = total ? `${Math.round((done / total) * 100)}%` : "0%";

    peopleEl.innerHTML = "";
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
      peopleEl.appendChild(row);
    });

    grid.hidden = false;
  }

  document.addEventListener("smashin:member", (event) => render(event.detail));
})();
