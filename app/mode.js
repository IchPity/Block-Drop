/* ─────────────────────────────────────────────────────────────────────────
   /mode.js — läuft im <head>, vor dem ersten Bild.
   Ist die Version „Cinema" gewählt (Erststart-Dialog oder Menü rechts
   oben, siehe /fx.js), bekommt <html> die Klasse „fx-design" und die
   Schrift dafür wird nachgeladen. So blitzt die Halle beim Laden nicht
   kurz auf. Gemerkt ist die Wahl im Cookie „arcade_mode"; ohne
   Cookie-Zustimmung nur für diesen Besuch (sessionStorage).
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  var m = null;
  try {
    var c = document.cookie.match(/(?:^|; )arcade_mode=(\w+)/);
    m = c ? c[1] : sessionStorage.getItem('arcade.mode');
    if (!m && localStorage.getItem('arcade.design') === '1') m = 'design'; // Wahl aus der Zeit vor dem Cookie
  } catch (e) {}
  if (m !== 'design') return;
  document.documentElement.classList.add('fx-design');
  var l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,200..800&display=swap';
  document.head.appendChild(l);
})();
