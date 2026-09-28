/* layers.js — the persistent painting boards that are always alive, plus the frame
   composer. Each layer is a pure function of t; none of them keeps state between frames.
   Accents are driven by WE_NOTES (MIDI material) registered onto WE_AUDIO.onsets
   (measured); words are driven by WE_LYRICS (LRC). The two never borrow each other's clock. */
(function () {
  const WE = (window.WE = window.WE || {});
  const L = (WE.layers = {});
  const { clamp, lerp, rnd, noise, wander, easeOut, rgba, mix } = WE;
  const { panel, label, meter } = WE;
  const D = () => WE.data;

  /* ---------- 1. the void: base field, breathing with the measured loudness ---------- */
  L.void = function (g, E) {
    const pal = E.pal;
    const base = pal.fog;
    const gr = g.createLinearGradient(0, 0, 0, E.H);
    gr.addColorStop(0, rgba(mix(base, [255, 255, 255], 0.05 + 0.05 * E.energy.rms), 1));
    gr.addColorStop(0.55, rgba(base, 1));
    gr.addColorStop(1, rgba(mix(base, [0, 0, 0], 0.5), 1));
    g.fillStyle = gr;
    g.fillRect(0, 0, E.W, E.H);
    // measured loudness blooms behind the entity
    WE.bloom(g, E.W * 0.5, E.H * 0.46, E.W * (0.18 + 0.22 * E.energy.rms), rgba(pal.glow, 0.55), 0.10 + 0.22 * E.energy.rms);
    if (E.energy.air > 0.55) WE.bloom(g, E.W * 0.5, E.H * 0.46, E.W * 0.4, rgba(pal.accent, 0.5), (E.energy.air - 0.55) * 0.3);
  };

  /* ---------- 2. the runtime grid ---------- */
  L.grid = function (g, E) {
    const pal = E.pal;
    const horizon = E.H * 0.62;
    const scroll = (E.t * (0.18 + 0.5 * E.energy.low)) % 1;
    g.save();
    g.lineWidth = 1;
    // perspective floor
    for (let i = 0; i < 16; i++) {
      const k = (i + scroll) / 16;
      const y = horizon + Math.pow(k, 2.4) * (E.H - horizon) * 1.6;
      if (y > E.H) continue;
      g.strokeStyle = rgba(pal.glow, 0.05 + 0.12 * k);
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(E.W, y);
      g.stroke();
    }
    for (let i = -12; i <= 12; i++) {
      const x = E.W / 2 + i * E.W * 0.055;
      g.strokeStyle = rgba(pal.glow, 0.05);
      g.beginPath();
      g.moveTo(E.W / 2 + i * E.W * 0.012, horizon);
      g.lineTo(x + (x - E.W / 2) * 1.4, E.H);
      g.stroke();
    }
    // ceiling lattice, warp follows the measured high band
    const warp = 6 * E.u * E.energy.high;
    for (let i = 0; i <= 20; i++) {
      const x = (i / 20) * E.W;
      g.strokeStyle = rgba(pal.accent, 0.05);
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + Math.sin(i * 0.7 + E.t) * warp, E.H * 0.24);
      g.stroke();
    }
    g.restore();
  };

  /* ---------- 3. code rain: columns of glyphs, density from the recording ---------- */
  L.rain = function (g, E) {
    const pal = E.pal;
    const cols = Math.max(14, Math.floor(E.W / 34 / E.u / 2));
    const speed = 60 + 160 * E.energy.rms;
    for (let c = 0; c < cols; c++) {
      const x = ((c + 0.5) / cols) * E.W;
      const lane = rnd(c, 201);
      const len = Math.floor(6 + 22 * lane);
      const v = (0.5 + lane) * speed;
      const head = (E.t * v + lane * E.H * 3) % (E.H + len * 14 * E.u);
      const dim = E.mood === 'void' || E.mood === 'collapse' ? 0.25 : 1;
      for (let i = 0; i < len; i++) {
        const y = head - i * 14 * E.u;
        if (y < -10 || y > E.H + 10) continue;
        const fade = (1 - i / len) * (0.5 - 0.35 * (i / len));
        WE.text(g, WE.glyph(c * 41 + Math.floor(y / (14 * E.u)), Math.floor(E.t * 6)), x, y, {
          size: (i === 0 ? 12 : 10) * E.u, color: rgba(i === 0 ? pal.accent : mix(pal.ink, pal.glow, 0.5), fade * dim), spacing: 0, align: 'center',
        });
      }
    }
  };

  /* ---------- 4. accents: the MIDI note events ---------- */
  const LIFE = 0.75;
  L.accents = function (g, E) {
    const pal = E.pal;
    const D0 = D();
    const evs = D0.eventsIn(Math.max(0, E.t - LIFE), E.t + 0.001);
    const bottom = E.H * 0.9;
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i];
      const age = E.t - e.t;
      if (age < 0 || age > LIFE) continue;
      const k = 1 - age / LIFE;
      const power = (e.vel / 127) * k * k;
      if (e.lo) {
        // bass notes punch the floor: a bar whose width is the held length
        const x = E.W * (0.08 + ((e.bass % 12) / 12) * 0.84);
        const h = E.H * 0.06 * (0.4 + power);
        g.save();
        g.globalAlpha = 0.55 * k;
        g.fillStyle = rgba(mix(pal.glow, pal.accent, 0.3), 0.7);
        g.fillRect(x - 2 * E.u, bottom - h, 4 * E.u, h + 20 * E.u * power);
        g.restore();
        WE.ring(g, x, bottom, 6 * E.u + 90 * E.u * (1 - k), { color: rgba(pal.glow, 0.35 * k), width: 1.5 * E.u });
      }
      if (e.n >= 3) {
        // chords open a ring around the entity
        WE.ring(g, E.cx, E.cy, E.H * (0.1 + 0.32 * (1 - k)), { color: rgba(pal.accent, 0.3 * k), width: (0.6 + 2 * k) * E.u, a0: (e.mid / 12) * 6.283, a1: (e.mid / 12) * 6.283 + 2.2 });
      }
      if (e.mel) {
        // melody notes tick along the top rail
        const x = E.W * (0.06 + ((e.soprano % 24) / 24) * 0.88);
        WE.line(g, x, E.H * 0.075, x + 10 * E.u * k, E.H * 0.075 + (1 - k) * 14 * E.u, { color: rgba(pal.ink, 0.5 * k), width: 1.4 * E.u });
      }
    }
  };

  /* ---------- 5. piano roll: the MIDI data as a legible object ---------- */
  L.roll = function (g, E) {
    const D0 = D();
    const N = D0.notes;
    const win = 4.0; // seconds of history visible
    const x0 = E.W - E.W * 0.2, w = E.W * 0.185;
    const y0 = E.H * 0.16, h = E.H * 0.5;
    const pal = E.pal;
    panelRoll(g, E, x0, y0, w, h);
    const lo = 34, hi = 78;
    const list = D0.notesIn(Math.max(0, E.t - win), Math.min(N.span[1] + 0.1, E.t + 0.05));
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      const px = x0 + w * (1 - (E.t - n.t) / win);
      const py = y0 + h * (1 - (n.p - lo) / (hi - lo));
      const bw = Math.max(1.5 * E.u, (w / win) * Math.min(n.d, win));
      const age = E.t - n.t;
      g.save();
      g.globalAlpha = clamp(1 - age / win, 0.1, 1);
      g.fillStyle = rgba(mix(pal.glow, pal.accent, (n.p - lo) / (hi - lo)), 0.85);
      g.fillRect(px, py - 1.6 * E.u, bw, 3.2 * E.u);
      g.restore();
    }
    label(g, E, 'MIDI ' + N.count + ' events, ' + N.bpm + 'bpm', x0, y0 - 10 * E.u, { size: 9.5, color: rgba(pal.accent, 0.6), spacing: 1.2 * E.u });
    label(g, E, 'window t-4s   chart ends ' + N.span[1] + 's', x0 + w, y0 + h + 10 * E.u, { align: 'right', size: 9, color: rgba(pal.ink, 0.4) });
  };
  function panelRoll(g, E, x, y, w, h) {
    const pal = E.pal;
    g.save();
    g.globalAlpha = 0.5;
    WE.rrect(g, x - 6 * E.u, y - 6 * E.u, w + 12 * E.u, h + 12 * E.u, 3 * E.u, { color: rgba(pal.ink, 0.25), width: 1 * E.u, fill: rgba(pal.fog, 0.35) });
    g.restore();
    for (let i = 0; i < 4; i++) {
      const yy = y + (i / 3) * h;
      WE.line(g, x, yy, x + w, yy, { color: rgba(pal.ink, 0.12), width: 1 });
    }
    WE.line(g, x + w, y, x + w, y + h, { color: rgba(pal.accent, 0.4), width: 1.5 * E.u });
  }

  /* ---------- 6. the entity: one being across all 96 lines ---------- */
  L.entity = function (g, E) {
    const pal = E.pal;
    const t = E.t;
    const dx = Math.sin(t * 0.23) * E.W * 0.012 + wander(1, t, 1.2, 41) * 3 * E.u * E.energy.air;
    const dy = Math.cos(t * 0.19) * E.H * 0.01;
    const x = E.entity.x + dx, y = E.entity.y + dy;
    const breath = 1 + 0.06 * Math.sin(t * 1.4) + 0.14 * E.energy.low;
    const s = E.H * 0.028 * breath;
    const dim = E.mood === 'void' ? 0.45 : 1;
    // orbiters counted from how busy the MIDI is right now
    const dens = clamp(E.density / 12, 0, 1);
    const n = 3 + Math.floor(dens * 7);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + t * (0.4 + i * 0.05);
      const rr = s * (2.6 + 1.4 * Math.sin(t * 0.7 + i));
      WE.disc(g, x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.55, (1.2 + 1.6 * rnd(i, 301)) * E.u, rgba(mix(pal.accent, pal.glow, rnd(i, 302)), 0.5 * dim));
    }
    // body: a rounded square 'cursor' with a core
    g.save();
    g.globalAlpha = dim;
    g.translate(x, y);
    g.rotate(Math.sin(t * 0.3) * 0.12);
    WE.rrect(g, -s, -s, s * 2, s * 2, s * 0.42, { color: rgba(pal.accent, 0.85), width: 1.6 * E.u, fill: rgba(pal.glow, 0.12), glow: 22 * E.u, glowColor: rgba(pal.glow, 0.8) });
    g.restore();
    WE.disc(g, x, y, s * 0.3 * (1 + 0.2 * Math.sin(t * 3)), rgba([255, 255, 255], 0.8 * dim), { glow: 14 * E.u, glowColor: rgba(pal.accent, 1) });
    // heartbeat ring locked to the strongest recent accent
    const nearest = D().nearestOnset(t);
    if (nearest && nearest.delta >= -0.35 && nearest.delta < 0) {
      const k = -nearest.delta / 0.35;
      WE.ring(g, x, y, s * (1.4 + 3 * (1 - k)), { color: rgba(pal.accent, (1 - k) * 0.6 * dim), width: (2.2 - 1.6 * k) * E.u });
    }
    label(g, E, 'self', x + s * 1.6, y - s * 1.2, { size: 9, color: rgba(pal.ink, 0.4 * dim), spacing: 1.5 * E.u });
  };

  /* ---------- 7. the lyric console line ---------- */
  L.lyric = function (g, E) {
    const lines = E.group && E.group.length > 1 ? E.group : [E.line].filter(Boolean);
    if (!lines.length) return;
    const pal = E.pal;
    const baseY = E.H * 0.855;
    for (let li = 0; li < lines.length; li++) {
      const ln = lines[li];
      const text = ln.text;
      const mood = ln.mood || E.mood;
      const palFor = WE.moodPal(mood);
      const age = ln.age === undefined ? (E.t - ln.start) : ln.age;
      const appear = easeOut(clamp(age / 0.28, 0, 1));
      const size = clamp((E.W * 1.5) / Math.max(12, text.length), 13, 30) * E.u;
      const y = baseY + li * size * 1.5;
      let col = rgba(palFor.ink, 0.94);
      const opts = { size, color: col, align: 'center', spacing: size * 0.045, weight: 700, glow: 0 };
      // per-mood typography: the same console line, differently voiced
      if (mood === 'climax' || mood === 'error') { opts.glow = 26 * E.u; opts.color = rgba(mood === 'error' ? [255, 120, 120] : palFor.glow, 0.95); }
      else if (mood === 'devotion' || mood === 'tender') { opts.glow = 18 * E.u; opts.color = rgba(palFor.glow, 0.92); }
      else if (mood === 'void') { opts.color = rgba(palFor.ink, 0.5); opts.spacing = size * 0.16; }
      else if (mood === 'collapse') { opts.color = rgba(palFor.ink, 0.62); }
      else { opts.glow = 10 * E.u; }
      const reveal = text.slice(0, Math.max(1, Math.floor(text.length * appear)));
      if (mood === 'flux' || mood === 'error') {
        const j = (mood === 'error' ? 3 : 2) * E.u * (0.4 + E.energy.air);
        WE.text(g, reveal, E.W / 2, y, Object.assign(opts, { charJitter: j, jitterT: E.t, seed: ln.index || 0 }));
      } else {
        WE.text(g, reveal, E.W / 2, y, opts);
      }
      // underline grows with the line, and shows the LRC window it owns
      const w = WE.textW(g, reveal, opts);
      WE.line(g, E.W / 2 - w / 2, y + size * 0.8, E.W / 2 - w / 2 + w * appear, y + size * 0.8, { color: rgba(palFor.accent, 0.4), width: 1 * E.u });
      if (lines.length > 1) label(g, E, (li === 0 ? '[' : '[') + (li + 1) + '/' + lines.length + ']', E.W / 2 - w / 2 - 34 * E.u, y, { size: 9, color: rgba(pal.ink, 0.35), spacing: 0 });
    }
  };

  /* ---------- 8. HUD ---------- */
  L.hud = function (g, E) {
    const pal = E.pal;
    const D0 = D();
    const t = E.t;
    WE.line(g, 0, E.H * 0.045, E.W, E.H * 0.045, { color: rgba(pal.ink, 0.16), width: 1 });
    WE.text(g, WE_LYRICS.title, E.W * 0.03, E.H * 0.028, { size: 11 * E.u, color: rgba(pal.ink, 0.7), spacing: 1.6 * E.u });
    WE.text(g, D0.sectionAt(t).toUpperCase(), E.W * 0.03, E.H * 0.064, { size: 9 * E.u, color: rgba(pal.accent, 0.6), spacing: 2.4 * E.u });
    WE.text(g, WE.mmss(t), E.W - E.W * 0.03, E.H * 0.028, { size: 11 * E.u, color: rgba(pal.ink, 0.8), align: 'right', spacing: 1.4 * E.u });
    WE.text(g, 'of ' + WE.mmss(D0.end), E.W - E.W * 0.03, E.H * 0.064, { size: 9 * E.u, color: rgba(pal.ink, 0.4), align: 'right', spacing: 1.2 * E.u });
    // two clocks, kept visibly apart: LRC owns words, MIDI owns accents
    const y = E.H * 0.955;
    WE.line(g, E.W * 0.03, y, E.W * 0.97, y, { color: rgba(pal.ink, 0.2), width: 2 * E.u });
    const k = clamp(t / D0.end, 0, 1);
    WE.line(g, E.W * 0.03, y, E.W * 0.03 + (E.W * 0.94) * k, y, { color: rgba(pal.accent, 0.75), width: 2 * E.u, glow: 8 * E.u, glowColor: rgba(pal.glow, 0.9) });
    // LRC marks
    for (let i = 0; i < D0.lyricStarts.length; i++) {
      const s = D0.lyricStarts[i];
      if (s > D0.notes.span[1] && s < 147) continue;
      const x = E.W * 0.03 + (E.W * 0.94) * (s / D0.end);
      WE.line(g, x, y - 4 * E.u, x, y + 4 * E.u, { color: rgba(pal.ink, s <= t ? 0.5 : 0.22), width: 1 * E.u });
    }
    // MIDI events as ticks under the rail
    const evs = D0.eventsIn(0, D0.end);
    for (let i = 0; i < evs.length; i += 3) {
      const x = E.W * 0.03 + (E.W * 0.94) * (evs[i].t / D0.end);
      WE.line(g, x, y + 5 * E.u, x, y + 8 * E.u, { color: rgba(pal.glow, 0.3), width: 1 * E.u });
    }
    label(g, E, 'lrc ' + D0.lyrics.count + ' lines', E.W * 0.03, y + 16 * E.u, { size: 9, color: rgba(pal.ink, 0.4) });
    label(g, E, 'midi ' + D0.notes.count + ' notes -> ' + evs.length + ' accents (ends ' + D0.notes.span[1] + 's)', E.W * 0.97, y + 16 * E.u, { size: 9, color: rgba(pal.ink, 0.4), align: 'right' });
  };

  /* ---------- 9. overlays: scanlines, vignette, flash locked to real onsets ---------- */
  L.overlay = function (g, E) {
    const pal = E.pal;
    g.save();
    g.globalAlpha = 0.06;
    g.fillStyle = '#000';
    for (let y = 0; y < E.H; y += 3) g.fillRect(0, y, E.W, 1);
    g.restore();
    // vignette
    const vg = g.createRadialGradient(E.W / 2, E.H / 2, Math.min(E.W, E.H) * 0.3, E.W / 2, E.H / 2, Math.max(E.W, E.H) * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = vg;
    g.fillRect(0, 0, E.W, E.H);
    // accent flash: locked to the nearest *measured* onset, so it hits with the music
    const n = D().nearestOnset(E.t);
    if (n && n.delta < 0) {
      const k = -n.delta;
      if (k < 0.06) {
        g.save();
        g.globalAlpha = (1 - k / 0.06) * 0.10 * n.s;
        g.fillStyle = rgba(pal.ink, 1);
        g.fillRect(0, 0, E.W, E.H);
        g.restore();
      }
    }
    // corruption bands during the crash / climax moods, hashed per frame index
    if (E.mood === 'error' || E.mood === 'climax') {
      const strength = E.mood === 'error' ? 1 : 0.5;
      for (let i = 0; i < 6; i++) {
        const f = Math.floor(E.t * 20);
        if (rnd(i, f) > 0.72 - 0.2 * strength) {
          const y = rnd(i + 1, f + 5) * E.H;
          const h = (2 + 18 * rnd(i, f + 9)) * E.u * strength;
          g.save();
          g.globalAlpha = 0.1 + 0.25 * strength;
          g.fillStyle = rgba(E.mood === 'error' ? [255, 70, 70] : pal.glow, 1);
          g.fillRect(0, y, E.W, h);
          g.restore();
        }
      }
    }
    // error badges for any board that threw (diagnostics, not part of the art)
    const errs = WE.errors || {};
    const ids = Object.keys(errs);
    for (let i = 0; i < ids.length; i++) {
      const e = errs[ids[i]];
      WE.rrect(g, 8 * E.u, E.H - (i + 1) * 22 * E.u - 60 * E.u, 300 * E.u, 18 * E.u, 3 * E.u, { color: rgba([255, 90, 90], 0.9), width: 1 * E.u, fill: 'rgba(40,0,0,0.75)' });
      WE.text(g, (ids[i] || '?') + ': ' + String(e.message).slice(0, 34), 14 * E.u, E.H - (i + 1) * 22 * E.u - 51 * E.u, { size: 9.5 * E.u, color: rgba([255, 160, 160], 1), spacing: 0 });
    }
  };

  /* ---------- 10. the title card, before the first lyric (0.0 - 0.0 s) ---------- */
  L.idle = function (g, E) {
    const pal = E.pal;
    WE.text(g, 'world.execute(me);', E.W / 2, E.H * 0.42, { align: 'center', size: 34 * E.u, color: rgba(pal.ink, 0.9), spacing: 4 * E.u, glow: 20 * E.u, glowColor: rgba(pal.glow, 0.9) });
    WE.text(g, 'Mili', E.W / 2, E.H * 0.52, { align: 'center', size: 14 * E.u, color: rgba(pal.accent, 0.7), spacing: 6 * E.u });
  };
})();
