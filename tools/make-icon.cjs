/* =================================================================
   make-icon.cjs — توليد أيقونة التطبيق (build/icon.ico + icon.png)
   يرسم بلاطة خضراء بزوايا دائرية مع هلال ونجمة ذهبيين،
   ويشفّرها PNG يدوياً ثم يغلّفها داخل حاوية ICO — بدون أي مكتبات.
   ================================================================= */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const W = 256, H = 256;

/* ---- CRC32 ---- */
function crc32(buf) {
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    let c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/* ---- هندسة الرسم ---- */
function inRoundRect(x, y, w, h, r) {
  if (x >= r && x <= w - 1 - r) return true;
  if (y >= r && y <= h - 1 - r) return true;
  const cx = x < r ? r : w - 1 - r;
  const cy = y < r ? r : h - 1 - r;
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}
function dist2(x, y, cx, cy) { return (x - cx) ** 2 + (y - cy) ** 2; }

const GOLD = [224, 184, 74, 255];
function px(x, y) {
  if (!inRoundRect(x, y, W, H, 42)) return [0, 0, 0, 0];      // خارج البلاطة = شفّاف
  const t = y / H;                                            // تدرّج أخضر عمودي
  const r = Math.round(20 + (27 - 20) * t);
  const g = Math.round(81 + (107 - 81) * t);
  const b = Math.round(61 + (79 - 61) * t);
  let col = [r, g, b, 255];
  if (dist2(x, y, 95, 90, 0) <= 0) {}                         // (لا شيء)
  if (dist2(x, y, 95, 90) <= 12 * 12) col = GOLD;             // نجمة (قرص صغير)
  if (dist2(x, y, 148, 132) <= 80 * 80) {                     // الهلال: دائرة ذهبية
    col = GOLD;
    if (dist2(x, y, 172, 118) <= 66 * 66) col = [r, g, b, 255]; // نقش الهلال
  }
  return col;
}

/* ---- ترميز PNG ---- */
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function makePNG() {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 4));
  let p = 0;
  for (let y = 0; y < H; y++) {
    raw[p++] = 0;
    for (let x = 0; x < W; x++) {
      const c = px(x, y);
      raw[p++] = c[0]; raw[p++] = c[1]; raw[p++] = c[2]; raw[p++] = c[3];
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

/* ---- تغليف ICO (يحتوي PNG) ---- */
function makeICO(png) {
  const dir = Buffer.alloc(6);
  dir.writeUInt16LE(0, 0); dir.writeUInt16LE(1, 2); dir.writeUInt16LE(1, 4);
  const e = Buffer.alloc(16);
  e[0] = 0; e[1] = 0; e[2] = 0; e[3] = 0;       // 0×0 ⇒ 256×256
  e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
  e.writeUInt32LE(png.length, 8); e.writeUInt32LE(22, 12);
  return Buffer.concat([dir, e, png]);
}

const outDir = path.join(__dirname, "..", "build");
fs.mkdirSync(outDir, { recursive: true });
const png = makePNG();
fs.writeFileSync(path.join(outDir, "icon.png"), png);
fs.writeFileSync(path.join(outDir, "icon.ico"), makeICO(png));
console.log("✓ تم توليد build/icon.png (" + png.length + " بايت) و build/icon.ico");
