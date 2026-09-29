// Farbjagd — Farbmathematik (reine Daten, kein DOM/THREE).
//
// Wertung über den wahrgenommenen Farbabstand, nicht über den naiven
// RGB-Abstand: Menschen empfinden z.B. Grün-Unterschiede viel empfindlicher
// als Blau-Unterschiede — ein reiner RGB-Abstand würde Jäger für "technisch
// nahe" Farben belohnen, die optisch klar daneben liegen. Pfad: sRGB → XYZ →
// Lab → CIEDE2000 (ΔE00), der heutige Referenz-Standard für Farbdifferenz.
//
// scoreFor() bildet ΔE00 auf 0–100 Punkte ab (exponentieller Abfall, s.u.).

'use strict';

const XN = 95.047, YN = 100.0, ZN = 108.883; // D65-Weißpunkt

function srgbToLinear(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function rgbToXyz(r, g, b) {
  const rl = srgbToLinear(r), gl = srgbToLinear(g), bl = srgbToLinear(b);
  return [
    (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) * 100,
    (rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750) * 100,
    (rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041) * 100,
  ];
}

function fLab(t) {
  const d = 6 / 29;
  return t > d * d * d ? Math.cbrt(t) : t / (3 * d * d) + 4 / 29;
}

// [r,g,b] (0–255) → [L,a,b] (CIE Lab, D65).
export function rgbToLab([r, g, b]) {
  const [x, y, z] = rgbToXyz(r, g, b);
  const fx = fLab(x / XN), fy = fLab(y / YN), fz = fLab(z / ZN);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const d2r = (d) => (d * Math.PI) / 180;

// CIEDE2000 (Sharma/Wu/Dalal 2005) — Standardformel, kL=kC=kH=1.
export function deltaE2000([L1, a1, b1], [L2, a2, b2]) {
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar7 = Math.pow((C1 + C2) / 2, 7);
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + Math.pow(25, 7))));
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G);
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h1p = (Math.atan2(b1, a1p) * 180 / Math.PI + 360) % 360;
  const h2p = (Math.atan2(b2, a2p) * 180 / Math.PI + 360) % 360;

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
    else if (h2p - h1p > 180) dhp = h2p - h1p - 360;
    else dhp = h2p - h1p + 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(d2r(dhp) / 2);

  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp;
  if (C1p * C2p === 0) hbp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbp = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hbp = (h1p + h2p + 360) / 2;
  else hbp = (h1p + h2p - 360) / 2;

  const T = 1 - 0.17 * Math.cos(d2r(hbp - 30)) + 0.24 * Math.cos(d2r(2 * hbp))
    + 0.32 * Math.cos(d2r(3 * hbp + 6)) - 0.20 * Math.cos(d2r(4 * hbp - 63));
  const dTheta = 30 * Math.exp(-Math.pow((hbp - 275) / 25, 2));
  const RC = 2 * Math.sqrt(Math.pow(Cbp, 7) / (Math.pow(Cbp, 7) + Math.pow(25, 7)));
  const SL = 1 + (0.015 * Math.pow(Lbp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbp - 50, 2));
  const SC = 1 + 0.045 * Cbp;
  const SH = 1 + 0.015 * Cbp * T;
  const RT = -Math.sin(d2r(2 * dTheta)) * RC;

  const termL = dLp / SL, termC = dCp / SC, termH = dHp / SH;
  return Math.sqrt(termL * termL + termC * termC + termH * termH + RT * termC * termH);
}

// Punkte-Abklingkonstante: ΔE 2 → 90 Pkt, ΔE 10 → 61 Pkt, ΔE 20 → 37 Pkt,
// ΔE 40+ → praktisch 0. Zentral hier verstellbar, falls Playtests zeigen,
// dass Treffer zu leicht/schwer punkten.
const SCORE_K = 20;

// Punkte (0–100, ganzzahlig) für eine Jäger-Mischung gegen die Zielfarbe.
export function scoreFor(rgbMix, rgbTarget) {
  const dE = deltaE2000(rgbToLab(rgbMix), rgbToLab(rgbTarget));
  return Math.round(100 * Math.exp(-dE / SCORE_K));
}

function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r1 = 0, g1 = 0, b1 = 0;
  if (h < 60)       { r1 = c; g1 = x; b1 = 0; }
  else if (h < 120)  { r1 = x; g1 = c; b1 = 0; }
  else if (h < 180)  { r1 = 0; g1 = c; b1 = x; }
  else if (h < 240)  { r1 = 0; g1 = x; b1 = c; }
  else if (h < 300)  { r1 = x; g1 = 0; b1 = c; }
  else               { r1 = c; g1 = 0; b1 = x; }
  return [
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255),
  ];
}

// Reglerschritt/-raster: 0–255 in 5er-Stufen (52 erreichbare Werte je Kanal) —
// Zielfarben werden auf dasselbe Raster gerundet, damit 100 Punkte (exakter
// Treffer) mit dem Regler überhaupt erreichbar sind.
export const STEP = 5;
export function quantize(v) {
  return Math.min(255, Math.max(0, Math.round(v / STEP) * STEP));
}

// Zufällige Zielfarbe: Sättigung/Helligkeit bewusst nicht zu niedrig (0.35–1),
// sonst wären viele Runden nahezu grau/schwarz und optisch kaum zu erkennen.
export function randomTargetColor(rng = Math.random) {
  const h = rng() * 360;
  const s = 0.35 + rng() * 0.65;
  const v = 0.35 + rng() * 0.65;
  const [r, g, b] = hsvToRgb(h, s, v);
  return [quantize(r), quantize(g), quantize(b)];
}

// Ablenkfarbe für Bot-Störer: entweder ein "Beinahe-Treffer" (Versatz auf 1-2
// Kanälen) oder der Kontrast/das Komplement der Zielfarbe — s. bots.js.
export function clamp255(v) { return Math.min(255, Math.max(0, v)); }
