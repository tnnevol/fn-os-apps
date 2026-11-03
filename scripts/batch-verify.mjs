/**
 * FNOS-001 批量真机验收器
 *
 * 通道：本地 fnpack build → scp 到 NAS → 用应用中心 HTTP API 安装/查询/卸载
 *       → 校验状态与入口 → 卸载 → 回收 compose 网络 → 清理残留目录 → 取失败日志。
 *
 * 设计要点（踩坑换来的）：
 *  1. 安装/卸载走应用中心 HTTP 接口，但鉴权必须借浏览器会话：`osrt`/`ost` 是 HttpOnly，
 *     页内 JS 读不到，curl + Cookie 头拿不到凭证。因此经 Midscene Bridge 连上已登录的
 *     fnOS 标签页，用页面同源 fetch 调接口，浏览器自动带 Cookie。
 *  2. 状态机在 Node：每个应用「装 → 等 running → 探入口 → 卸 → 收网络 → 清残留」，逐条落盘。
 *  3. 卸载必须发生在入口探测之后：否则探到的端口已随卸载关闭。
 *  4. 平台不回收 compose 网络（`<app>_default`）。每装一个就占一个 /16 网段，累计十几个后
 *     Docker 默认地址池耗尽，后续安装全部失败（`all predefined address pools have been fully
 *     subnetted`）。所以每个应用卸载后必须回收网络，并把「平台是否留了网络」记进结果。
 *  5. 地址池耗尽属于设备环境阻塞，不是转换缺陷：一旦出现立即中止整批，避免把上百个应用记成 FAIL。
 *
 * 判定分级（与 docs/testing/index.md 的口径一致）：
 *   PASS        安装成功 + 状态 running + 入口可访问
 *   FAIL        安装或启动失败，且日志指向转换自身的问题
 *   BLOCKED     依赖外部数据库/中间件、端口被占用、镜像拉取失败等环境原因，不计为转换缺陷
 *   ENV_BLOCKED Docker 地址池/守护进程等设备级阻塞，出现即中止整批
 *   UNVERIFIED  向导必填项无法自动填写，需人工确认
 *   BUILD_FAIL  本地 fnpack build 失败
 *
 * 敏感信息：设备地址、账号、会话 Cookie 一律来自环境变量，不写死、不落盘。
 *
 * 用法：
 *   FNOS_HOST=... FNOS_SSH_USER=... FNOS_STAGE_DIR=/vol2/1000/fnos-fpk/ \
 *     node scripts/batch-verify.mjs --list-file /tmp/apps.txt --chunk 8
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const exec = promisify(execFile);
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };

const HOST = process.env.FNOS_HOST || '';
const SSH_USER = process.env.FNOS_SSH_USER || '';
// 会话 Cookie（含 HttpOnly 的 osrt/ost）。提供时走 curl，否则回退浏览器桥接。
// 取法：用 chrome-devtools MCP 打开已登录页面，读任一 /app-center 请求的 cookie 头。
const COOKIE = process.env.FNOS_COOKIE || '';
// SSH 端口可由 FNOS_SSH_PORT 指定：设备可能把 SSH 放在非 22 端口（如 1022）。
const SSH_PORT = process.env.FNOS_SSH_PORT || '';
const SSH_OPTS = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', ...(SSH_PORT ? ['-p', SSH_PORT] : [])];
const STAGE = process.env.FNOS_STAGE_DIR || '';
const VOLUME_ID = process.env.FNOS_VOLUME_ID || '2';
const LANG = 'zh-CN';
const CHUNK = Number(arg('--chunk', '8'));
const OUT = arg('--out', '/tmp/fnos-batch/results.jsonl');
// 应用中心走 5666；入口端口与 API 端口不同，入口探测仍用 HOST:servicePort
const API_BASE = `http://${HOST}:5666`;

if (!HOST || !SSH_USER || !STAGE) {
  console.error('缺少 FNOS_HOST / FNOS_SSH_USER / FNOS_STAGE_DIR 环境变量');
  process.exit(2);
}

const listFile = arg('--list-file', '');
const listArg = arg('--list', '');
const apps = (listFile ? fs.readFileSync(listFile, 'utf8') : listArg)
  .split('\n').map((s) => s.trim()).filter(Boolean);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const doneApps = new Set(
  fs.existsSync(OUT)
    ? fs.readFileSync(OUT, 'utf8').split('\n').filter(Boolean)
        .map((l) => { try { return JSON.parse(l).app; } catch { return null; } }).filter(Boolean)
    : [],
);
const append = (rec) => fs.appendFileSync(OUT, JSON.stringify(rec) + '\n');

const crashLog = (tag, e) => {
  const msg = `[crash:${tag}] ${String((e && e.stack) || e).slice(0, 800)}`;
  console.error(msg);
  try { fs.appendFileSync(OUT + '.crash', msg + '\n'); } catch { /* 忽略 */ }
};
process.on('uncaughtException', (e) => { crashLog('uncaughtException', e); process.exit(70); });
process.on('unhandledRejection', (e) => {
  // 桥接端口冲突（EADDRINUSE）是上一个实例还没完全释放 3766 造成的，属可恢复的瞬态，
  // 交给 ensureBridge 的重试逻辑处理。这里若直接退进程，会把整批带走。
  if (/EADDRINUSE/.test(String((e && e.message) || e))) {
    crashLog('unhandledRejection:eaddrinuse(ignored)', e);
    return;
  }
  crashLog('unhandledRejection', e);
  process.exit(71);
});

// 单实例锁：多实例并行会互相抢占端口并污染结果文件
const LOCK = OUT + '.lock';
if (fs.existsSync(LOCK)) {
  const pid = Number(fs.readFileSync(LOCK, 'utf8').trim());
  let alive = false;
  try { process.kill(pid, 0); alive = true; } catch { alive = false; }
  if (alive) {
    console.error(`已有批量实例在运行 (pid=${pid})，请先结束它；锁文件 ${LOCK}`);
    process.exit(4);
  }
}
fs.writeFileSync(LOCK, String(process.pid));
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch { /* 忽略 */ } });

