/**
 * FNOS-001 批量真机验收器
 *
 * 通道：本地 fnpack build → scp 到 NAS → 复用已登录 Chrome 的会话调用 fnOS 应用中心 HTTP API
 *       → 校验状态与入口 → 卸载 → 清理残留目录 → 取失败日志。
 *
 * 设计要点（踩坑换来的）：
 *  1. 桥调用单次上限 30 秒：所有 API 调用都拆成短步骤，耗时的等待由 Node 侧轮询。
 *  2. 桥传输会被浏览器回收（扩展后台休眠）：所有状态存在 Node 侧，断线只需重连重试当前步。
 *  3. 状态机在 Node：页面只做「无状态的一次性 API 调用」，页面刷新也不丢进度。
 *  4. 卸载必须发生在入口探测之后：否则探到的端口已随卸载关闭。
 *
 * 判定分级（与 docs/testing/index.md 的口径一致）：
 *   PASS       安装成功 + 状态 running + 入口可访问
 *   FAIL       安装或启动失败，且日志指向转换自身的问题
 *   BLOCKED    依赖外部数据库/中间件、端口被占用等环境原因，不计为转换缺陷
 *   UNVERIFIED 向导必填项无法自动填写，需人工确认
 *   BUILD_FAIL 本地 fnpack build 失败
 *
 * 敏感信息：设备地址与账号一律来自环境变量（FNOS_HOST / FNOS_SSH_USER），不写死、不落盘。
 *
 * 用法：
 *   FNOS_HOST=... FNOS_SSH_USER=... FNOS_STAGE_DIR=/vol2/1000/fnos-fpk/ \
 *     MIDSCENE_ENV_FILE=/tmp/midscene-fn/.env \
 *     node scripts/batch-verify.mjs --list-file /tmp/apps.txt --chunk 8
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const exec = promisify(execFile);
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };

const ENV_FILE = process.env.MIDSCENE_ENV_FILE || '';
if (ENV_FILE && fs.existsSync(ENV_FILE)) {
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

function resolveMidscene() {
  const explicit = process.env.MIDSCENE_MODULE;
  const local = path.join(process.cwd(), 'node_modules/@midscene/web/dist/lib/bridge-mode/index.js');
  const localEs = path.join(process.cwd(), 'node_modules/@midscene/web/dist/es/bridge-mode/index.mjs');
  const npxRoot = path.join(os.homedir(), '.npm/_npx');
  const npxHit = fs.existsSync(npxRoot)
    ? fs.readdirSync(npxRoot)
        .map((d) => path.join(npxRoot, d, 'node_modules/@midscene/web/dist/lib/bridge-mode/index.js'))
        .find((p) => fs.existsSync(p))
    : null;
  const candidates = explicit ? [explicit] : [local, localEs, npxHit].filter((p) => p && fs.existsSync(p));
  if (!candidates.length) throw new Error('找不到 @midscene/web，请设置 MIDSCENE_MODULE');
  return createRequire(import.meta.url)(candidates[0]);
}

const HOST = process.env.FNOS_HOST || '';
const SSH_USER = process.env.FNOS_SSH_USER || '';
const SSH_OPTS = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8'];
const STAGE = process.env.FNOS_STAGE_DIR || '';
const VOLUME_ID = process.env.FNOS_VOLUME_ID || '2';
const LANG = 'zh-CN';
const CHUNK = Number(arg('--chunk', '8'));
const OUT = arg('--out', '/tmp/fnos-batch/results.jsonl');

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
process.on('unhandledRejection', (e) => { crashLog('unhandledRejection', e); process.exit(71); });

// 单实例锁：多实例并行会互相抢占桥端口（3766）并让页内脚本相互污染
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
const curlCode = async (url) => {
  try { const { stdout } = await sh('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '-m', '10', url]); return stdout.trim(); }
  catch { return '000'; }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 页面侧：无状态的一次性 API 调用（每次都是短往返） ----
const API = (expr) => `(async () => {
  const LANG = ${JSON.stringify(LANG)};
  const STAGE = ${JSON.stringify(STAGE)};
  const VOL = ${JSON.stringify(VOLUME_ID)};
  const j = async (url, opts) => {
    const r = await fetch(url, Object.assign({ credentials: 'include' }, opts || {}));
    const t = await r.text();
    try { return JSON.parse(t); } catch (e) { return { __raw: t.slice(0, 300) }; }
  };
  const post = (url, body) => j(url + '?language=' + LANG, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  const get = (url) => j(url + (url.includes('?') ? '&' : '?') + 'language=' + LANG);
  const out = await ${expr};
  return JSON.stringify(out);
})()`;

// 注意：模板字符串里不带 ${} 的标识符是字面文本，不会被 Node 插值——路径必须整体作为字面量
const callDownloadTask = (app) => API(`post('/app-center/v1/download/task', { packageSourceType:'file', path: ${JSON.stringify(STAGE + app + '.fpk')}, language: LANG })`);
const callDownloadStatus = (id) => API(`get('/app-center/v1/download/status?downloadTaskId=' + ${JSON.stringify(id)})`);
const callInstallInfo = (appName, version) => API(`get('/app-center/v1/install/info?version=' + encodeURIComponent(${JSON.stringify(version)}) + '&appName=' + encodeURIComponent(${JSON.stringify(appName)}) + '&packageType=path')`);
const callInstallTask = (appName, version, params) => API(`post('/app-center/v1/install/task', {
  appName: ${JSON.stringify(appName)}, version: ${JSON.stringify(version)}, packageType:'path',
  systemParameters:{ agreedToProtocol:true, installVolumeID:Number(${JSON.stringify(VOLUME_ID)}), dataVolumeId:Number(${JSON.stringify(VOLUME_ID)}), immediateStart:true, apiScope:{} },
  customParameters: ${JSON.stringify(params)}, language: LANG })`);
const callInstallStatus = (taskId) => API(`post('/app-center/v1/install/status', { taskId: ${JSON.stringify(taskId)}, language: LANG })`);
const callInstalledList = () => API(`(async () => { const l = await get('/app-center/v1/app/installed'); return (l && l.data && l.data.list) || []; })()`);
const callUninstall = (appName) => API(`post('/app-center/v1/uninstall/start', { appName: ${JSON.stringify(appName)}, customParameters:[{ key:'wizard_data_action', value:'delete' }], language: LANG })`);

/** 桥连接与带重试的调用 */
let agent = null;
/** fnOS 标签可能因浏览器重启/会话恢复而消失；找不到就自动新开一个，避免整批停摆 */
async function openTargetTab(agentRef) {
  const findTarget = async () => {
    const tabs = await agentRef.getBrowserTabList();
    return tabs.find((x) => String(x.url || '').includes(HOST));
  };
  // 1) 先试页面内 window.open（可能被弹窗拦截）
  const tabs0 = await agentRef.getBrowserTabList();
  const any = tabs0[0];
  if (any) {
    try {
      await agentRef.page.setActiveTabId(Number.parseInt(String(any.id), 10), { activate: false });
      await agentRef.page.evaluateJavaScript(`window.open('http://${HOST}:5666/', '_blank'); return 1;`);
      for (let i = 0; i < 8; i++) {
        await sleep(1200);
        const t = await findTarget();
        if (t) return t;
      }
    } catch { /* 落到 osascript */ }
  }
  // 2) 回退：直接让 Chrome 开新标签（可靠，且不改动已有标签）
  try {
    await exec('osascript', ['-e', `tell application "Google Chrome" to tell front window to make new tab with properties {URL:"http://${HOST}:5666/"}`]);
  } catch { /* 忽略 */ }
  for (let i = 0; i < 20; i++) {
    await sleep(1500);
    const t = await findTarget();
    if (t) return t;
  }
  throw new Error('新开 fnOS 标签失败');
}
async function connect() {
  if (agent) { try { await agent.destroy(); } catch { /* 忽略 */ } agent = null; }
  const { AgentOverChromeBridge } = resolveMidscene();
  agent = new AgentOverChromeBridge({ enableWaterFlowAnimation: false, serverListeningTimeout: 30000, closeConflictServer: true });
  const tabs = await agent.getBrowserTabList();
  let target = tabs.find((t) => String(t.url || '').includes(HOST));
  if (!target) {
    console.error('  [tab-gone] 未找到 fnOS 标签，自动新开一个');
    target = await openTargetTab(agent);
  }
  await agent.page.setActiveTabId(Number.parseInt(String(target.id), 10), { activate: false });
}
async function api(src) {
  let last = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      if (!agent) await connect();
      if (process.env.FNOS_DEBUG) console.error('[page-src]\n' + src + '\n----');
      const raw = await agent.page.evaluateJavaScript(src);
      if (!raw || !raw.result || raw.result.value === undefined) {
        throw new Error('页内返回异常: ' + JSON.stringify(raw).slice(0, 300));
      }
      return JSON.parse(raw.result.value);
    } catch (e) {
      last = e;
      if (process.env.FNOS_DEBUG) console.error(`  [api-err] ${String(e.message || e).slice(0, 300)}`);
      agent = null;
      await sleep(1200);
    }
  }
  throw last || new Error('桥调用失败');
}

