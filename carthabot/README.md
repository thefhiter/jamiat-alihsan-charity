# CarthaBot — النموذج ثلاثي الأبعاد | Interactive 3D Model

نموذج ثلاثي الأبعاد تفاعلي لروبوت الرسم **CarthaBot** (روبوت السلحفاة القرطاجي)، مبني وفق وثيقة
«CarthaBot Drive-System Upgrade — Technical Diagnostic» (خيار المحركات المشفّرة الموصى به).

An interactive, self-contained Three.js model of the **CarthaBot** turtle-pen drawing robot,
built to the recommended **Encoder-DC** configuration from the drive-system upgrade diagnostic.

## التشغيل | Run

يعمل مباشرة من أي خادم ملفات ثابت (لا يحتاج اتصالاً بالإنترنت — مكتبة Three.js مضمّنة في `lib/`):

```bash
npx http-server .          # from the repository root
# then open http://localhost:8080/carthabot/
```

## الميزات | Features

- **محاكاة الرسم**: الروبوت يرسم نجمة خماسية بمحاكاة قيادة تفاضلية حقيقية —
  دوران في المكان حول محور القلم عند الرؤوس، ورفع/خفض القلم بذراع السيرفو.
- **عرض مُفكَّك (Exploded view)** بمنزلق متدرّج لكل المكوّنات.
- **قائمة مكوّنات تفاعلية**: انقر على أي قطعة في القائمة أو في المشهد لإبرازها وقراءة دورها.
- **غطاء قابل للتبديل**: شفاف / مصمت / مخفي، ودوران تلقائي للكاميرا.

## المكوّنات الممثَّلة | Modelled parts (per the diagnostic doc)

| Part | Doc reference |
|---|---|
| 2× N20 gear motors **with quadrature encoders** | §5 primary recommendation, ~$12 each |
| RP2040 + DRV8833 main board (encoders read via PIO) | §7 steps 2–3, driver reused as-is |
| Boost converter VBat→6V (≥2A) | BOM 6a |
| Smoothing capacitors 1000µF + 2×100µF | BOM 6a |
| SG90 pen-lift servo (MG995 reusable here) | §3 conclusion, §7 step 4 |
| Single 18650 cell (existing power system) | §9 battery note |
| Centre turtle-pen on wheel axis + guide rails | §2 — pivots don't smear the line |
| Circular chassis, drive wheels, front/rear casters, shell | existing structure, reused |

## الملفات | Files

- `index.html` — الواجهة (عربية RTL)
- `model.js` — بناء النموذج إجرائياً بالمليمتر (`buildCarthaBot()`)
- `app.js` — المشهد، محاكاة القيادة التفاضلية، وربط الواجهة
- `lib/` — Three.js r160 + OrbitControls (مضمّنة محلياً)
- `models/` — ضع هنا ملفات CAD/STL/GLB الخاصة بالقطع الحقيقية لدمجها لاحقاً في العارض

## خارطة الطريق | Roadmap

- [ ] استيراد ملفات القطع الحقيقية (الـ 72 نموذجاً) إلى `models/` وتحميلها بـ GLTFLoader/STLLoader
- [ ] مسارات رسم إضافية (أشكال، كتابة، SVG → مسار)
- [ ] محاكاة PID مرئية (مقارنة حلقة مفتوحة/مغلقة كما في §2 من الوثيقة)