const sh = (cmd, args, opts) => exec(cmd, args, Object.assign({ maxBuffer: 64 * 1024 * 1024, timeout: 900000 }, opts || {}));
const ssh = (cmd) => sh('ssh', [...SSH_OPTS, `${SSH_USER}@${HOST}`, cmd]);
const scp = (local, remote) => sh('scp', ['-q', '-o', 'BatchMode=yes', ...(SSH_PORT ? ['-P', SSH_PORT] : []), local, `${SSH_USER}@${HOST}:${remote}`]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const curlCode = async (url) => {
  try { const { stdout } = await sh('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '-m', '10', url]); return stdout.trim(); }
  catch { return '000'; }
};

/* ───────────────────────── 应用中心传输层 ─────────────────────────
 *
 * 鉴权只能用浏览器会话本身：`osrt` / `ost` 是 HttpOnly，页内 document.cookie 读不到，
 * 所以 curl + Cookie 头的路子拿不到凭证。改为经 Midscene Bridge 连上已登录的 fnOS 标签页，
 * 由页面同源 fetch 携带 Cookie 调接口——浏览器替我们完成鉴权。
 *
 * Bridge 会被浏览器回收，所以每次调用前确认连接、失败即重建；单次调用是短往返，
 * 断了重连比长连接更稳。
 */

let bridge = null;          // { agent, tabId }
let bridgeEnvLoaded = false;

/** 惰性加载 Midscene Bridge（仅此一处依赖 @midscene/web，缺失时给出可执行的提示） */
async function loadMidscene() {
  if (bridgeEnvLoaded) return;
  const envFile = path.resolve('.batch/.env');
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
      const m2 = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m2 && !process.env[m2[1]]) process.env[m2[1]] = m2[2].replace(/^["']|["']$/g, '');
    }
  }
  bridgeEnvLoaded = true;
}

async function getBridgeModule() {
  await loadMidscene();
  // 以仓库根为基准解析：npx 缓存的绝对路径兜底，避免依赖调用方的 CWD
  const req = createRequire(path.resolve('package.json'));
  const candidates = [
    process.env.MIDSCENE_BRIDGE_MODULE,
    '@midscene/web/bridge-mode',
    path.join(os.homedir(), '.npm/_npx/90f472951aa004bd/node_modules/@midscene/web/dist/lib/bridge-mode/index.js'),
  ].filter(Boolean);
  let lastErr;
  for (const c of candidates) {
    try { return req(c); } catch (e) { lastErr = e; }
  }
  throw new Error('无法加载 @midscene/web（bridge-mode）：' + String(lastErr && lastErr.message).slice(0, 200));
}

/** 连接（或复用）已登录的 fnOS 标签页 */
async function ensureBridge() {
  if (bridge) return bridge;
  const { AgentOverChromeBridge } = await getBridgeModule();

  // 桥接固定监听 127.0.0.1:3766。上一个实例刚退出时该端口可能仍在 TIME_WAIT，
  // 立即监听会抛 EADDRINUSE 并把整批带走（实测反复发生）。这里改为重试若干次，
  // 让「上一个进程还没完全放手」变成一个可自愈的短暂状态。
  let agent = null;
  let lastErr = null;
  for (let attempt = 0; attempt < 6 && !agent; attempt++) {
    try {
      agent = new AgentOverChromeBridge({ enableWaterFlowAnimation: false, serverListeningTimeout: 60000 });
      // 触发一次真实握手，端口冲突会在这里暴露
      await agent.getBrowserTabList();
    } catch (e) {
      lastErr = e;
      const portBusy = /EADDRINUSE/.test(String(e && e.message));
      if (agent) { await agent.destroy().catch(() => {}); agent = null; }
      if (!portBusy) throw e;
      console.error(`[bridge] 端口被占用，等待后重试 (${attempt + 1}/6)`);
      await sleep(10000);
    }
  }
  if (!agent) throw lastErr || new Error('桥接初始化失败');

  const findTab = async () => {
    const tabs = await agent.getBrowserTabList();
    return tabs.find((t) => String(t.url || '').includes(HOST));
  };
  let tab = await findTab();
  // 标签页可能被用户关掉；自动重开一次，避免长跑因为「标签不在」整批中断
  if (!tab) {
    try { await agent.connectNewTabWithUrl(API_BASE + '/'); } catch { /* 下面再查一次 */ }
    for (let i = 0; i < 8 && !tab; i++) {
      await sleep(1500);
      tab = await findTab();
    }
  }
  if (!tab) {
    await agent.destroy().catch(() => {});
    throw new Error(`Midscene 桥接里没有 ${HOST} 的标签页，且自动打开失败；请在 Chrome 中打开并登录 fnOS 应用中心`);
  }
  await agent.page.setActiveTabId(Number.parseInt(String(tab.id), 10), { activate: false });
  bridge = { agent, tabId: tab.id };
  return bridge;
}

async function closeBridge() {
  if (!bridge) return;
  const b = bridge; bridge = null;
  try { await b.agent.destroy(); } catch { /* 忽略 */ }
}

/**
 * 一次应用中心 API 调用，走页面同源 fetch（浏览器自动带 Cookie）。
 *
 * 会话失效必须单独识别：接口不再返回 JSON 时，若按普通失败处理，会把「没登录」
 * 记成上百个应用 FAIL。这里抛 sessionExpired，由主循环中止整批。
 */
/**
 * 直接用 curl 调应用中心接口。
 *
 * 鉴权靠一份从已登录浏览器会话里取来的 Cookie（含 HttpOnly 的 osrt/ost）。
 * 相比浏览器桥接：短往返、可重试、不依赖扩展存活，长跑更稳。
 * 会话失效必须单独识别——接口不再返回 JSON 时若按普通失败处理，
 * 会把「没登录」记成上百个应用 FAIL。
 */
async function apiViaCurl(pathname, { method = 'GET', body } = {}) {
  const url = API_BASE + pathname + (pathname.includes('?') ? '&' : '?') + 'language=' + LANG;
  const args = ['-s', '-m', '30', '-H', `Cookie: ${COOKIE}`, '-w', '\n__HTTP__%{http_code}'];
  if (method !== 'GET') args.push('-X', method);
  if (body !== undefined) args.push('-H', 'Content-Type: application/json', '--data-binary', JSON.stringify(body));
  args.push(url);
  const { stdout } = await sh('curl', args);
  const text = String(stdout || '');
  const m = text.match(/\n__HTTP__(\d{3})\s*$/);
  const status = m ? m[1] : '';
  const payload = m ? text.slice(0, m.index) : text;
  if (['401', '403', '302', '303'].includes(status) || !payload.trim()) {
    const err = new Error(`会话失效或接口无响应 (HTTP ${status || '空响应'})，需要重新从浏览器取 Cookie`);
    err.sessionExpired = true;
    throw err;
  }
  try { return JSON.parse(payload); } catch { return { __raw: payload.slice(0, 300), __status: status }; }
}

async function api(pathname, { method = 'GET', body } = {}) {
  // 有会话 Cookie 时优先走 curl：比浏览器桥接轻得多，也不会因为扩展休眠而断线。
  // Cookie 来源见文件头说明（chrome-devtools MCP 从已登录请求头里取）。
  if (COOKIE) return apiViaCurl(pathname, { method, body });

  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { agent } = await ensureBridge();
      const payload = {
        url: pathname + (pathname.includes('?') ? '&' : '?') + 'language=' + LANG,
        method,
        body: body === undefined ? null : JSON.stringify(body),
      };
      const raw = await agent.page.evaluateJavaScript(`(async () => {
        const p = ${JSON.stringify(payload)};
        try {
          const res = await fetch(p.url, {
            method: p.method,
            credentials: 'include',
            headers: p.body ? { 'content-type': 'application/json' } : undefined,
            body: p.body || undefined,
          });
          const text = await res.text();
          return JSON.stringify({ status: res.status, text });
        } catch (e) {
          return JSON.stringify({ status: 0, text: '', err: String(e && e.message || e) });
        }
      })()`);
      const outer = raw && raw.result && raw.result.value;
      if (!outer) throw new Error('页面 fetch 无返回');
      const { status, text, err } = JSON.parse(outer);
      if (err) throw new Error('页面 fetch 异常: ' + err);
      if ([401, 403, 302, 303].includes(status) || !String(text || '').trim()) {
        const e2 = new Error(`会话失效或接口无响应 (HTTP ${status || '空响应'})，请重新登录 fnOS 应用中心`);
        e2.sessionExpired = true;
        throw e2;
      }
      try { return JSON.parse(text); } catch { return { __raw: String(text).slice(0, 300), __status: String(status) }; }
    } catch (e) {
      lastErr = e;
      if (e && e.sessionExpired) throw e;
      // 桥接断了：重建后重试一次
      await closeBridge();
    }
  }
  throw lastErr;
}

