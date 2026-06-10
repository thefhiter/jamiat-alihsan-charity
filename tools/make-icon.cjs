/* =================================================================
   make-icon.cjs — توليد أيقونات التطبيق من شعار الجمعية الحقيقي
   يستدعي tools/make-icon.py (Pillow) لإنتاج:
     assets/logo.png + assets/logo-mark.png
     build/icon.png + icon-192.png + icon-512.png + icon.ico
   المصدر: assets/logo-src.png (الشعار الأصلي).
   يتطلّب: Python 3 مع مكتبة Pillow  →  pip install pillow
   ================================================================= */
const { spawnSync } = require("child_process");
const path = require("path");

const script = path.join(__dirname, "make-icon.py");

function run(cmd) {
  return spawnSync(cmd, [script], { stdio: "inherit" });
}

let r = run("python");
if (r.error) r = run("python3");
if (r.error) r = run("py");

if (r.error) {
  console.error("⚠️ تعذّر تشغيل Python. توليد الأيقونات يحتاج: Python 3 + Pillow (pip install pillow).");
  console.error("   الأيقونات المولّدة مسبقاً موجودة في مجلّد build/ والشعار في assets/.");
  process.exit(1);
}
process.exit(r.status || 0);
