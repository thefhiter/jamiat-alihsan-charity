/* =================================================================
   search.js — البحث الشامل (عائلات + أفراد + متبرّعون)
   شريط بحث في الأعلى يجد أيّ عائلة أو فرد (ابن/مكفول) أو متبرّع
   من أيّ قسم، مع لوحة نتائج قابلة للتنقّل بالفأرة أو لوحة المفاتيح.
   ================================================================= */
(function (global) {
  "use strict";
  var App = global.App || (global.App = { views: {} });
  var MAX = 6;

  function fam(b) { return App.beneficiaryFullName ? App.beneficiaryFullName(b) : [b.firstName, b.lastName].filter(Boolean).join(" "); }
  function don(d) { return App.donorFullName ? App.donorFullName(d) : [d.firstName, d.lastName].filter(Boolean).join(" "); }

  /* محرّك البحث — متاح أيضاً للاستعمال البرمجي/الاختبار */
  function searchAll(q) {
    var res = { families: [], members: [], donors: [] };
    q = (q || "").trim().toLowerCase();
    if (!q) return res;
    DB.all("beneficiaries").forEach(function (b) {
      if (U.match(b, q, ["firstName", "lastName", "nickname", "fileNo", "cin", "phone", "address"])) res.families.push(b);
    });
    DB.all("members").forEach(function (m) {
      if (U.match(m, q, ["firstName", "lastName", "relation", "grade", "work", "cin"])) {
        res.members.push({ m: m, b: m.familyId ? DB.get("beneficiaries", m.familyId) : null });
      }
    });
    DB.all("donors").forEach(function (d) {
      if (U.match(d, q, ["firstName", "lastName", "phone", "type"])) res.donors.push(d);
    });
    return res;
  }
  App.searchAll = searchAll;

  App.initGlobalSearch = function () {
    var wrap = document.getElementById("globalSearch");
    var input = document.getElementById("gsInput");
    var panel = document.getElementById("gsResults");
    if (!wrap || !input || !panel) return;

    var items = [];   // قائمة مسطّحة لكل نتيجة قابلة للفتح
    var active = -1;

    function close() { panel.classList.remove("open"); panel.innerHTML = ""; items = []; active = -1; }
    function go(it) { close(); input.value = ""; input.blur(); it.fn(); if (it.toast) U.toast(it.toast, "info"); }

    function more(n) { return '<div class="gs-more">+ ' + U.fmtNum(n) + " نتيجة أخرى… واصل الكتابة لتضييق البحث</div>"; }
    function item(icoCls, ico, title, sub, tag) {
      var idx = items.length;
      return '<div class="gs-item" data-i="' + idx + '"><div class="gi ' + icoCls + '">' + ico + "</div>" +
        '<div class="gtxt"><div class="gt">' + U.esc(title) + (tag ? ' <span class="tag gray gs-tag">' + tag + "</span>" : "") + "</div>" +
        (sub ? '<div class="gsub">' + sub + "</div>" : "") + "</div></div>";
    }

    function render() {
      var q = input.value.trim();
      items = []; active = -1;
      if (!q) { close(); return; }
      var r = searchAll(q);
      var total = r.families.length + r.members.length + r.donors.length;
      if (!total) {
        panel.innerHTML = '<div class="gs-empty">لا توجد نتائج لـ «' + U.esc(q) + "»</div>";
        panel.classList.add("open"); return;
      }
      var html = "";

      if (r.families.length) {
        html += '<div class="gs-group">👨‍👩‍👧‍👦 العائلات (' + U.fmtNum(r.families.length) + ")</div>";
        r.families.slice(0, MAX).forEach(function (b) {
          var sub = "رقم الملف: " + U.esc(b.fileNo || "—") + (b.phone ? " · ☎ " + U.esc(b.phone) : "");
          html += item("ic-green", "👨‍👩‍👧‍👦", fam(b), sub, b.archived ? "مؤرشف" : "");
          items.push({ fn: function () { App.navigate("beneficiaries", { id: b.id }); } });
        });
        if (r.families.length > MAX) html += more(r.families.length - MAX);
      }

      if (r.members.length) {
        html += '<div class="gs-group">👤 المنتفعون — الأفراد (' + U.fmtNum(r.members.length) + ")</div>";
        r.members.slice(0, MAX).forEach(function (row) {
          var m = row.m;
          var name = App.memberFullName ? App.memberFullName(m) : [m.firstName, m.lastName].filter(Boolean).join(" ");
          var age = m.dob && U.age(m.dob) !== "" ? " · " + U.age(m.dob) + " سنة" : "";
          var famTxt = row.b ? "ضمن عائلة " + U.esc(fam(row.b)) : (m.relation ? U.esc(m.relation) : "منتفع");
          html += item("ic-gold", "👤", name, famTxt + age, m.archived ? "مؤرشف" : "");
          items.push({ fn: function () { App.navigate("members", { id: m.id }); } });
        });
        if (r.members.length > MAX) html += more(r.members.length - MAX);
      }

      if (r.donors.length) {
        html += '<div class="gs-group">🤝 المتبرّعون (' + U.fmtNum(r.donors.length) + ")</div>";
        r.donors.slice(0, MAX).forEach(function (d) {
          var sub = d.phone ? "☎ " + U.esc(d.phone) : U.esc(d.type || "متبرّع");
          html += item("ic-blue", "🤝", don(d), sub, d.archived ? "مؤرشف" : "");
          items.push({ fn: function () { App.navigate("donors", { id: d.id }); } });
        });
        if (r.donors.length > MAX) html += more(r.donors.length - MAX);
      }

      panel.innerHTML = html;
      panel.classList.add("open");
      panel.querySelectorAll(".gs-item").forEach(function (el) {
        el.addEventListener("mousedown", function (e) { e.preventDefault(); }); // منع فقدان التركيز قبل النقر
        el.addEventListener("click", function () { var i = +el.getAttribute("data-i"); if (items[i]) go(items[i]); });
      });
    }

    function highlight() {
      var els = panel.querySelectorAll(".gs-item");
      els.forEach(function (el, i) {
        var on = i === active;
        el.classList.toggle("active", on);
        if (on) el.scrollIntoView({ block: "nearest" });
      });
    }

    var deb = U.debounce(render, 150);
    input.addEventListener("input", deb);
    input.addEventListener("focus", function () { if (input.value.trim()) render(); });
    input.addEventListener("keydown", function (e) {
      var n = items.length;
      if (e.key === "Escape") { close(); input.blur(); }
      else if (e.key === "ArrowDown" && n) { e.preventDefault(); active = (active + 1) % n; highlight(); }
      else if (e.key === "ArrowUp" && n) { e.preventDefault(); active = (active - 1 + n) % n; highlight(); }
      else if (e.key === "Enter" && n) { e.preventDefault(); go(items[active >= 0 ? active : 0]); }
    });
    document.addEventListener("click", function (e) { if (!wrap.contains(e.target)) close(); });
  };
})(window);
