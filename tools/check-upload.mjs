/* check-upload.mjs — prove the hand-upload folder/zip is exactly the audited commit
 * and contains no third-party work.  node tools/check-upload.mjs
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const up = path.join(root, '..', 'world-execute-me-animation-upload');
const zip = path.join(root, '..', 'world-execute-me-animation-src.zip');

function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

const tracked = execSync('git ls-files', { cwd: root, encoding: 'utf8' }).trim().split('\n').sort();
const files = walk(up).map((p) => path.relative(up, p).replace(/\\/g, '/')).sort();

let fail = 0;
const say = (ok, msg) => { if (!ok) fail++; console.log((ok ? 'ok    ' : 'FAIL  ') + msg); };

say(JSON.stringify(tracked) === JSON.stringify(files),
  `file list matches the commit exactly (${tracked.length} files)`);
if (JSON.stringify(tracked) !== JSON.stringify(files)) {
  console.log('   only in git:', tracked.filter((t) => !files.includes(t)).join(', '));
  console.log('   only in dir:', files.filter((f) => !tracked.includes(f)).join(', '));
}

// default ls-tree format is "<mode> blob <sha>\t<path>" — no format string needed
const tree = new Map(execSync('git ls-tree -r HEAD', { cwd: root, encoding: 'utf8' })
  .trim().split('\n').map((line) => {
    const [meta, p] = line.split('\t');
    const parts = meta.split(' ');
    return [p.replace(/\\/g, '/'), parts[2]];
  }));
const sha1Blob = (buf) => crypto.createHash('sha1')
  .update(`blob ${buf.length}\u0000`).update(buf).digest('hex');

const bad = [];
for (const f of tracked) {
  const want = tree.get(f);
  if (!want) { bad.push(f + ' (not in HEAD)'); continue; }
  if (sha1Blob(readFileSync(path.join(up, f))) !== want) bad.push(f);
}
say(bad.length === 0, bad.length ? 'content differs for: ' + bad.join(', ') : `every file is byte-identical to its git blob (${tree.size} blobs compared)`);

const risky = files.filter((f) => /\.(mp3|mid|midi|lrc|png|jpg|jpeg|gif|webp|wav|ogg|ttf|otf|woff2?)$/i.test(f)
  || /^(data|assets)\//.test(f)
  || /world-execute-me\.html$|audio-analysis\.json$|midi-notes\.json$|ip-audit-report\.json$/.test(f));
say(risky.length === 0, risky.length ? 'third-party work present: ' + risky.join(', ') : 'no audio / MIDI / lyrics / generated data / build output');

say(existsSync(zip), `zip present: ${path.basename(zip)} (${(readFileSync(zip).length / 1024).toFixed(0)} KB)`);
const head = execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf8' }).trim();
console.log(`\nfolder: ${up}\nzip   : ${zip}\ncommit: ${head}  (repo tsingxv/world-execute-me-animation, private, still empty)`);
console.log(fail ? `\n${fail} problem(s)` : `\nupload set verified: ${files.length} files, nothing copyrighted`);
process.exit(fail ? 1 : 0);
