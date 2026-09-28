import { launchBrowser } from './cdp.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const page = process.argv[2] || 'salience.html';
const name = process.argv[3] || 'analysis-result.json';
const browser = await launchBrowser();
await browser.navigate(path.join(here, page));
const poll = `(async () => { for (let i = 0; i < 9000; i++) { if (window.__done) return window.__result; await new Promise(r => setTimeout(r, 100)); } return {error:'timeout', dom: document.getElementById('out') && document.getElementById('out').textContent}; })()`;
let res;
try {
  res = await browser.evaluate(poll, { timeoutMs: 900000 });
} catch (e) {
  res = { error: String(e), dom: await browser.evaluate('document.getElementById("out").textContent', { awaitPromise: false }).catch(() => '?') };
}
await browser.close();
await fs.writeFile(path.join(here, name), JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1).slice(0, 4000));
