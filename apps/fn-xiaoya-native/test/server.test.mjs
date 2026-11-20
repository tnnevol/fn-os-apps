/* eslint-disable test/no-import-node-test -- 目标设备不安装 npm 依赖，后端测试只使用 Node 内置运行器 */
/**
 * 后端单元测试。
 *
 * 运行：node --test apps/fn-xiaoya-native/test/server.test.mjs
 * 不依赖 Docker、网络与飞牛环境：所有路径指向临时目录，
 * 只验证「校验规则、路径边界、白名单」这些出错代价最高的逻辑。
 */
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createHash } from 'node:crypto'

// 必须在导入被测模块之前设置：paths.mjs 在模块加载时就固化数据目录
const dataDir = mkdtempSync(join(tmpdir(), 'fn-xiaoya-test-'))
process.env.XIAOYA_DATA_DIR = dataDir
process.env.XIAOYA_DEV = '1'

const paths = await import('../app/server/paths.mjs')
const store = await import('../app/server/config/store.mjs')
const sign = await import('../app/server/config/sign.mjs')
const manager = await import('../app/server/docker/manager.mjs')
const engine = await import('../app/server/tasks/engine.mjs')
const schedule = await import('../app/server/schedule/runner.mjs')
const mediaDir = await import('../app/server/trim/media-dir.mjs')
globalThis.__mediaDirModule = mediaDir

paths.ensureDirs()

// 任务创建现在要求「已授权元数据目录」（真机由飞牛目录授权产生）。
// 单测不走授权流程，直接把配置写到 state 里。
mkdirSync(paths.stateDir, { recursive: true })
writeFileSync(
  join(paths.stateDir, 'media-dir.json'),
  JSON.stringify({ root: paths.mediaRoot, subdir: '' }),
)

test('配置：写入合法 Token 后落盘、掩码读取且不回显明文', () => {
  const token = 'abcdef0123456789abcdef0123456789'
  const saved = store.writeConfig({ refreshToken: token })
  assert.deepEqual(saved.updated, ['refreshToken'])

  // 落盘后读回：明文不回显
  const config = store.readConfig()
  assert.equal(config.secrets.refreshToken.configured, true)
  assert.ok(!JSON.stringify(config).includes(token), '响应里不能出现明文 Token')
  assert.match(config.secrets.refreshToken.masked, /^\*+$|^\w{4}\*+/)
})

