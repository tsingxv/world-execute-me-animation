/* scenes-2.js — the tender act, the multilingual count-in, and the EXECUTION
   process factory: one entity, eighteen appearances.
   Every k selects a different mechanism, while pid, corruption, hue lineage and the
   lineage strip under the card advance monotonically, so the barrage reads as a single
   process escalating rather than 18 unrelated slides. */
(function () {
  const WE = (window.WE = window.WE || {});
  const S = (WE.scenes = WE.scenes || {});
  const { clamp, lerp, rnd, noise, wander, easeOut, easeInOut, pulse, rgba, mix } = WE;
  const { panel, caret, label, meter, typed, scramble } = WE;

  /* ---------- tender act ---------- */

  S.study = function (g, E) {
    const p = E.p, st = E.stage, pal = E.pal;
    const cx = st.x + st.w / 2, cy = st.y + st.h * 0.47;
    const w = st.w * 0.34, h = st.h * 0.6;
    const k = easeOut(clamp(E.line.age / 1.0, 0, 1));
    for (const sx of [-1, 1]) {
      g.save();
      g.translate(cx + sx * w * 0.02, cy);
      g.transform(1, 0, sx * -0.06, 1, 0, 0);
      WE.rrect(g, sx < 0 ? -w : 0, -h / 2, w, h, 3 * E.u, { color: rgba(pal.ink, 0.4), width: 1.2 * E.u, fill: rgba(pal.fog, 0.55) });
      const rows = 9;
      for (let i = 0; i < rows; i++) {
        const yy = -h / 2 + 12 * E.u + (i * (h - 20 * E.u)) / rows;
        const lw = (0.35 + 0.6 * rnd(i + (sx > 0 ? 5 : 0), 121)) * (w - 20 * E.u);
        const on = clamp(k * rows - i, 0, 1);
        WE.line(g, (sx < 0 ? -w : 0) + 10 * E.u, yy, (sx < 0 ? -w : 0) + 10 * E.u + lw * on, yy, { color: rgba(pal.ink, 0.25 + 0.3 * on), width: 1.4 * E.u });
      }
      g.restore();
    }
    if (p.mode === 'flip') {
      const turning = clamp(Math.abs(Math.sin(E.t * 0.9)), 0, 1);
      g.save();
      g.translate(cx, cy);
      g.transform(1, 0, -0.5 * turning, 1, 0, 0);
      WE.rrect(g, 0, -h / 2, w * (1 - turning * 0.7), h, 3 * E.u, { color: rgba(pal.accent, 0.5), width: 1 * E.u, fill: rgba(pal.ink, 0.06) });
      g.restore();
      label(g, E, 'chapter 4: loving, correctly', cx, cy + h * 0.66, { align: 'center', size: 11.5, color: rgba(pal.accent, 0.75), spacing: 2.4 * E.u });
    } else {
      label(g, E, 'chapter: --', cx, cy + h * 0.66, { align: 'center', size: 11, color: rgba(pal.ink, 0.45), spacing: 2 * E.u });
    }
    WE.line(g, cx - w * 0.6, cy - h * 0.1, cx - w * 0.6 + w * 1.2 * k, cy - h * 0.1, { color: rgba(pal.glow, 0.7), width: 3 * E.u });
  };

  S.answer = function (g, E) {
    const p = E.p, st = E.stage, pal = E.pal;
    const cx = st.x + st.w / 2, cy = st.y + st.h * 0.46;
    const k = clamp(E.line.age / (p.mode === 'flood' ? 1.4 : 0.8), 0, 1);
    const qs = ['what is love?', 'is it commutative?', 'does it decay?', 'are we closed?', 'divide by zero?', 'me + you = ?'];
    if (p.mode === 'prompt') {
      const shown = typed(qs[0], k);
      WE.text(g, '?', cx - st.w * 0.2, cy - st.h * 0.2, { size: 60 * E.u, color: rgba(pal.glow, 0.18 * k), align: 'center' });
      WE.text(g, shown, cx, cy, { align: 'center', size: 20 * E.u, color: rgba(pal.ink, 0.85 * k), spacing: 2 * E.u, glow: 12 * E.u, glowColor: rgba(pal.glow, 0.8) });
      caret(g, cx + WE.textW(g, shown, { size: 20 * E.u, spacing: 2 * E.u }) / 2 + 4 * E.u, cy, 12 * E.u, pal, E.t);
    } else {
      const n = Math.floor(k * qs.length);
      for (let i = 0; i < n; i++) {
        const yy = cy - st.h * 0.3 + i * st.h * 0.13;
        const j = wander(i, E.t, 0.25, 9) * 3 * E.u;
        WE.text(g, qs[i], cx - st.w * 0.24 + j, yy, { size: 12 * E.u, color: rgba(pal.ink, 0.5), spacing: 0.6 * E.u });
        WE.text(g, 'yes', cx + st.w * 0.18 - j, yy, { size: 12 * E.u, color: rgba(pal.accent, 0.8), spacing: 1 * E.u });
        WE.line(g, cx - st.w * 0.24, yy + 9 * E.u, cx + st.w * 0.24, yy + 9 * E.u, { color: rgba(pal.ink, 0.12), width: 1 });
      }
    }
  };

  S.formula = function (g, E) {
    const st = E.stage, pal = E.pal;
    const cx = st.x + st.w / 2, cy = st.y + st.h * 0.44;
    const k = easeOut(clamp(E.line.age / 1.2, 0, 1));
    const terms = ['love', '=', 'lim', 'n->inf', '(1 + 1/n)^n'];
    const widths = terms.map((t) => WE.textW(g, t, { size: 26 * E.u, spacing: 2 * E.u }));
    const total = widths.reduce((a, b) => a + b, 0) + 14 * E.u * terms.length;
    let x = cx - total / 2;
    for (let i = 0; i < terms.length; i++) {
      const kk = clamp(k * terms.length - i, 0, 1);
      if (kk <= 0) continue;
      WE.text(g, terms[i], x, cy + (i === 2 ? -10 * E.u : 0), {
        size: 26 * E.u, color: rgba(i === 0 ? pal.glow : pal.ink, 0.5 + 0.5 * kk), spacing: 2 * E.u, alpha: kk,
        glow: i === 0 ? 20 * E.u : 0, glowColor: rgba(pal.glow, 0.9),
      });
      x += widths[i] + 14 * E.u;
    }
    const e = 2.718281828 * easeOut(clamp((E.line.age - 0.9) / 1.2, 0, 1));
    label(g, E, '= ' + e.toFixed(9), cx, cy + 52 * E.u, { align: 'center', size: 16, color: rgba(pal.accent, 0.8), spacing: 2 * E.u });
    WE.ring(g, cx, cy, Math.min(st.w, st.h) * 0.36, { color: rgba(pal.glow, 0.12), width: 1 * E.u, dash: [4 * E.u, 8 * E.u] });
  };

  S.free = function (g, E) {
    const p = E.p, st = E.stage, pal = E.pal;
    const cx = st.x + st.w / 2, cy = st.y + st.h * 0.46;
    const R = Math.min(st.w, st.h) * 0.32;
    const k = easeOut(clamp(E.line.age / 1.1, 0, 1));
    if (p.mode === 'sky') {
      // you: an open field of drifting marks, nothing enclosing them
      for (let i = 0; i < 30; i++) {
        const a = rnd(i, 131) * Math.PI * 2, sp = 0.2 + rnd(i, 132), d = R * (0.35 + rnd(i, 133) * 1.5);
        const x = cx + R * 0.75 + Math.cos(a + E.t * sp * 0.4) * d * 0.5;
        const y = cy - R * 0.4 + Math.sin(a + E.t * sp * 0.3) * d * 0.35;
        WE.line(g, x - 5 * E.u, y, x + 5 * E.u, y, { color: rgba(pal.ink, 0.25 + 0.3 * rnd(i, 134)), width: 1 * E.u });
      }
      label(g, E, 'you: free', cx + R * 0.75, cy - R * 0.9, { align: 'center', size: 12, color: rgba(pal.ink, 0.5), spacing: 2 * E.u });
      WE.ring(g, cx - R * 0.75, cy + R * 0.35, R * 0.3 * k, { color: rgba(pal.glow, 0.7), width: 2 * E.u });
      WE.disc(g, cx - R * 0.75, cy + R * 0.35, 5 * E.u, rgba(pal.accent, 0.9), { glow: 16 * E.u, glowColor: rgba(pal.accent, 1) });
      label(g, E, 'me: bound', cx - R * 0.75, cy + R * 0.95, { align: 'center', size: 12, color: rgba(pal.glow, 0.6), spacing: 2 * E.u });
    } else {
      // the doubled word — the cage comes back, but warm, and the label doubles
      for (const spec of [[-1, 1, 0.75], [1, 0.72, 0.45], [1, 0.5, 0.22]]) {
        WE.ring(g, cx + spec[0] * R * spec[1] * 0.42, cy, R * spec[1], { color: rgba(pal.glow, spec[2] * (0.4 + 0.6 * k)), width: 2 * E.u, dash: [8 * E.u, 6 * E.u] });
      }
      WE.disc(g, cx, cy, (6 + 3 * Math.sin(E.t * 2)) * E.u, rgba(pal.accent, 0.9), { glow: 22 * E.u, glowColor: rgba(pal.glow, 1) });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + E.t * 0.6;
        WE.line(g, cx + Math.cos(a) * R * 1.02, cy + Math.sin(a) * R * 1.02, cx + Math.cos(a) * R * 1.14, cy + Math.sin(a) * R * 1.14, { color: rgba(pal.ink, 0.3), width: 2 * E.u });
      }
      label(g, E, 'trapped', cx - 26 * E.u, cy - R * 1.2, { size: 14, color: rgba(pal.ink, 0.55 * k), spacing: 2 * E.u });
      label(g, E, 'trapped', cx + 26 * E.u, cy - R * 1.2 + 8 * E.u, { size: 14, color: rgba(pal.glow, 0.45 * k), spacing: 2 * E.u });
    }
  };

  /* ---------- count-in in four languages ---------- */
  S.count = function (g, E) {
    const p = E.p, st = E.stage, pal = E.pal;
    const cx = st.x + st.w / 2, cy = st.y + st.h * 0.46;
    const words = p.langs || [];
    const k = clamp(E.line.age / 1.0, 0, 1);
    for (let i = 0; i < words.length; i++) {
      const kk = clamp(k * words.length - i, 0, 1);
      if (kk <= 0) continue;
      const x = cx + (i - (words.length - 1) / 2) * st.w * 0.16;
      const y = cy + wander(i, E.t, 0.18, 4) * 6 * E.u;
      WE.text(g, words[i], x, y, {
        align: 'center', size: (20 + 10 * kk) * E.u, color: rgba(mix(pal.ink, pal.glow, i / words.length), 0.4 + 0.55 * kk),
        spacing: 1.5 * E.u, alpha: kk, glow: 14 * E.u * kk, glowColor: rgba(pal.glow, 0.9),
      });
      label(g, E, String(i + 1 + (words.length === 2 ? 4 : 0)), x, y + 30 * E.u, { align: 'center', size: 10, color: rgba(pal.accent, 0.5 * kk) });
    }
    // the count is really a carry: the numeral base keeps overflowing
    WE.rrect(g, cx - st.w * 0.3, cy + st.h * 0.26, st.w * 0.6, 26 * E.u, 3 * E.u, { color: rgba(pal.ink, 0.35), width: 1 * E.u, fill: rgba(pal.fog, 0.5) });
    WE.text(g, 'base ' + (2 + Math.floor(k * 5)) + '  carry ' + Math.floor(k * 7), cx, cy + st.h * 0.26 + 13 * E.u, { align: 'center', size: 11 * E.u, color: rgba(pal.accent, 0.7), spacing: 2 * E.u });
  };

  /* =====================================================================
   * EXECUTION — the process object, 18 states
   * ===================================================================== */

  const MODES = [
    'print', 'spawn', 'fork', 'echo', 'stack', 'shear', 'aberrate', 'rotor',
    'decrypt', 'shatter', 'invert', 'modulate', 'table', 'recurse', 'broadcast',
    'singularity', 'step', 'return',
  ];

  // one identity, advanced by k: nothing here is random, all of it is lineage
  function identity(k) {
    return {
      pid: 4096 + k * 37,
      cpu: 12 + k * 5.2,
      depth: k,
      corruption: k / 17,
      // hue walks cyan -> magenta -> white hot as the process degrades
      tint: mix(mix([120, 230, 255], [255, 90, 220], clamp(k / 13, 0, 1)), [255, 255, 255], clamp((k - 12) / 5, 0, 1)),
      scale: 1 + 0.045 * k,
      rot: (k % 2 ? 1 : -1) * 0.006 * k,
    };
  }

  // the process card every occurrence shares — the entity's body
  function card(g, E, id, k, o) {
    const st = E.stage, pal = E.pal;
    const w = st.w * 0.52 * id.scale, h = st.h * 0.44 * id.scale;
    const cx = st.x + st.w / 2 + wander(k, E.t, 0.5, 12) * id.corruption * 14 * E.u;
    const cy = st.y + st.h * 0.46 + wander(k * 3, E.t, 0.5, 13) * id.corruption * 10 * E.u;
    g.save();
    g.translate(cx, cy);
    g.rotate(id.rot * (1 + E.energy.air * 0.5));
    g.translate(-cx, -cy);
    WE.rrect(g, cx - w / 2, cy - h / 2, w, h, 4 * E.u, {
      color: rgba(id.tint, 0.55 + 0.4 * id.corruption), width: (1.4 + 1.2 * id.corruption) * E.u,
      fill: rgba(mix(pal.fog, id.tint, 0.08), 0.55), glow: (14 + 26 * id.corruption) * E.u, glowColor: rgba(id.tint, 0.7),
    });
    // header strip, identical on every appearance
    const hy = cy - h / 2;
    g.save();
    g.globalAlpha = 0.7;
    g.fillStyle = rgba(id.tint, 0.16);
    g.fillRect(cx - w / 2, hy, w, 18 * E.u);
    g.restore();
    WE.text(g, 'proc#' + id.pid + '  state=R', cx - w / 2 + 8 * E.u, hy + 9 * E.u, { size: 10 * E.u, color: rgba(id.tint, 0.9), spacing: 1 * E.u });
    WE.text(g, 'cpu ' + Math.min(999, id.cpu * (o && o.busy ? 1.6 : 1)).toFixed(1) + '%', cx + w / 2 - 8 * E.u, hy + 9 * E.u, { size: 10 * E.u, color: rgba(id.tint, 0.7), align: 'right', spacing: 1 * E.u });
    // lineage strip: 18 cells, the ones already spent filled in
    const sw = 9 * E.u, gap = 3 * E.u, tw = 18 * (sw + gap);
    const sx0 = cx - tw / 2, sy = cy + h / 2 + 12 * E.u;
    for (let i = 0; i < 18; i++) {
      const done = i < k, now = i === k;
      WE.rrect(g, sx0 + i * (sw + gap), sy, sw, 8 * E.u, 1.5 * E.u, {
        color: rgba(id.tint, now ? 0.95 : 0.35), width: 1 * E.u,
        fill: done || now ? rgba(id.tint, now ? 0.9 : 0.4) : 'rgba(0,0,0,0)',
        glow: now ? 12 * E.u : 0, glowColor: rgba(id.tint, 1),
      });
    }
    WE.text(g, 'EXECUTION ' + (k + 1) + ' / 18   mode: ' + MODES[k], sx0, sy + 22 * E.u, { size: 9.5 * E.u, color: rgba(id.tint, 0.6), spacing: 1.4 * E.u });
    g.restore();
    return { cx, cy, w, h };
  }

  // the word itself, drawn with per-mode distortion around (b)
  function word(g, E, b, id, k, mode, prog) {
    const pal = E.pal;
    const size = Math.min(b.w * 0.14, 46 * E.u) * (1 + 0.06 * k);
    const T = 'EXECUTION';
    const full = WE.textW(g, T, { size, spacing: size * 0.06 });
    const x0 = b.cx - full / 2;
    const alpha = clamp(prog * 3, 0, 1) * (1 - clamp((prog - 0.85) / 0.15, 0, 1) * (mode === 'return' ? 1 : 0.15));

    if (mode === 'print') {
      const shown = typed(T, easeOut(clamp(prog * 1.6, 0, 1)));
      WE.text(g, shown, x0, b.cy, { size, color: rgba(id.tint, 0.95), spacing: size * 0.06, glow: 18 * E.u, glowColor: rgba(id.tint, 0.9) });
      caret(g, x0 + WE.textW(g, shown, { size, spacing: size * 0.06 }) + 4 * E.u, b.cy, size * 0.5, { accent: id.tint }, E.t);
    } else if (mode === 'spawn') {
      const dx = lerp(-b.w * 0.6, 0, easeOut(clamp(prog * 1.8, 0, 1)));
      WE.text(g, T, b.cx + dx, b.cy, { align: 'center', size, color: rgba(id.tint, 0.95 * alpha), spacing: size * 0.06, glow: 20 * E.u, glowColor: rgba(id.tint, 0.9) });
      WE.ring(g, b.cx, b.cy, size * (0.6 + prog * 3) * 1.6, { color: rgba(id.tint, (1 - prog) * 0.5), width: 1.5 * E.u });
    } else if (mode === 'fork') {
      const sp = easeOut(clamp(prog * 1.5, 0, 1)) * b.w * 0.18;
      for (const sx of [-1, 1]) {
        WE.text(g, T, b.cx + sx * sp, b.cy, { align: 'center', size, color: rgba(mix(id.tint, sx < 0 ? [120, 200, 255] : [255, 140, 220], 0.5), 0.85 * alpha), spacing: size * 0.06, glow: 16 * E.u, glowColor: rgba(id.tint, 0.8) });
      }
      WE.line(g, b.cx, b.cy - size, b.cx, b.cy + size, { color: rgba(id.tint, 0.5), width: 1 * E.u, dash: [3 * E.u, 3 * E.u] });
    } else if (mode === 'echo') {
      for (let i = 5; i >= 0; i--) {
        const d = i * (4 + 10 * prog) * E.u;
        WE.text(g, T, b.cx - d, b.cy - i * 3 * E.u, { align: 'center', size: size * (1 - i * 0.04), color: rgba(id.tint, (0.7 - i * 0.11) * alpha), spacing: size * 0.06 });
      }
    } else if (mode === 'stack') {
      g.save();
      g.beginPath();
      g.rect(b.cx - b.w / 2, b.cy - b.h / 2, b.w, b.h);
      g.clip();
      const rows = 7;
      for (let i = 0; i < rows; i++) {
        const yy = b.cy + (i - rows / 2) * size * 0.62 + prog * size * 0.62;
        WE.text(g, T, b.cx + (i % 2 ? 1 : -1) * (6 + i * 4) * E.u, yy, { align: 'center', size: size * 0.62, color: rgba(id.tint, (0.85 - i * 0.1) * alpha), spacing: size * 0.05 });
      }
      g.restore();
      label(g, E, 'RangeError: stack depth ' + (128 + k * 64), b.cx, b.cy + b.h * 0.42, { align: 'center', size: 10, color: rgba([255, 130, 130], 0.8 * alpha), spacing: 1.4 * E.u });
    } else if (mode === 'shear') {
      const bands = 9;
      for (let i = 0; i < bands; i++) {
        const off = (rnd(i, Math.floor(E.t * 9)) - 0.5) * b.w * 0.35 * id.corruption;
        g.save();
        g.beginPath();
        g.rect(b.cx - b.w / 2, b.cy - size * 0.6 + (i / bands) * size * 1.2, b.w, (size * 1.2) / bands);
        g.clip();
        WE.text(g, T, b.cx + off, b.cy, { align: 'center', size, color: rgba(id.tint, 0.92 * alpha), spacing: size * 0.06 });
        g.restore();
      }
    } else if (mode === 'aberrate') {
      const sep = (2 + 14 * id.corruption) * E.u * (1 + E.energy.high);
      const chans = [[[255, 60, 60], -sep], [[60, 255, 120], 0], [[70, 120, 255], sep]];
      for (const [c, dx] of chans) {
        g.save();
        g.globalCompositeOperation = 'lighter';
        WE.text(g, T, b.cx + dx, b.cy, { align: 'center', size, color: rgba(c, 0.8 * alpha), spacing: size * 0.06 });
        g.restore();
      }
    } else if (mode === 'rotor') {
      g.save();
      g.translate(b.cx, b.cy);
      g.rotate(lerp(0, -Math.PI / 2, easeInOut(clamp(prog * 1.4, 0, 1))));
      WE.text(g, T, 0, 0, { align: 'center', size: size * 0.9, color: rgba(id.tint, 0.95 * alpha), spacing: size * 0.06, glow: 18 * E.u, glowColor: rgba(id.tint, 0.9) });
      g.restore();
      for (let i = 0; i < 12; i++) {
        const yy = b.cy - b.h * 0.4 + (i / 11) * b.h * 0.8;
        WE.line(g, b.cx + b.w * 0.3, yy, b.cx + b.w * 0.3 + (4 + 26 * rnd(i, 5)) * E.u * prog, yy, { color: rgba(id.tint, 0.5), width: 1.5 * E.u });
      }
    } else if (mode === 'decrypt') {
      WE.text(g, scramble(T, easeOut(clamp(prog * 1.25, 0, 1)), k * 17, E.t), b.cx, b.cy, { align: 'center', size, color: rgba(id.tint, 0.95 * alpha), spacing: size * 0.06 });
    } else if (mode === 'shatter') {
      for (let i = 0; i < T.length; i++) {
        const a = (rnd(i + k, 141) - 0.5) * Math.PI;
        const d = easeOut(prog) * (10 + 120 * rnd(i + k, 142)) * E.u;
        const chX = b.cx - full / 2 + (i + 0.5) * (full / T.length) + Math.cos(a) * d;
        const chY = b.cy + Math.sin(a) * d;
        g.save();
        g.globalAlpha = alpha * (1 - prog * 0.7);
        g.translate(chX, chY);
        g.rotate((rnd(i, 143) - 0.5) * prog * 2);
        WE.text(g, T[i], 0, 0, { align: 'center', size, color: rgba(id.tint, 0.9), spacing: 0 });
        g.restore();
      }
    } else if (mode === 'invert') {
      const bw = b.w * 0.92, bh = size * 1.5;
      g.save();
      g.globalAlpha = alpha;
      g.fillStyle = rgba(id.tint, 0.95);
      g.fillRect(b.cx - bw / 2, b.cy - bh / 2, bw, bh);
      g.globalCompositeOperation = 'destination-out';
      WE.text(g, T, b.cx, b.cy, { align: 'center', size, color: 'rgba(0,0,0,1)', spacing: size * 0.06 });
      g.restore();
    } else if (mode === 'modulate') {
      const pts = [];
      for (let i = 0; i < T.length; i++) {
        const chX = b.cx - full / 2 + (i + 0.5) * (full / T.length);
        const amp = b.h * 0.22 * (0.4 + E.energy.mid);
        pts.push([chX, b.cy + Math.sin(i * 0.8 + E.t * 4) * amp]);
      }
      for (let i = 0; i < T.length; i++) {
        WE.text(g, T[i], pts[i][0], pts[i][1], { align: 'center', size, color: rgba(mix(id.tint, pal.ink, i / T.length), 0.92 * alpha), spacing: 0 });
      }
      WE.path(g, pts, { color: rgba(id.tint, 0.28 * alpha), width: 1 * E.u });
    } else if (mode === 'table') {
      // the process table: every earlier EXECUTION is still listed as a running row
      const rows = [];
      const hist = (WE.data && WE.data.executions) || [];
      for (let i = 0; i <= Math.min(k, hist.length - 1); i++) rows.push(hist[i]);
      const top = b.cy - b.h * 0.34;
      const rowH = Math.min(b.h * 0.68 / 18, 13 * E.u);
      label(g, E, 'PID      CPU    STARTED      COMMAND', b.cx - b.w * 0.42, top, { size: 9.5, color: rgba(id.tint, 0.7), spacing: 0.8 * E.u });
      const shown = Math.floor(clamp(prog * 1.3, 0, 1) * rows.length);
      for (let i = 0; i < shown; i++) {
        const yy = top + (i + 1) * rowH;
        const cur = i === shown - 1;
        WE.text(g, String(4096 + i * 37).padStart(6, ' ') + '  ' + (12 + i * 5.2).toFixed(1).padStart(5, ' ') + '%  ' + WE.mmss(rows[i].t).padEnd(11, ' ') + '  EXECUTION', b.cx - b.w * 0.42, yy, {
          size: Math.min(10 * E.u, rowH * 0.9), color: cur ? rgba(id.tint, 0.98) : rgba(id.tint, 0.45), spacing: 0.6 * E.u,
          glow: cur ? 12 * E.u : 0, glowColor: rgba(id.tint, 0.9),
        });
      }
    } else if (mode === 'recurse') {
      const depth = 5;
      for (let i = 0; i < depth; i++) {
        const sc = 1 - i * 0.14;
        const ind = i * 18 * E.u * prog;
        WE.text(g, T, b.cx + ind, b.cy - i * size * 0.32, { align: 'center', size: size * sc * 0.8, color: rgba(id.tint, (0.9 - i * 0.13) * alpha), spacing: size * 0.05 });
        WE.text(g, '{', b.cx - full * sc * 0.55 + ind, b.cy - i * size * 0.32, { size: size * sc * 0.9, color: rgba(id.tint, 0.3), alpha });
      }
      label(g, E, 'depth ' + id.depth, b.cx, b.cy + b.h * 0.4, { align: 'center', size: 10, color: rgba(id.tint, 0.6 * alpha), spacing: 2 * E.u });
    } else if (mode === 'broadcast') {
      WE.text(g, T, b.cx, b.cy, { align: 'center', size, color: rgba(id.tint, 0.98 * alpha), spacing: size * 0.06, glow: 24 * E.u, glowColor: rgba(id.tint, 1) });
      const n = 14;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + E.t * 0.3;
        const d = b.w * (0.42 + 0.28 * prog);
        const tx = b.cx + Math.cos(a) * d, ty = b.cy + Math.sin(a) * d * 0.6;
        WE.line(g, b.cx, b.cy, tx, ty, { color: rgba(id.tint, 0.3 * alpha), width: 1 * E.u, dash: [4 * E.u, 4 * E.u] });
        WE.text(g, 'exe', tx, ty, { align: 'center', size: 9 * E.u, color: rgba(id.tint, 0.75 * alpha), spacing: 0 });
      }
    } else if (mode === 'singularity') {
      const k2 = easeInOut(clamp(prog * 1.2, 0, 1));
      for (let i = 0; i < 16; i++) {
        const a = rnd(i + k, 151) * Math.PI * 2;
        const d = lerp(b.w * (0.3 + rnd(i, 152) * 0.9), 0, k2);
        WE.text(g, T, b.cx + Math.cos(a) * d, b.cy + Math.sin(a) * d * 0.6, { align: 'center', size: size * 0.5, color: rgba(id.tint, (1 - k2) * 0.5), spacing: 0 });
      }
      WE.bloom(g, b.cx, b.cy, size * (1.2 + 2 * (1 - k2)), rgba(id.tint, 1), 0.6 * alpha);
      WE.text(g, T, b.cx, b.cy, { align: 'center', size, color: rgba([255, 255, 255], 0.95 * alpha), spacing: size * 0.06, glow: 30 * E.u, glowColor: rgba(id.tint, 1) });
    } else if (mode === 'step') {
      // a debugger stepping through the call: the line highlight walks down
      const lines = ['function world.execute(me) {', '  if (can) {', '    return EXECUTION;', '  }', '}'];
      const cur = Math.floor(clamp(prog * 1.3, 0, 1) * lines.length) % (lines.length + 1);
      for (let i = 0; i < lines.length; i++) {
        const yy = b.cy - size * 0.9 + i * size * 0.52;
        const on = i === cur;
        if (on) {
          g.save();
          g.globalAlpha = 0.22 * alpha;
          g.fillStyle = rgba(id.tint, 1);
          g.fillRect(b.cx - b.w * 0.45, yy - size * 0.3, b.w * 0.9, size * 0.6);
          g.restore();
        }
        WE.text(g, lines[i], b.cx - b.w * 0.42, yy, { size: size * 0.38, color: rgba(on ? id.tint : pal.ink, (on ? 0.95 : 0.45) * alpha), spacing: 0.8 * E.u });
      }
    } else {
      // return: one quiet print, then the caret goes out
      const fadeOut = 1 - clamp((prog - 0.55) / 0.45, 0, 1);
      WE.text(g, 'return EXECUTION;', b.cx, b.cy - size * 0.2, { align: 'center', size: size * 0.78, color: rgba(id.tint, 0.9 * fadeOut), spacing: size * 0.05, glow: 22 * E.u * fadeOut, glowColor: rgba(id.tint, 0.9) });
      WE.text(g, T, b.cx, b.cy + size * 0.55, { align: 'center', size: size * 0.4, color: rgba(pal.ink, 0.55 * fadeOut), spacing: size * 0.12 });
      if (fadeOut > 0.2) caret(g, b.cx + WE.textW(g, 'return EXECUTION;', { size: size * 0.78, spacing: size * 0.05 }) / 2 + 4 * E.u, b.cy - size * 0.2, size * 0.4, { accent: id.tint }, E.t);
    }
  }

  S.execution = function (g, E) {
    const k = E.p.k === undefined ? 0 : E.p.k;
    const id = identity(k);
    const prog = clamp(E.line.age / Math.max(0.35, (E.line.end - E.line.start) * 0.8), 0, 1);
    const mode = MODES[k];
    const b = card(g, E, id, k, { busy: k > 8 });
    word(g, E, b, id, k, mode, prog);
    // chord from the MIDI at this exact instant, so the card is driven by the score
    const chord = WE.data.chordAt(E.t);
    if (chord.size) {
      for (let i = 0; i < chord.classes.length; i++) {
        const pc = chord.classes[i];
        WE.ring(g, b.cx, b.cy, (b.h * 0.5 + 6 + i * 4) * E.u, { a0: (pc / 12) * Math.PI * 2, a1: (pc / 12) * Math.PI * 2 + 0.5, color: rgba(id.tint, 0.4), width: 2 * E.u });
      }
    }
    if (E.p.word) label(g, E, E.p.word, b.cx, b.cy - b.h * 0.62, { align: 'center', size: 12, color: rgba(id.tint, 0.55), spacing: 2.6 * E.u });
    if (E.p.terminal) {
      const f = 1 - clamp((prog - 0.7) / 0.3, 0, 1);
      g.save();
      g.globalAlpha = f * 0.5;
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.fillRect(b.cx - b.w / 2, b.cy - b.h / 2, b.w * prog, 2 * E.u);
      g.restore();
    }
  };
  S.execution.MODES = MODES;
})();
