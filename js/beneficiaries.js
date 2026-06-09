/* =================================================================
   beneficiaries.js — المنتفعون / الحالات الاجتماعية (ملف العائلة)
   ================================================================= */
(function (global) {
  "use strict";
  var App = global.App || (global.App = { views: {} });
  App.views = App.views || {};

  var COLL = "beneficiaries";

  var MARITAL = ["أعزب / عزباء", "متزوّج(ة)", "مطلّق(ة)", "أرمل(ة)"];
  var FAMILY_TYPE = ["عادية", "أيتام", "أرملة معيلة", "مُسنّ بمفرده", "ذو إعاقة", "أخرى"];
  var CATEGORY = ["قارة", "ظرفية", "عاجلة"];
  var WORK = ["موظّف(ة)", "عامل(ة) مرسم", "عامل(ة) غير مرسم", "عاطل عن العمل", "متقاعد(ة)", "ربّة بيت"];
  var HOUSING = ["ملك خاص", "إيجار", "تكفّل (مأوى)", "دائر / متنقّل"];
  var COVERAGE = ["ضمان اجتماعي", "تعريفة منخفضة (أصفر)", "علاج مجاني (أبيض)", "بدون تغطية", "متقاعد"];

  /* رقم ملف تلقائي تسلسلي: ع-YYYY-NNN */
  function nextFileNo() {
    var year = new Date().getFullYear();
    var n = DB.all(COLL).reduce(function (m, b) {
      var mt = (b.fileNo || "").match(/-(\d+)$/);
      return mt ? Math.max(m, parseInt(mt[1], 10)) : m;
    }, 0);
    return "ع-" + year + "-" + ("000" + (n + 1)).slice(-3);
  }

  function fullName(b) {
    return [b.firstName, b.lastName].filter(Boolean).join(" ") + (b.nickname ? " (" + b.nickname + ")" : "");
  }

  function catTag(b) {
    var map = { "قارة": "green", "ظرفية": "amber", "عاجلة": "red" };
    return b.category ? '<span class="tag ' + (map[b.category] || "gray") + '">' + U.esc(b.category) + "</span>" : "—";
  }

  /* ============ القائمة ============ */
  App.views.beneficiaries = function (container, params) {
    if (params && params.id) return detail(container, params.id);

    var state = { q: "", filter: "active" };

    function rows() {
      var list = DB.all(COLL).filter(function (b) {
        return state.filter === "archived" ? b.archived : !b.archived;
      });
      if (state.q) list = list.filter(function (b) {
        return U.match(b, state.q, ["firstName", "lastName", "nickname", "fileNo", "cin", "phone", "address"]) || memberHits(b, state.q).length;
      });
      list.sort(function (a, b) { return (b.createdAt || "").localeCompare(a.createdAt || ""); });
      return list;
    }

    function paint() {
      var list = rows();
      var body;
      if (!list.length) {
        body = '<div class="empty"><div class="e-ico">👨‍👩‍👧‍👦</div><h4>لا توجد عائلات مسجّلة</h4>' +
          '<p>اضغط «إضافة عائلة» لإدراج أوّل حالة اجتماعية.</p></div>';
      } else {
        var tr = list.map(function (b) {
          var aidCount = DB.where("aid", "beneficiaryId", b.id).length;
          var hits = memberHits(b, state.q);
          var hitChip = hits.length ? '<div style="margin-top:3px"><span class="tag green" style="font-size:11px">👤 يطابق فرداً: ' + U.esc(hits.join("، ")) + "</span></div>" : "";
          return "<tr>" +
            '<td><span class="tag gray">' + U.esc(b.fileNo || "—") + "</span></td>" +
            '<td><a href="#" data-open="' + b.id + '" style="font-weight:800">' + U.esc(fullName(b)) + "</a>" + hitChip + "</td>" +
            "<td>" + U.esc(b.phone || "—") + "</td>" +
            "<td>" + U.esc(b.marital || "—") + "</td>" +
            '<td style="text-align:center">' + U.fmtNum(b.members || childrenCount(b) + 1) + "</td>" +
            "<td>" + catTag(b) + "</td>" +
            '<td style="text-align:center">' + (aidCount ? '<span class="tag green">' + aidCount + "</span>" : '<span class="muted">0</span>') + "</td>" +
            '<td><div class="t-actions">' +
              '<button class="icon-btn" data-open="' + b.id + '" title="عرض الملف">👁️</button>' +
              '<button class="icon-btn" data-edit="' + b.id + '" title="تعديل">✏️</button>' +
              '<button class="icon-btn" data-print="' + b.id + '" title="طباعة">🖨️</button>' +
              '<button class="icon-btn" data-arch="' + b.id + '" title="' + (b.archived ? "استرجاع" : "أرشفة") + '">' + (b.archived ? "♻️" : "📥") + "</button>" +
              '<button class="icon-btn danger" data-del="' + b.id + '" title="حذف">🗑️</button>' +
            "</div></td></tr>";
        }).join("");
        body =
          '<div class="table-wrap"><table><thead><tr>' +
          "<th>رقم الملف</th><th>الاسم واللقب</th><th>الهاتف</th><th>الحالة العائلية</th>" +
          "<th>عدد الأفراد</th><th>الصنف</th><th>المساعدات</th><th>إجراءات</th>" +
          "</tr></thead><tbody>" + tr + "</tbody></table></div>";
      }

      container.innerHTML =
        '<div class="toolbar no-print">' +
          '<div class="search"><span class="si">🔍</span><input id="bSearch" placeholder="بحث بالاسم، رقم الملف، ب.ت.و، الهاتف، أو اسم فرد…" value="' + U.esc(state.q) + '"></div>' +
          '<div class="filter-pills">' +
            '<button class="pill ' + (state.filter === "active" ? "active" : "") + '" data-flt="active">الحالات النشطة</button>' +
            '<button class="pill ' + (state.filter === "archived" ? "active" : "") + '" data-flt="archived">الأرشيف</button>' +
          "</div><div class='spacer' style='flex:1'></div>" +
          '<button class="btn secondary" id="bExport"><span class="ico">⬇️</span> تصدير Excel</button>' +
          '<button class="btn" id="bAdd"><span class="ico">＋</span> إضافة عائلة</button>' +
        "</div>" + body;

      var srch = document.getElementById("bSearch");
      srch.oninput = U.debounce(function () { state.q = srch.value; paint(); keepFocus(); }, 180);
      document.getElementById("bAdd").onclick = function () { openForm(null, paint); };
      document.getElementById("bExport").onclick = exportCSV;
      container.querySelectorAll("[data-flt]").forEach(function (el) {
        el.onclick = function () { state.filter = el.getAttribute("data-flt"); state.q = ""; paint(); };
      });
      container.querySelectorAll("[data-open]").forEach(function (el) {
        el.onclick = function (e) { e.preventDefault(); App.navigate("beneficiaries", { id: el.getAttribute("data-open") }); };
      });
      container.querySelectorAll("[data-edit]").forEach(function (el) {
        el.onclick = function () { openForm(el.getAttribute("data-edit"), paint); };
      });
      container.querySelectorAll("[data-print]").forEach(function (el) {
        el.onclick = function () { printFile(el.getAttribute("data-print")); };
      });
      container.querySelectorAll("[data-arch]").forEach(function (el) {
        el.onclick = function () {
          var b = DB.get(COLL, el.getAttribute("data-arch"));
          DB.setArchived(COLL, b.id, !b.archived);
          U.toast(b.archived ? "تمت إعادة الملف للحالات النشطة" : "تمت أرشفة الملف"); paint();
        };
      });
      container.querySelectorAll("[data-del]").forEach(function (el) {
        el.onclick = function () {
          var b = DB.get(COLL, el.getAttribute("data-del"));
          U.confirm({
            title: "حذف الملف نهائياً", danger: true,
            message: "سيتم حذف ملف «" + fullName(b) + "» وكل مساعداته نهائياً. لا يمكن التراجع. هل أنت متأكّد؟",
            okText: "حذف نهائي",
            onOk: function () {
              DB.where("aid", "beneficiaryId", b.id).forEach(function (a) { DB.remove("aid", a.id); });
              DB.remove(COLL, b.id); U.toast("تم حذف الملف", "info"); paint();
            }
          });
        };
      });

      function keepFocus() { var s = document.getElementById("bSearch"); if (s) { s.focus(); s.selectionStart = s.value.length; } }
    }

    function exportCSV() {
      var list = rows();
      if (!list.length) return U.toast("لا توجد بيانات للتصدير", "info");
      var headers = [
        { label: "رقم الملف", key: "fileNo" }, { label: "الاسم", key: "firstName" },
        { label: "اللقب", key: "lastName" }, { label: "الكنية", key: "nickname" },
        { label: "ب.ت.و", key: "cin" }, { label: "الهاتف", key: "phone" },
        { label: "تاريخ الولادة", key: "dob" }, { label: "الحالة العائلية", key: "marital" },
        { label: "عدد الأفراد", get: function (b) { return b.members || childrenCount(b) + 1; } },
        { label: "نوع العائلة", key: "familyType" }, { label: "الصنف", key: "category" },
        { label: "العمل", key: "work" }, { label: "تقدير الدخل", key: "income" },
        { label: "السكن", key: "housing" }, { label: "العنوان", key: "address" },
        { label: "التغطية الاجتماعية", key: "coverage" }
      ];
      U.download("المنتفعون-" + U.today() + ".csv", U.toCSV(list, headers), "text/csv");
      U.toast("تم تصدير ملف Excel (CSV)");
    }

    paint();
  };

  function childrenCount(b) { return (b.children || []).length; }

  /* أسماء الأفراد (الأبناء/المكفولين) المطابقين لنصّ البحث داخل عائلة */
  function memberHits(b, q) {
    if (!q) return [];
    q = q.toLowerCase();
    return (b.children || [])
      .filter(function (k) { return k.name && k.name.toLowerCase().indexOf(q) !== -1; })
      .map(function (k) { return k.name; });
  }

  /* ============ تفاصيل الملف ============ */
  function detail(container, id) {
    var b = DB.get(COLL, id);
    if (!b) { container.innerHTML = '<div class="empty"><div class="e-ico">❓</div><h4>الملف غير موجود</h4></div>'; return; }

    function info(k, v) { return '<div class="info-item"><div class="k">' + k + '</div><div class="v">' + (v || "—") + "</div></div>"; }

    function paint() {
      b = DB.get(COLL, id);
      var aid = DB.where("aid", "beneficiaryId", id).sort(function (a, c) { return (c.date || "").localeCompare(a.date || ""); });
      var totalAid = aid.reduce(function (s, a) { return s + (parseFloat(a.amount) || 0); }, 0);

      var aidRows = aid.length ? aid.map(function (a) {
        return "<tr><td>" + U.fmtDate(a.date) + "</td><td>" + U.esc(a.type || "—") + "</td>" +
          "<td>" + U.esc(a.occasion || "—") + '</td><td class="money out">' + U.fmtMoney(a.amount) + "</td>" +
          '<td><div class="t-actions"><button class="icon-btn" data-aedit="' + a.id + '">✏️</button>' +
          '<button class="icon-btn danger" data-adel="' + a.id + '">🗑️</button></div></td></tr>';
      }).join("") : '<tr><td colspan="5" class="muted" style="text-align:center;padding:22px">لا توجد مساعدات مسجّلة بعد</td></tr>';

      var kids = (b.children || []);
      var kidsTable = kids.length ?
        '<div class="table-wrap mt-20"><table><thead><tr><th>الاسم</th><th>تاريخ الولادة</th><th>العمر</th><th>المستوى الدراسي</th><th>العمل</th><th>الحالة الصحية</th></tr></thead><tbody>' +
        kids.map(function (k) {
          return "<tr><td>" + U.esc(k.name) + "</td><td>" + U.fmtDate(k.dob) + "</td><td>" + (k.dob ? U.age(k.dob) + " سنة" : "—") +
            "</td><td>" + U.esc(k.grade || "—") + "</td><td>" + U.esc(k.work || "—") + "</td><td>" + U.esc(k.health || "عادية") + "</td></tr>";
        }).join("") + "</tbody></table></div>" : "";

      var healthBits = [];
      if (b.chronic) healthBits.push('<span class="tag amber">مرض مزمن: ' + U.esc(b.chronicType || "غير محدّد") + "</span>");
      if (b.disabled) healthBits.push('<span class="tag red">إعاقة: ' + U.esc(b.disabilityType || "غير محدّد") + "</span>");
      if (b.pension) healthBits.push('<span class="tag green">ينتفع بجراية</span>');
      if (!healthBits.length) healthBits.push('<span class="tag gray">لا يوجد</span>');

      container.innerHTML =
        '<div class="toolbar no-print">' +
          '<button class="btn ghost" id="bBack">→ رجوع للقائمة</button><div class="spacer" style="flex:1"></div>' +
          '<button class="btn secondary" id="bPrint"><span class="ico">🖨️</span> طباعة الملف</button>' +
          '<button class="btn" id="bEdit"><span class="ico">✏️</span> تعديل</button>' +
        "</div>" +
        '<div class="detail-grid">' +
          '<div class="card profile-card"><div class="card-body">' +
            '<div class="profile-avatar">' + U.esc(U.initials(b.firstName, b.lastName)) + "</div>" +
            '<div class="pname">' + U.esc(fullName(b)) + "</div>" +
            '<div class="pfile">رقم الملف: ' + U.esc(b.fileNo || "—") + "</div>" +
            '<div style="margin-top:10px">' + catTag(b) +
              (b.familyType ? ' <span class="tag blue">' + U.esc(b.familyType) + "</span>" : "") +
              (b.archived ? ' <span class="tag gray">مؤرشف</span>' : "") + "</div>" +
            '<div style="margin-top:16px;border-top:1px solid var(--line);padding-top:14px;text-align:right">' +
              '<div class="info-list one">' +
                info("الهاتف", U.esc(b.phone)) +
                info("ب.ت.و", U.esc(b.cin)) +
                info("تاريخ الولادة", b.dob ? U.fmtDate(b.dob) + (U.age(b.dob) ? " (" + U.age(b.dob) + " سنة)" : "") : "—") +
                info("مكان الولادة", U.esc(b.birthPlace)) +
                info("العنوان", U.esc(b.address) + (b.postal ? " — " + U.esc(b.postal) : "")) +
              "</div></div>" +
          "</div></div>" +

          "<div>" +
            '<div class="card mb-16"><div class="card-head"><h3>👨‍👩‍👧 الحالة العائلية والصحية</h3></div><div class="card-body">' +
              '<div class="info-list">' +
                info("الحالة العائلية", U.esc(b.marital)) +
                info("عدد الأفراد", U.fmtNum(b.members || childrenCount(b) + 1)) +
                info("نوع العائلة", U.esc(b.familyType)) +
                info("الحالة الصحية", healthBits.join(" ")) +
                info("الضمان الاجتماعي", U.esc(b.ssn) + (b.cardExpiry ? " — صلوحية: " + U.fmtDate(b.cardExpiry) : "")) +
                info("التغطية الاجتماعية", U.esc(b.coverage)) +
              "</div>" + kidsTable +
            "</div></div>" +

            '<div class="card mb-16"><div class="card-head"><h3>💼 الوضعية المادية والسكن</h3></div><div class="card-body">' +
              '<div class="info-list">' +
                info("العمل", U.esc(b.work)) +
                info("تقدير الدخل الشهري", b.income ? U.fmtMoney(b.income) : "—") +
                info("مداخيل أخرى", U.esc(b.otherIncome)) +
                info("نوع السكن", U.esc(b.housing) + (b.rent ? " — كراء: " + U.fmtMoney(b.rent) : "")) +
                info("العون المكلّف", U.esc(b.agent)) +
                info("تاريخ الإدماج", b.joinDate ? U.fmtDate(b.joinDate) : U.fmtDate(b.createdAt)) +
              "</div>" +
              (b.notes ? '<div style="margin-top:12px"><div class="k" style="font-size:12px;color:var(--muted);font-weight:700">توصيف الحالة</div><div>' + U.esc(b.notes) + "</div></div>" : "") +
            "</div></div>" +

            '<div class="card"><div class="card-head"><h3>🎁 المساعدات الممنوحة</h3><div class="spacer"></div>' +
              '<span class="tag green">المجموع: ' + U.fmtMoney(totalAid) + "</span>" +
              '<button class="btn sm gold no-print" id="bAddAid" style="margin-inline-start:10px"><span class="ico">＋</span> إضافة مساعدة</button></div>' +
              '<div class="table-wrap" style="border:none;box-shadow:none;border-radius:0"><table><thead><tr>' +
              "<th>التاريخ</th><th>نوعية الإعانة</th><th>المناسبة</th><th>المقدار</th><th>إجراءات</th>" +
              "</tr></thead><tbody>" + aidRows + "</tbody></table></div>" +
            "</div>" +
          "</div>" +
        "</div>";

      document.getElementById("bBack").onclick = function () { App.navigate("beneficiaries"); };
      document.getElementById("bEdit").onclick = function () { openForm(id, paint); };
      document.getElementById("bPrint").onclick = function () { printFile(id); };
      document.getElementById("bAddAid").onclick = function () { App.aidForm(id, paint); };
      container.querySelectorAll("[data-aedit]").forEach(function (el) {
        el.onclick = function () { App.aidForm(id, paint, el.getAttribute("data-aedit")); };
      });
      container.querySelectorAll("[data-adel]").forEach(function (el) {
        el.onclick = function () {
          U.confirm({ title: "حذف المساعدة", danger: true, message: "حذف سجلّ المساعدة نهائياً؟", okText: "حذف",
            onOk: function () { DB.remove("aid", el.getAttribute("data-adel")); U.toast("تم الحذف", "info"); paint(); } });
        };
      });
    }
    paint();
  }

  /* ============ النموذج ============ */
  function chip(name, val, current) {
    return '<label class="radio-chip"><input type="radio" data-f="' + name + '" name="' + name + '" value="' + U.esc(val) + '"' +
      (current === val ? " checked" : "") + '><span>' + U.esc(val) + "</span></label>";
  }

  function openForm(id, after) {
    var b = id ? DB.get(COLL, id) : {};
    var isNew = !id;
    var children = (b.children || []).slice();

    function opts(list, sel) {
      return '<option value="">— اختر —</option>' + list.map(function (o) {
        return '<option' + (sel === o ? " selected" : "") + ">" + U.esc(o) + "</option>";
      }).join("");
    }

    var body =
      '<div class="form-grid">' +
        '<div class="field"><label>رقم الملف</label><input data-f="fileNo" value="' + U.esc(b.fileNo || nextFileNo()) + '"></div>' +
        '<div class="field"><label>العون المكلّف بالمسك</label><input data-f="agent" value="' + U.esc(b.agent || "") + '" placeholder="اسم العون"></div>' +
      "</div>" +

      '<fieldset class="fieldset"><legend>① المعطيات الشخصية</legend><div class="form-grid">' +
        '<div class="field"><label>الاسم <span class="req">*</span></label><input data-f="firstName" value="' + U.esc(b.firstName || "") + '" required></div>' +
        '<div class="field"><label>اللقب <span class="req">*</span></label><input data-f="lastName" value="' + U.esc(b.lastName || "") + '" required></div>' +
        '<div class="field"><label>الكنية</label><input data-f="nickname" value="' + U.esc(b.nickname || "") + '" placeholder="إن وُجدت عند تشابه الأسماء"></div>' +
        '<div class="field"><label>رقم ب.ت.و</label><input data-f="cin" value="' + U.esc(b.cin || "") + '" inputmode="numeric"></div>' +
        '<div class="field"><label>تاريخ الولادة</label><input type="date" data-f="dob" value="' + U.esc(b.dob || "") + '"></div>' +
        '<div class="field"><label>مكان الولادة</label><input data-f="birthPlace" value="' + U.esc(b.birthPlace || "") + '"></div>' +
        '<div class="field"><label>الهاتف</label><input data-f="phone" value="' + U.esc(b.phone || "") + '" inputmode="tel"></div>' +
      "</div></fieldset>" +

      '<fieldset class="fieldset"><legend>② الضمان والتغطية الاجتماعية</legend><div class="form-grid">' +
        '<div class="field"><label>رقم الضمان الاجتماعي</label><input data-f="ssn" value="' + U.esc(b.ssn || "") + '"></div>' +
        '<div class="field"><label>صلوحية البطاقة (تاريخ الانتهاء)</label><input type="date" data-f="cardExpiry" value="' + U.esc(b.cardExpiry || "") + '"></div>' +
        '<div class="field full"><label>نوع التغطية الاجتماعية</label><select data-f="coverage">' + opts(COVERAGE, b.coverage) + "</select></div>" +
      "</div></fieldset>" +

      '<fieldset class="fieldset"><legend>③ الوضعية العائلية</legend>' +
        '<div class="field"><label>الحالة العائلية</label><div class="radio-row">' + MARITAL.map(function (m) { return chip("marital", m, b.marital); }).join("") + "</div></div>" +
        '<div class="form-grid" style="margin-top:12px">' +
          '<div class="field"><label>نوع العائلة</label><select data-f="familyType">' + opts(FAMILY_TYPE, b.familyType) + "</select></div>" +
          '<div class="field"><label>صنف الحالة (الأولوية)</label><select data-f="category">' + opts(CATEGORY, b.category) + "</select></div>" +
          '<div class="field"><label>عدد الأفراد بالعائلة</label><input type="number" min="1" data-f="members" value="' + U.esc(b.members || "") + '" placeholder="يُحسب تلقائياً إن تُرك فارغاً"></div>' +
        "</div>" +
        '<div style="margin-top:10px"><div class="row-between"><label style="font-size:13px;font-weight:700;color:var(--green-900)">جدول الأبناء / الأفراد المكفولين</label>' +
          '<button type="button" class="btn sm secondary" id="addKid"><span class="ico">＋</span> إضافة سطر</button></div>' +
          '<table class="children-table"><thead><tr><th style="width:24%">الاسم</th><th>تاريخ الولادة</th><th>المستوى الدراسي</th><th>العمل</th><th>الحالة الصحية</th><th style="width:34px"></th></tr></thead><tbody id="kidsBody"></tbody></table>' +
        "</div>" +
      "</fieldset>" +

      '<fieldset class="fieldset"><legend>④ الحالة الصحية</legend>' +
        '<div class="form-grid">' +
          '<div class="field"><label class="check-inline"><input type="checkbox" data-f="chronic" id="chk_chronic"' + (b.chronic ? " checked" : "") + "> مريض مزمن</label>" +
            '<input data-f="chronicType" id="chronicType" placeholder="نوع المرض: سكري، ضغط، تنفّس…" value="' + U.esc(b.chronicType || "") + '"></div>' +
          '<div class="field"><label class="check-inline"><input type="checkbox" data-f="disabled" id="chk_dis"' + (b.disabled ? " checked" : "") + "> ذو إعاقة</label>" +
            '<input data-f="disabilityType" id="disType" placeholder="نوع الإعاقة" value="' + U.esc(b.disabilityType || "") + '"></div>' +
          '<div class="field full"><label class="check-inline"><input type="checkbox" data-f="pension"' + (b.pension ? " checked" : "") + "> ينتفع بجراية (منحة)</label></div>" +
        "</div>" +
      "</fieldset>" +

      '<fieldset class="fieldset"><legend>⑤ الوضعية المادية</legend><div class="form-grid">' +
        '<div class="field"><label>العمل / المهنة</label><select data-f="work">' + opts(WORK, b.work) + "</select></div>" +
        '<div class="field"><label>تقدير الدخل الشهري</label><input type="number" step="0.001" min="0" data-f="income" value="' + U.esc(b.income || "") + '"></div>' +
        '<div class="field full"><label>مداخيل أخرى</label><input data-f="otherIncome" value="' + U.esc(b.otherIncome || "") + '" placeholder="مصدر ومقدار المداخيل الأخرى"></div>' +
      "</div></fieldset>" +

      '<fieldset class="fieldset"><legend>⑥ السكن والعنوان</legend><div class="form-grid">' +
        '<div class="field full"><label>العنوان</label><input data-f="address" value="' + U.esc(b.address || "") + '"></div>' +
        '<div class="field"><label>الترقيم البريدي</label><input data-f="postal" value="' + U.esc(b.postal || "") + '" inputmode="numeric"></div>' +
        '<div class="field"><label>نوع المسكن</label><select data-f="housing" id="housingSel">' + opts(HOUSING, b.housing) + "</select></div>" +
        '<div class="field full" id="rentWrap" style="display:none"><label>تقدير ثمن الكراء (شهرياً)</label><input type="number" step="0.001" min="0" data-f="rent" value="' + U.esc(b.rent || "") + '"></div>' +
      "</div></fieldset>" +

      '<fieldset class="fieldset"><legend>⑦ الملف</legend><div class="form-grid">' +
        '<div class="field"><label>تاريخ الإدماج / التحيين</label><input type="date" data-f="joinDate" value="' + U.esc(b.joinDate || U.today()) + '"></div>' +
        '<div class="field full"><label>توصيف الحالة</label><textarea data-f="notes" placeholder="وصف موجز للحالة الاجتماعية والاحتياجات">' + U.esc(b.notes || "") + "</textarea></div>" +
      "</div></fieldset>";

    U.openModal({
      title: isNew ? "إضافة عائلة / حالة اجتماعية" : "تعديل ملف: " + fullName(b),
      wide: true,
      body: body,
      footer: '<button class="btn" id="bSave"><span class="ico">💾</span> حفظ الملف</button>' +
              '<button class="btn secondary" id="bCancel">إلغاء</button>',
      onOpen: function (root) {
        var kidsBody = root.querySelector("#kidsBody");

        function kidRow(k) {
          k = k || {};
          var tr = document.createElement("tr");
          tr.innerHTML =
            '<td><input class="kn" value="' + U.esc(k.name || "") + '"></td>' +
            '<td><input type="date" class="kd" value="' + U.esc(k.dob || "") + '"></td>' +
            '<td><input class="kg" value="' + U.esc(k.grade || "") + '" placeholder="تلميذ/سنة…"></td>' +
            '<td><input class="kw" value="' + U.esc(k.work || "") + '"></td>' +
            '<td><select class="kh"><option' + (!k.health || k.health === "عادية" ? " selected" : "") + ">عادية</option>" +
              "<option" + (k.health === "مرض مزمن" ? " selected" : "") + ">مرض مزمن</option>" +
              "<option" + (k.health === "إعاقة" ? " selected" : "") + ">إعاقة</option></select></td>" +
            '<td style="text-align:center"><span class="x" title="حذف">✕</span></td>';
          tr.querySelector(".x").onclick = function () { tr.remove(); };
          return tr;
        }
        children.forEach(function (k) { kidsBody.appendChild(kidRow(k)); });
        root.querySelector("#addKid").onclick = function () { kidsBody.appendChild(kidRow()); };

        // إظهار حقل الكراء عند اختيار إيجار
        var hs = root.querySelector("#housingSel"), rentWrap = root.querySelector("#rentWrap");
        function toggleRent() { rentWrap.style.display = hs.value === "إيجار" ? "" : "none"; }
        hs.onchange = toggleRent; toggleRent();

        root.querySelector("#bCancel").onclick = U.closeModal;
        root.querySelector("#bSave").onclick = function () {
          var data = U.formData(root);
          if (!data.firstName || !data.lastName) { U.toast("الاسم واللقب إجباريان", "error"); return; }
          // قراءة الأبناء
          data.children = Array.prototype.map.call(kidsBody.querySelectorAll("tr"), function (tr) {
            return {
              name: tr.querySelector(".kn").value.trim(),
              dob: tr.querySelector(".kd").value,
              grade: tr.querySelector(".kg").value.trim(),
              work: tr.querySelector(".kw").value.trim(),
              health: tr.querySelector(".kh").value
            };
          }).filter(function (k) { return k.name; });
          if (!data.members) data.members = data.children.length + 1;

          if (isNew) { DB.insert(COLL, data); U.toast("تمت إضافة العائلة بنجاح"); }
          else { DB.update(COLL, id, data); U.toast("تم تحديث الملف"); }
          U.closeModal();
          after && after();
        };
      }
    });
  }

  /* ============ طباعة الملف ============ */
  function printFile(id) {
    var b = DB.get(COLL, id);
    if (!b) return;
    var aid = DB.where("aid", "beneficiaryId", id);
    function r(k, v) { return "<div><b>" + k + ":</b> " + U.esc(v || "—") + "</div>"; }
    var kids = (b.children || []);
    var kidsTbl = kids.length ?
      "<h2>الأبناء / الأفراد المكفولون</h2><table><tr><th>الاسم</th><th>تاريخ الولادة</th><th>العمر</th><th>المستوى</th><th>الحالة الصحية</th></tr>" +
      kids.map(function (k) { return "<tr><td>" + U.esc(k.name) + "</td><td>" + U.fmtDate(k.dob) + "</td><td>" + (k.dob ? U.age(k.dob) : "—") + "</td><td>" + U.esc(k.grade || "—") + "</td><td>" + U.esc(k.health || "عادية") + "</td></tr>"; }).join("") + "</table>" : "";
    var aidTbl = aid.length ?
      "<h2>المساعدات الممنوحة</h2><table><tr><th>التاريخ</th><th>النوع</th><th>المناسبة</th><th>المقدار</th></tr>" +
      aid.map(function (a) { return "<tr><td>" + U.fmtDate(a.date) + "</td><td>" + U.esc(a.type) + "</td><td>" + U.esc(a.occasion || "—") + "</td><td>" + U.fmtMoney(a.amount) + "</td></tr>"; }).join("") + "</table>" : "";

    var html =
      "<h2>بطاقة الحالة الاجتماعية — رقم الملف: " + U.esc(b.fileNo || "—") + "</h2>" +
      '<div class="kv">' +
        r("الاسم واللقب", fullName(b)) + r("ب.ت.و", b.cin) +
        r("تاريخ ومكان الولادة", U.fmtDate(b.dob) + " — " + (b.birthPlace || "")) + r("الهاتف", b.phone) +
        r("الحالة العائلية", b.marital) + r("عدد الأفراد", b.members || kids.length + 1) +
        r("نوع العائلة", b.familyType) + r("صنف الحالة", b.category) +
        r("الضمان الاجتماعي", b.ssn) + r("صلوحية البطاقة", b.cardExpiry ? U.fmtDate(b.cardExpiry) : "—") +
        r("التغطية الاجتماعية", b.coverage) + r("الحالة الصحية", [b.chronic ? "مرض مزمن (" + (b.chronicType || "") + ")" : "", b.disabled ? "إعاقة (" + (b.disabilityType || "") + ")" : "", b.pension ? "ينتفع بجراية" : ""].filter(Boolean).join("، ") || "عادية") +
        r("العمل", b.work) + r("تقدير الدخل", b.income ? U.fmtMoney(b.income) : "—") +
        r("السكن", b.housing + (b.rent ? " — كراء " + U.fmtMoney(b.rent) : "")) + r("العنوان", (b.address || "") + " " + (b.postal || "")) +
      "</div>" +
      (b.notes ? "<h2>توصيف الحالة</h2><p>" + U.esc(b.notes) + "</p>" : "") +
      kidsTbl + aidTbl +
      '<div class="sign"><div><div class="line">إمضاء العون المكلّف</div></div><div><div class="line">إمضاء رئيس اللجنة الاجتماعية</div></div></div>';

    U.printHTML("بطاقة حالة اجتماعية — " + fullName(b), html);
  }

  App.beneficiaryFullName = fullName;
})(window);
