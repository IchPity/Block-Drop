// Einmal-Werkzeug: obfuskiert die ausgelieferten JS-Dateien IN PLACE.
// Nicht Teil der Seite. Lauf: `node tools/_obfuscate.js`
// Sicherheitsnetz ist die Git-History (Originale sind committet).
const fs = require('fs');
const path = require('path');
const JO = require('javascript-obfuscator');

const ROOT = path.resolve(__dirname, '..');

// String-WERTE bleiben immer erhalten (nur ins String-Array verlagert), darum
// überleben DOM-IDs, CSS-Klassen, Supabase-Keys, RPC-Namen und window.*-Props.
const FRONTEND = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.6,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.3,
  numbersToExpressions: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 8,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.8,
  stringArrayWrapperscount: 2,
  stringArrayWrappersType: 'function',
  transformObjectKeys: true,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,      // window.*-Namen + Top-Level unangetastet lassen
  selfDefending: false,      // würde bei Formatierung brechen
  debugProtection: false,    // würde DevTools/Worker aufhängen
  target: 'browser',
};

// Worker = Security-Gate + ESM. Bewusst schonender: kein controlFlowFlattening,
// damit das Verhalten 1:1 bleibt; export default überlebt.
const WORKER = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  numbersToExpressions: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  transformObjectKeys: false,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  selfDefending: false,
  debugProtection: false,
  target: 'browser',
};

const JOBS = [
  ['app/auth.js', FRONTEND],
  ['app/games/blockdrop/game.js', FRONTEND],
  ['app/games/jedno/game.js', FRONTEND],
  ['app/games/tictactoe/game.js', FRONTEND],
  ['app/games/warships/game.js', FRONTEND],
  ['app/games/woertle/words.js', FRONTEND],
  ['worker.js', WORKER],
];

for (const [rel, opts] of JOBS) {
  const abs = path.join(ROOT, rel);
  const src = fs.readFileSync(abs, 'utf8');
  const out = JO.obfuscate(src, opts).getObfuscatedCode();
  fs.writeFileSync(abs, out);
  const k = n => (n / 1024).toFixed(1) + 'kB';
  console.log(`✓ ${rel.padEnd(34)} ${k(src.length)} → ${k(out.length)}`);
}
console.log('Fertig.');
