/* =================================================================
   sw.js — Service Worker لتشغيل التطبيق دون إنترنت وكتطبيق مثبَّت
   الاستراتيجية: «الشبكة أوّلاً» (Network First) ليُفتح دائماً أحدث
   إصدار عند توفّر الإنترنت، مع الرجوع إلى النسخة المخزّنة عند انقطاعه.
   ================================================================= */
var CACHE = "ihsan-v3";
var ASSETS = [
  "./", "index.html", "manifest.webmanifest",
  "css/styles.css",
  "js/db.js", "js/utils.js", "js/beneficiaries.js", "js/members.js",
  "js/donors.js", "js/finance.js", "js/dashboard.js",
  "js/settings.js", "js/search.js", "js/app.js",
  "build/icon-192.png", "build/icon-512.png"
];

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS).catch(function () {}); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  // الشبكة أوّلاً: نجلب أحدث نسخة ونحدّث التخزين، ونرجع للتخزين عند انقطاع الإنترنت.
  e.respondWith(
    fetch(e.request).then(function (resp) {
      var copy = resp.clone();
      caches.open(CACHE).then(function (c) { try { c.put(e.request, copy); } catch (x) {} });
      return resp;
    }).catch(function () {
      return caches.match(e.request).then(function (cached) {
        return cached || caches.match("index.html");
      });
    })
  );
});