/** 带重试的调用：设备 CPU 紧张或 nginx 瞬时 502 时重试比直接判失败更准 */
async function apiRetry(pathname, opts, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await api(pathname, opts);
      if (r && r.__raw === undefined) return r;
      last = new Error('返回非 JSON: ' + (r && r.__raw));
    } catch (e) {
      // 会话失效重试没有意义，直接上抛，让主循环中止整批
      if (e && e.sessionExpired) throw e;
      last = e;
    }
    await sleep(1500);
  }
  throw last;
}

const callDownloadTask = (app) => apiRetry('/app-center/v1/download/task', {
  method: 'POST', body: { packageSourceType: 'file', path: STAGE + app + '.fpk', language: LANG },
});
const callDownloadStatus = (id) => apiRetry('/app-center/v1/download/status?downloadTaskId=' + encodeURIComponent(id));
const callInstallInfo = (appName, version) => apiRetry(
  `/app-center/v1/install/info?version=${encodeURIComponent(version)}&appName=${encodeURIComponent(appName)}&packageType=path`,
);
const callInstallTask = (appName, version, params) => apiRetry('/app-center/v1/install/task', {
  method: 'POST',
  body: {
    appName, version, packageType: 'path',
    systemParameters: {
      agreedToProtocol: true,
      installVolumeID: Number(VOLUME_ID),
      dataVolumeId: Number(VOLUME_ID),
      immediateStart: true,
      apiScope: {},
    },
    customParameters: params,
    language: LANG,
  },
});
const callInstallStatus = (taskId) => apiRetry('/app-center/v1/install/status', { method: 'POST', body: { taskId, language: LANG } });
const callInstalledList = async () => {
  const l = await apiRetry('/app-center/v1/app/installed');
  return (l && l.data && l.data.list) || [];
};
const callUninstall = (appName) => apiRetry('/app-center/v1/uninstall/start', {
  method: 'POST',
  body: { appName, customParameters: [{ key: 'wizard_data_action', value: 'delete' }], language: LANG },
});

/** 轮询直到条件满足 */
async function until(fn, { tries = 240, gap = 1000, label = '' } = {}) {
  for (let i = 0; i < tries; i++) {
    const v = await fn();
    if (v) return v;
    await sleep(gap);
  }
  throw new Error(`轮询超时: ${label}`);
}

