// Generic visual-layer splice: swaps <title>+font <link>, <style> contents,
// and the decorative/navbar markup block — leaving game logic untouched.
// Usage: node _splice.js <index.html> <headFile> <cssFile> <markupFile> <markupStartRegex> <markupEndStr>
const fs = require('fs');
const [,, file, headF, cssF, markupF, startRe, endStr] = process.argv;
let html = fs.readFileSync(file, 'utf8');
const head = fs.readFileSync(headF, 'utf8').replace(/\r\n/g, '\n').trimEnd();
const css = fs.readFileSync(cssF, 'utf8').replace(/\r\n/g, '\n').replace(/\s+$/,'');
const markup = fs.readFileSync(markupF, 'utf8').replace(/\r\n/g, '\n').trimEnd();

// 1) Replace <title>...</title> + the Google Fonts <link ...> line(s) up to the stylesheet link.
const headBlock = /[ \t]*<title>[\s\S]*?<link[^>]*fonts\.googleapis\.com\/css2[^>]*rel="stylesheet"[^>]*>/;
if (!headBlock.test(html)) { console.error('HEAD block not found'); process.exit(1); }
html = html.replace(headBlock, head);

// 2) Replace style contents.
const styleBlock = /<style>[\s\S]*?<\/style>/;
if (!styleBlock.test(html)) { console.error('STYLE block not found'); process.exit(1); }
html = html.replace(styleBlock, '<style>\n' + css + '\n  </style>');

// 3) Replace decorative + navbar markup (plain string slicing — robust).
const startIdx = html.indexOf(startRe);
if (startIdx === -1) { console.error('MARKUP start not found: ' + startRe); process.exit(1); }
const endIdx = html.indexOf(endStr, startIdx);
if (endIdx === -1) { console.error('MARKUP end not found: ' + endStr); process.exit(1); }
html = html.slice(0, startIdx) + markup + html.slice(endIdx + endStr.length);

fs.writeFileSync(file, html);
console.log('Spliced OK: ' + file);
