/**
 * Docker 操作白名单。
 *
 * 应用为了管理小雅容器必须加入 `docker` 组，而 docker 组等价于 root：
 * 任何能构造 `docker run --privileged -v /:/host` 的人都能拿到宿主 root。
 * 因此这一层的唯一职责是**不让请求内容进入命令行**：
 * 命令与参数全部来自本模块的常量与已校验配置，路由只能选择动作名。
 */
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'
import { alistContainer, composeDir, composeProject, configDir, embyConfigDir, ensureDirs, mediaRoot } from '../paths.mjs'
import { readConfig } from '../config/store.mjs'
import { AppError, badRequest, conflict, serverError } from '../http/respond.mjs'

/** 允许的容器动作：路由只能从这里选，不接受任意命令。 */
export const ALIST_ACTIONS = new Set(['start', 'stop', 'restart', 'update'])

/** 镜像来源约束：只允许官方小雅镜像，避免被改成任意镜像。 */
const allowedImagePattern = /^xiaoyaliu\/alist:(latest|hostmode)$/

/**
 * 运行 docker，返回 { code, stdout, stderr }。
 *
 * 用 `spawn` 传参数数组而不是 `bash -c` 拼字符串：
 * 路径里出现空格、`$`、反引号时不会二次解析，也不会被注入额外命令。
 */
/**
 * 直接执行 docker 命令并返回原始结果（供诊断接口使用）。
 *
 * @param {string[]} args docker 参数
 * @returns {Promise<{code: number, stdout: string, stderr: string}>} 原始执行结果
 */
export async function runDockerRaw(args) {
  return runDocker(args, { timeoutMs: 30_000 })
}


function runDocker(args, { timeoutMs = 120_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(serverError('Docker 命令超时', '请检查 Docker 服务是否响应，稍后重试'))
    }, timeoutMs)

    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(normalizeDockerSpawnError(error))
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? -1, stdout, stderr })
    })
  })
}

/** 把 spawn 失败翻译成可执行建议。 */
function normalizeDockerSpawnError(error) {
  if (error.code === 'ENOENT') {
    return serverError('找不到 docker 命令', '请确认飞牛已安装 Docker 服务')
  }
  if (error.code === 'EACCES') {
    return serverError('没有访问 Docker 的权限', '请确认应用用户已加入 docker 组，或在应用设置中重新保存权限后重启应用')
  }
  return serverError(`无法执行 docker：${error.message}`, '请查看应用日志')
}

/**
 * 生成 compose 文件内容。
 *
 * 只声明小雅本体一个服务；其它能力（授权、元数据、定时）由后端原生实现，
 * 不再拉起脚本时代的那一堆伴随容器。
 *
 * 网络模式默认 bridge：host 模式会绕开端口映射并占用宿主端口，
 * 对需要与后端同机的场景没有收益，还会让端口冲突难以归因。
 */
function composeYaml({ image, ports }) {
  const portLines = ports.map(p => `      - "${p}"`).join('\n')
  return `# 由 fn-xiaoya-native 自动生成，请勿手工编辑（应用每次启动会覆盖）。
# 生成来源：apps/fn-xiaoya-native/app/server/docker/compose.mjs
services:
  alist:
    image: ${image}
    container_name: ${alistContainer}
    restart: unless-stopped
    ports:
${portLines}
    volumes:
      - "${configDir}:/data"
      - "${configDir}/data:/www/data"
      - "${configDir}/watch:/index/watch"
      # 宿主机的时区数据。Go 在 TZ 非空时只读 $TZDIR/zoneinfo，
      # 镜像内没带 tzdata，所以必须把宿主机的 zoneinfo 挂进去。
      - "/etc/localtime:/etc/localtime:ro"
      - "/usr/share/zoneinfo:/usr/share/zoneinfo:ro"
    environment:
      TZ: Asia/Shanghai
`
}

/**
 * 端口映射。
 *
 * 5678 是小雅面板，任何场景都要有。
 * 2345-2347 只服务 Emby（2345 客户端直连、2347 走服务端流量），
 * 用户不装 Emby 时暴露它们只是白占宿主端口、扩大暴露面，
 * 因此由 embyPorts 开关控制，默认不映射。
 */
const BASE_PORT = '5678:80'
const EMBY_PORTS = ['2345:2345', '2346:2346', '2347:2347']

/** 当前应映射哪个宿主端口，用于启动前的冲突检查。 */
export function alistHostPorts(includeEmby) {
  return includeEmby ? [5678, 2345, 2346, 2347] : [5678]
}

/** 读取「是否暴露 Emby 端口」开关。 */
function readEmbyPortsSwitch() {
  try {
    return readConfig().switches?.embyPorts === true
  }
  catch {
    // 读不到就按关闭处理：少开端口比多开安全
    return false
  }
}

