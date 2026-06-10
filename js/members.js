/* =================================================================
   members.js — المنتفعون (أفراد العائلات)
   كل منتفع فرد مستقلّ مرتبط بعائلته (familyId)، منفصل عن ملفّ العائلة،
   وله نفس حقول استمارة العائلة بالضبط (معطيات شخصية، ضمان، وضعية عائلية،
   حالة صحية، وضعية مادية، سكن، ملف).
   ================================================================= */
(function (global) {
  "use strict";
  var App = global.App || (global.App = { views: {} });
  App.views = App.views || {};

  var COLL = "members";
  var FAM = "beneficiaries";

  /* نفس قوائم اختيار استمارة العائلة بالضبط */
  var RELATION = ["رب الأسرة", "زوج / زوجة", "ابن / بنت", "مكفول", "قريب", "آخر"];
  var MARITAL = ["أعزب / عزباء", "متزوّج(ة)", "مطلّق(ة)", "أرمل(ة)"];
  var FAMILY_TYPE = ["عادية", "أيتام", "أرملة معيلة", "مُسنّ بمفرده", "ذو إعاقة", "أخرى"];
  var CATEGORY = ["قارة", "ظرفية", "عاجلة"];
  var WORK = ["موظّف(ة)", "عامل(ة) مرسم", "عامل(ة) غير مرسم", "عاطل عن العمل", "متقاعد(ة)", "ربّة بيت"];
  var HOUSING = ["ملك خاص", "إيجار", "تكفّل (مأوى)", "دائر / متنقّل"];
  var COVERAGE = ["ضمان اجتماعي", "تعريفة منخفضة (أصفر)", "علاج مجاني (أبيض)", "بدون تغطية", "متقاعد"];

  function fullName(m) {
    return ([m.firstName, m.lastName].filter(Boolean).join(" ") || "منتفع") + (m.nickname ? " (" + m.nickname + ")" : "");
  }
  function famName(id) {
    var b = id && DB.get(FAM, id);
    return b ? (App.beneficiaryFullName ? App.beneficiaryFullName(b) : [b.firstName, b.lastName].filter(Boolean).join(" ")) : "";
  }
  function relTag(m) {
    var map = { "رب الأسرة": "green", "زوج / زوجة": "blue", "ابن / بنت": "gold", "مكفول": "amber" };
    return m.relation ? '<span class="tag ' + (map[m.relation] || "gray") + '">' + U.esc(m.relation) + "</span>" : "—";
  }
  /* ملخّص الحالة الصحية (مع التوافق مع السجلّات المُرحَّلة التي تحمل الحقل القديم health) */
  function healthSummary(m) {
    var bits = [];
    if (m.chronic) bits.push("مرض مزمن" + (m.chronicType ? " (" + m.chronicType + ")" : ""));
    if (m.disabled) bits.push("إعاقة" + (m.disabilityType ? " (" + m.disabilityType + ")" : ""));
    if (m.pension) bits.push("ينتفع بجراية");
    if (bits.length) return bits.join("، ");
    return m.health || "عادية";
  }

  /* رقم ملف تلقائي تسلسلي للمنتفع: م-YYYY-NNN */
  function nextFileNo() {
    var year = new Date().getFullYear();
    var n = DB.all(COLL).reduce(function (mx, x) {
      var mt = (x.fileNo || "").match(/-(\d+)$/);
      return mt ? Math.max(mx, parseInt(mt[1], 10)) : mx;
    }, 0);
    return "م-" + year + "-" + ("000" + (n + 1)).slice(-3);
  }

  /* ============ القائمة ============ */
  App.views.members = function (container, params) {
    if (params && params.id) return detail(container, params.id);
    var state = { q: "", filter: "active", fam: "" };

    function rows() {
      var list = DB.all(COLL).filter(function (m) { return state.filter === "archived" ? m.archived : !m.archived; });
      if (state.fam) list = list.filter(function (m) { return m.familyId === state.fam; });
      if (state.q) list = list.filter(function (m) {
        return U.match(m, state.q, ["firstName", "lastName", "nickname", "fileNo", "relation", "grade", "work", "cin", "phone"]) ||
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
            '<td><span class="tag gray">' + U.esc(m.fileNo || "—") + "</span></td>" +
            '<td><a href="#" data-open="' + m.id + '" style="font-weight:800">' + U.esc(fullName(m)) + "</a></td>" +
            '<td><a href="#" data-fam="' + U.esc(m.familyId || "") + '">' + U.esc(famName(m.familyId) || "—") + "</a></td>" +
            "<td>" + relTag(m) + "</td>" +
            '<td style="text-align:center">' + (m.dob && U.age(m.dob) !== "" ? U.age(m.dob) + " سنة" : "—") + "</td>" +
            "<td>" + U.esc(healthSummary(m)) + "</td>" +
            '<td><div class="t-actions">' +
              '<button class="icon-btn" data-open="' + m.id + '" title="عرض">👁️</button>' +
              '<button class="icon-btn" data-edit="' + m.id + '" title="تعديل">✏️</button>' +
              '<button class="icon-btn" data-arch="' + m.id + '" title="' + (m.archived ? "استرجاع" : "أرشفة") + '">' + (m.archived ? "♻️" : "📥") + "</button>" +
              '<button class="icon-btn danger" data-del="' + m.id + '" title="حذف">🗑️</button>' +
            "</div></td></tr>";
        }).join("");
        body = '<div class="table-wrap"><table><thead><tr>' +
          "<th>رقم الملف</th><th>الاسم واللقب</th><th>العائلة</th><th>الصلة</th><th>العمر</th><th>الحالة الصحية</th><th>إجراءات</th>" +
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
          '<button class="btn secondary" id="mPrintList"><span class="ico">🖨️</span> طباعة القائمة</button>' +
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
      document.getElementById("mPrintList").onclick = function () {
        var l = rows();
        if (!l.length) return U.toast("لا توجد بيانات للطباعة", "info");
        U.printTable("قائمة المنتفعين", ["رقم الملف", "الاسم واللقب", "العائلة", "الصلة", "العمر", "الحالة الصحية"],
          l.map(function (m) {
            return [m.fileNo || "—", fullName(m), famName(m.familyId) || "—", m.relation || "—",
              (m.dob && U.age(m.dob) !== "" ? U.age(m.dob) + " سنة" : "—"), healthSummary(m)];
          }), { subtitle: "المنتفعون" + (state.fam ? " — عائلة: " + famName(state.fam) : "") });
      };
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
        { label: "رقم الملف", key: "fileNo" },
        { label: "الاسم", key: "firstName" }, { label: "اللقب", key: "lastName" }, { label: "الكنية", key: "nickname" },
        { label: "العائلة", get: function (m) { return famName(m.familyId); } },
        { label: "الصلة", key: "relation" }, { label: "ب.ت.و", key: "cin" },
        { label: "تاريخ الولادة", key: "dob" },
        { label: "العمر", get: function (m) { return m.dob ? U.age(m.dob) : ""; } },
        { label: "مكان الولادة", key: "birthPlace" }, { label: "الهاتف", key: "phone" },
        { label: "رقم الضمان", key: "ssn" }, { label: "التغطية الاجتماعية", key: "coverage" },
        { label: "الحالة العائلية", key: "marital" }, { label: "نوع العائلة", key: "familyType" },
        { label: "صنف الحالة", key: "category" },
        { label: "الحالة الصحية", get: healthSummary },
        { label: "العمل", key: "work" }, { label: "تقدير الدخل", key: "income" },
        { label: "السكن", key: "housing" }, { label: "العنوان", key: "address" }
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

    var healthBits = [];
    if (m.chronic) healthBits.push('<span class="tag amber">مرض مزمن: ' + U.esc(m.chronicType || "غير محدّد") + "</span>");
    if (m.disabled) healthBits.push('<span class="tag red">إعاقة: ' + U.esc(m.disabilityType || "غير محدّد") + "</span>");
    if (m.pension) healthBits.push('<span class="tag green">ينتفع بجراية</span>');
    if (!healthBits.length) healthBits.push('<span class="tag gray">' + U.esc(m.health || "لا يوجد") + "</span>");

    container.innerHTML =
      '<div class="toolbar no-print">' +
        '<button class="btn ghost" id="mBack">→ رجوع للقائمة</button><div class="spacer" style="flex:1"></div>' +
        '<button class="btn secondary" id="mPrint"><span class="ico">🖨️</span> طباعة البطاقة</button>' +
        '<button class="btn" id="mEdit"><span class="ico">✏️</span> تعديل</button>' +
      "</div>" +
      '<div class="detail-grid">' +
        '<div class="card profile-card"><div class="card-body">' +
          '<div class="profile-avatar" style="background:linear-gradient(135deg,var(--gold-500),var(--gold-600))">' + U.esc(U.initials(m.firstName, m.lastName)) + "</div>" +
          '<div class="pname">' + U.esc(fullName(m)) + "</div>" +
          '<div class="pfile">رقم الملف: ' + U.esc(m.fileNo || "—") + "</div>" +
          '<div style="margin-top:10px">' + relTag(m) + (m.archived ? ' <span class="tag gray">مؤرشف</span>' : "") + "</div>" +
          '<div style="margin-top:16px;border-top:1px solid var(--line);padding-top:14px;text-align:right"><div class="info-list one">' +
            info("العائلة", m.familyId ? '<a href="#" id="mGoFam">' + U.esc(famName(m.familyId)) + "</a>" : "—") +
            info("الهاتف", U.esc(m.phone)) +
            info("ب.ت.و", U.esc(m.cin)) +
            info("تاريخ الولادة", m.dob ? U.fmtDate(m.dob) + (U.age(m.dob) !== "" ? " (" + U.age(m.dob) + " سنة)" : "") : "—") +
            info("مكان الولادة", U.esc(m.birthPlace)) +
            info("العنوان", U.esc(m.address) + (m.postal ? " — " + U.esc(m.postal) : "")) +
          "</div></div>" +
        "</div></div>" +
        "<div>" +
          '<div class="card mb-16"><div class="card-head"><h3>👤 الوضعية العائلية والصحية</h3></div><div class="card-body"><div class="info-list">' +
            info("الصلة بالعائلة", U.esc(m.relation)) +
            info("الحالة العائلية", U.esc(m.marital)) +
            info("نوع العائلة", U.esc(m.familyType)) +
            info("صنف الحالة", U.esc(m.category)) +
            info("الحالة الصحية", healthBits.join(" ")) +
            info("الضمان الاجتماعي", U.esc(m.ssn) + (m.cardExpiry ? " — صلوحية: " + U.fmtDate(m.cardExpiry) : "")) +
            info("التغطية الاجتماعية", U.esc(m.coverage)) +
          "</div></div></div>" +
          '<div class="card"><div class="card-head"><h3>💼 الوضعية المادية والسكن والدراسة</h3></div><div class="card-body"><div class="info-list">' +
            info("المستوى الدراسي", U.esc(m.grade)) +
            info("العمل", U.esc(m.work)) +
            info("تقدير الدخل الشهري", m.income ? U.fmtMoney(m.income) : "—") +
            info("مداخيل أخرى", U.esc(m.otherIncome)) +
            info("نوع السكن", U.esc(m.housing) + (m.rent ? " — كراء: " + U.fmtMoney(m.rent) : "")) +
            info("العون المكلّف", U.esc(m.agent)) +
            info("تاريخ الإدماج", m.joinDate ? U.fmtDate(m.joinDate) : U.fmtDate(m.createdAt)) +
          "</div>" +
          (m.notes ? '<div style="margin-top:12px"><div class="k" style="font-size:12px;color:var(--muted);font-weight:700">توصيف الحالة</div><div>' + U.esc(m.notes) + "</div></div>" : "") +
          "</div></div>" +
        "</div>" +
      "</div>";

    document.getElementById("mBack").onclick = function () { App.navigate("members"); };
    document.getElementById("mPrint").onclick = function () { printMember(id); };
    document.getElementById("mEdit").onclick = function () { App.memberForm(null, function () { detail(container, id); }, id); };
    var goFam = document.getElementById("mGoFam");
    if (goFam) goFam.onclick = function (e) { e.preventDefault(); App.navigate("beneficiaries", { id: m.familyId }); };
  }

  /* ============ النموذج (نفس حقول استمارة العائلة بالضبط + ربط بالعائلة) ============ */
  function chip(name, val, current) {
    return '<label class="radio-chip"><input type="radio" data-f="' + name + '" name="' + name + '" value="' + U.esc(val) + '"' +
      (current === val ? " checked" : "") + '><span>' + U.esc(val) + "</span></label>";
  }

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
      ? '<input type="hidden" data-f="familyId" value="' + U.esc(fid) + '"><div class="field"><label>العائلة</label><input value="' + U.esc(famName(fid)) + '" disabled></div>'
      : '<div class="field"><label>العائلة <span class="req">*</span></label><select data-f="familyId"><option value="">— اختر العائلة —</option>' +
        fams.map(function (b) { return '<option value="' + b.id + '"' + (fid === b.id ? " selected" : "") + ">" + U.esc(famName(b.id)) + " — " + U.esc(b.fileNo || "") + "</option>"; }).join("") + "</select></div>";

    var body =
      '<div class="form-grid">' +
        famPick +
        '<div class="field"><label>الصلة بالعائلة</label><select data-f="relation">' + opts(RELATION, m.relation) + "</select></div>" +
        '<div class="field"><label>رقم الملف</label><input data-f="fileNo" value="' + U.esc(m.fileNo || nextFileNo()) + '"></div>' +
        '<div class="field"><label>العون المكلّف بالمسك</label><input data-f="agent" value="' + U.esc(m.agent || "") + '" placeholder="اسم العون"></div>' +
      "</div>" +

      '<fieldset class="fieldset"><legend>① المعطيات الشخصية</legend><div class="form-grid">' +
        '<div class="field"><label>الاسم <span class="req">*</span></label><input data-f="firstName" value="' + U.esc(m.firstName || "") + '" required></div>' +
        '<div class="field"><label>اللقب</label><input data-f="lastName" value="' + U.esc(m.lastName || "") + '"></div>' +
        '<div class="field"><label>الكنية</label><input data-f="nickname" value="' + U.esc(m.nickname || "") + '" placeholder="إن وُجدت عند تشابه الأسماء"></div>' +
        '<div class="field"><label>رقم ب.ت.و</label><input data-f="cin" value="' + U.esc(m.cin || "") + '" inputmode="numeric"></div>' +
        '<div class="field"><label>تاريخ الولادة</label><input type="date" data-f="dob" value="' + U.esc(m.dob || "") + '"></div>' +
        '<div class="field"><label>مكان الولادة</label><input data-f="birthPlace" value="' + U.esc(m.birthPlace || "") + '"></div>' +
        '<div class="field"><label>الهاتف</label><input data-f="phone" value="' + U.esc(m.phone || "") + '" inputmode="tel"></div>' +
      "</div></fieldset>" +

      '<fieldset class="fieldset"><legend>② الضمان والتغطية الاجتماعية</legend><div class="form-grid">' +
        '<div class="field"><label>رقم الضمان الاجتماعي</label><input data-f="ssn" value="' + U.esc(m.ssn || "") + '"></div>' +
        '<div class="field"><label>صلوحية البطاقة (تاريخ الانتهاء)</label><input type="date" data-f="cardExpiry" value="' + U.esc(m.cardExpiry || "") + '"></div>' +
        '<div class="field full"><label>نوع التغطية الاجتماعية</label><select data-f="coverage">' + opts(COVERAGE, m.coverage) + "</select></div>" +
      "</div></fieldset>" +

      '<fieldset class="fieldset"><legend>③ الوضعية العائلية</legend>' +
        '<div class="field"><label>الحالة العائلية</label><div class="radio-row">' + MARITAL.map(function (x) { return chip("marital", x, m.marital); }).join("") + "</div></div>" +
        '<div class="form-grid" style="margin-top:12px">' +
          '<div class="field"><label>نوع العائلة</label><select data-f="familyType">' + opts(FAMILY_TYPE, m.familyType) + "</select></div>" +
          '<div class="field"><label>صنف الحالة (الأولوية)</label><select data-f="category">' + opts(CATEGORY, m.category) + "</select></div>" +
          '<div class="field"><label>عدد الأفراد بالعائلة</label><input type="number" min="1" data-f="members" value="' + U.esc(m.members || "") + '"></div>' +
        "</div>" +
      "</fieldset>" +

      '<fieldset class="fieldset"><legend>④ الحالة الصحية</legend>' +
        '<div class="form-grid">' +
          '<div class="field"><label class="check-inline"><input type="checkbox" data-f="chronic" id="chk_chronic"' + (m.chronic ? " checked" : "") + "> مريض مزمن</label>" +
            '<input data-f="chronicType" placeholder="نوع المرض: سكري، ضغط، تنفّس…" value="' + U.esc(m.chronicType || "") + '"></div>' +
          '<div class="field"><label class="check-inline"><input type="checkbox" data-f="disabled" id="chk_dis"' + (m.disabled ? " checked" : "") + "> ذو إعاقة</label>" +
            '<input data-f="disabilityType" placeholder="نوع الإعاقة" value="' + U.esc(m.disabilityType || "") + '"></div>' +
          '<div class="field full"><label class="check-inline"><input type="checkbox" data-f="pension"' + (m.pension ? " checked" : "") + "> ينتفع بجراية (منحة)</label></div>" +
        "</div>" +
      "</fieldset>" +

      '<fieldset class="fieldset"><legend>⑤ الوضعية المادية والدراسة</legend><div class="form-grid">' +
        '<div class="field"><label>المستوى الدراسي</label><input data-f="grade" value="' + U.esc(m.grade || "") + '" placeholder="تلميذ/سنة…"></div>' +
        '<div class="field"><label>العمل / المهنة</label><select data-f="work">' + opts(WORK, m.work) + "</select></div>" +
        '<div class="field"><label>تقدير الدخل الشهري</label><input type="number" step="0.001" min="0" data-f="income" value="' + U.esc(m.income || "") + '"></div>' +
        '<div class="field full"><label>مداخيل أخرى</label><input data-f="otherIncome" value="' + U.esc(m.otherIncome || "") + '" placeholder="مصدر ومقدار المداخيل الأخرى"></div>' +
      "</div></fieldset>" +

      '<fieldset class="fieldset"><legend>⑥ السكن والعنوان</legend><div class="form-grid">' +
        '<div class="field full"><label>العنوان</label><input data-f="address" value="' + U.esc(m.address || "") + '"></div>' +
        '<div class="field"><label>الترقيم البريدي</label><input data-f="postal" value="' + U.esc(m.postal || "") + '" inputmode="numeric"></div>' +
        '<div class="field"><label>نوع المسكن</label><select data-f="housing" id="housingSel">' + opts(HOUSING, m.housing) + "</select></div>" +
        '<div class="field full" id="rentWrap" style="display:none"><label>تقدير ثمن الكراء (شهرياً)</label><input type="number" step="0.001" min="0" data-f="rent" value="' + U.esc(m.rent || "") + '"></div>' +
      "</div></fieldset>" +

      '<fieldset class="fieldset"><legend>⑦ الملف</legend><div class="form-grid">' +
        '<div class="field"><label>تاريخ الإدماج / التحيين</label><input type="date" data-f="joinDate" value="' + U.esc(m.joinDate || U.today()) + '"></div>' +
        '<div class="field full"><label>توصيف الحالة</label><textarea data-f="notes" placeholder="وصف موجز للحالة والاحتياجات">' + U.esc(m.notes || "") + "</textarea></div>" +
      "</div></fieldset>";

    U.openModal({
      title: isNew ? "إضافة منتفع" : "تعديل المنتفع: " + fullName(m),
      wide: true,
      body: body,
      footer: '<button class="btn" id="mSave"><span class="ico">💾</span> حفظ</button><button class="btn secondary" id="mCancel">إلغاء</button>',
      onOpen: function (root) {
        // إظهار حقل الكراء عند اختيار إيجار
        var hs = root.querySelector("#housingSel"), rentWrap = root.querySelector("#rentWrap");
        function toggleRent() { rentWrap.style.display = hs.value === "إيجار" ? "" : "none"; }
        hs.onchange = toggleRent; toggleRent();

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

  /* ============ طباعة بطاقة المنتفع ============ */
  function printMember(id) {
    var m = DB.get(COLL, id);
    if (!m) return;
    function r(k, v) { return "<div><b>" + k + ":</b> " + U.esc(v || "—") + "</div>"; }
    var html =
      "<h2>بطاقة منتفع — رقم الملف: " + U.esc(m.fileNo || "—") + "</h2>" +
      '<div class="kv">' +
        r("الاسم واللقب", fullName(m)) + r("العائلة", famName(m.familyId)) +
        r("الصلة بالعائلة", m.relation) + r("ب.ت.و", m.cin) +
        r("تاريخ ومكان الولادة", U.fmtDate(m.dob) + " — " + (m.birthPlace || "")) + r("الهاتف", m.phone) +
        r("الحالة العائلية", m.marital) + r("نوع العائلة", m.familyType) +
        r("صنف الحالة", m.category) + r("الضمان الاجتماعي", m.ssn) +
        r("صلوحية البطاقة", m.cardExpiry ? U.fmtDate(m.cardExpiry) : "—") + r("التغطية الاجتماعية", m.coverage) +
        r("الحالة الصحية", healthSummary(m)) + r("المستوى الدراسي", m.grade) +
        r("العمل", m.work) + r("تقدير الدخل", m.income ? U.fmtMoney(m.income) : "—") +
        r("السكن", (m.housing || "") + (m.rent ? " — كراء " + U.fmtMoney(m.rent) : "")) + r("العنوان", (m.address || "") + " " + (m.postal || "")) +
      "</div>" +
      (m.notes ? "<h2>توصيف الحالة</h2><p>" + U.esc(m.notes) + "</p>" : "") +
      '<div class="sign"><div><div class="line">إمضاء العون المكلّف</div></div><div><div class="line">إمضاء رئيس اللجنة</div></div></div>';
    U.printHTML("بطاقة منتفع — " + fullName(m), html);
  }

  /* أفراد عائلة معيّنة (غير المؤرشفين) */
  App.familyMembers = function (familyId, includeArchived) {
    return DB.where(COLL, "familyId", familyId).filter(function (m) { return includeArchived || !m.archived; });
  };
  App.memberFullName = fullName;
})(window);
