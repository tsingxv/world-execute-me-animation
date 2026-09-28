/* furniture.js — the recurring stage furniture every family draws with.
   Shared so the whole piece reads as one world that changes, not as separate sketches. */
(function () {
  const WE = (window.WE = window.WE || {});
  const { clamp, lerp, rnd, noise, wander, easeOut, pulse, rgba, mix } = WE;

  // a framed sub-panel: the drawing-board look used across the whole piece
  function panel(g, E, o) {
    const pal = E.pal;
    const a = o.alpha === undefined ? 1 : o.alpha;
    WE.rrect(g, o.x, o.y, o.w, o.h, 6 * E.u, {
      color: rgba(pal.glow, 0.5 * a), width: 1 * E.u, fill: rgba(pal.fog, 0.35 * a),
      glow: o.glow || 0, glowColor: rgba(pal.glow, 0.8),
    });
    const c = 8 * E.u;
    g.save();
    g.strokeStyle = rgba(pal.accent, 0.7 * a);
    g.lineWidth = 1.4 * E.u;
    const corners = [[o.x, o.y, 1, 1], [o.x + o.w, o.y, -1, 1], [o.x, o.y + o.h, 1, -1], [o.x + o.w, o.y + o.h, -1, -1]];
    for (const ct of corners) {
      g.beginPath();
      g.moveTo(ct[0] + ct[2] * c, ct[1]);
      g.lineTo(ct[0], ct[1]);
      g.lineTo(ct[0], ct[1] + ct[3] * c);
      g.stroke();
    }
    g.restore();
    if (o.title) WE.text(g, o.title, o.x + 10 * E.u, o.y - 8 * E.u, { size: 11 * E.u, color: rgba(pal.accent, 0.85 * a), spacing: 1.6 * E.u, weight: 700 });
    if (o.footer) WE.text(g, o.footer, o.x + o.w - 6 * E.u, o.y + o.h + 11 * E.u, { size: 10 * E.u, color: rgba(pal.ink, 0.5 * a), align: 'right', spacing: 1 * E.u });
  }

  function caret(g, x, y, size, pal, t) {
    if (Math.floor(t * 2.6) % 2 !== 0) return;
    g.save();
    g.fillStyle = rgba(pal.accent, 0.85);
    g.fillRect(x, y - size * 0.8, size * 0.62, size * 1.6);
    g.restore();
  }

  function label(g, E, text, x, y, o) {
    o = o || {};
    WE.text(g, text, x, y, {
      size: (o.size || 10.5) * E.u,
      color: o.color || rgba(E.pal.ink, o.alpha === undefined ? 0.62 : o.alpha),
      spacing: (o.spacing === undefined ? 1.4 : o.spacing) * E.u,
      align: o.align, weight: o.weight || 600, alpha: o.alpha, glow: o.glow,
      glowColor: rgba(E.pal.glow, 0.9), baseline: o.baseline,
    });
  }

  function meter(g, E, x, y, w, v, o) {
    o = o || {};
    const h = (o.h || 6) * E.u;
    WE.rrect(g, x, y, w, h, 2 * E.u, { color: rgba(E.pal.ink, 0.25), width: 1 * E.u, stroke: 'fill-none' });
    g.save();
    g.fillStyle = o.color || rgba(E.pal.glow, 0.8);
    g.fillRect(x, y, w * clamp(v, 0, 1), h);
    g.restore();
    if (o.ticks) {
      for (let i = 0; i <= o.ticks; i++) {
        WE.line(g, x + (w * i) / o.ticks, y + h, x + (w * i) / o.ticks, y + h + 3 * E.u, { color: rgba(E.pal.ink, 0.3), width: 1 });
      }
    }
  }

  function typed(str, k) {
    const n = Math.floor(clamp(k, 0, 1) * str.length + 1e-6);
    return str.slice(0, Math.min(str.length, n));
  }

  // scramble/decrypt: characters settle left to right, unsettled ones are hashed glyphs
  function scramble(str, k, seed, t) {
    let out = '';
    for (let i = 0; i < str.length; i++) {
      if (k > (i / str.length) * 0.85 + 0.15) out += str[i];
      else if (str[i] === ' ') out += ' ';
      else out += WE.glyph(i * 13 + seed, Math.floor(t * 18));
    }
    return out;
  }

  // a small stick figure self, used whenever a body has to be drawn literally
  function figure(g, x, y, s, color, o) {
    o = o || {};
    const t = o.t || 0;
    g.save();
    if (o.alpha !== undefined) g.globalAlpha *= o.alpha;
    WE.disc(g, x, y - s * 0.62, s * 0.3, color);
    WE.line(g, x, y - s * 0.32, x, y + s * 0.3, { color, width: s * 0.16 });
    const sway = Math.sin(t * 2) * s * 0.12;
    WE.line(g, x - s * 0.34, y - s * 0.05 + sway, x + s * 0.34, y - s * 0.05 - sway, { color, width: s * 0.13 });
    WE.line(g, x, y + s * 0.3, x - s * 0.24, y + s * 0.78, { color, width: s * 0.13 });
    WE.line(g, x, y + s * 0.3, x + s * 0.24, y + s * 0.78, { color, width: s * 0.13 });
    g.restore();
  }

  WE.panel = panel;
  WE.caret = caret;
  WE.label = label;
  WE.meter = meter;
  WE.typed = typed;
  WE.scramble = scramble;
  WE.figure = figure;
})();
