/* =================================================================
   make-icon.cjs — توليد أيقونات التطبيق دون أي مكتبات
   ينتج: build/icon.ico  +  icon.png(256) + icon-192.png + icon-512.png
   رسم: بلاطة خضراء بزوايا دائرية مع هلال ونجمة ذهبيين.
   ================================================================= */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const GOLD = [224, 184, 74, 255];

function crc32(buf) {
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    let c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function inRoundRect(x, y, w, h, r) {
  if (x >= r && x <= w - 1 - r) return true;
  if (y >= r && y <= h - 1 - r) return true;
  const cx = x < r ? r : w - 1 - r;
  const cy = y < r ? r : h - 1 - r;
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}
function d2(x, y, cx, cy) { return (x - cx) ** 2 + (y - cy) ** 2; }

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function renderPNG(S) {
  const W = S, H = S, k = S / 256;
  const R = 42 * k;
  const star = [95 * k, 90 * k, 12 * k];
  const cOut = [148 * k, 132 * k, 80 * k];
  const cIn = [172 * k, 118 * k, 66 * k];
  function px(x, y) {
    if (!inRoundRect(x, y, W, H, R)) return [0, 0, 0, 0];
    const t = y / H;
    const r = Math.round(20 + 7 * t), g = Math.round(81 + 26 * t), b = Math.round(61 + 18 * t);
    let col = [r, g, b, 255];
    if (d2(x, y, star[0], star[1]) <= star[2] * star[2]) col = GOLD;
    if (d2(x, y, cOut[0], cOut[1]) <= cOut[2] * cOut[2]) {
      col = GOLD;
      if (d2(x, y, cIn[0], cIn[1]) <= cIn[2] * cIn[2]) col = [r, g, b, 255];
    }
    return col;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(H * (1 + W * 4));
  let p = 0;
  for (let y = 0; y < H; y++) {
    raw[p++] = 0;
    for (let x = 0; x < W; x++) { const c = px(x, y); raw[p++] = c[0]; raw[p++] = c[1]; raw[p++] = c[2]; raw[p++] = c[3]; }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

function makeICO(png) {
  const dir = Buffer.alloc(6);
  dir.writeUInt16LE(1, 2); dir.writeUInt16LE(1, 4);
  const e = Buffer.alloc(16);
  e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
  e.writeUInt32LE(png.length, 8); e.writeUInt32LE(22, 12);
  return Buffer.concat([dir, e, png]);
}

const outDir = path.join(__dirname, "..", "build");
fs.mkdirSync(outDir, { recursive: true });
const png256 = renderPNG(256);
fs.writeFileSync(path.join(outDir, "icon.png"), png256);
fs.writeFileSync(path.join(outDir, "icon-192.png"), renderPNG(192));
fs.writeFileSync(path.join(outDir, "icon-512.png"), renderPNG(512));
fs.writeFileSync(path.join(outDir, "icon.ico"), makeICO(png256));
console.log("✓ تم توليد icon.ico + icon.png + icon-192.png + icon-512.png في build/");
