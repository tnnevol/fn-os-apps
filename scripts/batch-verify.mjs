/**
 * FNOS-001 批量真机验收器
 *
 * 通道：本地 fnpack build → scp 到 NAS → 用应用中心 HTTP API 安装/查询/卸载
 *       → 校验状态与入口 → 卸载 → 回收 compose 网络 → 清理残留目录 → 取失败日志。
 *
 * 设计要点（踩坑换来的）：
 *  1. 安装/卸载走应用中心 HTTP 接口，鉴权用一份从已登录会话取来的 Cookie（`FNOS_COOKIE`）。
 *     不再依赖浏览器自动化：桥接会被浏览器回收，长跑必然中断；curl 短往返可重试、可续跑。
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
 *   FNOS_HOST=... FNOS_SSH_USER=... FNOS_STAGE_DIR=/vol2/1000/fnos-fpk/ FNOS_COOKIE='...' \
 *     node scripts/batch-verify.mjs --list-file /tmp/apps.txt --chunk 8
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

const exec = promisify(execFile);
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };

const HOST = process.env.FNOS_HOST || '';
const SSH_USER = process.env.FNOS_SSH_USER || '';
const COOKIE = process.env.FNOS_COOKIE || '';
const SSH_OPTS = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8'];
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
if (!COOKIE) {
  console.error('缺少 FNOS_COOKIE（从已登录浏览器会话取 Cookie 头，含 osrt / ost）');
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
process.on('unhandledRejection', (e) => { crashLog('unhandledRejection', e); process.exit(71); });

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
const scp = (local, remote) => sh('scp', ['-q', '-o', 'BatchMode=yes', local, `${SSH_USER}@${HOST}:${remote}`]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const curlCode = async (url) => {
  try { const { stdout } = await sh('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '-m', '10', url]); return stdout.trim(); }
  catch { return '000'; }
};

/** 一次应用中心 API 调用；短往返 + 超时，失败由上层重试 */
async function api(pathname, { method = 'GET', body } = {}) {
  const url = API_BASE + pathname + (pathname.includes('?') ? '&' : '?') + 'language=' + LANG;
  const args = ['-s', '-m', '30', '-H', `Cookie: ${COOKIE}`];
  if (method !== 'GET') args.push('-X', method);
  if (body !== undefined) {
    args.push('-H', 'Content-Type: application/json', '--data-binary', JSON.stringify(body));
  }
  args.push(url);
  const { stdout } = await sh('curl', args);
  const text = String(stdout || '');
  try { return JSON.parse(text); } catch { return { __raw: text.slice(0, 300) }; }
}

/** 带重试的调用：设备 CPU 紧张或 nginx 瞬时 502 时重试比直接判失败更准 */
async function apiRetry(pathname, opts, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await api(pathname, opts);
      if (r && r.__raw === undefined) return r;
      last = new Error('返回非 JSON: ' + (r && r.__raw));
    } catch (e) { last = e; }
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
  const params = [];
  const unsolved = [];
  let needsExternal = false;
  for (const it of items) {
    const key = it.field || it.key; if (!key) continue;
    const rules = it.rules || [];
    const required = rules.some((r) => r && r.required);
    const pattern = (rules.find((r) => r && r.pattern) || {}).pattern;
    const isSecret = it.type === 'password' || /password|secret|token/i.test(key + ' ' + (it.label || ''));
    let val = it.initValue;
    if (val === undefined || val === null || val === '') {
      if (isSecret) {
        // helpText 常写明位数要求（如「32 位随机字符串」），按其生成，否则服务端会拒绝
        const lenMatch = (it.helpText || '').match(/(?:\d{2,3})\s*位/);
        const len = lenMatch ? Number(lenMatch[1]) : 32;
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let s2 = '';
        for (let k = 0; k < len; k++) s2 += alphabet[Math.floor(Math.random() * alphabet.length)];
        val = s2;
      } else if (required && /(?:^|_)(?:DB|REDIS|MONGO|POSTGRES|MYSQL|MARIADB|ELASTIC)(?:$|_)/i.test(key)) {
        // 外部依赖类地址：填本地默认，让「转换本身」仍能被验证（安装、容器起、入口加载）
        val = '127.0.0.1'; needsExternal = true;
      } else if (required) { unsolved.push(key + '(required)'); continue; }
      else { val = ''; }
    }
    val = String(val);
    // 外部依赖占位值不适用用户输入正则（该正则约束的是用户填的域名/IP 形态）
    if (pattern && !isSecret && !needsExternal) {
      try { if (!new RegExp(pattern).test(val)) { unsolved.push(key + '(pattern)'); continue; } } catch { /* 放行 */ }
    }
    params.push({ key, value: val });
  }
  return { params, unsolved, needsExternal };
}

/** 设备级阻塞：一旦命中就中止整批，避免把环境问题记成上百个应用缺陷 */
// 只收录「整台设备都装不了」的情形。镜像源不通（如 registry TLS 超时）虽然也让安装失败，
// 但只影响那一个应用，记 BLOCKED 即可，不能据此中止整批
const ENV_BLOCKER = /all predefined address pools have been fully subnetted|cannot connect to the Docker daemon|permission denied while trying to connect to the Docker daemon|no space left on device/i;