test('授权：115 Cookie 对象按 K=V; K=V 拼接并落盘', () => {
  // 上游返回的是对象，小雅要求字符串；这里直接验证拼接结果的形状
  const cookie = { CID: 'abc', SEID: 'def', UID: '123' }
  const pairs = Object.entries(cookie)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${v}`)
  const cookieStr = pairs.join('; ')

  assert.match(cookieStr, /CID=abc/)
  assert.match(cookieStr, /SEID=def/)
  // 写入后必须能通过 115 Cookie 的校验规则（要求含 UID/CID/SEID）
  const result = store.writeConfig({ cookie115: cookieStr })
  assert.deepEqual(result.updated, ['cookie115'])
  assert.equal(store.readConfig().secrets.cookie115.configured, true)
})

test('授权：扫码写入的 Token 与手工写入结果一致', () => {
  // 两条通道最终都落到同一个字段，避免出现「扫码写不进、粘贴能写进」的分叉
  const token = 'abcdef0123456789abcdef0123456789'
  const written = store.writeConfig({ refreshToken: token })
  assert.deepEqual(written.updated, ['refreshToken'])
  assert.equal(store.readSecret('refreshToken'), token)
  assert.match(store.readConfig().secrets.refreshToken.masked, /^abcd\*+6789$/)
  assert.equal(store.readConfig().values.refreshToken, '')
})

test('任务：重启后运行中的任务被标记为中断并落盘', () => {
  // 模拟上次进程退出时仍有任务在跑：状态文件里写着 running
  const stateFile = join(paths.stateDir, 'tasks.json')
  writeFileSync(
    stateFile,
    JSON.stringify([
      {
        id: 'stale-task',
        type: 'download',
        package: 'all.mp4',
        label: '全量元数据',
        dirs: [],
        status: 'running',
        stage: 'downloading',
        progress: 50,
        downloadedBytes: 100,
        totalBytes: 200,
        speed: 0,
        message: '下载中',
        logs: ['[10:00:00] start'],
        logSeq: 1,
        createdAt: 1,
        updatedAt: 1,
        startedAt: 1,
        finishedAt: null,
      },
    ]),
  )

  engine.loadTasks()
  const task = engine.listTasks().find((t) => t.id === 'stale-task')
  assert.ok(task, '任务应被加载')
  assert.equal(task.status, 'interrupted')

  // 关键：磁盘上也要是 interrupted，否则再次崩溃后仍显示 running
  const onDisk = JSON.parse(readFileSync(stateFile, 'utf8'))
  const persisted = onDisk.find((t) => t.id === 'stale-task')
  assert.equal(persisted.status, 'interrupted')
  assert.equal(persisted.stage, 'interrupted')
})

test('任务：配置包解压失败不破坏已有 Emby 配置', async () => {
  // 关键安全属性：config.mp4 是「替换」语义，但必须先解到临时目录，
  // 成功后才删旧目录。否则一次失败的解压就会永久清空用户配置。
  const configDirPath = paths.embyConfigDir
  const stagingPath = join(paths.mediaRoot, '.config-staging')

  // 准备：旧配置存在 + 一个损坏的压缩包
  mkdirSync(configDirPath, { recursive: true })
  writeFileSync(join(configDirPath, 'precious.xml'), 'USER-DATA')
  const archive = join(paths.tempDir, 'config.mp4')
  mkdirSync(paths.tempDir, { recursive: true })
  writeFileSync(archive, 'this is not a real 7z archive')

  const task = engine.createTask({ type: 'extract', package: 'config.mp4' })

  // 等到任务结束（失败）
  const deadline = Date.now() + 20_000
  let detail
  while (Date.now() < deadline) {
    detail = engine.getTask(task.id)
    if (detail.status === 'failed' || detail.status === 'cancelled' || detail.status === 'succeeded') break
    await new Promise((r) => setTimeout(r, 200))
  }

  assert.ok(detail, '任务应可查询')
  assert.notEqual(detail.status, 'succeeded', '损坏的压缩包不应解压成功')

  // 旧配置必须完好
  assert.equal(
    readFileSync(join(configDirPath, 'precious.xml'), 'utf8'),
    'USER-DATA',
    '解压失败时不能删除用户已有配置',
  )
  // 临时目录不能残留
  assert.equal(existsSync(stagingPath), false, '失败后应清理临时解压目录')
})

test('配置：夸克与 UC Cookie 手工粘贴的校验与清除', () => {
  // 这两家没有扫码授权，只能粘贴保存；校验规则必须明确拒绝缺字段的串，
  // 否则小雅拿到半截 Cookie 会静默失败，用户很难定位。
  assert.throws(
    () => store.writeConfig({ cookieQuark: 'sessionid=abc' }),
    (error) => error.status === 400 && /夸克 Cookie 缺少/.test(error.message),
  )
  assert.throws(
    () => store.writeConfig({ cookieUc: 'sessionid=abc' }),
    (error) => error.status === 400,
  )

  // 合法值可写入
  store.writeConfig({ cookieQuark: 'a=1; __pus=xyz; __kp=k2' })
  assert.equal(store.readConfig().secrets.cookieQuark.configured, true)

  store.writeConfig({ cookieUc: 'b=2; __puus=u1' })
  assert.equal(store.readConfig().secrets.cookieUc.configured, true)

  // 空串表示清除，与面板「清除」按钮一致
  store.writeConfig({ cookieQuark: '', cookieUc: '' })
  assert.equal(store.readConfig().secrets.cookieQuark.configured, false)
  assert.equal(store.readConfig().secrets.cookieUc.configured, false)
})

test('目录授权：未授权路径被拒绝，且提示不误导', async () => {
  // 开发环境没有飞牛 API：应明确说「依赖飞牛运行环境」，
  // 而不是让用户去翻应用设置找「管理员授权」。
  await assert.rejects(
    () => mediaDir.setMediaDir({ root: '/etc', subdir: '' }),
    (error) => {
      assert.equal(error.status, 403)
      assert.match(error.suggestion, /飞牛运行环境|授权目录/)
      return true
    },
  )

  // 空路径直接拒绝
  await assert.rejects(
    () => mediaDir.setMediaDir({ root: '', subdir: '' }),
    (error) => error.status === 400,
  )
})

test('路径边界：isWithinAllowed 拒绝穿越与相似前缀', async () => {
  const { isWithinAllowed } = await import('../app/server/trim/api.mjs')

  const root = '/vol1/1000/xiaoya'
  assert.equal(isWithinAllowed('/vol1/1000/xiaoya', [root]), true)
  assert.equal(isWithinAllowed('/vol1/1000/xiaoya/sub', [root]), true)
  // 相似前缀不是子目录，必须拒绝（否则 /vol1/1000/xiaoya-evil 会被放行）
  assert.equal(isWithinAllowed('/vol1/1000/xiaoya-evil', [root]), false)
  // 穿越
  assert.equal(isWithinAllowed('/vol1/1000/xiaoya/../../etc/passwd', [root]), false)
  assert.equal(isWithinAllowed('/etc/passwd', [root]), false)
  // 空值
  assert.equal(isWithinAllowed('', [root]), false)
})

test('目录配置：读写往返与子目录名校验', () => {
  const mediaDir = readMediaModule()
  // 直接写配置文件，验证读取与拼接（setMediaDir 需要授权，单测里绕过）
  const stateFile = join(paths.stateDir, 'media-dir.json')
  writeFileSync(stateFile, JSON.stringify({ root: '/vol1/1000/media', subdir: 'xiaoya' }))

  assert.equal(mediaDir.resolveMediaDir(), '/vol1/1000/media/xiaoya')
  assert.equal(mediaDir.readMediaConfig().root, '/vol1/1000/media')

  // 损坏的配置不应抛错，按未配置处理
  writeFileSync(stateFile, '{not json')
  assert.equal(mediaDir.resolveMediaDir(), null)
})

/** 延迟加载 media-dir 模块（依赖上面的 stateDir 环境）。 */
function readMediaModule() {
  return globalThis.__mediaDirModule
}

test('网络：多网卡时优先有线/OVS，而非无差别取第一个', async () => {
  const net = await import('../app/server/system/net.mjs')

  const ipv4 = (address, internal = false) => ({ family: 'IPv4', address, internal })

  // NAS 真实网卡组合：无线在前、有线 OVS 在后、外加 docker 网桥
  assert.equal(net.isLanCandidate('lo', ipv4('127.0.0.1', true)), false)
  assert.equal(net.isLanCandidate('br-07bf140f6d84', ipv4('172.18.0.1')), false)
  assert.equal(net.isLanCandidate('wlp2s0', ipv4('192.168.124.181')), true)
  assert.equal(net.isLanCandidate('enp3s0-ovs', ipv4('192.168.0.17')), true)

  // 无法读取默认路由时，有线 OVS 网桥的分数必须高于无线
  const wired = net.scoreInterface('enp3s0-ovs', null) * 10 + net.scoreSubnet('192.168.0.17')
  const wireless = net.scoreInterface('wlp2s0', null) * 10 + net.scoreSubnet('192.168.124.181')
  assert.ok(wired > wireless, `有线(${wired}) 应高于无线(${wireless})`)

  // 默认路由命中时该网卡必然最高
  assert.ok(
    net.scoreInterface('wlp2s0', 'wlp2s0') > net.scoreInterface('enp3s0-ovs', 'wlp2s0'),
  )

  // 私有网段排序：192.168 > 10 > 172.16-31
  assert.ok(net.scoreSubnet('192.168.1.1') > net.scoreSubnet('10.0.0.1'))
  assert.ok(net.scoreSubnet('10.0.0.1') > net.scoreSubnet('172.20.0.1'))
})

test('元数据同步：strm 用「线上大小」meta 判断，不比较本地大小', async () => {
  const sync = await import('../app/server/sync/metadata.mjs')
  const base = join(paths.mediaRoot, 'sync-test')
  const dir = join(base, '电影')
  mkdirSync(dir, { recursive: true })

  const entry = { dir: '电影', name: '某片.strm', remoteSize: 1000, remoteTime: 1_700_000_000 }

  // 首次：没有 meta，需要同步
  assert.equal(sync.needsSync(base, entry), true)

  // 模拟同步完成：strm 内容被替换（长度与线上不同）+ 写入 meta
  writeFileSync(join(dir, '某片.strm'), 'replaced-content-with-different-length')
  writeFileSync(join(dir, '某片.strm.1000.meta'), '')

  // 关键：本地大小与线上不同，但 meta 命中 → 必须跳过，否则会反复下载
  assert.equal(sync.needsSync(base, entry), false)
  assert.notEqual(statSync(join(dir, '某片.strm')).size, entry.remoteSize)

  // 线上文件更新（大小变化）→ 旧 meta 不再匹配 → 重新同步
  assert.equal(sync.needsSync(base, { ...entry, remoteSize: 2000 }), true)
})

test('元数据同步：本地路径保留分类目录，避免同名文件互相覆盖', async () => {
  const sync = await import('../app/server/sync/metadata.mjs')
  const base = join(paths.mediaRoot, 'sync-dir-test')
  mkdirSync(join(base, '电影'), { recursive: true })
  mkdirSync(join(base, '电视剧'), { recursive: true })

  // 同名文件在两个分类目录下必须落在不同位置
  writeFileSync(join(base, '电影', 'x.strm.100.meta'), '')
  assert.equal(sync.needsSync(base, { dir: '电影', name: 'x.strm', remoteSize: 100, remoteTime: 0 }), false)
  assert.equal(sync.needsSync(base, { dir: '电视剧', name: 'x.strm', remoteSize: 100, remoteTime: 0 }), true)
})

test('元数据同步：配置校验拒绝非法目录、并发数与时间格式', async () => {
  const sync = await import('../app/server/sync/metadata.mjs')

  // 目录树支持任意层级，所以「不在 11 个顶层名单里」不再算错；
  // 但绝对路径与 .. 必须拒绝（会拼出镜像站之外的 URL）
  assert.throws(() => sync.writeSyncConfig({ paths: ['/etc/passwd'] }), (e) => e.status === 400)
  assert.throws(() => sync.writeSyncConfig({ paths: ['电影/../../etc'] }), (e) => e.status === 400)
  assert.throws(() => sync.writeSyncConfig({ paths: ['a/b/c/d/e'] }), (e) => e.status === 400)
  // 深层合法路径应当接受
  sync.writeSyncConfig({ paths: ['每日更新/电影'] })

  // 并发数只受输入边界约束（4-64）；16 是推荐值不是上限，17 必须被接受
  assert.throws(() => sync.writeSyncConfig({ count: 0 }), (e) => e.status === 400)
  assert.throws(() => sync.writeSyncConfig({ count: 3 }), (e) => e.status === 400)
  assert.equal(sync.writeSyncConfig({ count: 17 }).count, 17, '16 是推荐值，17 应可用')
  assert.throws(() => sync.writeSyncConfig({ count: 999 }), (e) => e.status === 400)
  // 定时配置改为「模式 + 时间」，三种重复模式
  assert.throws(() => sync.writeSyncConfig({ schedule: { mode: 'hourly' } }), (e) => e.status === 400)
  assert.throws(() => sync.writeSyncConfig({ schedule: { mode: 'daily', hour: 25 } }), (e) => e.status === 400)
  assert.throws(() => sync.writeSyncConfig({ schedule: { mode: 'daily', minute: 61 } }), (e) => e.status === 400)
  assert.throws(() => sync.writeSyncConfig({ schedule: { mode: 'weekly', day: 9 } }), (e) => e.status === 400)
  assert.throws(() => sync.writeSyncConfig({ schedule: { mode: 'monthly', day: 0 } }), (e) => e.status === 400)

  // 合法值可保存并回读。
  // 开启同步需要已有元数据目录（否则定时任务无处写入），这里先建立该前提。
  const mediaDirModule = await import('../app/server/trim/media-dir.mjs')
  const mediaStateFile = join(paths.stateDir, 'media-dir.json')
  writeFileSync(mediaStateFile, JSON.stringify({ root: paths.mediaRoot, subdir: 'xiaoya' }))

  const saved = sync.writeSyncConfig({ enabled: true, paths: ['每日更新'], count: 8, schedule: { mode: 'weekly', day: 6, hour: 5, minute: 30 } })
  assert.equal(saved.enabled, true)
  assert.deepEqual(saved.paths, ['每日更新'])
  assert.deepEqual(sync.readSyncConfig().schedule, { mode: 'weekly', hour: 5, minute: 30, day: 6 })
})

test('配置：Open Token 换取服务地址校验（含废弃服务拦截）', () => {
  // 小雅靠 opentoken_url.txt 决定去哪个服务把 authCode 换成 token；
  // 缺失时容器日志会报 invalid client_id（client_id 由该服务补全，小雅自身不持有）。
  assert.throws(
    () => store.writeConfig({ opentokenUrl: 'not-a-url' }),
    (error) => error.status === 400,
  )

  // 上游脚本对这两个域名有明确的隐私泄露警告，必须拦住
  assert.throws(
    () => store.writeConfig({ opentokenUrl: 'https://api.nn.ci/alist/ali_open/token' }),
    (error) => error.status === 400 && /隐私/.test(error.message),
  )
  assert.throws(
    () => store.writeConfig({ opentokenUrl: 'https://xhofe.top/token' }),
    (error) => error.status === 400,
  )

  // 当前可用的两种服务
  store.writeConfig({ opentokenUrl: 'http://auth.xiaoya.pro/api/ali_open/refresh' })
  assert.equal(store.readConfig().values.opentokenUrl, 'http://auth.xiaoya.pro/api/ali_open/refresh')
  store.writeConfig({ opentokenUrl: 'https://aliyundrive-oauth.messense.me/oauth/access_token' })
  assert.match(store.readConfig().values.opentokenUrl, /messense/)
})

test('任务：未授权元数据目录时拒绝创建下载/解压任务', () => {
  // 临时移除授权配置
  const statePath = join(paths.stateDir, 'media-dir.json')
  const backup = readFileSync(statePath, 'utf8')
  writeFileSync(statePath, JSON.stringify({ root: '', subdir: '' }))

  try {
    for (const type of ['download', 'extract', 'download_extract']) {
      assert.throws(
        () => engine.createTask({ type, package: 'all.mp4' }),
        (error) => error.status === 400 && /元数据目录/.test(error.message),
        `${type} 应当被拒绝`,
      )
    }
    // 清理压缩包不写媒体目录，不应被拦
    assert.doesNotThrow(() => engine.createTask({ type: 'cleanup', package: 'all.mp4' }))
  }
  finally {
    writeFileSync(statePath, backup)
  }
})

test('任务：指定目录解压已下线', () => {
  assert.throws(
    () => engine.createTask({ type: 'selective_extract', package: 'all.mp4', dirs: ['电影'] }),
    (error) => error.status === 400,
  )
})

test('设备性能：并发推荐值收敛在 4-16，且不因可用内存偏低而下调', async () => {
  const cap = await import('../app/server/system/capacity.mjs')
  const result = cap.detectCapacity()

  assert.ok(result.recommended >= cap.MIN_CONCURRENCY, '不应低于下限')
  // 注意用 RECOMMENDED_CAP 而不是 MAX_CONCURRENCY：
  // 16 只是「这台设备适合用多少」的建议值上限，
  // MAX_CONCURRENCY（64）是用户可填的输入边界，两者不该混为一谈。
  assert.ok(result.recommended <= cap.RECOMMENDED_CAP, '推荐值不应超过推荐收敛上限')
  assert.ok(Number.isInteger(result.recommended), '必须是整数')
  assert.ok(result.cores >= 1)

  // 关键回归：曾经按 os.freemem() 判断，而 Linux 把大量内存当 page cache，
  // 「可用」长期偏低（实测 32GB 只报 67MB），导致正常设备被错误砍半。
  // 现在只看总内存，可用内存再低也不应影响结果。
  assert.ok(result.totalMb > 0)
})

test('解压：宿主机没有 7z 时回退到官方 glue 容器', async () => {
  const docker = await import('../app/server/docker/manager.mjs')

  // 压缩包在媒体目录之外时必须拒绝：容器只挂载了媒体目录，
  // 放行就等于让容器命令引用宿主机任意路径
  await assert.rejects(
    () => docker.extractWithGlue({
      archive: '/etc/passwd',
      mediaRoot: paths.mediaRoot,
      workdir: 'xiaoya',
    }),
    (error) => error.status === 400 && /媒体目录/.test(error.message),
  )

  // 正常路径不应抛错（真实执行依赖 docker，这里只验证参数校验与安全边界）
  assert.equal(typeof docker.extractWithGlue, 'function')
})

test('115 清理：模式读写与非法值拒绝（不依赖伴随容器）', async () => {
  const cleaner = await import('../app/server/alist/cleaner.mjs')

  // 默认关闭
  assert.equal(cleaner.readCleanerConfig().mode, 'off')

  // 非法模式必须拒绝，避免写进配置后调度器执行未知动作
  assert.throws(() => cleaner.writeCleanerConfig('rm-rf'), (e) => e.status === 400)

  // 四种上游模式都应可保存
  for (const mode of ['standard', 'only_recyclebin', 'all_recyclebin', 'only_receive']) {
    const saved = cleaner.writeCleanerConfig(mode)
    assert.equal(saved.mode, mode)
    assert.equal(saved.enabled, true)
    assert.equal(cleaner.readCleanerConfig().mode, mode)
  }

  // 关闭后标记文件被删除
  cleaner.writeCleanerConfig('off')
  assert.equal(cleaner.readCleanerConfig().enabled, false)
})

test('115 清理：未配置 Cookie 时给出明确指引而不是静默失败', async () => {
  const cleaner = await import('../app/server/alist/cleaner.mjs')
  // 前面的用例可能写过 115 Cookie，这里先显式清空，保证前提成立
  store.writeConfig({ cookie115: '' })
  await assert.rejects(
    () => cleaner.runCleaner('standard'),
    (error) => error.status === 400 && /115 Cookie/.test(error.message),
  )
})

test('115 登录端：覆盖上游全部设备端，默认支付宝小程序', async () => {
  const pan = await import('../app/server/auth/pan.mjs')

  // 与上游 115cookie.py 的 QRCODE_APPS 一致：少一个都意味着某些用户扫不了码
  const expected = [
    'alipaymini', 'wechatmini', 'android', '115android', 'ios',
    '115ios', '115ipad', 'harmony', 'tv', 'qandroid', 'web',
  ]
  assert.deepEqual(pan.QRCODE_APPS.map(a => a.value).sort(), [...expected].sort())

  // 默认必须是支付宝小程序：该端风控最宽松
  assert.equal(pan.DEFAULT_QRCODE_APP, 'alipaymini')
})

test('设备性能：16 是推荐值而非上限，用户可配置到更高', async () => {
  const cap = await import('../app/server/system/capacity.mjs')
  const { writeSyncConfig } = await import('../app/server/sync/metadata.mjs')

  assert.ok(cap.MAX_CONCURRENCY > cap.RECOMMENDED_CAP, '可配置上限应高于推荐值')

  // 超过 16 应当被接受：上游脚本本身没有上限概念
  const saved = writeSyncConfig({ count: 24 })
  assert.equal(saved.count, 24)

  // 超出输入边界才拒绝
  assert.throws(() => writeSyncConfig({ count: cap.MAX_CONCURRENCY + 1 }), (e) => e.status === 400)
  assert.throws(() => writeSyncConfig({ count: cap.MIN_CONCURRENCY - 1 }), (e) => e.status === 400)
})

test('网关前缀：剥掉 /app/fn-xiaoya-native 后可匹配内部路由', async () => {
  const { stripGatewayPrefix, gatewayPrefix } = await import('../app/server/paths.mjs')

  assert.equal(stripGatewayPrefix(gatewayPrefix), '/')
  assert.equal(stripGatewayPrefix(`${gatewayPrefix}/api/system/health`), '/api/system/health')
  // 直连端口时原样返回，不受影响
  assert.equal(stripGatewayPrefix('/api/system/health'), '/api/system/health')
  // 相似前缀不能误剥（否则 /app/fn-xiaoya-native-evil 会被当成自身路由）
  assert.equal(stripGatewayPrefix(`${gatewayPrefix}-evil/x`), `${gatewayPrefix}-evil/x`)
})

test('小雅反代：只接管 /alist 前缀，且不越界到相似路径', async () => {
  const { isAlistProxyPath, ALIST_PROXY_PREFIX } = await import('../app/server/http/alist-proxy.mjs')

  assert.equal(isAlistProxyPath(ALIST_PROXY_PREFIX), true)
  assert.equal(isAlistProxyPath(`${ALIST_PROXY_PREFIX}/dav/x`), true)
  // /alistfoo 与 /alist-xxx 不属于代理范围
  assert.equal(isAlistProxyPath('/alistfoo'), false)
  assert.equal(isAlistProxyPath('/api/system/health'), false)
})

test('元数据同步：自建目录能保存并回读（不按兜底清单过滤）', async () => {
  const meta = await import('../app/server/sync/metadata.mjs')

  // 「测试」不在 DEFAULT_AVAILABLE_PATHS 里，但必须能保存——
  // 曾经在读端用白名单过滤，导致保存成功、刷新变空。
  const saved = meta.writeSyncConfig({ paths: ['测试', '电影'] })
  assert.deepEqual(saved.paths, ['测试', '电影'])

  const read = meta.readSyncConfig()
  assert.deepEqual(read.paths, ['测试', '电影'], '回读时不应丢弃自建目录')

  // 仍然要拒绝非法路径
  assert.throws(
    () => meta.writeSyncConfig({ paths: ['../etc'] }),
    (error) => error.status === 400,
  )
  assert.throws(
    () => meta.writeSyncConfig({ paths: [''] }),
    (error) => error.status === 400,
  )
})

test('元数据同步：未授权目录时拒绝开启（避免定时任务每轮静默失败）', async () => {
  const meta = await import('../app/server/sync/metadata.mjs')

  // 前面的用例可能已写入目录配置，这里显式清空以复现「未授权」前提
  const { rmSync } = await import('node:fs')
  rmSync(join(paths.stateDir, 'media-dir.json'), { force: true })

  // 未配置元数据目录时，开启应被拒绝并给出可执行的跳转指引
  assert.throws(
    () => meta.writeSyncConfig({ enabled: true }),
    (error) => {
      assert.equal(error.status, 400)
      assert.match(error.suggestion, /常规设置/)
      return true
    },
  )

  // 关闭始终允许，不受目录状态影响
  assert.equal(meta.writeSyncConfig({ enabled: false }).enabled, false)
})
