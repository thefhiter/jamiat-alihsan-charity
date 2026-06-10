/* =================================================================
   donors.js — المتبرعون وتبرعاتهم
   ================================================================= */
(function (global) {
  "use strict";
  var App = global.App || (global.App = { views: {} });
  App.views = App.views || {};

  var COLL = "donors";
  var DON = "donations";
  var DONOR_TYPE = ["فرد", "عائلة", "مؤسسة / شركة", "جمعية", "محسن مجهول"];
  var AID_KINDS = ["مالي", "عيني (مواد غذائية)", "ملابس", "أدوية", "أضحية", "كسوة العيد", "قفّة رمضان", "أخرى"];

  function fullName(d) { return [d.firstName, d.lastName].filter(Boolean).join(" ") || "متبرّع"; }
  function donorTotal(id) { return DB.where(DON, "donorId", id).reduce(function (s, x) { return s + (parseFloat(x.amount) || 0); }, 0); }

  /* ============ القائمة ============ */
  App.views.donors = function (container, params) {
    if (params && params.id) return detail(container, params.id);
    var state = { q: "", filter: "active" };

    function rows() {
      var list = DB.all(COLL).filter(function (d) { return state.filter === "archived" ? d.archived : !d.archived; });
      if (state.q) list = list.filter(function (d) { return U.match(d, state.q, ["firstName", "lastName", "phone", "type"]); });
      list.sort(function (a, b) { return (b.createdAt || "").localeCompare(a.createdAt || ""); });
      return list;
    }

    function paint() {
      var list = rows();
      var body;
      if (!list.length) {
        body = '<div class="empty"><div class="e-ico">🤝</div><h4>لا يوجد متبرعون مسجّلون</h4><p>اضغط «إضافة متبرّع» للبدء.</p></div>';
      } else {
        var tr = list.map(function (d) {
          var dons = DB.where(DON, "donorId", d.id);
          var last = dons.sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); })[0];
          return "<tr>" +
            '<td><a href="#" data-open="' + d.id + '" style="font-weight:800">' + U.esc(fullName(d)) + "</a></td>" +
            '<td><span class="tag blue">' + U.esc(d.type || "فرد") + "</span></td>" +
            "<td>" + U.esc(d.phone || "—") + "</td>" +
            '<td style="text-align:center">' + dons.length + "</td>" +
            '<td class="money in">' + U.fmtMoney(donorTotal(d.id)) + "</td>" +
            "<td>" + (last ? U.fmtDate(last.date) : "—") + "</td>" +
            '<td><div class="t-actions">' +
              '<button class="icon-btn" data-open="' + d.id + '" title="عرض">👁️</button>' +
              '<button class="icon-btn" data-edit="' + d.id + '" title="تعديل">✏️</button>' +
              '<button class="icon-btn" data-arch="' + d.id + '" title="' + (d.archived ? "استرجاع" : "أرشفة") + '">' + (d.archived ? "♻️" : "📥") + "</button>" +
              '<button class="icon-btn danger" data-del="' + d.id + '" title="حذف">🗑️</button>' +
            "</div></td></tr>";
        }).join("");
        body = '<div class="table-wrap"><table><thead><tr><th>الاسم واللقب</th><th>الصفة</th><th>الهاتف</th><th>عدد التبرعات</th><th>مجموع التبرعات</th><th>آخر تبرّع</th><th>إجراءات</th></tr></thead><tbody>' + tr + "</tbody></table></div>";
      }

      container.innerHTML =
        '<div class="toolbar no-print">' +
          '<div class="search"><span class="si">🔍</span><input id="dSearch" placeholder="بحث باسم المتبرّع أو الهاتف…" value="' + U.esc(state.q) + '"></div>' +
          '<div class="filter-pills"><button class="pill ' + (state.filter === "active" ? "active" : "") + '" data-flt="active">النشطون</button>' +
          '<button class="pill ' + (state.filter === "archived" ? "active" : "") + '" data-flt="archived">الأرشيف</button></div>' +
          '<div class="spacer" style="flex:1"></div>' +
          '<button class="btn secondary" id="dPrintList"><span class="ico">🖨️</span> طباعة القائمة</button>' +
          '<button class="btn secondary" id="dExport"><span class="ico">⬇️</span> تصدير</button>' +
          '<button class="btn" id="dAdd"><span class="ico">＋</span> إضافة متبرّع</button>' +
        "</div>" + body;

      var s = document.getElementById("dSearch");
      s.oninput = U.debounce(function () { state.q = s.value; paint(); var n = document.getElementById("dSearch"); if (n) { n.focus(); n.selectionStart = n.value.length; } }, 180);
      document.getElementById("dAdd").onclick = function () { openForm(null, paint); };
      document.getElementById("dExport").onclick = function () {
        if (!list.length) return U.toast("لا توجد بيانات", "info");
        var headers = [{ label: "الاسم", key: "firstName" }, { label: "اللقب", key: "lastName" }, { label: "الصفة", key: "type" },
          { label: "الهاتف", key: "phone" }, { label: "عدد التبرعات", get: function (d) { return DB.where(DON, "donorId", d.id).length; } },
          { label: "مجموع التبرعات", get: function (d) { return donorTotal(d.id); } }];
        U.download("المتبرعون-" + U.today() + ".csv", U.toCSV(list, headers), "text/csv"); U.toast("تم التصدير");
      };
      document.getElementById("dPrintList").onclick = function () {
        if (!list.length) return U.toast("لا توجد بيانات للطباعة", "info");
        U.printTable("قائمة المتبرّعين", ["الاسم واللقب", "الصفة", "الهاتف", "عدد التبرعات", "مجموع التبرعات"],
          list.map(function (d) {
            return [fullName(d), d.type || "فرد", d.phone || "—", DB.where(DON, "donorId", d.id).length, U.fmtMoney(donorTotal(d.id))];
          }), { subtitle: state.filter === "archived" ? "الأرشيف" : "النشطون" });
      };
      container.querySelectorAll("[data-flt]").forEach(function (el) { el.onclick = function () { state.filter = el.getAttribute("data-flt"); paint(); }; });
      container.querySelectorAll("[data-open]").forEach(function (el) { el.onclick = function (e) { e.preventDefault(); App.navigate("donors", { id: el.getAttribute("data-open") }); }; });
      container.querySelectorAll("[data-edit]").forEach(function (el) { el.onclick = function () { openForm(el.getAttribute("data-edit"), paint); }; });
      container.querySelectorAll("[data-arch]").forEach(function (el) {
        el.onclick = function () { var d = DB.get(COLL, el.getAttribute("data-arch")); DB.setArchived(COLL, d.id, !d.archived); U.toast(d.archived ? "تمت الإعادة" : "تمت الأرشفة"); paint(); };
      });
      container.querySelectorAll("[data-del]").forEach(function (el) {
        el.onclick = function () {
          var d = DB.get(COLL, el.getAttribute("data-del"));
          U.confirm({ title: "حذف المتبرّع", danger: true, message: "حذف «" + fullName(d) + "» وكل تبرعاته نهائياً؟", okText: "حذف نهائي",
            onOk: function () { DB.where(DON, "donorId", d.id).forEach(function (x) { DB.remove(DON, x.id); }); DB.remove(COLL, d.id); U.toast("تم الحذف", "info"); paint(); } });
        };
      });
    }
    paint();
  };

  /* ============ التفاصيل ============ */
  function detail(container, id) {
    function paint() {
      var d = DB.get(COLL, id);
      if (!d) { container.innerHTML = '<div class="empty"><div class="e-ico">❓</div><h4>المتبرّع غير موجود</h4></div>'; return; }
      var dons = DB.where(DON, "donorId", id).sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
      var total = donorTotal(id);
      var rows = dons.length ? dons.map(function (x) {
        return "<tr><td>" + U.fmtDate(x.date) + "</td><td>" + U.esc(x.type || "—") + "</td><td>" + U.esc(x.occasion || "—") +
          '</td><td class="money in">' + U.fmtMoney(x.amount) + '</td><td><div class="t-actions">' +
          '<button class="icon-btn" data-dedit="' + x.id + '">✏️</button><button class="icon-btn danger" data-ddel="' + x.id + '">🗑️</button></div></td></tr>';
      }).join("") : '<tr><td colspan="5" class="muted" style="text-align:center;padding:22px">لا توجد تبرّعات مسجّلة بعد</td></tr>';

      container.innerHTML =
        '<div class="toolbar no-print"><button class="btn ghost" id="dBack">→ رجوع</button><div class="spacer" style="flex:1"></div>' +
          '<button class="btn secondary" id="dPrint"><span class="ico">🖨️</span> طباعة</button>' +
          '<button class="btn" id="dEdit"><span class="ico">✏️</span> تعديل</button></div>' +
        '<div class="detail-grid">' +
          '<div class="card profile-card"><div class="card-body">' +
            '<div class="profile-avatar" style="background:linear-gradient(135deg,var(--gold-500),var(--gold-600))">' + U.esc(U.initials(d.firstName, d.lastName)) + "</div>" +
            '<div class="pname">' + U.esc(fullName(d)) + '</div><div class="pfile">' + U.esc(d.type || "فرد") + "</div>" +
            '<div style="margin-top:16px;border-top:1px solid var(--line);padding-top:14px;text-align:right"><div class="info-list one">' +
              '<div class="info-item"><div class="k">الهاتف</div><div class="v">' + U.esc(d.phone || "—") + "</div></div>" +
              '<div class="info-item"><div class="k">العنوان</div><div class="v">' + U.esc(d.address || "—") + "</div></div>" +
              '<div class="info-item"><div class="k">مجموع التبرعات</div><div class="v money in">' + U.fmtMoney(total) + "</div></div>" +
              (d.notes ? '<div class="info-item"><div class="k">ملاحظات</div><div class="v">' + U.esc(d.notes) + "</div></div>" : "") +
            "</div></div></div></div>" +
          '<div class="card"><div class="card-head"><h3>🎁 سجلّ التبرعات</h3><div class="spacer"></div>' +
            '<button class="btn sm gold no-print" id="addDon"><span class="ico">＋</span> تسجيل تبرّع</button></div>' +
            '<div class="table-wrap" style="border:none;box-shadow:none;border-radius:0"><table><thead><tr><th>التاريخ</th><th>نوعية الإعانة</th><th>المناسبة</th><th>المقدار</th><th>إجراءات</th></tr></thead><tbody>' + rows + "</tbody></table></div></div>" +
        "</div>";

      document.getElementById("dBack").onclick = function () { App.navigate("donors"); };
      document.getElementById("dEdit").onclick = function () { openForm(id, paint); };
      document.getElementById("dPrint").onclick = function () { printDonor(id); };
      document.getElementById("addDon").onclick = function () { App.donationForm(id, paint); };
      container.querySelectorAll("[data-dedit]").forEach(function (el) { el.onclick = function () { App.donationForm(id, paint, el.getAttribute("data-dedit")); }; });
      container.querySelectorAll("[data-ddel]").forEach(function (el) {
        el.onclick = function () { U.confirm({ title: "حذف التبرّع", danger: true, message: "حذف سجلّ التبرّع؟", okText: "حذف",
          onOk: function () { DB.remove(DON, el.getAttribute("data-ddel")); U.toast("تم الحذف", "info"); paint(); } }); };
      });
    }
    paint();
  }

  /* ============ نموذج المتبرّع ============ */
  function openForm(id, after) {
    var d = id ? DB.get(COLL, id) : {};
    var isNew = !id;
    var typeOpts = DONOR_TYPE.map(function (t) { return '<option' + (d.type === t ? " selected" : "") + ">" + U.esc(t) + "</option>"; }).join("");
    U.openModal({
      title: isNew ? "إضافة متبرّع" : "تعديل المتبرّع",
      body: '<div class="form-grid">' +
        '<div class="field"><label>الاسم <span class="req">*</span></label><input data-f="firstName" value="' + U.esc(d.firstName || "") + '"></div>' +
        '<div class="field"><label>اللقب</label><input data-f="lastName" value="' + U.esc(d.lastName || "") + '"></div>' +
        '<div class="field"><label>الصفة</label><select data-f="type"><option value="">— اختر —</option>' + typeOpts + "</select></div>" +
        '<div class="field"><label>الهاتف</label><input data-f="phone" value="' + U.esc(d.phone || "") + '" inputmode="tel"></div>' +
        '<div class="field full"><label>العنوان</label><input data-f="address" value="' + U.esc(d.address || "") + '"></div>' +
        '<div class="field full"><label>ملاحظات</label><textarea data-f="notes">' + U.esc(d.notes || "") + "</textarea></div>" +
      "</div>",
      footer: '<button class="btn" id="dSave"><span class="ico">💾</span> حفظ</button><button class="btn secondary" id="dCancel">إلغاء</button>',
      onOpen: function (root) {
        root.querySelector("#dCancel").onclick = U.closeModal;
        root.querySelector("#dSave").onclick = function () {
          var data = U.formData(root);
          if (!data.firstName) { U.toast("الاسم إجباري", "error"); return; }
          if (isNew) { DB.insert(COLL, data); U.toast("تمت إضافة المتبرّع"); }
          else { DB.update(COLL, id, data); U.toast("تم التحديث"); }
          U.closeModal(); after && after();
        };
      }
    });
  }

  /* ============ نموذج التبرّع (مشترك) ============ */
  App.donationForm = function (donorId, after, donationId) {
    var x = donationId ? DB.get(DON, donationId) : {};
    var isNew = !donationId;
    // اختيار المتبرّع إن لم يُمرَّر
    var needPick = !donorId;
    var donorsList = DB.all(COLL).filter(function (d) { return !d.archived; });
    var pickHtml = needPick ? '<div class="field full"><label>المتبرّع <span class="req">*</span></label><select data-f="donorId"><option value="">— اختر المتبرّع —</option>' +
      donorsList.map(function (d) { return '<option value="' + d.id + '">' + U.esc(fullName(d)) + "</option>"; }).join("") + "</select></div>" : "";
    var kindOpts = AID_KINDS.map(function (k) { return '<option' + (x.type === k ? " selected" : "") + ">" + U.esc(k) + "</option>"; }).join("");

    U.openModal({
      title: isNew ? "تسجيل تبرّع جديد" : "تعديل التبرّع",
      body: '<div class="form-grid">' + pickHtml +
        '<div class="field"><label>التاريخ</label><input type="date" data-f="date" value="' + U.esc(x.date || U.today()) + '"></div>' +
        '<div class="field"><label>المقدار</label><input type="number" step="0.001" min="0" data-f="amount" value="' + U.esc(x.amount || "") + '"></div>' +
        '<div class="field"><label>نوعية الإعانة</label><select data-f="type"><option value="">— اختر —</option>' + kindOpts + "</select></div>" +
        '<div class="field"><label>المناسبة</label><input data-f="occasion" value="' + U.esc(x.occasion || "") + '" placeholder="رمضان، العيد، عاشوراء…"></div>' +
        '<div class="field full"><label>ملاحظة</label><input data-f="note" value="' + U.esc(x.note || "") + '"></div>' +
      "</div>",
      footer: '<button class="btn" id="xSave"><span class="ico">💾</span> حفظ</button><button class="btn secondary" id="xCancel">إلغاء</button>',
      onOpen: function (root) {
        root.querySelector("#xCancel").onclick = U.closeModal;
        root.querySelector("#xSave").onclick = function () {
          var data = U.formData(root);
          var did = donorId || data.donorId;
          if (!did) { U.toast("يُرجى اختيار المتبرّع", "error"); return; }
          if (!data.amount && !data.type) { U.toast("أدخل المقدار أو نوعية الإعانة", "error"); return; }
          data.donorId = did;
          if (isNew) { DB.insert(DON, data); U.toast("تم تسجيل التبرّع"); }
          else { DB.update(DON, donationId, data); U.toast("تم التحديث"); }
          U.closeModal(); after && after();
        };
      }
    });
  };

  function printDonor(id) {
    var d = DB.get(COLL, id);
    var dons = DB.where(DON, "donorId", id);
    var tbl = "<table><tr><th>التاريخ</th><th>النوع</th><th>المناسبة</th><th>المقدار</th></tr>" +
      dons.map(function (x) { return "<tr><td>" + U.fmtDate(x.date) + "</td><td>" + U.esc(x.type) + "</td><td>" + U.esc(x.occasion || "—") + "</td><td>" + U.fmtMoney(x.amount) + "</td></tr>"; }).join("") +
      '<tr><th colspan="3">المجموع</th><th>' + U.fmtMoney(donorTotal(id)) + "</th></tr></table>";
    U.printHTML("سجلّ تبرّعات — " + fullName(d),
      "<h2>المتبرّع: " + U.esc(fullName(d)) + "</h2><div class='kv'><div><b>الصفة:</b> " + U.esc(d.type || "—") + "</div><div><b>الهاتف:</b> " + U.esc(d.phone || "—") + "</div></div><h2>التبرعات</h2>" + tbl);
  }

  App.donorFullName = fullName;
})(window);