/**
 * 写入 compose 文件。
 *
 * 镜像由设置决定，但必须匹配白名单模式；不匹配时回退到默认镜像，
 * 避免把用户输入直接拼进 YAML。
 */
export function writeCompose(image = 'xiaoyaliu/alist:latest') {
  ensureDirs()
  const safeImage = allowedImagePattern.test(image) ? image : 'xiaoyaliu/alist:latest'
  const path = join(composeDir, 'docker-compose.yaml')
  const includeEmby = readEmbyPortsSwitch()
  const ports = includeEmby ? [BASE_PORT, ...EMBY_PORTS] : [BASE_PORT]
  writeFileSync(path, composeYaml({ image: safeImage, ports }), { mode: 0o644 })
  return { path, image: safeImage }
}

/** 执行 compose 子命令（固定 `--project-directory` 与项目名）。 */
async function runCompose(subcommand, extraArgs = [], options) {
  writeCompose(readAlistImage())
  const args = ['compose', '--project-directory', composeDir, '-p', composeProject, subcommand, ...extraArgs]
  const result = await runDocker(args, options)
  if (result.code !== 0) {
    const explained = explainDockerFailure(result.stderr, subcommand)
    throw serverError(explained.message, explained.suggestion)
  }
  return result
}

/**
 * 去掉终端颜色转义序列。
 *
 * 容器日志里常有 `\x1b[36mINFO\x1b[0m` 这类着色标记，在 <pre> 里会原样
 * 显示成 `[36mINFO[0m`，比不加颜色更难读。面板只做纯文本展示，直接剥掉。
 */
function stripAnsi(text) {
  // 这里必须直接匹配 ESC(0x1B)/BEL(0x07) 等控制字符与 CSI 的取值范围，
  // 用字符类简写反而表达不了，故对以下三条规则豁免对应 lint。
  /* eslint-disable no-control-regex, regexp/no-obscure-range */
  return text
    // 完整 CSI / OSC 序列
    .replace(/\u001B\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\u001B\][^\u0007\u001B]*(?:\u0007|\u001B\\)/g, '')
    // 被截断后残留的孤立转义片段，例如上一轮清理留下的 `[0m`
    // （日志按字节数截断时会把 ESC 切掉，只剩后半段）
    .replace(/\[(?:\d{1,3}(?:;\d{1,3})*)?m/g, '')
  /* eslint-enable no-control-regex, regexp/no-obscure-range */
}

/** 只取 stderr 第一行，避免把整段日志塞进响应。 */
function firstLine(text) {
  return text.split('\n').map(l => l.trim()).find(l => l !== '') ?? ''
}

/**
 * 把 Docker 的原始报错翻译成用户能照着做的说明。
 *
 * Docker 的错误信息是给运维看的（包含 socket 路径、dial 细节），
 * 直接抛给面板用户等于没提示。这里按常见原因归类，
 * 认不出来时再退回第一行原文，至少保留可诊断信息。
 */
function explainDockerFailure(raw, action) {
  const text = String(raw ?? '')
  if (/Cannot connect to the Docker daemon|failed to connect to the docker API|dial unix/i.test(text)) {
    return {
      message: 'Docker 服务未运行',
      suggestion: '请在飞牛「应用中心」确认 Docker 已安装并启动，然后重试',
    }
  }
  if (/permission denied|EACCES/i.test(text)) {
    return {
      message: '当前用户无权访问 Docker',
      suggestion: '请确认应用用户已加入 docker 组；可在应用设置中重新保存权限或重启应用',
    }
  }
  if (/no such image|pull access denied|manifest unknown|not found/i.test(text)) {
    return {
      message: '小雅镜像无法获取',
      suggestion: '请检查设备网络或镜像源配置，稍后在「小雅服务」页重新点击启动/更新',
    }
  }
  if (/port is already allocated|address already in use/i.test(text)) {
    return {
      message: '端口被占用',
      suggestion: '小雅需要 5678 端口（启用 Emby 支持时还需要 2345-2347）；请先释放占用这些端口的程序再启动',
    }
  }
  if (/no space left on device/i.test(text)) {
    return {
      message: '磁盘空间不足',
      suggestion: '请清理存储空间后重试',
    }
  }
  return {
    message: `Docker ${action} 失败：${firstLine(text) || '未知原因'}`,
    suggestion: '可查看应用日志获取详细信息',
  }
}

/** 读取用户选择的镜像；缺省使用 latest。 */
export function readAlistImage() {
  const path = join(composeDir, 'image.txt')
  if (!existsSync(path)) return 'xiaoyaliu/alist:latest'
  try {
    const value = readFileSync(path, 'utf8').trim()
    return allowedImagePattern.test(value) ? value : 'xiaoyaliu/alist:latest'
  }
  catch {
    return 'xiaoyaliu/alist:latest'
  }
}

