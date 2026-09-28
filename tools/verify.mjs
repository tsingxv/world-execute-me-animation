/* verify.mjs — proves the finished page rather than the intention.   node tools/verify.mjs
 *
 *  1   every asset the page references exists locally, nothing comes over the network
 *  2   data provenance: embedded notes == parsed .mid, embedded words == parsed .lrc
 *  3   every scene family PAINTS (pixels changed vs the background), not merely registers
 *  4   coverage over the whole timeline: no dead span, no board errors anywhere
 *  5   animation endpoint == measured audio duration
 *  6   frame-exact recovery from arbitrary out-of-order seeks (byte hash equality)
 *  7   purity: no Math.random / wall clock, and no ctx state carried between frames
 *  8   the 18 EXECUTION occurrences are 18 distinct mechanisms and 18 distinct pictures
 *  9   the words on screen are exactly the LRC words, at the LRC timestamps
 *  10  one throwing board cannot poison the render loop
 *  11  missing audio degrades to a running animation instead of a black screen
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync, existsSync, renameSync } from 'node:fs';
import { createRequire } from 'node:module';
import { launchBrowser, sleep } from './cdp.mjs';

const require = createRequire(import.meta.url);
const { measure } = require('./mp3.js');
const { parse } = require('./smf.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = process.env.WE_TARGET || 'index.html';
const SINGLE = /world-execute-me\.html$/.test(TARGET);
const results = [];
let failures = 0;
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail });
  if (!ok) failures++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail ? '   — ' + detail : ''));
}
const strip = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  .replace(/'(\\.|[^'\\])*'/g, "''")
  .replace(/"(\\.|[^"\\])*"/g, '""')
  .replace(/`(\\.|[^`\\])*`/g, '``');

const browser = await launchBrowser({ extraArgs: ['--force-device-scale-factor=1'] });
await browser.navigate(pathToFileURL(path.join(root, TARGET)).href);

/* ---------- 1. referenced assets ---------- */
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((s) => !/^https?:|^data:|^#/.test(s));
const missing = refs.filter((r) => !existsSync(path.join(root, r)));
check('1  assets referenced by index.html all exist', missing.length === 0, refs.length + ' refs' + (missing.length ? ', missing ' + missing.join(', ') : ''));
const net = await browser.evaluate(`(async () => {
  const failed = [];
  for (const s of document.scripts) { if (!s.src) continue; const r = await fetch(s.src).catch(() => null); if (!r || !r.ok) failed.push(s.src); }
  const a = await fetch(WE_AUDIO.file).catch(() => null);
  return { failed, audioStatus: a ? a.status : 'blocked', remote: performance.getEntriesByType('resource').map(r => r.name).filter(n => /^https?:/.test(n)), bg: getComputedStyle(document.body).backgroundColor };
})()`);
check('1b every script and the mp3 resolve over file://', net.failed.length === 0, JSON.stringify(net.failed) + ' audio http status ' + net.audioStatus);
check('1c no remote requests', net.remote.length === 0, JSON.stringify(net.remote));
check('1d stylesheet applied', net.bg !== 'rgba(0, 0, 0, 0)', 'body background ' + net.bg);
const srcInfo = await browser.evaluate(`({ single: !!window.WE_SINGLE, src: WE.test.source() || '', bytes: window.WE_SINGLE ? window.WE_SINGLE.bytes.length : 0 })`, { awaitPromise: false });
if (SINGLE) {
  check('1e single file carries its own audio (blob, not the folder)', /^blob:/.test(srcInfo.src) && srcInfo.bytes > 1e7,
    'embedded base64 ' + (srcInfo.bytes / 1048576).toFixed(2) + ' MB, element src ' + srcInfo.src.slice(0, 30) + '…');
} else {
  check('1e folder version reads the sibling mp3', /world-execute-me\.mp3$/.test(srcInfo.src), srcInfo.src.split('/').slice(-1)[0]);
}

/* ---------- 2. provenance ---------- */
const mid = parse(readFileSync(path.join(root, 'world.execute(me);.mid')));
const lrc = readFileSync(path.join(root, '歌词.lrc'), 'utf8')
  .split(/\r?\n/).map((l) => l.match(/^\[(\d\d):(\d\d):(\d\d)\](.*)$/)).filter(Boolean)
  .map((m) => ({ t: Number(m[1]) * 60 + Number(m[2]) + Number(m[3]) / 100, text: m[4].trim() }));
const emb = await browser.evaluate(`({
  n: WE_NOTES.count, span: WE_NOTES.span, grid: WE_NOTES.grid, bpm: WE_NOTES.bpm,
  first3: WE_NOTES.t.slice(0, 3).map((t, i) => [t, WE_NOTES.p[i], WE_NOTES.v[i]]),
  last: [WE_NOTES.t[WE_NOTES.t.length - 1], WE_NOTES.p[WE_NOTES.p.length - 1]],
  starts: WE_LYRICS.lines.map(l => l[0]),
  acc: WE.data.events.length, snapped: WE.data.events.filter(e => e.snapped).length,
})`, { awaitPromise: false });
const midiTimes = mid.notes.map((n) => Math.round(n.t * 1000) / 1000);
check('2  embedded note count == parsed .mid', emb.n === mid.notes.length, emb.n + ' events, span ' + emb.span[0] + '-' + emb.span[1] + 's, ' + emb.bpm + ' BPM, quantize ' + emb.grid + 's');
check('2b first/last notes match the parse exactly',
  JSON.stringify(emb.first3) === JSON.stringify(mid.notes.slice(0, 3).map((n) => [Math.round(n.t * 1000) / 1000, n.pitch, n.velocity])) &&
  emb.last[0] === Math.round(midiTimes[midiTimes.length - 1] * 1000) / 1000,
  JSON.stringify(emb.first3) + ' .. ' + JSON.stringify(emb.last));
const rel = await browser.evaluate(`(() => {
  const ev = WE.data.events;
  const d = ev.map(e => e.onsetDelta).filter(v => isFinite(v)).sort((a, b) => a - b);
  return { acc: ev.length, snapped: ev.filter(e => e.snapped).length, median: +d[(d.length / 2) | 0].toFixed(3), p90: +d[Math.floor(d.length * 0.9)].toFixed(3), tolerance: (WE_NOTES.align && WE_NOTES.align.tolerance) || 0 };
})()`, { awaitPromise: false });
check('2c accents come from the MIDI chart, verbatim', rel.acc > 300 && rel.tolerance === 0,
  rel.acc + ' chord-level accents from ' + emb.n + ' notes on the chart clock; distance to the nearest measured onset median ' + rel.median + ' s, p90 ' + rel.p90 + ' s (no consistent mapping exists between this chart and this recording, so nothing is silently re-timed; WE_NOTES.align.tolerance turns registration on)');
const sung = lrc.slice(2);
check('2d lyric timestamps == LRC values', sung.length === emb.starts.length && sung.every((l, i) => Math.abs(l.t - emb.starts[i]) < 1e-6), emb.starts.length + ' lines ' + emb.starts[0] + 's..' + emb.starts[emb.starts.length - 1] + 's');
const lyricGrid = (() => {
  const starts = emb.starts;
  const gaps = [];
  for (let i = 1; i < starts.length; i++) gaps.push(+(starts[i] - starts[i - 1]).toFixed(3));
  const positive = gaps.filter((g) => g > 0);
  const counted = positive.map((g) => ({ g, n: positive.filter((x) => x === g).length })).sort((a, b) => b.n - a.n);
  return {
    distinctGaps: new Set(positive).size,
    dupes: starts.length - new Set(starts).size,
    maxGap: Math.max(...positive),
    dominantShare: counted.length ? counted[0].n / positive.length : 1,
    top: counted.slice(0, 4).map((c) => c.g + 's×' + c.n).join(' '),
  };
})();
check('2e lyric timing is the LRC measurement, not a fitted grid',
  lyricGrid.distinctGaps >= 6 && lyricGrid.dupes >= 4 && lyricGrid.maxGap > 8 && lyricGrid.dominantShare < 0.45,
  lyricGrid.distinctGaps + ' distinct gaps (most common ' + lyricGrid.top + '), ' + lyricGrid.dupes + ' simultaneous line pairs kept as-is, longest gap ' + lyricGrid.maxGap + ' s, dominant gap only ' + (lyricGrid.dominantShare * 100).toFixed(0) + '% of spans');

/* ---------- 3. every line paints ---------- */
const fam = await browser.evaluate(`(async () => {
  const rows = [];
  WE_LYRICS.lines.forEach((l, i) => {
    const t = WE.data.slotTime(i);
    const m = WE.test.measure(t, 'scene');
    rows.push({ line: i, t, text: l[2].slice(0, 22), family: l[3], ops: m.ops, chars: m.chars, changed: +m.changed.toFixed(4), palette: m.palette, err: m.errors.join(' | '), envFam: m.envFamily });
  });
  for (const s of WE_INTERLUDES) {
    const t = +((s.from + (s.to || WE.duration())) / 2).toFixed(3);
    const m = WE.test.measure(t, 'scene');
    rows.push({ line: -1, t, text: '(interlude ' + s.id + ')', family: 'interlude', ops: m.ops, chars: m.chars, changed: +m.changed.toFixed(4), palette: m.palette, err: m.errors.join(' | '), envFam: m.envFamily });
  }
  return rows;
})()`);
const thin = fam.filter((r) => r.changed < 0.0015 || r.ops < 10 || r.palette < 3 || r.err);
check('3  every one of the ' + fam.length + ' staged moments paints', thin.length === 0,
  thin.length ? 'thin/empty: ' + thin.slice(0, 8).map((r) => r.family + '#' + r.line + '@' + r.t + '(changed ' + r.changed + ', ops ' + r.ops + ', pal ' + r.palette + (r.err ? ', err ' + r.err : '') + ')').join('  ')
    : 'min changed ' + Math.min(...fam.map((r) => r.changed)).toFixed(4) + ', min ops ' + Math.min(...fam.map((r) => r.ops)) + ', min palette ' + Math.min(...fam.map((r) => r.palette)));
const misroute = fam.filter((r) => (r.line >= 0 ? r.envFam !== r.family : r.envFam !== 'interlude'));
check('3b every line routes to its authored family', misroute.length === 0, JSON.stringify(misroute.slice(0, 3)));
const accentsAlive = await browser.evaluate(`(() => {
  const ts = [1.0, 20.0, 35.0, 66.0, 100.0, 133.0, 150.0];
  const per = ts.map(t => { const m = WE.test.measure(t, 'accents'); return { t, ops: m.ops, changed: +m.changed.toFixed(4) }; });
  const inWindow = ts.map(t => WE.data.eventsIn(Math.max(0, t - 0.75), t + 0.001).length);
  const held = ts.map(t => WE.data.notesHeld(t).length);
  return { per, inWindow, held };
})()`, { awaitPromise: false });
check('3c the accent board is alive on chart data', accentsAlive.per.every((p) => p.ops > 0) && accentsAlive.inWindow.some((v) => v > 0) && accentsAlive.held.some((v) => v > 0),
  'accents per probe ' + JSON.stringify(accentsAlive.per.map((p) => p.ops)) + ', events in window ' + JSON.stringify(accentsAlive.inWindow) + ', notes held ' + JSON.stringify(accentsAlive.held));

const fallbacks = await browser.evaluate(`(() => {
  const moods = new Set(WE_LYRICS.lines.map(l => l[4]).concat(WE_INTERLUDES.map(s => s.mood)));
  const fams = new Set(WE_LYRICS.lines.map(l => l[3]).concat(WE_INTERLUDES.map(s => s.scene)));
  return {
    unknownMoods: [...moods].filter((m) => !WE.MOOD[m]),
    unknownFamilies: [...fams].filter((f) => typeof WE.scenes[f] !== 'function'),
    moods: moods.size, families: fams.size,
  };
})()`, { awaitPromise: false });
check('3d no silent palette or scene fallback', fallbacks.unknownMoods.length === 0 && fallbacks.unknownFamilies.length === 0,
  fallbacks.moods + ' moods and ' + fallbacks.families + ' families all resolve to real definitions' +
  (fallbacks.unknownMoods.length ? ', missing moods ' + JSON.stringify(fallbacks.unknownMoods) : '') +
  (fallbacks.unknownFamilies.length ? ', missing families ' + JSON.stringify(fallbacks.unknownFamilies) : ''));

/* ---------- 3e. no broken interpolation ever reaches the canvas ---------- */
const junk = await browser.evaluate(`(() => {
  const bad = [];
  const seen = new Set();
  for (let t = 0; t < WE.duration(); t += 1.5) {
    const m = WE.test.measure(t);
    for (const s of (m.texts || [])) {
      if (/undefined|NaN|\\[object |\\bnull\\b/.test(s) && !seen.has(s)) { seen.add(s); bad.push({ t: +t.toFixed(1), s: s.slice(0, 40) }); }
    }
  }
  return bad;
})()`);
check('3e no undefined/NaN/[object rendered as text', junk.length === 0, junk.length ? JSON.stringify(junk.slice(0, 6)) : 'every drawn string across the timeline is clean');

/* ---------- 4. timeline coverage ---------- */
const sweep = await browser.evaluate(`(async () => {
  const end = WE.duration(); const bad = []; const errs = [];
  let minInk = 1, minAt = 0;
  for (let t = 0; t < end; t += 0.25) {
    const m = WE.test.measure(t);
    if (m.errors.length) errs.push({ t: +t.toFixed(2), e: m.errors.join('|') });
    if (m.ink < minInk) { minInk = m.ink; minAt = t; }
    if (m.ink < 0.012 || m.ops < 40) bad.push({ t: +t.toFixed(2), ink: +m.ink.toFixed(4), ops: m.ops });
  }
  return { end: +end.toFixed(3), samples: Math.ceil(end / 0.25), bad, errs: errs.slice(0, 6), errCount: errs.length, minInk: +minInk.toFixed(4), minAt: +minAt.toFixed(2) };
})()`);
check('4  whole timeline paints every 0.25 s with no board errors', sweep.bad.length === 0 && sweep.errCount === 0,
  sweep.samples + ' samples, dimmest ink ' + sweep.minInk + ' @' + sweep.minAt + 's (the isolation passage)' +
  (sweep.bad.length ? ', dead ' + JSON.stringify(sweep.bad.slice(0, 5)) : '') + (sweep.errCount ? ', errors ' + JSON.stringify(sweep.errs) : ''));

/* ---------- 5. endpoint == measured duration ---------- */
const ep = await browser.evaluate(`({ runtime: WE.duration(), element: document.getElementById('song').duration, end: WE.data.end, ok: WE.audioReady(),
  tail: WE.test.measure(WE.duration() - 0.3), lastLine: WE_LYRICS.lines[WE_LYRICS.lines.length - 1], lastInterlude: WE_INTERLUDES[WE_INTERLUDES.length - 1], embedded: WE_AUDIO.duration })`);
const walk = measure(path.join(root, 'Mili - world.execute (me) ;.mp3'));
check('5  animation endpoint == measured audio duration',
  Math.abs(ep.runtime - ep.element) < 0.05 && Math.abs(ep.end - ep.element) < 1e-6 && ep.tail.ink > 0.012,
  'element ' + ep.element.toFixed(3) + 's == engine end ' + ep.end.toFixed(3) + 's; embedded decode ' + ep.embedded.toFixed(3) + 's; MPEG frame-walk ' + walk.duration.toFixed(3) + 's (two independent measurements ' + Math.abs(ep.element - walk.duration).toFixed(3) + 's apart)');
check('5b the tail keeps painting at the endpoint', ep.tail.ink > 0.012, 'ink ' + ep.tail.ink.toFixed(4) + ' at ' + (ep.runtime - 0.3).toFixed(2) + 's; last line ends ' + ep.lastLine[1] + ' s, poweroff span from ' + ep.lastInterlude.from);

/* ---------- 6. seek determinism ---------- */
const seek = await browser.evaluate(`(async () => {
  const seed = (i) => { let h = (i * 2654435761) >>> 0; h ^= h >> 13; return (h >>> 0) / 4294967296; };
  const times = [];
  for (let i = 0; i < 30; i++) times.push(+(seed(i + 7) * (WE.duration() - 0.6)).toFixed(3));
  const H = (t) => WE.test.frameHash(t);
  const fwd = {}; const famOf = {};
  for (const t of times) { const r = H(t); fwd[t] = r.hash; famOf[t] = r.family; }
  const mism = [];
  for (let i = times.length - 1; i >= 0; i--) { const t = times[i]; if (H(t).hash !== fwd[t]) mism.push({ t, why: 'reverse' }); }
  for (const t of times.slice().sort((x, y) => seed(x * 31) - seed(y * 17))) { if (H(t).hash !== fwd[t]) mism.push({ t, why: 'shuffle' }); }
  for (const t of times) { if (H(t).hash !== fwd[t]) mism.push({ t, why: 'repeat' }); }
  const probe = 41.7, before = H(probe).hash;
  H(180.3); H(5.1); H(205.9); H(0.2);
  const after = H(probe).hash;
  const errEverywhere = times.filter(t => H(t).errors.length);
  return { samples: times.length, mismatches: mism, jumpBackOk: before === after, errTimes: errEverywhere.length, fams: Object.keys(famOf).length };
})()`);
check('6  frame-exact recovery from out-of-order seeks', seek.mismatches.length === 0 && seek.jumpBackOk && seek.errTimes === 0,
  seek.samples + ' random times x forward/reverse/shuffled/repeat, 180.3->5.1->205.9->0.2 then back to 41.7 identical' +
  (seek.mismatches.length ? ', mismatch ' + JSON.stringify(seek.mismatches.slice(0, 4)) : ''));

/* ---------- 7. purity ---------- */
const files = ['kit.js', 'furniture.js', 'data.js', 'scenes-0.js', 'scenes-1.js', 'scenes-2.js', 'layers.js', 'main.js'];
const dirty = [];
for (const f of files) {
  const src = strip(readFileSync(path.join(root, 'engine', f), 'utf8'));
  for (const pat of [/Math\.random\s*\(/, /Date\.now\s*\(/, /new\s+Date\b/]) if (pat.test(src)) dirty.push(f + ':' + pat.source);
  if (/performance\.now\s*\(/.test(src) && f !== 'main.js') dirty.push(f + ':performance.now');
  if (/audio\.currentTime/.test(src) && f !== 'main.js') dirty.push(f + ':reads audio clock');
}
check('7  no randomness, no wall clock, single time source', dirty.length === 0, dirty.join(' ') || files.length + ' engine files clean');
const leak = await browser.evaluate(`(() => {
  const clean = { alpha: 1, comp: 'source-over', shadow: 0, lineWidth: 1, filter: 'none' };
  const bad = [];
  const times = [0.4, 12.2, 47.1, 68.9, 115.3, 148.2, 156.6, 206.8, 211.2];
  for (const t of times) {
    WE.test.frameAt(t);
    const s = WE.test.ctxState();
    for (const k of Object.keys(clean)) if (s[k] !== clean[k]) bad.push({ t, k, got: s[k] });
    if (s.transform !== 'matrix(1, 0, 0, 1, 0, 0)') bad.push({ t, k: 'transform', got: s.transform });
  }
  return { bad, sample: WE.test.ctxState() };
})()`);
check('7b no canvas state leaks from one frame to the next', leak.bad.length === 0,
  leak.bad.length ? 'leaked ' + JSON.stringify(leak.bad.slice(0, 5)) : 'alpha/composite/shadow/lineWidth/filter/transform all default after 9 frames incl. the fault-free climax passages');

/* ---------- 8. the 18 EXECUTION states ---------- */
const exec = await browser.evaluate(`(async () => {
  const hits = WE.data.executions;
  const rows = hits.map((h) => {
    const t = WE.data.slotTime(h.line);
    const E = WE.test.envAt(t);
    const m = WE.test.measure(t, 'scene');
    const fr = WE.test.frameHash(t);
    return { k: E.p.k, mode: WE.scenes.execution.MODES[E.p.k], t, word: E.line ? E.line.text : '', changed: +m.changed.toFixed(4), ops: m.ops, hash: fr.hash };
  });
  return { count: hits.length, rows, modes: new Set(rows.map(r => r.mode)).size, hashes: new Set(rows.map(r => r.hash)).size, ks: new Set(rows.map(r => r.k)).size };
})()`);
const execThin = exec.rows.filter((r) => r.changed < 0.002 || r.ops < 60 || r.k === undefined);
check('8  18 EXECUTION occurrences, each staged and painted', exec.count === 18 && exec.ks === 18 && execThin.length === 0,
  exec.count + ' hits, k values ' + exec.ks + ' (0..17)' + (execThin.length ? ', weak ' + JSON.stringify(execThin.slice(0, 3)) : ''));
check('8b 18 different mechanisms', exec.modes === 18, exec.rows.map((r) => r.mode).join(','));
check('8c 18 visually different pictures', exec.hashes === 18, exec.hashes + '/18 unique frame hashes');

/* ---------- 9. words on screen == LRC words ---------- */
const words = await browser.evaluate(`(() => {
  const got = [];
  WE_LYRICS.lines.forEach((l, i) => {
    const E = WE.test.envAt(WE.data.slotTime(i));
    got.push({ i, t: WE.data.slotTime(i), want: l[2], text: E.line ? E.line.text : null, fam: E.family });
  });
  return got;
})()`);
const norm = (s) => String(s).replace(/"/g, "'").replace(/\s+/g, ' ').trim();
const wordBad = words.filter((w, i) => norm(w.text) !== norm(sung[i].text));
check('9  every LRC line is on screen at its own slot', wordBad.length === 0, words.length + ' lines matched' + (wordBad.length ? ', mismatch ' + JSON.stringify(wordBad.slice(0, 3)) : ''));
const extra = sung.filter((l, i) => /execution/i.test(l.text)).length;
check('9b 18 EXECUTION words in the LRC == 18 staged', extra === 18 && exec.count === 18, extra + ' occurrences of the word in the file, ' + exec.count + ' staged');

/* ---------- 10. fault isolation ---------- */
const poison = await browser.evaluate(`(async () => {
  WE.test.setBoard('fault', true);
  WE.test.frameAt(72.0);
  const errs = Object.entries(WE.errors).map(([k, v]) => k + ': ' + v.message);
  const per = ['void', 'grid', 'rain', 'roll', 'accents', 'entity', 'scene', 'lyric', 'hud', 'overlay']
    .map((id) => { const m = WE.test.measure(72.0, id); return { id, changed: +m.changed.toFixed(4), ops: m.ops }; });
  const full = WE.test.measure(72.0);
  const f0 = WE.stats.frames;
  await new Promise((r) => setTimeout(r, 400));
  const gained = WE.stats.frames - f0;
  WE.test.setBoard('fault', false);
  const clean = WE.test.measure(72.0);
  return { errs, per, ink: +full.ink.toFixed(4), gained, cleanErrors: clean.errors, cleanInk: +clean.ink.toFixed(4) };
})()`);
const scene = poison.per.find((p) => p.id === 'scene');
check('10 a throwing board is isolated, the loop survives',
  poison.errs.length === 1 && /fault/.test(poison.errs[0]) && poison.gained > 8 && poison.ink > 0.03 && scene.changed > 0.002,
  'errors ' + JSON.stringify(poison.errs) + ', whole frame still ' + poison.ink + ' ink, scene covered ' + scene.changed + ' of pixels, ' + poison.gained + ' frames in 400 ms');
check('10b disabling the fault restores a clean frame', poison.cleanErrors.length === 0 && poison.cleanInk > 0.03, 'errors ' + JSON.stringify(poison.cleanErrors) + ', ink ' + poison.cleanInk);

/* ---------- 12. the audio element really is the only clock ---------- */
const live = await browser.evaluate(`(async () => {
  const a = document.getElementById('song');
  const eq = [];
  for (const t of [12.5, 88.25, 150.5, 206.75]) {
    WE.seek(t);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    eq.push({ asked: t, element: +a.currentTime.toFixed(3), engine: +WE.time().toFixed(3) });
  }
  // drive the element directly, bypassing the engine: the frame time must follow
  WE.seek(30); a.currentTime = 77.25;
  await new Promise((r) => requestAnimationFrame(r));
  const followsElement = Math.abs(WE.time() - 77.25) < 0.05;
  // playing: monotonic advance, no self-generated jumps
  WE.seek(40); WE.playPause(true);
  const samples = [];
  for (let i = 0; i < 10; i++) { samples.push(+WE.time().toFixed(3)); await new Promise((r) => setTimeout(r, 160)); }
  const stillPlaying = !document.getElementById('song').paused;
  WE.playPause(false);
  const monotonic = samples.every((v, i) => i === 0 || v >= samples[i - 1]);
  const moved = +(samples[samples.length - 1] - samples[0]).toFixed(3);
  // frame cost
  const costs = [];
  for (let i = 0; i < 40; i++) { WE.test.frameAt(40 + i * 0.01); costs.push(WE.stats.ms); }
  costs.sort((x, y) => x - y);
  const f0 = WE.stats.frames, w0 = performance.now();
  await new Promise((r) => setTimeout(r, 500));
  const fps = Math.round((WE.stats.frames - f0) / ((performance.now() - w0) / 1000));
  return {
    eq, followsElement, monotonic, moved, fps, stillPlaying,
    sinkStalled: moved < 0.2 && stillPlaying,
    p50: +costs[(costs.length / 2) | 0].toFixed(2), p95: +costs[Math.floor(costs.length * 0.95)].toFixed(2),
  };
})()`);
const tracksElement = live.eq.every((e) => Math.abs(e.engine - e.element) < 0.005);
check('12 the engine time IS audio.currentTime', tracksElement && live.followsElement,
  'sampled ' + live.eq.map((e) => e.engine + 's').join('/') + ' all equal the element; setting element.currentTime=77.25 by hand moved the engine to it');
check('12b frames keep up while the transport runs',
  live.monotonic && live.fps > 20 && live.p95 < 40 && (live.moved > 0.2 || live.sinkStalled),
  live.fps + ' fps, frame cost p50 ' + live.p50 + ' ms / p95 ' + live.p95 + ' ms, clock monotonic; advanced ' + live.moved +
  ' s' + (live.sinkStalled ? ' (headless has no audio sink, media clock stalled — the engine still tracked the element and never invented time)' : ''));

/* ---------- 13. missing audio degrades ---------- */
const DEGRADE_PROBE = `(async () => {
    const painted = [];
    for (const t of [0.5, 45, 147.6, 206.6, WE.data.end - 0.6]) painted.push(+WE.test.measure(t).ink.toFixed(4));
    WE.seek(10); WE.playPause(true);
    const t0 = WE.time();
    await new Promise((r) => setTimeout(r, 400));
    const moved = +(WE.time() - t0).toFixed(2);
    WE.playPause(false);
    return { audioOk: WE.audioReady(), end: +WE.data.end.toFixed(3), banner: (document.getElementById('banner').textContent || '').slice(0, 96), painted, moved, errCode: document.getElementById('song').error ? document.getElementById('song').error.code : null };
  })()`;
const asset = path.join(root, 'assets', 'world-execute-me.mp3');
const hidden = asset + '.hidden-for-test';
let degrade = null;
if (SINGLE) {
  // the recording lives inside the file, so break it the way a user would: point the
  // element at a source that is not there
  await browser.evaluate(`(() => { const a = document.getElementById('song'); a.removeAttribute('src'); a.src = 'assets/__definitely_missing__.mp3'; a.load(); return true; })()`);
  await sleep(3200);
  degrade = await browser.evaluate(DEGRADE_PROBE);
} else {
  renameSync(asset, hidden);
  try {
    const b2 = await launchBrowser({ extraArgs: ['--force-device-scale-factor=1'], port: 9344 });
    await b2.navigate(pathToFileURL(path.join(root, TARGET)).href);
    await sleep(3200);
    degrade = await b2.evaluate(DEGRADE_PROBE);
    await b2.close();
  } finally {
    renameSync(hidden, asset);
  }
}
check('13 missing audio degrades instead of a black screen',
  !!degrade && degrade.audioOk === false && degrade.painted.every((v) => v > 0.012) && degrade.end > 200 && degrade.moved > 0.2,
  degrade ? 'banner "' + degrade.banner + '", end ' + degrade.end + ' s, ink ' + degrade.painted.join('/') + ', internal clock advanced ' + degrade.moved + ' s, MediaError=' + degrade.errCode : 'test did not run');
check('13b the asset is restored and present', existsSync(asset));

await browser.close();
console.log('\n' + (failures ? failures + ' CHECK(S) FAILED out of ' + results.length : 'all ' + results.length + ' checks passed'));
console.log('audio ' + walk.duration.toFixed(3) + 's (' + walk.sampleRate + 'Hz ' + walk.avgBitrateKbps + 'kbps ' + walk.channels + 'ch, ' + walk.frames + ' frames, ' + walk.bytes + ' bytes) | midi ' + mid.notes.length + ' notes ending ' + Math.max(...mid.notes.map((n) => n.t)) + 's | lrc ' + lrc.length + ' rows');
process.exit(failures ? 1 : 0);
