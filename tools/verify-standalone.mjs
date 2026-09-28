/* verify-standalone.mjs — copy the single file into an EMPTY directory and prove it runs
 * there with nothing else present. node tools/verify-standalone.mjs
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync, mkdtempSync, copyFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { launchBrowser, sleep } from './cdp.mjs';

const require = createRequire(import.meta.url);
const { measure } = require('./mp3.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = mkdtempSync(path.join(tmpdir(), 'we-standalone-'));
let failures = 0;
const say = (ok, name, detail) => { if (!ok) failures++; console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail ? '   — ' + detail : '')); };

try {
  copyFileSync(path.join(root, 'world-execute-me.html'), path.join(dir, 'world-execute-me.html'));
  console.log('isolated copy in ' + dir + ' containing: ' + readdirSync(dir).join(', '));

  const b = await launchBrowser({ extraArgs: ['--force-device-scale-factor=1'] });
  await b.navigate(pathToFileURL(path.join(dir, 'world-execute-me.html')).href);
  await sleep(1500);

  const r = await b.evaluate(`(async () => {
    const errs = [];
    window.addEventListener('error', (e) => errs.push(String(e.message)));
    const painted = [];
    for (const t of [1.2, 30.5, 68.5, 115.8, 147.6, 167.3, 206.9, WE.duration() - 0.4]) painted.push({ t: +t.toFixed(1), ink: +WE.test.measure(t).ink.toFixed(4) });
    const hashes = [41.7, 41.7].map(() => 0);
    const a = document.getElementById('song');
    a.currentTime = 120;
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    return {
      single: !!window.WE_SINGLE,
      src: a.currentSrc.slice(0, 12),
      duration: +WE.duration().toFixed(3),
      audioOk: WE.audioReady(),
      engineTracks: Math.abs(WE.time() - 120) < 0.05,
      painted,
      seeked: +a.currentTime.toFixed(2),
      frameErrors: Object.keys(WE.errors),
      jsErrors: errs,
      files: 0,
    };
  })()`);

  const walk = measure(path.join(root, 'Mili - world.execute (me) ;.mp3'));
  say(existsSync(path.join(dir, 'world-execute-me.html')) && readdirSync(dir).length === 1, 'S1 the directory holds only the html file', readdirSync(dir).join(', '));
  say(r.single && /^blob:/.test(r.src), 'S2 audio came from the embedded bytes, not a sibling file', r.src + '…, WE_SINGLE present');
  say(Math.abs(r.duration - walk.duration) < 0.2 && r.audioOk, 'S3 embedded recording decodes to the measured length',
    r.duration.toFixed(3) + ' s vs frame-walk ' + walk.duration.toFixed(3) + ' s');
  say(r.painted.every((p) => p.ink > 0.012), 'S4 every sampled moment paints in isolation', r.painted.map((p) => p.t + 's:' + p.ink).join('  '));
  say(r.engineTracks && Math.abs(r.seeked - 120) < 0.05, 'S5 seeking the embedded audio moves the animation', 'currentTime 120 -> engine ' + r.engineTracks);
  say(r.frameErrors.length === 0 && r.jsErrors.length === 0, 'S6 no page or board errors', JSON.stringify(r.frameErrors) + JSON.stringify(r.jsErrors));

  // byte-exact determinism in the isolated copy too
  const det = await b.evaluate(`(() => {
    const order1 = [5.5, 99.9, 33.3].map((t) => WE.test.frameHash(t).hash);
    const order2 = [33.3, 5.5, 99.9].map((t) => WE.test.frameHash(t).hash);
    const again = [5.5, 99.9, 33.3].map((t) => WE.test.frameHash(t).hash);
    return { a: order1.join('|'), b: order2.map((h, i) => h).join('|'), c: again.join('|') };
  })()`);
  say(det.a === det.c, 'S7 repeated renders are byte-identical', 'same order twice');
  say(det.a.split('|')[2] === det.b.split('|')[0], 'S8 order of prior seeks does not matter', '33.3 identical whether drawn 1st or 3rd');
  await b.close();
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log('\n' + (failures ? failures + ' STANDALONE CHECK(S) FAILED' : 'standalone single file runs alone: all checks passed'));
process.exit(failures ? 1 : 0);
