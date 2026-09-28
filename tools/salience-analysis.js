/* Find the mapping MIDI-time -> recording-time that maximises onset salience.
   score(scale, offset) = sum over MIDI note onsets of smoothedFlux(offset + scale*t)
   Also fits the mapping per 40 s window to reveal tempo drift. */
(async function () {
  const out = document.getElementById('out');
  const say = (s) => { out.textContent = s; };
  window.__done = false; window.__result = null;
  try {
    const midi = await (await fetch('midi-notes.json')).json();
    const onsets = [...new Set(midi.notes.map((p) => +p.t.toFixed(3)))].sort((a, b) => a - b);
    const mp3 = await (await fetch('../Mili - world.execute (me) ;.mp3')).arrayBuffer();
    const ac = new AudioContext();
    const audio = await ac.decodeAudioData(mp3.slice(0));
    const sr = audio.sampleRate, n = audio.length, dur = audio.duration;
    const chs = audio.numberOfChannels;
    const x = new Float32Array(n);
    for (let c = 0; c < chs; c++) { const d = audio.getChannelData(c); for (let i = 0; i < n; i++) x[i] += d[i] / chs; }

    function makeFFT(win) {
      const bits = Math.round(Math.log2(win));
      const rev = new Uint32Array(win);
      for (let i = 0; i < win; i++) { let r = 0, v = i; for (let b = 0; b < bits; b++) { r = (r << 1) | (v & 1); v >>= 1; } rev[i] = r; }
      const cosT = new Float64Array(win / 2), sinT = new Float64Array(win / 2);
      for (let k = 0; k < win / 2; k++) { cosT[k] = Math.cos(-2 * Math.PI * k / win); sinT[k] = Math.sin(-2 * Math.PI * k / win); }
      const re = new Float64Array(win), im = new Float64Array(win);
      return function (buf, off, mag) {
        for (let i = 0; i < win; i++) { re[i] = buf[off + i]; im[i] = 0; }
        for (let i = 0; i < win; i++) { const j = rev[i]; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
        for (let size = 2; size <= win; size <<= 1) {
          const half = size >> 1, step = win / size;
          for (let i = 0; i < win; i += size) {
            for (let j = i, k = 0; j < i + half; j++, k += step) {
              const co = cosT[k], si = sinT[k];
              const lre = re[j], lim = im[j];
              const kre = re[j + half] * co - im[j + half] * si;
              const kim = re[j + half] * si + im[j + half] * co;
              re[j] = lre + kre; im[j] = lim + kim;
              re[j + half] = lre - kre; im[j + half] = lim - kim;
            }
          }
        }
        for (let k = 0; k < win / 2; k++) mag[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      };
    }

    const win = 2048, hop = 512; // 9.38 ms analysis grid @48k
    const hopSec = hop / sr;
    const hann = new Float32Array(win);
    for (let i = 0; i < win; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (win - 1));
    const pre = new Float32Array(n + win);
    for (let i = 0; i < n; i++) pre[i] = x[i];
    const fft = makeFFT(win);
    const mag = new Float32Array(win / 2);
    const prev = new Float32Array(win / 2);
    const frames = Math.max(1, Math.floor((n - win) / hop) + 1);
    const flux = new Float32Array(frames);
    for (let f = 0; f < frames; f++) {
      const off = f * hop;
      for (let i = 0; i < win; i++) pre[off + i] = x[off + i] * hann[i];
      fft(pre, off, mag);
      let s = 0;
      for (let k = 0; k < win / 2; k++) { const d = mag[k] - prev[k]; if (d > 0) s += d; prev[k] = mag[k]; }
      flux[f] = s;
    }
    let mx = 0; for (let i = 0; i < frames; i++) if (flux[i] > mx) mx = flux[i];
    for (let i = 0; i < frames; i++) flux[i] /= mx || 1;

    // smooth +- 3 frames (~28 ms) so small errors still score
    const R = 3;
    const sm = new Float32Array(frames);
    for (let i = 0; i < frames; i++) {
      let s = 0, c = 0;
      for (let j = Math.max(0, i - R); j <= Math.min(frames - 1, i + R); j++) { s += flux[j]; c++; }
      sm[i] = s / c;
    }
    function score(scale, offset, list) {
      let acc = 0, used = 0;
      for (let i = 0; i < list.length; i++) {
        const f = Math.round(offset / hopSec + (scale * list[i]) / hopSec);
        if (f < 0 || f >= frames) continue;
        acc += sm[f]; used++;
      }
      return used ? acc / used : 0;
    }
    function search(list, scales, offsets) {
      let best = { scale: 1, offset: 0, s: -1 };
      for (const sc of scales) for (const of of offsets) {
        const s = score(sc, of, list);
        if (s > best.s) best = { scale: sc, offset: of, s };
      }
      return best;
    }
    const coarseScales = [], coarseOffsets = [];
    for (let s = 0.88; s <= 1.1601; s += 0.002) coarseScales.push(+s.toFixed(4));
    for (let o = -8; o <= 8.001; o += 0.1) coarseOffsets.push(+o.toFixed(3));
    const all = onsets;
    const g = search(all, coarseScales, coarseOffsets);
    const fineScales = [], fineOffsets = [];
    for (let s = g.scale - 0.0021; s <= g.scale + 0.0021; s += 0.0001) fineScales.push(+s.toFixed(5));
    for (let o = g.offset - 0.11; o <= g.offset + 0.11; o += 0.005) fineOffsets.push(+o.toFixed(4));
    const gf = search(all, fineScales, fineOffsets);

    const base = score(1, 0, all);
    // per-window local fit, scale fixed to global, offset free
    const windows = [];
    for (let a = 0; a < 160; a += 20) {
      const list = onsets.filter((t) => t >= a && t < a + 20);
      if (list.length < 20) { windows.push({ from: a, skipped: list.length }); continue; }
      const offs = [];
      for (let o = -4; o <= 4.001; o += 0.02) offs.push(+o.toFixed(3));
      const b = search(list, [gf.scale], offs);
      windows.push({ from: a, to: a + 20, n: list.length, offset: b.offset, s: +b.s.toFixed(4), atZero: +score(gf.scale, 0, list).toFixed(4) });
    }
    // free scale per window too
    const windowsFree = [];
    for (let a = 0; a < 160; a += 40) {
      const list = onsets.filter((t) => t >= a && t < a + 40);
      const sc = [];
      for (let s = gf.scale - 0.02; s <= gf.scale + 0.0201; s += 0.0005) sc.push(+s.toFixed(5));
      const offs = [];
      for (let o = -4; o <= 4.001; o += 0.02) offs.push(+o.toFixed(3));
      const b = search(list, sc, offs);
      windowsFree.push({ from: a, to: a + 40, n: list.length, scale: +b.scale.toFixed(5), offset: +b.offset.toFixed(3), s: +b.s.toFixed(4) });
    }
    window.__result = {
      audio: { duration: +dur.toFixed(3), sampleRate: sr, hopSec: +hopSec.toFixed(5), frames },
      onsetsUnique: onsets.length,
      identityScore: +base.toFixed(4),
      globalCoarse: { scale: +g.scale.toFixed(5), offset: +g.offset.toFixed(3), score: +g.s.toFixed(4) },
      globalFine: { scale: +gf.scale.toFixed(5), offset: +gf.offset.toFixed(4), score: +gf.s.toFixed(4) },
      impliedBpmFromMidiGrid: +(120 / gf.scale).toFixed(2),
      windows, windowsFree,
    };
    say('DONE');
  } catch (e) {
    window.__result = { error: String((e && e.stack) || e) };
    say('ERR ' + e);
  }
  window.__done = true;
})();
