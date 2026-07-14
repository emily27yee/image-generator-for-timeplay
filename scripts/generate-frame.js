const fs = require('fs');
const zlib = require('zlib');

const W = 800;
const H = 600;
const BORDER = 40;
const INNER = BORDER + 8;

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    }
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const combined = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(combined));
  return Buffer.concat([len, combined, crc]);
}

function pixel(x, y) {
  const onOuter =
    x < BORDER || y < BORDER || x >= W - BORDER || y >= H - BORDER;
  const onInnerLine =
    x >= INNER && x <= W - INNER - 1 && (y === INNER || y === H - INNER - 1) ||
    y >= INNER && y <= H - INNER - 1 && (x === INNER || x === W - INNER - 1);

  if (onInnerLine) return [220, 180, 80, 255];
  if (onOuter) return [180, 140, 50, 255];
  return [0, 0, 0, 0];
}

const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
  const rowStart = y * (W * 4 + 1);
  raw[rowStart] = 0;
  for (let x = 0; x < W; x++) {
    const [r, g, b, a] = pixel(x, y);
    const i = rowStart + 1 + x * 4;
    raw[i] = r;
    raw[i + 1] = g;
    raw[i + 2] = b;
    raw[i + 3] = a;
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

fs.writeFileSync('assets/frame.png', png);
console.log('Created assets/frame.png');
