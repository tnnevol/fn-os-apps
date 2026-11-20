/**
 * 路由定义。
 *
 * 每个处理器保持「薄」：只做参数校验与权限判断，业务落在对应模块。
 * 写操作统一经过 `requireAdmin`，避免某个新接口忘记加鉴权。
 */
import { readFileSync, statfs } from 'node:fs'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { requireAdmin } from '../http/auth.mjs'
import { badRequest, ok } from '../http/respond.mjs'
import { describeFields, isConfigured, readConfig, writeConfig, writeSwitches } from '../config/store.mjs'
import {
  ALIST_ACTIONS,
  alistAction,
  alistLogs,
  alistStatus,
  probeDocker,
  readAlistImage,
  writeAlistImage,
} from '../docker/manager.mjs'
import { cancelTask, cleanupArchive, createTask, getTask, listTasks, packagesStatus } from '../tasks/engine.mjs'
import { create115Qr, createAlipanQr, DEFAULT_QRCODE_APP, poll115Qr, pollAlipanQr, QRCODE_APPS } from '../auth/pan.mjs'
import { createOpenTokenQr, pollOpenTokenQr } from '../auth/open-token.mjs'
import { createFolder as createAliyunFolder, listFolders, resetTokenCache } from '../auth/aliyun-fs.mjs'
import { checkAllCredentials } from '../auth/health-check.mjs'
import { appDest, configDir, isDev, mediaRoot, pkgVar, tempDir } from '../paths.mjs'
import { CLEANER_MODES, readCleanerConfig, runCleaner, writeCleanerConfig } from '../alist/cleaner.mjs'
import { metadataDownloadUrl, probeConnectivity } from '../alist/connectivity.mjs'
import {
  readDockerAddress,
  readProxy,
  readSign,
  writeDockerAddress,
  writeProxy,
} from '../config/sign.mjs'
import {
  hasScheduleLog,
  readSchedule,
  readScheduleLog,
  schedulerRunning,
  scheduleLogPath,
  writeSchedule,
} from '../schedule/runner.mjs'
import { getSharedFolders, hasTrimApi } from '../trim/api.mjs'
import { DEFAULT_AVAILABLE_PATHS, readSyncConfig, writeSyncConfig } from '../sync/metadata.mjs'
import { listMirrors, pickFastestMirror, resetMirrorCache } from '../sync/mirror.mjs'
import { fetchTree } from '../sync/tree.mjs'
import { detectCapacity, MAX_CONCURRENCY, MIN_CONCURRENCY } from '../system/capacity.mjs'
import { listAddresses } from '../system/net.mjs'
import { startSync, syncSnapshot } from '../sync/task.mjs'
import {
  createFolder,
  deleteEntry,
  listDirectory,
  readMediaConfig,
  renameEntry,
  resolveMediaDir,
  setMediaDir,
} from '../trim/media-dir.mjs'

const statfsAsync = promisify(statfs)

/** 应用版本，取自环境变量或回退值。 */
/**
 * 应用版本。
 *
 * 从安装目录的 manifest 读取，避免发版时忘记改代码里的常量
 * （之前写死 '1.0.0'，装到 1.2.5 后接口仍报 1.0.0）。
 */
function readVersion() {
  // 安装到设备后 manifest 不会随 app.tgz 分发（fnpack 只在打包时校验它），
  // 所以优先读随包分发的 version.txt；再退回源码目录的 manifest（开发环境）。
  const candidates = [
    join(appDest, 'server', 'version.txt'),
    resolve(import.meta.dirname, '../../version.txt'),
    resolve(import.meta.dirname, '../../../manifest'),
  ]
  for (const path of candidates) {
    try {
      const text = readFileSync(path, 'utf8').trim()
      if (text !== '') {
        // version.txt 只存版本号；manifest 需要解析 version 字段
        const match = /^version\s*=\s*(.+)$/m.exec(text)
        return match?.[1]?.trim() ?? text
      }
    }
    catch {
      // 该候选路径不存在，继续下一个
    }
  }
  return process.env.XIAOYA_VERSION ?? 'unknown'
}


const VERSION = readVersion()

