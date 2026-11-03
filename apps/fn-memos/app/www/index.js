(function () {
  "use strict";

  var API = "/cgi/ThirdParty/fn-memos/api.cgi";

  // 国际化入口（i18n.js 先于本文件加载）
  var I18N = window.MemosI18N;
  function t(key) {
    return I18N ? I18N.t(key) : key;
  }

  // 记住最近一次检测结果，语言切换后据此重绘状态徽标（避免丢失「可升级 / 已是最新」）
  var lastState = { hasUpdate: null, hasBoth: false, checking: false, upgrading: false };

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
    // 时间格式跟随当前语言，避免英文界面出现中文格式
    var locale = I18N ? I18N.getLang() : undefined;
    var time = new Date().toLocaleTimeString(locale, { hour12: false });
    area.textContent += "[" + time + "] " + msg + "\n";
    area.scrollTop = area.scrollHeight;
  }

  function spinnerHtml(label) {
    var s = document.createElement("span");
    s.className = "spinner";
    return s.outerHTML + " " + label;
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

    lastState.checking = true;
    checkBtn.disabled = true;
    setEl("checkBtn", spinnerHtml(t("checking")));
    statusRow.style.display = "none";

    var data = await api("check");

    lastState.checking = false;
    setEl("currentVersion", data.current_version || t("notDetected"));
    setEl("latestVersion", data.latest_version || t("fetchFailed"));

    if (data.error) {
      createDialog(t("checkFailedTitle"), data.error, {
        icon: "❌",
        buttons: [{ label: t("ok"), class: "btn-default" }],
      });
      checkBtn.disabled = false;
      setEl("checkBtn", t("checkUpdate"));
      return;
    }

    var upgradeBtn = $("upgradeBtn");
    lastState.hasUpdate = !!data.has_update;
    lastState.hasBoth = !!(data.current_version && data.latest_version);

    if (data.has_update) {
      upgradeBtn.disabled = false;
      statusRow.style.display = "flex";
      setEl(
        "upgradeStatus",
        '<span class="badge badge-upgrade">' + t("canUpgrade") + "</span>",
      );
    } else if (lastState.hasBoth) {
      upgradeBtn.disabled = true;
      statusRow.style.display = "flex";
      setEl(
        "upgradeStatus",
        '<span class="badge badge-latest">' + t("upToDate") + "</span>",
      );
    } else {
      upgradeBtn.disabled = true;
    }

    checkBtn.disabled = false;
    setEl("checkBtn", t("checkUpdate"));
  }

  function doUpgrade() {
    createDialog(t("confirmUpgradeTitle"), t("confirmUpgradeBody"), {
      icon: "⬆️",
      buttons: [
        { label: t("cancel"), class: "btn-default", action: null },
        { label: t("confirmUpgradeBtn"), class: "btn-primary", action: performUpgrade },
      ],
    });
  }

  async function performUpgrade() {
    var upgradeBtn = $("upgradeBtn");
    var checkBtn = $("checkBtn");
    var logArea = $("logArea");

    logArea.style.display = "block";
    logArea.textContent = "";

    lastState.upgrading = true;
    upgradeBtn.disabled = true;
    upgradeBtn.innerHTML = spinnerHtml(t("upgrading"));
    checkBtn.disabled = true;

    log(t("upgradeStartLog"));

    // 服务端已包含：下载 → 替换 → 授权
    var data = await api("upgrade");

    lastState.upgrading = false;

    if (data.success) {
      log(data.message || t("upgradeDoneLog"));
      createDialog(t("upgradeDoneTitle"), data.message || t("upgradeDoneLog"), {
        icon: "✅",
        buttons: [
          {
            label: t("ok"),
            class: "btn-primary",
            action: function () {
              checkVersion();
            },
          },
        ],
      });
    } else {
      log(t("upgradeFailedLogPrefix") + (data.message || t("unknownError")));
      createDialog(
        t("upgradeFailedTitle"),
        data.message || t("upgradeFailedBody"),
        {
          icon: "❌",
          buttons: [{ label: t("ok"), class: "btn-default" }],
        },
      );
    }

    upgradeBtn.disabled = false;
    setEl("upgradeBtn", t("upgrade"));
    checkBtn.disabled = false;
  }

  // --- 语言切换后的重绘 ---

  function relocalize() {
    // 静态文案由 i18n.js 的 applyI18n 处理，这里只补动态生成的部分：
    // 按钮上的「检查中/升级中」、状态徽标、以及已显示的版本占位文案。
    if (lastState.checking) {
      setEl("checkBtn", spinnerHtml(t("checking")));
    } else {
      setEl("checkBtn", t("checkUpdate"));
    }

    if (lastState.upgrading) {
      setEl("upgradeBtn", spinnerHtml(t("upgrading")));
    } else {
      setEl("upgradeBtn", t("upgrade"));
    }

    var cur = $("currentVersion");
    if (cur && cur.querySelector(".spinner")) {
      setEl("currentVersion", spinnerHtml(t("detecting")));
    }
    var lat = $("latestVersion");
    if (lat && lat.querySelector(".spinner")) {
      setEl("latestVersion", spinnerHtml(t("detecting")));
    }

    if (lastState.hasUpdate === true) {
      setEl(
        "upgradeStatus",
        '<span class="badge badge-upgrade">' + t("canUpgrade") + "</span>",
      );
    } else if (lastState.hasUpdate === false && lastState.hasBoth) {
      setEl(
        "upgradeStatus",
        '<span class="badge badge-latest">' + t("upToDate") + "</span>",
      );
    }
  }

  // --- Init ---

  window.checkVersion = checkVersion;
  window.doUpgrade = doUpgrade;

  if (I18N) {
    I18N.applyI18n();
    I18N.mountSelect($("langSelect"));
    document.addEventListener("memos:langchange", relocalize);
  }

  checkVersion();
})();
