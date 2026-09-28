/* Build the embedded data modules from the three local source files.
 * Run: node tools/build-data.mjs
 * Sources: world.execute(me);.mid, 歌词.lrc, tools/audio-analysis.json (tools/extract-audio.js)
 * Outputs: data/notes.js, data/lyrics.js, data/audio.js
 * No dependencies. The page never reads the source files at runtime. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parse } = require('./smf.js');
const { measure } = require('./mp3.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const AUD = JSON.parse(read('tools/audio-analysis.json'));
const MP3 = measure(path.join(root, 'Mili - world.execute (me) ;.mp3'));

/* ---------------- MIDI ---------------- */
const mid = parse(readFileSync(path.join(root, 'world.execute(me);.mid')));
mid.trackInfos.forEach((t) => { try { t.name = Buffer.from(t.name, 'latin1').toString('utf8'); } catch (e) {} });
const notes = mid.notes.map((n) => ({
  t: Math.round(n.t * 1000) / 1000,
  d: Math.round(Math.min(n.dur, 8) * 1000) / 1000,
  p: n.pitch,
  v: n.velocity,
  k: n.track,
}));
notes.sort((a, b) => a.t - b.t || a.p - b.p);
const midiEnd = notes[notes.length - 1].t;
const midiBpm = Math.round(60e6 / mid.tempoMap[0].micro);

const NOTES_JS = `/* Derived from world.execute(me);.mid by parsing it — not hand-edited.
 * Regenerate: node tools/build-data.mjs
 * SMF format ${mid.format}, ${mid.division} ticks/quarter, single tempo ${midiBpm} BPM,
 * ${mid.nTracks} tracks (${mid.trackInfos.map((t) => t.name).join(' / ')}), ${notes.length} note events, ${notes[0].t}s .. ${midiEnd}s.
 * All onsets sit on the file's own 1/8-note quantize grid (${mid.division / 4} ticks) and every velocity is ${notes[0].v}.
 * COVERAGE: the chart stops at ${midiEnd}s while the recording runs ${AUD.meta.duration}s.
 * WE_AUDIO.onsets carries the measured spectral-flux peaks used to register accents to the audio. */
window.WE_NOTES = {
  source: 'world.execute(me);.mid',
  format: ${mid.format},
  division: ${mid.division},
  bpm: ${midiBpm},
  grid: 0.125,
  tracks: ${JSON.stringify(mid.trackInfos.map((t) => ({ name: t.name, channels: t.channels })))},
  span: [${notes[0].t}, ${midiEnd}],
  count: ${notes.length},
  /* t onset s, p midi pitch, v velocity, d held s */
  t: [${notes.map((n) => n.t).join(',')}],
  p: [${notes.map((n) => n.p).join(',')}],
  v: [${notes.map((n) => n.v).join(',')}],
  d: [${notes.map((n) => n.d).join(',')}]
};
`;

/* ---------------- measured audio features ---------------- */
const { env, onsets, meta } = AUD;
const AUDIO_JS = `/* Measured from 'Mili - world.execute (me) ;.mp3'. Not inferred from any BPM grid.
 * Regenerate: node tools/extract-audio.mjs (decodes in headless Chrome), then node tools/build-data.mjs
 * duration = decodeAudioData length; frameWalk = independent sum of MPEG frame header durations.
 * flux/rms/bands are hex byte pairs, one per ${Math.round(meta.envRate)} Hz sample (40 ms), starting at t=0.
 * bands = [20-60Hz, 60-250Hz, 250-1k, 1k-4k, 4k-16k] normalised magnitudes; flux = onset novelty; rms = loudness.
 * onsets = picked spectral-flux peaks [seconds, strength]. */
window.WE_AUDIO = {
  file: 'assets/world-execute-me.mp3',
  originalName: 'Mili - world.execute (me) ;.mp3',
  duration: ${meta.duration},
  frameWalk: ${MP3.duration.toFixed(3)},
  sampleRate: ${MP3.sampleRate},
  channels: ${MP3.channels},
  bitrateKbps: ${MP3.avgBitrateKbps},
  bytes: ${MP3.bytes},
  frames: ${meta.frames},
  envRate: ${meta.envRate},
  envLen: ${env.len},
  onsetCount: ${onsets.length},
  flux: '${env.flux}',
  rms: '${env.rms}',
  bands: [${env.bands.map((b) => `'${b}'`).join(', ')}],
  onsets: [${onsets.map((o) => `[${o.t},${o.s}]`).join(',')}]
};
`;

