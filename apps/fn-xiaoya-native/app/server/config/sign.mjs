/**
 * 小雅下载地址签名与对外地址。
 *
 * 对应脚本的 `get_sign`：开启强制登录后，`/d/...` 下载必须在 URL 上带
 * `?sign=<guestpass 的 md5>`，否则小雅会返回登录页而不是文件。
 * 面板下载元数据时同样需要，否则「下载」按钮只会拿到一段 HTML。
 *
 * 脚本用 `docker exec` 读容器内 `/index/md5`，那需要进入容器执行命令；
 * 本应用不改用 docker exec（白名单只允许 compose 操作），
 * 改为按同一算法在宿主机算 md5——镜像里的 `/index/md5` 就是 guestpass 的 md5。
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { configDir } from '../paths.mjs'

/** 读取文本文件首行；不存在返回 ''。 */
function readFirstLine(path) {
  try {
    return readFileSync(path, 'utf8').split(/\r?\n/)[0]?.trim() ?? ''
  }
  catch {
    return ''
  }
}

/** 原子写入，避免容器读到半截内容。 */
function writeAtomic(path, content, mode = 0o644) {
  mkdirSync(configDir, { recursive: true })
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`
  writeFileSync(tmp, content, { mode })
  renameSync(tmp, path)
}

/** 强制登录是否开启（文件存在即开启，对齐脚本用 touch 表示开关）。 */
export function isForceLoginEnabled() {
  return existsSync(join(configDir, 'guestlogin.txt'))
}

/** 链接签名是否关闭。 */
export function isSignDisabled() {
  return existsSync(join(configDir, 'nosign.txt'))
}

/**
 * 计算下载签名后缀。
 *
 * 返回 `?sign=xxx` 或空字符串，调用方直接拼在 URL 后面即可。
 *
 * 三种情况不带签名，与脚本 get_sign 的判断一致：
 * - 用户显式关闭签名（nosign.txt）
 * - 强制登录未开启（没有 guestpass 就不会校验）
 * - guestpass.txt 不存在或为空
 */
export function readSign() {
  if (isSignDisabled()) return { enabled: false, query: '', reason: '已关闭签名' }
  if (!isForceLoginEnabled()) return { enabled: false, query: '', reason: '未开启强制登录' }

  const password = readFirstLine(join(configDir, 'guestpass.txt'))
  if (password === '') return { enabled: false, query: '', reason: '未设置访问密码' }

  const md5 = createHash('md5').update(password).digest('hex')
  return { enabled: true, query: `?sign=${md5}`, reason: 'ok' }
}

/**
 * 写入访问密码。
 *
 * 同时开启强制登录：用户填了密码就是想要保护面板，不该再让他多点一次开关。
 * 空串表示清除密码并关闭强制登录。
 */
export function writeGuestPassword(password) {
  if (typeof password !== 'string') throw new TypeError('密码必须是字符串')
  const value = password.trim()

  if (value === '') {
    writeAtomic(join(configDir, 'guestpass.txt'), '')
    return { configured: false }
  }
  if (value.length < 4 || value.length > 128) {
    throw new TypeError('密码长度需在 4-128 之间')
  }
  writeAtomic(join(configDir, 'guestpass.txt'), `${value}\n`)
  writeAtomic(join(configDir, 'guestlogin.txt'), '')
  return { configured: true }
}

/** 读取访问密码（用于展示掩码状态，不返回明文）。 */
export function readGuestPassword() {
  const password = readFirstLine(join(configDir, 'guestpass.txt'))
  return { configured: password !== '', masked: password === '' ? '' : `${password.slice(0, 3)}****${password.slice(-3)}` }
}

/** 开关强制登录。关闭时同时移除标记文件，行为与脚本一致。 */
export function setForceLogin(enabled) {
  const file = join(configDir, 'guestlogin.txt')
  if (enabled) {
    writeAtomic(file, '')
    return { enabled: true }
  }
  try {
    // 用空写替代 unlink：保留文件但内容为空时小雅按「未开启」处理，
    // 这样不必依赖 rm 也能关闭。
    writeAtomic(file, '', 0o644)
    return { enabled: false }
  }
  catch {
    return { enabled: false }
  }
}

/**
 * 读取 `docker_address.txt`。
 *
 * `docker_address.txt` 是小雅生成分享链接时用的地址，脚本在安装时写入
 * `http://<本机 IP>:5678`。缺失时返回 ''，由调用方决定是否补写。
 */
export function readDockerAddress() {
  return readFirstLine(join(configDir, 'docker_address.txt'))
}

/**
 * 补齐对外访问地址。
 *
 * 只在文件缺失或为空时写入，不覆盖用户已经改过的值——多网卡或反代场景下
 * 用户可能手工填了域名。
 */
export function ensureDockerAddress(localIp) {
  if (readDockerAddress() !== '') return { written: false, address: readDockerAddress() }
  if (!localIp) return { written: false, address: '' }
  const address = `http://${localIp}:5678`
  writeAtomic(join(configDir, 'docker_address.txt'), `${address}\n`)
  return { written: true, address }
}

/**
 * 写入对外访问地址。
 *
 * 只接受 http(s)：这个值会被拼进分享链接，允许 `file:` 之类的协议
 * 等于让用户能把小雅的链接指向任意本地路径。
 */
export function writeDockerAddress(address) {
  if (typeof address !== 'string') throw new TypeError('地址必须是字符串')
  const value = address.trim()
  if (value === '') {
    writeAtomic(join(configDir, 'docker_address.txt'), '')
    return { address: '' }
  }
  if (!/^https?:\/\/\S+$/.test(value) || value.length > 512) {
    throw new TypeError('地址必须是 http(s) 开头且不含空格的 URL')
  }
  writeAtomic(join(configDir, 'docker_address.txt'), `${value.replace(/\/+$/, '')}\n`)
  return { address: value.replace(/\/+$/, '') }
}

/** 读取出口代理地址；空串表示直连。 */
export function readProxy() {
  return readFirstLine(join(configDir, 'proxy.txt'))
}

/**
 * 写入出口代理地址。
 *
 * 接受 `http://host:port` 或 `host:port`；后者补上 http:// 前缀，
 * 因为脚本里 http_proxy 的常见写法就是省略协议的。
 */
export function writeProxy(proxy) {
  if (typeof proxy !== 'string') throw new TypeError('代理地址必须是字符串')
  const value = proxy.trim()
  if (value === '') {
    writeAtomic(join(configDir, 'proxy.txt'), '')
    return { proxy: '' }
  }
  const normalized = /^https?:\/\//.test(value) ? value : `http://${value}`
  if (!/^https?:\/\/[^\s/]+(:[0-9]{1,5})?$/.test(normalized) || normalized.length > 512) {
    throw new TypeError('代理地址格式应为 http://host:port 或 host:port')
  }
  writeAtomic(join(configDir, 'proxy.txt'), `${normalized}\n`)
  return { proxy: normalized }
}
