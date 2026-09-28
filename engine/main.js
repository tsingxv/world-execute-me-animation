/* main.js — the frame composer and the only two pieces of state in the piece:
 * the audio clock and the canvas size. Everything drawn is a pure function of t,
 * so seeking backwards, or jumping in any order, reproduces the identical frame.
 *
 * Time basis: audio.currentTime, sampled once per requestAnimationFrame.
 * If the audio file is missing the engine runs on an internal clock instead and says
 * so on screen — the animation still paints, it never goes black.
 */
(function () {
  const WE = (window.WE = window.WE || {});
  const { clamp } = WE;

  const canvas = document.getElementById('stage');
  const g = canvas.getContext('2d');
  const audio = document.getElementById('song');
  const banner = document.getElementById('banner');

  WE.errors = {};
  let size = { W: 0, H: 0, dpr: 1 };
  let fallbackClock = { startedAt: 0, offset: 0, running: false };
  let audioOk = false;

  /* ---------- boards: the drawing groups, each isolated from the others ---------- */
  WE.scenes.idle = WE.layers.idle; // title card before the first LRC timestamp
  WE.boards = [
    { id: 'void', kind: 'layer', draw: WE.layers.void },
    { id: 'grid', kind: 'layer', draw: WE.layers.grid },
    { id: 'rain', kind: 'layer', draw: WE.layers.rain },
    { id: 'roll', kind: 'layer', draw: WE.layers.roll },
    { id: 'accents', kind: 'layer', draw: WE.layers.accents },
    { id: 'entity', kind: 'layer', draw: WE.layers.entity },
    {
      id: 'scene', kind: 'layer',
      draw: function (g2, E) {
        const fn = WE.scenes[E.family];
        if (!fn) throw new Error('no scene family ' + E.family);
        fn(g2, E);
      },
    },
    { id: 'lyric', kind: 'layer', draw: WE.layers.lyric },
    { id: 'hud', kind: 'layer', draw: WE.layers.hud },
    { id: 'overlay', kind: 'layer', draw: WE.layers.overlay },
  ];

  // an explicitly disabled fault-injection board: verify.mjs turns it on to prove the
  // other boards keep painting when one of them throws.
  WE.boards.push({
    id: 'fault', kind: 'layer', off: true,
    draw: function () { throw new Error('injected fault'); },
  });

  /* ---------- the env handed to every board: from t and the frame geometry, nothing else ---------- */
  function previousMood(t) {
    const D = WE.data;
    const idx = D.lowerBound(D.lyricStarts, t) - 1;
    if (idx <= 0) return null;
    const cur = D.lyrics.lines[idx];
    const before = D.lyrics.lines[idx - 1];
    return before && cur && before[4] !== cur[4] ? before[4] : null;
  }

  WE.buildEnv = function (t, geo) {
    const D = WE.data;
    const W = (geo && geo.W) || size.W;
    const H = (geo && geo.H) || size.H;
    const line = D.lyricAt(t);
    const inter = line ? null : D.interludeAt(t);
    const energy = D.energyAt(t);
    const palName = line ? line.mood : (inter ? inter.span.mood : 'boot');
    const prev = previousMood(t);
    const pal = WE.moodPal(palName, prev, line ? clamp(line.age / 0.6, 0, 1) : 0.5);
    // the being is always on stage; a line whose own text owns the middle steps it aside
    const ent = (line ? line.params : inter ? inter.span.p : {}).entity;
    return {
      t: t,
      W: W, H: H, u: Math.min(W / 1280, H / 720),
      cx: W * 0.5, cy: H * 0.45,
      entity: { x: W * 0.5 + (ent ? ent[0] * W : 0), y: H * 0.45 + (ent ? ent[1] * H : 0) },
      stage: { x: W * 0.1, y: H * 0.12, w: W * 0.8, h: H * 0.62 },
      line: line, group: line ? line.group : [], span: inter ? inter.span : null,
      family: line ? line.family : (inter ? inter.span.scene : 'idle'),
      p: line ? line.params : (inter ? inter.span.p : {}),
      mood: palName,
      prevMood: prev,
      pal: pal,
      energy: energy,
      density: D.densityAt(t),
      local: line ? line.local : (inter ? inter.local : 0),
    };
  };

  /* ---------- one frame ---------- */
  WE.frame = function (t, ctx, opts) {
    const target = ctx || g;
    const E = WE.buildEnv(t);
    WE.errors = {};
    const only = opts && opts.only;
    target.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    target.clearRect(0, 0, size.W, size.H);
    for (const b of WE.boards) {
      if (b.off) continue;
      if (only && only !== b.id) continue;
      try {
        b.draw(target, E);
      } catch (err) {
        // isolate: this board is marked, the rest of the frame keeps going
        WE.errors[b.id] = { message: err && err.message ? err.message : String(err), stack: err && err.stack };
      }
    }
    return E;
  };

  /* ---------- the clock ---------- */
  function now() {
    if (audioOk && isFinite(audio.duration) && audio.duration > 1) return clamp(audio.currentTime, 0, audio.duration);
    if (!fallbackClock.running) return fallbackClock.offset;
    return clamp(fallbackClock.offset + (performance.now() - fallbackClock.startedAt) / 1000, 0, WE.data.end);
  }
  WE.time = now;
  WE.audioReady = function () { return audioOk; };
  WE.duration = function () { return audioOk && isFinite(audio.duration) && audio.duration > 1 ? audio.duration : WE.data.end; };

  WE.seek = function (t) {
    t = clamp(t, 0, WE.duration());
    if (audioOk) {
      try { audio.currentTime = t; } catch (e) { /* seek past the buffer */ }
      fallbackClock.offset = t;
      if (fallbackClock.running) fallbackClock.startedAt = performance.now();
    } else {
      fallbackClock.offset = t;
      fallbackClock.startedAt = performance.now();
    }
  };

  WE.playPause = function (want) {
    if (audioOk) {
      if (want === undefined) want = audio.paused;
      if (want) { const pr = audio.play(); if (pr && pr.catch) pr.catch(function () { /* gesture still pending */ }); }
      else audio.pause();
      return !audio.paused;
    }
    fallbackClock.running = want === undefined ? !fallbackClock.running : want;
    if (fallbackClock.running) fallbackClock.startedAt = performance.now();
    return fallbackClock.running;
  };
  WE.playing = function () { return audioOk ? !audio.paused : fallbackClock.running; };

  /* ---------- audio wiring, with a real degradation path ---------- */
  function showBanner(text, sticky) {
    if (!banner) return;
    banner.textContent = text;
    banner.style.display = 'block';
    if (!sticky) banner._hide = performance.now() + 2600;
  }
  function useFallback(reason) {
    audioOk = false;
    fallbackClock.running = false;
    fallbackClock.startedAt = performance.now();
    showBanner(reason, true);
  }
  WE.bannerVisible = function () { return !!banner && banner.style.display !== 'none'; };

  audio.addEventListener('loadedmetadata', function () {
    const measured = WE_AUDIO.duration;
    const real = audio.duration;
    audioOk = isFinite(real) && real > 1;
    if (audioOk) {
      clearTimeout(watchdog);
      WE.data.end = real;
      const drift = Math.abs(real - measured);
      showBanner(drift > 0.5 ? 'duration differs from measurement by ' + drift.toFixed(3) + ' s' : 'ready  ' + real.toFixed(3) + ' s', false);
    } else {
      useFallback('audio reports no duration - running on the internal clock');
    }
  });
  audio.addEventListener('error', function () {
    useFallback('audio unavailable (' + (audio.error ? 'MediaError code ' + audio.error.code : 'file not found') + ') - animation runs on the internal clock');
  });
  // nothing loaded within a few seconds (deleted file, or the browser refused the src)
  let watchdog = setTimeout(function () {
    if (!audioOk && !audio.duration) useFallback('audio unavailable - animation runs on the internal clock');
  }, window.WE_SINGLE ? 6000 : 2500);

  /* Single-file build: the recording arrives as base64 in WE_SINGLE.bytes and is turned
     into a blob URL, because a data: URI of this size is not reliably loadable. */
  function useEmbeddedAudio() {
    const s = window.WE_SINGLE;
    if (!s || typeof s.bytes !== 'string' || !s.bytes.length) return false;
    const bin = atob(s.bytes);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    audio.src = URL.createObjectURL(new Blob([u8], { type: 'audio/mpeg' }));
    audio.load();
    return true;
  }
  const embedded = useEmbeddedAudio();

  /* ---------- sizing ---------- */
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(320, window.innerWidth);
    const h = Math.max(240, window.innerHeight);
    size = { W: w, H: h, dpr: dpr };
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
  }
  window.addEventListener('resize', resize);
  resize();

  /* ---------- the loop: rAF, one time source, no accumulated drawing state ---------- */
  WE.stats = { frames: 0, last: 0, ms: 0 };
  function tick() {
    const t = now();
    const s = performance.now();
    WE.frame(t);
    WE.stats.frames++;
    WE.stats.last = t;
    WE.stats.ms = performance.now() - s;
    if (banner && banner._hide && performance.now() > banner._hide) banner.style.display = 'none';
    requestAnimationFrame(tick);
  }

  /* ---------- controls ---------- */
  function seekFromEvent(ev) {
    const r = canvas.getBoundingClientRect();
    const k = clamp((((ev.clientX - r.left) / r.width) - 0.03) / 0.94, 0, 1);
    WE.seek(k * WE.duration());
  }
  canvas.addEventListener('pointerdown', function (ev) {
    const r = canvas.getBoundingClientRect();
    if ((ev.clientY - r.top) / r.height > 0.9) {
      if (canvas.setPointerCapture) canvas.setPointerCapture(ev.pointerId);
      canvas._drag = true;
      seekFromEvent(ev);
    } else {
      WE.playPause();
    }
  });
  canvas.addEventListener('pointermove', function (ev) { if (canvas._drag) seekFromEvent(ev); });
  canvas.addEventListener('pointerup', function () { canvas._drag = false; });
  window.addEventListener('keydown', function (ev) {
    if (ev.code === 'Space') { ev.preventDefault(); WE.playPause(); }
    else if (ev.key === 'ArrowRight') WE.seek(now() + (ev.shiftKey ? 10 : 1));
    else if (ev.key === 'ArrowLeft') WE.seek(now() - (ev.shiftKey ? 10 : 1));
    else if (ev.key === 'Home') WE.seek(0);
    else if (ev.key === 'End') WE.seek(WE.duration() - 0.05);
  });

  /* ---------- test hooks used by tools/verify.mjs ----------
   * Snapshots render into a FRESH offscreen canvas at a fixed 1280x720. Reusing one live
   * surface and reading it back repeatedly makes Chrome switch rasterisation path, so
   * byte-comparing the live surface would test the platform, not our purity.
   */
  const SNAP = { W: 1280, H: 720, dpr: 1 };

  function wrapOps(pg, rec) {
    for (const n of ['fillRect', 'stroke', 'fill', 'fillText', 'strokeText', 'drawImage']) {
      const orig = pg[n].bind(pg);
      pg[n] = function () {
        rec.ops++;
        if (n === 'fillText') { const str = String(arguments[0]); rec.chars += str.length; if (rec.texts) rec.texts.push(str); }
        return orig.apply(null, arguments);
      };
    }
  }

  function renderOffscreen(t, ids, opRec) {
    const probe = document.createElement('canvas');
    probe.width = SNAP.W;
    probe.height = SNAP.H;
    const pg = probe.getContext('2d', { willReadFrequently: true });
    if (opRec) {
      wrapOps(pg, opRec);
      WE.__textLog = opRec.texts || null;
    }
    const E = WE.buildEnv(t, SNAP);
    pg.setTransform(1, 0, 0, 1, 0, 0);
    pg.clearRect(0, 0, SNAP.W, SNAP.H);
    const errors = [];
    for (const b of WE.boards) {
      if (b.off && !(ids && ids.indexOf(b.id) >= 0)) continue;
      if (ids && ids.indexOf(b.id) < 0) continue;
      try { b.draw(pg, E); } catch (e) { errors.push(b.id + ': ' + e.message); }
    }
    WE.__textLog = null;
    return { pg: pg, E: E, probe: probe, errors: errors };
  }

  WE.test = {
    frameAt: function (t, only) { return WE.frame(t, undefined, only ? { only: only } : undefined); },
    envAt: function (t) { return WE.buildEnv(t, SNAP); },
    snapshot: function (t) { return renderOffscreen(t, null, null).probe.toDataURL(); },
    // hash of a fresh full render: identical bytes => identical hash
    frameHash: function (t) {
      const r = renderOffscreen(t, null, null);
      const d = r.pg.getImageData(0, 0, SNAP.W, SNAP.H).data;
      let a = 2166136261, b = 16777619, sum = 0;
      for (let i = 0; i < d.length; i += 16) {
        a = (a ^ d[i]) * 16777619 >>> 0;
        b = (b + d[i] * ((i % 251) + 1)) >>> 0;
        sum = (sum + d[i] + d[i + 1] * 3 + d[i + 2] * 7) >>> 0;
      }
      return { hash: a + ':' + b + ':' + sum, errors: r.errors, family: r.E.family };
    },
    // Did this board actually put ink down? Compared against the background alone, with a
    // small luminance tolerance so thin dark strokes still count as drawn.
    measure: function (t, only) {
      const base = renderOffscreen(t, ['void'], null);
      const bg = base.pg.getImageData(0, 0, SNAP.W, SNAP.H).data;
      const rec = { ops: 0, chars: 0, texts: [] };
      const full = renderOffscreen(t, only ? ['void', only] : null, rec);
      const fg = full.pg.getImageData(0, 0, SNAP.W, SNAP.H).data;
      let ink = 0, changed = 0, n = 0;
      const colors = new Set();
      for (let i = 0; i < fg.length; i += 4 * 7) {
        const lum = (fg[i] * 30 + fg[i + 1] * 59 + fg[i + 2] * 11) / 100;
        const lumB = (bg[i] * 30 + bg[i + 1] * 59 + bg[i + 2] * 11) / 100;
        n++;
        if (lum > 26) ink++;
        if (Math.abs(lum - lumB) > 3 || fg[i + 3] !== bg[i + 3]) changed++;
        if (n % 23 === 0) colors.add(((fg[i] >> 3) << 10) | ((fg[i + 1] >> 3) << 5) | (fg[i + 2] >> 3));
      }
      return {
        ops: rec.ops, chars: rec.chars, texts: rec.texts,
        ink: ink / n, changed: changed / n, palette: colors.size,
        errors: full.errors, envFamily: full.E.family,
      };
    },
    // the context must not carry state from one frame into the next
    ctxState: function () {
      return {
        alpha: g.globalAlpha, comp: g.globalCompositeOperation, shadow: g.shadowBlur,
        lineWidth: g.lineWidth, filter: g.filter, transform: g.getTransform().toString(),
      };
    },
    stage: function () { return size; },
    boards: WE.boards,
    setBoard: function (id, on) {
      const b = WE.boards.filter((x) => x.id === id)[0];
      if (b) b.off = !on;
      return !!b;
    },
    errors: function () { return WE.errors; },
    source: function () { return audio.currentSrc || audio.src; },
  };

  /* ---------- boot overlay: the RUN click is also the media user gesture ---------- */
  const boot = document.getElementById('boot');
  const bootBtn = document.getElementById('boot-btn');
  function startShow() {
    boot.style.display = 'none';
    WE.playPause(true);
  }
  if (bootBtn) bootBtn.addEventListener('click', startShow);
  window.addEventListener('keydown', function once() {
    if (boot && boot.style.display !== 'none') startShow();
    window.removeEventListener('keydown', once);
  });
  const el = (id, v) => { const n = document.getElementById(id); if (n) n.textContent = v; };
  el('boot-audio', (window.WE_SINGLE ? 'embedded in this file' : WE_AUDIO.file) + '  (' + (WE_AUDIO.bytes / 1048576).toFixed(1) + ' MB, ' + WE_AUDIO.duration.toFixed(2) + ' s)');
  el('boot-midi', WE_NOTES.count + ' note events, ' + WE_NOTES.bpm + ' BPM grid, ' + WE_NOTES.span[0] + '-' + WE_NOTES.span[1] + ' s');
  el('boot-lrc', WE_LYRICS.count + ' sung lines, measured timestamps, last at ' + WE_LYRICS.lastStart + ' s');

  requestAnimationFrame(tick);
})();
