/* =================================================================
   sw.js — Service Worker لتشغيل التطبيق دون إنترنت وكتطبيق مثبَّت
   يخزّن ملفّات التطبيق محلياً (Cache First) ليعمل بالكامل بلا اتصال.
   ================================================================= */
var CACHE = "ihsan-v1";
var ASSETS = [
  "./", "index.html", "manifest.webmanifest",
  "css/styles.css",
  "js/db.js", "js/utils.js", "js/beneficiaries.js", "js/donors.js",
  "js/finance.js", "js/dashboard.js", "js/settings.js", "js/search.js", "js/app.js",
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
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      return cached || fetch(e.request).then(function (resp) {
        var copy = resp.clone();
        caches.open(CACHE).then(function (c) { try { c.put(e.request, copy); } catch (x) {} });
        return resp;
      }).catch(function () { return caches.match("index.html"); });
    })
  );
});
