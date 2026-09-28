/* audit-ip.mjs — pre-publish intellectual-property audit.  node tools/audit-ip.mjs
 *
 * Works out which files a commit WOULD contain (honouring .gitignore), then scans that
 * set for: verbatim lyric passages, copied MIDI note data, embedded audio-feature tables,
 * bundled third-party assets, remote/CDN dependencies, secrets, personal paths and
 * upstream licence headers. It also asserts that every risky file sitting on disk really
 * is ignored, so the guard cannot silently rot.
 *
 * The copyrighted files are read only to build comparison signatures; no lyric line and
 * no note table is written into this file.
 */
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parse } = require('./smf.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => path.relative(root, p).replace(/\\/g, '/');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const norm = (s) => String(s).toLowerCase().replace(/[’'`"]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/* ---------- the set a commit would contain ---------- */
const rules = existsSync(path.join(root, '.gitignore'))
  ? read('.gitignore').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => {
      const dirOnly = l.endsWith('/');
      const base = dirOnly ? l.slice(0, -1) : l;
      const source = base.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*').replace(/\?/g, '.');
      return { rule: l, re: new RegExp('^' + source + (dirOnly ? '(/.*)?$' : '$')) };
    })
  : [];
const isIgnored = (f) => rules.some((r) => r.re.test(f));

function walk(dir = root, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(rel(p));
  }
  return acc;
}
const all = walk();
const staged = all.filter((f) => !isIgnored(f));
const ignored = all.filter(isIgnored);
const TEXT = /(\.|^)(js|mjs|cjs|json|html|css|md|txt|yml|yaml|svg|gitignore|license|editorconfig|npmignore)$/i;
const bodies = staged.filter((f) => TEXT.test(path.basename(f)) || !path.extname(path.basename(f))).map((f) => {
  const s = read(f);
  return { f, s, lower: norm(s) };
});

const SELF = rel(fileURLToPath(import.meta.url));
const findings = [];
const add = (level, code, detail) => findings.push({ level, code, detail });

/* ---------- signatures from the local (ignored) sources ---------- */
const lrcFile = all.find((f) => f.endsWith('.lrc')) || null;
const midFile = all.find((f) => f.endsWith('.mid') || f.endsWith('.midi')) || null;
const audioFile = all.find((f) => /\.(mp3|wav|flac|m4a|ogg)$/i.test(f)) || null;

const lyricLines = lrcFile
  ? read(lrcFile).split(/\r?\n/).map((l) => l.match(/^\[\d\d:\d\d:\d\d\](.*)$/)).filter(Boolean).map((m) => norm(m[1]))
  : [];
const lyricGrams = new Map();
for (const line of lyricLines) {
  const w = line.split(' ').filter(Boolean);
  for (let n = 4; n <= 6; n++) for (let i = 0; i + n <= w.length; i++) lyricGrams.set(w.slice(i, i + n).join(' '), n);
}

let noteTimes = new Set();
let noteCount = 0;
if (midFile) {
  const m = parse(readFileSync(path.join(root, midFile)));
  noteCount = m.notes.length;
  for (const n of m.notes) {
    const t = Math.round(n.t * 1000) / 1000;
    noteTimes.add(t.toFixed(3));
    noteTimes.add(String(t));
  }
}

/* ---------- text probes over the staged set ---------- */
const PROBE = [
  { code: 'A1', level: 'FAIL', why: 'third-party media/asset file would be committed', re: /\.(mp3|m4a|wav|ogg|flac|mid|midi|lrc|ttf|otf|woff2?|eot|png|jpe?g|gif|webp|mp4|webm)$/i, onName: true },
  { code: 'N1', level: 'WARN', why: 'remote URL present (the page must run offline)', re: /https?:\/\/[a-z0-9.:-]+/i, skipHost: /^https?:\/\/((www\.)?github\.com|127\.0\.0\.1(:\d+)?|localhost(:\d+)?|\[::1\])/i },
  { code: 'N2', level: 'FAIL', why: 'bundled or remote font / CDN reference', re: /@font-face|googleapis|cdn\.|unpkg\.com|jsdelivr|cloudflare/i },
  { code: 'S1', level: 'FAIL', why: 'credential-shaped string', re: /(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|[?&](access_token|pat)=\w{20,})/i },
  { code: 'P1', level: 'WARN', why: 'absolute local path that reveals a user name', re: /(?:[a-z]:[\\/](?:users)[\\/][^"'`\s)]+|\\\\wsl\.localhost[\\/]|\/home\/[a-z][a-z0-9._-]*\/|\/Users\/[a-z][a-z0-9._-]*\/)/i },
  { code: 'P2', level: 'WARN', why: 'e-mail address', re: /\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/i },
  { code: 'Q1', level: 'WARN', why: 'possible upstream licence/copyright header', re: /(SPDX-License-Identifier|Licensed under the|Copyright \(c\) \d{4}[^{]*?(?:Inc|LLC|GmbH|Ltd|Foundation|<))|Permission is hereby granted/i },
];
const hits = new Map();
for (const spec of PROBE) {
  const list = [];
  for (const b of bodies) {
    if (b.f === SELF) continue;   // this file necessarily contains the patterns it hunts for
    if (spec.onName) { if (spec.re.test(b.f)) list.push({ file: b.f, line: 0, sample: b.f }); continue; }
    if (b.f === 'LICENSE' && spec.code === 'Q1') continue;
    const hay = b.s;
    const m = hay.match(spec.re);
    if (!m) continue;
    if (spec.skipHost && spec.skipHost.test(m[0])) continue;
    list.push({ file: b.f, line: hay.slice(0, m.index).split('\n').length, sample: m[0].slice(0, 50) });
  }
  hits.set(spec.code, list);
  if (!list.length) add('PASS', spec.code, spec.why + ': none');
  else add(spec.level, spec.code, list.length + ' hit(s) — ' + list.map((h) => h.file + (h.line ? ':' + h.line : '') + ' ' + JSON.stringify(h.sample)).slice(0, 6).join(' | '));
}

