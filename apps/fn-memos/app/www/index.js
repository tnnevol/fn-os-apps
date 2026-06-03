(function () {
  "use strict";

  const API = "/cgi/ThirdParty/fn-memos/api.cgi";
  let hasUpdate = false;

  // --- Dialog component ---

  function createDialog(title, body, options) {
    const existing = document.getElementById("memosDialog");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "memosDialog";
    overlay.className = "dialog-overlay";

    const box = document.createElement("div");
    box.className = "dialog-box";

    const icon = document.createElement("div");
    icon.className = "dialog-icon";
    icon.textContent = options.icon || "ℹ️";

    const titleEl = document.createElement("div");
    titleEl.className = "dialog-title";
    titleEl.textContent = title;

    const bodyEl = document.createElement("div");
    bodyEl.className = "dialog-body";
    bodyEl.textContent = body;

    const actions = document.createElement("div");
    actions.className = "dialog-actions";

    if (options.buttons && options.buttons.length) {
      options.buttons.forEach(function (btn) {
        const el = document.createElement("button");
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

  function setElement(el, text) {
    if (typeof el === "string") el = $(el);
    if (!el) return;
    el.innerHTML = text;
  }

  // --- API calls ---

  async function apiCheck() {
    try {
      const res = await fetch(API + "?action=check", { method: "POST" });
      return await res.json();
    } catch (e) {
      return { current_version: "", latest_version: "", has_update: false, error: e.message };
    }
  }

  async function apiUpgrade() {
    try {
      const res = await fetch(API + "?action=upgrade", { method: "POST" });
      return await res.json();
    } catch (e) {
      return { success: false, message: "请求失败: " + e.message };
    }
  }

  // --- Actions ---

  async function checkVersion() {
    const checkBtn = $("checkBtn");
    const logArea = $("logArea");

    checkBtn.disabled = true;
    setElement("checkBtn", '<span class="spinner"></span> 检查中...');
    setElement("statusRow", null);
    if (logArea) logArea.style.display = "none";

    const data = await apiCheck();

    setElement("currentVersion", data.current_version || "未检测到");
    setElement("latestVersion", data.latest_version || "无法获取");

    if (data.error) {
      createDialog("检查失败", data.error, {
        icon: "❌",
        buttons: [{ label: "确定", class: "btn-default" }],
      });
      checkBtn.disabled = false;
      setElement("checkBtn", "检查更新");
      return;
    }

    const statusRow = $("statusRow");
    const upgradeBtn = $("upgradeBtn");

    if (data.has_update) {
      hasUpdate = true;
      upgradeBtn.disabled = false;
      statusRow.style.display = "flex";
      setElement("upgradeStatus", '<span class="badge badge-upgrade">可升级</span>');
    } else if (data.current_version && data.latest_version) {
      hasUpdate = false;
      upgradeBtn.disabled = true;
      statusRow.style.display = "flex";
      setElement("upgradeStatus", '<span class="badge badge-latest">已是最新</span>');
    } else {
      upgradeBtn.disabled = true;
    }

    checkBtn.disabled = false;
    setElement("checkBtn", "检查更新");
  }

  async function doUpgrade() {
    createDialog(
      "确认升级",
      "确定要将 Memos 升级到最新版本吗？\n升级过程中服务会短暂不可用。",
      {
        icon: "⬆️",
        buttons: [
          {
            label: "取消",
            class: "btn-default",
            action: null,
          },
          {
            label: "确认升级",
            class: "btn-primary",
            action: performUpgrade,
          },
        ],
      }
    );
  }

  async function performUpgrade() {
    const upgradeBtn = $("upgradeBtn");
    const checkBtn = $("checkBtn");
    const logArea = $("logArea");

    upgradeBtn.disabled = true;
    upgradeBtn.innerHTML = '<span class="spinner"></span> 升级中...';
    checkBtn.disabled = true;
    logArea.style.display = "block";
    logArea.className = "status loading";
    logArea.textContent = "正在下载并升级 Memos，请稍候...";

    const data = await apiUpgrade();

    if (data.success) {
      logArea.className = "status success";
      logArea.textContent = data.message || "升级成功！请刷新页面查看新版本号。";
      createDialog("升级成功", data.message || "Memos 已成功升级！", {
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
      logArea.className = "status error";
      logArea.textContent = data.message || "升级失败";
      createDialog("升级失败", data.message || "升级失败，请重试。", {
        icon: "❌",
        buttons: [{ label: "确定", class: "btn-default" }],
      });
      upgradeBtn.disabled = false;
      setElement("upgradeBtn", "升级 Memos");
    }

    checkBtn.disabled = false;
  }

  // --- Init ---

  window.checkVersion = checkVersion;
  window.doUpgrade = doUpgrade;

  checkVersion();
})();
