/**
 * 小雅配置文件的读写层。
 *
 * 契约来源：小雅容器把宿主机配置目录挂到容器内 `/data`，直接读取一批 `.txt` 文件。
 * 因此本应用不引入中间数据库，宿主侧文件本身就是唯一事实来源——面板改了文件，
 * 容器重启后立即生效；用户手工放进去的文件，面板也能读到。
 *
 * 每个字段都有明确的格式校验：写坏一个 Token 会让小雅整段不可用，
 * 而用户往往看不出是哪个文件的问题，所以宁可在写入前拒绝。
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { configDir } from '../paths.mjs'
import { badRequest } from '../http/respond.mjs'

/** 敏感字段：读取时打码，不写日志。 */
const SECRET = 'secret'

/**
 * 字段定义。
 *
 * `file` 是小雅容器读取的实际文件名；`validate` 返回错误消息或 undefined。
 */
const fields = [
  {
    key: 'refreshToken',
    file: 'mytoken.txt',
    label: '阿里云盘 Refresh Token',
    kind: SECRET,
    // 与上游一致：mytoken.txt 必须正好 32 位（脚本会拒绝其它长度）
    validate: v =>
      v.length === 32 && /^[0-9a-f]{32}$/i.test(v)
        ? undefined
        : 'Refresh Token 必须是 32 位十六进制字符（阿里云盘网页端获取）',
  },
  {
    key: 'openToken',
    file: 'myopentoken.txt',
    label: '阿里云盘 Open Token',
    kind: SECRET,
    // 与上游一致：myopentoken.txt 只接受 280 或 335 位
    validate: v =>
      v.length === 280 || v.length === 335
        ? undefined
        : 'Open Token 必须是 280 位或 335 位（小雅只接受这两种长度）',
  },
  {
    key: 'opentokenUrl',
    file: 'opentoken_url.txt',
    label: 'Open Token 换取服务',
    kind: 'plain',
    // 小雅靠这个文件决定去哪里把 authCode 换成 token。
    // 缺失或指向已废弃的服务时，容器日志会报 invalid client_id
    // ——因为换取 token 需要 client_id/client_secret，而小雅自身不持有，
    // 是由该服务补全的。
    validate: (v) => {
      if (!/^https?:\/\/\S+$/.test(v)) return '服务地址必须以 http:// 或 https:// 开头'
      // 上游对这两个域名有明确的隐私泄露警告
      if (v.includes('nn.ci') || v.includes('xhofe.top')) {
        return '该服务已废弃且存在隐私泄露风险，请勿使用'
      }
      return undefined
    },
  },
  {
    key: 'transferFolderId',
    file: 'temp_transfer_folder_id.txt',
    label: '转存目录 folder id',
    kind: 'plain',
    // 与上游一致：folder id 固定 40 位
    validate: v =>
      /^[0-9a-f]{40}$/i.test(v)
        ? undefined
        : '转存目录 ID 必须是 40 位十六进制字符（阿里云盘分享目录的 folder id）',
  },
  {
    key: 'cookie115',
    file: '115_cookie.txt',
    label: '115 Cookie',
    kind: SECRET,
    // 115 的有效 Cookie 必须带 UID/SEID/CID 三项
    validate: v => (/UID=/.test(v) && /CID=/.test(v) && /SEID=/.test(v) ? undefined : '115 Cookie 缺少 UID/CID/SEID，请重新扫码或粘贴完整 Cookie'),
  },
  {
    key: 'cookieQuark',
    file: 'quark_cookie.txt',
    label: '夸克 Cookie',
    kind: SECRET,
    validate: v => (/__pus=/.test(v) || /__kp=/.test(v) ? undefined : '夸克 Cookie 缺少 __pus/__kp 字段'),
  },
  {
    key: 'cookieUc',
    file: 'uc_cookie.txt',
    label: 'UC Cookie',
    kind: SECRET,
    validate: v => (/(__pus|__kp|__puus)=/.test(v) ? undefined : 'UC Cookie 格式不正确'),
  },
  {
    key: 'guestPassword',
    file: 'guestpass.txt',
    label: '强制登录密码',
    kind: SECRET,
    validate: v => (v.length >= 1 && v.length <= 128 ? undefined : '密码长度应为 1-128 个字符'),
  },
  {
    key: 'recyclePassword',
    file: '115_key.txt',
    label: '115 回收站密码',
    kind: SECRET,
    validate: v => (v.length <= 128 ? undefined : '密码长度不能超过 128 个字符'),
  },
  {
    key: 'proxy',
    file: 'proxy.txt',
    label: 'HTTP 代理地址',
    kind: 'plain',
    validate: v => (/^https?:\/\/\S+$/.test(v) ? undefined : '代理地址应以 http:// 或 https:// 开头'),
  },
]

/** 布尔开关：存在对应文件即为开启（对齐脚本用 touch 表示开启的做法）。 */
const flags = [
  { key: 'forceLogin', file: 'guestlogin.txt', label: '强制登录' },
  { key: 'ali2115', file: 'ali2115.txt', label: '阿里转存 115' },
  { key: 'noSign', file: 'nosign.txt', label: '关闭链接签名' },
  /**
   * 是否暴露 Emby 相关端口（2345-2347）。
   *
   * 2345 是 Emby 客户端直连、2347 是走服务端流量；用户不装 Emby 时
   * 这些端口根本没人用，暴露出去只是无谓地占用宿主端口并扩大暴露面。
   * 默认关闭，需要时在常规设置里打开。
   */
  { key: 'embyPorts', file: 'emby_ports.txt', label: '暴露 Emby 端口' },
]

