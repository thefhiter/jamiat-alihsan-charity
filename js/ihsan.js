/* =================================================================
   ihsan.js — استمارة جمعية الإحسان (المنتفعون + المتبرّعون في سجلّ واحد)
   تطابق نموذج الاستمارة: قسم «المنتفعون» مستقلّ وقسم «المتبرّعون» مستقلّ.
   ================================================================= */
(function (global) {
  "use strict";
  var App = global.App || (global.App = { views: {} });
  App.views = App.views || {};

  var COLL = "ihsan";
  var AID_KINDS = ["مالي", "عيني (مواد غذائية)", "ملابس", "أدوية", "أضحية", "كسوة العيد", "قفّة رمضان", "أخرى"];

  function recTitle(r) {
    return [r.benFamily, r.donorName].filter(Boolean).join(" / ") || "استمارة الإحسان";
  }

  /* ============ القائمة ============ */
  App.views.ihsan = function (container, params) {
    if (params && params.id) return detail(container, params.id);
    var state = { q: "", filter: "active" };

    function rows() {
      var list = DB.all(COLL).filter(function (r) { return state.filter === "archived" ? r.archived : !r.archived; });
      if (state.q) list = list.filter(function (r) {
        return U.match(r, state.q, ["benFamily", "benAidType", "benOccasion", "donorName", "donorLastName", "donorAidType"]);
      });
      list.sort(function (a, b) { return (b.createdAt || "").localeCompare(a.createdAt || ""); });
      return list;
    }

    function paint() {
      var list = rows();
      var body;
      if (!list.length) {
        body = '<div class="empty"><div class="e-ico">📋</div><h4>لا توجد استمارات مسجّلة</h4>' +
          '<p>اضغط «إضافة استمارة» لإدراج أوّل سجلّ إحسان.</p></div>';
      } else {
        var tr = list.map(function (r) {
          return "<tr>" +
            '<td><a href="#" data-open="' + r.id + '" style="font-weight:800">' + U.esc(r.benFamily || "—") + "</a></td>" +
            "<td>" + U.fmtDate(r.benDate) + "</td>" +
            '<td class="money out">' + (r.benAmount ? U.fmtMoney(r.benAmount) : "—") + "</td>" +
            "<td>" + U.esc(r.benAidType || "—") + "</td>" +
            "<td>" + U.esc([r.donorName, r.donorLastName].filter(Boolean).join(" ") || "—") + "</td>" +
            '<td class="money in">' + (r.donorAmount ? U.fmtMoney(r.donorAmount) : "—") + "</td>" +
            '<td><div class="t-actions">' +
              '<button class="icon-btn" data-open="' + r.id + '" title="عرض">👁️</button>' +
              '<button class="icon-btn" data-edit="' + r.id + '" title="تعديل">✏️</button>' +
              '<button class="icon-btn" data-print="' + r.id + '" title="طباعة">🖨️</button>' +
              '<button class="icon-btn" data-arch="' + r.id + '" title="' + (r.archived ? "استرجاع" : "أرشفة") + '">' + (r.archived ? "♻️" : "📥") + "</button>" +
              '<button class="icon-btn danger" data-del="' + r.id + '" title="حذف">🗑️</button>' +
            "</div></td></tr>";
        }).join("");
        body = '<div class="table-wrap"><table><thead><tr>' +
          "<th>العائلة المنتفعة</th><th>التاريخ</th><th>المقدار</th><th>نوعية الإعانة</th>" +
          "<th>المتبرّع</th><th>مقدار التبرّع</th><th>إجراءات</th>" +
          "</tr></thead><tbody>" + tr + "</tbody></table></div>";
      }

      container.innerHTML =
        '<div class="toolbar no-print">' +
          '<div class="search"><span class="si">🔍</span><input id="iSearch" placeholder="بحث بالعائلة المنتفعة أو المتبرّع أو نوعية الإعانة…" value="' + U.esc(state.q) + '"></div>' +
          '<div class="filter-pills">' +
            '<button class="pill ' + (state.filter === "active" ? "active" : "") + '" data-flt="active">السجلّات النشطة</button>' +
            '<button class="pill ' + (state.filter === "archived" ? "active" : "") + '" data-flt="archived">الأرشيف</button>' +
          "</div><div class='spacer' style='flex:1'></div>" +
          '<button class="btn secondary" id="iExport"><span class="ico">⬇️</span> تصدير Excel</button>' +
          '<button class="btn" id="iAdd"><span class="ico">＋</span> إضافة استمارة</button>' +
        "</div>" + body;

      var srch = document.getElementById("iSearch");
      srch.oninput = U.debounce(function () { state.q = srch.value; paint(); var n = document.getElementById("iSearch"); if (n) { n.focus(); n.selectionStart = n.value.length; } }, 180);
      document.getElementById("iAdd").onclick = function () { openForm(null, paint); };
      document.getElementById("iExport").onclick = exportCSV;
      container.querySelectorAll("[data-flt]").forEach(function (el) {
        el.onclick = function () { state.filter = el.getAttribute("data-flt"); state.q = ""; paint(); };
      });
      container.querySelectorAll("[data-open]").forEach(function (el) {
        el.onclick = function (e) { e.preventDefault(); App.navigate("ihsan", { id: el.getAttribute("data-open") }); };
      });
      container.querySelectorAll("[data-edit]").forEach(function (el) {
        el.onclick = function () { openForm(el.getAttribute("data-edit"), paint); };
      });
      container.querySelectorAll("[data-print]").forEach(function (el) {
        el.onclick = function () { printRecord(el.getAttribute("data-print")); };
      });
      container.querySelectorAll("[data-arch]").forEach(function (el) {
        el.onclick = function () {
          var r = DB.get(COLL, el.getAttribute("data-arch"));
          DB.setArchived(COLL, r.id, !r.archived);
          U.toast(r.archived ? "تمت إعادة السجلّ للنشطة" : "تمت أرشفة السجلّ"); paint();
        };
      });
      container.querySelectorAll("[data-del]").forEach(function (el) {
        el.onclick = function () {
          var r = DB.get(COLL, el.getAttribute("data-del"));
          U.confirm({ title: "حذف الاستمارة", danger: true,
            message: "حذف استمارة «" + recTitle(r) + "» نهائياً؟ لا يمكن التراجع.", okText: "حذف نهائي",
            onOk: function () { DB.remove(COLL, r.id); U.toast("تم الحذف", "info"); paint(); } });
        };
      });
    }

    function exportCSV() {
      var list = rows();
      if (!list.length) return U.toast("لا توجد بيانات للتصدير", "info");
      var headers = [
        { label: "العائلة المنتفعة", key: "benFamily" },
        { label: "التاريخ", key: "benDate" },
        { label: "المقدار", key: "benAmount" },
        { label: "نوعية الإعانة", key: "benAidType" },
        { label: "المناسبة", key: "benOccasion" },
        { label: "اسم المتبرّع", key: "donorName" },
        { label: "اللقب", key: "donorLastName" },
        { label: "تاريخ التبرّع", key: "donorDate" },
        { label: "نوعية الإعانة (تبرّع)", key: "donorAidType" },
        { label: "مقدار التبرّع", key: "donorAmount" }
      ];
      U.download("استمارات-الإحسان-" + U.today() + ".csv", U.toCSV(list, headers), "text/csv");
      U.toast("تم تصدير ملف Excel (CSV)");
    }

    paint();
  };

  /* ============ التفاصيل ============ */
  function detail(container, id) {
    var r = DB.get(COLL, id);
    if (!r) { container.innerHTML = '<div class="empty"><div class="e-ico">❓</div><h4>الاستمارة غير موجودة</h4></div>'; return; }
    function info(k, v) { return '<div class="info-item"><div class="k">' + k + '</div><div class="v">' + (v || "—") + "</div></div>"; }

    container.innerHTML =
      '<div class="toolbar no-print">' +
        '<button class="btn ghost" id="iBack">→ رجوع للقائمة</button><div class="spacer" style="flex:1"></div>' +
        '<button class="btn secondary" id="iPrint"><span class="ico">🖨️</span> طباعة</button>' +
        '<button class="btn" id="iEdit"><span class="ico">✏️</span> تعديل</button>' +
      "</div>" +
      '<div class="detail-grid">' +
        '<div class="card mb-16"><div class="card-head"><h3>👨‍👩‍👧‍👦 المنتفعون</h3></div><div class="card-body">' +
          '<div class="info-list">' +
            info("العائلة المنتفعة", U.esc(r.benFamily)) +
            info("التاريخ", r.benDate ? U.fmtDate(r.benDate) : "—") +
            info("المقدار", r.benAmount ? U.fmtMoney(r.benAmount) : "—") +
            info("نوعية الإعانة", U.esc(r.benAidType)) +
            info("المناسبة", U.esc(r.benOccasion)) +
          "</div></div></div>" +
        '<div class="card mb-16"><div class="card-head"><h3>🤝 المتبرّعون</h3></div><div class="card-body">' +
          '<div class="info-list">' +
            info("الاسم", U.esc(r.donorName)) +
            info("اللقب", U.esc(r.donorLastName)) +
            info("التاريخ", r.donorDate ? U.fmtDate(r.donorDate) : "—") +
            info("نوعية الإعانة", U.esc(r.donorAidType)) +
            info("المقدار", r.donorAmount ? U.fmtMoney(r.donorAmount) : "—") +
          "</div></div></div>" +
      "</div>";

    document.getElementById("iBack").onclick = function () { App.navigate("ihsan"); };
    document.getElementById("iEdit").onclick = function () { openForm(id, function () { detail(container, id); }); };
    document.getElementById("iPrint").onclick = function () { printRecord(id); };
  }

  /* ============ النموذج ============ */
  function openForm(id, after) {
    var r = id ? DB.get(COLL, id) : {};
    var isNew = !id;

    function kindOpts(sel) {
      return '<option value="">— اختر —</option>' + AID_KINDS.map(function (k) {
        return '<option' + (sel === k ? " selected" : "") + ">" + U.esc(k) + "</option>";
      }).join("");
    }

    var body =
      '<fieldset class="fieldset"><legend>المنتفعون</legend><div class="form-grid">' +
        '<div class="field full"><label>العائلة المنتفعة</label><input data-f="benFamily" value="' + U.esc(r.benFamily || "") + '"></div>' +
        '<div class="field"><label>التاريخ</label><input type="date" data-f="benDate" value="' + U.esc(r.benDate || U.today()) + '"></div>' +
        '<div class="field"><label>المقدار</label><input type="number" step="0.001" min="0" data-f="benAmount" value="' + U.esc(r.benAmount || "") + '"></div>' +
        '<div class="field"><label>نوعية الإعانة</label><select data-f="benAidType">' + kindOpts(r.benAidType) + "</select></div>" +
        '<div class="field"><label>المناسبة</label><input data-f="benOccasion" value="' + U.esc(r.benOccasion || "") + '" placeholder="رمضان، العيد، عاشوراء…"></div>' +
      "</div></fieldset>" +

      '<fieldset class="fieldset"><legend>المتبرّعون</legend><div class="form-grid">' +
        '<div class="field"><label>الاسم</label><input data-f="donorName" value="' + U.esc(r.donorName || "") + '"></div>' +
        '<div class="field"><label>اللقب</label><input data-f="donorLastName" value="' + U.esc(r.donorLastName || "") + '"></div>' +
        '<div class="field"><label>التاريخ</label><input type="date" data-f="donorDate" value="' + U.esc(r.donorDate || U.today()) + '"></div>' +
        '<div class="field"><label>نوعية الإعانة</label><select data-f="donorAidType">' + kindOpts(r.donorAidType) + "</select></div>" +
        '<div class="field"><label>المقدار</label><input type="number" step="0.001" min="0" data-f="donorAmount" value="' + U.esc(r.donorAmount || "") + '"></div>' +
      "</div></fieldset>";

    U.openModal({
      title: isNew ? "إضافة استمارة إحسان" : "تعديل الاستمارة",
      wide: true,
      body: body,
      footer: '<button class="btn" id="iSave"><span class="ico">💾</span> حفظ</button>' +
              '<button class="btn secondary" id="iCancel">إلغاء</button>',
      onOpen: function (root) {
        root.querySelector("#iCancel").onclick = U.closeModal;
        root.querySelector("#iSave").onclick = function () {
          var data = U.formData(root);
          if (!data.benFamily && !data.donorName) { U.toast("أدخل العائلة المنتفعة أو اسم المتبرّع", "error"); return; }
          if (isNew) { DB.insert(COLL, data); U.toast("تمت إضافة الاستمارة"); }
          else { DB.update(COLL, id, data); U.toast("تم تحديث الاستمارة"); }
          U.closeModal();
          after && after();
        };
      }
    });
  }

  /* ============ الطباعة ============ */
  function printRecord(id) {
    var r = DB.get(COLL, id);
    if (!r) return;
    function row(k, v) { return "<div><b>" + k + ":</b> " + U.esc(v || "—") + "</div>"; }
    var html =
      "<h2>المنتفعون</h2><div class='kv'>" +
        row("العائلة المنتفعة", r.benFamily) +
        row("التاريخ", r.benDate ? U.fmtDate(r.benDate) : "—") +
        row("المقدار", r.benAmount ? U.fmtMoney(r.benAmount) : "—") +
        row("نوعية الإعانة", r.benAidType) +
        row("المناسبة", r.benOccasion) +
      "</div>" +
      "<h2>المتبرّعون</h2><div class='kv'>" +
        row("الاسم", r.donorName) +
        row("اللقب", r.donorLastName) +
        row("التاريخ", r.donorDate ? U.fmtDate(r.donorDate) : "—") +
        row("نوعية الإعانة", r.donorAidType) +
        row("المقدار", r.donorAmount ? U.fmtMoney(r.donorAmount) : "—") +
      "</div>" +
      '<div class="sign"><div><div class="line">إمضاء العون المكلّف</div></div><div><div class="line">إمضاء رئيس اللجنة</div></div></div>';
    U.printHTML("استمارة جمعية الإحسان", html);
  }
})(window);