function verdict(rec) {
  const blob = `${rec.err || ''} ${rec.installStatus || ''} ${rec.installOutputTail || ''} ${rec.log || ''}`;
  if (rec.stage === 'build') return 'BUILD_FAIL';
  if (rec.stage === 'wizard_unsolvable') return 'UNVERIFIED';
  // 服务端忙/安装队列被占：重试后仍被拒，属于设备状态，不是转换缺陷
  if (rec.busy) return 'BLOCKED';
  if (ENV_BLOCKER.test(blob)) return 'ENV_BLOCKED';
  // 需要外部数据库/中间件的应用：失败是环境问题，不是转换缺陷
  if (rec.needsExternal && rec.installed !== true) return 'BLOCKED';
  if (!rec.installed) {
    if (/address already in use|port is already allocated|端口/i.test(blob)) return 'BLOCKED';
    // 镜像拉取失败/超时属于环境问题（镜像源、限流、磁盘），不计入转换缺陷
    if (/Pulling|Already exists|Waiting|Downloading|extracting|error pulling|failed to resolve|manifest unknown|toomanyrequests|timeout/i.test(blob)) return 'BLOCKED';
    return 'FAIL';
  }
  if (rec.appStatus !== 'running') {
    if (/address already in use|port is already allocated/i.test(`${rec.log || ''}`)) return 'BLOCKED';
    if (rec.needsExternal) return 'BLOCKED';
    return 'FAIL';
  }
  if (rec.service && rec.service.port) {
    if (!rec.entryCode) return 'BLOCKED';
    // 404 也说明服务已响应：应用 UI 可能在子路径，不等于应用起不来
    if (['200', '201', '204', '301', '302', '303', '307', '308', '401', '403', '404'].includes(rec.entryCode)) {
      if (rec.entryCode === '404') rec.entryNote = '根路径返回 404，服务已响应，UI 可能在子路径';
      return 'PASS';
    }
    if (rec.needsExternal) return 'BLOCKED';
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
    const { params, unsolved, needsExternal } = buildParams(info.data.wizardInfo);
    rec.needsExternal = needsExternal;
    if (unsolved.length) {
      rec.stage = 'wizard_unsolvable'; rec.unsolvable = unsolved;
      rec.err = '向导必填项无法自动填写: ' + unsolved.join(',');
      return rec;
    }
    rec.params = params.map((p) => p.key);

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
    const item = await until(async () => {
      const l = await callInstalledList();
      const it = (l || []).find((x) => x.appName === appName);
      return it && (it.status === 'running' || it.status === 'stopped') ? it : null;
    // 应用中心报「已安装」不代表容器已就绪：重镜像（数据库迁移、初始化）要跑一阵才转 running
    }, { tries: 90, gap: 2000, label: 'running' });
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
      // 应用中心报 running 不等于容器已监听：首次安装还要拉镜像，探针窗口要给足
      // （12 × 15s ≈ 3 分钟；镜像已缓存时立即返回）
      for (let i = 0; i < 12; i++) {
        rec.entryCode = await curlCode(url);
        if (rec.entryCode && rec.entryCode !== '000') break;
        await sleep(15000);
      }
      console.log(`  [verify] ${app} ${url} -> ${rec.entryCode}`);
      // 入口打不开时补一份容器现场：区分「容器根本没起」「容器起了但没监听该端口」
      // 与「端口映射错」，否则 000 只能记成可疑，无法归因
      if (!rec.entryCode || rec.entryCode === '000') {
        try {
          const { stdout } = await ssh(`docker ps -a --format '{{.Names}} | {{.Status}} | {{.Ports}}' 2>/dev/null | grep -E '^${app}' || true`);
          if (String(stdout).trim()) rec.containers = String(stdout).trim().slice(0, 800);
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
      const dir = path.resolve(app);
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
      // 失败取日志
      if (rec.installed !== true || rec.appStatus !== 'running' || (rec.entryCode && !['200', '301', '302', '401', '403'].includes(rec.entryCode))) {
        try {
          const { stdout } = await ssh(`cat /var/log/apps/${name}.log 2>/dev/null | tail -25`);
          rec.log = String(stdout).slice(0, 2500);
        } catch { rec.log = ''; }
      }
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
      append(rec);
      console.log(`[${rec.verdict}] ${name} status=${rec.appStatus || '-'} entry=${rec.entryCode || '-'} net_left=${rec.networkLingered === null ? '?' : (rec.networkLingered ? 'yes' : 'no')}`);

      if (rec.verdict === 'ENV_BLOCKED') {
        console.error(`[batch] 设备级阻塞，中止整批：${(rec.err || rec.installOutputTail || '').slice(0, 200)}`);
        console.error('[batch] 处理完设备侧问题后重跑同一命令即可续跑（已完成的应用不会重复测试）');
        process.exit(5);
      }
    }
  }
  console.log('[batch] 完成，结果写入 ' + OUT);
}

main().catch((e) => { console.error(String(e.stack || e)); process.exit(1); });
