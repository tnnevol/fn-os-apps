/**
 * Memos 管理面板国际化
 *
 * 语言列表与 apps/fn-memos/i18n/ 下已有的目录保持一致，避免出现
 * 「应用商店元数据有 9 种语言、管理面板只有 1 种」的不一致。
 *
 * 用法：
 *   MemosI18N.t('checkUpdate')          取当前语言的文案
 *   MemosI18N.setLang('en-US')          切换语言（会写入 localStorage 并重绘）
 *   MemosI18N.applyI18n()               重绘所有 data-i18n 节点
 *
 * HTML 里用 data-i18n="key" 标注需要翻译的文本，
 * 用 data-i18n-title="key" 标注需要翻译的 title 属性。
 */
(function () {
  "use strict";

  var STORAGE_KEY = "fn-memos.lang";
  var FALLBACK = "en-US";

  // 各语言的显示名（用该语言自己的写法，便于用户认出母语）
  var LOCALES = [
    { code: "zh-CN", label: "简体中文" },
    { code: "en-US", label: "English" },
    { code: "ja-JP", label: "日本語" },
    { code: "ko-KR", label: "한국어" },
    { code: "de-DE", label: "Deutsch" },
    { code: "fr-FR", label: "Français" },
    { code: "es-ES", label: "Español" },
    { code: "it-IT", label: "Italiano" },
    { code: "ru-RU", label: "Русский" },
  ];

  var DICT = {
    "zh-CN": {
      appTitle: "Memos 升级管理",
      heading: "Memos 管理",
      language: "语言",
      currentVersion: "当前版本",
      latestVersion: "最新版本",
      status: "状态",
      detecting: "检测中...",
      checkUpdate: "检查更新",
      checking: "检查中...",
      upgrade: "升级 Memos",
      upgrading: "升级中...",
      notDetected: "未检测到",
      fetchFailed: "无法获取",
      checkFailedTitle: "检查失败",
      ok: "确定",
      canUpgrade: "可升级",
      upToDate: "已是最新",
      confirmUpgradeTitle: "确认升级",
      confirmUpgradeBody:
        "确定要将 Memos 升级到最新版本吗？\n升级完成后将自动重启服务。",
      cancel: "取消",
      confirmUpgradeBtn: "确认升级",
      upgradeStartLog: "开始升级流程...",
      upgradeDoneLog: "升级完成！",
      upgradeDoneTitle: "升级完成",
      upgradeFailedLogPrefix: "升级失败: ",
      unknownError: "未知错误",
      upgradeFailedTitle: "升级失败",
      upgradeFailedBody: "升级失败，请重试。",
    },
    "en-US": {
      appTitle: "Memos Upgrade Manager",
      heading: "Memos Manager",
      language: "Language",
      currentVersion: "Current version",
      latestVersion: "Latest version",
      status: "Status",
      detecting: "Checking...",
      checkUpdate: "Check for updates",
      checking: "Checking...",
      upgrade: "Upgrade Memos",
      upgrading: "Upgrading...",
      notDetected: "Not detected",
      fetchFailed: "Unavailable",
      checkFailedTitle: "Check failed",
      ok: "OK",
      canUpgrade: "Update available",
      upToDate: "Up to date",
      confirmUpgradeTitle: "Confirm upgrade",
      confirmUpgradeBody:
        "Upgrade Memos to the latest version?\nThe service will restart automatically when finished.",
      cancel: "Cancel",
      confirmUpgradeBtn: "Upgrade",
      upgradeStartLog: "Starting upgrade...",
      upgradeDoneLog: "Upgrade complete.",
      upgradeDoneTitle: "Upgrade complete",
      upgradeFailedLogPrefix: "Upgrade failed: ",
      unknownError: "Unknown error",
      upgradeFailedTitle: "Upgrade failed",
      upgradeFailedBody: "Upgrade failed. Please try again.",
    },
    "ja-JP": {
      appTitle: "Memos アップグレード管理",
      heading: "Memos 管理",
      language: "言語",
      currentVersion: "現在のバージョン",
      latestVersion: "最新バージョン",
      status: "状態",
      detecting: "確認中...",
      checkUpdate: "アップデートを確認",
      checking: "確認中...",
      upgrade: "Memos をアップグレード",
      upgrading: "アップグレード中...",
      notDetected: "検出できません",
      fetchFailed: "取得できません",
      checkFailedTitle: "確認に失敗しました",
      ok: "OK",
      canUpgrade: "更新あり",
      upToDate: "最新です",
      confirmUpgradeTitle: "アップグレードの確認",
      confirmUpgradeBody:
        "Memos を最新バージョンにアップグレードしますか？\n完了後、サービスは自動的に再起動します。",
      cancel: "キャンセル",
      confirmUpgradeBtn: "アップグレード",
      upgradeStartLog: "アップグレードを開始します...",
      upgradeDoneLog: "アップグレードが完了しました。",
      upgradeDoneTitle: "アップグレード完了",
      upgradeFailedLogPrefix: "アップグレード失敗: ",
      unknownError: "不明なエラー",
      upgradeFailedTitle: "アップグレード失敗",
      upgradeFailedBody: "アップグレードに失敗しました。もう一度お試しください。",
    },
    "ko-KR": {
      appTitle: "Memos 업그레이드 관리",
      heading: "Memos 관리",
      language: "언어",
      currentVersion: "현재 버전",
      latestVersion: "최신 버전",
      status: "상태",
      detecting: "확인 중...",
      checkUpdate: "업데이트 확인",
      checking: "확인 중...",
      upgrade: "Memos 업그레이드",
      upgrading: "업그레이드 중...",
      notDetected: "감지되지 않음",
      fetchFailed: "가져올 수 없음",
      checkFailedTitle: "확인 실패",
      ok: "확인",
      canUpgrade: "업데이트 가능",
      upToDate: "최신 상태",
      confirmUpgradeTitle: "업그레이드 확인",
      confirmUpgradeBody:
        "Memos를 최신 버전으로 업그레이드하시겠습니까?\n완료 후 서비스가 자동으로 다시 시작됩니다.",
      cancel: "취소",
      confirmUpgradeBtn: "업그레이드",
      upgradeStartLog: "업그레이드를 시작합니다...",
      upgradeDoneLog: "업그레이드가 완료되었습니다.",
      upgradeDoneTitle: "업그레이드 완료",
      upgradeFailedLogPrefix: "업그레이드 실패: ",
      unknownError: "알 수 없는 오류",
      upgradeFailedTitle: "업그레이드 실패",
      upgradeFailedBody: "업그레이드에 실패했습니다. 다시 시도해 주세요.",
    },
    "de-DE": {
      appTitle: "Memos Upgrade-Verwaltung",
      heading: "Memos-Verwaltung",
      language: "Sprache",
      currentVersion: "Aktuelle Version",
      latestVersion: "Neueste Version",
      status: "Status",
      detecting: "Wird geprüft...",
      checkUpdate: "Nach Updates suchen",
      checking: "Wird geprüft...",
      upgrade: "Memos aktualisieren",
      upgrading: "Aktualisierung läuft...",
      notDetected: "Nicht erkannt",
      fetchFailed: "Nicht verfügbar",
      checkFailedTitle: "Prüfung fehlgeschlagen",
      ok: "OK",
      canUpgrade: "Update verfügbar",
      upToDate: "Auf dem neuesten Stand",
      confirmUpgradeTitle: "Aktualisierung bestätigen",
      confirmUpgradeBody:
        "Memos auf die neueste Version aktualisieren?\nDer Dienst wird danach automatisch neu gestartet.",
      cancel: "Abbrechen",
      confirmUpgradeBtn: "Aktualisieren",
      upgradeStartLog: "Aktualisierung wird gestartet...",
      upgradeDoneLog: "Aktualisierung abgeschlossen.",
      upgradeDoneTitle: "Aktualisierung abgeschlossen",
      upgradeFailedLogPrefix: "Aktualisierung fehlgeschlagen: ",
      unknownError: "Unbekannter Fehler",
      upgradeFailedTitle: "Aktualisierung fehlgeschlagen",
      upgradeFailedBody:
        "Die Aktualisierung ist fehlgeschlagen. Bitte erneut versuchen.",
    },
    "fr-FR": {
      appTitle: "Gestion des mises à jour Memos",
      heading: "Gestion de Memos",
      language: "Langue",
      currentVersion: "Version actuelle",
      latestVersion: "Dernière version",
      status: "État",
      detecting: "Vérification...",
      checkUpdate: "Rechercher des mises à jour",
      checking: "Vérification...",
      upgrade: "Mettre à jour Memos",
      upgrading: "Mise à jour...",
      notDetected: "Non détectée",
      fetchFailed: "Indisponible",
      checkFailedTitle: "Échec de la vérification",
      ok: "OK",
      canUpgrade: "Mise à jour disponible",
      upToDate: "À jour",
      confirmUpgradeTitle: "Confirmer la mise à jour",
      confirmUpgradeBody:
        "Mettre à jour Memos vers la dernière version ?\nLe service redémarrera automatiquement à la fin.",
      cancel: "Annuler",
      confirmUpgradeBtn: "Mettre à jour",
      upgradeStartLog: "Démarrage de la mise à jour...",
      upgradeDoneLog: "Mise à jour terminée.",
      upgradeDoneTitle: "Mise à jour terminée",
      upgradeFailedLogPrefix: "Échec de la mise à jour : ",
      unknownError: "Erreur inconnue",
      upgradeFailedTitle: "Échec de la mise à jour",
      upgradeFailedBody: "La mise à jour a échoué. Veuillez réessayer.",
    },
    "es-ES": {
      appTitle: "Gestión de actualizaciones de Memos",
      heading: "Gestión de Memos",
      language: "Idioma",
      currentVersion: "Versión actual",
      latestVersion: "Última versión",
      status: "Estado",
      detecting: "Comprobando...",
      checkUpdate: "Buscar actualizaciones",
      checking: "Comprobando...",
      upgrade: "Actualizar Memos",
      upgrading: "Actualizando...",
      notDetected: "No detectada",
      fetchFailed: "No disponible",
      checkFailedTitle: "Error en la comprobación",
      ok: "Aceptar",
      canUpgrade: "Actualización disponible",
      upToDate: "Actualizado",
      confirmUpgradeTitle: "Confirmar actualización",
      confirmUpgradeBody:
        "¿Actualizar Memos a la última versión?\nEl servicio se reiniciará automáticamente al finalizar.",
      cancel: "Cancelar",
      confirmUpgradeBtn: "Actualizar",
      upgradeStartLog: "Iniciando la actualización...",
      upgradeDoneLog: "Actualización completada.",
      upgradeDoneTitle: "Actualización completada",
      upgradeFailedLogPrefix: "Error en la actualización: ",
      unknownError: "Error desconocido",
      upgradeFailedTitle: "Error en la actualización",
      upgradeFailedBody: "La actualización falló. Inténtalo de nuevo.",
    },
    "it-IT": {
      appTitle: "Gestione aggiornamenti Memos",
      heading: "Gestione Memos",
      language: "Lingua",
      currentVersion: "Versione attuale",
      latestVersion: "Ultima versione",
      status: "Stato",
      detecting: "Verifica in corso...",
      checkUpdate: "Cerca aggiornamenti",
      checking: "Verifica in corso...",
      upgrade: "Aggiorna Memos",
      upgrading: "Aggiornamento...",
      notDetected: "Non rilevata",
      fetchFailed: "Non disponibile",
      checkFailedTitle: "Verifica non riuscita",
      ok: "OK",
      canUpgrade: "Aggiornamento disponibile",
      upToDate: "Aggiornato",
      confirmUpgradeTitle: "Conferma aggiornamento",
      confirmUpgradeBody:
        "Aggiornare Memos all'ultima versione?\nAl termine il servizio verrà riavviato automaticamente.",
      cancel: "Annulla",
      confirmUpgradeBtn: "Aggiorna",
      upgradeStartLog: "Avvio dell'aggiornamento...",
      upgradeDoneLog: "Aggiornamento completato.",
      upgradeDoneTitle: "Aggiornamento completato",
      upgradeFailedLogPrefix: "Aggiornamento non riuscito: ",
      unknownError: "Errore sconosciuto",
      upgradeFailedTitle: "Aggiornamento non riuscito",
      upgradeFailedBody: "Aggiornamento non riuscito. Riprova.",
    },
    "ru-RU": {
      appTitle: "Управление обновлениями Memos",
      heading: "Управление Memos",
      language: "Язык",
      currentVersion: "Текущая версия",
      latestVersion: "Последняя версия",
      status: "Состояние",
      detecting: "Проверка...",
      checkUpdate: "Проверить обновления",
      checking: "Проверка...",
      upgrade: "Обновить Memos",
      upgrading: "Обновление...",
      notDetected: "Не обнаружена",
      fetchFailed: "Недоступно",
      checkFailedTitle: "Ошибка проверки",
      ok: "ОК",
      canUpgrade: "Доступно обновление",
      upToDate: "Обновлено",
      confirmUpgradeTitle: "Подтвердить обновление",
      confirmUpgradeBody:
        "Обновить Memos до последней версии?\nПо завершении служба перезапустится автоматически.",
      cancel: "Отмена",
      confirmUpgradeBtn: "Обновить",
      upgradeStartLog: "Начало обновления...",
      upgradeDoneLog: "Обновление завершено.",
      upgradeDoneTitle: "Обновление завершено",
      upgradeFailedLogPrefix: "Ошибка обновления: ",
      unknownError: "Неизвестная ошибка",
      upgradeFailedTitle: "Ошибка обновления",
      upgradeFailedBody: "Не удалось обновить. Попробуйте ещё раз.",
    },
  };

  /** 把浏览器语言（如 zh-CN、en、zh-Hans-CN）归一到支持的语言 */
  function normalize(tag) {
    if (!tag) return null;
    var lower = String(tag).toLowerCase();
    // 精确匹配
    for (var i = 0; i < LOCALES.length; i++) {
      if (LOCALES[i].code.toLowerCase() === lower) return LOCALES[i].code;
    }
    // 只匹配主语言（zh-TW / zh-Hans / en-GB → zh-CN / en-US）
    var primary = lower.split("-")[0];
    var map = {
      zh: "zh-CN",
      en: "en-US",
      ja: "ja-JP",
      ko: "ko-KR",
      de: "de-DE",
      fr: "fr-FR",
      es: "es-ES",
      it: "it-IT",
      ru: "ru-RU",
    };
    return map[primary] || null;
  }

  function detectLang() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      var n = normalize(saved);
      if (n) return n;
    } catch (e) {
      /* localStorage 不可用时忽略 */
    }
    var nav = (navigator.languages && navigator.languages[0]) || navigator.language;
    return normalize(nav) || FALLBACK;
  }

  var current = detectLang();

  function t(key) {
    var d = DICT[current] || DICT[FALLBACK];
    if (d && d[key] != null) return d[key];
    var fb = DICT[FALLBACK];
    if (fb && fb[key] != null) return fb[key];
    return key;
  }

  /** 重绘所有带 data-i18n / data-i18n-title 的节点 */
  function applyI18n() {
    document.title = t("appTitle");
    document.documentElement.lang = current;

    var nodes = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = t(nodes[i].getAttribute("data-i18n"));
    }

    var titled = document.querySelectorAll("[data-i18n-title]");
    for (var j = 0; j < titled.length; j++) {
      titled[j].setAttribute("title", t(titled[j].getAttribute("data-i18n-title")));
    }
  }

  function setLang(code) {
    var n = normalize(code);
    if (!n) return current;
    current = n;
    try {
      localStorage.setItem(STORAGE_KEY, n);
    } catch (e) {
      /* 忽略 */
    }
    applyI18n();
    // 让页面里的动态内容（版本号、状态徽标等）也能跟着换语言
    document.dispatchEvent(new CustomEvent("memos:langchange", { detail: { lang: n } }));
    return current;
  }

  function getLang() {
    return current;
  }

  /** 渲染语言下拉框并绑定切换事件 */
  function mountSelect(selectEl) {
    if (!selectEl) return;
    selectEl.innerHTML = "";
    for (var i = 0; i < LOCALES.length; i++) {
      var opt = document.createElement("option");
      opt.value = LOCALES[i].code;
      opt.textContent = LOCALES[i].label;
      if (LOCALES[i].code === current) opt.selected = true;
      selectEl.appendChild(opt);
    }
    selectEl.setAttribute("aria-label", t("language"));
    selectEl.addEventListener("change", function () {
      setLang(selectEl.value);
      selectEl.setAttribute("aria-label", t("language"));
    });
  }

  window.MemosI18N = {
    t: t,
    setLang: setLang,
    getLang: getLang,
    applyI18n: applyI18n,
    mountSelect: mountSelect,
    locales: LOCALES,
  };
})();
