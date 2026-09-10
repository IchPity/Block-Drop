/* ==========================================================================
   Gemeinsame Bausteine für die einfachen Listen-Apps (Whitelist, Rang,
   Passwords, …): Datumsformat, Zeilen-/Button-Aufbau, leerer Zustand.
   Baut ausschließlich über textContent, nie über innerHTML mit Daten aus
   der DB — E-Mails/Namen könnten sonst als HTML gerendert werden (stored
   XSS), wenn sie mal nicht exakt dem erwarteten Format entsprechen.
   Muss NACH auth.js und VOR dem seitenspezifischen app.js eingebunden werden.
   ========================================================================== */
window.SmashinList = (() => {
  "use strict";

  function fmt(iso, fallback = "") {
    if (!iso) return fallback;
    return new Date(iso).toLocaleString("de-AT", { dateStyle: "medium", timeStyle: "short" });
  }

  function button(label, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn--quiet";
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function row({ primary, meta, actions }) {
    const li = document.createElement("li");
    li.className = "datalist__row";

    const primaryEl = document.createElement("span");
    primaryEl.className = "datalist__primary";

    const primarySpan = document.createElement("span");
    primarySpan.className = "datalist__email";
    primarySpan.textContent = primary;
    primaryEl.appendChild(primarySpan);

    const metaSpan = document.createElement("span");
    metaSpan.className = "datalist__meta";
    metaSpan.textContent = meta;
    primaryEl.appendChild(metaSpan);

    li.appendChild(primaryEl);

    if (actions) {
      const actionsEl = document.createElement("span");
      actionsEl.className = "datalist__actions";
      (Array.isArray(actions) ? actions : [actions]).forEach((el) => actionsEl.appendChild(el));
      li.appendChild(actionsEl);
    }

    return li;
  }

  // Leer-/Lade-/Fehlerzustand einer Liste: Mono-Eyebrow über kurzem Satz
  // in --steel (siehe .datalist__state in style.css).
  function state(tag, text) {
    const li = document.createElement("li");
    li.className = "datalist__state";

    const eyebrow = document.createElement("span");
    eyebrow.className = "datalist__state-tag";
    eyebrow.textContent = tag;

    const p = document.createElement("span");
    p.className = "datalist__state-text";
    p.textContent = text;

    li.append(eyebrow, p);
    return li;
  }

  function renderState(listEl, tag, text) {
    listEl.innerHTML = "";
    listEl.appendChild(state(tag, text));
  }

  function renderList(listEl, data, { emptyText, row: buildRow }) {
    listEl.innerHTML = "";
    if (!data.length) {
      listEl.appendChild(state("Leer", emptyText));
      return;
    }
    data.forEach((item) => listEl.appendChild(buildRow(item)));
  }

  return { fmt, row, button, state, renderState, renderList };
})();
