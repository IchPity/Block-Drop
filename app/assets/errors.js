/* ==========================================================================
   Gemeinsame Fehlertexte: verwandelt rohe Supabase-/Fetch-Fehler in
   verständliche deutsche Sätze. Für Fehler mit erkennbarer, selbst
   behebbarer Ursache (falsches Passwort, Pflichtfeld, …) bauen die
   Aufrufer weiterhin ihre eigene Fallunterscheidung zuerst und greifen
   nur im "sonst"-Fall hierher zurück. Für alles Unerwartete (Netzwerk,
   Rechte, unbekannte DB-Fehler) bittet der Text, sich bei Peter zu
   melden — das sind die Fälle, die nur er beheben kann.
   Muss VOR auth.js eingebunden werden.
   ========================================================================== */
window.SmashinErrors = (() => {
  "use strict";

  const CONTACT_HINT = " Bitte melde dich bei Peter, damit er das Problem beheben kann.";

  const NETWORK_HINTS = [
    "failed to fetch",
    "load failed",
    "networkerror",
    "network request failed",
    "network error",
  ];

  function isNetworkError(error) {
    const msg = String((error && error.message) || "").toLowerCase();
    return NETWORK_HINTS.some((hint) => msg.includes(hint));
  }

  function isPermissionError(error) {
    if (!error) return false;
    const msg = String(error.message || "").toLowerCase();
    return error.code === "42501" || msg.includes("row-level security") || msg.includes("permission denied");
  }

  // Liefert einen anzeigefertigen Satz für ein `.notice`/`.datalist__state`-Feld.
  function friendly(error) {
    if (isNetworkError(error)) {
      return "Keine Verbindung zum Server. Bitte Internetverbindung prüfen und nochmal versuchen." + CONTACT_HINT;
    }
    if (isPermissionError(error)) {
      return "Diese Aktion ist nicht erlaubt." + CONTACT_HINT;
    }
    return "Etwas ist schiefgelaufen." + CONTACT_HINT;
  }

  return { friendly };
})();