/** 保存镜像选择。 */
export function writeAlistImage(image) {
  ensureDirs()
  if (!allowedImagePattern.test(image)) {
    throw badRequest('不支持的镜像', '仅支持 xiaoyaliu/alist:latest 与 xiaoyaliu/alist:hostmode')
  }
  writeFileSync(join(composeDir, 'image.txt'), image, { mode: 0o644 })
  return { image }
}

/**
 * 检查 docker 是否可用。
 *
 * 安装阶段与健康检查都用它，返回结构而不是抛错，便于面板显示具体缺哪一环。
 */
export async function probeDocker() {
  try {
    const version = await runDocker(['version', '--format', '{{.Server.Version}}'], { timeoutMs: 15_000 })
    if (version.code !== 0) {
      // 面板直接展示 reason，这里给的是「原因」而不是 socket 技术细节
      const explained = explainDockerFailure(version.stderr, 'version')
      return { available: false, reason: explained.message }
    }
    return { available: true, version: version.stdout.trim() }
  }
  catch (error) {
    return { available: false, reason: error instanceof AppError ? error.message : String(error) }
  }
}

/**
 * 查询小雅容器状态。
 *
 * 用 `docker ps -a --filter name=` 而不是 `docker inspect`：
 * 容器不存在时前者返回空列表，后者返回非零退出码，
 * 空列表更容易和「Docker 不可用」区分开。
 */
export async function alistStatus() {
  const result = await runDocker([
    'ps',
    '-a',
    '--filter',
    `name=^/${alistContainer}$`,
    '--format',
    '{{.State}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}',
  ])

  if (result.code !== 0) {
    const explained = explainDockerFailure(result.stderr, 'ps')

    // Docker 本身不可用时（未安装/未启动/无权限），「容器不存在」是这个状态下的
    // 事实描述，不该当成 500：否则概览页会弹「服务器错误」，而实际只是没装 Docker。
    // 真正的故障信息仍通过 exists/running 之外的 dockerUnavailable 字段带出，
    // 由前端提示「请先启动 Docker」。
    if (/docker.*(未运行|不可用|not found|denied|permission)|Cannot connect to the Docker daemon/i.test(`${explained.message} ${result.stderr}`)
      || result.stderr.includes('docker: not found')
      || result.stderr.includes('/var/run/docker.sock')) {
      return {
        exists: false,
        running: false,
        state: 'absent',
        statusText: '未创建',
        image: readAlistImage(),
        ports: [],
        dockerUnavailable: true,
        reason: explained.message,
        suggestion: explained.suggestion,
      }
    }

    throw serverError(explained.message, explained.suggestion)
  }

  const line = result.stdout.trim()
  if (line === '') {
    return { exists: false, running: false, state: 'absent', statusText: '未创建', image: readAlistImage(), ports: [] }
  }

  const [state, statusText, image, ports] = line.split('\t')
  return {
    exists: true,
    running: state === 'running',
    state: state ?? 'unknown',
    statusText: statusText ?? '',
    image: image ?? '',
    ports: (ports ?? '')
      .split(',')
      .map(p => p.trim())
      .filter(p => p !== ''),
    imageChoice: readAlistImage(),
  }
}

/** 执行白名单内的容器动作。 */
export async function alistAction(action) {
  if (!ALIST_ACTIONS.has(action)) {
    throw badRequest(`不支持的操作：${action}`, '仅支持启动、停止、重启、更新')
  }
  switch (action) {
    case 'start': {
      const current = await alistStatus()
      // 容器已经在跑时端口本来就属于它，跳过冲突检查
      if (!current.running) {
        const check = await checkPorts(alistHostPorts(readEmbyPortsSwitch()))
        if (!check.ok) {
          throw conflict(
            `端口被占用：${check.occupied.join('、')}`,
            '请先停止占用这些端口的程序（常见是另一个小雅或 Emby），再重试启动',
          )
        }
      }
      const address = ensureDockerAddress(localAddress())
      await runCompose('up', ['-d'])
      return {
        action,
        message: address.written ? `小雅已启动，对外地址已写入 ${address.address}` : '小雅已启动',
      }
    }
    case 'stop':
      await runCompose('stop')
      return { action, message: '小雅已停止' }
    case 'restart':
      await runCompose('restart')
      return { action, message: '小雅已重启' }
    case 'update':
      ensureDockerAddress(localAddress())
      await runCompose('pull')
      await runCompose('up', ['-d', '--force-recreate'])
      return { action, message: '镜像已更新并重建容器' }
    default:
      throw badRequest('不支持的操作', '仅支持启动、停止、重启、更新')
  }
}

