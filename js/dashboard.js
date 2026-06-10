/* =================================================================
   dashboard.js — الرئيسية والإحصائيات
   ================================================================= */
(function (global) {
  "use strict";
  var App = global.App || (global.App = { views: {} });
  App.views = App.views || {};

  App.views.dashboard = function (container) {
    var s = DB.settings();
    var benAll = DB.all("beneficiaries"), ben = benAll.filter(function (b) { return !b.archived; });
    var memAll = DB.all("members"), mem = memAll.filter(function (m) { return !m.archived; });
    var donAll = DB.all("donors"), don = donAll.filter(function (d) { return !d.archived; });

    var totalDonations = DB.sum("donations", "amount");
    var totalIncome = DB.sum("incomes", "amount");
    var totalAid = DB.sum("aid", "amount");
    var totalExpense = DB.sum("expenses", "amount");
    var inflow = totalDonations + totalIncome;
    var outflow = totalAid + totalExpense;
    var balance = inflow - outflow;
    var familiesServed = (function () { var ids = {}; DB.all("aid").forEach(function (a) { ids[a.beneficiaryId] = 1; }); return Object.keys(ids).length; })();

    function stat(cls, ico, label, value, unit) {
      return '<div class="stat ' + cls + '"><div class="ico-bg">' + ico + '</div>' +
        '<div class="meta"><div class="label">' + label + '</div>' +
        '<div class="value">' + value + (unit ? ' <span class="unit">' + unit + "</span>" : "") + "</div></div></div>";
    }

    /* تصنيف حسب نوع العائلة */
    function breakdown(list, field, fallback) {
      var map = {};
      list.forEach(function (x) { var k = x[field] || fallback; map[k] = (map[k] || 0) + 1; });
      var arr = Object.keys(map).map(function (k) { return { k: k, v: map[k] }; }).sort(function (a, b) { return b.v - a.v; });
      var max = arr.reduce(function (m, x) { return Math.max(m, x.v); }, 0) || 1;
      if (!arr.length) return '<div class="muted" style="padding:10px">لا توجد بيانات بعد</div>';
      return '<div class="bars">' + arr.map(function (x) {
        return '<div class="bar-row"><div>' + U.esc(x.k) + '</div><div class="bar-track"><div class="bar-fill" style="width:' + Math.round(x.v / max * 100) + '%"></div></div><div class="bv">' + U.fmtNum(x.v) + "</div></div>";
      }).join("") + "</div>";
    }

    /* آخر النشاطات */
    var recentAid = DB.all("aid").sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); }).slice(0, 6);
    var recentDon = DB.all("donations").sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); }).slice(0, 6);
    function bName(id) { var b = DB.get("beneficiaries", id); return b ? App.beneficiaryFullName(b) : "—"; }
    function dName(id) { var d = DB.get("donors", id); return d ? App.donorFullName(d) : "—"; }

    function activityRows(list, nameFn, dir) {
      if (!list.length) return '<tr><td colspan="3" class="muted" style="text-align:center;padding:18px">لا يوجد نشاط بعد</td></tr>';
      return list.map(function (x) {
        return "<tr><td>" + U.fmtDate(x.date) + "</td><td>" + U.esc(nameFn(x[dir === "in" ? "donorId" : "beneficiaryId"])) +
          (x.type ? ' <span class="tag gray">' + U.esc(x.type) + "</span>" : "") + '</td><td class="money ' + dir + '">' + U.fmtMoney(x.amount) + "</td></tr>";
      }).join("");
    }

    container.innerHTML =
      '<div class="cards grid-4 mb-16">' +
        stat("green", "👨‍👩‍👧‍👦", "العائلات", U.fmtNum(ben.length), "عائلة") +
        stat("gold", "👤", "المنتفعون (الأفراد)", U.fmtNum(mem.length), "فرد") +
        stat("blue", "🤝", "المتبرّعون", U.fmtNum(don.length), "متبرّع") +
        stat(balance >= 0 ? "green" : "red", "⚖️", "الرصيد الصافي", U.fmtMoney(balance)) +
      "</div>" +

      '<div class="cards grid-4 mb-16">' +
        stat("blue", "📈", "إجمالي التبرعات والمداخيل", U.fmtMoney(inflow)) +
        stat("red", "🎁", "إجمالي المساعدات الممنوحة", U.fmtMoney(totalAid)) +
        stat("blue", "🧾", "عدد عمليات المساعدة", U.fmtNum(DB.count("aid", true)), "عملية") +
        stat("gold", "❤️", "عائلات استفادت فعلياً", U.fmtNum(familiesServed), "عائلة") +
      "</div>" +

      '<div class="cards grid-2 mb-16">' +
        '<div class="card"><div class="card-head"><h3>🏷️ توزيع العائلات حسب النوع</h3></div><div class="card-body">' + breakdown(ben, "familyType", "غير محدّد") + "</div></div>" +
        '<div class="card"><div class="card-head"><h3>🩺 التغطية الاجتماعية</h3></div><div class="card-body">' + breakdown(ben, "coverage", "غير محدّدة") + "</div></div>" +
      "</div>" +

      '<div class="cards grid-2">' +
        '<div class="card"><div class="card-head"><h3>🎁 آخر المساعدات</h3><div class="spacer"></div><button class="btn sm secondary" data-go="finance">عرض الكل</button></div>' +
          '<div class="table-wrap" style="border:none;box-shadow:none;border-radius:0"><table><thead><tr><th>التاريخ</th><th>المنتفع</th><th>المقدار</th></tr></thead><tbody>' + activityRows(recentAid, bName, "out") + "</tbody></table></div></div>" +
        '<div class="card"><div class="card-head"><h3>🤝 آخر التبرعات</h3><div class="spacer"></div><button class="btn sm secondary" data-go="donors">عرض الكل</button></div>' +
          '<div class="table-wrap" style="border:none;box-shadow:none;border-radius:0"><table><thead><tr><th>التاريخ</th><th>المتبرّع</th><th>المقدار</th></tr></thead><tbody>' + activityRows(recentDon, dName, "in") + "</tbody></table></div></div>" +
      "</div>";

    container.querySelectorAll("[data-go]").forEach(function (el) {
      el.onclick = function () { App.navigate(el.getAttribute("data-go")); };
    });

    // ترحيب عند فراغ البيانات
    if (DB.isEmpty()) {
      var hint = document.createElement("div");
      hint.className = "card mt-20";
      hint.innerHTML = '<div class="card-body" style="text-align:center;padding:30px">' +
        '<div style="font-size:42px">🌱</div><h3 style="margin:8px 0;color:var(--green-900)">مرحباً بكم في نظام إدارة ' + U.esc(s.orgName) + "</h3>" +
        '<p class="muted" style="max-width:520px;margin:0 auto 16px">ابدأ بإضافة العائلات المنتفعة والمتبرعين. كل البيانات تُحفظ على هذا الجهاز، وننصح بأخذ نسخة احتياطية دورية من قسم «الإعدادات».</p>' +
        '<button class="btn" id="seedBtn"><span class="ico">＋</span> إضافة أوّل عائلة</button></div>';
      container.appendChild(hint);
      document.getElementById("seedBtn").onclick = function () { App.navigate("beneficiaries"); setTimeout(function () { var a = document.getElementById("bAdd"); a && a.click(); }, 60); };
    }
  };
})(window);
