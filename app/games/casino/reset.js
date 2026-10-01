'use strict';
// Einmaliger Reset: Gast-Guthaben zurück auf die Standardsumme (20 €). Muss vor dem Seitenskript laufen.
// Für einen weiteren Reset RESET_ID hochzählen.
(() => {
  const RESET_ID = '2026-10-01b', FLAG = 'automat5dk.casino.reset', KEY = 'automat5dk.casino.v2', CK = 'automat5dk_casino2', START = 2000;
  try {
    if (localStorage.getItem(FLAG) === RESET_ID) return;
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    if (!s) {
      try {
        const m = document.cookie.split('; ').find(c => c.startsWith(CK + '='));
        if (m) s = JSON.parse(decodeURIComponent(m.slice(CK.length + 1)));
      } catch (e) {}
    }
    if (s) {
      s.balance = START;
      try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
      try {
        const { view, ...small } = s;
        document.cookie = CK + '=' + encodeURIComponent(JSON.stringify(small)) + '; max-age=31536000; path=/; SameSite=Lax';
      } catch (e) {}
    }
    localStorage.setItem(FLAG, RESET_ID);
  } catch (e) {}
})();
