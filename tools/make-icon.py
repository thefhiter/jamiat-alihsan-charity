#!/usr/bin/env python3
# =================================================================
# make-icon.py — توليد شعار وأيقونات التطبيق من شعار الجمعية الحقيقي
# المصدر: assets/logo-src.png (شعار جمعية الإحسان الخيرية)
# يُنتج:
#   assets/logo.png        الشعار الكامل (مقصوص الهوامش) — للـ README والترويسة
#   assets/logo-mark.png   الرمز فقط (نبتة + قطرة + يدان) داخل مربّع أبيض — للأيقونة
#   build/icon.png (256) + icon-192.png + icon-512.png + icon.ico (متعدّد المقاسات)
# يحتاج: Python 3 + Pillow  (pip install pillow)
# =================================================================
import os
from PIL import Image, ImageChops

try:
    import numpy as np
    HAVE_NP = True
except Exception:
    HAVE_NP = False

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
BUILD = os.path.join(ROOT, "build")
os.makedirs(ASSETS, exist_ok=True)
os.makedirs(BUILD, exist_ok=True)

SRC = os.path.join(ASSETS, "logo-src.png")
src = Image.open(SRC).convert("RGBA")
W, H = src.size


def trim_white(im, thresh=14):
    """قصّ الهامش الأبيض المحيط بالمحتوى."""
    rgb = im.convert("RGB")
    bg = Image.new("RGB", rgb.size, (255, 255, 255))
    diff = ImageChops.difference(rgb, bg).convert("L")
    diff = diff.point(lambda p: 255 if p > thresh else 0)
    bbox = diff.getbbox()
    return im.crop(bbox) if bbox else im


def row_content():
    """عدد البكسلات غير البيضاء في كل سطر (لإيجاد الفاصل بين الرمز والنصّ)."""
    rgb = src.convert("RGB")
    if HAVE_NP:
        arr = np.asarray(rgb).astype(int)
        nonwhite = (255 - arr).max(axis=2)
        return (nonwhite > 24).sum(axis=1).tolist()
    px = rgb.load()
    rows = []
    for y in range(H):
        c = 0
        for x in range(0, W, 2):  # عيّنة كل بكسلين للسرعة
            r, g, b = px[x, y]
            if 255 - min(r, g, b) > 24:
                c += 1
        rows.append(c * 2)
    return rows


def emblem_only():
    """اقتطاع الرمز (أعلى الشعار) دون نصّ «جمعية الإحسان الخيرية / AL IHSAN CHARITY»."""
    rows = row_content()
    lo, hi = int(H * 0.52), int(H * 0.88)
    empty = max(2, int(W * 0.004))
    minlen = max(6, int(H * 0.012))
    cut = int(H * 0.72)
    i = lo
    while i < hi:                       # نأخذ أوّل فجوة بيضاء معتبرة أسفل الرمز (بين اليدين والنصّ)
        if rows[i] <= empty:
            j = i
            while j < hi and rows[j] <= empty:
                j += 1
            if (j - i) >= minlen:
                cut = (i + j) // 2
                break
            i = j
        else:
            i += 1
    return trim_white(src.crop((0, 0, W, cut)))


def square_on_white(im, size, pad_ratio=0.10):
    """احتواء الصورة وسط مربّع أبيض مع هامش أمان (مناسب لأيقونات PWA القابلة للقصّ)."""
    inner = int(size * (1 - 2 * pad_ratio))
    w, h = im.size
    scale = min(inner / w, inner / h)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    fitted = im.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    canvas.alpha_composite(fitted, ((size - nw) // 2, (size - nh) // 2))
    return canvas


# 1) الشعار الكامل (مقصوص) — للوثائق والترويسة
trim_white(src).save(os.path.join(ASSETS, "logo.png"), optimize=True)

# 2) الرمز وحده داخل مربّع أبيض — للأيقونة الصغيرة والـ favicon
emblem = emblem_only()
square_on_white(emblem, 384, 0.09).save(os.path.join(ASSETS, "logo-mark.png"), optimize=True)

# 3) أيقونات التطبيق (PWA + سطح المكتب + ويندوز)
for size, name in [(256, "icon.png"), (192, "icon-192.png"), (512, "icon-512.png")]:
    square_on_white(emblem, size, 0.10).convert("RGB").save(os.path.join(BUILD, name), optimize=True)

square_on_white(emblem, 256, 0.10).save(
    os.path.join(BUILD, "icon.ico"),
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)

print("[ok] generated assets/logo.png + assets/logo-mark.png + build/icon.png|192|512|ico from the real logo")