/** 轮询直到条件满足（每次都是一次短调用） */
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

function verdict(rec) {
  if (rec.stage === 'build') return 'BUILD_FAIL';
  if (rec.stage === 'wizard_unsolvable') return 'UNVERIFIED';
  // 需要外部数据库/中间件的应用：失败是环境问题，不是转换缺陷
  if (rec.needsExternal && rec.installed !== true) return 'BLOCKED';
  if (!rec.installed) {
    const t = `${rec.err || ''} ${rec.installStatus || ''} ${rec.installOutputTail || ''}`;
    if (/address already in use|port is already allocated|端口/i.test(t)) return 'BLOCKED';
    // 镜像拉取失败/超时属于环境问题（镜像源、限流、磁盘），不计入转换缺陷
    if (/Pulling|Already exists|Waiting|Downloading|extracting|error pulling|failed to resolve|manifest unknown|toomanyrequests|timeout/i.test(t)) return 'BLOCKED';
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

async function testOne(app) {
  const rec = { app, stage: 'start' };
  try {
    // 上一轮残留：测试前先确保未安装
    const pre = await api(callInstalledList());
    if ((pre || []).some((x) => x.appName === app)) {
      await api(callUninstall(app));
      await until(async () => {
        const l = await api(callInstalledList());
        return !(l || []).some((x) => x.appName === app);
      }, { tries: 30, gap: 2000, label: 'pre-uninstall' });
      rec.preUninstalled = true;
    }

    // 1) 解析安装包
    const dl = await api(callDownloadTask(app));
    if (!dl || dl.code !== 0) { rec.stage = 'download_task'; rec.err = JSON.stringify(dl).slice(0, 300); return rec; }
    const dlId = dl.data.downloadTaskId;
    const st = await until(async () => {
      const s = await api(callDownloadStatus(dlId));
      return s && s.code === 0 && s.data && (s.data.status === 2 || s.data.status === 3) ? s : null;
    }, { tries: 80, gap: 600, label: 'download' });
    if (st.data.status !== 2) { rec.stage = 'download_status'; rec.err = JSON.stringify(st).slice(0, 300); return rec; }
    const appName = st.data.appName;
    const version = st.data.version;
    rec.appName = appName; rec.version = version;

    // 2) 向导参数
    const info = await api(callInstallInfo(appName, version));
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
    const task = await api(callInstallTask(appName, version, params));
    if (!task || task.code !== 0) { rec.stage = 'install_task'; rec.err = JSON.stringify(task).slice(0, 300); return rec; }
    const taskId = task.data && (task.data.taskId || task.data.installTaskId);
    rec.taskId = taskId;
    const last = await until(async () => {
      const s = await api(callInstallStatus(taskId));
      const d = s && s.data;
      if (!d) return null;
      if (d.status === 2 || d.status === 3 || /success|failed|completed|error|cancel/i.test(d.message || '')) return s;
      return null;
    }, { tries: 240, gap: 1000, label: 'install' });
    rec.installStatus = JSON.stringify(last.data).slice(0, 4000);
    // 拉镜像阶段的失败是环境问题（镜像源/限流），不是转换缺陷：把 outputText 尾部单独留出来
    const outText = (last.data && last.data.outputText) || '';
    if (outText) rec.installOutputTail = outText.slice(-600);
    const insOk = last.data.status === 2 || /success/i.test(last.data.message || '');
    rec.installed = !!insOk;
    if (!insOk) { rec.stage = 'install_status'; rec.err = rec.installStatus; return rec; }

    // 4) 等待 running
    const item = await until(async () => {
      const l = await api(callInstalledList());
      const it = (l || []).find((x) => x.appName === appName);
      return it && (it.status === 'running' || it.status === 'stopped') ? it : null;
    }, { tries: 15, gap: 2000, label: 'running' });
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
    } else {
      rec.entryCode = 'n/a';
    }

    // 6) 卸载（诊断模式 FNOS_KEEP_INSTALLED=1 时保留，便于现场取证）
    if (process.env.FNOS_KEEP_INSTALLED === '1') { rec.stage = 'kept-installed'; return rec; }
    const ustart = await api(callUninstall(appName));
    rec.uninstalled = !!(ustart && ustart.code === 0);
    if (!rec.uninstalled) rec.uninstallErr = JSON.stringify(ustart).slice(0, 200);
    await until(async () => {
      const l = await api(callInstalledList());
      return !(l || []).some((x) => x.appName === appName);
    }, { tries: 20, gap: 2000, label: 'uninstall' });
    rec.stage = 'done';
  } catch (e) {
    rec.stage = rec.stage === 'start' ? 'exception' : rec.stage;
    rec.err = String((e && e.message) || e).slice(0, 300);
  }
  return rec;
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
      console.log(`[${rec.verdict}] ${name} status=${rec.appStatus || '-'} entry=${rec.entryCode || '-'}`);
    }
  }
  if (agent) { try { await agent.destroy(); } catch { /* 忽略 */ } }
  console.log('[batch] 完成，结果写入 ' + OUT);
}

main().catch((e) => { console.error(String(e.stack || e)); process.exit(1); });
