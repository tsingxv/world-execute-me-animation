/* kit.js — deterministic primitives. Everything here is a pure function of its
 * arguments: no Math.random(), no accumulated state, nothing that depends on how
 * many frames have run. Seeking to t and drawing must give byte-identical output
 * no matter what t was before it. */
(function () {
  const WE = (window.WE = window.WE || {});

  /* ---------- hashing ---------- */
  // mixwell-ish 32-bit mixer; (i, salt) -> uint32
  WE.hash = function (i, salt) {
    let h = (i | 0) ^ 0x9e3779b9;
    h = Math.imul(h ^ (salt | 0), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
  };
  // [0,1) from an item index and a salt
  WE.rnd = function (i, salt) {
    return WE.hash(i, salt === undefined ? 0 : salt) / 4294967296;
  };
  // [0,1) from (item, quantised time). Quantising with floor keeps it a pure
  // function of t, so scrubbing backwards re-creates identical flicker frames.
  WE.rndT = function (i, t, fps, salt) {
    return WE.rnd(i, Math.floor(t * fps) + (salt || 0) * 100003);
  };
  WE.pick = function (list, i, salt) {
    return list[Math.floor(WE.rnd(i, salt) * list.length) % list.length];
  };
  // smooth value noise in [0,1]: linear blend between quantised hash cells, still pure
  WE.noise = function (i, t, cell, salt) {
    const x = t / cell;
    const a = WE.rnd(i, Math.floor(x) + (salt || 0) * 8191);
    const b = WE.rnd(i, Math.floor(x) + 1 + (salt || 0) * 8191);
    const f = x - Math.floor(x);
    const s = f * f * (3 - 2 * f);
    return a + (b - a) * s;
  };
  // signed wander, good for jitter offsets
  WE.wander = function (i, t, cell, salt) {
    return WE.noise(i, t, cell, salt) * 2 - 1;
  };

  /* ---------- scalars ---------- */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  WE.clamp = clamp;
  WE.lerp = (a, b, k) => a + (b - a) * k;
  WE.inv = (a, b, v) => (b === a ? 0 : clamp((v - a) / (b - a), 0, 1));
  WE.smooth = (k) => k * k * (3 - 2 * k);
  WE.easeOut = (k) => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
  WE.easeIn = (k) => clamp(k, 0, 1) * clamp(k, 0, 1) * clamp(k, 0, 1);
  WE.easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  WE.pulse = (age, life) => (age < 0 || age > life ? 0 : 1 - clamp(age / life, 0, 1));
  WE.decay = (age, tau) => (age < 0 ? 0 : Math.exp(-age / tau));
  // triangle wave in [-1,1], period 1, peak at integers
  WE.tri = function (x) {
    const f = ((x % 1) + 1) % 1;
    return 4 * Math.abs(f - 0.5) - 1;
  };

  /* ---------- colour ---------- */
  WE.hsla = (h, s, l, a) => 'hsla(' + (((h % 360) + 360) % 360).toFixed(1) + ',' + clamp(s, 0, 100).toFixed(0) + '%,' + clamp(l, 0, 100).toFixed(0) + '%,' + clamp(a === undefined ? 1 : a, 0, 1).toFixed(3) + ')';
  // hex -> [r,g,b]
  WE.rgb = (hex) => {
    const v = parseInt(hex.replace('#', ''), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  };
  WE.rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + clamp(a === undefined ? 1 : a, 0, 1).toFixed(3) + ')';
  WE.mix = (c1, c2, k) => [Math.round(WE.lerp(c1[0], c2[0], k)), Math.round(WE.lerp(c1[1], c2[1], k)), Math.round(WE.lerp(c1[2], c2[2], k))];

  // mood -> palette. One entity, different light.
  WE.MOOD = {
    boot: { ink: [190, 235, 255], glow: [90, 200, 255], accent: [80, 255, 190], fog: [6, 14, 22], sat: 78 },
    logic: { ink: [205, 232, 255], glow: [110, 180, 255], accent: [120, 240, 235], fog: [8, 13, 26], sat: 70 },
    devotion: { ink: [255, 220, 236], glow: [255, 130, 190], accent: [255, 190, 120], fog: [22, 10, 20], sat: 76 },
    whimsy: { ink: [232, 255, 214], glow: [150, 240, 130], accent: [255, 210, 90], fog: [10, 20, 14], sat: 82 },
    flux: { ink: [228, 208, 255], glow: [170, 110, 255], accent: [90, 220, 255], fog: [14, 8, 26], sat: 74 },
    collapse: { ink: [200, 210, 226], glow: [110, 130, 170], accent: [180, 190, 210], fog: [10, 12, 18], sat: 22 },
    void: { ink: [224, 228, 236], glow: [90, 100, 120], accent: [140, 150, 170], fog: [4, 5, 8], sat: 10 },
    error: { ink: [255, 214, 214], glow: [255, 70, 70], accent: [255, 150, 60], fog: [24, 5, 8], sat: 88 },
    climax: { ink: [255, 255, 255], glow: [255, 90, 220], accent: [120, 255, 255], fog: [16, 4, 20], sat: 92 },
    chorus: { ink: [255, 226, 246], glow: [236, 110, 236], accent: [255, 176, 210], fog: [18, 8, 24], sat: 84 },
    tender: { ink: [255, 236, 206], glow: [255, 176, 96], accent: [255, 214, 150], fog: [20, 12, 6], sat: 70 },
    end: { ink: [210, 214, 222], glow: [120, 130, 150], accent: [170, 178, 192], fog: [3, 4, 6], sat: 14 },
  };
  WE.moodPal = function (name, blendName, k) {
    const a = WE.MOOD[name] || WE.MOOD.logic;
    if (!blendName || !k || k <= 0) return a;
    const b = WE.MOOD[blendName] || a;
    const m = WE.clamp(k, 0, 1);
    return {
      ink: WE.mix(a.ink, b.ink, m),
      glow: WE.mix(a.glow, b.glow, m),
      accent: WE.mix(a.accent, b.accent, m),
      fog: WE.mix(a.fog, b.fog, m),
      sat: WE.lerp(a.sat, b.sat, m),
    };
  };

  /* ---------- canvas helpers ---------- */
  const GLYPHS = '01{}[]()<>/*-+=$;:.,_|\\#$&@?!ABCDEFGHKLMNPRSTVXZ';
  WE.glyph = function (i, salt) {
    return GLYPHS[Math.floor(WE.rnd(i, salt || 0) * GLYPHS.length) % GLYPHS.length];
  };

  // Text with manual letter spacing (canvas letterSpacing is not portable).
  WE.text = function (g, str, x, y, o) {
    // test hook only: records the logical string, since the draw below is per character
    if (WE.__textLog) WE.__textLog.push(String(str));
    o = o || {};
    const size = o.size || 16;
    const sp = o.spacing || 0;
    const weight = o.weight || 600;
    const family = o.family || 'ui-monospace, SFMono-Regular, Consolas, monospace';
    g.font = weight + ' ' + size + 'px ' + family;
    g.textBaseline = o.baseline || 'middle';
    const s = String(str);
    let total = 0;
    for (let i = 0; i < s.length; i++) total += g.measureText(s[i]).width + sp;
    total -= s.length ? sp : 0;
    let cx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
    g.save();
    if (o.skew) g.transform(1, 0, -o.skew, 1, 0, 0);
    if (o.alpha !== undefined) g.globalAlpha *= o.alpha;
    if (o.glow) { g.shadowColor = o.glowColor || o.color || '#fff'; g.shadowBlur = o.glow; }
    g.fillStyle = o.color || '#fff';
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (o.perChar) {
        g.fillStyle = o.perChar(ch, i, s.length, x, y) || o.color || '#fff';
      }
      if (o.charJitter) {
        const j = o.charJitter;
        g.fillText(ch, cx + WE.wander(i + (o.seed || 0), o.jitterT || 0, 0.06, 3) * j, y + WE.wander(i * 7 + (o.seed || 0), (o.jitterT || 0) + 1.3, 0.06, 9) * j);
      } else {
        g.fillText(ch, cx, y);
      }
      cx += g.measureText(ch).width + sp;
    }
    g.restore();
    return total;
  };

  WE.textW = function (g, str, o) {
    o = o || {};
    g.font = (o.weight || 600) + ' ' + (o.size || 16) + 'px ' + (o.family || 'ui-monospace, SFMono-Regular, Consolas, monospace');
    let w = 0;
    const s = String(str);
    for (let i = 0; i < s.length; i++) w += g.measureText(s[i]).width + (o.spacing || 0);
    return w - (s.length ? o.spacing || 0 : 0);
  };

  // line with optional dashes and glow
  WE.line = function (g, x1, y1, x2, y2, o) {
    o = o || {};
    g.save();
    g.strokeStyle = o.color || '#fff';
    g.lineWidth = o.width || 1;
    if (o.alpha !== undefined) g.globalAlpha *= o.alpha;
    if (o.dash) g.setLineDash(o.dash);
    if (o.glow) { g.shadowColor = o.glowColor || o.color; g.shadowBlur = o.glow; }
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
    g.restore();
  };

  WE.path = function (g, pts, o) {
    if (!pts.length) return;
    o = o || {};
    g.save();
    g.strokeStyle = o.color || '#fff';
    g.lineWidth = o.width || 1;
    g.lineJoin = o.join || 'round';
    g.lineCap = o.cap || 'round';
    if (o.alpha !== undefined) g.globalAlpha *= o.alpha;
    if (o.dash) g.setLineDash(o.dash);
    if (o.glow) { g.shadowColor = o.glowColor || o.color; g.shadowBlur = o.glow; }
    if (o.fill) g.fillStyle = o.fill;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    if (o.closePath) g.closePath();
    if (o.fill) g.fill();
    g.stroke();
    g.restore();
  };

  WE.curve = function (g, fn, x0, x1, steps, yFn, o) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      const x = WE.lerp(x0, x1, k);
      pts.push([x, yFn(x, k)]);
    }
    WE.path(g, pts, o);
  };

  WE.rrect = function (g, x, y, w, h, r, o) {
    o = o || {};
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    g.save();
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
    g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r);
    g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r);
    g.quadraticCurveTo(x, y, x + r, y);
    g.closePath();
    if (o.fill) { g.fillStyle = o.fill; g.fill(); }
    if (o.stroke !== 'none') {
      g.strokeStyle = o.color || '#fff';
      g.lineWidth = o.width || 1;
      if (o.dash) g.setLineDash(o.dash);
      if (o.alpha !== undefined) g.globalAlpha *= o.alpha;
      if (o.glow) { g.shadowColor = o.glowColor || o.color; g.shadowBlur = o.glow; }
      g.stroke();
    }
    g.restore();
  };

  WE.ring = function (g, x, y, r, o) {
    o = o || {};
    g.save();
    g.beginPath();
    g.arc(x, y, Math.max(0.1, r), o.a0 || 0, o.a1 === undefined ? Math.PI * 2 : o.a1);
    if (o.fill) { g.fillStyle = o.fill; g.fill(); }
    g.strokeStyle = o.color || '#fff';
    g.lineWidth = o.width || 1;
    if (o.alpha !== undefined) g.globalAlpha *= o.alpha;
    if (o.dash) g.setLineDash(o.dash);
    if (o.glow) { g.shadowColor = o.glowColor || o.color; g.shadowBlur = o.glow; }
    g.stroke();
    g.restore();
  };

  WE.disc = function (g, x, y, r, color, o) {
    o = o || {};
    g.save();
    if (o.alpha !== undefined) g.globalAlpha *= o.alpha;
    if (o.glow) { g.shadowColor = o.glowColor || color; g.shadowBlur = o.glow; }
    g.fillStyle = color;
    g.beginPath();
    g.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
    g.fill();
    g.restore();
  };

  WE.square = function (g, x, y, s, color, o) {
    o = o || {};
    g.save();
    if (o.alpha !== undefined) g.globalAlpha *= o.alpha;
    if (o.rot) { g.translate(x, y); g.rotate(o.rot); g.translate(-x, -y); }
    g.fillStyle = color;
    g.fillRect(x - s / 2, y - s / 2, s, s);
    g.restore();
  };

  // radial glow blob, used sparingly
  WE.bloom = function (g, x, y, r, color, a) {
    if (r <= 0 || a <= 0) return;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, color);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.save();
    g.globalAlpha = a;
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };

  // clip to the stage so no scene can paint outside the frame
  WE.stageClip = function (g, E) {
    g.save();
    g.beginPath();
    g.rect(0, 0, E.W, E.H);
    g.clip();
  };

  /* ---------- number/time formatting ---------- */
  WE.mmss = function (t) {
    t = Math.max(0, t);
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const c = Math.floor((t * 100) % 100);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + ':' + String(c).padStart(2, '0');
  };
  WE.pad = (v, n) => String(v).padStart(n || 2, '0');
  WE.hex = (v) => '0x' + (v >>> 0).toString(16).toUpperCase().padStart(4, '0');
  // NOTE_NAMES: used for pitch labels
  WE.NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  WE.pitchName = (p) => WE.NOTE_NAMES[p % 12] + (Math.floor(p / 12) - 1);
})();
