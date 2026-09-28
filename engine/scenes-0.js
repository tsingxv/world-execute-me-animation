/* scenes-0.js — ACT 0 (power-on, object creation), the DEFINITION block (each line
   names a shape and the measure taken from it), and the switching pair. */
(function () {
  const WE = (window.WE = window.WE || {});
  const S = (WE.scenes = WE.scenes || {});
  const { clamp, lerp, rnd, noise, wander, easeOut, easeInOut, pulse, rgba, mix } = WE;
  const { panel, caret, label, meter, typed } = WE;

  S.boot = function (g, E) {
    const p = E.p, st = E.stage, pal = E.pal;
    const w = st.w * 0.62, h = st.h * 0.5, x = st.x + (st.w - w) / 2, y = st.y + st.h * 0.16;
    panel(g, E, { x, y, w, h, title: 'shell // act0', footer: 'lrc line ' + E.line.index + ' @ ' + WE.mmss(E.line.start) });
    const cmd = p.cmd || '> ready';
    const k = easeOut(clamp(E.line.age / 0.55, 0, 1));
    const shown = typed(cmd, k);
    label(g, E, '$', x + 14 * E.u, y + 26 * E.u, { color: rgba(pal.accent, 0.8), size: 15 });
    WE.text(g, shown, x + 34 * E.u, y + 26 * E.u, { size: 15 * E.u, color: rgba(pal.ink, 0.95), spacing: 0.8 * E.u, glow: p.hint ? 0 : 12 * E.u, glowColor: rgba(pal.glow, 0.9) });
    caret(g, x + 38 * E.u + WE.textW(g, shown, { size: 15 * E.u, spacing: 0.8 * E.u }), y + 26 * E.u, 9 * E.u, pal, E.t);
    // the power line itself: a rail that closes when the switch throws
    const railY = y + h * 0.62, gapX = x + w / 2;
    const closed = p.action ? k : 0.15;
    WE.line(g, x + 16 * E.u, railY, gapX - 26 * E.u * closed, railY, { color: rgba(pal.accent, 0.9), width: 3 * E.u, glow: 14 * E.u, glowColor: rgba(pal.glow, 0.9) });
    WE.line(g, gapX + 26 * E.u * (1 - closed) + 10 * E.u, railY, x + w - 16 * E.u, railY, { color: rgba(pal.ink, 0.4), width: 2 * E.u });
    g.save();
    g.translate(gapX, railY);
    g.rotate(lerp(-0.75, 0.75, closed));
    WE.rrect(g, -3 * E.u, -30 * E.u, 6 * E.u, 30 * E.u, 3 * E.u, { color: rgba(pal.ink, 0.8), fill: rgba(pal.ink, 0.16), width: 1.4 * E.u });
    g.restore();
    WE.disc(g, gapX, railY, 4 * E.u, rgba(pal.ink, 0.9));
    if (p.hint) {
      label(g, E, 'protective layer: OFF -> ON', x + w / 2, y + h - 22 * E.u, { align: 'center', color: rgba(pal.accent, 0.4 + 0.6 * Math.abs(noise(3, E.t, 0.4, 2) * 2 - 1)) });
    }
  };

  S.construct = function (g, E) {
    const p = E.p, st = E.stage, pal = E.pal;
    const cx = st.x + st.w / 2, cy = st.y + st.h * 0.46;
    const R = Math.min(st.w, st.h) * 0.24;
    const k = easeOut(clamp(E.line.age / 0.9, 0, 1));
    if (p.shape === 'shield') {
      // a membrane closing over the self, arc by arc
      for (let i = 0; i < 9; i++) {
        const kk = clamp(k * 9 - i, 0, 1);
        if (kk <= 0) continue;
        const a0 = -Math.PI / 2 + (i / 9) * Math.PI * 2;
        WE.ring(g, cx, cy, R * (0.72 + 0.03 * i), {
          a0, a1: a0 + ((Math.PI * 2) / 9) * kk,
          color: rgba(mix(pal.accent, pal.glow, i / 9), 0.75 - i * 0.05), width: (2.2 - i * 0.12) * E.u,
          glow: i === 0 ? 16 * E.u : 0, glowColor: rgba(pal.glow, 0.8),
        });
      }
      label(g, E, p.label, cx, cy + R * 1.42, { align: 'center', size: 13, color: rgba(pal.accent, 0.85), spacing: 3 * E.u });
    } else if (p.shape === 'pieces') {
      // the board laid down: pieces fall and lock into a grid
      const cols = 8, rows = 5;
      const bw = (R * 2) / cols, bh = (R * 1.4) / rows;
      for (let i = 0; i < cols * rows; i++) {
        const ci = i % cols, ri = (i / cols) | 0;
        const kk = clamp((E.line.age - (ci + ri) * 0.055) / 0.5, 0, 1);
        if (kk <= 0) continue;
        const tx = cx - R + ci * bw + bw / 2;
        const ty = cy - R * 0.7 + ri * bh + bh / 2;
        g.save();
        g.globalAlpha = kk;
        WE.square(g, tx, lerp(ty - 260 * E.u * (1 - kk), ty, easeOut(kk)), bw * 0.78, rgba(mix(pal.ink, pal.glow, kk), 0.22 + 0.5 * kk), { rot: (1 - kk) * 2 });
        g.restore();
      }
      WE.rrect(g, cx - R, cy - R * 0.7, R * 2, R * 1.4, 4 * E.u, { color: rgba(pal.ink, 0.3), width: 1 * E.u, dash: [6 * E.u, 5 * E.u] });
    } else {
      // new Object(): fields materialise inside a brace frame
      const fields = ['name', 'body', 'voice', 'want'];
      const k2 = easeOut(clamp(E.line.age / 1.1, 0, 1));
      WE.rrect(g, cx - R * 1.3, cy - R * 0.95, R * 2.6, R * 1.9, 10 * E.u, { color: rgba(pal.glow, 0.8), width: 2 * E.u, glow: 18 * E.u, glowColor: rgba(pal.glow, 0.7) });
      label(g, E, '{', cx - R * 1.3 + 8 * E.u, cy - R * 0.95 + 12 * E.u, { size: 22, color: rgba(pal.accent, 0.7) });
      label(g, E, '}', cx - R * 1.3 + R * 2.6 - 22 * E.u, cy + R * 0.95 - 12 * E.u, { size: 22, color: rgba(pal.accent, 0.7) });
      for (let i = 0; i < fields.length; i++) {
        const kk = clamp(k2 * fields.length - i, 0, 1);
        if (kk <= 0) continue;
        const yy = cy - R * 0.55 + i * R * 0.42;
        label(g, E, fields[i], cx - R * 1.05, yy, { color: rgba(pal.ink, 0.75 * kk) });
        meter(g, E, cx - R * 0.2, yy - 3 * E.u, R * 1.1, kk * (0.4 + 0.6 * rnd(i, 7)), { color: rgba(pal.glow, 0.75 * kk) });
      }
      label(g, E, p.label, cx, cy + R * 1.28, { align: 'center', size: 13, color: rgba(pal.accent, 0.9), spacing: 2.4 * E.u });
    }
  };

  S.dataform = function (g, E) {
    const p = E.p, st = E.stage, pal = E.pal;
    const w = st.w * 0.52, h = st.h * 0.62;
    const x = st.x + (st.w - w) / 2, y = st.y + st.h * 0.14;
    panel(g, E, { x, y, w, h, title: 'INITIALISE', footer: 'args: me, you' });
    const rows = ['position', 'velocity', 'memory', 'desire', 'limit', 'name'];
    const n = p.rows || 6;
    const k = clamp(E.line.age / (p.commit ? 0.5 : 1.4), 0, 1);
    for (let i = 0; i < n; i++) {
      const yy = y + 26 * E.u + (i * (h - 40 * E.u)) / n;
      const fill = clamp(k * n - i, 0, 1);
      label(g, E, rows[i % rows.length], x + 12 * E.u, yy, { color: rgba(pal.ink, 0.55 + 0.4 * fill) });
      const val = WE.hex(WE.hash(i, 31) % 65536) + ' ' + (rnd(i, 5) * 20).toFixed(2);
      WE.text(g, typed(val, fill), x + w * 0.46, yy, { size: 11 * E.u, color: rgba(pal.accent, 0.35 + 0.6 * fill), spacing: 0.8 * E.u });
      meter(g, E, x + 12 * E.u, yy + 8 * E.u, w - 24 * E.u, fill * (0.3 + 0.7 * rnd(i, 11)), { color: rgba(pal.glow, 0.5), h: 3 });
      if (i < n - 1) WE.line(g, x + 12 * E.u, yy + 16 * E.u, x + w - 12 * E.u, yy + 16 * E.u, { color: rgba(pal.ink, 0.1) });
    }
    if (p.cursor) caret(g, x + w * 0.46 + WE.textW(g, typed(rows[0], k), { size: 11 * E.u }) + 4, y + 26 * E.u, 8 * E.u, pal, E.t);
    if (p.flash) {
      const f = pulse(E.line.age, 0.5);
      g.save();
      g.globalAlpha = f * 0.5;
      g.fillStyle = rgba(pal.accent, 1);
      g.fillRect(x, y, w, 2 * E.u);
      g.restore();
      label(g, E, p.commit, x + w / 2, y + h + 22 * E.u, { align: 'center', size: 15, color: rgba(pal.accent, 0.5 + 0.5 * f), spacing: 4 * E.u, glow: 18 * E.u * f, glowColor: rgba(pal.glow, 0.9) });
    }
  };

  S.worldbuild = function (g, E) {
    const p = E.p, st = E.stage, pal = E.pal;
    const cx = st.x + st.w / 2, cy = st.y + st.h * 0.5;
    const k = easeInOut(clamp(E.line.age / 1.4, 0, 1));
    const R = Math.min(st.w, st.h) * 0.3;
    const iso = (x, y, z) => [cx + (x - y) * R * 0.7, cy + (x + y) * R * 0.36 - z * R * 0.8];
    const cube = [[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
    const verts = cube.map((v) => iso(v[0], v[1], v[2]));
    const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    const drawn = Math.floor(k * edges.length);
    for (let i = 0; i < edges.length; i++) {
      if (i > drawn) continue;
      const kk = i === drawn ? k * edges.length - drawn : 1;
      const a = verts[edges[i][0]], b = verts[edges[i][1]];
      WE.line(g, a[0], a[1], lerp(a[0], b[0], kk), lerp(a[1], b[1], kk), {
        color: rgba(pal.glow, 0.55 + 0.35 * (p.stage === 'run' ? E.energy.rms : 0)), width: 1.6 * E.u,
        glow: p.stage === 'run' ? 10 * E.u : 0, glowColor: rgba(pal.glow, 0.8),
      });
    }
    if (drawn >= 4) {
      for (let i = 0; i < 8; i++) WE.disc(g, verts[i][0], verts[i][1], 2.4 * E.u * clamp(k * 8 - i, 0, 1), rgba(pal.accent, 0.9));
    }
    label(g, E, p.stage === 'frame' ? 'building: world frame' : 'run loop() { }', cx, cy + R * 1.15, { align: 'center', size: 13, color: rgba(pal.accent, 0.8), spacing: 3 * E.u });
    if (p.stage === 'run') {
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2 + E.t * (0.4 + rnd(i, 2) * 0.5);
        const rr = R * (0.2 + 0.5 * rnd(i, 3)) * (1 + 0.08 * E.energy.low);
        WE.disc(g, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.5 + Math.sin(E.t * 2 + i) * 3 * E.u, (1.2 + 2.6 * rnd(i, 4)) * E.u, rgba(mix(pal.ink, pal.glow, rnd(i, 5)), 0.5));
      }
    }
  };

  /* ---- definitions ---- */
  S.geometry = function (g, E) {
    const p = E.p, st = E.stage, pal = E.pal;
    const cx = st.x + st.w / 2, cy = st.y + st.h * 0.46;
    const W = st.w * 0.66, H = st.h * 0.62;
    const k = easeOut(clamp(E.line.age / 0.8, 0, 1));
    const x = cx - W / 2, y = cy - H / 2;
    panel(g, E, { x: x - 14 * E.u, y: y - 14 * E.u, w: W + 28 * E.u, h: H + 28 * E.u, title: 'DEFINITION ' + (E.line.index - 9), footer: p.give });
    const shape = p.shape;

    if (shape === 'points') {
      const n = Math.floor(6 + 54 * k);
      for (let i = 0; i < n; i++) {
        const px = x + W * rnd(i, 21), py = y + H * rnd(i, 22);
        WE.disc(g, px, py, (1.4 + 3.4 * rnd(i, 23)) * E.u, rgba(mix(pal.ink, pal.accent, rnd(i, 24)), 0.85), { glow: 8 * E.u, glowColor: rgba(pal.glow, 0.9) });
        if (rnd(i, 25) > 0.75) label(g, E, 'P' + i, px + 6 * E.u, py - 6 * E.u, { size: 8.5, color: rgba(pal.ink, 0.45), spacing: 0 });
      }
      label(g, E, '|P| = ' + n, x + W - 4 * E.u, y + H + 16 * E.u, { align: 'right', color: rgba(pal.accent, 0.8) });
    } else if (shape === 'axes') {
      const ax = [[1, 0, 0, 'x'], [0, 1, 0, 'y'], [0.5, 0.5, 1, 'z']];
      const L = Math.min(W, H) * 0.46;
      for (let i = 0; i < 3; i++) {
        const kk = clamp(k * 3 - i, 0, 1);
        if (kk <= 0) continue;
        const d = ax[i];
        const ex = cx + (d[0] - d[1]) * L * kk, ey = cy + (d[0] + d[1]) * L * 0.42 * kk - d[2] * L * 0.72 * kk;
        WE.line(g, cx, cy, ex, ey, { color: rgba(mix(pal.accent, pal.glow, i / 3), 0.9), width: 2 * E.u, glow: 10 * E.u, glowColor: rgba(pal.glow, 0.8) });
        label(g, E, d[3], ex + 8 * E.u, ey - 8 * E.u, { color: rgba(pal.ink, 0.8), size: 13 });
        for (let s = 1; s <= 4; s++) WE.disc(g, lerp(cx, ex, s / 5), lerp(cy, ey, s / 5), 1.6 * E.u, rgba(pal.ink, 0.5));
      }
      label(g, E, 'dim = 3', cx, y + H + 18 * E.u, { align: 'center', color: rgba(pal.accent, 0.85), size: 12, spacing: 2 * E.u });
    } else if (shape === 'circle') {
      WE.ring(g, cx, cy, H * 0.4, { a1: Math.PI * 2 * k, color: rgba(pal.ink, 0.9), width: 2.2 * E.u, glow: 12 * E.u, glowColor: rgba(pal.glow, 0.8) });
      WE.line(g, cx, cy, cx + H * 0.4 * k, cy, { color: rgba(pal.accent, 0.8), width: 1.4 * E.u, dash: [4 * E.u, 3 * E.u] });
      WE.disc(g, cx, cy, 3 * E.u, rgba(pal.accent, 0.9));
      label(g, E, 'r', cx + H * 0.2, cy - 10 * E.u, { color: rgba(pal.accent, 0.9), size: 12 });
    } else if (shape === 'circumference') {
      const R = H * 0.34, ox = cx - W * 0.26;
      const u = easeInOut(clamp((E.line.age - 0.35) / 1.1, 0, 1));
      WE.ring(g, ox, cy, R, { color: rgba(pal.ink, 0.85), width: 2 * E.u });
      const stripY = cy + R + 22 * E.u;
      WE.line(g, ox + R, stripY, ox + R + Math.PI * 2 * R * u, stripY, { color: rgba(pal.accent, 0.9), width: 4 * E.u, glow: 10 * E.u, glowColor: rgba(pal.glow, 0.9) });
      for (let i = 0; i <= Math.floor(24 * u); i++) {
        const a = ((i / 24) * Math.PI * 2);
        WE.line(g, ox + R + a * R * u, stripY - 5 * E.u, ox + R + a * R * u, stripY + 5 * E.u, { color: rgba(mix(pal.ink, pal.glow, (i % 12) / 12), 0.7 * u), width: 1 });
        WE.disc(g, ox + Math.cos(a) * R, cy + Math.sin(a) * R, 2 * E.u, rgba(pal.glow, 0.8));
      }
      label(g, E, 'C = 2*pi*r = ' + (2 * Math.PI * R).toFixed(1), cx + W * 0.06, cy - R * 0.4, { color: rgba(pal.accent, 0.9), size: 12 });
      label(g, E, 'given: ' + u.toFixed(2) + ' turns', cx + W * 0.06, cy - R * 0.4 + 16 * E.u, { color: rgba(pal.ink, 0.5), size: 10 });
    } else if (shape === 'sine' || shape === 'tangents') {
      const amp = H * 0.3, ph = E.t * 1.5;
      const f = (px) => cy + Math.sin(((px - x) / W) * Math.PI * 4 + ph) * amp;
      WE.curve(g, null, x + 8 * E.u, x + W - 8 * E.u, 90, f, { color: rgba(pal.ink, shape === 'sine' ? 0.9 : 0.6), width: 2.2 * E.u, glow: 10 * E.u, glowColor: rgba(pal.glow, 0.7) });
      WE.line(g, x, cy, x + W, cy, { color: rgba(pal.ink, 0.2), width: 1, dash: [3 * E.u, 4 * E.u] });
      if (shape === 'sine') {
        label(g, E, 'y = sin(2x)', x + W - 6 * E.u, y + 10 * E.u, { align: 'right', color: rgba(pal.accent, 0.7), size: 10 });
      } else {
        const seats = p.seats ? 7 : 3;
        for (let i = 0; i < seats; i++) {
          const kk = (i + 0.5) / seats;
          const px = x + kk * W;
          const slope = Math.cos(kk * Math.PI * 4 + ph) * amp * ((Math.PI * 4) / W);
          const half = 44 * E.u;
          WE.line(g, px - half, f(px) + slope * half, px + half, f(px) - slope * half, { color: rgba(pal.accent, 0.9), width: 1.6 * E.u, glow: 8 * E.u, glowColor: rgba(pal.glow, 0.9) });
          const bob = Math.sin(E.t * 2.4 + i) * 2 * E.u;
          WE.figure(g, px, f(px) - 16 * E.u + bob, 11 * E.u, rgba(pal.ink, 0.9), { t: E.t + i });
          label(g, E, 'dy/dx=' + (-slope).toFixed(2), px, f(px) + 20 * E.u, { align: 'center', size: 8.5, color: rgba(pal.accent, 0.6), spacing: 0 });
        }
      }
    } else if (shape === 'infinity' || shape === 'asymptote') {
      const dir = shape === 'infinity' ? 1 : -1;
      const f = (px) => {
        const v = ((px - x) / W) * 6 - 3;
        return cy - (v / (1 + Math.abs(v) * 0.55)) * H * 0.34 * dir;
      };
      WE.curve(g, null, x + 8 * E.u, x + W - 8 * E.u, 120, f, { color: rgba(pal.ink, 0.85), width: 2.2 * E.u, glow: 12 * E.u, glowColor: rgba(pal.glow, 0.7) });
      const limY = cy - H * 0.34 * dir * 1.25;
      WE.line(g, x, limY, x + W, limY, { color: rgba(pal.accent, 0.7), width: 1.2 * E.u, dash: [7 * E.u, 5 * E.u] });
      label(g, E, shape === 'infinity' ? 'x -> infinity' : 'limit = you', x + W - 8 * E.u, limY - 12 * E.u, { align: 'right', color: rgba(pal.accent, 0.95), size: 12, glow: 10 * E.u, glowColor: rgba(pal.glow, 0.9) });
      const runner = x + ((E.line.age * 0.35) % 1) * W;
      WE.disc(g, runner, f(runner), 4 * E.u, rgba(pal.glow, 0.95), { glow: 14 * E.u, glowColor: rgba(pal.glow, 0.9) });
      if (p.bound) {
        WE.rrect(g, x + W * 0.5, limY - H * 0.16, W * 0.42, H * 0.32, 6 * E.u, { color: rgba(pal.accent, 0.5), width: 1 * E.u, dash: [4 * E.u, 4 * E.u] });
        label(g, E, 'bounded by you', x + W * 0.71, limY, { align: 'center', size: 10, color: rgba(pal.ink, 0.6) });
      }
    }
  };

  /* ---- switching / blinding / dizziness ---- */
  S.switch = function (g, E) {
    const p = E.p, st = E.stage, pal = E.pal;
    const cx = st.x + st.w / 2, cy = st.y + st.h * 0.44;
    const W = st.w * 0.6, H = st.h * 0.4;
    const k = easeInOut(clamp((E.line.age - 0.2) / 1.0, 0, 1));
    const amp = H * 0.4;
    WE.line(g, cx - W / 2, cy, cx - W * 0.12, cy, { color: rgba(pal.ink, 0.6), width: 2 * E.u });
    WE.line(g, cx + W * 0.12, cy, cx + W / 2, cy, { color: rgba(pal.ink, 0.6), width: 2 * E.u });
    let pxPrev = null, pyPrev = null;
    for (let i = 0; i <= 60; i++) {
      const kk = i / 60;
      const px = cx - W * 0.1 + kk * W * 0.2;
      const val = lerp(Math.sin(kk * Math.PI * 6 + E.t * 6) * amp, 0, k);
      if (pxPrev !== null) WE.line(g, pxPrev, pyPrev, px, val, { color: rgba(mix(pal.glow, pal.accent, k), 0.9), width: 2.4 * E.u, glow: 10 * E.u, glowColor: rgba(pal.glow, 0.8) });
      pxPrev = px; pyPrev = val;
    }
    for (const sx of [-1, 1]) WE.disc(g, cx + sx * W * 0.1, cy, 5 * E.u, rgba(pal.accent, 0.9));
    if (k > 0.02 && k < 0.98) {
      for (let i = 0; i < 6; i++) {
        const a = rnd(i, Math.floor(E.t * 30)) * Math.PI * 2;
        const r = (8 + 26 * rnd(i + 3, Math.floor(E.t * 30))) * E.u;
        WE.line(g, cx - r * 0.2, cy + Math.sin(a) * r * 0.3, cx + r * 0.2, cy + Math.cos(a) * r * 0.3, { color: rgba(pal.ink, 0.7), width: 1.2 * E.u });
      }
    }
    label(g, E, p.from, cx - W / 2, cy - H * 0.72, { color: rgba(pal.ink, 0.4 + 0.6 * (1 - k)), size: 16, spacing: 3 * E.u, glow: 12 * E.u * (1 - k), glowColor: rgba(pal.glow, 0.9) });
    label(g, E, p.to, cx + W / 2, cy - H * 0.72, { align: 'right', color: rgba(pal.ink, 0.4 + 0.6 * k), size: 16, spacing: 3 * E.u, glow: 12 * E.u * k, glowColor: rgba(pal.accent, 0.9) });
    WE.line(g, cx - W / 2 + 30 * E.u, cy - H * 0.72, cx + W / 2 - 40 * E.u, cy - H * 0.72, { color: rgba(pal.ink, 0.2), width: 1, dash: [2 * E.u, 4 * E.u] });
    const ax = lerp(cx - W / 2 + 30 * E.u, cx + W / 2 - 40 * E.u, k);
    WE.path(g, [[ax - 6 * E.u, cy - H * 0.72 - 5 * E.u], [ax, cy - H * 0.72], [ax - 6 * E.u, cy - H * 0.72 + 5 * E.u]], { color: rgba(pal.accent, 0.9), width: 1.6 * E.u });
  };

  S.blind = function (g, E) {
    const st = E.stage, pal = E.pal;
    const cx = st.x + st.w / 2, cy = st.y + st.h * 0.45;
    const R = Math.min(st.w, st.h) * 0.4;
    const k = easeInOut(clamp(E.line.age / 1.3, 0, 1));
    for (let i = 12; i >= 0; i--) {
      g.save();
      g.globalAlpha = 0.16;
      g.fillStyle = i % 2 ? rgba(pal.fog, 1) : rgba(pal.glow, 0.4);
      g.beginPath();
      g.arc(cx, cy, Math.max(1, R * (i / 12) * (1 - k * 0.9)), 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    WE.ring(g, cx, cy, R * (1 - k * 0.9), { color: rgba(pal.accent, 0.8), width: 2 * E.u, glow: 16 * E.u, glowColor: rgba(pal.glow, 0.9) });
    for (let i = 0; i < 18; i++) {
      const a = rnd(i, 77) * Math.PI * 2, d = rnd(i, 78) * R * 1.4;
      WE.bloom(g, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7, 30 * E.u * (0.4 + rnd(i, 80)), rgba(pal.glow, 0.8), (1 - k) * 0.5 * rnd(i, 79));
    }
    label(g, E, 'vision ' + Math.round((1 - k) * 100) + '%', cx, cy + R * 1.15, { align: 'center', color: rgba(pal.ink, 0.55), size: 12, spacing: 3 * E.u });
  };

  S.dizzy = function (g, E) {
    const st = E.stage, pal = E.pal;
    const cx = st.x + st.w / 2, cy = st.y + st.h * 0.45;
    const spin = E.t * 2.1 + Math.sin(E.t * 0.7) * 1.6;
    const R = Math.min(st.w, st.h) * 0.42;
    for (let i = 0; i < 40; i++) {
      const a = spin + (i / 40) * Math.PI * 2;
      const rr = R * (0.18 + (i % 7) * 0.11);
      WE.line(g, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.85, cx + Math.cos(a) * (rr + 16 * E.u), cy + Math.sin(a) * (rr + 16 * E.u) * 0.85, { color: rgba(mix(pal.glow, pal.ink, (i % 7) / 7), 0.5), width: 1.6 * E.u });
    }
    const wob = Math.sin(E.t * 3.1) * 10 * E.u;
    label(g, E, 'dizzy', cx - 34 * E.u + wob, cy, { align: 'center', size: 22, color: rgba(pal.ink, 0.7), spacing: 2 * E.u, glow: 16 * E.u, glowColor: rgba(pal.glow, 0.9) });
    label(g, E, 'dizzy', cx + 34 * E.u - wob, cy, { align: 'center', size: 22, color: rgba(pal.glow, 0.55), spacing: 2 * E.u });
    WE.ring(g, cx, cy, R, { color: rgba(pal.accent, 0.28), width: 1.2 * E.u, dash: [10 * E.u, 8 * E.u] });
  };

  S.travel = function (g, E) {
    const p = E.p, st = E.stage, pal = E.pal;
    const y = st.y + st.h * 0.5;
    const x0 = st.x + st.w * 0.14, x1 = st.x + st.w * 0.86;
    const k = easeInOut(clamp((E.line.age - 0.15) / 1.2, 0, 1));
    WE.line(g, x0, y, x1, y, { color: rgba(pal.ink, 0.25), width: 1.4 * E.u });
    const stops = ['0x00', '0x2F', '0xAD', '0xBC', '0xFF'];
    for (let i = 0; i < stops.length; i++) {
      const sx = lerp(x0, x1, i / (stops.length - 1));
      const lit = k >= i / (stops.length - 1) - 0.001 ? 1 : 0.25;
      WE.ring(g, sx, y, 5 * E.u, { color: rgba(pal.accent, lit), width: 1.6 * E.u, fill: rgba(pal.fog, 0.9) });
      label(g, E, p.mode === 'address' && (i === 2 || i === 3) ? (i === 2 ? p.from : p.to) : stops[i], sx, y + 22 * E.u, { align: 'center', size: 10.5, color: rgba(pal.ink, 0.35 + 0.5 * lit), spacing: 0.6 * E.u });
    }
    const px = lerp(x0, x1, k);
    WE.disc(g, px, y, 7 * E.u, rgba(pal.glow, 0.95), { glow: 18 * E.u, glowColor: rgba(pal.glow, 1) });
    for (let i = 1; i <= 14; i++) {
      const tk = clamp(k - i * 0.012, 0, 1);
      WE.disc(g, lerp(x0, x1, tk), y, Math.max(0.5, (7 - i * 0.4) * E.u), rgba(pal.glow, 0.5 * (1 - i / 14)));
    }
    label(g, E, p.mode === 'address' ? 'travel ' + p.from + ' -> ' + p.to : 'we can travel', (x0 + x1) / 2, y - 46 * E.u, {
      align: 'center', size: 14, color: rgba(pal.accent, 0.85), spacing: 3 * E.u, glow: 10 * E.u, glowColor: rgba(pal.glow, 0.8),
    });
    if (p.mode === 'address') {
      const mid = lerp(x0, x1, 0.5);
      for (let i = 0; i < 26; i++) {
        const cx2 = mid + (rnd(i, 91) - 0.5) * 70 * E.u;
        const off = (i * 7 + Math.floor(E.t * 9)) % 40;
        WE.text(g, WE.glyph(i, Math.floor(E.t * 9)), cx2, y - 60 * E.u - off * E.u, { size: 9 * E.u, color: rgba(pal.ink, 0.25), spacing: 0 });
      }
    }
  };

  S.unite = function (g, E) {
    const p = E.p, st = E.stage, pal = E.pal;
    const cx = st.x + st.w / 2, cy = st.y + st.h * 0.45;
    const R = Math.min(st.w, st.h) * 0.26;
    const k = easeInOut(clamp((E.line.age - 0.1) / (p.mode === 'deep' ? 1.6 : 1.1), 0, 1));
    const d = lerp(R * 1.15, p.mode === 'deep' ? R * 0.12 : R * 0.5, k);
    for (const sx of [-1, 1]) {
      const c = sx < 0 ? pal.glow : pal.accent;
      g.save();
      g.globalAlpha = 0.16;
      g.fillStyle = rgba(c, 1);
      g.beginPath();
      g.arc(cx + sx * d, cy, R, 0, Math.PI * 2);
      g.fill();
      g.restore();
      WE.ring(g, cx + sx * d, cy, R, { color: rgba(c, 0.85), width: 2 * E.u, glow: 14 * E.u, glowColor: rgba(pal.glow, 0.7) });
    }
    const fill = clamp((d - R * 0.1) / (R * 1.05), 0, 1);
    g.save();
    g.beginPath();
    g.arc(cx - d, cy, R, 0, Math.PI * 2);
    g.clip();
    g.beginPath();
    g.arc(cx + d, cy, R, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = rgba(pal.ink, 0.3 * (1 - fill * 0.4) + 0.25);
    g.fillRect(cx - R * 2, cy - R * 2, R * 4, R * 4);
    for (let i = 0; i < 22; i++) {
      const a = rnd(i, 61) * Math.PI * 2, rr = rnd(i, 62) * R * 0.5;
      WE.disc(g, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, (1 + 2 * rnd(i, 63)) * E.u, rgba(pal.ink, 0.8));
    }
    g.restore();
    label(g, E, p.mode === 'deep' ? 'union' : 'unite', cx, cy + R * 1.5, { align: 'center', size: 13, color: rgba(pal.accent, 0.8), spacing: 3 * E.u });
    label(g, E, 'intersection ' + Math.round(clamp(1 - d / (R * 1.2), 0, 1) * 100) + '%', cx, cy - R * 1.35, { align: 'center', size: 10.5, color: rgba(pal.ink, 0.5) });
  };
})();
