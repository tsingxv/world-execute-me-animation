/* preflight.mjs — check the three files you supply are present and usable before
 * running the build.  node tools/preflight.mjs
 *
 * Nothing here is copyrighted content: it only reports names, sizes and counts.
 */
import { existsSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { measure } = require('./mp3.js');
const { parse } = require('./smf.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* The scene table in tools/build-data.mjs is authored one row per sung line for
 * this arrangement. A different lyric file needs that table re-authored. */
const EXPECTED_SUNG_LINES = 96;

const SOURCES = [
  { role: 'recording', file: 'Mili - world.execute (me) ;.mp3', also: 'assets/world-execute-me.mp3' },
  { role: 'midi chart', file: 'world.execute(me);.mid' },
  { role: 'lyrics', file: '歌词.lrc' },
];

let problems = 0;
const say = (ok, label, detail) => { if (!ok) problems++; console.log((ok ? 'ok    ' : 'MISSING ') + label + (detail ? '   — ' + detail : '')); };

console.log('checking sources in ' + root + '\n');

for (const s of SOURCES) {
  const p = path.join(root, s.file);
  if (!existsSync(p)) {
    say(false, s.role, 'expected "' + s.file + '" in the project root');
    continue;
  }
  let detail = (statSync(p).size / 1024).toFixed(1) + ' KB';
  if (s.role === 'recording') {
    const m = measure(p);
    detail += ', ' + m.duration.toFixed(3) + ' s, ' + m.sampleRate + ' Hz, ' + m.avgBitrateKbps + ' kbps, ' + m.frames + ' frames';
    if (!m.frames) { say(false, s.role, 'no MPEG frames found — is it really an mp3?'); continue; }
    if (s.also && !existsSync(path.join(root, s.also))) {
      console.log('      note: ' + s.also + ' not created yet — run:  mkdir -p assets && cp "' + s.file + '" ' + s.also);
    }
  } else if (s.role === 'midi chart') {
    const mid = parse(readFileSync(p));
    detail += ', format ' + mid.format + ', ' + mid.division + ' ticks, ' + mid.notes.length + ' notes, ends ' + Math.max(...mid.notes.map((n) => n.t)).toFixed(2) + ' s';
    const tempo = mid.tempoMap[0].micro;
    detail += ', ' + (60e6 / tempo).toFixed(0) + ' BPM';
    if (mid.tempoMap.length > 1) detail += ' (' + mid.tempoMap.length + ' tempo changes)';
  } else {
    const rows = readFileSync(p, 'utf8').split(/\r?\n/).filter((l) => /^\[\d\d:\d\d:\d\d\]/.test(l));
    detail += ', ' + rows.length + ' timestamped rows';
    const bad = rows.filter((l) => !/^\[(\d\d):(\d\d):(\d\d)\]/.test(l)).length;
    if (bad) detail += ' (' + bad + ' unparseable!)';
    const sung = rows.length - 2;
    detail += ', ' + sung + ' sung lines after the 2 header rows';
    if (sung !== EXPECTED_SUNG_LINES) {
      console.log('      WARNING: the scene table expects ' + EXPECTED_SUNG_LINES + ' sung lines, this file has ' + sung + '.');
      console.log('      Re-author STAGE in tools/build-data.mjs (one row per line) before building.');
    }
  }
  say(true, s.role, '"' + s.file + '" — ' + detail);
}

console.log('\nnext steps:');
console.log('  node tools/run-analysis.mjs extract.html audio-analysis.json');
console.log('  node tools/build-data.mjs');
console.log('  open index.html (double-click, no server)');
console.log('\n' + (problems ? problems + ' problem(s) — fix the above and re-run' : 'all three sources present'));
process.exit(problems ? 1 : 0);