/* ---------------- lyrics ---------------- */
const lrcLines = read('歌词.lrc')
  .split(/\r?\n/)
  .map((l) => l.match(/^\[(\d\d):(\d\d):(\d\d)\](.*)$/))
  .filter(Boolean)
  .map((m) => ({ start: Number(m[1]) * 60 + Number(m[2]) + Number(m[3]) / 100, text: m[4].trim().replace(/"/g, "'") }));

const NOTICE = lrcLines[0].text;
const TITLE = lrcLines[1].text;
const sung = lrcLines.slice(2);

/* Per-line staging: ONE ROW PER SUNG LINE, in LRC order (row 0 is the first sung line).
 * Repeated words get their own row on purpose, so 'Execution' ends up with 18
 * separately scheduled states of the same process object.
 * [family, mood, params, expectedFirstWords] */
const STAGE = [
  ['boot', 'boot', { cmd: 'power.line = ON', action: 'throw' }, 'Switch on'],
  ['boot', 'boot', { cmd: 'remember()', hint: true }, 'Remember to'],
  ['construct', 'boot', { shape: 'shield', label: 'PROTECTION' }, 'Protection'],
  ['construct', 'boot', { shape: 'pieces', label: 'lay down' }, 'Lay down'],
  ['construct', 'boot', { shape: 'object', label: 'new Object()' }, 'And let'],
  ['dataform', 'logic', { rows: 6, cursor: true }, 'Fill in'],
  ['dataform', 'logic', { rows: 6, commit: 'init', flash: 1 }, 'Initialization'],
  ['worldbuild', 'logic', { stage: 'frame' }, 'Set up'],
  ['worldbuild', 'logic', { stage: 'run' }, 'And let'],
  ['geometry', 'logic', { shape: 'points', give: 'dimension' }, 'If I'],
  ['geometry', 'logic', { shape: 'axes', give: '3 axes' }, 'Then I'],
  ['geometry', 'logic', { shape: 'circle' }, 'If I'],
  ['geometry', 'logic', { shape: 'circumference', unroll: 1 }, 'Then I'],
  ['geometry', 'logic', { shape: 'sine' }, 'If I'],
  ['geometry', 'whimsy', { shape: 'tangents', seats: 1 }, 'They you'],
  ['geometry', 'devotion', { shape: 'infinity', approach: 1 }, 'If I'],
  ['geometry', 'devotion', { shape: 'asymptote', bound: 1 }, 'Then you'],
  ['switch', 'logic', { field: 'current', from: 'AC', to: 'DC' }, 'Switch my'],
  ['switch', 'logic', { field: 'wave', from: 'sin', to: 'flat' }, 'To ac'],
  ['blind', 'flux', { iris: 1 }, 'And then'],
  ['dizzy', 'flux', { doubled: 1 }, 'So dizzy'],
  ['travel', 'logic', { mode: 'depart' }, 'Oh we'],
  ['travel', 'logic', { mode: 'address', from: '0xAD', to: '0xBC' }, 'To ad'],
  ['unite', 'devotion', { mode: 'overlap' }, 'And we'],
  ['unite', 'devotion', { mode: 'deep', doubled: 1 }, 'So deeply'],
  ['promise', 'devotion', { step: 'if', echo: 0 }, 'If I'],
  ['promise', 'devotion', { step: 'give', count: 24, word: 'simulations' }, 'If I'],
  ['promise', 'devotion', { step: 'then', echo: 1 }, 'Then I'],
  ['promise', 'devotion', { step: 'only', collapse: 1, word: 'satisfaction' }, 'Then I'],
  ['promise', 'devotion', { step: 'if', word: 'happy', goal: 'happiness' }, 'If I'],
  ['execution', 'climax', { k: 0 }, 'I will'],
  ['cage', 'collapse', { mode: 'bars' }, 'Though we'],
  ['cage', 'collapse', { mode: 'strange', warp: 1, doubled: 1 }, 'In this'],
  ['gift', 'whimsy', { item: 'eggplant' }, 'If I'],
  ['gift', 'whimsy', { item: 'nutrients', readout: 'nutrients' }, 'Then I'],
  ['gift', 'whimsy', { item: 'tomato' }, 'If I'],
  ['gift', 'whimsy', { item: 'antioxidant', readout: 'antioxidants' }, 'Then I'],
  ['gift', 'whimsy', { item: 'cat' }, 'If I'],
  ['gift', 'whimsy', { item: 'purr', readout: 'purr Hz' }, 'Then I'],
  ['god', 'flux', { mode: 'throne' }, 'If I'],
  ['god', 'flux', { mode: 'proof', qed: 1 }, 'Then you'],
  ['identity', 'flux', { field: 'gender' }, 'Switch my'],
  ['identity', 'flux', { field: 'gender', glyphs: 'F -> M' }, 'To f'],
  ['identity', 'flux', { field: 'whatever', loose: 1 }, 'And then'],
  ['clock', 'flux', { day: 'AM', night: 'PM' }, 'From AM'],
  ['identity', 'flux', { field: 'role' }, 'Oh switch'],
  ['identity', 'flux', { field: 'role', glyphs: 'S -> M' }, 'To s'],
  ['trance', 'flux', { mode: 'enter' }, 'So we'],
  ['trance', 'flux', { mode: 'deep', doubled: 1 }, 'The trance'],
  ['promise', 'devotion', { step: 'if', echo: 2, quiet: 1 }, 'If I'],
  ['vibrate', 'devotion', { sense: 'vibration' }, 'If I'],
  ['promise', 'devotion', { step: 'then', echo: 3 }, 'Then I'],
  ['completion', 'devotion', { target: 100 }, 'Then I'],
  ['isolation', 'void', { step: 0 }, 'Though you'],
  ['isolation', 'void', { step: 1 }, 'You have'],
  ['isolation', 'void', { step: 2 }, 'You have'],
  ['isolation', 'void', { step: 3 }, 'You have'],
  ['isolation', 'void', { step: 4 }, 'You have'],
  ['isolation', 'void', { step: 5, final: 'in isolation' }, 'You have'],
  ['bargain', 'devotion', { mode: 'if' }, 'If I'],
  ['erase', 'collapse', { mode: 'fragments' }, 'If I'],
  ['maybe', 'devotion', { mode: 'glint' }, 'Then maybe'],
  ['maybe', 'devotion', { mode: 'crack', word: 'cracked' }, 'Then maybe'],
  ['challenge', 'error', { mode: 'defiance' }, 'Challenging'],
  ['error', 'error', { mode: 'illegal', code: 'ERR_ILLEGAL_ARGUMENTS' }, 'You have'],
  ['execution', 'climax', { k: 1 }, 'Execution'],
  ['execution', 'climax', { k: 2 }, 'Execution'],
  ['execution', 'climax', { k: 3 }, 'Execution'],
  ['execution', 'climax', { k: 4 }, 'Execution'],
  ['execution', 'climax', { k: 5 }, 'Execution'],
  ['execution', 'climax', { k: 6 }, 'Execution'],
  ['execution', 'climax', { k: 7 }, 'Execution'],
  ['execution', 'climax', { k: 8 }, 'Execution'],
  ['execution', 'climax', { k: 9 }, 'Execution'],
  ['execution', 'climax', { k: 10 }, 'Execution'],
  ['execution', 'climax', { k: 11 }, 'Execution'],
  ['execution', 'climax', { k: 12 }, 'Execution'],
  ['count', 'climax', { langs: ['de', 'es', 'fr', 'ko'] }, 'Ein dos'],
  ['count', 'climax', { langs: ['da', 'sv'] }, 'Fem liu'],
  ['execution', 'climax', { k: 13 }, 'Execution'],
  ['promise', 'devotion', { step: 'if', echo: 4 }, 'If I'],
  ['execution', 'chorus', { k: 14, word: 'broadcast' }, 'If I'],
  ['promise', 'devotion', { step: 'then', echo: 5 }, 'Then I'],
  ['execution', 'chorus', { k: 15, word: 'singular' }, 'Then I'],
  ['bargain', 'devotion', { mode: 'back' }, 'If I'],
  ['execution', 'chorus', { k: 16, word: 'invoked' }, 'I will'],
  ['cage', 'collapse', { mode: 'bars', again: 1 }, 'Though we'],
  ['cage', 'collapse', { mode: 'break', word: 'released' }, 'We are'],
  ['study', 'tender', { mode: 'page' }, "I've studied"],
  ['study', 'tender', { mode: 'flip', word: 'chapter 4' }, "I've studied"],
  ['answer', 'tender', { mode: 'prompt' }, 'Question me'],
  ['answer', 'tender', { mode: 'flood' }, 'Question me'],
  ['formula', 'tender', { mode: 'expand' }, 'I know'],
  ['free', 'tender', { mode: 'sky' }, 'Though you'],
  ['free', 'tender', { mode: 'cage', warm: 1 }, 'I am'],
  ['execution', 'end', { k: 17, terminal: 1 }, 'Execution'],
];

/* Where the resident being stands while a family occupies the stage. Families that put
 * their own text or panel dead centre step it aside; families that are *about* it leave it
 * in the middle. Applied per family so the same furniture behaves the same every time. */
const ENTITY_OFF = {
  dataform: [-0.32, 0.17],
  bargain: [0.33, -0.16],
  challenge: [-0.31, 0.19],
  clock: [0.34, 0.16],
  completion: [-0.32, -0.2],
  count: [0, 0.23],
  error: [0.33, 0.21],
  formula: [0.31, 0.17],
  gift: [0.33, 0.15],
  identity: [0, 0.25],
  maybe: [0.29, 0.19],
  study: [-0.31, -0.19],
  answer: [0.29, -0.19],
  travel: [0, -0.23],
  vibrate: [0, 0.25],
};
for (const st of STAGE) {
  const off = ENTITY_OFF[st[0]];
  if (off) st[2].entity = off;
}

/* Spans that are not tied to a sung line: instrumental build, crash, outro. */
const INTERLUDES = [
  { id: 'simrun', from: 12.6, to: 29.0, scene: 'interlude', mood: 'logic', p: { label: 'simulation running' } },
  { id: 'errorstorm', from: 132.0, to: 147.0, scene: 'interlude', mood: 'error', p: { label: 'uncaught exception' } },
  { id: 'afterglow', from: 191.5, to: 205.6, scene: 'interlude', mood: 'tender', p: { label: 'alone with the formula' } },
  { id: 'poweroff', from: 208.6, to: null, scene: 'interlude', mood: 'end', p: { label: 'power.line = OFF' } },
];

if (STAGE.length !== sung.length) {
  console.error('STAGE has ' + STAGE.length + ' rows but the LRC has ' + sung.length + ' sung lines.');
  sung.forEach((l, i) => console.error('  ' + i + ' ' + JSON.stringify(l.text.slice(0, 26)) + ' -> ' + (STAGE[i] ? STAGE[i][0] + ' "' + STAGE[i][3] + '"' : 'MISSING')));
  process.exit(1);
}

const norm = (s) => s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
const lines = sung.map((l, i) => {
  const st = STAGE[i];
  if (!norm(l.text).startsWith(norm(st[3]))) {
    console.error(`ALIGNMENT ERROR at sung line ${i}: LRC ${JSON.stringify(l.text)} does not start with ${JSON.stringify(st[3])}`);
    process.exit(1);
  }
  return { i, start: l.start, text: l.text, s: st[0], m: st[1], p: st[2] };
});

lines.sort((a, b) => a.start - b.start || a.i - b.i);
lines.forEach((l) => {
  const next = lines.find((x) => x.start > l.start);
  if (next) {
    l.end = +Math.min(next.start, l.start + 8).toFixed(3);
  } else {
    // the last sung line hands the screen to the interlude that follows it
    const sp = INTERLUDES.filter((s) => s.from > l.start).sort((a, b) => a.from - b.from)[0];
    l.end = sp ? +(sp.from - 0.001).toFixed(3) : +AUD.meta.duration.toFixed(3);
  }
  l.dur = +(l.end - l.start).toFixed(3);
});

const LYRICS_JS = `/* Lyrics and timeline lifted from 歌词.lrc. Timestamps are that file's measured
 * values ([mm:ss:cc]); they are never quantised to a beat grid, and they are the only
 * authority for when a word is on screen. Scene staging is hand-authored per sung line
 * in tools/build-data.mjs (STAGE) — one row per line, repeats included, so the twelve
 * 'Execution' calls, the six 'You have left' calls and each 'If I can' get their own
 * treatment. Regenerate: node tools/build-data.mjs
 * lines[] = [start, end, text, family, mood]; params[] = family parameters by index. */
window.WE_LYRICS = {
  source: '歌词.lrc',
  notice: ${JSON.stringify(NOTICE)},
  title: ${JSON.stringify(TITLE)},
  count: ${lines.length},
  firstStart: ${lines[0].start},
  lastStart: ${lines[lines.length - 1].start},
  lines: [
${lines.map((l) => `    [${l.start}, ${l.end}, ${JSON.stringify(l.text)}, '${l.s}', '${l.m}'],`).join('\n')}
  ],
  params: [
${lines.map((l) => `    ${JSON.stringify(l.p)},`).join('\n')}
  ]
};

window.WE_INTERLUDES = [
${INTERLUDES.map((s) => `  { id: '${s.id}', from: ${s.from}, to: ${s.to === null ? 'null' : s.to}, scene: '${s.scene}', mood: '${s.mood}', p: ${JSON.stringify(s.p)} },`).join('\n')}
];
`;

mkdirSync(path.join(root, 'data'), { recursive: true });
writeFileSync(path.join(root, 'data/notes.js'), NOTES_JS);
writeFileSync(path.join(root, 'data/audio.js'), AUDIO_JS);
writeFileSync(path.join(root, 'data/lyrics.js'), LYRICS_JS);

const execHits = lines.filter((l) => /execution/i.test(l.text));
const execK = new Set(lines.filter((l) => l.s === 'execution').map((l) => l.p.k));
const fams = new Set(lines.map((l) => l.s));
console.log('data/notes.js  ' + (NOTES_JS.length / 1024).toFixed(1) + ' KB  ' + notes.length + ' notes, span ' + notes[0].t + '..' + midiEnd);
console.log('data/audio.js  ' + (AUDIO_JS.length / 1024).toFixed(1) + ' KB  ' + onsets.length + ' onsets, env ' + env.len + ' @' + Math.round(meta.envRate) + 'Hz');
console.log('data/lyrics.js ' + (LYRICS_JS.length / 1024).toFixed(1) + ' KB  ' + lines.length + ' lines, ' + fams.size + ' families');
console.log('families: ' + [...fams].sort().join(' '));
console.log('execution: word occurrences ' + execHits.length + ' | scheduled k ' + execK.size + ' | 0..' + Math.max(...execK));
if (execHits.length !== 18 || execK.size !== 18) { console.error('EXECUTION accounting mismatch'); process.exit(1); }
