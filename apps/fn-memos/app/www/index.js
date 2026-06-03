(function () {
  "use strict";

  var API = "/cgi/ThirdParty/fn-memos/api.cgi";

  // --- Dialog ---

  function createDialog(title, body, options) {
    var existing = document.getElementById("memosDialog");
    if (existing) existing.remove();

    var overlay = document.createElement("div");
    overlay.id = "memosDialog";
    overlay.className = "dialog-overlay";

    var box = document.createElement("div");
    box.className = "dialog-box";

    var icon = document.createElement("div");
    icon.className = "dialog-icon";
    icon.textContent = options.icon || "ℹ️";

    var titleEl = document.createElement("div");
    titleEl.className = "dialog-title";
    titleEl.textContent = title;

    var bodyEl = document.createElement("div");
    bodyEl.className = "dialog-body";
    bodyEl.textContent = body;

    var actions = document.createElement("div");
    actions.className = "dialog-actions";

    if (options.buttons && options.buttons.length) {
      options.buttons.forEach(function (btn) {
        var el = document.createElement("button");
        el.className = "btn " + (btn.class || "btn-default");
        el.textContent = btn.label;
        el.onclick = function () {
          overlay.remove();
          if (btn.action) btn.action();
        };
        actions.appendChild(el);
      });
    }

    box.appendChild(icon);
    box.appendChild(titleEl);
    box.appendChild(bodyEl);
    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  // --- UI helpers ---

  function $(id) {
    return document.getElementById(id);
  }

  function setEl(id, html) {
    var el = $(id);
    if (el) el.innerHTML = html;
  }

  function log(msg) {
    var area = $("logArea");
    if (!area) return;
    area.style.display = "block";
    var time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    area.textContent += "[" + time + "] " + msg + "\n";
    area.scrollTop = area.scrollHeight;
  }

  // --- API ---

  async function api(action) {
    try {
      var res = await fetch(API + "?action=" + action, { method: "POST" });
      return await res.json();
    } catch (e) {
      return { error: e.message };
    }
  }

  // --- Actions ---

  async function checkVersion() {
    var checkBtn = $("checkBtn");
    var statusRow = $("statusRow");

    checkBtn.disabled = true;
    setEl("checkBtn", '<span class="spinner"></span> 检查中...');
    statusRow.style.display = "none";

    var data = await api("check");

    setEl("currentVersion", data.current_version || "未检测到");
    setEl("latestVersion", data.latest_version || "无法获取");

    if (data.error) {
      createDialog("检查失败", data.error, {
        icon: "❌",
        buttons: [{ label: "确定", class: "btn-default" }],
      });
      checkBtn.disabled = false;
      setEl("checkBtn", "检查更新");
      return;
    }

    var upgradeBtn = $("upgradeBtn");

    if (data.has_update) {
      upgradeBtn.disabled = false;
      statusRow.style.display = "flex";
      setEl("upgradeStatus", '<span class="badge badge-upgrade">可升级</span>');
    } else if (data.current_version && data.latest_version) {
      upgradeBtn.disabled = true;
      statusRow.style.display = "flex";
      setEl(
        "upgradeStatus",
        '<span class="badge badge-latest">已是最新</span>',
      );
    } else {
      upgradeBtn.disabled = true;
    }

    checkBtn.disabled = false;
    setEl("checkBtn", "检查更新");
  }

  function doUpgrade() {
    createDialog(
      "确认升级",
      "确定要将 Memos 升级到最新版本吗？\n升级完成后需前往应用中心重启应用。",
      {
        icon: "⬆️",
        buttons: [
          { label: "取消", class: "btn-default", action: null },
          { label: "确认升级", class: "btn-primary", action: performUpgrade },
        ],
      },
    );
  }

  async function performUpgrade() {
    var upgradeBtn = $("upgradeBtn");
    var checkBtn = $("checkBtn");
    var logArea = $("logArea");

    logArea.style.display = "block";
    logArea.textContent = "";

    upgradeBtn.disabled = true;
    upgradeBtn.innerHTML = '<span class="spinner"></span> 升级中...';
    checkBtn.disabled = true;

    log("开始升级流程...");

    // 服务端已包含：下载 → 替换 → 授权
    var data = await api("upgrade");

    if (data.success) {
      log(data.message || "升级完成！");
      createDialog("升级完成", data.message, {
        icon: "✅",
        buttons: [
          {
            label: "确定",
            class: "btn-primary",
            action: function () {
              checkVersion();
            },
          },
        ],
      });
    } else {
      log("升级失败: " + (data.message || "未知错误"));
      createDialog("升级失败", data.message || "升级失败，请重试。", {
        icon: "❌",
        buttons: [{ label: "确定", class: "btn-default" }],
      });
    }

    upgradeBtn.disabled = false;
    setEl("upgradeBtn", "升级 Memos");
    checkBtn.disabled = false;
  }

  // --- Init ---

  window.checkVersion = checkVersion;
  window.doUpgrade = doUpgrade;

  checkVersion();
})();
