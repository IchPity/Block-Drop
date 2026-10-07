/* ─────────────────────────────────────────────────────────────────────────
   /mode.js — läuft im <head>, vor dem ersten Bild.
   Ist die Version „Cinema" gewählt (Erststart-Dialog oder Menü rechts
   oben, siehe /fx.js), bekommt <html> die Klasse „fx-design" und die
   Schrift dafür wird nachgeladen. So blitzt die Halle beim Laden nicht
   kurz auf. Gemerkt ist die Wahl im Cookie „arcade_mode"; ohne
   Cookie-Zustimmung nur für diesen Besuch (sessionStorage).

   Cinema gilt für jede Seite. Die Seiten haben ihre Hallenfarben aber
   fest im eigenen CSS stehen (Indigo, Lavendel, Neon). Statt jede Seite
   doppelt zu pflegen, werden diese Farben hier beim Laden umgerechnet:

     Indigo, Violett, Magenta, Cyan, Blau   → neutrales Grau gleicher Helligkeit
     Bernstein, Gelb                        → bleibt (das ist der Messington)
     Rot, Grün                              → bleibt, etwas gedämpft (Fehler, Erfolg, Filz)
     heller Schein um Schrift               → entfällt
     heller Schein um Flächen               → deutlich schwächer

   Umgerechnet wird, was im CSS steht (auch später eingehängte <style>) und
   was im Markup als style-Attribut oder SVG-Farbe steht. Farben, die ein
   Skript zur Laufzeit setzt (Teamfarben, Spielsteine, Canvas), bleiben.
   Neue Seiten brauchen dafür nichts zu tun.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  var m = null;
  try {
    var c = document.cookie.match(/(?:^|; )arcade_mode=(\w+)/);
    m = c ? c[1] : sessionStorage.getItem('arcade.mode');
    if (!m && localStorage.getItem('arcade.design') === '1') m = 'design'; // Wahl aus der Zeit vor dem Cookie
  } catch (e) {}
  if (m !== 'design') return;
  var doc = document, root = doc.documentElement;
  root.classList.add('fx-design');
  var l = doc.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,200..800&display=swap';
  doc.head.appendChild(l);

  // ── Farbe umrechnen ──
  var COLOR = /#[0-9a-f]{3,8}\b|rgba?\([^()]*\)/gi;
  function parse(s) {
    if (s[0] === '#') {
      var h = s.slice(1);
      if (h.length === 3 || h.length === 4) h = h.replace(/./g, '$&$&');
      if (h.length !== 6 && h.length !== 8) return null;
      var n = parseInt(h.slice(0, 6), 16);
      return [n >> 16 & 255, n >> 8 & 255, n & 255, h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1];
    }
    var p = s.slice(s.indexOf('(') + 1, -1).split(/[\s,\/]+/).filter(Boolean);
    if (p.length < 3) return null;
    var v = p.map(function (x, i) { var f = parseFloat(x); return x.slice(-1) === '%' ? (i < 3 ? f * 2.55 : f / 100) : f; });
    if (v.some(isNaN)) return null; // var() oder calc() in der Farbe: nicht anfassen
    return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1];
  }
  // → [r, g, b, a, hell?] oder null, wenn die Farbe bleibt
  function turn(col) {
    var r = col[0] / 255, g = col[1] / 255, b = col[2] / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), L = (mx + mn) / 2, d = mx - mn;
    if (d < 0.02) return null;
    var S = d / (1 - Math.abs(2 * L - 1) || 1), H;
    if (mx === r) H = ((g - b) / d + 6) % 6; else if (mx === g) H = (b - r) / d + 2; else H = (r - g) / d + 4;
    H *= 60;
    if (S < 0.1 || (H >= 22 && H < 66)) return null;                 // neutral oder Bernstein: bleibt
    var keep = H >= 352 || H < 22 ? 0.78 : H >= 66 && H < 165 ? 0.62 : 0; // Rot, Grün: gedämpft
    var s2, l2 = L;
    if (keep) s2 = S * keep;
    else {
      // Hallenfarbe → Grau gleicher Helligkeit (Kontraste bleiben), dunkle Flächen etwas tiefer
      s2 = 0.045; H = 240;
      if (L < 0.3) l2 = L * 0.74;
    }
    var q = l2 < 0.5 ? l2 * (1 + s2) : l2 + s2 - l2 * s2, p = 2 * l2 - q;
    var f = function (t) { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [Math.round(f(H / 360 + 1 / 3) * 255), Math.round(f(H / 360) * 255), Math.round(f(H / 360 - 1 / 3) * 255), col[3]];
  }
  var light = function (c) { return (Math.max(c[0], c[1], c[2]) + Math.min(c[0], c[1], c[2])) / 510; };
  var css = function (c, a) { a = a == null ? c[3] : a; return a >= 1 ? 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')' : 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (+a.toFixed(3)) + ')'; };
  var layers = function (v) { return v.split(/,(?![^()]*\))/); };
  function value(prop, val) {
    if (prop === 'text-shadow') {
      // Leuchtschrift: helle Lagen fallen weg, dunkle (Lesbarkeit) bleiben
      var keep = layers(val).filter(function (s) { var c = (s.match(COLOR) || [])[0], p = c && parse(c); return p && light(p) < 0.25; });
      return keep.length ? keep.join(',') : 'none';
    }
    var glow = prop === 'box-shadow';
    var out = (glow ? layers(val) : [val]).map(function (s) {
      var dim = glow && s.indexOf('inset') < 0;
      return s.replace(COLOR, function (c) {
        var p = parse(c); if (!p) return c;
        var t = turn(p) || p;
        return dim && light(t) > 0.35 ? css(t, t[3] * 0.3) : t === p ? c : css(t);
      });
    });
    // Farben in eingebetteten SVGs (data:-URL, „#" steht dort als %23)
    return out.join(',').replace(/%23([0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-f])/gi, function (c, h) {
      var p = parse('#' + h), t = p && turn(p);
      return t ? '%23' + ((1 << 24) + (t[0] << 16) + (t[1] << 8) + t[2]).toString(16).slice(1) : c;
    });
  }
  var SHORT = ['background', 'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-color', 'outline', 'text-decoration', 'column-rule', 'fill', 'stroke'];
  function style(st) {
    for (var i = st.length - 1; i >= 0; i--) {
      var prop = st[i], val = st.getPropertyValue(prop);
      if (!val || (val.indexOf('#') < 0 && val.indexOf('rgb') < 0 && val.indexOf('%23') < 0)) continue;
      var nv = value(prop, val);
      if (nv !== val) st.setProperty(prop, nv, st.getPropertyPriority(prop));
    }
    // Kurzschreibweisen mit var() darin führt der Browser nicht als Einzelwerte: eigens nachsehen
    for (var k = 0; k < SHORT.length; k++) {
      var sv = st.getPropertyValue(SHORT[k]);
      if (!sv || sv.indexOf('var(') < 0 || (sv.indexOf('#') < 0 && sv.indexOf('rgb') < 0)) continue;
      var ns = value(SHORT[k], sv);
      if (ns !== sv) st.setProperty(SHORT[k], ns, st.getPropertyPriority(SHORT[k]));
    }
  }
  var seen = typeof WeakSet === 'function' ? new WeakSet() : null;
  function rules(list) {
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      // der Dialog beim ersten Besuch zeigt alle drei Versionen in ihren echten Farben
      if (r.selectorText && r.selectorText.indexOf('.fxw') >= 0) continue;
      if (r.style) style(r.style);
      if (r.cssRules) rules(r.cssRules);
    }
  }
  function sheets() {
    for (var i = 0; i < doc.styleSheets.length; i++) {
      var sh = doc.styleSheets[i];
      if (seen && seen.has(sh)) continue;
      var list = null;
      try { list = sh.cssRules; } catch (e) {} // fremde Herkunft (Google Fonts): nicht lesbar
      if (!list) continue;
      if (seen) seen.add(sh);
      try { rules(list); } catch (e) {}
    }
  }
  var SVG = ['fill', 'stroke', 'stop-color', 'flood-color'];
  function markup(base) {
    var els = base.querySelectorAll('[style], [fill], [stroke], [stop-color]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.closest && el.closest('.fxw')) continue;
      if (el.style && el.getAttribute('style')) style(el.style);
      for (var k = 0; k < SVG.length; k++) {
        var a = el.getAttribute(SVG[k]);
        if (a && (a[0] === '#' || a.slice(0, 3) === 'rgb')) { var nv = value(SVG[k], a); if (nv !== a) el.setAttribute(SVG[k], nv); }
      }
    }
  }
  window.__cinema = { sheets: sheets, markup: markup };

  // Sobald <body> beginnt, steht das CSS aus dem <head>: umrechnen, bevor etwas gemalt wird
  var mo = new MutationObserver(function (list) {
    if (doc.body) sheets();
    // später eingehängte Styles (/auth.js, Seiten-Skripte)
    for (var i = 0; i < list.length; i++) for (var k = 0; k < list[i].addedNodes.length; k++) {
      var n = list[i].addedNodes[k];
      if (n.nodeName === 'LINK') n.addEventListener('load', sheets);
    }
  });
  mo.observe(root, { childList: true, subtree: true });
  doc.addEventListener('DOMContentLoaded', function () {
    mo.disconnect();
    sheets(); markup(doc);
    // danach nur noch auf neue Stylesheets achten, nicht mehr auf jeden Knoten
    new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) for (var k = 0; k < list[i].addedNodes.length; k++) {
        var n = list[i].addedNodes[k];
        if (n.nodeName === 'STYLE') sheets(); else if (n.nodeName === 'LINK') n.addEventListener('load', sheets);
      }
    }).observe(doc.head, { childList: true });
  });
  addEventListener('load', sheets);
})();
