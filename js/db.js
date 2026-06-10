/* =================================================================
   db.js — طبقة تخزين البيانات (Local Storage)
   تخزّن كل البيانات محلياً في المتصفّح، وتعمل بدون إنترنت أو خادم.
   ================================================================= */
(function (global) {
  "use strict";

  var PREFIX = "ihsan:";
  var COLLECTIONS = ["beneficiaries", "members", "donors", "aid", "donations", "expenses", "incomes", "ihsan"];
  var SCHEMA_VERSION = 1;

  function key(name) { return PREFIX + name; }

  function read(name) {
    try {
      var raw = localStorage.getItem(key(name));
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("DB read error for " + name, e);
      return [];
    }
  }

  function write(name, arr) {
    try {
      localStorage.setItem(key(name), JSON.stringify(arr));
      return true;
    } catch (e) {
      console.error("DB write error for " + name, e);
      alert("تعذّر حفظ البيانات. قد تكون مساحة التخزين ممتلئة. يُرجى أخذ نسخة احتياطية.");
      return false;
    }
  }

  /* مُعرّف فريد بسيط ومقروء */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  var DB = {
    collections: COLLECTIONS,

    all: function (name) { return read(name); },

    get: function (name, id) {
      var arr = read(name);
      for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
      return null;
    },

    /* يرجع السجلات المرتبطة بحقل معيّن (مثلاً مساعدات منتفع) */
    where: function (name, field, value) {
      return read(name).filter(function (r) { return r[field] === value; });
    },

    insert: function (name, obj) {
      var arr = read(name);
      obj.id = obj.id || uid();
      obj.createdAt = obj.createdAt || new Date().toISOString();
      obj.archived = obj.archived || false;
      arr.push(obj);
      write(name, arr);
      return obj;
    },

    update: function (name, id, patch) {
      var arr = read(name);
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].id === id) {
          arr[i] = Object.assign({}, arr[i], patch, { id: id, updatedAt: new Date().toISOString() });
          write(name, arr);
          return arr[i];
        }
      }
      return null;
    },

    remove: function (name, id) {
      var arr = read(name).filter(function (r) { return r.id !== id; });
      write(name, arr);
    },

    /* أرشفة بدل الحذف النهائي (حسب المواصفات: قائمة الأرشيف) */
    setArchived: function (name, id, value) {
      return DB.update(name, id, { archived: value });
    },

    count: function (name, includeArchived) {
      var arr = read(name);
      if (includeArchived) return arr.length;
      return arr.filter(function (r) { return !r.archived; }).length;
    },

    /* مجموع حقل رقمي */
    sum: function (name, field, filterFn) {
      return read(name).reduce(function (s, r) {
        if (filterFn && !filterFn(r)) return s;
        var v = parseFloat(r[field]);
        return s + (isNaN(v) ? 0 : v);
      }, 0);
    },

    /* ----- النسخ الاحتياطي والاسترجاع ----- */
    exportAll: function () {
      var data = { schema: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data: {} };
      COLLECTIONS.forEach(function (c) { data.data[c] = read(c); });
      data.settings = DB.settings();
      return data;
    },

    importAll: function (payload, mode) {
      // mode: "replace" | "merge"
      if (!payload || !payload.data) throw new Error("ملف غير صالح");
      COLLECTIONS.forEach(function (c) {
        var incoming = payload.data[c] || [];
        if (mode === "merge") {
          var existing = read(c);
          var ids = {};
          existing.forEach(function (r) { ids[r.id] = true; });
          incoming.forEach(function (r) { if (!ids[r.id]) existing.push(r); });
          write(c, existing);
        } else {
          write(c, incoming);
        }
      });
      if (payload.settings) DB.saveSettings(payload.settings);
    },

    clearAll: function () {
      COLLECTIONS.forEach(function (c) { localStorage.removeItem(key(c)); });
    },

    /* ----- الإعدادات ----- */
    settings: function () {
      try {
        var raw = localStorage.getItem(key("settings"));
        return Object.assign({
          orgName: "جمعية الإحسان الخيرية",
          orgBranch: "بمنزل النور",
          currency: "د.ت",
          year: new Date().getFullYear()
        }, raw ? JSON.parse(raw) : {});
      } catch (e) { return { orgName: "جمعية الإحسان الخيرية", orgBranch: "بمنزل النور", currency: "د.ت" }; }
    },
    saveSettings: function (s) {
      var merged = Object.assign(DB.settings(), s);
      localStorage.setItem(key("settings"), JSON.stringify(merged));
      return merged;
    },

    /* بذور تجريبية اختيارية لأول تشغيل */
    isEmpty: function () {
      return COLLECTIONS.every(function (c) { return read(c).length === 0; });
    }
  };

  /* -----------------------------------------------------------------
     ترحيل لمرّة واحدة: تحويل «الأبناء/الأفراد» المضمّنين داخل ملفّ العائلة
     (children[]) إلى سجلّات مستقلّة في مجموعة «المنتفعون» (members)،
     مع ربط كل فرد بعائلته. عملية آمنة وقابلة للتكرار (محميّة بعلامة لكل عائلة).
     ----------------------------------------------------------------- */
  function migrateMembers() {
    var fams = read("beneficiaries");
    if (!fams.length) return;
    var members = read("members");
    var membersChanged = false, famsChanged = false;
    fams.forEach(function (b) {
      if (b.childrenMigrated) return;
      (b.children || []).forEach(function (k) {
        if (!k || !k.name) return;
        members.push({
          id: uid(),
          createdAt: new Date().toISOString(),
          archived: false,
          familyId: b.id,
          firstName: k.name,
          lastName: "",
          relation: "ابن / بنت",
          dob: k.dob || "",
          grade: k.grade || "",
          work: k.work || "",
          health: k.health || "عادية"
        });
        membersChanged = true;
      });
      b.childrenMigrated = true;
      famsChanged = true;
    });
    if (membersChanged) write("members", members);
    if (famsChanged) write("beneficiaries", fams);
  }

  try { migrateMembers(); } catch (e) { console.error("members migration failed", e); }

  global.DB = DB;
})(window);