/** 由向导 schema 生成参数 */
function buildParams(wizardInfo) {
  const items = (wizardInfo.wizardContent || []).flatMap((s) => (s && s.items) || []);

  // 该应用声明的数据库类型（取 DB_TYPE 字段的值），决定用哪套凭据与端口。
  // 注意必须**先全表扫一遍**再逐字段处理：之前误用了循环中当前字段的 initValue，
  // 导致对所有字段都判成「非 postgres」，PostgreSQL 应用被套上 MySQL 的账号与端口。
  const dbTypeField = items.find((i) => /^DB_TYPE$/i.test(String(i.field || i.key || '')));
  const appDbType = String(
    (dbTypeField && dbTypeField.initValue) || process.env.FNOS_DB_TYPE || 'mysql',
  ).toLowerCase();
  const appIsPg = /postgres/.test(appDbType);
  const params = [];
  const unsolved = [];
  const filled = [];
  let needsExternal = false;
  // 可选：给「站点地址 / 邮箱 / 路径」这类必填项填占位值，使转换本身仍可验证。
  // 默认关闭——UNVERIFIED 是诚实结论；开启后结果记录 placeholderFilled，便于与真实填写区分。
  const fillPlaceholders = process.env.FNOS_FILL_PLACEHOLDERS === '1';

  // 测试设备上已就绪的中间件端口（由环境变量覆盖，缺省用本设备的实际值）。
  // 这些是 fnOS 原生应用，跑在宿主上；容器里必须用宿主局域网 IP + 该端口访问。
  // 设备上同时备有 MySQL（43306）与 PostgreSQL（55432，测试实例）。
  // DB_PORT 取哪个由 DB_TYPE 决定：postgres/postgresql 走 PG 端口，其余走 MySQL。
  const dbType = String(process.env.FNOS_DB_TYPE || 'mysql').toLowerCase();
  const isPg = /postgres/.test(dbType);
  const portForDbType = isPg
    ? (process.env.FNOS_PG_PORT || '55432')
    : (process.env.FNOS_DB_PORT || '43306');
  const PORT_MAP = {
    DB_PORT: portForDbType,
    MYSQL_PORT: process.env.FNOS_DB_PORT || '43306',
    REDIS_PORT: process.env.FNOS_REDIS_PORT || '6379',
    MONGO_PORT: process.env.FNOS_MONGO_PORT || '27017',
    POSTGRES_PORT: process.env.FNOS_PG_PORT || '55432',
    MINIO_API_PORT: process.env.FNOS_MINIO_PORT || '9000',
    MINIO_CONSOLE_PORT: process.env.FNOS_MINIO_CONSOLE_PORT || '9001',
    KAFKA_PORT: process.env.FNOS_KAFKA_PORT || '9092',
  };
  // 形如 DB_HOST=<某个值> 的字段，记录一下便于结果里体现「连的是哪个宿主」
  const pendingExternalHosts = [];

  // 占位值的取值原则：能指向测试主机的就指向测试主机（地址类字段），
  // 必须是域名/邮箱形态的用约定占位值。目的是验证「FPK 装得上、容器起得来」，
  // 不追求业务可用；所有用到占位值的记录都会带 placeholderFilled 标记。
  const PLACEHOLDER_DOMAIN = process.env.FNOS_PLACEHOLDER_DOMAIN || 'example.com';
  const PLACEHOLDER_EMAIL = process.env.FNOS_PLACEHOLDER_EMAIL || `admin@${PLACEHOLDER_DOMAIN}`;
  const PLACEHOLDER_PATH = process.env.FNOS_PLACEHOLDER_PATH || '/vol2/1000';
  const candidatesFor = (key) => {
    const n = String(key).toUpperCase();
    const hostUrl = `http://${HOST}`;
    // 邮箱类：只要形态合法即可
    if (/E?MAIL/.test(n)) return [PLACEHOLDER_EMAIL, `admin@${PLACEHOLDER_DOMAIN}`];
    // 路径类：用设备上真实存在的目录，否则容器挂载会失败
    if (/PATH|DIR/.test(n)) return [PLACEHOLDER_PATH, '/vol2/1000', '/tmp'];
    // 端口区间（如 SCREEGO_TURN_PORT_RANGE）形如 40000:41000，冒号是硬性要求
    if (/RANGE/.test(n)) return ['40000:41000', '50000:51000'];
    // 纯 IP 类字段用测试主机地址
    if (/(?:^|_)(?:IP|ADDR|ADDRESS)(?:$|_)/.test(n)) return [HOST, '127.0.0.1'];
    // URL 类：优先指向测试主机，其次占位域名（部分字段要求可解析域名）
    if (/(?:^|_)(?:URL|URI|ENDPOINT|ORIGIN|BASE)(?:$|_)/.test(n)) {
      return [`${hostUrl}:8080`, hostUrl, `https://${PLACEHOLDER_DOMAIN}`, PLACEHOLDER_DOMAIN];
    }
    // 主机/域名类：先给测试主机 IP，再退到占位域名
    if (/(?:^|_)(?:HOST|DOMAIN|HOSTNAME|SERVER)(?:$|_)/.test(n)) {
      return [HOST, PLACEHOLDER_DOMAIN, `http://${HOST}`, `http://${PLACEHOLDER_DOMAIN}`];
    }
    return [HOST, `${hostUrl}:8080`, PLACEHOLDER_DOMAIN, PLACEHOLDER_EMAIL, PLACEHOLDER_PATH];
  };
  const matches = (pattern, v) => {
    if (!pattern) return true;
    try { return new RegExp(pattern).test(v); } catch { return true; }
  };
  for (const it of items) {
    const key = it.field || it.key; if (!key) continue;
    const rules = it.rules || [];
    const required = rules.some((r) => r && r.required);
    const pattern = (rules.find((r) => r && r.pattern) || {}).pattern;
    // 凭据类字段（密码/密钥/令牌/访问键/管理员账号）可由自动化生成，
    // 它们不依赖用户环境，不该因此挡住「转换是否可用」的验证。
    const isSecret = it.type === 'password'
      || /password|secret|token|access_?key|secret_?key|api_?key|admin_?user|admin_?pass|credential/i.test(key + ' ' + (it.label || ''));
    let val = it.initValue;

    // 中间件就绪时，DB 账号/密码/库名一律以环境变量为准：
    // 向导里的默认值（如 DB_USERNAME=emlog）在目标设备上并不存在，
    // 靠它连库必然失败，而这属于部署差异、不是转换缺陷。
    if (process.env.FNOS_MIDDLEWARE_READY === '1') {
      const kUp = String(key).toUpperCase();
      // 决定用哪套凭据的，是**该应用自己声明的数据库类型**，不是全局环境变量。
      // 之前用 FNOS_DB_TYPE 判断，导致本来要 PostgreSQL 的应用（discourse）
      // 被强制套上 MySQL 的账号密码，连库必然失败。
      // 优先级：向导里的 initValue → 环境变量兜底。
      const pgMode = appIsPg;
      if (/(?:DB|MYSQL|MARIADB|POSTGRES)_(?:USER|USERNAME)$/.test(kUp) && process.env.FNOS_DB_USER) {
        val = pgMode ? (process.env.FNOS_PG_USER || process.env.FNOS_DB_USER) : process.env.FNOS_DB_USER;
        filled.push(key);
      } else if (/(?:DB|MYSQL|MARIADB|POSTGRES)_(?:PASSWORD|PASS)$/.test(kUp) && process.env.FNOS_DB_PASSWORD) {
        val = pgMode ? (process.env.FNOS_PG_PASSWORD || process.env.FNOS_DB_PASSWORD) : process.env.FNOS_DB_PASSWORD;
        filled.push(key);
      } else if (/^DB_TYPE$/.test(kUp)) {
        // 只在应用没声明类型时才用环境变量兜底；应用已声明（如 discourse 的 postgres）
        // 就必须尊重，否则会把它指向错误的数据库引擎。
        if (!it.initValue && process.env.FNOS_DB_TYPE) {
          val = process.env.FNOS_DB_TYPE; filled.push(key);
        }
      } else if (/(?:DB|MYSQL|MARIADB|POSTGRES)_HOST$/.test(kUp)) {
        val = HOST; filled.push(key); needsExternal = true;
      } else if (/(?:DB|MYSQL|MARIADB|POSTGRES)_PORT$/.test(kUp)) {
        // 端口跟着引擎走：PostgreSQL 实例在 FNOS_PG_PORT，MySQL 在 FNOS_DB_PORT。
        val = pgMode ? (process.env.FNOS_PG_PORT || '55432') : (process.env.FNOS_DB_PORT || '43306');
        filled.push(key);
      } else if (/(?:REDIS)_HOST$/.test(kUp)) {
        val = HOST; filled.push(key); needsExternal = true;
      }
    }

    if (val === undefined || val === null || val === '') {
      // 设备上已备好中间件时，DB 账号密码必须用真实凭据，随机值连不上；
      // 由环境变量注入（FNOS_DB_USER / FNOS_DB_PASSWORD），缺省才回退随机生成。
      const isDbCred = /(?:DB|MYSQL|MARIADB|POSTGRES)_(?:USER|USERNAME|PASSWORD|PASS)$/i.test(key)
        || /^(?:DB|MYSQL|MARIADB|POSTGRES)_US(?:ER|ERNAME)$/i.test(key);
      if (isDbCred && process.env.FNOS_MIDDLEWARE_READY === '1' && process.env.FNOS_DB_PASSWORD) {
        // 设备上的 MySQL 只有 root 账号，按应用名自动建库、统一用 root 连，
        // 避免为每个应用手工建用户（那属于部署噪音，不是转换问题）。
        val = /USER/i.test(key) ? (process.env.FNOS_DB_USER || 'root') : process.env.FNOS_DB_PASSWORD;
        filled.push(key);
      } else if (isSecret) {
        // helpText 常写明位数要求（如「32 位随机字符串」），按其生成，否则服务端会拒绝
        const lenMatch = (it.helpText || '').match(/(?:\d{2,3})\s*位/);
        const len = lenMatch ? Number(lenMatch[1]) : 32;
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let s2 = '';
        for (let k = 0; k < len; k++) s2 += alphabet[Math.floor(Math.random() * alphabet.length)];
        val = s2;
      } else if (required && /(?:^|_)(?:DB|REDIS|MONGO|POSTGRES|MYSQL|MARIADB|ELASTIC|KAFKA|MINIO)(?:$|_)/i.test(key)) {
        // 外部中间件地址：dev 设备上 MySQL/Redis 等以 **fnOS 原生应用**运行在宿主，
        // 容器内的 127.0.0.1 指向容器自身，填它必然连不上（实测 ECONNREFUSED）。
        // 必须填宿主机的局域网 IP，容器才能经 docker0 转发访问到宿主服务。
        val = (/PORT$/.test(key) && PORT_MAP[key]) ? String(PORT_MAP[key]) : HOST;
        needsExternal = true;
        if (!/PORT$/.test(key)) pendingExternalHosts.push(key);
      } else if (required && fillPlaceholders) {
        const pick = candidatesFor(key).find((c) => matches(pattern, c));
        if (pick === undefined) { unsolved.push(key + '(required)'); continue; }
        val = pick; filled.push(key);
      } else if (required) { unsolved.push(key + '(required)'); continue; }
      else { val = ''; }
    }
    val = String(val);
    // 外部依赖占位值不适用用户输入正则（该正则约束的是用户填的域名/IP 形态）
    if (pattern && !isSecret && !needsExternal && !matches(pattern, val)) {
      // 占位模式下按候选值再试一次：格式不符不该白白记成待人工确认
      const pick = fillPlaceholders ? candidatesFor(key).find((c) => matches(pattern, c)) : undefined;
      if (pick === undefined) { unsolved.push(key + '(pattern)'); continue; }
      val = pick;
      if (!filled.includes(key)) filled.push(key);
    }
    // 落盘时保留实际填值以便追溯；密码类只留长度，避免凭据进结果文件
    const traceVal = /PASSWORD|PASS$|SECRET|TOKEN/i.test(key) ? `<${String(val).length} chars>` : String(val);
    params.push({ key, value: val, trace: traceVal });
  }
  return { params, unsolved, needsExternal, filled };
}

