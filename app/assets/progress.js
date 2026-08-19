/* ==========================================================================
   Gemeinsame Fortschritts-Auswertung für Meilensteine — genutzt von der
   Startseite (Kurzübersicht) und der App "Meilensteine" (volle Liste),
   damit beide immer dieselben Zahlen zeigen. Reine Berechnung, kein State.
   Muss NACH auth.js eingebunden werden (kein Datenzugriff, nur Logik).
   ========================================================================== */
window.SmashinProgress = (() => {
  "use strict";

  const AMPEL = {
    fertig:           { key: "fertig",           label: "Fertig",            icon: "✓" },
    verschoben:       { key: "verschoben",        label: "Verschoben",        icon: "»" },
    on_track:         { key: "on_track",          label: "On Track",         icon: "•" },
    delayed_minor:    { key: "delayed_minor",     label: "Leicht verzögert", icon: "•" },
    delayed_critical: { key: "delayed_critical",  label: "Kritisch verzögert", icon: "•" },
  };

  function daysBetween(a, b) {
    const start = new Date(a);
    const end = new Date(b);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return Math.round((end - start) / 86400000);
  }

  function ampel(milestone, today = new Date()) {
    if (milestone.status === "fertig") return AMPEL.fertig;
    if (milestone.status === "verschoben") return AMPEL.verschoben;
    const overdue = daysBetween(milestone.due_date, today);
    if (overdue <= 0) return AMPEL.on_track;
    return overdue > 14 ? AMPEL.delayed_critical : AMPEL.delayed_minor;
  }

  function shiftDays(milestone) {
    return daysBetween(milestone.original_due_date, milestone.due_date);
  }

  function summarize(rows) {
    const byPerson = new Map();
    let done = 0;
    rows.forEach((m) => {
      if (!byPerson.has(m.person_name)) {
        byPerson.set(m.person_name, { name: m.person_name, done: 0, total: 0 });
      }
      const bucket = byPerson.get(m.person_name);
      bucket.total += 1;
      if (m.status === "fertig") {
        bucket.done += 1;
        done += 1;
      }
    });
    return { total: rows.length, done, people: [...byPerson.values()] };
  }

  function nextDue(rows, limit = 3) {
    return rows
      .filter((m) => m.status !== "fertig")
      .slice()
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
      .slice(0, limit);
  }

  // Meilensteine, deren Vorgänger (laut depends_on) jetzt SPÄTER fällig ist
  // als sie selbst — ein Zeichen, dass eine Verschiebung weitergegeben
  // werden muss.
  function conflicts(rows) {
    const byId = new Map(rows.map((m) => [m.id, m]));
    const result = new Set();
    rows.forEach((m) => {
      if (!m.depends_on) return;
      const dep = byId.get(m.depends_on);
      if (dep && dep.status !== "fertig" && new Date(dep.due_date) > new Date(m.due_date)) {
        result.add(m.id);
      }
    });
    return result;
  }

  return { ampel, shiftDays, summarize, nextDue, conflicts };
})();
