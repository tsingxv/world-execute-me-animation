/* Offline analysis: decode the mp3, build a spectral-flux onset envelope, and
   test whether the MIDI's own clock matches the recording. Used by align.mjs. */
(async function () {
  const out = document.getElementById('out');
  const say = (s) => { out.textContent = s; };
  window.__done = false; window.__result = null;
  try {
    say('fetching mp3');
    const mp3 = await (await fetch('../Mili - world.execute (me) ;.mp3')).arrayBuffer();
    say('decoding');
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const audio = await ac.decodeAudioData(mp3.slice(0));
    const sr = audio.sampleRate, n = audio.length, dur = audio.duration;

    const chs = audio.numberOfChannels;
    const x = new Float32Array(n);
    for (let c = 0; c < chs; c++) {
      const d = audio.getChannelData(c);
      for (let i = 0; i < n; i++) x[i] += d[i] / chs;
    }
    say('mixing done');

    function makeFFT(win) {
      const bits = Math.round(Math.log2(win));
      const rev = new Uint32Array(win);
      for (let i = 0; i < win; i++) { let r = 0, v = i; for (let b = 0; b < bits; b++) { r = (r << 1) | (v & 1); v >>= 1; } rev[i] = r; }
      const cosT = new Float64Array(win / 2), sinT = new Float64Array(win / 2);
      for (let k = 0; k < win / 2; k++) { cosT[k] = Math.cos(-2 * Math.PI * k / win); sinT[k] = Math.sin(-2 * Math.PI * k / win); }
      const re = new Float64Array(win), im = new Float64Array(win);
      return function fft(buf, off, outMag) {
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
        for (let k = 0; k < win / 2; k++) outMag[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      };
    }

    const win = 2048, hop = 1024;
    const hann = new Float32Array(win);
    for (let i = 0; i < win; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (win - 1));
    const windowed = new Float32Array(n + win);
    for (let i = 0; i < n; i++) windowed[i] = x[i];
    const fft = makeFFT(win);
    const mags = new Float32Array(win / 2);
    const frames = Math.max(1, Math.floor((n - win) / hop) + 1);
    const flux = new Float32Array(frames);
    const prev = new Float32Array(win / 2);
    const hopSec = hop / sr;
    say('stft ' + frames + ' frames');
    let reported = 0;
    for (let f = 0; f < frames; f++) {
      const off = f * hop;
      for (let i = 0; i < win; i++) windowed[off + i] = x[off + i] * hann[i];
      fft(windowed, off, mags);
      let sum = 0;
      for (let k = 0; k < win / 2; k++) { const d = mags[k] - prev[k]; if (d > 0) sum += d; prev[k] = mags[k]; }
      flux[f] = sum;
      if (f - reported > 2000) { reported = f; say('stft ' + Math.round((f / frames) * 100) + '%'); }
    }
    let mx = 0; for (let i = 0; i < frames; i++) if (flux[i] > mx) mx = flux[i];
    for (let i = 0; i < frames; i++) flux[i] /= mx || 1;
    say('flux max ' + mx.toFixed(3));

    const midi = await (await fetch('midi-notes.json')).json();
    const onsets = midi.notes.map((p) => p.t);
    const train = new Float32Array(frames);
    for (const t of onsets) { const f = Math.round(t / hopSec); if (f >= 0 && f < frames) train[f] += 1; }
    let tmax = 1; for (let i = 0; i < frames; i++) if (train[i] > tmax) tmax = train[i];
    for (let i = 0; i < frames; i++) train[i] = (train[i] / tmax) * 20;

    function pearson(a, b, lo, hi, lag) {
      let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, cnt = 0;
      for (let i = lo; i < hi; i++) {
        const j = i + lag;
        if (j < 0 || j >= b.length) continue;
        const av = a[i], bv = b[j];
        sa += av; sb += bv; saa += av * av; sbb += bv * bv; sab += av * bv; cnt++;
      }
      if (!cnt) return 0;
      const cov = sab / cnt - (sa / cnt) * (sb / cnt);
      const va = Math.sqrt(saa / cnt - (sa / cnt) ** 2), vb = Math.sqrt(sbb / cnt - (sb / cnt) ** 2);
      return va * vb ? cov / (va * vb) : 0;
    }
    const maxLag = Math.round(6 / hopSec);
    function bestLag(loSec, hiSec) {
      const lo = Math.max(0, Math.round(loSec / hopSec)), hi = Math.min(frames, Math.round(hiSec / hopSec));
      const cands = [];
      for (let lag = -maxLag; lag <= maxLag; lag++) cands.push({ lag, r: pearson(train, flux, lo, hi, lag) });
      cands.sort((a, b) => b.r - a.r);
      return { lagSec: +(cands[0].lag * hopSec).toFixed(3), r: +cands[0].r.toFixed(3), secondLagSec: +(cands[1].lag * hopSec).toFixed(3), secondR: +cands[1].r.toFixed(3), atZeroR: +pearson(train, flux, lo, hi, 0).toFixed(3) };
    }
    const global = bestLag(0, 155);
    const windows = [];
    for (let s = 0; s + 25 <= 155; s += 25) windows.push({ from: s, to: s + 25, ...bestLag(s, s + 25) });

    function tempoEstimate(loSec, hiSec) {
      const lo = Math.round(loSec / hopSec), hi = Math.round(hiSec / hopSec);
      let mean = 0; for (let i = lo; i < hi; i++) mean += flux[i]; mean /= hi - lo;
      const seg = new Float32Array(hi - lo);
      for (let i = 0; i < seg.length; i++) seg[i] = flux[lo + i] - mean;
      let best = { period: 0, score: -1e30 };
      for (let p = Math.round(0.2 / hopSec); p <= Math.round(1.2 / hopSec); p++) {
        let s = 0;
        for (let i = 0; i + p < seg.length; i++) s += seg[i] * seg[i + p];
        s /= seg.length - p;
        if (s > best.score) best = { period: p, score: s };
      }
      const periodSec = best.period * hopSec;
      return { periodSec: +periodSec.toFixed(3), bpm: +(60 / periodSec).toFixed(1) };
    }

    const recPer4s = [], midPer4s = [];
    for (let s = 0; s < 160; s += 4) {
      const lo = Math.round(s / hopSec), hi = Math.round((s + 4) / hopSec);
      let c = 0;
      for (let i = lo + 1; i < hi; i++) if (flux[i] > flux[i - 1] && flux[i] > flux[i - 2] && flux[i] > 0.15) c++;
      recPer4s.push(c);
      let mc = 0; for (const t of onsets) if (t >= s && t < s + 4) mc++;
      midPer4s.push(mc);
    }
    function countCorr(a, b) {
      const m1 = a.reduce((s, v) => s + v, 0) / a.length, m2 = b.reduce((s, v) => s + v, 0) / b.length;
      let c = 0, va = 0, vb = 0;
      for (let i = 0; i < a.length; i++) { c += (a[i] - m1) * (b[i] - m2); va += (a[i] - m1) ** 2; vb += (b[i] - m2) ** 2; }
      return +(c / Math.sqrt(va * vb)).toFixed(3);
    }
    const rms5s = [];
    for (let s = 0; s < dur; s += 5) {
      const lo = Math.floor(s * sr), hi = Math.min(n, Math.floor((s + 5) * sr));
      let acc = 0, cnt = 0;
      for (let i = lo; i < hi; i += 7) { acc += x[i] * x[i]; cnt++; }
      rms5s.push({ t: s, v: +Math.sqrt(acc / Math.max(1, cnt)).toFixed(4) });
    }

    window.__result = {
      audio: { duration: +dur.toFixed(3), sampleRate: sr, channels: chs, bytes: mp3.byteLength, nativeRate: sr },
      midi: { count: midi.count, lastNote: onsets[onsets.length - 1], division: midi.division, tempoMap: midi.tempoMap },
      alignment: { global, windows, densityCorr: countCorr(recPer4s, midPer4s) },
      tempo: { w30_60: tempoEstimate(30, 60), w90_120: tempoEstimate(90, 120), w140_160: tempoEstimate(140, 160) },
      recPer4s, midPer4s, rms5s,
    };
    say('DONE');
  } catch (e) {
    window.__result = { error: String((e && e.stack) || e) };
    say('ERROR ' + e);
  }
  window.__done = true;
})();
