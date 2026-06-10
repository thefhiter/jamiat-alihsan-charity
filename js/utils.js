/* =================================================================
   utils.js — أدوات مساعدة عامة (تنسيق، نوافذ، تنبيهات، طباعة)
   ================================================================= */
(function (global) {
  "use strict";

  var U = {};

  /* ----- تأمين النصوص ضد HTML ----- */
  U.esc = function (s) {
    if (s === null || s === undefined) return "";
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  };

  /* ----- التاريخ ----- */
  U.today = function () { return new Date().toISOString().slice(0, 10); };

  U.fmtDate = function (iso) {
    if (!iso) return "—";
    var d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
    if (isNaN(d)) return U.esc(iso);
    var dd = ("0" + d.getDate()).slice(-2);
    var mm = ("0" + (d.getMonth() + 1)).slice(-2);
    return dd + "/" + mm + "/" + d.getFullYear();
  };

  U.age = function (iso) {
    if (!iso) return "";
    var d = new Date(iso); if (isNaN(d)) return "";
    var diff = Date.now() - d.getTime();
    var a = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
    return a >= 0 && a < 130 ? a : "";
  };

  /* ----- المال ----- */
  U.fmtMoney = function (n) {
    var v = parseFloat(n) || 0;
    var cur = (global.DB && DB.settings().currency) || "د.ت";
    return v.toLocaleString("ar-TN", { minimumFractionDigits: v % 1 ? 3 : 0, maximumFractionDigits: 3 }) + " " + cur;
  };
  U.fmtNum = function (n) { return (parseFloat(n) || 0).toLocaleString("ar-TN"); };

  /* ----- الأحرف الأولى للصورة الرمزية ----- */
  U.initials = function (name, last) {
    var a = (name || "").trim().charAt(0);
    var b = (last || "").trim().charAt(0);
    return (a + b) || "؟";
  };

  /* ----- التنبيهات (Toast) ----- */
  U.toast = function (msg, type) {
    type = type || "success";
    var wrap = document.getElementById("toastWrap");
    if (!wrap) { wrap = document.createElement("div"); wrap.id = "toastWrap"; wrap.className = "toast-wrap"; document.body.appendChild(wrap); }
    var icons = { success: "✅", error: "⛔", info: "ℹ️" };
    var t = document.createElement("div");
    t.className = "toast " + type;
    t.innerHTML = '<span class="ti">' + (icons[type] || "✅") + '</span><span>' + U.esc(msg) + "</span>";
    wrap.appendChild(t);
    setTimeout(function () {
      t.style.transition = "opacity .3s, transform .3s";
      t.style.opacity = "0"; t.style.transform = "translateX(-10px)";
      setTimeout(function () { t.remove(); }, 320);
    }, 3200);
  };

  /* ----- النوافذ المنبثقة (Modal) ----- */
  var overlay;
  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "modalOverlay";
    overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) U.closeModal(); });
    document.body.appendChild(overlay);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") U.closeModal(); });
    return overlay;
  }

  U.openModal = function (opts) {
    ensureOverlay();
    var wide = opts.wide ? " wide" : "";
    overlay.innerHTML =
      '<div class="modal' + wide + '" role="dialog" aria-modal="true">' +
        '<div class="modal-head"><h3>' + U.esc(opts.title) + '</h3><div class="spacer"></div>' +
          '<button class="modal-close" id="mClose" title="إغلاق">✕</button></div>' +
        '<div class="modal-body" id="mBody">' + opts.body + "</div>" +
        (opts.footer ? '<div class="modal-foot" id="mFoot">' + opts.footer + "</div>" : "") +
      "</div>";
    overlay.classList.add("open");
    document.getElementById("mClose").onclick = U.closeModal;
    // نمرّر عنصر النافذة بالكامل (الجسم + التذييل) ليتمكّن onOpen من ربط أزرار الحفظ/الإلغاء في التذييل
    if (typeof opts.onOpen === "function") opts.onOpen(overlay.querySelector(".modal"));
  };

  U.closeModal = function () {
    if (overlay) { overlay.classList.remove("open"); overlay.innerHTML = ""; }
  };

  /* ----- تأكيد ----- */
  U.confirm = function (opts) {
    var danger = opts.danger ? "danger" : "";
    U.openModal({
      title: opts.title || "تأكيد",
      body: '<p style="font-size:15px;margin:4px 0 0">' + U.esc(opts.message) + "</p>",
      footer:
        '<button class="btn ' + danger + '" id="cfOk">' + U.esc(opts.okText || "نعم، متابعة") + "</button>" +
        '<button class="btn secondary" id="cfCancel">إلغاء</button>',
      onOpen: function () {
        document.getElementById("cfOk").onclick = function () { U.closeModal(); opts.onOk && opts.onOk(); };
        document.getElementById("cfCancel").onclick = U.closeModal;
      }
    });
  };

  /* ----- قراءة قيم النموذج ----- */
  U.formData = function (root) {
    var out = {};
    root.querySelectorAll("[data-f]").forEach(function (el) {
      var k = el.getAttribute("data-f");
      if (el.type === "checkbox") out[k] = el.checked;
      else if (el.type === "radio") { if (el.checked) out[k] = el.value; }
      else out[k] = el.value.trim();
    });
    return out;
  };

  /* ----- بحث نصّي بسيط ----- */
  U.match = function (obj, q, fields) {
    if (!q) return true;
    q = q.toLowerCase();
    return fields.some(function (f) {
      var v = obj[f]; return v && String(v).toLowerCase().indexOf(q) !== -1;
    });
  };

  /* ----- debounce ----- */
  U.debounce = function (fn, ms) {
    var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms || 200); };
  };

  /* ----- تنزيل ملف ----- */
  U.download = function (filename, content, mime) {
    var blob = new Blob(["﻿" + content], { type: (mime || "text/plain") + ";charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  };

  /* ----- تصدير CSV ----- */
  U.toCSV = function (rows, headers) {
    function cell(v) {
      v = (v === null || v === undefined) ? "" : String(v);
      if (/[",\n;]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
      return v;
    }
    var lines = [headers.map(function (h) { return cell(h.label); }).join(",")];
    rows.forEach(function (r) {
      lines.push(headers.map(function (h) { return cell(typeof h.get === "function" ? h.get(r) : r[h.key]); }).join(","));
    });
    return lines.join("\r\n");
  };

  /* ----- الطباعة (نافذة مستقلّة) ----- */
  U.printHTML = function (title, innerHTML) {
    var s = (global.DB && DB.settings()) || {};
    var w = window.open("", "_blank", "width=900,height=700");
    if (!w) { U.toast("يُرجى السماح بالنوافذ المنبثقة للطباعة", "error"); return; }
    w.document.write(
      '<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>' + U.esc(title) + "</title>" +
      "<style>" +
      "body{font-family:'Cairo','Segoe UI',Tahoma,sans-serif;color:#1f2a28;padding:28px;direction:rtl}" +
      ".ph{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1b6b4f;padding-bottom:12px;margin-bottom:18px}" +
      ".ph h1{font-size:20px;margin:0;color:#0f3d2e}.ph .b{color:#647067;font-size:13px}" +
      ".ph .meta{text-align:left;font-size:12px;color:#647067}" +
      "h2{font-size:17px;color:#14513c;border-bottom:1px solid #dfe7e2;padding-bottom:6px;margin:22px 0 10px}" +
      "table{width:100%;border-collapse:collapse;margin:8px 0;font-size:13px}" +
      "th,td{border:1px solid #cdd8d1;padding:7px 9px;text-align:right}th{background:#eef6f1;color:#0f3d2e}" +
      ".kv{display:grid;grid-template-columns:1fr 1fr;gap:6px 22px;font-size:14px;margin:6px 0}" +
      ".kv div{padding:4px 0;border-bottom:1px dotted #dfe7e2}.kv b{color:#14513c}" +
      ".sign{display:flex;justify-content:space-between;margin-top:48px;font-size:13px}" +
      ".sign div{text-align:center;width:40%}.sign .line{border-top:1px solid #333;margin-top:40px;padding-top:5px}" +
      ".foot{margin-top:30px;text-align:center;color:#9aa8a0;font-size:11px;border-top:1px solid #dfe7e2;padding-top:8px}" +
      "@media print{body{padding:6px}}" +
      "</style></head><body>" +
      '<div class="ph"><div><h1>' + U.esc(s.orgName || "جمعية الإحسان الخيرية") + "</h1>" +
        '<div class="b">' + U.esc(s.orgBranch || "") + "</div></div>" +
        '<div class="meta">' + U.esc(title) + "<br>تاريخ الطباعة: " + U.fmtDate(U.today()) + "</div></div>" +
      innerHTML +
      '<div class="foot">وثيقة صادرة عن نظام إدارة ' + U.esc(s.orgName || "الجمعية") + "</div>" +
      "</body></html>"
    );
    w.document.close();
    setTimeout(function () { w.focus(); w.print(); }, 350);
  };

  /* ----- طباعة قائمة/جدول عام ----- */
  U.printTable = function (title, headers, rows, opts) {
    opts = opts || {};
    var thead = "<tr>" + headers.map(function (h) { return "<th>" + U.esc(h) + "</th>"; }).join("") + "</tr>";
    var tbody = rows.length
      ? rows.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + U.esc(c == null ? "" : c) + "</td>"; }).join("") + "</tr>"; }).join("")
      : '<tr><td colspan="' + headers.length + '" style="text-align:center;color:#647067;padding:14px">لا توجد بيانات</td></tr>';
    var count = '<div style="margin:2px 0 10px;color:#647067;font-size:13px">عدد السجلّات: ' + U.fmtNum(rows.length) + "</div>";
    var foot = opts.footer ? '<div style="margin-top:12px;font-weight:700;color:#14513c">' + U.esc(opts.footer) + "</div>" : "";
    U.printHTML(title, (opts.subtitle ? "<h2>" + U.esc(opts.subtitle) + "</h2>" : "") + count + "<table><thead>" + thead + "</thead><tbody>" + tbody + "</tbody></table>" + foot);
  };

  global.U = U;
})(window);
