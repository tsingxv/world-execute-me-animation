/* Exact mp3 duration by walking MPEG audio frame headers and summing samples.
   No dependencies, no external tools. */
const fs = require('fs');

const BR = {
  mpeg1: { 3: [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320,0], 2: [0,32,48,56,64,80,96,112,128,160,192,224,256,320,480,0], 1: [0,32,64,96,128,160,192,224,256,288,320,352,384,416,448,0] },
  mpeg2: { 3: [0,32,48,56,64,80,96,112,128,144,160,176,192,224,256,0], 2: [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160,0], 1: [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160,0] },
};

function id3v2Size(buf) {
  if (buf.length < 10 || buf.toString('ascii', 0, 3) !== 'ID3') return 0;
  return 10 + ((buf[6] << 21) | (buf[7] << 14) | (buf[8] << 7) | buf[9]);
}

function measure(file) {
  const buf = fs.readFileSync(file);
  let i = id3v2Size(buf);
  const firstFrameAt = i;
  let frames = 0, samples = 0, srSeen = 0, bitrates = [], chanModes = new Set();

  while (i < buf.length - 4) {
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) { i++; continue; }
    const b1 = buf[i + 1], b2 = buf[i + 2], b3 = buf[i + 3];
    const versionBits = (b1 >> 3) & 0x03;             // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
    const layerBits = (b1 >> 1) & 0x03;               // 01 = III, 10 = II, 11 = I
    const layer = layerBits === 1 ? 3 : layerBits === 2 ? 2 : layerBits === 3 ? 1 : 0;
    if (!layer) { i++; continue; }
    const brIndex = (b2 >> 4) & 0x0f;
    const srIndex = (b2 >> 2) & 0x03;
    const padding = (b2 >> 1) & 1;
    const mode = (b3 >> 6) & 0x03;
    if (versionBits === 1) { i++; continue; }         // reserved
    const family = versionBits === 3 ? BR.mpeg1 : BR.mpeg2;
    const table = family[layer];
    if (!table || brIndex === 0 || brIndex === 15 || srIndex === 3) { i++; continue; }

    const bitrate = table[brIndex] * 1000;
    const sampleRate = (versionBits === 3 ? [44100, 48000, 32000] : versionBits === 2 ? [22050, 24000, 16000] : [8000, 12000, 16000])[srIndex];
    const samps = layer === 1 ? (versionBits === 3 ? 384 : 576)
      : layer === 2 ? 1152
      : versionBits === 3 ? 1152 : 576;
    const slot = layer === 1 ? 4 : 1;
    const len = Math.floor((samps / 8) * (bitrate / sampleRate) + padding) * slot;
    if (len < 24 || i + len > buf.length) { i++; continue; }

    const nxt = i + len;
    const sync = nxt >= buf.length - 4 || (buf[nxt] === 0xff && (buf[nxt + 1] & 0xe0) === 0xe0);
    if (!sync) { i++; continue; }

    frames++;
    samples += samps;
    srSeen = sampleRate;
    bitrates.push(bitrate);
    chanModes.add(mode);
    i = nxt;
  }

  const sum = bitrates.reduce((a, b) => a + b, 0);
  return {
    file: String(file),
    bytes: buf.length,
    id3v2Bytes: firstFrameAt,
    frames,
    sampleRate: srSeen,
    channels: Math.max(1, chanModes.has(3) ? 1 : 2),
    duration: samples / srSeen,
    avgBitrateKbps: frames ? Math.round(sum / frames / 1000) : 0,
    cbr: frames ? new Set(bitrates).size === 1 : false,
  };
}

if (require.main === module) console.log(JSON.stringify(measure(process.argv[2]), null, 2));
module.exports = { measure };
