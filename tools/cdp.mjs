/* Zero-dependency Chrome DevTools Protocol driver (verification tooling only).
   Launches headless Chrome with --allow-file-access-from-files so a local
   file:// page can fetch sibling media, then evaluates expressions / screenshots.
   Needs a Chrome or Edge binary (CHROME_PATH overrides). Node >= 18 for global WebSocket. */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Chromium/Application/chromium.exe',
];

export function findChrome() {
  return CANDIDATES.filter(Boolean).find((p) => existsSync(p)) || null;
}

export function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

export async function exists(p) {
  try { await fs.access(p); return true; } catch (e) { return false; }
}

export async function launchBrowser({ binary, extraArgs = [], port = 9333, width = 1280, height = 720, allowFileAccess = true } = {}) {
  const bin = binary || findChrome();
  if (!bin) throw new Error('no Chrome/Edge binary found (set CHROME_PATH)');
  const udd = await fs.mkdtemp(path.join(os.tmpdir(), 'we-cdp-'));
  const args = [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${udd}`,
    `--window-size=${width},${height}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-features=Translate',
    '--autoplay-policy=no-user-gesture-required',
    '--mute-audio',
  ];
  if (allowFileAccess) args.push('--allow-file-access-from-files');
  args.push('about:blank');

  const child = spawn(bin, args, { stdio: 'ignore' });
  const baseURL = `http://127.0.0.1:${port}`;

  let target = null;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline && !target) {
    try {
      const res = await fetch(`${baseURL}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' });
      if (res.ok) target = await res.json();
    } catch (e) { await sleep(250); }
    if (!target) await sleep(250);
  }
  if (!target) { try { child.kill('SIGKILL'); } catch (e) {} throw new Error('devtools endpoint never came up'); }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error('websocket connect failed'));
    setTimeout(() => reject(new Error('websocket open timeout')), 10000);
  });

  const cdp = new CDP(ws, child, udd, target);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  return cdp;
}

class CDP {
  constructor(ws, child, userDataDir, target) {
    this.ws = ws; this.child = child; this.userDataDir = userDataDir; this.target = target;
    this.id = 0; this.pending = new Map(); this.listeners = [];
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data)); } catch (e) { return; }
      if (msg.id != null && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message + ' ' + JSON.stringify(msg.error.data || {}))) : resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners) fn(msg);
      }
    };
  }

  send(method, params = {}, timeoutMs = 60000) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('CDP timeout: ' + method)); }
      }, timeoutMs).unref?.();
    });
  }

  on(fn) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter((x) => x !== fn); }; }

  async navigate(target) {
    const url = /^(https?|file):/.test(target) ? target : pathToFileURL(target).href;
    const loaded = new Promise((resolve) => {
      const off = this.on((m) => { if (m.method === 'Page.loadEventFired') { off(); resolve(); } });
      setTimeout(() => { off(); resolve(); }, 20000);
    });
    await this.send('Page.navigate', { url });
    await loaded;
    await sleep(150);
    return url;
  }

  async evaluate(expression, { awaitPromise = true, timeoutMs = 120000 } = {}) {
    const r = await this.send('Runtime.evaluate', {
      expression, awaitPromise, returnByValue: true, timeout: timeoutMs,
    }, timeoutMs + 10000);
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error('page exception: ' + ((d.exception && d.exception.description) || d.text));
    }
    if (r.result && r.result.subtype === 'error') throw new Error('threw: ' + r.result.description);
    return r.result.value;
  }

  async screenshot(clip) {
    const params = { format: 'png' };
    if (clip) params.clip = { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale: 1 };
    const r = await this.send('Page.captureScreenshot', params);
    return Buffer.from(r.data, 'base64');
  }

  async close() {
    try { await this.send('Browser.close', {}, 5000); } catch (e) {}
    try { this.ws.close(); } catch (e) {}
    try { this.child.kill('SIGKILL'); } catch (e) {}
    await sleep(200);
    try { await fs.rm(this.userDataDir, { recursive: true, force: true }); } catch (e) {}
  }
}