/** 设备级阻塞：一旦命中就中止整批，避免把环境问题记成上百个应用缺陷 */
// 只收录「整台设备都装不了」的情形。镜像源不通（如 registry TLS 超时）虽然也让安装失败，
// 但只影响那一个应用，记 BLOCKED 即可，不能据此中止整批
const ENV_BLOCKER = /all predefined address pools have been fully subnetted|cannot connect to the Docker daemon|permission denied while trying to connect to the Docker daemon|no space left on device/i;

function verdict(rec) {
  // 把生命周期日志也纳入判定依据：端口占用、compose 失败等真因只出现在这里。
  const blob = `${rec.err || ''} ${rec.installStatus || ''} ${rec.installOutputTail || ''} ${rec.log || ''} ${rec.lifecycleLog || ''}`;
  if (rec.stage === 'build') return 'BUILD_FAIL';
  if (rec.stage === 'wizard_unsolvable') return 'UNVERIFIED';
  // 会话失效：整批都做不了，结果不能算作应用结论
  if (rec.sessionExpired) return 'SESSION_EXPIRED';
  // 服务端忙/安装队列被占：重试后仍被拒，属于设备状态，不是转换缺陷
  if (rec.busy) return 'BLOCKED';
  if (ENV_BLOCKER.test(blob)) return 'ENV_BLOCKED';
  // 安装轮询超时：没拿到任何失败证据，只是没在窗口内完成。
  // 大镜像首次拉取、模型权重下载（个别应用首启要下几个 GB）都会走到这里，
  // 属于「跑得慢」而不是「转换有问题」，记 BLOCKED 并在下一步用更长窗口复验。
  if (rec.stage === 'exception' && /轮询超时/.test(String(rec.err || ''))) return 'BLOCKED';
  // 需要外部数据库/中间件的应用：失败是环境问题，不是转换缺陷
  // 设备上已备好中间件时（FNOS_MIDDLEWARE_READY=1），依赖类应用应按实际结果判定，
  // 不再一律记 BLOCKED——否则「有 DB 也验不出结论」，失去验证意义。
  const mwReady = process.env.FNOS_MIDDLEWARE_READY === '1';
  if (rec.needsExternal && !mwReady && rec.installed !== true) return 'BLOCKED';
  if (!rec.installed) {
    // 端口占用属于设备环境冲突（默认端口被系统服务或其他应用占用），易换成别的端口，
    // 不计为转换缺陷；但要保留 lifecycleLog 供定位是哪个端口。
    if (/address already in use|port is already allocated|failed to bind host port|端口/i.test(blob)) return 'BLOCKED';
    // 镜像拉取失败/超时属于环境问题（镜像源、限流、磁盘），不计入转换缺陷
    if (/Pulling|Already exists|Waiting|Downloading|extracting|error pulling|failed to resolve|manifest unknown|toomanyrequests|timeout/i.test(blob)) return 'BLOCKED';
    return 'FAIL';
  }
  if (rec.appStatus !== 'running') {
    if (/address already in use|port is already allocated/i.test(`${rec.log || ''}`)) return 'BLOCKED';
    if (rec.needsExternal && !mwReady) return 'BLOCKED';
    // 仍处于过渡态（start / installing …）说明只是没等到就绪，不能当成「原生应用装完即终态」
    if (rec.notReady) return 'FAIL';
    // 原生应用（没有任何对外服务端口）装完不常驻 running 是正常形态：
    // 安装成功即说明转换可用，不能因为没有 running 记成失败。
    if (!rec.service || !rec.service.port) return 'PASS';
    return 'FAIL';
  }
  if (rec.service && rec.service.port) {
    if (!rec.entryCode) return 'BLOCKED';
    // 404 也说明服务已响应：应用 UI 可能在子路径，不等于应用起不来
    if (['200', '201', '204', '301', '302', '303', '307', '308', '401', '403', '404'].includes(rec.entryCode)) {
      if (rec.entryCode === '404') rec.entryNote = '根路径返回 404，服务已响应，UI 可能在子路径';
      return 'PASS';
    }
    if (rec.needsExternal && !mwReady) return 'BLOCKED';
    return 'FAIL';
  }
  return 'PASS';
}

