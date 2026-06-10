/* =================================================================
   members.js — المنتفعون (أفراد العائلات)
   كل منتفع فرد مستقلّ مرتبط بعائلته (familyId)، منفصل عن ملفّ العائلة.
   ================================================================= */
(function (global) {
  "use strict";
  var App = global.App || (global.App = { views: {} });
  App.views = App.views || {};

  var COLL = "members";
  var FAM = "beneficiaries";
  var RELATION = ["رب الأسرة", "زوج / زوجة", "ابن / بنت", "مكفول", "قريب", "آخر"];
  var HEALTH = ["عادية", "مرض مزمن", "إعاقة"];

  function fullName(m) { return [m.firstName, m.lastName].filter(Boolean).join(" ") || "منتفع"; }
  function famName(id) {
    var b = id && DB.get(FAM, id);
    return b ? (App.beneficiaryFullName ? App.beneficiaryFullName(b) : [b.firstName, b.lastName].filter(Boolean).join(" ")) : "";
  }
  function relTag(m) {
    var map = { "رب الأسرة": "green", "زوج / زوجة": "blue", "ابن / بنت": "gold", "مكفول": "amber" };
    return m.relation ? '<span class="tag ' + (map[m.relation] || "gray") + '">' + U.esc(m.relation) + "</span>" : "—";
  }

  /* ============ القائمة ============ */
  App.views.members = function (container, params) {
    if (params && params.id) return detail(container, params.id);
    var state = { q: "", filter: "active", fam: "" };

    function rows() {
      var list = DB.all(COLL).filter(function (m) { return state.filter === "archived" ? m.archived : !m.archived; });
      if (state.fam) list = list.filter(function (m) { return m.familyId === state.fam; });
      if (state.q) list = list.filter(function (m) {
        return U.match(m, state.q, ["firstName", "lastName", "relation", "grade", "work", "cin"]) ||
          famName(m.familyId).toLowerCase().indexOf(state.q.toLowerCase()) !== -1;
      });
      list.sort(function (a, b) { return (b.createdAt || "").localeCompare(a.createdAt || ""); });
      return list;
    }

    function paint() {
      var list = rows();
      var fams = DB.all(FAM).filter(function (b) { return !b.archived; });
      var body;
      if (!list.length) {
        body = '<div class="empty"><div class="e-ico">👤</div><h4>لا يوجد منتفعون مسجّلون</h4>' +
          '<p>اضغط «إضافة منتفع» لإدراج فرد وربطه بعائلته.</p></div>';
      } else {
        var tr = list.map(function (m) {
          return "<tr>" +
            '<td><a href="#" data-open="' + m.id + '" style="font-weight:800">' + U.esc(fullName(m)) + "</a></td>" +
            '<td><a href="#" data-fam="' + U.esc(m.familyId || "") + '">' + U.esc(famName(m.familyId) || "—") + "</a></td>" +
            "<td>" + relTag(m) + "</td>" +
            '<td style="text-align:center">' + (m.dob && U.age(m.dob) !== "" ? U.age(m.dob) + " سنة" : "—") + "</td>" +
            "<td>" + U.esc(m.grade || "—") + "</td>" +
            "<td>" + U.esc(m.health || "عادية") + "</td>" +
            '<td><div class="t-actions">' +
              '<button class="icon-btn" data-open="' + m.id + '" title="عرض">👁️</button>' +
              '<button class="icon-btn" data-edit="' + m.id + '" title="تعديل">✏️</button>' +
              '<button class="icon-btn" data-arch="' + m.id + '" title="' + (m.archived ? "استرجاع" : "أرشفة") + '">' + (m.archived ? "♻️" : "📥") + "</button>" +
              '<button class="icon-btn danger" data-del="' + m.id + '" title="حذف">🗑️</button>' +
            "</div></td></tr>";
        }).join("");
        body = '<div class="table-wrap"><table><thead><tr>' +
          "<th>الاسم واللقب</th><th>العائلة</th><th>الصلة</th><th>العمر</th><th>المستوى الدراسي</th><th>الحالة الصحية</th><th>إجراءات</th>" +
          "</tr></thead><tbody>" + tr + "</tbody></table></div>";
      }

      var famFilter = '<select id="mFamFlt" class="mini-select"><option value="">كل العائلات</option>' +
        fams.map(function (b) { return '<option value="' + b.id + '"' + (state.fam === b.id ? " selected" : "") + ">" + U.esc(famName(b.id)) + "</option>"; }).join("") + "</select>";

      container.innerHTML =
        '<div class="toolbar no-print">' +
          '<div class="search"><span class="si">🔍</span><input id="mSearch" placeholder="بحث بالاسم أو العائلة أو الصلة…" value="' + U.esc(state.q) + '"></div>' +
          '<div class="filter-pills">' +
            '<button class="pill ' + (state.filter === "active" ? "active" : "") + '" data-flt="active">النشطون</button>' +
            '<button class="pill ' + (state.filter === "archived" ? "active" : "") + '" data-flt="archived">الأرشيف</button>' +
          "</div>" + famFilter + "<div class='spacer' style='flex:1'></div>" +
          '<button class="btn secondary" id="mExport"><span class="ico">⬇️</span> تصدير Excel</button>' +
          '<button class="btn" id="mAdd"' + (fams.length ? "" : " disabled title='أضف عائلة أولاً'") + '><span class="ico">＋</span> إضافة منتفع</button>' +
        "</div>" + body;

      var srch = document.getElementById("mSearch");
      srch.oninput = U.debounce(function () { state.q = srch.value; paint(); var n = document.getElementById("mSearch"); if (n) { n.focus(); n.selectionStart = n.value.length; } }, 180);
      document.getElementById("mFamFlt").onchange = function () { state.fam = this.value; paint(); };
      document.getElementById("mAdd").onclick = function () {
        if (!fams.length) return U.toast("أضف عائلة أولاً من قسم «العائلات»", "error");
        App.memberForm(state.fam || null, paint);
      };
      document.getElementById("mExport").onclick = exportCSV;
      container.querySelectorAll("[data-flt]").forEach(function (el) {
        el.onclick = function () { state.filter = el.getAttribute("data-flt"); state.q = ""; paint(); };
      });
      container.querySelectorAll("[data-open]").forEach(function (el) {
        el.onclick = function (e) { e.preventDefault(); App.navigate("members", { id: el.getAttribute("data-open") }); };
      });
      container.querySelectorAll("[data-fam]").forEach(function (el) {
        el.onclick = function (e) { e.preventDefault(); var fid = el.getAttribute("data-fam"); if (fid) App.navigate("beneficiaries", { id: fid }); };
      });
      container.querySelectorAll("[data-edit]").forEach(function (el) {
        el.onclick = function () { App.memberForm(null, paint, el.getAttribute("data-edit")); };
      });
      container.querySelectorAll("[data-arch]").forEach(function (el) {
        el.onclick = function () {
          var m = DB.get(COLL, el.getAttribute("data-arch"));
          DB.setArchived(COLL, m.id, !m.archived);
          U.toast(m.archived ? "تمت إعادة المنتفع للنشطين" : "تمت أرشفة المنتفع"); paint();
        };
      });
      container.querySelectorAll("[data-del]").forEach(function (el) {
        el.onclick = function () {
          var m = DB.get(COLL, el.getAttribute("data-del"));
          U.confirm({ title: "حذف المنتفع", danger: true, message: "حذف «" + fullName(m) + "» نهائياً؟ لا يمكن التراجع.", okText: "حذف نهائي",
            onOk: function () { DB.remove(COLL, m.id); U.toast("تم الحذف", "info"); paint(); } });
        };
      });
    }

    function exportCSV() {
      var list = rows();
      if (!list.length) return U.toast("لا توجد بيانات للتصدير", "info");
      var headers = [
        { label: "الاسم", key: "firstName" }, { label: "اللقب", key: "lastName" },
        { label: "العائلة", get: function (m) { return famName(m.familyId); } },
        { label: "الصلة", key: "relation" }, { label: "ب.ت.و", key: "cin" },
        { label: "تاريخ الولادة", key: "dob" },
        { label: "العمر", get: function (m) { return m.dob ? U.age(m.dob) : ""; } },
        { label: "المستوى الدراسي", key: "grade" }, { label: "العمل", key: "work" },
        { label: "الحالة الصحية", key: "health" }, { label: "الهاتف", key: "phone" }
      ];
      U.download("المنتفعون-" + U.today() + ".csv", U.toCSV(list, headers), "text/csv");
      U.toast("تم تصدير ملف Excel (CSV)");
    }

    paint();
  };

  /* ============ التفاصيل ============ */
  function detail(container, id) {
    var m = DB.get(COLL, id);
    if (!m) { container.innerHTML = '<div class="empty"><div class="e-ico">❓</div><h4>المنتفع غير موجود</h4></div>'; return; }
    function info(k, v) { return '<div class="info-item"><div class="k">' + k + '</div><div class="v">' + (v || "—") + "</div></div>"; }

    container.innerHTML =
      '<div class="toolbar no-print">' +
        '<button class="btn ghost" id="mBack">→ رجوع للقائمة</button><div class="spacer" style="flex:1"></div>' +
        '<button class="btn" id="mEdit"><span class="ico">✏️</span> تعديل</button>' +
      "</div>" +
      '<div class="detail-grid">' +
        '<div class="card profile-card"><div class="card-body">' +
          '<div class="profile-avatar" style="background:linear-gradient(135deg,var(--gold-500),var(--gold-600))">' + U.esc(U.initials(m.firstName, m.lastName)) + "</div>" +
          '<div class="pname">' + U.esc(fullName(m)) + "</div>" +
          '<div class="pfile">' + (m.relation ? U.esc(m.relation) : "منتفع") + "</div>" +
          '<div style="margin-top:10px">' + relTag(m) + (m.archived ? ' <span class="tag gray">مؤرشف</span>' : "") + "</div>" +
        "</div></div>" +
        '<div class="card"><div class="card-head"><h3>👤 بيانات المنتفع</h3></div><div class="card-body"><div class="info-list">' +
          info("العائلة", m.familyId ? '<a href="#" id="mGoFam">' + U.esc(famName(m.familyId)) + "</a>" : "—") +
          info("الصلة", U.esc(m.relation)) +
          info("ب.ت.و", U.esc(m.cin)) +
          info("تاريخ الولادة", m.dob ? U.fmtDate(m.dob) + (U.age(m.dob) !== "" ? " (" + U.age(m.dob) + " سنة)" : "") : "—") +
          info("المستوى الدراسي", U.esc(m.grade)) +
          info("العمل", U.esc(m.work)) +
          info("الحالة الصحية", U.esc(m.health || "عادية")) +
          info("الهاتف", U.esc(m.phone)) +
          (m.notes ? info("ملاحظات", U.esc(m.notes)) : "") +
        "</div></div></div>" +
      "</div>";

    document.getElementById("mBack").onclick = function () { App.navigate("members"); };
    document.getElementById("mEdit").onclick = function () { App.memberForm(null, function () { detail(container, id); }, id); };
    var goFam = document.getElementById("mGoFam");
    if (goFam) goFam.onclick = function (e) { e.preventDefault(); App.navigate("beneficiaries", { id: m.familyId }); };
  }

  /* ============ النموذج (مشترك — يُستعمل أيضاً من ملفّ العائلة) ============ */
  App.memberForm = function (familyId, after, memberId) {
    var m = memberId ? DB.get(COLL, memberId) : {};
    var isNew = !memberId;
    var lockFam = !!familyId; // ممرَّر مسبقاً من ملفّ العائلة
    var fid = familyId || m.familyId || "";
    var fams = DB.all(FAM).filter(function (b) { return !b.archived || b.id === fid; });

    function opts(list, sel) {
      return '<option value="">— اختر —</option>' + list.map(function (o) {
        return '<option' + (sel === o ? " selected" : "") + ">" + U.esc(o) + "</option>";
      }).join("");
    }
    var famPick = lockFam
      ? '<input type="hidden" data-f="familyId" value="' + U.esc(fid) + '"><div class="field full"><label>العائلة</label><input value="' + U.esc(famName(fid)) + '" disabled></div>'
      : '<div class="field full"><label>العائلة <span class="req">*</span></label><select data-f="familyId"><option value="">— اختر العائلة —</option>' +
        fams.map(function (b) { return '<option value="' + b.id + '"' + (fid === b.id ? " selected" : "") + ">" + U.esc(famName(b.id)) + " — " + U.esc(b.fileNo || "") + "</option>"; }).join("") + "</select></div>";

    U.openModal({
      title: isNew ? "إضافة منتفع" : "تعديل المنتفع",
      wide: true,
      body: '<div class="form-grid">' + famPick +
        '<div class="field"><label>الاسم <span class="req">*</span></label><input data-f="firstName" value="' + U.esc(m.firstName || "") + '" required></div>' +
        '<div class="field"><label>اللقب</label><input data-f="lastName" value="' + U.esc(m.lastName || "") + '"></div>' +
        '<div class="field"><label>الصلة بالعائلة</label><select data-f="relation">' + opts(RELATION, m.relation) + "</select></div>" +
        '<div class="field"><label>رقم ب.ت.و</label><input data-f="cin" value="' + U.esc(m.cin || "") + '" inputmode="numeric"></div>' +
        '<div class="field"><label>تاريخ الولادة</label><input type="date" data-f="dob" value="' + U.esc(m.dob || "") + '"></div>' +
        '<div class="field"><label>المستوى الدراسي</label><input data-f="grade" value="' + U.esc(m.grade || "") + '" placeholder="تلميذ/سنة…"></div>' +
        '<div class="field"><label>العمل</label><input data-f="work" value="' + U.esc(m.work || "") + '"></div>' +
        '<div class="field"><label>الحالة الصحية</label><select data-f="health">' + HEALTH.map(function (h) { return '<option' + ((m.health || "عادية") === h ? " selected" : "") + ">" + U.esc(h) + "</option>"; }).join("") + "</select></div>" +
        '<div class="field"><label>الهاتف</label><input data-f="phone" value="' + U.esc(m.phone || "") + '" inputmode="tel"></div>' +
        '<div class="field full"><label>ملاحظات</label><textarea data-f="notes">' + U.esc(m.notes || "") + "</textarea></div>" +
      "</div>",
      footer: '<button class="btn" id="mSave"><span class="ico">💾</span> حفظ</button><button class="btn secondary" id="mCancel">إلغاء</button>',
      onOpen: function (root) {
        root.querySelector("#mCancel").onclick = U.closeModal;
        root.querySelector("#mSave").onclick = function () {
          var data = U.formData(root);
          if (!data.familyId) { U.toast("يُرجى اختيار العائلة", "error"); return; }
          if (!data.firstName) { U.toast("الاسم إجباري", "error"); return; }
          if (isNew) { DB.insert(COLL, data); U.toast("تمت إضافة المنتفع"); }
          else { DB.update(COLL, memberId, data); U.toast("تم تحديث المنتفع"); }
          U.closeModal();
          after && after();
        };
      }
    });
  };

  /* أفراد عائلة معيّنة (غير المؤرشفين) */
  App.familyMembers = function (familyId, includeArchived) {
    return DB.where(COLL, "familyId", familyId).filter(function (m) { return includeArchived || !m.archived; });
  };
  App.memberFullName = fullName;
})(window);
