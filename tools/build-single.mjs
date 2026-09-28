/* build-single.mjs — fold the whole piece into ONE file you can double-click.
 *
 *   node tools/build-single.mjs          ->  world-execute-me.html
 *
 * CSS, the three data modules, the eight engine files and the 8.1 MB recording all go
 * inside a single .html. The recording is carried as base64 and turned into a blob URL at
 * runtime (a data: URI of that size is not reliably loadable). No dependencies, no build
 * tool, no network: the output opens over file:// just like the folder version.
 *
 * All substitutions use replacer FUNCTIONS: a string replacement would interpret '$&' and
 * "$'" inside the inlined code (kit.js carries a glyph table containing '$&') as patterns.
 */
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const OUT = 'world-execute-me.html';

let doc = read('index.html');

/* 1. stylesheet -> inline <style> */
const styleTag = '<link rel="stylesheet" href="style.css">';
if (!doc.includes(styleTag)) throw new Error('index.html no longer links style.css the way this build expects');
doc = doc.replace(styleTag, () => '<style>\n' + read('style.css').trim() + '\n</style>');

/* 2. the <source> must go: main.js assigns .src itself */
const sourceRe = /\s*<source src="assets\/world-execute-me\.mp3" type="audio\/mpeg">/;
if (!sourceRe.test(doc)) throw new Error('the <source> element to strip was not found — index.html changed shape');
doc = doc.replace(sourceRe, () => '');

/* 3. every <script src="x.js"> -> inline, in place, so the order is preserved by construction */
const EXPECTED = [
  'data/notes.js', 'data/audio.js', 'data/lyrics.js',
  'engine/kit.js', 'engine/furniture.js', 'engine/data.js',
  'engine/scenes-0.js', 'engine/scenes-1.js', 'engine/scenes-2.js',
  'engine/layers.js', 'engine/main.js',
];
const found = [...doc.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
if (found.join(',') !== EXPECTED.join(',')) {
  throw new Error('script order in index.html is not what the build expects:\n  found    ' + found.join(',') + '\n  expected ' + EXPECTED.join(','));
}
// a '<' followed by '/script' inside an inline script would close the tag early
const safe = (js) => js.replace(/<\/(script)/gi, '<\\/$1');
for (const file of EXPECTED) {
  const tag = '<script src="' + file + '"></script>';
  doc = doc.replace(tag, () => '<!-- ' + file + ' -->\n<script>\n' + safe(read(file)) + '\n</script>');
}

/* 4. the recording, as base64, handed to main.js before it runs */
const mp3 = readFileSync(path.join(root, 'assets', 'world-execute-me.mp3'));
const b64 = mp3.toString('base64');
const marker = '<!-- data/notes.js -->';
if (!doc.includes(marker)) throw new Error('inlining lost the first script marker');
doc = doc.replace(marker, () => '<script>/* the recording, base64; main.js turns it into a blob URL */\nwindow.WE_SINGLE = { bytes:\n"' + b64 + '"\n};\n</script>\n' + marker);

/* 5. refuse to emit a file that still reaches out to the folder */
const external = [...doc.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((r) => !/^data:|^#/.test(r));
if (external.length) throw new Error('output still references ' + external.length + ' external file(s): ' + external.join(', '));
if (/<script src=/.test(doc)) throw new Error('an un-inlined <script src> survived');

writeFileSync(path.join(root, OUT), doc);
const bytes = statSync(path.join(root, OUT)).size;
console.log('wrote ' + OUT + '  ' + (bytes / 1048576).toFixed(2) + ' MB');
console.log('  inlined: style.css, ' + EXPECTED.length + ' scripts, ' + (mp3.length / 1048576).toFixed(2) + ' MB mp3 as base64');
console.log('  external references: 0');
