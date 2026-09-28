import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchBrowser } from './cdp.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'tools', 'shots');
mkdirSync(outDir, { recursive: true });
const times = process.argv.slice(2).map(Number);
const list = times.length ? times : [1.4, 6, 9, 20, 31, 38, 45, 50, 56, 63, 68.6, 71.5, 82, 86, 92, 101, 108, 113, 116, 121, 130, 140, 147.5, 150.5, 153.5, 156.2, 158, 161.5, 167, 174, 180, 185, 190, 197, 207, 210.5];
const b = await launchBrowser({ extraArgs: ['--force-device-scale-factor=1'], width: 1280, height: 720 });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await b.navigate(pathToFileURL(path.join(root, 'index.html')).href);
await b.evaluate(`document.getElementById('boot').style.display = 'none';`, { awaitPromise: false });
for (const t of list) {
  await b.evaluate(`WE.seek(${t}); WE.test.frameAt(${t});`, { awaitPromise: false });
  const png = await b.screenshot();
  const name = 't' + String(t).replace('.', '_').padStart(6, '0') + '.png';
  writeFileSync(path.join(outDir, name), png);
  const info = await b.evaluate(`(() => { const E = WE.buildEnv(${t}); return { fam: E.family, line: E.line && E.line.text, mood: E.mood, k: E.p && E.p.k }; })()`, { awaitPromise: false });
  console.log(name, JSON.stringify(info));
}
await b.close();
console.log('shots ->', outDir);