/** 注册全部接口。 */
export function registerRoutes(router) {
  /* ── 系统 ─────────────────────────────────────────── */

  router.get('/api/system/health', async ({ user }) => {
    const docker = await probeDocker()
    return ok({
      version: VERSION,
      mode: isDev ? 'development' : 'production',
      user,
      // 面板首页据此提示「Docker 不可用」，而不是等到点启动才报错
      docker,
      configured: isConfigured(),
    })
  })

  router.get('/api/system/context', async ({ user }) => {
    return ok({ user, mode: isDev ? 'development' : 'production', version: VERSION })
  })

  router.get('/api/system/fields', async () => ok(describeFields()))

  /** 目录容量：下载前判断空间是否够用。 */
  router.get('/api/system/capacity', async () => {
    const target = mediaRoot
    try {
      const stats = await statfsAsync(target)
      const total = stats.blocks * stats.bsize
      const free = stats.bavail * stats.bsize
      return ok({
        path: target,
        total,
        free,
        used: total - free,
        // 元数据全量包体积较大，保留阈值提示
        recommendedFreeBytes: 100 * 1024 ** 3,
      })
    }
    catch (error) {
      return ok({ path: target, unavailable: true, reason: error.message })
    }
  })

  router.get('/api/system/paths', async () => {
    return ok({ configDir, mediaRoot, pkgVar })
  })

  /** 对外地址候选，供设置页下拉选择。 */
  router.get('/api/system/addresses', async () => {
    return ok({ addresses: listAddresses(), dockerAddress: readDockerAddress() })
  })

  /** 小雅可达性探测：面板据此提示「服务未就绪」而不是等下载失败。 */
  router.get('/api/system/connectivity', async () => ok(await probeConnectivity()))

  /**
   * 诊断接口：各关键目录的存在性、归属与可写性。
   *
   * 排查「没有访问权限」用：容器启动需要写 composeDir，
   * 若该目录在旧版以 root 运行时被创建，归属会变成 root，
   * 之后以包用户身份就写不进去了。
   */
  router.get('/api/system/diag', async () => {
    const { existsSync, statSync, accessSync, constants, readdirSync } = await import('node:fs')
    const { join: pjoin } = await import('node:path')
    const targets = {
      pkgVar,
      composeDir: pjoin(pkgVar, 'compose'),
      configDir,
      mediaRoot,
      stateDir: pjoin(pkgVar, 'state'),
    }
    const result = {}
    for (const [name, dir] of Object.entries(targets)) {
      const item = { path: dir, exists: existsSync(dir) }
      if (item.exists) {
        try {
          const st = statSync(dir)
          item.uid = st.uid
          item.gid = st.gid
          item.mode = `0${(st.mode & 0o777).toString(8)}`
          item.isDir = st.isDirectory()
        }
        catch (error) {
          item.statError = error.message
        }
        try {
          accessSync(dir, constants.W_OK)
          item.writable = true
        }
        catch {
          item.writable = false
        }
        // composeDir 是否已有 compose 文件，能说明是「没建过」还是「建过但不可写」
        if (name === 'composeDir') {
          try {
            item.files = readdirSync(dir)
          }
          catch (error) {
            item.readError = error.message
          }
        }
      }
      result[name] = item
    }

    // 真正跑一次 compose 的静态检查：能定位到底是文件问题还是 docker 权限
    let composeProbe = null
    try {
      const { runDockerRaw } = await import('../docker/manager.mjs')
      if (typeof runDockerRaw === 'function') {
        composeProbe = await runDockerRaw(['compose', '--project-directory', pjoin(pkgVar, 'compose'), '-p', 'fn-xiaoya-native', 'config', '--quiet'])
      }
      else {
        composeProbe = { skipped: 'runDockerRaw 未导出' }
      }
    }
    catch (error) {
      composeProbe = { error: error.message, suggestion: error.suggestion }
    }

    // 时区相关文件是否存在：容器日志时间不对时最先要看这三个
    const { existsSync: exists } = await import('node:fs')
    const timezone = {
      hostLocaltime: exists('/etc/localtime'),
      hostZoneinfo: exists('/usr/share/zoneinfo/Asia/Shanghai'),
      composeFile: exists(pjoin(pkgVar, 'compose', 'docker-compose.yaml')),
    }

    // 把生成的 compose 原文一并返回：环境变量、端口这类问题只能看实际内容定位
    let composeText = null
    try {
      const { readFileSync: readC } = await import('node:fs')
      composeText = readC(pjoin(pkgVar, 'compose', 'docker-compose.yaml'), 'utf8')
    }
    catch {
      composeText = null
    }

    return ok({
      process: { uid: process.getuid?.(), gid: process.getgid?.() },
      dirs: result,
      composeProbe,
      timezone,
      composeText,
    })
  })

  /* ── 定时任务 ─────────────────────────────────────── */

  router.get('/api/schedule', async () => {
    return ok({ schedule: readSchedule(), running: schedulerRunning() })
  })

  router.put('/api/schedule', async ({ user, body }) => {
    requireAdmin(user)
    return ok({ schedule: writeSchedule(body ?? {}), running: schedulerRunning() })
  })

  /** 调度日志：只读末尾若干行，避免大日志拖垮页面。 */
  router.get('/api/schedule/log', async ({ query }) => {
    const tail = Number.parseInt(String(query.tail ?? '200'), 10)
    const limit = Number.isFinite(tail) ? Math.min(Math.max(tail, 1), 2000) : 200
    return ok({
      available: hasScheduleLog(),
      path: scheduleLogPath(),
      lines: readScheduleLog(limit),
    })
  })

  /* ── 配置 ─────────────────────────────────────────── */

  router.get('/api/config', async () => ok(readConfig()))

  router.put('/api/config', async ({ user, body }) => {
    // Refresh Token 变了就清掉 access_token 缓存，否则会继续用旧账号的会话
    if (body?.values?.refreshToken !== undefined) resetTokenCache()
    requireAdmin(user)
    const { values, switches } = body ?? {}
    const result = []
    if (values !== undefined) {
      if (typeof values !== 'object' || values === null) throw badRequest('values 必须是对象', '请刷新页面后重试')
      result.push(writeConfig(values))
    }
    if (switches !== undefined) {
      if (typeof switches !== 'object' || switches === null) throw badRequest('switches 必须是对象', '请刷新页面后重试')
      result.push(writeSwitches(switches))
    }
    return ok({ results: result })
  })

  /* ── 小雅容器 ─────────────────────────────────────── */

  router.get('/api/alist/status', async () => ok(await alistStatus()))

  router.post('/api/alist/action', async ({ user, body }) => {
    requireAdmin(user)
    const action = body?.action
    if (typeof action !== 'string' || !ALIST_ACTIONS.has(action)) {
      throw badRequest('不支持的操作', '仅支持启动、停止、重启、更新')
    }
    return ok(await alistAction(action))
  })

  router.get('/api/alist/logs', async ({ query }) => {
    const tail = Number.parseInt(String(query.tail ?? '200'), 10)
    return ok(await alistLogs(Number.isNaN(tail) ? 200 : tail))
  })

  router.get('/api/alist/image', async () => ok({ image: readAlistImage() }))

  router.put('/api/alist/image', async ({ user, body }) => {
    requireAdmin(user)
    const image = body?.image
    if (typeof image !== 'string') throw badRequest('image 必须是字符串', '请选择镜像版本')
    return ok(writeAlistImage(image))
  })

  /**
   * 网盘凭据有效性检测。
   *
   * 只在进入授权页时由前端调用一次，不做轮询：
   * 这些检测都会打到网盘官方接口，频繁请求会被限流甚至风控。
   */
  router.get('/api/auth/health', async () => {
    return ok(await checkAllCredentials())
  })

  /* ── 阿里云盘：Open Token 扫码 与 目录浏览 ─────────── */

  /** 申请 Open Token 的扫码会话。 */
  router.post('/api/auth/alipan/open-token/qrcode', async ({ user }) => {
    requireAdmin(user)
    return ok(await createOpenTokenQr())
  })

  /** 轮询扫码状态；成功时后端直接把 Open Token 写入配置。 */
  router.get('/api/auth/alipan/open-token/qrcode/:id', async ({ params }) => {
    return ok(await pollOpenTokenQr(params.id))
  })

  /** 列出阿里云盘某个目录下的子目录，用于选择转存目录。 */
  router.get('/api/auth/alipan/folders', async ({ query }) => {
    return ok(await listFolders(query?.parent ?? 'root'))
  })

  /** 在指定目录下新建文件夹（空盘账号常见需求）。 */
  router.post('/api/auth/alipan/folders', async ({ user, body }) => {
    requireAdmin(user)
    return ok(await createAliyunFolder(body?.parent ?? 'root', body?.name))
  })

  /* ── 授权 ─────────────────────────────────────────── */

  router.post('/api/auth/alipan/qrcode', async ({ user }) => {
    requireAdmin(user)
    return ok(await createAlipanQr())
  })

  router.get('/api/auth/alipan/qrcode/:id', async ({ params }) => {
    return ok(await pollAlipanQr(params.id))
  })

  /**
   * 生成 115 扫码会话。
   *
   * app 表示扫码绑定的设备端（微信小程序 / 支付宝小程序 / iOS 等），
   * 不同端换到的 Cookie 设备类型不同，风控等级也不同。
   */
  router.post('/api/auth/115/qrcode', async ({ user, body }) => {
    requireAdmin(user)
    return ok(await create115Qr(body?.app))
  })

  /** 可选的 115 扫码端列表，供前端下拉。 */
  router.get('/api/auth/115/apps', async () => {
    return ok({ apps: QRCODE_APPS, defaultApp: DEFAULT_QRCODE_APP })
  })

  router.get('/api/auth/115/qrcode/:id', async ({ params }) => {
    return ok(await poll115Qr(params.id))
  })

  /* ── 元数据目录（飞牛授权目录） ───────────────────── */

  /** 当前目录配置 + 是否具备授权能力。 */
  router.get('/api/media/dir', async () => {
    const config = readMediaConfig()
    const resolved = resolveMediaDir()
    return ok({
      ...config,
      path: resolved,
      configured: resolved !== null,
      // 开发机没有飞牛 API，前端据此隐藏「选择目录」并给出说明
      authAvailable: hasTrimApi(),
    })
  })

  /** 已授权给本应用的目录列表（供「选择已有授权目录」下拉使用）。 */
  router.get('/api/media/roots', async () => {
    /**
     * 演示数据。
     *
     * 真实授权目录列表只能在飞牛宿主里拿到，开发环境验证树形选择器时
     * 需要一个稳定的数据源；用显式环境变量开启，避免误用于生产。
     */
    if (isDev && process.env.XIAOYA_DEMO_ROOTS === '1') {
      return ok({
        available: true,
        paths: ['/vol2/1000/xiaoya-meta', '/vol2/1000/music-古典', '/vol1/1000/media'],
        reason: '',
      })
    }
    const result = await getSharedFolders()
    return ok({ available: result.ok, paths: result.paths, reason: result.ok ? '' : result.reason })
  })

  /** 保存用户选定的元数据目录。 */
  router.put('/api/media/dir', async ({ user, body }) => {
    requireAdmin(user)
    const saved = await setMediaDir({ root: body?.root, subdir: body?.subdir ?? '' })
    return ok({ ...saved, path: resolveMediaDir() })
  })

  /** 浏览目录（仅限授权范围内）。 */
  router.get('/api/media/list', async ({ user, query }) => {
    return ok(await listDirectory(String(query.path ?? ''), user.uid))
  })

  /** 新建文件夹。 */
  router.post('/api/media/folder', async ({ user, body }) => {
    requireAdmin(user)
    const parent = String(body?.parent ?? '')
    const name = String(body?.name ?? '')
    if (name.trim() === '') throw badRequest('请填写文件夹名称', '名称不能为空')
    // 拼接父目录与名称；校验在 media-dir 内统一做
    const path = parent === '' ? name : `${parent.replace(/\/+$/, '')}/${name.trim()}`
    return ok(await createFolder(path, user.uid))
  })

  /** 重命名。 */
  router.post('/api/media/rename', async ({ user, body }) => {
    requireAdmin(user)
    const from = String(body?.from ?? '')
    const to = String(body?.to ?? '')
    if (from === '' || to === '') throw badRequest('缺少重命名参数', '请刷新后重试')
    return ok(await renameEntry(from, to, user.uid))
  })

  /** 删除。 */
  router.delete('/api/media/entry', async ({ user, body, query }) => {
    requireAdmin(user)
    const path = String(body?.path ?? query.path ?? '')
    if (path === '') throw badRequest('缺少要删除的路径', '请刷新后重试')
    return ok(await deleteEntry(path, user.uid))
  })

  /* ── 115 清理（原生实现，不依赖伴随容器） ──────────── */

  /** 读取清理配置与可用模式。 */
  router.get('/api/alist/cleaner', async () => {
    return ok({ config: readCleanerConfig(), modes: CLEANER_MODES })
  })

  /** 保存清理模式。 */
  router.put('/api/alist/cleaner', async ({ user, body }) => {
    requireAdmin(user)
    return ok({ config: writeCleanerConfig(String(body?.mode ?? 'off')) })
  })

  /** 立即执行一次清理。 */
  router.post('/api/alist/cleaner/run', async ({ user }) => {
    requireAdmin(user)
    const { mode } = readCleanerConfig()
    return ok(await runCleaner(mode))
  })

  /* ── 元数据同步（对齐 xiaoya_db） ─────────────────── */

  /** 同步配置 + 可用目录清单。 */
  router.get('/api/sync', async () => {
    const config = readSyncConfig()
    // 兜底清单只用于「目录树还没抓到时」的初始展示。
    // 真正可选目录由 /api/sync/tree 实时抓取；这里把已保存的目录并进来，
    // 保证用户自建目录（例如「测试」）即使不在兜底清单里也能回显。
    const availablePaths = [...new Set([...DEFAULT_AVAILABLE_PATHS, ...config.paths])]
    return ok({
      config,
      availablePaths,
      state: syncSnapshot(),
      // 面板据此展示「推荐并发」并给出调整区间
      capacity: detectCapacity(),
      limits: { min: MIN_CONCURRENCY, max: MAX_CONCURRENCY },
    })
  })

  /** 保存同步配置。 */
  router.put('/api/sync', async ({ user, body }) => {
    requireAdmin(user)
    return ok({ config: writeSyncConfig(body ?? {}) })
  })

  /** 立即同步一次。 */
  router.post('/api/sync/run', async ({ user }) => {
    requireAdmin(user)
    return ok(startSync())
  })

  /** 目录树：由后端代理镜像抓取，避免浏览器跨域与直连不可达。 */
  router.get('/api/sync/tree', async ({ query }) => {
    const depth = Number(query?.depth ?? 1)
    return ok(await fetchTree(query?.path ?? '', Number.isFinite(depth) ? depth : 1))
  })

  /** 镜像测速结果；用于面板展示「当前使用哪个镜像」。 */
  router.get('/api/sync/mirrors', async () => {
    return ok(await listMirrors())
  })

  /** 重新测速（清缓存后重跑一轮）。 */
  router.post('/api/sync/mirrors/probe', async ({ user }) => {
    requireAdmin(user)
    resetMirrorCache()
    const best = await pickFastestMirror()
    return ok(best)
  })

  /** 同步进度与日志。 */
  router.get('/api/sync/state', async () => {
    return ok(syncSnapshot())
  })

  /* ── 元数据任务 ───────────────────────────────────── */

  router.get('/api/metadata/packages', async () => ok({ packages: packagesStatus() }))

  router.get('/api/metadata/tasks', async () => ok({ tasks: listTasks() }))

  router.post('/api/metadata/tasks', async ({ user, body }) => {
    requireAdmin(user)
    return ok(createTask({ type: body?.type, package: body?.package, dirs: body?.dirs }))
  })

  router.get('/api/metadata/tasks/:id', async ({ params, query }) => {
    const offset = Number.parseInt(String(query.logOffset ?? '0'), 10)
    return ok(getTask(params.id, { logOffset: Number.isNaN(offset) ? 0 : offset }))
  })

  router.post('/api/metadata/tasks/:id/cancel', async ({ user, params }) => {
    requireAdmin(user)
    return ok(cancelTask(params.id))
  })

  /**
   * 诊断：查看已下载压缩包的真实内容特征。
   *
   * 排「下载成功但解压失败」用：小雅未就绪时下载地址会返回 HTML 错误页，
   * HTTP 200、字节数完整，只有看文件头才能识破。
   */
  router.get('/api/metadata/packages/:name/inspect', async ({ params }) => {
    const { existsSync: exists, readFileSync, statSync } = await import('node:fs')
    const { join: pjoin } = await import('node:path')
    const file = pjoin(tempDir, params.name)
    if (!exists(file)) return ok({ exists: false })
    const size = statSync(file).size
    // 只读前 64 字节就够判断类型
    const fd = readFileSync(file, { encoding: null, flag: 'r' })
    const head = fd.subarray(0, 64)
    const text = head.toString('utf8')
    const isHtml = /^\s*<(?:!doctype|html|head)/i.test(text)
    const is7z = head[0] === 0x37 && head[1] === 0x7a && head[2] === 0xbc && head[3] === 0xaf
    return ok({
      exists: true,
      size,
      headHex: head.subarray(0, 8).toString('hex'),
      headText: text.slice(0, 120),
      looksLike: is7z ? '7z' : (isHtml ? 'html（错误页）' : 'unknown'),
    })
  })

  router.delete('/api/metadata/packages/:name', async ({ user, params }) => {
    requireAdmin(user)
    return ok(cleanupArchive(params.name))
  })

  /** 任务日志文件位置，便于用户在应用数据目录里查看完整历史。 */
  router.get('/api/metadata/logs/path', async () => ok({ path: join(pkgVar, 'state', 'tasks.json') }))
}