/* ---------- lyric overlap ---------- */
if (!lrcFile) add('WARN', 'L1', 'no .lrc on disk, lyric overlap could not be tested');
else add('INFO', 'L1', 'compared against ' + lyricLines.length + ' lyric lines from ' + lrcFile);
// Words may be split by line wraps, comment continuations or punctuation. Tolerate that,
// and never drop a hit: a scanner that silently loses matches is worse than a noisy one.
const locate = (b, gram) => {
  const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(gram.split(' ').map(esc).join('[^a-z0-9]+'), 'i');
  const m = b.s.match(re);
  if (!m) return { file: b.f, line: 0, words: gram.split(' ').length, matched: gram + ' [wrapped]' };
  return { file: b.f, line: b.s.slice(0, m.index).split('\n').length, words: gram.split(' ').length, matched: m[0] };
};
const gramHits = [];
for (const [gram, n] of lyricGrams) for (const b of bodies) {
  if (!b.lower.includes(gram)) continue;
  gramHits.push({ n, gram, ...locate(b, gram) });
}
const fullLineHits = [];
for (const line of lyricLines) {
  if (line.split(' ').length < 4) continue;
  for (const b of bodies) {
    if (!b.lower.includes(line)) continue;
    fullLineHits.push(locate(b, line));
  }
}
if (fullLineHits.length) add('FAIL', 'L2', fullLineHits.length + ' whole lyric line(s) reproduced: ' + fullLineHits.map((h) => h.file + ':' + h.line + ' ' + JSON.stringify(h.matched.slice(0, 44))).slice(0, 8).join(' | '));
else add('PASS', 'L2', 'no whole lyric line (4+ words) appears in any staged file');
if (gramHits.length) {
  const worst = gramHits.sort((a, b) => b.n - a.n).slice(0, 10);
  add(worst[0].n >= 4 ? 'FAIL' : 'WARN', 'L3', worst.length + ' lyric fragment(s) of 4+ words: ' + worst.map((h) => h.file + ':' + h.line + ' ' + JSON.stringify(h.matched.slice(0, 40))).join(' | '));
} else add('PASS', 'L3', 'no 4-word lyric fragment appears in any staged file');

