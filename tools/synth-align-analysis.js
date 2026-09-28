/* Decisive alignment test: render the MIDI to audio (additive piano-ish synth),
   compute the same log-band energy matrix for both signals, then search the
   (scale, offset) mapping that maximises band-energy correlation. A real match
   shows a sharp peak; noise shows a flat ridge. */
(async function () {
  const out = document.getElementById('out');
  const say = (s) => { out.textContent = s; };
  window.__done = false; window.__result = null;
  try {
    const midi = await (await fetch('midi-notes.json')).json();
    const mp3 = await (await fetch('../Mili - world.execute (me) ;.mp3')).arrayBuffer();
    const ac = new AudioContext();
    const audio = await ac.decodeAudioData(mp3.slice(0));
    const sr = audio.sampleRate, n = audio.length, dur = audio.duration;
    const chs = audio.numberOfChannels;
    const rec = new Float32Array(n);
    for (let c = 0; c < chs; c++) { const d = audio.getChannelData(c); for (let i = 0; i < n; i++) rec[i] += d[i] / chs; }

    // ---- synth the MIDI ----
    const synthLen = Math.ceil((midi.notes[midi.notes.length - 1].t + 2) * sr);
    const syn = new Float32Array(synthLen);
    for (const nt of midi.notes) {
      const f0 = 440 * Math.pow(2, (nt.p - 69) / 12);
      const start = Math.round(nt.t * sr);
      const len = Math.max(1, Math.round(Math.min(nt.dur || 0.3, 1.2) * sr)) + Math.round(0.12 * sr);
      const amp = (nt.v / 127) * 0.25;
      for (let h = 1; h <= 6; h++) {
        const fh = f0 * h;
        if (fh > sr / 2) break;
        const ha = amp / (h * 1.6);
        const w = 2 * Math.PI * fh / sr;
        for (let i = 0; i < len; i++) {
          const j = start + i;
          if (j >= synthLen) break;
          const env = Math.exp(-i / (0.35 * sr)) * (1 - Math.exp(-i / (0.004 * sr)));
          syn[j] += ha * env * Math.sin(w * i);
        }
      }
    }
    say('synth done ' + (synthLen / sr).toFixed(1) + 's');

    // ---- shared band-energy analyser ----
    function makeFFT(win) {
      const bits = Math.round(Math.log2(win));
      const rev = new Uint32Array(win);
      for (let i = 0; i < win; i++) { let r = 0, v = i; for (let b = 0; b < bits; b++) { r = (r << 1) | (v & 1); v >>= 1; } rev[i] = r; }
      const cosT = new Float64Array(win / 2), sinT = new Float64Array(win / 2);
      for (let k = 0; k < win / 2; k++) { cosT[k] = Math.cos(-2 * Math.PI * k / win); sinT[k] = Math.sin(-2 * Math.PI * k / win); }
      const re = new Float64Array(win), im = new Float64Array(win);
      return function (buf, off, mag) {
        for (let i = 0; i < win; i++) { re[i] = buf[off + i] || 0; im[i] = 0; }
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
    const win = 2048, hop = 512, hopSec = hop / sr, NB = 10;
    const edges = [];
    for (let b = 0; b <= NB; b++) edges.push(90 * Math.pow(16, b / NB)); // 90 Hz .. 1440 Hz log spaced
    const binEdges = edges.map((f) => Math.round(f / (sr / win)));
    const hann = new Float32Array(win);
    for (let i = 0; i < win; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (win - 1));
    const fft = makeFFT(win);
    const mag = new Float32Array(win / 2);

    function bands(buf, totalLen) {
      const frames = Math.max(1, Math.floor((totalLen - win) / hop) + 1);
      const m = new Float32Array(frames * NB);
      const padded = new Float32Array(totalLen);
      padded.set(buf.subarray(0, totalLen));
      for (let fr = 0; fr < frames; fr++) {
        const off = fr * hop;
        for (let i = 0; i < win; i++) mag[i] = 0;
        // windowed FFT into scratch
        const scratch = new Float32Array(win);
        for (let i = 0; i < win; i++) scratch[i] = padded[off + i] * hann[i];
        fft(scratch, 0, mag);
        for (let b = 0; b < NB; b++) {
          let acc = 0, cnt = 0;
          for (let k = binEdges[b]; k < binEdges[b + 1]; k++) { acc += mag[k]; cnt++; }
          m[fr * NB + b] = cnt ? acc / cnt : 0;
        }
      }
      // per-band normalisation to p99
      for (let b = 0; b < NB; b++) {
        const col = [];
        for (let fr = 0; fr < frames; fr++) col.push(m[fr * NB + b]);
        const s = col.slice().sort((a, x) => a - x);
        const p = s[Math.floor(s.length * 0.99)] || 1;
        for (let fr = 0; fr < frames; fr++) m[fr * NB + b] = m[fr * NB + b] / p;
      }
      return { m, frames };
    }
    say('band matrices');
    const recB = bands(rec, n);
    const synB = bands(syn, synthLen);
    say('corr search');

    // sample every 4th synth frame to keep it fast
    const idx = [];
    for (let f = 0; f < synB.frames; f += 4) idx.push(f);
    function score(scale, offset) {
      let acc = 0, cnt = 0;
      for (let q = 0; q < idx.length; q++) {
        const f = idx[q];
        const rf = Math.round((offset + scale * (f * hopSec)) / hopSec);
        if (rf < 0 || rf >= recB.frames) continue;
        let dot = 0, sa = 0, sb = 0;
        for (let b = 0; b < NB; b++) {
          const a = synB.m[f * NB + b], r = recB.m[rf * NB + b];
          dot += a * r; sa += a * a; sb += r * r;
        }
        acc += dot / (Math.sqrt(sa * sb) || 1);
        cnt++;
      }
      return cnt ? acc / cnt : 0;
    }
    const grid = [];
    for (let sc = 0.90; sc <= 1.1001; sc += 0.002) {
      for (let of = -3; of <= 3.001; of += 0.05) grid.push({ scale: +sc.toFixed(4), offset: +of.toFixed(3), s: score(sc, of) });
    }
    grid.sort((a, b) => b.s - a.s);
    const best = grid[0];
    const fscore = grid.map((g) => g.s);
    const gmean = fscore.reduce((a, b) => a + b, 0) / fscore.length;
    const gsd = Math.sqrt(fscore.reduce((a, b) => a + (b - gmean) ** 2, 0) / fscore.length);
    // refine around best
    const fine = [];
    for (let sc = best.scale - 0.002; sc <= best.scale + 0.0021; sc += 0.0002) {
      for (let of = best.offset - 0.06; of <= best.offset + 0.061; of += 0.005) fine.push({ scale: +sc.toFixed(5), offset: +of.toFixed(4), s: score(sc, of) });
    }
    fine.sort((a, b) => b.s - a.s);
    // phase drift: best offset per 30 s of synth time, scale fixed to fine best
    const seg = [];
    const bestScale = fine[0].scale;
    for (let a = 0; a + 30 <= synthLen / sr; a += 30) {
      const sub = idx.filter((f) => f * hopSec >= a && f * hopSec < a + 30);
      function segScore(offset) {
        let acc = 0, cnt = 0;
        for (const f of sub) {
          const rf = Math.round((offset + bestScale * (f * hopSec)) / hopSec);
          if (rf < 0 || rf >= recB.frames) continue;
          let dot = 0, sa = 0, sb = 0;
          for (let b = 0; b < NB; b++) { const x1 = synB.m[f * NB + b], y1 = recB.m[rf * NB + b]; dot += x1 * y1; sa += x1 * x1; sb += y1 * y1; }
          acc += dot / (Math.sqrt(sa * sb) || 1); cnt++;
        }
        return cnt ? acc / cnt : 0;
      }
      let bb = { offset: 0, s: -9 };
      for (let of = -1.5; of <= 1.5001; of += 0.01) { const s = segScore(of); if (s > bb.s) bb = { offset: +of.toFixed(3), s }; }
      seg.push({ from: a, to: a + 30, n: sub.length, ...bb, s3: +bb.s.toFixed(4), atZero: +segScore(0).toFixed(4) });
    }
    window.__result = {
      audio: { duration: +dur.toFixed(3), sampleRate: sr, hopSec: +hopSec.toFixed(5), recFrames: recB.frames, synthFrames: synB.frames, synthSeconds: +(synthLen / sr).toFixed(2) },
      search: { gridMean: +gmean.toFixed(4), gridSd: +gsd.toFixed(4), top: grid.slice(0, 10).map((g) => ({ scale: g.scale, offset: g.offset, s: +g.s.toFixed(4) })), best: { scale: best.scale, offset: best.offset, s: +best.s.toFixed(4) } },
      refined: fine.slice(0, 5).map((g) => ({ scale: g.scale, offset: g.offset, s: +g.s.toFixed(4) })),
      impliedRecordingBpm: +(120 / bestScale).toFixed(2),
      phaseSegments: seg,
    };
    say('DONE');
  } catch (e) {
    window.__result = { error: String((e && e.stack) || e) };
    say('ERR ' + e);
  }
  window.__done = true;
})();
