/* =================================================================
   build-single.cjs — تجميع التطبيق كلّه في ملف واحد: app.html
   يضمّن CSS وكل ملفّات JS داخل index.html ويزيل أجزاء PWA/SW،
   لينتج ملفاً واحداً يعمل بنقرة مزدوجة على الحاسوب أو الهاتف.
   ================================================================= */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let html = read("index.html");

// 1) إزالة الكتل الخاصّة بـ PWA و Service Worker (غير لازمة في الملف الواحد)
html = html.replace(/<!-- PWA:start -->[\s\S]*?<!-- PWA:end -->\s*/g, "");
html = html.replace(/<!-- SW:start -->[\s\S]*?<!-- SW:end -->\s*/g, "");

// 2) تضمين ملفّ التنسيق
const css = read("css/styles.css");
html = html.replace(
  /<link rel="stylesheet" href="css\/styles\.css">/,
  "<style>\n" + css + "\n</style>"
);

// 3) تضمين كل ملفّات JavaScript مكان وسوم <script src=...>
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, function (_, src) {
  let code = read(src);
  code = code.replace(/<\/script>/gi, "<\\/script>"); // أمان ضد إغلاق الوسم
  return "<script>\n" + code + "\n</script>";
});

// 4) ملاحظة في الترويسة
html = html.replace(
  /<title>([\s\S]*?)<\/title>/,
  "<title>$1</title>\n  <!-- نسخة الملف الواحد — مُولّدة آلياً عبر tools/build-single.cjs -->"
);

if (/<script src=|href="css\//.test(html)) {
  console.error("⚠️ تحذير: بقيت مراجع خارجية لم تُضمَّن — تحقّق من الأسماء.");
  process.exit(1);
}

const out = path.join(ROOT, "app.html");
fs.writeFileSync(out, html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log("✓ تم إنشاء app.html (" + kb + " كيلوبايت) — ملف واحد مكتفٍ بذاته");