const byKey = new Map(fields.map(f => [f.key, f]))
const flagByKey = new Map(flags.map(f => [f.key, f]))

/** 读取单个文件内容；不存在返回 ''。 */
function readFile(name) {
  const path = join(configDir, name)
  if (!existsSync(path)) return ''
  try {
    return readFileSync(path, 'utf8').replace(/\r?\n$/, '')
  }
  catch {
    return ''
  }
}

/**
 * 原子写入：先写临时文件再改名。
 *
 * 直接写目标文件时，容器可能正好在读，读到半截内容会解析失败；
 * 改名在 POSIX 上是原子的，容器要么读到旧内容要么读到新内容。
 */
function writeAtomic(name, content, mode) {
  mkdirSync(configDir, { recursive: true })
  const target = join(configDir, name)
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}`
  writeFileSync(tmp, content, { mode })
  chmodSync(tmp, mode)
  renameSync(tmp, target)
}

/** 掩码：只保留首尾少量字符，避免面板泄露完整凭据。 */
function mask(value) {
  if (value === '') return ''
  if (value.length <= 8) return '*'.repeat(value.length)
  return `${value.slice(0, 4)}${'*'.repeat(Math.min(24, value.length - 8))}${value.slice(-4)}`
}

/**
 * 读取全部配置。
 *
 * 敏感字段返回掩码与「是否已配置」，不返回明文；
 * 非敏感字段返回明文，面板可以直接编辑。
 */
export function readConfig() {
  const values = {}
  const secrets = {}
  for (const field of fields) {
    const raw = readFile(field.file)
    if (field.kind === SECRET) {
      values[field.key] = ''
      secrets[field.key] = { configured: raw !== '', masked: mask(raw), updatedAt: fileMtime(field.file) }
    }
    else {
      values[field.key] = raw
    }
  }
  const switches = {}
  for (const flag of flags) switches[flag.key] = existsSync(join(configDir, flag.file))
  return { values, secrets, switches }
}

/** 读取字段明文（仅供后端内部使用，例如校验令牌）。 */
export function readSecret(key) {
  const field = byKey.get(key)
  if (field === undefined) throw badRequest(`未知配置项：${key}`, '请刷新页面后重试')
  return readFile(field.file)
}

/** 文件最后修改时间，便于面板显示「上次更新」。 */
function fileMtime(name) {
  try {
    return statSync(join(configDir, name)).mtime.toISOString()
  }
  catch {
    return null
  }
}

/**
 * 写入配置。
 *
 * 空字符串表示清除该项；`undefined` 表示不修改这一项，
 * 这样面板只提交改动的字段时不会误删其它配置。
 *
 * @param {Record<string, string>} patch
 * @returns {{updated: string[], cleared: string[]}}
 */
export function writeConfig(patch) {
  const updated = []
  const cleared = []
  for (const [key, rawValue] of Object.entries(patch)) {
    const field = byKey.get(key)
    if (field === undefined) {
      if (flagByKey.has(key)) continue
      throw badRequest(`未知配置项：${key}`, '请刷新页面后重试')
    }
    if (typeof rawValue !== 'string') {
      throw badRequest(`${field.label} 必须是字符串`, '请检查输入内容')
    }
    const value = rawValue.trim()
    if (value === '') {
      rmSync(join(configDir, field.file), { force: true })
      cleared.push(key)
      continue
    }
    const problem = field.validate?.(value)
    if (problem !== undefined) throw badRequest(problem, `请在「账号配置」中重新填写${field.label}`)
    // 密钥文件统一 600：同机其它用户不应读到网盘凭据
    writeAtomic(field.file, value, field.kind === SECRET ? 0o600 : 0o644)
    updated.push(key)
  }
  return { updated, cleared }
}

/**
 * 切换布尔开关。
 *
 * @param {Record<string, boolean>} switches
 */
export function writeSwitches(switches) {
  const changed = []
  for (const [key, enabled] of Object.entries(switches)) {
    const flag = flagByKey.get(key)
    if (flag === undefined) throw badRequest(`未知开关：${key}`, '请刷新页面后重试')
    const path = join(configDir, flag.file)
    if (enabled) {
      writeAtomic(flag.file, '', 0o644)
    }
    else {
      rmSync(path, { force: true })
    }
    changed.push(key)
  }
  return { changed }
}

/** 判断是否已完成最小可用配置（至少一个阿里云盘 Token）。 */
export function isConfigured() {
  return readFile('mytoken.txt') !== '' || readFile('myopentoken.txt') !== ''
}

/**
 * 一次性写入官方分享列表。
 *
 * 这两个文件的内容是上游随脚本分发的常量清单，用于在未配置对应网盘时也能看到分享。
 * 内容较长且不需要用户编辑，因此由后端内置，面板只提供「写入官方列表」按钮。
 */
export function writeShareList(kind, content) {
  const name = kind === '115' ? '115share_list.txt' : 'quarkshare_list.txt'
  if (typeof content !== 'string' || content.trim() === '') {
    throw badRequest('分享列表内容为空', '请重试或手动填写分享列表')
  }
  writeAtomic(name, content, 0o600)
  return { file: name }
}

/** 列出字段定义，供前端渲染表单。 */
export function describeFields() {
  return {
    fields: fields.map(f => ({ key: f.key, label: f.label, secret: f.kind === SECRET })),
    switches: flags.map(f => ({ key: f.key, label: f.label })),
  }
}
