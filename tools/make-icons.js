// Generates the app icons (PNG) for Big Top Bonzo from the clown's pixel art.
// Usage: node tools/make-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PAL = {
  K: [0, 0, 0], W: [252, 252, 252], S: [252, 184, 152], R: [216, 40, 0], G: [0, 168, 68],
  Y: [248, 184, 0], O: [228, 92, 16], B: [0, 88, 248]
};
// Bonzo's head and collar (same rows as the in-game sprite)
const ART = [
  '.....YY.....', '.....GG.....', '....GGGG....', '...GGGGGG...', '.OOSSSSSSOO.',
  'OOOSKSSKSOOO', '.OOSSRRSSOO.', '...SSSSSS...', '....SRRS....', '...WWWWWW...',
  '..BBYBBYBB..'
];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, px) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = px(x, y), o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
// size: output px; art: fraction of the icon the clown's width fills (smaller for maskable)
function icon(size, art) {
  const cell = Math.max(1, Math.floor(size * art / 12));
  const aw = cell * 12, ah = cell * ART.length;
  const ox = Math.floor((size - aw) / 2), oy = Math.floor((size - ah) / 2) + Math.floor(cell * 0.6);
  const stripe = size / 8, rad = size * (art * 0.62 + 0.06);
  return png(size, (x, y) => {
    const ax = Math.floor((x - ox) / cell), ay = Math.floor((y - oy) / cell);
    if (ax >= 0 && ax < 12 && ay >= 0 && ay < ART.length) {
      const ch = ART[ay][ax];
      if (ch && ch !== '.') return PAL[ch];
    }
    const dx = x - size / 2, dy = y - size / 2, d = Math.hypot(dx, dy);
    if (d < rad) return [0, 0, 0];
    if (d < rad + size * 0.02) return PAL.Y;
    return Math.floor(x / stripe) % 2 ? PAL.W : PAL.R; // big-top tent stripes
  });
}
const out = path.join(__dirname, '..', 'icons');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon-192.png'), icon(192, 0.6));
fs.writeFileSync(path.join(out, 'icon-512.png'), icon(512, 0.6));
fs.writeFileSync(path.join(out, 'icon-maskable-512.png'), icon(512, 0.45));
fs.writeFileSync(path.join(out, 'apple-touch-icon.png'), icon(180, 0.55));
console.log('icons written to', out);
