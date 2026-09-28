/* Extract measured features from the recording, for embedding as page data:
   - spectral-flux energy envelope at 100 Hz (quantised, hex-encoded)
   - picked onset times + strengths
   Runs in headless Chrome (decodeAudioData is the only mp3 decoder available
   without external tooling). Output: tools/audio-analysis.json */
(async function () {
  const out = document.getElementById('out');
  const say = (s) => { out.textContent = s; };
  window.__done = false; window.__result = null;
  try {
    const mp3 = await (await fetch('../Mili - world.execute (me) ;.mp3')).arrayBuffer();
    const ac = new AudioContext();
    const audio = await ac.decodeAudioData(mp3.slice(0));
    const sr = audio.sampleRate, n = audio.length, dur = audio.duration;
    say('decoded ' + dur.toFixed(3) + 's @' + sr);
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

    const win = 2048, hop = 480; // exactly 10 ms at 48 kHz
    const hopSec = hop / sr;
    const hann = new Float32Array(win);
    for (let i = 0; i < win; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (win - 1));
    const scratch = new Float32Array(win);
    const fft = makeFFT(win);
    const mag = new Float32Array(win / 2);
    const prev = new Float32Array(win / 2);
    const frames = Math.max(1, Math.floor((n - win) / hop) + 1);
    const flux = new Float32Array(frames);
    const bandE = new Float32Array(frames * 5); // sub / low / mid / high / veryHigh
    const cutIdx = [0, 1, 2, 4, 8, 40].map((k) => Math.round((k * 1000) / (sr / win)));
    for (let f = 0; f < frames; f++) {
      const off = f * hop;
      for (let i = 0; i < win; i++) scratch[i] = x[off + i] * hann[i];
      fft(scratch, 0, mag);
      let s = 0;
      for (let k = 0; k < win / 2; k++) { const d = mag[k] - prev[k]; if (d > 0) s += d; prev[k] = mag[k]; }
      flux[f] = s;
      for (let b = 0; b < 5; b++) {
        let acc = 0, cnt = 0;
        for (let k = cutIdx[b]; k < cutIdx[b + 1]; k++) { acc += mag[k]; cnt++; }
        bandE[f * 5 + b] = cnt ? acc / cnt : 0;
      }
      if ((f & 8191) === 0) say('stft ' + Math.round((f / frames) * 100) + '%');
    }
    let fmax = 0; for (let i = 0; i < frames; i++) if (flux[i] > fmax) fmax = flux[i];
    for (let i = 0; i < frames; i++) flux[i] /= fmax || 1;
    const bandMax = [0, 0, 0, 0, 0];
    for (let f = 0; f < frames; f++) for (let b = 0; b < 5; b++) bandMax[b] = Math.max(bandMax[b], bandE[f * 5 + b]);
    for (let f = 0; f < frames; f++) for (let b = 0; b < 5; b++) bandE[f * 5 + b] /= bandMax[b] || 1;

    // RMS envelope (perceptual loudness) at the same 10 ms grid
    const rms = new Float32Array(frames);
    for (let f = 0; f < frames; f++) {
      let acc = 0, c = 0;
      for (let i = f * hop; i < Math.min(n, f * hop + win); i += 8) { acc += x[i] * x[i]; c++; }
      rms[f] = Math.sqrt(acc / Math.max(1, c));
    }
    let rmax = 0; for (let i = 0; i < frames; i++) if (rms[i] > rmax) rmax = rms[i];
    for (let i = 0; i < frames; i++) rms[i] /= rmax || 1;

    // onset picking: local maxima of flux above adaptive threshold
    const onsets = [];
    const W = 12; // +-120 ms window
    for (let f = 1; f < frames - 1; f++) {
      if (!(flux[f] > flux[f - 1] && flux[f] >= flux[f + 1])) continue;
      let lo = 1, hi = 0, cnt = 0;
      for (let j = Math.max(0, f - 40); j < Math.min(frames, f + 40); j++) { hi = Math.max(hi, flux[j]); lo = Math.min(lo, flux[j]); cnt++; }
      const thresh = lo + 0.32 * (hi - lo) + 0.012;
      if (flux[f] < thresh) continue;
      const last = onsets[onsets.length - 1];
      if (last && f - last.f < W) { if (flux[f] > last.s) { last.f = f; last.s = flux[f]; } continue; }
      onsets.push({ f, s: flux[f] });
    }
    // also require some novelty vs the previous frame valley
    const picked = onsets.map((o) => ({ t: +(o.f * hopSec).toFixed(3), s: +Math.min(1, o.s).toFixed(3) }));

    // downsample to 25 Hz for embedding (40 ms) to keep the file small
    const DS = 4;
    const envLen = Math.ceil(frames / DS);
    const q = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
    const hex = (arr) => { let s = ''; for (let i = 0; i < arr.length; i++) s += arr[i].toString(16).padStart(2, '0'); return s; };
    const fluxEnv = new Uint8Array(envLen), rmsEnv = new Uint8Array(envLen);
    const bandEnv = [new Uint8Array(envLen), new Uint8Array(envLen), new Uint8Array(envLen), new Uint8Array(envLen), new Uint8Array(envLen)];
    for (let i = 0; i < envLen; i++) {
      let a = 0, r = 0, c = 0;
      const bs = [0, 0, 0, 0, 0];
      for (let j = i * DS; j < Math.min(frames, (i + 1) * DS); j++) { a += flux[j]; r += rms[j]; c++; for (let b = 0; b < 5; b++) bs[b] += bandE[j * 5 + b]; }
      fluxEnv[i] = q(a / c); rmsEnv[i] = q(r / c);
      for (let b = 0; b < 5; b++) bandEnv[b][i] = q(bs[b] / c);
    }
    window.__result = {
      meta: {
        duration: +dur.toFixed(3), sampleRate: sr, channels: chs,
        frames, hopSec: +hopSec.toFixed(5), envRate: 1 / (DS * hopSec),
        onsetCount: picked.length,
      },
      onsets: picked,
      env: { flux: hex(fluxEnv), rms: hex(rmsEnv), bands: bandEnv.map(hex), len: envLen },
      // coarse beat evidence: mean flux salience per 0.25 s bucket, for tempo reports
      summary: {
        firstOnset: picked[0] && picked[0].t,
        lastOnset: picked[picked.length - 1] && picked[picked.length - 1].t,
        onsetsPerSecond: +(picked.length / dur).toFixed(2),
      },
    };
    say('DONE');
  } catch (e) {
    window.__result = { error: String((e && e.stack) || e) };
    say('ERR ' + e);
  }
  window.__done = true;
})();
