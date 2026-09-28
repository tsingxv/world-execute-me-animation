/* Pitch-domain alignment: build a per-MIDI-pitch harmonic energy curve from the
   recording, then find the (scale, offset) that best lands MIDI notes on real
   piano energy. Far more discriminative than onset salience alone. */
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

    const win = 4096, hop = 1024, hopSec = hop / sr;
    const binHz = sr / win;
    const hann = new Float32Array(win);
    for (let i = 0; i < win; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (win - 1));
    const pre = new Float32Array(n + win);
    for (let i = 0; i < n; i++) pre[i] = x[i];
    const fft = makeFFT(win);
    const mag = new Float32Array(win / 2);
    const frames = Math.max(1, Math.floor((n - win) / hop) + 1);

    const P_MIN = 36, P_MAX = 84, PN = P_MAX - P_MIN + 1;
    const pitchE = new Float32Array(frames * PN);
    const flux = new Float32Array(frames);
    const prevMag = new Float32Array(win / 2);
    // precompute bin windows per pitch (fundamental + harmonics 2,3,4)
    const plan = [];
    for (let p = P_MIN; p <= P_MAX; p++) {
      const f0 = 440 * Math.pow(2, (p - 69) / 12);
      const sets = [];
      [[1, 1], [2, 0.6], [3, 0.4], [4, 0.25]].forEach(([h, wgt]) => {
        const c = Math.round((f0 * h) / binHz);
        const spread = Math.max(1, Math.round(1.2 / binHz * (h === 1 ? 1 : 1)));
        if (c + spread < win / 2) sets.push({ lo: c - spread, hi: c + spread, w: wgt });
      });
      plan.push(sets);
    }
    say('pitch energy over ' + frames + ' frames');
    let rep = 0;
    for (let fr = 0; fr < frames; fr++) {
      const off = fr * hop;
      for (let i = 0; i < win; i++) pre[off + i] = x[off + i] * hann[i];
      fft(pre, off, mag);
      let s = 0;
      for (let k = 0; k < win / 2; k++) { const d = mag[k] - prevMag[k]; if (d > 0) s += d; prevMag[k] = mag[k]; }
      flux[fr] = s;
      const base = fr * PN;
      for (let pi = 0; pi < PN; pi++) {
        let e = 0;
        const sets = plan[pi];
        for (let q = 0; q < sets.length; q++) {
          const sp = sets[q];
          let acc = 0;
          for (let k = Math.max(0, sp.lo); k <= sp.hi; k++) acc += mag[k];
          e += acc * sp.w;
        }
        pitchE[base + pi] = e;
      }
      if (fr - rep > 4000) { rep = fr; say('pitch energy ' + Math.round((fr / frames) * 100) + '%'); }
    }
    // normalize per pitch to its own 95th percentile so low notes still count
    for (let pi = 0; pi < PN; pi++) {
      const col = [];
      for (let fr = 0; fr < frames; fr++) col.push(pitchE[fr * PN + pi]);
      const sorted = col.slice().sort((a, b) => a - b);
      const hi = sorted[Math.floor(sorted.length * 0.98)] || 1;
      for (let fr = 0; fr < frames; fr++) pitchE[fr * PN + pi] = Math.min(1, col[fr] / hi);
    }
    let fmax = 0; for (let i = 0; i < frames; i++) if (flux[i] > fmax) fmax = flux[i];
    for (let i = 0; i < frames; i++) flux[i] /= fmax || 1;

    const notes = midi.notes.map((p) => ({ t: p.t, p: p.p }));

    function pitchScore(scale, offset, list) {
      let acc = 0, used = 0;
      for (let i = 0; i < list.length; i++) {
        const f = Math.round(offset / hopSec + (scale * list[i].t) / hopSec);
        if (f < 0 || f >= frames) continue;
        acc += pitchE[f * PN + (list[i].p - P_MIN)]; used++;
      }
      return used ? acc / used : 0;
    }
    function onsetScore(scale, offset, list) {
      let acc = 0, used = 0;
      for (let i = 0; i < list.length; i++) {
        const f = Math.round(offset / hopSec + (scale * list[i].t) / hopSec);
        if (f < 0 || f >= frames) continue;
        acc += flux[f]; used++;
      }
      return used ? acc / used : 0;
    }
    function search(list, scales, offsets, fn) {
      let best = { scale: 1, offset: 0, s: -1 };
      for (const sc of scales) for (const of of offsets) {
        const s = fn(sc, of, list);
        if (s > best.s) best = { scale: sc, offset: of, s };
      }
      return best;
    }
    const scales = [], offsets = [];
    for (let s = 0.94; s <= 1.0601; s += 0.001) scales.push(+s.toFixed(4));
    for (let o = -4; o <= 4.001; o += 0.04) offsets.push(+o.toFixed(3));
    const gp = search(notes, scales, offsets, pitchScore);
    const go = search(notes, scales, offsets, onsetScore);
    // top candidates by pitch score
    const ranked = [];
    for (const sc of scales) for (const of of offsets) ranked.push({ scale: sc, offset: of, s: +pitchScore(sc, of, notes).toFixed(4) });
    ranked.sort((a, b) => b.s - a.s);
    const top = ranked.slice(0, 12);
    const identity = +pitchScore(1, 0, notes).toFixed(4);
    const meanAll = +(ranked.reduce((s, r) => s + r.s, 0) / ranked.length).toFixed(4);
    // phase stability test with scale fixed to the pitch-domain winner
    const win20 = [];
    for (let a = 0; a + 20 <= 160; a += 20) {
      const list = notes.filter((nn) => nn.t >= a && nn.t < a + 20);
      const offs = [];
      for (let o = -1; o <= 1.0001; o += 0.01) offs.push(+o.toFixed(3));
      const b = search(list, [gp.scale], offs, pitchScore);
      win20.push({ from: a, offset: b.offset, score: +b.s.toFixed(4), atZero: +pitchScore(gp.scale, 0, list).toFixed(4) });
    }
    // local scale per 40s with offset free (drift probe)
    const local40 = [];
    for (let a = 0; a + 40 <= 160; a += 40) {
      const list = notes.filter((nn) => nn.t >= a && nn.t < a + 40);
      const sc = [];
      for (let s = gp.scale - 0.02; s <= gp.scale + 0.0201; s += 0.0005) sc.push(+s.toFixed(5));
      const offs = [];
      for (let o = -2; o <= 2.0001; o += 0.02) offs.push(+o.toFixed(3));
      const b = search(list, sc, offs, pitchScore);
      local40.push({ from: a, scale: +b.scale.toFixed(5), offset: +b.offset.toFixed(3), score: +b.s.toFixed(4) });
    }
    window.__result = {
      audio: { duration: +dur.toFixed(3), sampleRate: sr, hopSec: +hopSec.toFixed(5), frames, binHz: +binHz.toFixed(3) },
      pitch: { identity, mean: meanAll, best: { scale: +gp.scale.toFixed(5), offset: +gp.offset.toFixed(3), score: +gp.s.toFixed(4) }, top },
      onset: { best: { scale: +go.scale.toFixed(5), offset: +go.offset.toFixed(3), score: +go.s.toFixed(4) } },
      phaseByWindow: win20,
      localScale40: local40,
    };
    say('DONE');
  } catch (e) {
    window.__result = { error: String((e && e.stack) || e) };
    say('ERR ' + e);
  }
  window.__done = true;
})();
