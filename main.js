/* =================================================================
   main.js — العملية الرئيسية لتطبيق سطح المكتب (Electron)
   تفتح واجهة التطبيق (index.html) في نافذة مستقلّة تعمل دون متصفّح.
   البيانات تُحفظ تلقائياً في ملفّ المستخدم وتبقى بين كل تشغيل.
   ================================================================= */
const { app, BrowserWindow, Menu, shell } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 940,
    minHeight: 600,
    title: "جمعية الإحسان الخيرية — نظام إدارة العائلات والمتبرعين",
    icon: path.join(__dirname, "build", "icon.ico"),
    backgroundColor: "#f4f7f5",
    autoHideMenuBar: true,            // إخفاء شريط القوائم (يظهر بزرّ Alt) مع إبقاء الاختصارات
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  win.loadFile("index.html");

  // قائمة مصغّرة تُبقي اختصارات النسخ/اللصق والعرض تعمل (وتبقى مخفيّة)
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: "تحرير",
      submenu: [
        { role: "undo", label: "تراجع" }, { role: "redo", label: "إعادة" }, { type: "separator" },
        { role: "cut", label: "قص" }, { role: "copy", label: "نسخ" }, { role: "paste", label: "لصق" },
        { role: "selectAll", label: "تحديد الكل" }
      ]
    },
    {
      label: "عرض",
      submenu: [
        { role: "reload", label: "إعادة تحميل" }, { type: "separator" },
        { role: "resetZoom", label: "تكبير 100%" }, { role: "zoomIn", label: "تكبير" }, { role: "zoomOut", label: "تصغير" },
        { type: "separator" }, { role: "togglefullscreen", label: "ملء الشاشة" }
      ]
    }
  ]));

  // نوافذ الطباعة الداخلية مسموحة، والروابط الخارجية تُفتح في المتصفّح
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url || url === "about:blank" || url.startsWith("file:")) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });

  return win;
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
