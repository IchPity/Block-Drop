/* ==========================================================================
   Gemeinsame Oberflächen-Logik.
   Phase 1: nur der Anmelde-Dialog. Die Anmeldung selbst (Supabase) folgt.
   ========================================================================== */
(() => {
  "use strict";

  const dialog = document.getElementById("login");
  if (!dialog) return;

  const form   = document.getElementById("login-form");
  const notice = document.getElementById("login-notice");
  const email  = document.getElementById("login-email");

  const open = () => {
    if (dialog.open) return;
    notice.textContent = "";
    form.reset();
    dialog.showModal();
    // Erst nach dem Öffnen fokussieren, sonst scrollt Safari die Seite.
    requestAnimationFrame(() => email.focus());
  };

  const close = () => dialog.close();

  document.querySelectorAll("[data-open-login]").forEach((el) =>
    el.addEventListener("click", open)
  );
  document.querySelectorAll("[data-close-login]").forEach((el) =>
    el.addEventListener("click", close)
  );

  // Klick auf den Hintergrund schließt den Dialog.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    notice.textContent = "Die Anmeldung ist noch nicht aktiv. Sie kommt im nächsten Schritt.";
  });
})();
