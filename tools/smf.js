/* Minimal Standard MIDI File (format 0/1/2) reader. No dependencies.
   Turns note events into song-seconds using the file's own tempo map.
   Field `uspq` = microseconds per quarter note. */

function readVarLen(buf, p) {
  let value = 0, b;
  do {
    b = buf[p.i++];
    value = (value << 7) | (b & 0x7f);
  } while (b & 0x80);
  return value;
}

function parseTracks(buf, offset, nTracks) {
  const tracks = [];
  const p = { i: offset };
  for (let t = 0; t < nTracks; t++) {
    if (p.i + 8 > buf.length) break;
    const id = buf.toString('ascii', p.i, p.i + 4);
    const len = buf.readUInt32BE(p.i + 4);
    p.i += 8;
    const end = p.i + len;
    const events = [];
    let running = -1, tick = 0;
    while (p.i < end) {
      tick += readVarLen(buf, p);
      let status = buf[p.i];
      if (status < 0x80) {
        if (running < 0) throw new Error('running status overflow at byte ' + p.i);
        status = running;
      } else {
        p.i++;
        if (status < 0xf0) running = status;
      }
      const type = status & 0xf0;
      const ch = status & 0x0f;
      if (status === 0xff) {
        const meta = buf[p.i++];
        const l = readVarLen(buf, p);
        const data = buf.slice(p.i, p.i + l);
        p.i += l;
        events.push({ tick, meta, data });
      } else if (status === 0xf0 || status === 0xf7) {
        const l = readVarLen(buf, p);
        p.i += l;
        events.push({ tick, sysex: true });
      } else if (type === 0xc0 || type === 0xd0) {
        events.push({ tick, status, ch, type, d1: buf[p.i++] });
      } else if (type === 0x90 || type === 0x80 || type === 0xa0 || type === 0xb0 || type === 0xe0) {
        const d1 = buf[p.i++], d2 = buf[p.i++];
        events.push({ tick, status, ch, type, d1, d2 });
      } else {
        throw new Error('unknown status byte 0x' + status.toString(16));
      }
    }
    p.i = end;
    tracks.push({ id, events });
  }
  return tracks;
}

function parse(buf) {
  if (buf.toString('ascii', 0, 4) !== 'MThd') throw new Error('not an MThd file');
  const headerLen = buf.readUInt32BE(4);
  const format = buf.readUInt16BE(8);
  const nTracks = buf.readUInt16BE(10);
  const division = buf.readUInt16BE(12);
  if (division & 0x8000) throw new Error('SMPTE time division unsupported');

  const tracksRaw = parseTracks(buf, 8 + headerLen, nTracks);

  const tempoEvents = [];
  for (const tr of tracksRaw) {
    for (const e of tr.events) {
      if (e.meta === 0x51) tempoEvents.push({ tick: e.tick, micro: (e.data[0] << 16) | (e.data[1] << 8) | e.data[2] });
    }
  }
  tempoEvents.sort((a, b) => a.tick - b.tick);

  const byTick = new Map();
  for (const tp of tempoEvents) byTick.set(tp.tick, tp.micro);
  const map = [{ tick: 0, micro: 500000, seconds: 0 }];
  for (const [tick, micro] of byTick) map.push({ tick, micro, seconds: 0 });
  for (let i = 1; i < map.length; i++) {
    map[i].seconds = map[i - 1].seconds + ((map[i].tick - map[i - 1].tick) / division) * (map[i - 1].micro / 1e6);
  }

  function tickToSeconds(tick) {
    let cur = map[0];
    for (let i = 0; i < map.length; i++) {
      if (map[i].tick <= tick) cur = map[i]; else break;
    }
    return cur.seconds + ((tick - cur.tick) / division) * (cur.micro / 1e6);
  }

  const trackInfos = tracksRaw.map((tr) => {
    let name = '';
    const chanSet = new Set();
    let maxTick = 0;
    for (const e of tr.events) {
      if (e.meta === 0x03) name = e.data.toString('latin1');
      if (e.meta === 0x2f) maxTick = Math.max(maxTick, e.tick);
      if (e.type === 0x90 || e.type === 0x80) { chanSet.add(e.ch); maxTick = Math.max(maxTick, e.tick); }
    }
    return { name, channels: [...chanSet].sort((a, b) => a - b), endSeconds: tickToSeconds(maxTick) };
  });

  const notes = [];
  tracksRaw.forEach((tr, ti) => {
    const open = new Map();
    for (const e of tr.events) {
      if (e.meta != null || e.sysex) continue;
      if (e.type === 0x90 && e.d2 > 0) {
        open.set(e.ch + ':' + e.d1, { startTick: e.tick, vel: e.d2 });
      } else if (e.type === 0x80 || (e.type === 0x90 && e.d2 === 0)) {
        const key = e.ch + ':' + e.d1;
        const st = open.get(key);
        open.delete(key);
        if (st) {
          notes.push({
            track: ti,
            channel: e.ch,
            pitch: e.d1,
            velocity: st.vel,
            t: tickToSeconds(st.startTick),
            dur: Math.max(0, tickToSeconds(e.tick) - tickToSeconds(st.startTick)),
          });
        }
      }
    }
    for (const [key, st] of open) {
      const [ch, pitch] = key.split(':').map(Number);
      notes.push({ track: ti, channel: ch, pitch, velocity: st.vel, t: tickToSeconds(st.startTick), dur: 0 });
    }
  });
  notes.sort((a, b) => a.t - b.t || a.pitch - b.pitch);

  const controls = [];
  tracksRaw.forEach((tr, ti) => {
    for (const e of tr.events) {
      if (e.type === 0xb0) controls.push({ track: ti, channel: e.ch, cc: e.d1, value: e.d2, t: tickToSeconds(e.tick) });
    }
  });

  const lyricEvents = [];
  for (const tr of tracksRaw) {
    for (const e of tr.events) if (e.meta === 0x05) lyricEvents.push({ t: tickToSeconds(e.tick), text: e.data.toString('latin1') });
  }

  return {
    format, nTracks, division,
    tempoMap: map,
    trackInfos,
    notes,
    controls,
    lyricEvents,
    endSeconds: map.length ? map[map.length - 1].seconds : 0,
  };
}

module.exports = { parse };
