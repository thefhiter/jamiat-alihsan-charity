/* =================================================================
   settings.js — الإعدادات والنسخ الاحتياطي
   ================================================================= */
(function (global) {
  "use strict";
  var App = global.App || (global.App = { views: {} });
  App.views = App.views || {};

  App.views.settings = function (container) {
    var s = DB.settings();

    function counts() {
      return {
        beneficiaries: DB.count("beneficiaries", true),
        donors: DB.count("donors", true),
        aid: DB.count("aid", true),
        donations: DB.count("donations", true),
        expenses: DB.count("expenses", true),
        incomes: DB.count("incomes", true)
      };
    }
    var c = counts();

    container.innerHTML =
      '<div class="cards grid-2">' +

        // معلومات الجمعية
        '<div class="card"><div class="card-head"><h3>🏛️ معلومات الجمعية</h3></div><div class="card-body">' +
          '<div class="form-grid">' +
            '<div class="field full"><label>اسم الجمعية</label><input data-f="orgName" value="' + U.esc(s.orgName) + '"></div>' +
            '<div class="field full"><label>الفرع / المقرّ</label><input data-f="orgBranch" value="' + U.esc(s.orgBranch || "") + '"></div>' +
            '<div class="field"><label>رمز العملة</label><input data-f="currency" value="' + U.esc(s.currency) + '"></div>' +
            '<div class="field"><label>السنة المرجعية</label><input type="number" data-f="year" value="' + U.esc(s.year || new Date().getFullYear()) + '"></div>' +
          "</div>" +
          '<button class="btn mt-20" id="saveSettings"><span class="ico">💾</span> حفظ المعلومات</button>' +
        "</div></div>" +

        // النسخ الاحتياطي
        '<div class="card"><div class="card-head"><h3>💾 النسخ الاحتياطي والاسترجاع</h3></div><div class="card-body">' +
          '<p class="muted" style="margin-top:0">البيانات محفوظة على هذا الجهاز فقط. خُذ نسخة احتياطية بانتظام واحفظها في مكان آمن (USB، بريد إلكتروني…).</p>' +
          '<div class="info-list" style="margin-bottom:16px">' +
            kv("العائلات المنتفعة", c.beneficiaries) + kv("المتبرّعون", c.donors) +
            kv("سجلّات المساعدات", c.aid) + kv("سجلّات التبرعات", c.donations) +
            kv("المصاريف", c.expenses) + kv("المداخيل", c.incomes) +
          "</div>" +
          '<button class="btn block" id="backupBtn"><span class="ico">⬇️</span> تنزيل نسخة احتياطية (JSON)</button>' +
          '<div style="height:10px"></div>' +
          '<label class="btn secondary block" style="cursor:pointer"><span class="ico">⬆️</span> استرجاع من ملف نسخة احتياطية' +
            '<input type="file" id="restoreInput" accept="application/json,.json" style="display:none"></label>' +
        "</div></div>" +

      "</div>" +

      // منطقة الخطر
      '<div class="card mt-20" style="border-color:#f3c9c4">' +
        '<div class="card-head" style="border-color:#f3c9c4"><h3 style="color:var(--danger)">⚠️ منطقة الخطر</h3></div>' +
        '<div class="card-body"><div class="row-between" style="flex-wrap:wrap;gap:12px">' +
          '<div><strong>حذف كل البيانات</strong><div class="muted" style="font-size:13px">يمسح جميع السجلّات نهائياً من هذا الجهاز. خُذ نسخة احتياطية أولاً.</div></div>' +
          '<button class="btn danger" id="wipeBtn"><span class="ico">🗑️</span> حذف كل البيانات</button>' +
        "</div></div></div>" +

      '<p class="muted" style="text-align:center;margin-top:26px;font-size:12.5px">نظام إدارة العائلات والمتبرعين — نسخة 1.0 · يعمل دون اتصال بالإنترنت</p>';

    function kv(k, v) { return '<div class="info-item"><div class="k">' + k + '</div><div class="v">' + U.fmtNum(v) + "</div></div>"; }

    document.getElementById("saveSettings").onclick = function () {
      var data = U.formData(container);
      DB.saveSettings({ orgName: data.orgName || s.orgName, orgBranch: data.orgBranch, currency: data.currency || "د.ت", year: data.year });
      U.toast("تم حفظ المعلومات");
      App.refreshChrome && App.refreshChrome();
    };

    document.getElementById("backupBtn").onclick = function () {
      var payload = DB.exportAll();
      U.download("نسخة-احتياطية-" + U.today() + ".json", JSON.stringify(payload, null, 2), "application/json");
      U.toast("تم تنزيل النسخة الاحتياطية");
    };

    document.getElementById("restoreInput").onchange = function (e) {
      var file = e.target.files[0]; if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var payload;
        try { payload = JSON.parse(reader.result); } catch (err) { U.toast("ملف غير صالح", "error"); return; }
        if (!payload.data) { U.toast("الملف لا يحتوي على بيانات صالحة", "error"); return; }
        U.openModal({
          title: "استرجاع البيانات",
          body: '<p>اختر طريقة الاسترجاع:</p>' +
            '<div style="display:flex;flex-direction:column;gap:10px">' +
              '<label class="radio-chip" style="display:block"><input type="radio" name="mode" value="replace" checked><span style="display:block;text-align:right">استبدال كامل — يحذف البيانات الحالية ويضع بيانات الملف</span></label>' +
              '<label class="radio-chip" style="display:block"><input type="radio" name="mode" value="merge"><span style="display:block;text-align:right">دمج — يضيف سجلّات الملف الجديدة دون حذف الحالية</span></label>' +
            "</div>",
          footer: '<button class="btn" id="doRestore"><span class="ico">⬆️</span> استرجاع</button><button class="btn secondary" id="cancelRestore">إلغاء</button>',
          onOpen: function (root) {
            root.querySelector("#cancelRestore").onclick = U.closeModal;
            root.querySelector("#doRestore").onclick = function () {
              var mode = root.querySelector('input[name="mode"]:checked').value;
              try {
                DB.importAll(payload, mode);
                U.closeModal(); U.toast("تم استرجاع البيانات بنجاح");
                App.refreshChrome && App.refreshChrome();
                App.navigate("settings");
              } catch (err) { U.toast("تعذّر الاسترجاع: " + err.message, "error"); }
            };
          }
        });
        e.target.value = "";
      };
      reader.readAsText(file);
    };

    document.getElementById("wipeBtn").onclick = function () {
      U.confirm({
        title: "حذف كل البيانات", danger: true,
        message: "سيتم حذف جميع العائلات والمتبرعين والسجلّات المالية نهائياً من هذا الجهاز. لا يمكن التراجع. هل أنت متأكّد؟",
        okText: "نعم، احذف كل شيء",
        onOk: function () {
          U.confirm({
            title: "تأكيد أخير", danger: true,
            message: "هل أخذت نسخة احتياطية؟ سيتم الآن مسح كل البيانات.",
            okText: "متابعة الحذف",
            onOk: function () { DB.clearAll(); U.toast("تم حذف جميع البيانات", "info"); App.refreshChrome && App.refreshChrome(); App.navigate("dashboard"); }
          });
        }
      });
    };
  };
})(window);