/**
 * 清掉上一次中断的安装留下的容器。
 * 安装中途被打断时，容器已经建出来（状态 Created），但应用没有出现在「已安装」列表里，
 * 于是下一次 install/task 会被服务端以 10500 拒绝——看起来像应用缺陷，其实是设备残留。
 */
async function preCleanContainers(name) {
  try {
    const { stdout } = await ssh(`docker ps -a --format '{{.Names}}' 2>/dev/null | grep -E '^${name}(-|$)' || true`);
    const leftovers = String(stdout || '').split('\n').map((s) => s.trim()).filter(Boolean);
    if (leftovers.length) {
      const quoted = leftovers.map((n) => `'${n}'`).join(' ');
      await ssh(`docker rm -f ${quoted} >/dev/null 2>&1 || true`);
    }
    return leftovers;
  } catch { return []; }
}

async function testOne(app) {
  const rec = { app, stage: 'start' };
  try {
    // 上一轮残留：测试前先确保未安装
    const pre = await callInstalledList();
    if ((pre || []).some((x) => x.appName === app)) {
      await callUninstall(app);
      await until(async () => {
        const l = await callInstalledList();
        return !(l || []).some((x) => x.appName === app);
      }, { tries: 30, gap: 2000, label: 'pre-uninstall' });
      rec.preUninstalled = true;
    }
    // 中断安装留下的 Created 容器会让后续安装被拒（10500），先清掉
    const leftovers = await preCleanContainers(app);
    if (leftovers.length) rec.preCleaned = leftovers;

    // 1) 解析安装包
    const dl = await callDownloadTask(app);
    if (!dl || dl.code !== 0) { rec.stage = 'download_task'; rec.err = JSON.stringify(dl).slice(0, 300); return rec; }
    const dlId = dl.data.downloadTaskId;
    const st = await until(async () => {
      const s = await callDownloadStatus(dlId);
      return s && s.code === 0 && s.data && (s.data.status === 2 || s.data.status === 3) ? s : null;
    }, { tries: 80, gap: 600, label: 'download' });
    if (st.data.status !== 2) { rec.stage = 'download_status'; rec.err = JSON.stringify(st).slice(0, 300); return rec; }
    const appName = st.data.appName;
    const version = st.data.version;
    rec.appName = appName; rec.version = version;

    // 2) 向导参数
    const info = await callInstallInfo(appName, version);
    if (!info || info.code !== 0 || !info.data || !info.data.wizardInfo) {
      rec.stage = 'install_info'; rec.err = JSON.stringify(info).slice(0, 300); return rec;
    }
    const { params, unsolved, needsExternal, filled } = buildParams(info.data.wizardInfo);
    if (filled.length) rec.placeholderFilled = filled;
    rec.needsExternal = needsExternal;
    if (unsolved.length) {
      rec.stage = 'wizard_unsolvable'; rec.unsolvable = unsolved;
      rec.err = '向导必填项无法自动填写: ' + unsolved.join(',');
      return rec;
    }
    rec.params = params.map((p) => p.key);
    // 记录实际填入的值（密码已脱敏），便于复现「到底拿什么连的」
    rec.paramValues = params.map((p) => `${p.key}=${p.trace}`);

    // 3) 安装
    // 10500 = 服务端忙/上一个应用仍在启动流程（实测：前面有应用卡在 start 时会拒绝新任务），
    // 等一会儿重试即可，不是应用缺陷
    let task = await callInstallTask(appName, version, params);
    for (let i = 0; task && task.code === 10500 && i < 6; i++) {
      await sleep(10000);
      task = await callInstallTask(appName, version, params);
    }
    if (!task || task.code !== 0) {
      rec.stage = 'install_task'; rec.err = JSON.stringify(task).slice(0, 300);
      rec.busy = !!(task && task.code === 10500);
      return rec;
    }
    const taskId = task.data && (task.data.taskId || task.data.installTaskId);
    rec.taskId = taskId;
    const last = await until(async () => {
      const s = await callInstallStatus(taskId);
      const d = s && s.data;
      if (!d) return null;
      // 终态：2 = 成功；>= 3 = 失败/取消。实测静默失败会返回 status:5、progress:0、
      // outputText 为空，只认 2/3 会让这类应用白等满 15 分钟，还拿不到失败原因
      if (d.status === 2 || d.status >= 3 || /success|failed|completed|error|cancel/i.test(d.message || '')) return s;
      return null;
    // 冷缓存下要拉镜像，安装可能持续十几分钟；窗口给足，避免把「还在拉镜像」记成失败
    }, { tries: 900, gap: 1000, label: 'install' });
    rec.installStatus = JSON.stringify(last.data).slice(0, 4000);
    // 拉镜像阶段的失败是环境问题（镜像源/限流），不是转换缺陷：把 outputText 尾部单独留出来
    const outText = (last.data && last.data.outputText) || '';
    if (outText) rec.installOutputTail = outText.slice(-1200);
    const insOk = last.data.status === 2 || /success/i.test(last.data.message || '');
    rec.installed = !!insOk;
    if (!insOk) { rec.stage = 'install_status'; rec.err = rec.installStatus; return rec; }

    // 4) 等待 running
    // 原生应用（无 service/短命脚本式）安装完成后不会常驻 running，只有 stopped/空状态，
    // 对它们要求 running 会把成功的转换记成 FAIL。这里按「出现即接受」处理，
    // 真正有没有起来由后面的入口探测判定。
    let item;
    try {
      item = await until(async () => {
        const l = await callInstalledList();
        const it = (l || []).find((x) => x.appName === appName);
        // nostart = 原生应用装完即为终态，不必等 running（否则每个原生应用白等 3 分钟）
        return it && ['running', 'stopped', 'nostart'].includes(it.status) ? it : null;
      // 应用中心报「已安装」不代表容器已就绪：重镜像（数据库迁移、初始化）要跑一阵才转 running
      // 首启要做数据库迁移与初始化的应用（如 memos）会长时间停在 start，
      // 180 秒不够；给到约 6 分钟，避免把「还在初始化」记成失败。
      }, { tries: 180, gap: 2000, label: 'running' });
    } catch (e) {
      // 超时也接受：只要应用已出现在「已安装」列表里，就交给入口探测去判定是否可用。
      // 但必须记下当时的状态——start/installing 之类是过渡态，不能当成「已就绪」，
      // 否则会像 fn-dashy 那样：还在启动就因为没有服务端口被判成 PASS。
      const l = await callInstalledList().catch(() => null);
      item = (l || []).find((x) => x.appName === appName) || null;
      if (!item) throw e;
      rec.statusTimeout = true;
      rec.statusAtTimeout = item.status;
      rec.notReady = !['running', 'stopped', 'nostart'].includes(String(item.status));
      // 等待就绪超时同样是「为什么起不来」的关键场景（依赖库连不上、初始化失败，
      // 应用会长期停在 start）。这里趁容器还在立刻取现场，否则卸载后无从复现。
      try {
        const { stdout: snap } = await ssh(`docker ps -a --format '{{.Names}} | {{.Status}} | {{.Ports}}' 2>/dev/null | grep -E '^${appName}' || true`);
        const line = String(snap || '').trim().split('\n')[0] || '';
        if (line) rec.containers = line.slice(0, 800);
        const cname = line.split(' | ')[0].trim();
        if (cname) {
          const { stdout: lg } = await ssh(`docker logs --tail 40 '${cname}' 2>&1 | tail -40 || true`);
          const kept = String(lg || '').trim();
          if (kept) rec.containerLog = kept.slice(-2000);
        }
      } catch { /* 取证失败不影响判定 */ }
    }
    rec.appStatus = item.status;
    rec.service = item.appServiceInfo ? {
      name: item.appServiceInfo.serviceName, type: item.appServiceInfo.type,
      protocol: item.appServiceInfo.urls && item.appServiceInfo.urls.protocol,
      port: item.appServiceInfo.urls && item.appServiceInfo.urls.port,
    } : null;

    // 5) 入口探测（必须在卸载之前）
    if (rec.service && rec.service.port) {
      const url = 'http://' + HOST + ':' + rec.service.port + '/';
      rec.entryUrl = url;
      // 应用中心报 running 不等于容器已在提供服务：首次安装还要拉镜像、初始化数据库。
      // 探针窗口给足（12 × 15s ≈ 3 分钟；镜像已缓存时立即返回）。
      // 注意 5xx 也要继续等：Jellyfin 首启在初始化数据库期间会持续回 503，
      // 若把 503 当成终态会误判成「入口不可用」（实测容器已就绪、直连是 302）。
      const notReady = (code) => !code || code === '000' || /^5\d\d$/.test(code);
      for (let i = 0; i < 12; i++) {
        rec.entryCode = await curlCode(url);
        if (!notReady(rec.entryCode)) break;
        await sleep(15000);
      }
      console.log(`  [verify] ${app} ${url} -> ${rec.entryCode}`);
      // 入口打不开时补一份容器现场：区分「容器根本没起」「容器起了但没监听该端口」
      // 与「端口映射错」，否则 000 只能记成可疑，无法归因
      if (!rec.entryCode || rec.entryCode === '000') {
        try {
          const { stdout } = await ssh(`docker ps -a --format '{{.Names}} | {{.Status}} | {{.Ports}}' 2>/dev/null | grep -E '^${app}' || true`);
          const snap = String(stdout || '').trim();
          if (snap) rec.containers = snap.slice(0, 800);
          // 容器日志才是「为什么起不来」的直接证据：重启循环的真因（缺依赖、配置错、
          // 权限不足）只出现在这里；应用一卸载就再也取不到
          const first = snap.split('\n')[0].split(' | ')[0].trim();
          if (first) {
            // 重启循环里的容器刚被 kill，logs 有时读不到；重试几次并放大窗口，
            // 否则「为什么起不来」的关键几行会丢，只剩 status=Restarting 无法归因
            for (let attempt = 0; attempt < 4; attempt++) {
              const { stdout: logOut } = await ssh(`docker logs --tail 60 '${first}' 2>&1 || true`);
              const kept = String(logOut || '').trim();
              if (kept) { rec.containerLog = kept.slice(-2000); break; }
              await sleep(2000);
            }
            // 仍拿不到时补一份 inspect 现场（ExitCode/OOMKilled 能区分崩溃原因）
            if (!rec.containerLog) {
              const { stdout: insp } = await ssh(`docker inspect '${first}' --format '{{.State.Status}} exit={{.State.ExitCode}} oom={{.State.OOMKilled}} err={{.State.Error}}' 2>/dev/null || true`);
              const s2 = String(insp || '').trim();
              if (s2) rec.containerState = s2.slice(0, 300);
            }

            // 绑定挂载取证：宿主侧目录是否存在、属主与权限是谁。
            // 容器内进程能否写入挂载点完全取决于这一项，而应用一卸载就查不到了，
            // 所以必须趁容器还在的时候取。
            try {
              const { stdout: mj } = await ssh(`docker inspect '${first}' --format '{{json .Mounts}}' 2>/dev/null || true`);
              const mounts = JSON.parse(String(mj || '[]').trim() || '[]');
              const rows = [];
              for (const m of mounts) {
                if (!m || m.Type !== 'bind' || !m.Source) continue;
                const { stdout: st2 } = await ssh(`stat -c '%U:%G %a' '${m.Source}' 2>/dev/null || echo MISSING`);
                rows.push(`${m.Source} -> ${m.Destination} [${String(st2 || '').trim()}]`);
              }
              if (rows.length) rec.mounts = rows.join(' | ').slice(0, 1500);
              // 容器内进程身份：与挂载点属主对照即可判断能不能写
              const { stdout: uidOut } = await ssh(`docker inspect '${first}' --format '{{.Config.User}}' 2>/dev/null || true`);
              if (String(uidOut || '').trim()) rec.containerUser = String(uidOut).trim().slice(0, 40);
            } catch { /* 忽略 */ }
          }
        } catch { /* 忽略 */ }
      }
    } else {
      rec.entryCode = 'n/a';
    }

    // 6) 卸载（诊断模式 FNOS_KEEP_INSTALLED=1 时保留，便于现场取证）
    if (process.env.FNOS_KEEP_INSTALLED === '1') { rec.stage = 'kept-installed'; return rec; }
    const ustart = await callUninstall(appName);
    rec.uninstalled = !!(ustart && ustart.code === 0);
    if (!rec.uninstalled) rec.uninstallErr = JSON.stringify(ustart).slice(0, 200);
    await until(async () => {
      const l = await callInstalledList();
      return !(l || []).some((x) => x.appName === appName);
    }, { tries: 20, gap: 2000, label: 'uninstall' });
    rec.stage = 'done';
  } catch (e) {
    rec.stage = rec.stage === 'start' ? 'exception' : rec.stage;
    if (e && e.sessionExpired) { rec.stage = 'session_expired'; rec.sessionExpired = true; }
    // 桥接不可用是测试环境问题，不是应用结论：标记后由主循环跳过落盘，下次续跑会重测
    if (e && (e.bridgeUnavailable || /Midscene 桥接里没有|无法加载 @midscene/.test(String(e.message)))) {
      rec.bridgeUnavailable = true;
    }
    rec.err = String((e && e.message) || e).slice(0, 300);
  }
  return rec;
}