/* ---------- chart / recording data ---------- */
if (!midFile) add('WARN', 'D1', 'no .mid on disk, note-clock overlap could not be tested');
else {
  // a copied note table shows up as an ORDERED run of the chart's own onset times;
  // scattered numbers like 0.5 or 2,1 are just ordinary constants
  const sortedNoteTimes = [...noteTimes].filter((t) => /^\d+\.\d{3}$/.test(t)).map(Number).sort((a, b) => a - b);
  const clockHits = [];
  for (const b of bodies) {
    const nums = [...b.s.matchAll(/\b\d{1,3}\.\d{3}\b/g)].map((m) => Number(m[0]));
    if (nums.length < 5) continue;
    let run = 0, bestRun = 0, sample = null;
    for (const v of nums) {
      const hit = sortedNoteTimes.some((t) => Math.abs(t - v) < 1e-6);
      if (hit) { run++; if (run > bestRun) { bestRun = run; sample = v; } } else run = 0;
    }
    if (bestRun >= 5) clockHits.push({ file: b.f, longestOrderedRun: bestRun, sample });
  }
  if (clockHits.length) add('FAIL', 'D1', 'staged file(s) embed an ordered run of the chart note clock (' + noteCount + ' notes): ' + JSON.stringify(clockHits));
  else add('PASS', 'D1', 'no staged file contains 5+ consecutive chart note times (' + noteCount + ' notes compared)');
}
const blobHits = [];
for (const b of bodies) {
  for (const m of b.s.matchAll(/\[[\s]*-?\d[\d.,\s-]{600,}\]/g)) blobHits.push({ file: b.f, chars: m[0].length, kind: 'numeric array' });
  for (const m of b.s.matchAll(/['"][0-9a-f+/]{400,}['"]/gi)) blobHits.push({ file: b.f, chars: m[0].length, kind: 'hex/base64 blob' });
}
if (blobHits.length) add('FAIL', 'D2', 'large embedded data table (could substitute for the recording/chart): ' + JSON.stringify(blobHits.slice(0, 5)));
else add('PASS', 'D2', 'no embedded feature/note table large enough to stand in for the audio or the chart');
const audio = existsSync(path.join(root, 'tools/audio-analysis.json')) ? JSON.parse(read('tools/audio-analysis.json')) : null;
add('INFO', 'D3', 'recording signature held out of the repo: ' + (audio ? audio.onsets.length + ' onsets + ' + audio.env.len + 'x' + Math.round(audio.meta.envRate) + 'Hz envelope in tools/audio-analysis.json' + (audioFile ? ', source ' + audioFile : '') : 'no analysis file present'));

/* ---------- dependency surface ---------- */
const pkgPath = path.join(root, 'package.json');
if (existsSync(pkgPath)) {
  const pkg = JSON.parse(read('package.json'));
  const deps = Object.keys(pkg.dependencies || {});
  add(deps.length ? 'FAIL' : 'PASS', 'N3', 'package.json dependencies: ' + JSON.stringify(deps));
} else add('PASS', 'N3', 'no package.json: nothing to install, no dependency licence surface');
const BUILTIN = new Set(['fs', 'path', 'url', 'os', 'module', 'child_process', 'crypto', 'http', 'https', 'util', 'assert', 'events', 'stream', 'zlib', 'net', 'tls', 'dns', 'querystring', 'readline', 'worker_threads', 'perf_hooks', 'process', 'buffer', 'string_decoder', 'v8', 'vm', 'test']);
const bareSpecs = new Set();
for (const b of bodies) {
  if (b.f === SELF || !/\.(m?js|cjs)$/.test(b.f)) continue;   // JS only: JSON has "from": fields
  for (const m of b.s.matchAll(/(?:^|\n|;)\s*(?:import[^'"\n]*?from|require)\s*\(?['"]([^'"]+)['"]/g)) {
    const spec = m[1];
    if (spec[0] === '.' || spec[0] === '/' || spec.startsWith('node:')) continue;
    if (BUILTIN.has(spec.split('/')[0])) continue;
    bareSpecs.add(spec + ' <- ' + b.f);
  }
}
add(bareSpecs.size ? 'FAIL' : 'PASS', 'N4', bareSpecs.size ? 'needs an npm package: ' + [...bareSpecs].join(', ') : 'imports are relative or node built-ins only: nothing to install');

/* ---------- ignore coverage ---------- */
const RISK = [
  ['recording', (f) => /\.(mp3|wav|flac|m4a|ogg)$/i.test(f)],
  ['midi chart', (f) => /\.(mid|midi)$/i.test(f)],
  ['lyrics file', (f) => /\.lrc$/i.test(f)],
  ['generated data modules', (f) => f.startsWith('data/')],
  ['audio copy used by the page', (f) => f.startsWith('assets/')],
  ['single-file build (audio + lyrics inlined)', (f) => f === 'world-execute-me.html'],
  ['audio feature dump', (f) => f === 'tools/audio-analysis.json'],
  ['note table dump', (f) => f === 'tools/midi-notes.json'],
  ['ip audit report', (f) => f === 'tools/ip-audit-report.json'],
  ['screen capture of the work', (f) => /(^|\/)(shots?|screenshots?)\//.test(f) || /preview.*\.(png|jpg|gif|webp)$/i.test(f)],
  ['local tooling state', (f) => f.startsWith('.qoder-credits/')],
];
for (const [label, test] of RISK) {
  const present = all.filter(test);
  if (!present.length) { add('INFO', 'G:' + label, 'nothing on disk'); continue; }
  const leaked = present.filter((f) => !isIgnored(f));
  add(leaked.length ? 'FAIL' : 'PASS', 'G:' + label, leaked.length ? 'WOULD BE COMMITTED: ' + leaked.join(', ')
    : present.length + ' present, all ignored (' + present.slice(0, 3).map((p) => p + ' ' + (statSync(path.join(root, p)).size / 1024).toFixed(0) + 'KB').join(', ') + ')');
}
add(existsSync(path.join(root, '.git')) ? 'WARN' : 'PASS', 'H1', existsSync(path.join(root, '.git'))
  ? '.git exists: check history too — git log --all --name-only | grep -Ei "\\.(mp3|mid|lrc)$"'
  : 'no .git yet, so no history can already contain the copyrighted files');

/* ---------- report ---------- */
const ORDER = { FAIL: 0, WARN: 1, PASS: 2, INFO: 3 };
findings.sort((a, b) => (ORDER[a.level] - ORDER[b.level]) || a.code.localeCompare(b.code));
const counts = findings.reduce((m, f) => (m[f.level] = (m[f.level] || 0) + 1, m), {});
const stagedKB = (staged.reduce((s, f) => s + statSync(path.join(root, f)).size, 0) / 1024).toFixed(0);
console.log('# IP / licence audit — ' + rel(root));
console.log('would commit ' + staged.length + ' files (' + stagedKB + ' KB); ' + ignored.length + ' ignored; ' + bodies.length + ' text files scanned');
console.log('sources compared against: ' + [audioFile, midFile, lrcFile].filter(Boolean).join(', ') || 'none');
console.log('');
for (const f of findings) console.log(f.level.padEnd(4) + ' ' + f.code.padEnd(38) + ' ' + f.detail);
const fails = findings.filter((f) => f.level === 'FAIL');
const warns = findings.filter((f) => f.level === 'WARN');
console.log('\n' + (fails.length ? fails.length + ' FAIL' : 'no FAIL') + (warns.length ? ', ' + warns.length + ' WARN (judge by hand)' : '') + ' | ' + (counts.PASS || 0) + ' PASS');
console.log(fails.length ? 'verdict: do not publish until the FAILs are cleared' : 'verdict: nothing blocking; review the WARNs');
writeFileSync(path.join(root, 'tools', 'ip-audit-report.json'), JSON.stringify({ when: new Date().toISOString(), staged, ignored, findings }, null, 1));
console.log('machine-readable list -> tools/ip-audit-report.json (gitignored: it echoes matched fragments)');
process.exit(fails.length ? 1 : 0);
