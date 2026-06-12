// Einmal-Werkzeug: obfuskiert die ausgelieferten JS-Dateien IN PLACE.
// Nicht Teil der Seite. Lauf: `node tools/_obfuscate.js`
// Vorher: `npm install --no-save javascript-obfuscator@4`
// Sicherheitsnetz ist die Git-History (lesbare Quellen sind committet).
const fs = require('fs');
const path = require('path');
const JO = require('javascript-obfuscator');

const ROOT = path.resolve(__dirname, '..');

// ── Logik-Dateien: maximal aggressiv ────────────────────────────────────────
// String-WERTE bleiben erhalten (nur RC4-verschlüsselt im String-Array), darum
// überleben DOM-IDs, CSS-Klassen, Supabase-Keys, RPC-Namen und window.*-Props.
const FRONTEND = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 1,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  numbersToExpressions: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 5,
  stringArray: true,
  stringArrayEncoding: ['rc4'],            // stärker als base64
  stringArrayThreshold: 1,
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 0.75,
  stringArrayWrappersCount: 5,
  stringArrayWrappersType: 'function',
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 5,
  transformObjectKeys: true,
  identifierNamesGenerator: 'mangled-shuffled',
  renameGlobals: false,                    // window.*-API unangetastet lassen
  selfDefending: true,                     // wehrt Beautify/Patching ab
  debugProtection: true,                   // Anti-DevTools (greift nur im Browser)
  debugProtectionInterval: 2000,
  disableConsoleOutput: false,             // console.error/warn bleiben nutzbar
  target: 'browser',
};

// ── Reine Datendatei (words.js): nur String-Schutz ──────────────────────────
// Control-Flow/Dead-Code auf einem 14k-Array bringt nichts außer MB-Bloat.
const DATA = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 4,
  stringArray: true,
  stringArrayEncoding: ['rc4'],
  stringArrayThreshold: 1,
  identifierNamesGenerator: 'mangled-shuffled',
  renameGlobals: false,
  selfDefending: true,
  debugProtection: false,
  target: 'browser',
};

// ── Worker = Security-Gate + ESM: bewusst konservativ ───────────────────────
// Kein Control-Flow-Flattening, KEIN debugProtection/selfDefending — die
// laufen in der Workers-Runtime (kein window/DevTools) potenziell heikel.
// Verhalten bleibt 1:1, export default überlebt. RC4 fürs String-Array.
const WORKER = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  numbersToExpressions: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 8,
  stringArray: true,
  stringArrayEncoding: ['rc4'],
  stringArrayThreshold: 0.9,
  transformObjectKeys: false,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  selfDefending: false,
  debugProtection: false,
  target: 'browser',
};

// WICHTIG: identifiersPrefix muss pro Datei EINDEUTIG sein. Mehrere klassische
// <script>-Dateien teilen sich den globalen Lexical Scope — ohne Prefix können
// zwei unabhängig obfuskierte Dateien denselben kurzen Top-Level-Namen würfeln
// (z.B. `const N`), und das zweite Skript stirbt beim Parsen mit
// "Identifier 'N' has already been declared" (so war Block Drop kaputt:
// auth.js + game.js kollidierten).
const JOBS = [
  ['app/auth.js', FRONTEND, 'au'],
  ['app/games/blockclicker/game.js', FRONTEND, 'bc'],
  ['app/games/blockdrop/game.js', FRONTEND, 'bd'],
  ['app/games/jedno/game.js', FRONTEND, 'jd'],
  ['app/games/tictactoe/game.js', FRONTEND, 'tt'],
  ['app/games/warships/game.js', FRONTEND, 'ws'],
  ['app/games/woertle/words.js', DATA, 'wo'],
  ['worker.js', WORKER, 'wk'],
];

for (const [rel, opts, prefix] of JOBS) {
  const abs = path.join(ROOT, rel);
  const src = fs.readFileSync(abs, 'utf8');
  const out = JO.obfuscate(src, { ...opts, identifiersPrefix: prefix }).getObfuscatedCode();
  fs.writeFileSync(abs, out);
  const k = n => (n / 1024).toFixed(1) + 'kB';
  console.log(`✓ ${rel.padEnd(34)} ${k(src.length)} → ${k(out.length)}`);
}
console.log('Fertig.');
