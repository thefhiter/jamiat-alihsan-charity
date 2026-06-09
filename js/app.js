/* =================================================================
   app.js — التحكّم العام والتنقّل بين الأقسام
   ================================================================= */
(function (global) {
  "use strict";
  var App = global.App || (global.App = { views: {} });

  var NAV = [
    { id: "dashboard",     icon: "🏠", label: "الرئيسية",  title: "الرئيسية",         sub: "نظرة عامة وإحصائيات" },
    { id: "beneficiaries", icon: "👨‍👩‍👧‍👦", label: "المنتفعون", title: "المنتفعون",        sub: "العائلات والحالات الاجتماعية", badge: function () { return DB.count("beneficiaries"); } },
    { id: "donors",        icon: "🤝", label: "المتبرّعون", title: "المتبرّعون",       sub: "المحسنون وتبرّعاتهم", badge: function () { return DB.count("donors"); } },
    { id: "finance",       icon: "💰", label: "الشأن المالي", title: "الشأن المالي",    sub: "المساعدات والتبرعات والمصاريف والمداخيل" },
    { id: "settings",      icon: "⚙️", label: "الإعدادات", title: "الإعدادات",        sub: "معلومات الجمعية والنسخ الاحتياطي" }
  ];

  var current = "dashboard";

  App.navigate = function (view, params) {
    if (!App.views[view]) view = "dashboard";
    current = view;
    try { location.hash = view; } catch (e) {}
    renderNav();
    var meta = NAV.filter(function (n) { return n.id === view; })[0] || NAV[0];
    document.getElementById("pageTitle").textContent = meta.title;
    document.getElementById("pageSub").textContent = meta.sub;
    var content = document.getElementById("content");
    content.innerHTML = "";
    // إغلاق القائمة الجانبية على الجوّال
    document.getElementById("sidebar").classList.remove("show");
    try {
      App.views[view](content, params);
    } catch (e) {
      console.error(e);
      content.innerHTML = '<div class="empty"><div class="e-ico">⚠️</div><h4>حدث خطأ في عرض هذا القسم</h4><p class="muted">' + U.esc(e.message) + "</p></div>";
    }
    content.scrollTop = 0;
    document.querySelector(".main").scrollTop = 0;
  };

  function renderNav() {
    var nav = document.getElementById("nav");
    nav.innerHTML = NAV.map(function (n) {
      var badge = "";
      if (n.badge) { var v = n.badge(); if (v) badge = '<span class="badge">' + U.fmtNum(v) + "</span>"; }
      return '<button class="' + (current === n.id ? "active" : "") + '" data-nav="' + n.id + '">' +
        '<span class="ico">' + n.icon + "</span><span>" + n.label + "</span>" + badge + "</button>";
    }).join("");
    nav.querySelectorAll("[data-nav]").forEach(function (el) {
      el.onclick = function () { App.navigate(el.getAttribute("data-nav")); };
    });
  }

  // إعادة رسم الترويسة والشارات بعد تغيّر الإعدادات أو البيانات
  App.refreshChrome = function () {
    var s = DB.settings();
    document.getElementById("brandName").textContent = s.orgName;
    document.getElementById("brandBranch").textContent = s.orgBranch || "";
    renderNav();
  };

  function init() {
    App.refreshChrome();
    var start = (location.hash || "").replace("#", "");
    App.navigate(App.views[start] ? start : "dashboard");

    document.getElementById("menuToggle").onclick = function () {
      document.getElementById("sidebar").classList.toggle("show");
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(window);
