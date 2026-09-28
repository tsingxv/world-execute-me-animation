/* data.js — read-only accessors over the three embedded tables.
 * Everything derived here is computed once at load from the tables (never mutated
 * afterwards), so a frame at time t can be produced from t alone.
 *
 * Division of labour, deliberately kept separate:
 *   WE_NOTES  (MIDI)  -> which accents exist, their pitch/velocity/length, the note material
 *   WE_AUDIO  (measured) -> where the recording actually has energy, and where its onsets are
 *   WE_LYRICS (LRC)   -> when a word is on screen. Never touched by the beat machinery. */
(function () {
  const WE = (window.WE = window.WE || {});
  const D = (WE.data = {});

  const N = WE_NOTES, A = WE_AUDIO, L = WE_LYRICS;
  D.notes = N; D.audio = A; D.lyrics = L;
  D.end = A.duration;

  /* ---------- hex envelope decoding ---------- */
  function unhex(str, out) {
    for (let i = 0; i < out.length; i++) out[i] = parseInt(str.substr(i * 2, 2), 16);
    return out;
  }
  const RATE = A.envRate;
  D.env = {
    flux: unhex(A.flux, new Uint8Array(A.envLen)),
    rms: unhex(A.rms, new Uint8Array(A.envLen)),
    bands: A.bands.map((b) => unhex(b, new Uint8Array(A.envLen))),
  };

  /* ---------- generic binary search ---------- */
  function lowerBound(arr, v) {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (arr[m] < v) lo = m + 1; else hi = m;
    }
    return lo;
  }
  D.lowerBound = lowerBound;

  /* ---------- measured audio features, interpolated (still a pure function of t) ---------- */
  function sample(arr, t) {
    const x = t * RATE;
    const i = Math.floor(x);
    if (i < 0) return arr[0] / 255;
    if (i >= arr.length - 1) return arr[Math.max(0, arr.length - 1)] / 255;
    const f = x - i;
    return (arr[i] + (arr[i + 1] - arr[i]) * f) / 255;
  }
  D.rmsAt = (t) => sample(D.env.rms, t);
  D.fluxAt = (t) => sample(D.env.flux, t);
  D.bandAt = (t, b) => sample(D.env.bands[Math.max(0, Math.min(4, b | 0))], t);
  D.energyAt = function (t) {
    return {
      rms: D.rmsAt(t),
      flux: D.fluxAt(t),
      low: D.bandAt(t, 1),
      mid: D.bandAt(t, 2),
      high: D.bandAt(t, 3),
      air: D.bandAt(t, 4),
      sub: D.bandAt(t, 0),
    };
  };

  /* ---------- onset table (measured) ---------- */
  // WE_AUDIO.onsets entries are [seconds, strength] pairs
  const ON_T = A.onsets.map((o) => o[0]);
  const ON_S = A.onsets.map((o) => o[1]);
  D.onsetTimes = ON_T;
  D.nearestOnset = function (t) {
    const i = lowerBound(ON_T, t);
    let best = -1, bestD = Infinity;
    for (let k = i - 1; k <= i + 1; k++) {
      if (k < 0 || k >= ON_T.length) continue;
      const d = Math.abs(ON_T[k] - t);
      if (d < bestD) { bestD = d; best = k; }
    }
    return best < 0 ? null : { i: best, t: ON_T[best], s: ON_S[best], delta: ON_T[best] - t };
  };
  // How far a MIDI time sits from a real recorded onset. Reported, not silently used:
  // measurements (tools/align.mjs, tools/salience-analysis.js, tools/synth-align-analysis.js)
  // found no consistent scale/offset between this chart and this recording, so accents keep
  // the chart's own clock and the *envelope* below carries the recording's timing.
  D.snap = function (t, tolerance) {
    const tol = tolerance === undefined ? 0.12 : tolerance;
    const n = D.nearestOnset(t);
    if (!n) return { t: t, snapped: false, delta: NaN };
    if (Math.abs(n.delta) > tol) return { t: t, snapped: false, delta: n.delta };
    return { t: n.t, snapped: true, delta: n.delta, strength: n.s };
  };

  /* ---------- MIDI note windows ---------- */
  const T = N.t, P = N.p, V = N.v, DUR = N.d;
  D.noteCount = T.length;
  D.notesIn = function (from, to) {
    const a = lowerBound(T, from), b = lowerBound(T, to);
    const out = [];
    for (let i = a; i < b; i++) out.push({ i: i, t: T[i], p: P[i], v: V[i], d: DUR[i] });
    return out;
  };
  // note events grouped by shared onset (a chord is one musical moment)
  const events = [];
  (function build() {
    let i = 0;
    while (i < T.length) {
      const g = [i];
      let j = i + 1;
      while (j < T.length && T[j] - T[i] <= 0.03) { g.push(j); j++; }
      let bass = 127, soprano = 0, vel = 0, sum = 0, dur = 0;
      for (const k of g) {
        if (P[k] < bass) bass = P[k];
        if (P[k] > soprano) soprano = P[k];
        if (V[k] > vel) vel = V[k];
        sum += P[k];
        dur = Math.max(dur, DUR[k]);
      }
      events.push({
        t: T[i], snapped: 0, group: g, n: g.length,
        bass: bass, soprano: soprano, mid: Math.round(sum / g.length),
        vel: vel, dur: dur,
        lo: bass < 50, mel: soprano >= 69,
      });
      i = j;
    }
    // Accents keep the chart's own onset times. `off` records how far each one sits from a
    // measured recorded onset, which is what tools/verify.mjs reports instead of a hidden
    // correction. Set WE_NOTES.align = {tolerance: s} to register them onto the recording.
    const tol = (N.align && N.align.tolerance) || 0;
    for (const e of events) {
      const s = D.snap(e.t, tol);
      e.raw = e.t;
      e.t = s.t;
      e.snapped = s.snapped ? 1 : 0;
      const near = D.nearestOnset(e.raw);
      e.onsetDelta = near ? Math.abs(near.delta) : NaN;
    }
  })();
  D.events = events;
  D.eventTimes = events.map((e) => e.t);
  D.eventsIn = function (from, to) {
    const a = lowerBound(D.eventTimes, from), b = lowerBound(D.eventTimes, to);
    return events.slice(a, b);
  };
  D.eventsBefore = function (to) {
    return lowerBound(D.eventTimes, to);
  };

  // how busy is the MIDI right now (notes/second in a +-1s window)
  D.densityAt = function (t) {
    const from = Math.max(0, t - 1), to = Math.min(N.span[1] + 0.5, t + 1);
    const a = lowerBound(T, from), b = lowerBound(T, to);
    return (b - a) / Math.max(0.5, to - from);
  };
  D.notesHeld = function (t) {
    const out = [];
    const a = lowerBound(T, t - 8);
    for (let i = a; i < T.length; i++) {
      if (T[i] > t) break;
      if (t - T[i] <= DUR[i]) out.push({ i: i, t: T[i], p: P[i], v: V[i], d: DUR[i], age: t - T[i] });
    }
    return out;
  };
  // chord shape of the moment: pitch classes currently sounding
  D.chordAt = function (t) {
    const held = D.notesHeld(t);
    const pcs = new Set();
    let vel = 0;
    for (const h of held) { pcs.add(h.p % 12); vel = Math.max(vel, h.v); }
    return { size: pcs.size, classes: [...pcs], vel: vel, held: held };
  };

  /* ---------- lyrics (LRC authority) ---------- */
  const LS = L.lines.map((l) => l[0]);
  // Four timestamps in this LRC carry two lines each (156 s and 115 s and 181 s and the
  // third line of the file). Both words keep their measured start; the shared window is
  // split into slots so each line still gets its own staged treatment.
  const GROUPS = new Map();
  L.lines.forEach((l, i) => {
    if (!GROUPS.has(l[0])) GROUPS.set(l[0], []);
    GROUPS.get(l[0]).push(i);
  });
  D.lyricAt = function (t) {
    const i = lowerBound(LS, t + 1e-9) - 1;
    if (i < 0) return null;
    const start = L.lines[i][0], end = L.lines[i][1];
    if (t >= end) return null;
    const members = GROUPS.get(start);
    const win = Math.max(0.001, end - start);
    const slot = members.length > 1 ? Math.min(members.length - 1, Math.floor(((t - start) / win) * members.length)) : 0;
    const idx = members[slot];
    const rec = L.lines[idx];
    return {
      index: idx,
      slot: slot, slots: members.length,
      start: start, end: end,
      text: rec[2], family: rec[3], mood: rec[4],
      params: L.params[idx],
      local: (t - start) / win,
      age: t - start,
      remain: end - t,
      group: members.map((m) => ({
        index: m, text: L.lines[m][2], family: L.lines[m][3], mood: L.lines[m][4],
        params: L.params[m], start: start, end: end, age: t - start, local: (t - start) / win,
      })),
    };
  };
  // lines sharing the same timestamp render together in the console line
  D.lyricGroupAt = function (t) {
    const one = D.lyricAt(t);
    return one ? one.group : [];
  };
  // the moment inside line i's own slot - use this when you need to reach every line,
  // including the ones that share a timestamp with another line
  D.slotTime = function (i) {
    const l = L.lines[i];
    const members = GROUPS.get(l[0]);
    const win = Math.max(0.001, l[1] - l[0]);
    const s = members.indexOf(i);
    return +(l[0] + (s + 0.5) * (win / members.length)).toFixed(3);
  };
  D.lyricList = L.lines;
  D.lyricStarts = LS;

  /* ---------- interludes ---------- */
  D.interludeAt = function (t) {
    for (const s of WE_INTERLUDES) {
      const to = s.to === null ? D.end : s.to;
      if (t >= s.from && t < to) return { span: s, local: (t - s.from) / Math.max(0.001, to - s.from), age: t - s.from, remain: to - t };
    }
    return null;
  };

  /* ---------- the execution occurrence schedule, straight from the LRC ---------- */
  D.executions = (function () {
    const hits = [];
    L.lines.forEach((l, i) => {
      if (/execution/i.test(l[2])) hits.push({ line: i, t: l[0], end: l[1], text: l[2], params: L.params[i] });
    });
    return hits;
  })();

  /* ---------- timeline / section map for the HUD ---------- */
  D.SECTIONS = [
    [0, 12.6, 'boot'],
    [12.6, 29, 'world running'],
    [29, 59, 'definitions'],
    [59, 74, 'chorus i'],
    [74, 99, 'gifts'],
    [99, 110, 'switching'],
    [110, 125, 'left'],
    [125, 147, 'illegal arguments'],
    [147, 162, 'execution x12'],
    [162, 177, 'chorus iii'],
    [177, 191.5, 'properly love'],
    [191.5, D.end, 'return'],
  ];
  D.sectionAt = function (t) {
    for (const s of D.SECTIONS) if (t >= s[0] && t < s[1]) return s[2];
    return t >= D.end ? 'halted' : 'standby';
  };
  // accent activity for a span, used by scenes that want "how hard is the MIDI hitting here"
  D.eventCountIn = function (from, to) {
    return D.eventsIn(from, to).length;
  };
})();
