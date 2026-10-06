/* ─────────────────────────────────────────────────────────────────────────
   /mode.js — läuft im <head>, vor dem ersten Bild.
   Ist der Design-Modus gewählt (Menü rechts oben, siehe /fx.js), bekommt
   <html> die Klasse „fx-design" und die Schrift dafür wird nachgeladen.
   So blitzt die Halle beim Laden nicht kurz auf.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  try { if (localStorage.getItem('arcade.design') !== '1') return; } catch (e) { return; }
  document.documentElement.classList.add('fx-design');
  var l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,200..800&display=swap';
  document.head.appendChild(l);
})();