/** 读取容器日志尾部。 */
export async function alistLogs(tail = 200) {
  const count = Number.isInteger(tail) ? Math.min(Math.max(tail, 1), 2000) : 200
  const result = await runDocker(['logs', '--tail', String(count), alistContainer])
  if (result.code !== 0) {
    const explained = explainDockerFailure(result.stderr, 'logs')
    // 日志面板会每几秒自动拉一次：如果这里抛 500，浏览器控制台会被
    // 「Failed to load resource: 500」刷屏，用户以为功能坏了。
    // 日志读不到属于「暂时没有内容」而不是请求失败，返回一段说明更合适。
    return { logs: '', unavailable: explained.message, reason: explained.suggestion }
  }
  return { logs: stripAnsi(`${result.stdout}${result.stderr}`) }
}

/**
 * 用官方 glue 容器解压（宿主机没有 7z 时的兜底）。
 *
 * 上游脚本的默认路径就是这一条：拉 `xiaoyaliu/glue:latest` 跑 7z，
 * 而不是要求用户在宿主机装 p7zip。容器里自带 7z，且与宿主机架构无关。
 *
 * 安全边界：只接受「压缩包路径 + 解压目标 + 可选成员过滤」三个参数，
 * 命令固定为 `7z x -aoa -y`，不接受任意 docker 参数或 shell 片段。
 * 挂载只映射媒体目录（读写），glue 容器看不到应用配置与宿主机其它路径。
 *
 * @param {object} options 解压参数
 * @param {string} options.archive 宿主机上的压缩包绝对路径
 * @param {string} options.mediaRoot 媒体根目录（容器内挂到 /media）
 * @param {string} options.workdir 相对 /media 的工作目录，如 'xiaoya'
 * @param {string|null} options.member 可选成员过滤，如 '电影/*'
 * @returns {Promise<{code: number, stdout: string, stderr: string}>} 容器输出
 */
export async function extractWithGlue({ archive, mediaRoot, workdir, member = null }) {
  const GLUE_IMAGE = 'xiaoyaliu/glue:latest'

  // 压缩包必须位于媒体目录下：容器只挂载了它，路径之外无法访问
  const relArchive = relative(mediaRoot, archive)
  if (relArchive.startsWith('..') || isAbsolute(relArchive)) {
    throw badRequest('压缩包不在媒体目录内，无法用容器解压', '请先把压缩包下载到媒体目录')
  }

  // 工作目录收敛成相对路径，避免 ../ 逃出 /media
  const safeWorkdir = String(workdir ?? '').replace(/\.\./g, '').replace(/^\/+/, '')
  const args = [
    'run', '--rm',
    '--security-opt', 'seccomp=unconfined',
    '-v', `${mediaRoot}:/media`,
    '-e', 'LANG=C.UTF-8',
    '-e', 'TZ=Asia/Shanghai',
    '-w', `/media/${safeWorkdir}`,
    GLUE_IMAGE,
    '7z', 'x', '-aoa', '-y', '-mmt=4', `/media/${relArchive}`,
  ]
  // 成员过滤：与脚本一致，用 `目录/*`
  if (member !== null && member !== '') {
    const safeMember = String(member).replace(/\.\./g, '')
    args.push(`${safeMember}/*`)
  }

  return runDocker(args, { timeoutMs: 30 * 60 * 1000 })
}


/** compose 配置语法校验，安装阶段用来提前发现模板问题。 */
export async function validateCompose() {
  writeCompose(readAlistImage())
  const result = await runDocker(['compose', '--project-directory', composeDir, '-p', composeProject, 'config'])
  return { valid: result.code === 0, output: firstLine(result.stderr) || result.stdout.slice(0, 400) }
}

/**
 * 停止并删除本应用的容器与网络。
 *
 * 卸载时使用。只按固定项目名清理，不触碰名称相似但属于其它应用的资源。
 */
export async function teardown() {
  const attempts = []
  for (const args of [
    ['compose', '--project-directory', composeDir, '-p', composeProject, 'down', '--remove-orphans'],
  ]) {
    try {
      const result = await runDocker(args)
      attempts.push({ args: args.join(' '), code: result.code, stderr: firstLine(result.stderr) })
    }
    catch (error) {
      attempts.push({ args: args.join(' '), code: -1, stderr: error instanceof AppError ? error.message : String(error) })
    }
  }
  return { attempts }
}

/** 供健康检查使用的路径信息。 */
export function dockerPaths() {
  return { composeDir, configDir, mediaRoot, embyConfigDir, project: composeProject, container: alistContainer }
}
