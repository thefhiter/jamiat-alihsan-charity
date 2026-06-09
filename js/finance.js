/* =================================================================
   finance.js — المساعدات، التبرعات، المصاريف، المداخيل (الشأن المالي)
   ================================================================= */
(function (global) {
  "use strict";
  var App = global.App || (global.App = { views: {} });
  App.views = App.views || {};

  var AID_KINDS = ["مالي", "عيني (مواد غذائية)", "ملابس", "أدوية", "أضحية", "كسوة العيد", "قفّة رمضان", "كراس ومستلزمات مدرسية", "أخرى"];
  var EXP_CAT = ["مساعدات مباشرة", "كراء", "فواتير (ماء/كهرباء)", "نقل", "مصاريف إدارية", "صيانة", "أخرى"];
  var INC_SRC = ["تبرعات نقدية", "اشتراكات الأعضاء", "هبات", "دعم رسمي", "أنشطة وحملات", "أخرى"];

  function bName(id) { var b = DB.get("beneficiaries", id); return b ? App.beneficiaryFullName(b) : "—"; }
  function dName(id) { var d = DB.get("donors", id); return d ? App.donorFullName(d) : "—"; }

  /* ============ نموذج المساعدة (مشترك مع ملف المنتفع) ============ */
  App.aidForm = function (beneficiaryId, after, aidId) {
    var a = aidId ? DB.get("aid", aidId) : {};
    var isNew = !aidId;
    var needPick = !beneficiaryId;
    var benList = DB.all("beneficiaries").filter(function (b) { return !b.archived; });
    var pick = needPick ? '<div class="field full"><label>المنتفع <span class="req">*</span></label><select data-f="beneficiaryId"><option value="">— اختر العائلة —</option>' +
      benList.map(function (b) { return '<option value="' + b.id + '">' + U.esc(App.beneficiaryFullName(b)) + " — " + U.esc(b.fileNo || "") + "</option>"; }).join("") + "</select></div>" : "";
    var kinds = AID_KINDS.map(function (k) { return '<option' + (a.type === k ? " selected" : "") + ">" + U.esc(k) + "</option>"; }).join("");

    U.openModal({
      title: isNew ? "إضافة مساعدة" : "تعديل المساعدة",
      body: '<div class="form-grid">' + pick +
        '<div class="field"><label>التاريخ</label><input type="date" data-f="date" value="' + U.esc(a.date || U.today()) + '"></div>' +
        '<div class="field"><label>المقدار</label><input type="number" step="0.001" min="0" data-f="amount" value="' + U.esc(a.amount || "") + '"></div>' +
        '<div class="field"><label>نوعية الإعانة</label><select data-f="type"><option value="">— اختر —</option>' + kinds + "</select></div>" +
        '<div class="field"><label>المناسبة</label><input data-f="occasion" value="' + U.esc(a.occasion || "") + '" placeholder="رمضان، العيد، الدخول المدرسي…"></div>' +
        '<div class="field full"><label>ملاحظة</label><input data-f="note" value="' + U.esc(a.note || "") + '"></div>' +
      "</div>",
      footer: '<button class="btn" id="aSave"><span class="ico">💾</span> حفظ</button><button class="btn secondary" id="aCancel">إلغاء</button>',
      onOpen: function (root) {
        root.querySelector("#aCancel").onclick = U.closeModal;
        root.querySelector("#aSave").onclick = function () {
          var data = U.formData(root);
          var bid = beneficiaryId || data.beneficiaryId;
          if (!bid) { U.toast("يُرجى اختيار المنتفع", "error"); return; }
          if (!data.amount && !data.type) { U.toast("أدخل المقدار أو نوعية الإعانة", "error"); return; }
          data.beneficiaryId = bid;
          if (isNew) { DB.insert("aid", data); U.toast("تمت إضافة المساعدة"); }
          else { DB.update("aid", aidId, data); U.toast("تم التحديث"); }
          U.closeModal(); after && after();
        };
      }
    });
  };

  /* ============ نموذج عام (مصروف / مدخول) ============ */
  function txForm(coll, opts, after, txId) {
    var x = txId ? DB.get(coll, txId) : {};
    var isNew = !txId;
    var catOpts = opts.cats.map(function (c) { return '<option' + (x[opts.catKey] === c ? " selected" : "") + ">" + U.esc(c) + "</option>"; }).join("");
    U.openModal({
      title: (isNew ? "إضافة " : "تعديل ") + opts.title,
      body: '<div class="form-grid">' +
        '<div class="field"><label>التاريخ</label><input type="date" data-f="date" value="' + U.esc(x.date || U.today()) + '"></div>' +
        '<div class="field"><label>المقدار <span class="req">*</span></label><input type="number" step="0.001" min="0" data-f="amount" value="' + U.esc(x.amount || "") + '"></div>' +
        '<div class="field full"><label>' + opts.labelText + '</label><input data-f="label" value="' + U.esc(x.label || "") + '"></div>' +
        '<div class="field full"><label>' + opts.catLabel + '</label><select data-f="' + opts.catKey + '"><option value="">— اختر —</option>' + catOpts + "</select></div>" +
      "</div>",
      footer: '<button class="btn" id="txSave"><span class="ico">💾</span> حفظ</button><button class="btn secondary" id="txCancel">إلغاء</button>',
      onOpen: function (root) {
        root.querySelector("#txCancel").onclick = U.closeModal;
        root.querySelector("#txSave").onclick = function () {
          var data = U.formData(root);
          if (!data.amount) { U.toast("المقدار إجباري", "error"); return; }
          if (isNew) { DB.insert(coll, data); U.toast("تمت الإضافة"); }
          else { DB.update(coll, txId, data); U.toast("تم التحديث"); }
          U.closeModal(); after && after();
        };
      }
    });
  }
  App.expenseForm = function (after, id) {
    txForm("expenses", { title: "مصروف", labelText: "البيان / الوصف", catLabel: "الفئة", catKey: "category", cats: EXP_CAT }, after, id);
  };
  App.incomeForm = function (after, id) {
    txForm("incomes", { title: "مدخول", labelText: "البيان / الوصف", catLabel: "المصدر", catKey: "source", cats: INC_SRC }, after, id);
  };

  /* ============ العرض المالي (تبويبات) ============ */
  App.views.finance = function (container, params) {
    var tab = (params && params.tab) || "aid";

    function totalsBar() {
      var inflow = DB.sum("donations", "amount") + DB.sum("incomes", "amount");
      var outflow = DB.sum("aid", "amount") + DB.sum("expenses", "amount");
      var bal = inflow - outflow;
      return '<div class="cards grid-3 mb-16">' +
        stat("green", "📈", "إجمالي المداخيل (تبرعات + مداخيل)", U.fmtMoney(inflow)) +
        stat("red", "📉", "إجمالي المصاريف (مساعدات + مصاريف)", U.fmtMoney(outflow)) +
        stat(bal >= 0 ? "gold" : "red", "⚖️", "الرصيد الصافي", U.fmtMoney(bal)) +
        "</div>";
    }
    function stat(cls, ico, label, val) {
      return '<div class="stat ' + cls + '"><div class="ico-bg">' + ico + '</div><div class="meta"><div class="label">' + label + '</div><div class="value" style="font-size:22px">' + val + "</div></div></div>";
    }

    function paint() {
      var tabs = [
        { k: "aid", t: "🎁 المساعدات الممنوحة" },
        { k: "donations", t: "🤝 التبرعات الواردة" },
        { k: "expenses", t: "📉 المصاريف" },
        { k: "incomes", t: "📈 المداخيل" }
      ];
      container.innerHTML = totalsBar() +
        '<div class="sub-tabs no-print">' + tabs.map(function (x) {
          return '<button class="' + (tab === x.k ? "active" : "") + '" data-tab="' + x.k + '">' + x.t + "</button>";
        }).join("") + "</div><div id='finBody'></div>";

      container.querySelectorAll("[data-tab]").forEach(function (el) {
        el.onclick = function () { tab = el.getAttribute("data-tab"); paint(); };
      });

      var body = container.querySelector("#finBody");
      if (tab === "aid") renderAid(body);
      else if (tab === "donations") renderDonations(body);
      else if (tab === "expenses") renderTx(body, "expenses", "مصروف", "category", "الفئة", "out", App.expenseForm);
      else renderTx(body, "incomes", "مدخول", "source", "المصدر", "in", App.incomeForm);
    }

    function renderAid(body) {
      var list = DB.all("aid").sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
      var total = list.reduce(function (s, a) { return s + (parseFloat(a.amount) || 0); }, 0);
      var rows = list.length ? list.map(function (a) {
        return "<tr><td>" + U.fmtDate(a.date) + '</td><td><a href="#" data-b="' + a.beneficiaryId + '" style="font-weight:700">' + U.esc(bName(a.beneficiaryId)) + "</a></td>" +
          "<td>" + U.esc(a.type || "—") + "</td><td>" + U.esc(a.occasion || "—") + '</td><td class="money out">' + U.fmtMoney(a.amount) + "</td>" +
          '<td><div class="t-actions"><button class="icon-btn" data-e="' + a.id + '">✏️</button><button class="icon-btn danger" data-x="' + a.id + '">🗑️</button></div></td></tr>';
      }).join("") : empty("🎁", "لا توجد مساعدات مسجّلة");
      body.innerHTML = bar("إضافة مساعدة", "addBtn", "gold") +
        wrapTable(["التاريخ", "المنتفع", "نوعية الإعانة", "المناسبة", "المقدار", "إجراءات"], rows, "المجموع", U.fmtMoney(total), "out", list.length);
      body.querySelector("#addBtn").onclick = function () { App.aidForm(null, paint); };
      body.querySelectorAll("[data-b]").forEach(function (el) { el.onclick = function (e) { e.preventDefault(); App.navigate("beneficiaries", { id: el.getAttribute("data-b") }); }; });
      body.querySelectorAll("[data-e]").forEach(function (el) { el.onclick = function () { App.aidForm(null, paint, el.getAttribute("data-e")); }; });
      body.querySelectorAll("[data-x]").forEach(function (el) { el.onclick = function () { delConfirm("aid", el.getAttribute("data-x"), paint); }; });
    }

    function renderDonations(body) {
      var list = DB.all("donations").sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
      var total = list.reduce(function (s, a) { return s + (parseFloat(a.amount) || 0); }, 0);
      var rows = list.length ? list.map(function (a) {
        return "<tr><td>" + U.fmtDate(a.date) + '</td><td><a href="#" data-d="' + a.donorId + '" style="font-weight:700">' + U.esc(dName(a.donorId)) + "</a></td>" +
          "<td>" + U.esc(a.type || "—") + "</td><td>" + U.esc(a.occasion || "—") + '</td><td class="money in">' + U.fmtMoney(a.amount) + "</td>" +
          '<td><div class="t-actions"><button class="icon-btn" data-e="' + a.id + '">✏️</button><button class="icon-btn danger" data-x="' + a.id + '">🗑️</button></div></td></tr>';
      }).join("") : empty("🤝", "لا توجد تبرّعات مسجّلة");
      body.innerHTML = bar("تسجيل تبرّع", "addBtn", "gold") +
        wrapTable(["التاريخ", "المتبرّع", "نوعية الإعانة", "المناسبة", "المقدار", "إجراءات"], rows, "المجموع", U.fmtMoney(total), "in", list.length);
      body.querySelector("#addBtn").onclick = function () { App.donationForm(null, paint); };
      body.querySelectorAll("[data-d]").forEach(function (el) { el.onclick = function (e) { e.preventDefault(); App.navigate("donors", { id: el.getAttribute("data-d") }); }; });
      body.querySelectorAll("[data-e]").forEach(function (el) { el.onclick = function () { App.donationForm(null, paint, el.getAttribute("data-e")); }; });
      body.querySelectorAll("[data-x]").forEach(function (el) { el.onclick = function () { delConfirm("donations", el.getAttribute("data-x"), paint); }; });
    }

    function renderTx(body, coll, title, catKey, catLabel, dir, formFn) {
      var list = DB.all(coll).sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
      var total = list.reduce(function (s, a) { return s + (parseFloat(a.amount) || 0); }, 0);
      var rows = list.length ? list.map(function (a) {
        return "<tr><td>" + U.fmtDate(a.date) + "</td><td>" + U.esc(a.label || "—") + "</td><td>" + U.esc(a[catKey] || "—") +
          '</td><td class="money ' + dir + '">' + U.fmtMoney(a.amount) + '</td><td><div class="t-actions">' +
          '<button class="icon-btn" data-e="' + a.id + '">✏️</button><button class="icon-btn danger" data-x="' + a.id + '">🗑️</button></div></td></tr>';
      }).join("") : empty(dir === "in" ? "📈" : "📉", "لا توجد سجلّات");
      body.innerHTML = bar("إضافة " + title, "addBtn", dir === "in" ? "" : "danger") +
        wrapTable(["التاريخ", "البيان", catLabel, "المقدار", "إجراءات"], rows, "المجموع", U.fmtMoney(total), dir, list.length);
      body.querySelector("#addBtn").onclick = function () { formFn(paint); };
      body.querySelectorAll("[data-e]").forEach(function (el) { el.onclick = function () { formFn(paint, el.getAttribute("data-e")); }; });
      body.querySelectorAll("[data-x]").forEach(function (el) { el.onclick = function () { delConfirm(coll, el.getAttribute("data-x"), paint); }; });
    }

    function bar(label, id, cls) {
      return '<div class="toolbar no-print"><div class="spacer" style="flex:1"></div><button class="btn ' + (cls || "") + '" id="' + id + '"><span class="ico">＋</span> ' + label + "</button></div>";
    }
    function wrapTable(headers, rows, totalLabel, totalVal, dir, count) {
      var foot = count ? '<tfoot><tr><th colspan="' + (headers.length - 2) + '" style="text-align:left;background:var(--green-50)">' + totalLabel +
        '</th><th class="money ' + dir + '" style="background:var(--green-50)">' + totalVal + '</th><th style="background:var(--green-50)"></th></tr></tfoot>' : "";
      return '<div class="table-wrap"><table><thead><tr>' + headers.map(function (h) { return "<th>" + h + "</th>"; }).join("") + "</tr></thead><tbody>" + rows + "</tbody>" + foot + "</table></div>";
    }
    function empty(ico, txt) { return '<tr><td colspan="9"><div class="empty"><div class="e-ico">' + ico + "</div><h4>" + txt + "</h4></div></td></tr>"; }
    function delConfirm(coll, id, cb) {
      U.confirm({ title: "حذف السجلّ", danger: true, message: "حذف هذا السجلّ نهائياً؟", okText: "حذف", onOk: function () { DB.remove(coll, id); U.toast("تم الحذف", "info"); cb(); } });
    }

    paint();
  };
})(window);
