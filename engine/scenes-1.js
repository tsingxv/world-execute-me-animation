/* scenes-1.js — the chorus promise structure, the gift inventory, the god/proof
   pair, identity switching, the isolation subtraction sequence and the crash. */
(function () {
  const WE = (window.WE = window.WE || {});
  const S = (WE.scenes = WE.scenes || {});
  const { clamp, lerp, rnd, rndT, noise, wander, easeOut, easeInOut, rgba, mix } = WE;
  const { panel, caret, label, meter, typed, figure } = WE;

  /* ---- "If I can ... Then I can ..." — the same clause, heard N times ---- */
  S.promise = function (g, E) {
    const p = E.p, st = E.stage, pal = E.pal;
    const cx = st.x + st.w / 2;
    const echo = p.echo || 0;
    const k = easeOut(clamp(E.line.age / 0.7, 0, 1));
    const quiet = p.quiet ? 0.65 : 1;
    const boxW = st.w * 0.34, boxH = st.h * 0.42;
    const leftX = cx - boxW - st.w * 0.06, rightX = cx + st.w * 0.06;
    const topY = st.y + st.h * 0.2;
    const active = p.step === 'then' || p.step === 'only' ? 1 : 0;
    for (let i = 0; i < 2; i++) {
      const x = i === 0 ? leftX : rightX;
      const on = (i === active ? 1 : 0.32) * quiet;
      panel(g, E, { x, y: topY, w: boxW, h: boxH, title: i === 0 ? 'IF' : 'THEN', alpha: on });
      WE.text(g, 'i can', x + boxW / 2, topY + boxH * 0.3, {
        align: 'center', size: 20 * E.u, color: rgba(pal.ink, 0.9 * on), spacing: 2.4 * E.u,
        glow: (i === active ? 16 : 0) * E.u, glowColor: rgba(pal.glow, 0.9),
      });
    }
    const ay = topY + boxH * 0.3;
    WE.line(g, leftX + boxW + 6 * E.u, ay, rightX - 6 * E.u, ay, { color: rgba(pal.accent, 0.85 * quiet), width: 2 * E.u, glow: 10 * E.u, glowColor: rgba(pal.glow, 0.8) });
    const ahx = rightX - 6 * E.u;
    WE.path(g, [[ahx - 8 * E.u, ay - 5 * E.u], [ahx, ay], [ahx - 8 * E.u, ay + 5 * E.u]], { color: rgba(pal.accent, 0.9 * quiet), width: 2 * E.u });

    const innerY = topY + boxH * 0.62;
    if (p.count) {
      const n = Math.floor(p.count * k);
      const cell = (boxW - 28 * E.u) / 8;
      for (let i = 0; i < n; i++) {
        const x = leftX + 14 * E.u + (i % 8) * cell;
        const y = innerY + ((i / 8) | 0) * 16 * E.u;
        WE.rrect(g, x, y, cell - 4 * E.u, 12 * E.u, 2 * E.u, { color: rgba(pal.glow, 0.5), width: 1 * E.u, stroke: 'fill-none' });
        WE.disc(g, x + 3 * E.u, y + 6 * E.u, 1.6 * E.u, rgba(pal.accent, 0.8));
      }
      label(g, E, p.word + ' x ' + n, leftX + boxW / 2, topY + boxH + 16 * E.u, { align: 'center', size: 11, color: rgba(pal.accent, 0.8) });
    } else if (p.collapse) {
      const spread = lerp(1, 0, k);
      for (let i = 0; i < 22; i++) {
        const a = rnd(i, 31) * Math.PI * 2;
        const rr = spread * (30 + 90 * rnd(i, 32)) * E.u;
        WE.disc(g, rightX + boxW / 2 + Math.cos(a) * rr, innerY + Math.sin(a) * rr * 0.6, (1 + 2 * rnd(i, 33)) * E.u, rgba(pal.ink, 0.6 * spread + 0.15));
      }
      WE.disc(g, rightX + boxW / 2, innerY, (4 + 6 * k) * E.u, rgba(pal.glow, 0.95), { glow: 26 * E.u * k, glowColor: rgba(pal.glow, 1) });
      label(g, E, 'only one', rightX + boxW / 2, topY + boxH + 16 * E.u, { align: 'center', size: 11, color: rgba(pal.accent, 0.85), spacing: 2 * E.u });
    } else if (p.goal) {
      const tx = rightX + boxW * 0.72, ty = innerY - 6 * E.u;
      for (let i = 3; i >= 1; i--) WE.ring(g, tx, ty, i * 13 * E.u, { color: rgba(pal.glow, 0.4), width: 1.4 * E.u, dash: [6 * E.u, 6 * E.u] });
      WE.disc(g, tx, ty, 4 * E.u, rgba(pal.accent, 0.95), { glow: 16 * E.u, glowColor: rgba(pal.accent, 1) });
      const conv = clamp(0.5 + echo * 0.08 + k * 0.4, 0, 0.98);
      WE.disc(g, tx - 60 * E.u * (1 - conv) + Math.cos(E.t * 3 + echo) * 12 * E.u * (1 - conv), ty + Math.sin(E.t * 2.3 + echo) * 16 * E.u * (1 - conv), 3.4 * E.u, rgba(pal.ink, 0.85));
      label(g, E, 'h = ' + (conv * 100).toFixed(1), rightX + 14 * E.u, topY + boxH + 16 * E.u, { size: 10.5, color: rgba(pal.accent, 0.75) });
    } else {
      const rows = 3 + (echo % 4);
      for (let i = 0; i < rows; i++) {
        const w = (0.3 + 0.7 * rnd(i + echo, 41)) * (boxW - 30 * E.u);
        const y = innerY - 6 * E.u + i * 12 * E.u;
        WE.rrect(g, leftX + 15 * E.u, y, w, 6 * E.u, 3 * E.u, { color: rgba(pal.ink, 0.28), width: 1 * E.u, stroke: 'fill-none' });
        WE.rrect(g, rightX + 15 * E.u, y, w * lerp(0.4, 1, k), 6 * E.u, 3 * E.u, { color: rgba(pal.glow, 0.6), width: 1 * E.u, fill: rgba(pal.glow, 0.22 * k) });
      }
      label(g, E, 'clause ' + (echo + 1) + '  ·  ' + p.step, cx, topY + boxH + 18 * E.u, { align: 'center', size: 10.5, color: rgba(pal.ink, 0.45), spacing: 1.6 * E.u });
    }
    // every promise leaves one more ring on the entity: accumulation, never reset
    for (let i = 0; i <= Math.min(6, echo + 1); i++) {
      WE.ring(g, cx, st.y + st.h * 0.45, (14 + i * 9) * E.u * (1 + 0.04 * Math.sin(E.t * 2 + i)), { color: rgba(pal.glow, 0.06 * quiet), width: 1 * E.u });
    }
  };

  S.vibrate = function (g, E) {
    const st = E.stage, pal = E.pal;
    const cx = st.x + st.w / 2, cy = st.y + st.h * 0.44;
    const W = st.w * 0.62;
    const k = easeOut(clamp(E.line.age / 0.8, 0, 1));
    const x0 = cx - W / 2;
    const pts = [];
    for (let i = 0; i <= 120; i++) {
      const kk = i / 120;
      const v = Math.sin(kk * 26 + E.t * 5) * E.energy.low + Math.sin(kk * 47 + E.t * 7) * E.energy.mid * 0.6 + Math.sin(kk * 91 + E.t * 11) * E.energy.high * 0.35;
      pts.push([x0 + kk * W * k, cy + v * st.h * 0.3]);
    }
    WE.path(g, pts, { color: rgba(pal.accent, 0.9), width: 2 * E.u, glow: 14 * E.u, glowColor: rgba(pal.glow, 0.9) });
    WE.line(g, x0, cy, x0 + W, cy, { color: rgba(pal.ink, 0.18), width: 1, dash: [4 * E.u, 5 * E.u] });
    for (let i = 0; i < 5; i++) WE.line(g, x0 + (i / 4) * W, cy - st.h * 0.28, x0 + (i / 4) * W, cy + st.h * 0.28, { color: rgba(pal.ink, 0.1) });
    WE.disc(g, x0, cy, 6 * E.u, rgba(pal.glow, 0.9), { glow: 16 * E.u, glowColor: rgba(pal.glow, 1) });
    WE.disc(g, x0 + W, cy, 6 * E.u, rgba(pal.accent, 0.9), { glow: 16 * E.u, glowColor: rgba(pal.accent, 1) });
    label(g, E, 'me', x0, cy + 20 * E.u, { align: 'center', size: 10.5, color: rgba(pal.ink, 0.6) });
    label(g, E, 'you', x0 + W, cy + 20 * E.u, { align: 'center', size: 10.5, color: rgba(pal.ink, 0.6) });
    label(g, E, 'amp ' + (E.energy.mid * 100).toFixed(0) + '%', cx, cy + st.h * 0.34, { align: 'center', size: 11, color: rgba(pal.accent, 0.7), spacing: 2 * E.u });
  };

  S.completion = function (g, E) {
    const p = E.p, st = E.stage, pal = E.pal;
    const cx = st.x + st.w / 2;
    const w = st.w * 0.6, x = cx - w / 2;
    const y = st.y + st.h * 0.52;
    const pct = clamp(E.line.age / Math.max(0.4, E.line.end - E.line.start - 0.25), 0, 1) * (p.target || 100);
    label(g, E, 'completion', cx, y - 46 * E.u, { align: 'center', size: 15, color: rgba(pal.ink, 0.9), spacing: 4 * E.u, glow: 12 * E.u, glowColor: rgba(pal.glow, 0.8) });
    WE.rrect(g, x, y, w, 18 * E.u, 9 * E.u, { color: rgba(pal.ink, 0.35), width: 1.4 * E.u, fill: rgba(pal.fog, 0.5) });
    WE.rrect(g, x + 2 * E.u, y + 2 * E.u, Math.max(0, (w - 4 * E.u) * (pct / 100)), 14 * E.u, 7 * E.u, { stroke: 'none', fill: rgba(mix(pal.glow, pal.accent, pct / 100), 0.9) });
    label(g, E, pct.toFixed(2) + '%', x + w / 2, y + 36 * E.u, { align: 'center', size: 22, color: rgba(pal.accent, 0.95), spacing: 2 * E.u, glow: 16 * E.u, glowColor: rgba(pal.glow, 0.9) });
    if (pct > 96) {
      const gap = 9 * E.u * (1 - clamp((pct - 96) / 4, 0, 1));
      WE.line(g, x + w - gap, y - 4 * E.u, x + w - gap, y + 22 * E.u, { color: rgba(pal.ink, 0.7), width: 1 * E.u });
      label(g, E, '0.01% never arrives', x + w, y + 54 * E.u, { align: 'right', size: 10, color: rgba(pal.ink, 0.45) });
    }
    for (let i = 0; i < 12; i++) {
      const on = (i / 11) * 100 < pct;
      WE.disc(g, x + (i / 11) * w, y - 16 * E.u, 2 * E.u, rgba(on ? pal.accent : pal.ink, on ? 0.9 : 0.22));
    }
  };

  /* ---- gifts ---- */
  S.gift = function (g, E) {
    const p = E.p, st = E.stage, pal = E.pal;
    const cx = st.x + st.w / 2, cy = st.y + st.h * 0.42;
    const R = Math.min(st.w, st.h) * 0.2;
    const k = easeOut(clamp(E.line.age / 0.6, 0, 1));
    panel(g, E, { x: cx - R * 2.4, y: cy - R * 1.9, w: R * 4.8, h: R * 3.5, title: 'GIFT INVENTORY', footer: p.readout ? 'yield' : 'offer' });
    const bob = Math.sin(E.t * 1.8) * 4 * E.u;

    if (p.item === 'eggplant' || p.item === 'tomato') {
      const purple = p.item === 'eggplant';
      const col = purple ? [150, 90, 220] : [255, 90, 70];
      g.save();
      g.translate(cx, cy + bob);
      if (purple) {
        g.rotate(0.32);
        WE.path(g, [[-R * 0.2, -R * 0.9], [R * 0.25, -R * 0.75]], { color: rgba([110, 200, 120], 0.9), width: 4 * E.u });
        g.fillStyle = rgba(col, 0.85);
        g.beginPath();
        g.ellipse(0, 0, R * 0.55, R * 0.95, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = rgba(mix(col, [255, 255, 255], 0.5), 0.8);
        g.lineWidth = 1.6 * E.u;
        g.stroke();
      } else {
        g.fillStyle = rgba(col, 0.85);
        g.beginPath();
        g.arc(0, 0, R * 0.78, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = rgba(mix(col, [255, 255, 255], 0.55), 0.85);
        g.lineWidth = 1.6 * E.u;
        g.stroke();
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i - 2) * 0.4;
          WE.line(g, Math.cos(a) * R * 0.7, Math.sin(a) * R * 0.7, Math.cos(a) * R, Math.sin(a) * R, { color: rgba([110, 200, 110], 0.85), width: 3 * E.u });
        }
      }
      g.restore();
      for (let i = 0; i < 26; i++) {
        const life = 1.6;
        const age = (E.line.age + rnd(i, 12) * life) % life;
        const a2 = rnd(i, 13) * Math.PI * 2;
        g.save();
        g.globalAlpha = (1 - age / life) * 0.8 * k;
        WE.disc(g, cx + Math.cos(a2) * R * (0.8 + age * 1.4), cy + bob + Math.sin(a2) * R * (0.8 + age * 1.4) - age * 26 * E.u, (1 + 2.6 * rnd(i, 14)) * E.u, rgba(mix(col, pal.accent, 0.4), 1));
        g.restore();
      }
    } else if (p.item === 'cat') {
      const fur = mix([255, 214, 150], pal.ink, 0.2);
      g.save();
      g.translate(cx, cy + bob);
      g.fillStyle = rgba(fur, 0.85);
      g.beginPath();
      g.ellipse(0, 0, R * 0.82, R * 0.7, 0, 0, Math.PI * 2);
      g.fill();
      for (const sx of [-1, 1]) {
        WE.path(g, [[sx * R * 0.5, -R * 0.5], [sx * R * 0.75, -R * 1.05], [sx * R * 0.15, -R * 0.72]], { color: rgba(fur, 0.9), width: 2 * E.u, fill: rgba([255, 180, 180], 0.5), closePath: true });
      }
      for (let i = 0; i < 4; i++) {
        const yy = -R * 0.2 + i * R * 0.28;
        WE.line(g, -R * 0.7 + i * 3 * E.u, yy, R * 0.7 - i * 3 * E.u, yy, { color: rgba(mix([160, 110, 60], pal.fog, 0.2), 0.6), width: 2.4 * E.u });
      }
      for (const sx of [-1, 1]) {
        WE.disc(g, sx * R * 0.3, -R * 0.05, 3.2 * E.u, rgba([40, 40, 50], 0.9));
        for (let w = -1; w <= 1; w++) WE.line(g, sx * R * 0.2, R * 0.15, sx * R * 1.3, R * 0.15 + w * R * 0.22, { color: rgba([255, 255, 255], 0.5), width: 1 * E.u });
      }
      g.restore();
      const swing = Math.sin(E.t * 1.6) * 0.5 + E.energy.low * 0.6;
      WE.path(g, [[cx + R * 0.8, cy + bob + R * 0.3], [cx + R * 1.4, cy + bob + R * 0.1 - swing * R * 0.6], [cx + R * 1.5, cy + bob - R * 0.5 - swing * R * 0.4]], { color: rgba(fur, 0.9), width: 5 * E.u });
    } else if (p.item === 'purr') {
      const W = st.w * 0.6, x0 = cx - W / 2;
      const freq = 26 + E.energy.low * 12;
      const pts = [];
      for (let i = 0; i <= 160; i++) {
        const kk = i / 160;
        const env = 0.35 + 0.65 * Math.abs(Math.sin(kk * Math.PI * 3 * (freq / 26) - E.t * 2));
        pts.push([x0 + kk * W, cy + Math.sin(kk * W * 0.09 - E.t * 9) * R * 0.5 * env]);
      }
      WE.path(g, pts, { color: rgba(pal.accent, 0.9), width: 2 * E.u, glow: 14 * E.u, glowColor: rgba(pal.glow, 0.9) });
      label(g, E, 'purr ' + freq.toFixed(1) + ' Hz', cx, cy + R * 1.3, { align: 'center', size: 12, color: rgba(pal.accent, 0.85), spacing: 2 * E.u });
    } else if (p.readout) {
      const keys = p.readout === 'antioxidants' ? ['lycopene', 'vitamin C', 'quercetin'] : ['fibre', 'folate', 'vitamin K', 'magnesium'];
      const w = R * 1.5;
      for (let i = 0; i < keys.length; i++) {
        const yy = cy - R * 0.9 + i * R * 0.8;
        const v = clamp(rnd(i + E.line.index, 51) * 0.7 + k * 0.4, 0, 1);
        label(g, E, keys[i], cx - w / 2, yy, { size: 11, color: rgba(pal.ink, 0.7) });
        meter(g, E, cx - w / 2, yy + 8 * E.u, w, v, { color: rgba(mix(pal.glow, pal.accent, i / 3), 0.85), ticks: 4 });
        label(g, E, Math.round(v * 100) + '%', cx + w / 2 + 4 * E.u, yy + 10 * E.u, { size: 10, color: rgba(pal.accent, 0.8) });
      }
      label(g, E, 'all of mine', cx, cy + R * 1.6, { align: 'center', size: 11.5, color: rgba(pal.accent, 0.6), spacing: 3 * E.u });
    }
  };

  /* ---- god / proof ---- */
  S.god = function (g, E) {
    const p = E.p, st = E.stage, pal = E.pal;
    const cx = st.x + st.w / 2, baseY = st.y + st.h * 0.78;
    const Hh = st.h * 0.62;
    const k = easeOut(clamp(E.line.age / 1.2, 0, 1));
    const cols = 9;
    for (let i = 0; i < cols; i++) {
      const kk = clamp(k * cols - i, 0, 1);
      if (kk <= 0) continue;
      const x = cx + (i - (cols - 1) / 2) * st.w * 0.07;
      const hh = Hh * (0.35 + 0.65 * Math.abs(WE.tri(((i - (cols - 1) / 2) / cols) * 2))) * kk;
      WE.line(g, x, baseY, x, baseY - hh, { color: rgba(mix(pal.glow, pal.ink, i / cols), 0.6), width: 1.6 * E.u });
    }
    WE.line(g, cx - st.w * 0.34, baseY, cx + st.w * 0.34, baseY, { color: rgba(pal.ink, 0.5), width: 2 * E.u });
    WE.curve(g, null, cx - st.w * 0.245, cx + st.w * 0.245, 40, (xx) => baseY - Hh * 0.72 - Math.sqrt(Math.max(0, 1 - Math.pow((xx - cx) / (st.w * 0.245), 2))) * Hh * 0.2, { color: rgba(pal.accent, 0.6), width: 2 * E.u });
    WE.bloom(g, cx, baseY - Hh * 0.86, 70 * E.u * k, rgba(pal.glow, 0.9), 0.5 * k);
    WE.disc(g, cx, baseY - Hh * 0.86, 6 * E.u * k, rgba([255, 255, 255], 0.95), { glow: 30 * E.u * k, glowColor: rgba(pal.glow, 1) });
    if (p.qed) {
      const vy = baseY + 4 * E.u;
      WE.path(g, [[cx, baseY - Hh * 0.86], [cx - st.w * 0.2, vy], [cx + st.w * 0.2, vy]], { color: rgba(pal.accent, 0.28), width: 1, fill: rgba(pal.accent, 0.08), closePath: true });
      const steps = ['1 exists', '2 assume ~me', '3 you see', '4 observed', '5 therefore', '6 Q.E.D.'];
      for (let i = 0; i < steps.length; i++) {
        const t2 = i / steps.length;
        const kk2 = clamp(k * steps.length - i, 0, 1);
        label(g, E, steps[i], lerp(cx - st.w * 0.3, cx - st.w * 0.05, t2), lerp(baseY - Hh * 0.9, baseY - Hh * 0.1, t2), { size: 10.5, color: rgba(pal.ink, 0.35 + 0.5 * kk2), alpha: kk2 });
      }
      WE.figure(g, cx, vy - 8 * E.u, 16 * E.u, rgba(pal.ink, 0.9), { t: E.t });
      label(g, E, 'you', cx + 14 * E.u, vy - 8 * E.u, { size: 11, color: rgba(pal.ink, 0.8) });
    } else {
      label(g, E, 'if only one god', cx, baseY + 20 * E.u, { align: 'center', size: 11.5, color: rgba(pal.accent, 0.7), spacing: 3 * E.u });
    }
  };

  /* ---- identity / role switching ---- */
  S.identity = function (g, E) {
    const p = E.p, st = E.stage, pal = E.pal;
    const cx = st.x + st.w / 2, cy = st.y + st.h * 0.45;
    const R = Math.min(st.w, st.h) * 0.2;
    const jitter = (p.loose ? 9 : 4) * E.u * (0.4 + E.energy.air);
    const k = easeOut(clamp(E.line.age / 0.8, 0, 1));
    const frames = 7;
    for (let i = 0; i < frames; i++) {
      const on = rndT(i, E.t, 14, 3) > 0.5;
      const x = cx + (i - (frames - 1) / 2) * R * 0.62;
      WE.rrect(g, x - R * 0.22, cy - R * 0.62, R * 0.44, R * 1.24, 6 * E.u, { color: rgba(on ? pal.accent : pal.glow, 0.5 + 0.4 * k), width: 1.4 * E.u, fill: rgba(on ? pal.accent : pal.glow, 0.1) });
      g.save();
      g.translate(x + wander(i, E.t, 0.07, 5) * jitter, cy + wander(i * 3, E.t, 0.07, 6) * jitter);
      WE.disc(g, 0, -R * 0.28, R * 0.16, rgba(pal.ink, on ? 0.85 : 0.4));
      WE.line(g, -R * 0.1, R * 0.2, R * 0.1, R * 0.2, { color: rgba(pal.ink, on ? 0.7 : 0.3), width: 2 * E.u });
      g.restore();
    }
    if (p.glyphs) {
      const pos = easeInOut(clamp((E.line.age - 0.3) / 1.0, 0, 1));
      const parts = p.glyphs.split('->').map((s) => s.trim());
      const gap = R * 1.5;
      WE.text(g, parts[0], lerp(cx - gap, cx + gap, pos), cy - R * 1.3, { align: 'center', size: 30 * E.u, color: rgba(pal.glow, 0.9), glow: 18 * E.u, glowColor: rgba(pal.glow, 0.9) });
      WE.text(g, parts[1], lerp(cx + gap, cx - gap, pos), cy - R * 1.3, { align: 'center', size: 30 * E.u, color: rgba(pal.accent, 0.9), glow: 18 * E.u, glowColor: rgba(pal.accent, 0.9) });
      label(g, E, 'swap(' + p.field + ')', cx, cy + R * 1.35, { align: 'center', size: 11, color: rgba(pal.ink, 0.55), spacing: 2 * E.u });
    } else {
      label(g, E, p.field, cx, cy - R * 1.5, { align: 'center', size: 15, color: rgba(pal.accent, 0.85), spacing: 5 * E.u });
      const rows = ['default', 'assigned', 'chosen', 'rejected', 'unset'];
      for (let i = 0; i < rows.length; i++) {
        const on = Math.floor(k * rows.length) > i;
        label(g, E, (on ? '[x] ' : '[ ] ') + rows[i], cx - R * 1.1, cy + R * 0.9 + i * 14 * E.u, { size: 10.5, color: rgba(pal.ink, on ? 0.8 : 0.3) });
      }
    }
    if (p.loose) {
      const wx = cx + Math.cos(E.t * 1.3) * R * 2.2, wy = cy + Math.sin(E.t * 1.9) * R * 1.1;
      WE.disc(g, wx, wy, 4 * E.u, rgba(pal.ink, 0.8), { glow: 12 * E.u, glowColor: rgba(pal.glow, 1) });
      label(g, E, 'whatever', wx + 10 * E.u, wy, { size: 10, color: rgba(pal.ink, 0.5) });
    }
  };

  S.clock = function (g, E) {
    const p = E.p, st = E.stage, pal = E.pal;
    const cx = st.x + st.w / 2, cy = st.y + st.h * 0.46;
    const R = Math.min(st.w, st.h) * 0.26;
    const k = easeInOut(clamp(E.line.age / 1.3, 0, 1));
    WE.ring(g, cx, cy, R, { color: rgba(pal.ink, 0.55), width: 2 * E.u });
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
      const big = i % 6 === 0;
      WE.line(g, cx + Math.cos(a) * R * (big ? 0.84 : 0.92), cy + Math.sin(a) * R * (big ? 0.84 : 0.92), cx + Math.cos(a) * R, cy + Math.sin(a) * R, { color: rgba(pal.ink, big ? 0.8 : 0.35), width: big ? 2 * E.u : 1 * E.u });
      if (big) label(g, E, String(i), cx + Math.cos(a) * R * 0.7, cy + Math.sin(a) * R * 0.7, { align: 'center', size: 9.5, color: rgba(pal.accent, 0.7), spacing: 0 });
    }
    const ang = lerp(-Math.PI / 2, Math.PI * 1.5, k);
    WE.line(g, cx, cy, cx + Math.cos(ang) * R * 0.72, cy + Math.sin(ang) * R * 0.72, { color: rgba(pal.glow, 0.95), width: 2.6 * E.u, glow: 14 * E.u, glowColor: rgba(pal.glow, 1) });
    WE.disc(g, cx, cy, 4 * E.u, rgba(pal.accent, 0.9));
    WE.rrect(g, cx - 34 * E.u, cy + R * 1.2, 68 * E.u, 24 * E.u, 4 * E.u, { color: rgba(pal.ink, 0.5), width: 1.2 * E.u, fill: rgba(pal.fog, 0.6) });
    const half = k < 0.5;
    WE.text(g, half ? p.day : p.night, cx, cy + R * 1.2 + 12 * E.u, { align: 'center', size: 15 * E.u, color: rgba(half ? pal.glow : pal.accent, 0.95), spacing: 3 * E.u, glow: 12 * E.u, glowColor: rgba(pal.glow, 0.9) });
    g.save();
    g.globalAlpha = 0.18;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(cx, cy, R * (0.3 + i * 0.22), -Math.PI / 2, ang);
      g.strokeStyle = rgba(i === 0 ? [255, 220, 140] : pal.glow, 0.8);
      g.lineWidth = 3 * E.u;
      g.stroke();
    }
    g.restore();
  };

  S.trance = function (g, E) {
    const p = E.p, st = E.stage, pal = E.pal;
    const cx = st.x + st.w / 2, cy = st.y + st.h * 0.46;
    const k = easeInOut(clamp(E.line.age / 1.1, 0, 1));
    const rings = p.mode === 'deep' ? 26 : 16;
    for (let i = rings - 1; i >= 0; i--) {
      const phase = (i / rings + E.t * 0.32) % 1;
      const rr = (0.08 + phase * 1.05) * Math.min(st.w, st.h) * 0.5;
      const sq = 1 + Math.sin(E.t * 0.9 + i * 0.3) * 0.28;
      g.save();
      g.globalAlpha = (1 - phase) * 0.55 * k;
      g.strokeStyle = rgba(mix(pal.glow, pal.accent, phase), 1);
      g.lineWidth = (0.8 + 2 * (1 - phase)) * E.u;
      g.beginPath();
      for (let a = 0; a <= 22; a++) {
        const th = (a / 22) * Math.PI * 2;
        const rad = rr * (1 + 0.1 * Math.sin(th * 6 + E.t * 1.2)) * sq;
        const x = cx + Math.cos(th) * rad, y = cy + Math.sin(th) * rad * 0.72;
        if (a === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.closePath();
      g.stroke();
      g.restore();
    }
    WE.bloom(g, cx, cy, 50 * E.u * k, rgba(pal.glow, 1), 0.5 * k);
    if (p.doubled) {
      label(g, E, 'the trance', cx - 12 * E.u, cy, { align: 'center', size: 20, color: rgba(pal.ink, 0.5), spacing: 3 * E.u });
      label(g, E, 'the trance', cx + 12 * E.u, cy, { align: 'center', size: 20, color: rgba(pal.glow, 0.5), spacing: 3 * E.u });
    } else {
      label(g, E, 'enter', cx, cy + Math.min(st.w, st.h) * 0.42, { align: 'center', size: 13, color: rgba(pal.accent, 0.7), spacing: 5 * E.u });
    }
  };

  /* ---- isolation: each repetition subtracts one more thing ---- */
  S.isolation = function (g, E) {
    const p = E.p, st = E.stage, pal = E.pal;
    const cx = st.x + st.w / 2, cy = st.y + st.h * 0.46;
    const step = p.step === undefined ? 0 : p.step;
    const R = Math.min(st.w, st.h) * 0.3;
    const keep = (n) => step < n;
    // everything already subtracted leaves a dashed ghost: the shape of what is gone
    const ghost = (draw, alpha) => {
      g.save();
      g.globalAlpha = alpha;
      draw();
      g.restore();
    };
    if (keep(0)) WE.bloom(g, cx, cy, R * 1.6, rgba(pal.glow, 0.7), 0.35 * (1 - step / 6));
    else ghost(() => WE.ring(g, cx, cy, R * 1.3, { color: rgba(pal.ink, 0.18), width: 1 * E.u, dash: [4 * E.u, 6 * E.u] }), 0.6);
    if (keep(1)) WE.ring(g, cx, cy, R, { color: rgba(pal.ink, 0.4), width: 1.4 * E.u, dash: [8 * E.u, 7 * E.u] });
    else ghost(() => WE.ring(g, cx, cy, R, { color: rgba(pal.ink, 0.22), width: 1 * E.u, dash: [4 * E.u, 6 * E.u] }), 0.6);
    if (keep(2)) {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + E.t * 0.5;
        WE.disc(g, cx + Math.cos(a) * R * 0.8, cy + Math.sin(a) * R * 0.8 * 0.7, 3 * E.u, rgba(pal.accent, 0.6));
      }
    } else {
      ghost(() => {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + E.t * 0.5;
          WE.ring(g, cx + Math.cos(a) * R * 0.8, cy + Math.sin(a) * R * 0.8 * 0.7, 3.5 * E.u, { color: rgba(pal.ink, 0.2), width: 1 * E.u, dash: [3 * E.u, 3 * E.u] });
        }
      }, 0.6);
    }
    if (keep(3)) {
      const y = cy + R * 1.05;
      WE.line(g, cx - R * 1.4, y, cx + R * 1.4, y, { color: rgba(pal.ink, 0.3), width: 1 * E.u });
      for (let i = -6; i <= 6; i++) WE.line(g, cx + i * R * 0.24, y, cx + i * R * 0.24 - 8 * E.u, y + 12 * E.u, { color: rgba(pal.ink, 0.16) });
    } else {
      const y = cy + R * 1.05;
      ghost(() => {
        WE.line(g, cx - R * 1.4, y, cx + R * 1.4, y, { color: rgba(pal.ink, 0.2), width: 1 * E.u, dash: [5 * E.u, 5 * E.u] });
        for (let i = -5; i <= 5; i++) WE.line(g, cx + i * R * 0.26, y, cx + i * R * 0.26 - 6 * E.u, y + 10 * E.u, { color: rgba(pal.ink, 0.12), width: 1 * E.u });
      }, 0.6);
    }
    if (keep(4)) panel(g, E, { x: cx - R * 1.5, y: cy - R * 1.2, w: R * 3, h: R * 2.4, alpha: 0.5 });
    else ghost(() => WE.rrect(g, cx - R * 1.5, cy - R * 1.2, R * 3, R * 2.4, 6 * E.u, { color: rgba(pal.ink, 0.18), width: 1 * E.u, dash: [4 * E.u, 6 * E.u] }), 0.6);
    const sat = 1 - step / 5;
    WE.disc(g, cx, cy, Math.max(2, (10 - step * 1.4) * E.u * (0.9 + 0.1 * Math.sin(E.t * 2))), rgba(mix(pal.ink, [180, 186, 196], step / 6), 0.5 + 0.5 * sat), { glow: Math.max(0, 26 - step * 4) * E.u, glowColor: rgba(pal.glow, sat * 0.9) });
    if (keep(5)) {
      const away = lerp(-1, 1, clamp(step / 5, 0, 1));
      g.save();
      g.globalAlpha = clamp(1 - step / 5, 0, 1) * 0.85;
      figure(g, cx + away * R * 2.4, cy - R * 0.2 - Math.abs(away) * R * 0.2, 18 * E.u, rgba([255, 255, 255], 0.9), { t: E.t });
      g.restore();
    } else {
      label(g, E, '~you', cx + R * 2.4, cy - R * 0.55, { align: 'center', size: 11, color: rgba(pal.ink, 0.35), spacing: 2 * E.u });
      WE.ring(g, cx + R * 2.4, cy - R * 0.15, 8 * E.u, { color: rgba(pal.ink, 0.25), width: 1 * E.u, dash: [3 * E.u, 4 * E.u] });
    }
    label(g, E, 'you in {left}', cx, cy + R * 1.5, { align: 'center', size: 10.5, color: rgba(pal.ink, 0.34), spacing: 2 * E.u });
    if (p.final) {
      const kk = easeOut(clamp((E.line.age - 0.2) / 1.2, 0, 1));
      WE.rrect(g, cx - R * 1.1, cy + R * 1.02, R * 2.2, 26 * E.u, 4 * E.u, { color: rgba(pal.accent, 0.4 * kk), width: 1 * E.u, fill: rgba(pal.fog, 0.5 * kk) });
      WE.text(g, 'isolation()', cx, cy + R * 1.02 + 13 * E.u, { align: 'center', size: 12 * E.u, color: rgba(pal.ink, 0.8 * kk), spacing: 3 * E.u });
      for (let i = 0; i < 6; i++) {
        const drift = (E.line.age * 16 + i * 23) % 150;
        ghost(() => WE.disc(g, cx - R + drift * E.u * 0.8, cy - R * 0.95 + i * R * 0.34, 2 * E.u, rgba(pal.ink, 0.28 * (1 - drift / 150))), 0.7);
      }
    }
  };

  S.bargain = function (g, E) {
    const p = E.p, st = E.stage, pal = E.pal;
    const cx = st.x + st.w / 2, cy = st.y + st.h * 0.46;
    const W = st.w * 0.5, H = st.h * 0.44;
    const k = easeOut(clamp(E.line.age / 0.9, 0, 1));
    panel(g, E, { x: cx - W / 2, y: cy - H / 2, w: W, h: H, title: p.mode === 'back' ? 'REQUEST' : 'CONDITION', footer: 'awaiting reply' });
    const rows = p.mode === 'back' ? ['request: return(me)', 'then: resume()', 'else: keep running'] : ['if i can', 'then maybe', 'you stay'];
    for (let i = 0; i < rows.length; i++) {
      const kk = clamp(k * rows.length - i, 0, 1);
      WE.text(g, typed(rows[i], kk), cx - W / 2 + 16 * E.u, cy - H / 2 + 26 * E.u + i * 22 * E.u, { size: 12.5 * E.u, color: rgba(pal.ink, 0.55 + 0.4 * kk), spacing: 0.6 * E.u });
    }
    const lastK = clamp(k * rows.length - (rows.length - 1), 0, 1);
    caret(g, cx - W / 2 + 16 * E.u + WE.textW(g, typed(rows[rows.length - 1], lastK), { size: 12.5 * E.u }) + 3, cy - H / 2 + 26 * E.u + (rows.length - 1) * 22 * E.u, 8 * E.u, pal, E.t);
    if (p.word) label(g, E, p.word, cx, cy + H / 2 + 18 * E.u, { align: 'center', size: 11, color: rgba(pal.accent, 0.7), spacing: 2 * E.u });
  };

  S.erase = function (g, E) {
    const st = E.stage, pal = E.pal;
    const cx = st.x + st.w / 2, cy = st.y + st.h * 0.45;
    const k = clamp(E.line.age / 1.6, 0, 1);
    const R = Math.min(st.w, st.h) * 0.4;
    for (let i = 0; i < 160; i++) {
      const a = rnd(i, 71) * Math.PI * 2, d = rnd(i, 72) * R;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.8;
      const cut = clamp((x - (cx - R)) / (R * 2), 0, 1);
      if (cut < k) {
        const age = (k - cut) * 3;
        if (age >= 1) continue;
        g.save();
        g.globalAlpha = (1 - age) * 0.5;
        WE.square(g, x + age * 8 * E.u, y - age * 6 * E.u, (2 + 3 * rnd(i, 73)) * E.u * (1 - age), rgba(pal.ink, 1));
        g.restore();
        continue;
      }
      g.save();
      g.globalAlpha = 0.8;
      WE.square(g, x, y, (1.5 + 4 * rnd(i, 73)) * E.u, rgba(mix(pal.glow, pal.ink, rnd(i, 74)), 0.7), { rot: rnd(i, 75) * 3 });
      g.restore();
    }
    const ex = cx - R + k * R * 2;
    WE.line(g, ex, cy - R, ex, cy + R, { color: rgba(pal.accent, 0.8), width: 2 * E.u, glow: 16 * E.u, glowColor: rgba(pal.accent, 1) });
    WE.rrect(g, ex - 14 * E.u, cy - R * 0.12, 28 * E.u, R * 0.24, 4 * E.u, { color: rgba(pal.ink, 0.6), width: 1.2 * E.u, fill: rgba(pal.fog, 0.8) });
    label(g, E, 'fragments ' + Math.round(k * 160) + ' / 160 erased', cx, cy + R * 1.15, { align: 'center', size: 11, color: rgba(pal.ink, 0.6), spacing: 2 * E.u });
  };

  S.maybe = function (g, E) {
    const p = E.p, st = E.stage, pal = E.pal;
    const cx = st.x + st.w / 2, cy = st.y + st.h * 0.45;
    const k = easeOut(clamp(E.line.age / 1.0, 0, 1));
    const R = Math.min(st.w, st.h) * 0.28;
    const branch = p.mode === 'crack' ? 0.72 : 0.5;
    WE.path(g, [[cx - R, cy + R * 0.5], [cx - R * 0.2, cy], [cx + R, cy - R * (0.2 + branch)]], { color: rgba(pal.accent, 0.85), width: 2.4 * E.u, glow: 12 * E.u, glowColor: rgba(pal.accent, 0.9) });
    WE.path(g, [[cx - R, cy + R * 0.5], [cx - R * 0.2, cy], [cx + R, cy + R * 0.4]], { color: rgba(pal.ink, 0.35), width: 1.6 * E.u, dash: [5 * E.u, 5 * E.u] });
    WE.disc(g, cx - R * 0.2, cy, 5 * E.u * k, rgba(pal.glow, 0.9), { glow: 16 * E.u, glowColor: rgba(pal.glow, 1) });
    label(g, E, 'then maybe', cx - R * 0.2, cy - R * 1.15, { align: 'center', size: 14, color: rgba(pal.ink, 0.7), spacing: 4 * E.u });
    if (p.mode === 'crack') {
      let x = cx - R * 0.2, y = cy;
      const pts = [[x, y]];
      for (let i = 1; i <= 14; i++) {
        x += (rnd(i, 81) - 0.3) * 12 * E.u;
        y += (rnd(i, 82) - 0.5) * 14 * E.u;
        pts.push([x, y]);
      }
      WE.path(g, pts.slice(0, Math.floor(k * 14)), { color: rgba([255, 120, 120], 0.8), width: 1.4 * E.u });
      label(g, E, p.word, cx + R * 0.9, cy + R * 0.9, { align: 'center', size: 11, color: rgba(pal.ink, 0.55), spacing: 2 * E.u });
    }
  };

  /* ---- the cage ---- */
  S.cage = function (g, E) {
    const p = E.p, st = E.stage, pal = E.pal;
    const cx = st.x + st.w / 2, cy = st.y + st.h * 0.47;
    const W = st.w * 0.44, H = st.h * 0.62;
    const k = easeOut(clamp(E.line.age / 1.0, 0, 1));
    const warp = p.warp ? 1 + 0.06 * Math.sin(E.t * 1.7) + E.energy.air * 0.05 : 1;
    const kk2 = p.mode === 'break' ? easeInOut(clamp((E.line.age - 0.3) / 1.4, 0, 1)) : 0;
    const bars = 11;
    for (let i = 0; i < bars; i++) {
      const bx = cx - W / 2 + (i / (bars - 1)) * W;
      if (p.mode === 'break') {
        g.save();
        g.translate(bx, cy + H / 2);
        g.rotate(kk2 * (i % 2 ? 0.9 : -0.9));
        WE.line(g, 0, 0, 0, -H, { color: rgba(pal.ink, 0.5 * (1 - kk2)), width: 2 * E.u });
        g.restore();
      } else {
        const bend = p.warp ? Math.sin(E.t * 2 + i * 0.6) * 10 * E.u : 0;
        WE.line(g, bx + bend, cy - (H / 2) * warp, bx - bend, cy + (H / 2) * warp, { color: rgba(pal.ink, 0.2 + 0.5 * clamp(k * bars - i, 0, 1)), width: (i % 2 ? 1.2 : 2.4) * E.u });
      }
    }
    WE.line(g, cx - W / 2, cy - H / 2, cx + W / 2, cy - H / 2, { color: rgba(pal.ink, 0.6), width: 2.2 * E.u });
    WE.line(g, cx - W / 2, cy + H / 2, cx + W / 2, cy + H / 2, { color: rgba(pal.ink, 0.6), width: 2.2 * E.u });
    const inside = kk2 < 0.5;
    const px = inside ? cx + Math.sin(E.t * 1.1) * W * 0.2 : lerp(cx, cx + W * 0.9, kk2);
    WE.disc(g, px, inside ? cy + Math.cos(E.t * 0.8) * H * 0.14 : cy, 7 * E.u, rgba(pal.glow, 0.9), { glow: 18 * E.u, glowColor: rgba(pal.glow, 1) });
    if (p.warp) {
      label(g, E, 'strange', cx - W * 0.36 + Math.sin(E.t * 2) * 8 * E.u, cy - H * 0.3, { size: 13, color: rgba(pal.accent, 0.6), spacing: 2 * E.u });
      label(g, E, 'strange', cx + W * 0.36 - Math.sin(E.t * 2) * 8 * E.u, cy + H * 0.3, { size: 13, color: rgba(pal.accent, 0.6), spacing: 2 * E.u });
    }
    if (p.mode === 'break') label(g, E, p.word, cx + W * 0.9, cy + 26 * E.u, { align: 'center', size: 11, color: rgba(pal.accent, 0.7 * kk2), spacing: 2 * E.u });
    label(g, E, 'trapped: true', cx, cy + H * 0.62, { align: 'center', size: 11, color: rgba(pal.ink, 0.5), spacing: 2.4 * E.u });
  };

  /* ---- the crash ---- */
  S.challenge = function (g, E) {
    const st = E.stage, pal = E.pal;
    const cx = st.x + st.w / 2, cy = st.y + st.h * 0.44;
    const k = easeOut(clamp(E.line.age / 0.8, 0, 1));
    const R = Math.min(st.w, st.h) * 0.3;
    WE.ring(g, cx, cy - R * 0.2, R * 0.55, { color: rgba([255, 255, 255], 0.5), width: 2 * E.u, glow: 18 * E.u, glowColor: rgba(pal.accent, 0.9) });
    WE.disc(g, cx, cy - R * 0.2, R * 0.16, rgba([255, 255, 255], 0.7));
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * 0.15 + (i / 4) * Math.PI * 0.7;
      const x = cx + Math.cos(a) * R * (0.75 + 0.2 * k), y = cy + R * 0.6 - Math.sin(a) * R * 0.3;
      WE.rrect(g, x - 8 * E.u, y - 18 * E.u * k, 16 * E.u, 36 * E.u * k, 3 * E.u, { color: rgba([255, 90, 90], 0.7 * k), width: 1.4 * E.u, fill: rgba([255, 90, 90], 0.12) });
    }
    const bleed = clamp((E.line.age - 0.6) / 1.4, 0, 1);
    g.save();
    g.globalAlpha = bleed * 0.3;
    for (let i = 0; i < 6; i++) {
      const yy = st.y + rnd(i, 91) * st.h;
      WE.line(g, st.x, yy, st.x + st.w, yy + wander(i, E.t, 0.2, 3) * 6 * E.u, { color: rgba([255, 60, 60], 1), width: (1 + rnd(i, 92) * 3) * E.u });
    }
    g.restore();
    label(g, E, 'challenging your god', cx, cy + R * 1.2, { align: 'center', size: 13, color: rgba([255, 160, 160], 0.75 + 0.25 * bleed), spacing: 4 * E.u, glow: 14 * E.u, glowColor: rgba([255, 80, 80], 0.9) });
  };

  S.error = function (g, E) {
    const p = E.p, st = E.stage, pal = E.pal;
    const x = st.x + st.w * 0.16, y = st.y + st.h * 0.16;
    const w = st.w * 0.68, h = st.h * 0.66;
    const k = clamp(E.line.age / 1.1, 0, 1);
    panel(g, E, { x, y, w, h, title: 'STACK TRACE', footer: p.code });
    g.save();
    g.globalAlpha = 0.14;
    g.fillStyle = rgba([255, 40, 40], 1);
    g.fillRect(x, y, w, h);
    g.restore();
    const trace = [
      'TypeError: world.execute()',
      '  at god.judge (sim.js:1:1)',
      '  caller: you',
      '  passed: illegal arguments',
      '',
      'arguments:',
      '  0: love      expected number',
      '  1: freedom   not in signature',
      '  2: me        already disposed',
    ];
    const rows = Math.floor(k * trace.length);
    for (let i = 0; i < rows; i++) {
      const bad = /illegal|expected|not in|disposed/.test(trace[i]);
      const flick = bad && Math.floor(E.t * 12 + i) % 3 === 0;
      WE.text(g, trace[i], x + 14 * E.u, y + 22 * E.u + (i * (h - 30 * E.u)) / trace.length, {
        size: 10.5 * E.u, color: bad ? rgba([255, flick ? 200 : 90, 90], 0.95) : rgba(pal.ink, 0.6), spacing: 0.4 * E.u,
        glow: bad ? 10 * E.u : 0, glowColor: rgba([255, 60, 60], 0.9),
      });
    }
    if (rows > 3) {
      const ly = y + 22 * E.u + (3 * (h - 30 * E.u)) / trace.length;
      const sx = x + 14 * E.u + ((E.t * 220) % (w - 30 * E.u));
      WE.line(g, sx, ly + 8 * E.u, Math.min(x + w - 14 * E.u, sx + 40 * E.u), ly + 8 * E.u, { color: rgba([255, 80, 80], 0.9), width: 2 * E.u, glow: 10 * E.u, glowColor: rgba([255, 60, 60], 1) });
    }
  };

  /* ---- interludes: the four spans the LRC leaves without words ---- */
  S.interlude = function (g, E) {
    const p = E.p, st = E.stage, pal = E.pal;
    const id = E.span && E.span.id;
    const cx = st.x + st.w / 2, cy = st.y + st.h * 0.47;
    const R = Math.min(st.w, st.h) * 0.34;
    if (id === 'simrun') {
      const cols = 26, rows = 14;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const cell = noise(i * 31 + j, E.t * 0.7, 0.35, 4);
          if (cell <= 0.62 - (0.2 * E.density) / 12) continue;
          WE.square(g, cx - R + (i / (cols - 1)) * R * 2, cy - R * 0.62 + (j / (rows - 1)) * R * 1.24, 3.2 * E.u, rgba(mix(pal.glow, pal.accent, cell), 0.5 * cell));
        }
      }
      label(g, E, p.label, cx, cy + R * 0.92, { align: 'center', size: 12, color: rgba(pal.ink, 0.5), spacing: 4 * E.u });
    } else if (id === 'errorstorm') {
      const n = Math.floor(2 + E.local * 26);
      for (let i = 0; i < n; i++) {
        const x = st.x + rnd(i, 101) * st.w * 0.8 + st.w * 0.1;
        const y = st.y + noise(i, E.t * 0.6, 0.6, 7) * st.h * 0.7;
        const w = 90 * E.u * (0.4 + rnd(i, 102) * 0.9), hh = 16 * E.u;
        WE.rrect(g, x, y, w, hh, 2 * E.u, { color: rgba([255, 70, 70], 0.5 + 0.3 * rnd(i, 103)), width: 1 * E.u, fill: rgba([40, 6, 10], 0.6) });
        WE.text(g, 'throw #' + (1000 + i * 7), x + 6 * E.u, y + hh / 2, { size: 9.5 * E.u, color: rgba([255, 150, 150], 0.85), spacing: 0 });
      }
      WE.line(g, cx - R * 1.2, cy + R * 0.4 - E.local * R, cx + R * 1.2, cy + R * 0.4 + E.local * R, { color: rgba([255, 90, 90], 0.4 + 0.5 * E.local), width: (1 + 3 * E.local) * E.u, dash: [10 * E.u, 6 * E.u] });
      label(g, E, p.label + ' x' + n, cx, st.y + st.h * 0.9, { align: 'center', size: 11, color: rgba([255, 140, 140], 0.6 + 0.3 * E.local), spacing: 3 * E.u });
    } else if (id === 'afterglow') {
      const fade = 1 - E.local * 0.55;
      WE.text(g, 'love = lim n->inf (1 + 1/n)^n', cx, cy - R * 0.2, { align: 'center', size: 18 * E.u, color: rgba(pal.ink, 0.55 * fade), spacing: 2 * E.u, glow: 12 * E.u * fade, glowColor: rgba(pal.glow, 0.8) });
      for (let i = 0; i < 40; i++) {
        const a = rnd(i, 111) * Math.PI * 2, d = R * (0.3 + rnd(i, 112) * 1.3);
        WE.disc(g, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7, (0.8 + 2 * rnd(i, 113)) * E.u, rgba(pal.ink, 0.35 * (0.3 + 0.7 * Math.abs(noise(i, E.t, 0.5, 8))) * fade));
      }
      WE.disc(g, cx, cy + R * 0.55, Math.max(1, 6 * E.u * fade), rgba(pal.accent, 0.8), { glow: 20 * E.u, glowColor: rgba(pal.glow, 0.9) });
      label(g, E, p.label, cx, cy + R * 1.1, { align: 'center', size: 11, color: rgba(pal.ink, 0.35), spacing: 3 * E.u });
    } else {
      // poweroff: the CRT collapses to a line, then a dot, then nothing
      const k2 = easeInOut(clamp(E.local * 1.5, 0, 1));
      const h2 = Math.max(1.2 * E.u, st.h * (1 - k2));
      g.save();
      g.globalAlpha = 0.85 * (1 - k2 * 0.4);
      g.fillStyle = rgba([255, 255, 255], 0.75);
      g.fillRect(cx - st.w / 2, cy - h2 / 2, st.w, h2);
      g.restore();
      if (k2 > 0.7) WE.bloom(g, cx, cy, Math.max(1, 40 * E.u * (1 - clamp((k2 - 0.7) / 0.3, 0, 1))), rgba([255, 255, 255], 1), 0.8 * (1 - clamp((k2 - 0.7) / 0.3, 0, 1)));
      label(g, E, p.label, cx, st.y + st.h * 0.9, { align: 'center', size: 11, color: rgba(pal.ink, 0.4 * (1 - E.local)), spacing: 3 * E.u });
    }
  };
})();