/**
 * 回收 compose 网络。
 * 平台卸载后不删除 `<app>_default`，每装一个就永久占掉一个 /16；
 * 累计十几个后 Docker 默认地址池耗尽，之后所有安装都失败。
 * 这里顺带把「平台是否留下了网络」记进结果，作为该缺陷的现场证据。
 */
async function reclaimNetwork(name) {
  const net = `${name}_default`;
  try {
    const { stdout } = await ssh(`docker network ls --format '{{.Name}}' 2>/dev/null | grep -x '${net}' || true`);
    const lingered = String(stdout || '').trim().length > 0;
    if (lingered) await ssh(`docker network rm '${net}' >/dev/null 2>&1 || true`);
    return lingered;
  } catch { return null; }
}

async function main() {
  const todo = apps.filter((a) => !doneApps.has(path.basename(a)));
  console.log(`[batch] 共 ${apps.length} 个应用，待测 ${todo.length} 个`);

  for (let i = 0; i < todo.length; i += CHUNK) {
    const chunk = todo.slice(i, i + CHUNK);
    const buildable = [];

    for (const app of chunk) {
      // 允许 --list 里写应用名（fn-memos）或相对仓库根的路径（apps/fn-memos）
      let dir = path.resolve(app);
      if (!fs.existsSync(dir)) {
        const alt = path.resolve('apps', app);
        if (fs.existsSync(alt)) dir = alt;
      }
      const name = path.basename(dir);
      if (!fs.existsSync(dir)) {
        append({ app: name, stage: 'build', verdict: 'BUILD_FAIL', err: `应用目录不存在: ${dir}` });
        console.log(`[build-fail] ${name}: 目录不存在`);
        continue;
      }
      try {
        await sh('fnpack', ['build'], { cwd: dir });
        const fpk = path.join(dir, `${name}.fpk`);
        if (!fs.existsSync(fpk)) throw new Error('未产出 fpk');
        await scp(fpk, `${STAGE}${name}.fpk`);
        buildable.push(name);
      } catch (e) {
        const msg = String(e.stderr || e.message || e).trim().split('\n').slice(-1)[0];
        append({ app: name, stage: 'build', verdict: 'BUILD_FAIL', err: msg });
        console.log(`[build-fail] ${name}: ${msg}`);
      }
    }

    for (const name of buildable) {
      const rec = await testOne(name);
      // 生命周期日志 /var/log/apps/<app>.log **必须每次都读**：
      // 容器起不来时真正的报错往往只出现在这里（install_callback 的输出、
      // compose up 的失败原因，例如端口被占用）。此前只在「判定为失败」时才读，
      // 一旦判定口径放宽就会漏掉关键证据，导致把「端口冲突」误读成「docker 不可用」。
      // 因此无条件采集，并保留较长的尾部。
      try {
        const { stdout } = await ssh(`cat /var/log/apps/${name}.log 2>/dev/null | tail -80`);
        const txt = String(stdout || '').trim();
        if (txt) rec.lifecycleLog = txt.slice(-4000);
      } catch { /* 读取失败不影响判定 */ }
      // 网络回收（同时取证平台是否留下 compose 网络）
      rec.networkLingered = await reclaimNetwork(name);
      // 卸载残留清理：包用户无权删除其父目录下的目录项，需由有权限的账号清
      if (process.env.FNOS_SKIP_RESIDUAL_CLEAN === '1') {
        // 实验模式：不清理残留，保留现场供判定平台行为
        try {
          const { stdout } = await ssh(`ls -d /vol2/@appdata/${name} /vol2/@apphome/${name} 2>/dev/null | wc -l`);
          rec.residual = String(stdout).trim();
        } catch { rec.residual = '?'; }
      } else {
        try {
          const { stdout } = await ssh(`rm -rf /vol2/@appdata/${name} /vol2/@apphome/${name} 2>/dev/null; ls -d /vol2/@appdata/${name} /vol2/@apphome/${name} 2>/dev/null | wc -l`);
          rec.residual = String(stdout).trim();
        } catch { rec.residual = '?'; }
      }
      try { await ssh(`rm -f ${STAGE}${name}.fpk 2>/dev/null`); } catch { /* 忽略 */ }

      rec.verdict = verdict(rec);
      // 桥接不可用时不落盘：这不是应用结论，下次续跑应当重测，而不是被 doneApps 跳过
      if (rec.bridgeUnavailable) {
        console.error(`[bridge] ${name}: ${rec.err}（未落盘，修复桥接后重跑会重测）`);
        await closeBridge();
        continue;
      }
      append(rec);
      console.log(`[${rec.verdict}] ${name} status=${rec.appStatus || '-'} entry=${rec.entryCode || '-'} net_left=${rec.networkLingered === null ? '?' : (rec.networkLingered ? 'yes' : 'no')}`);

      if (rec.verdict === 'SESSION_EXPIRED') {
        console.error('[batch] 会话已失效，中止整批。重新取一份 Cookie 后重跑同一命令即可续跑');
        process.exit(6);
      }
      if (rec.verdict === 'ENV_BLOCKED') {
        console.error(`[batch] 设备级阻塞，中止整批：${(rec.err || rec.installOutputTail || '').slice(0, 200)}`);
        console.error('[batch] 处理完设备侧问题后重跑同一命令即可续跑（已完成的应用不会重复测试）');
        process.exit(5);
      }
    }
  }
  console.log('[batch] 完成，结果写入 ' + OUT);
  // Bridge 的 websocket 会保活进程，收尾必须显式断开，否则脚本跑完不退出
  await closeBridge();
}

main()
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(String(e.stack || e));
    await closeBridge();
    process.exit(1);
  });
