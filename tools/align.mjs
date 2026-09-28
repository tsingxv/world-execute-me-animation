import { launchBrowser } from './cdp.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await launchBrowser();
await browser.navigate(path.join(here, 'align.html'));
const poll = `(async () => { for (let i = 0; i < 3000; i++) { if (window.__done) return window.__result; await new Promise(r => setTimeout(r, 100)); } return {error:'timeout'}; })()`;
const res = await browser.evaluate(poll, { timeoutMs: 400000 });
await browser.close();
await fs.writeFile(path.join(here, 'align-result.json'), JSON.stringify(res, null, 1));
console.log(JSON.stringify({ audio: res.audio, midi: res.midi, alignment: res.alignment, tempo: res.tempo, error: res.error }, null, 1));
if (res.recPer4s) {
  console.log('rec  per4s:', res.recPer4s.join(','));
  console.log('midi per4s:', res.midPer4s.join(','));
  console.log('rms5s     :', res.rms5s.map((r) => r.t + ':' + r.v).join(' '));
}
