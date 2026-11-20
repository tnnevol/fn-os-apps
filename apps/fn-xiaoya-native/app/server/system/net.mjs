/**
 * 宿主网络信息。
 *
 * 对应脚本里 `get_docker0_url` / `localip` 那两段 ifconfig/ip 解析：
 * 目的都是回答「面板该告诉用户用哪个地址访问小雅」。
 * 这里不调用外部命令，直接读 `os.networkInterfaces()`，在非 root 下也能工作。
 *
 * ## 为什么不能取第一个地址
 *
 * 飞牛设备上常有多块网卡（有线 + 无线 + OVS 网桥 + Docker 网桥）。
 * `networkInterfaces()` 的顺序不保证有意义，取第一个会把「无线网卡」当成
 * 对外地址写进 docker_address.txt，用户拿到的分享链接直接失效。
 *
 * ## 判定顺序（方案 1：非 root 下按网段与链路特征推断）
 *
 * 1. 排除回环、链路本地、Docker/虚拟网卡；
 * 2. 通过默认路由找到「真正出网」的那块网卡（读 /proc/net/route，非 root 可读）；
 * 3. 退而求其次：优先物理有线网卡（en 与 eth 开头），再考虑无线网卡；
 * 4. 都不满足时按网段私有程度排序（192.168 优于 10 优于 172.16-31）。
 */
import { readFileSync } from 'node:fs'
import { createConnection } from 'node:net'
import { networkInterfaces } from 'node:os'

/** 虚拟网卡前缀：这些地址对外不可达，不能写进 docker_address.txt。 */
const VIRTUAL_PREFIXES = [
  'docker',
  'br-',
  'veth',
  'virbr',
  'lo',
  'tun',
  'tap',
  'utun',
  'ovs',
  'cni',
  'flannel',
  'kube',
]

/** 物理网卡命名特征（Linux predictable names）。 */
const WIRED_PREFIXES = ['en', 'eth', 'eno', 'ens', 'enp', 'em']
const WIRELESS_PREFIXES = ['wl', 'wlan', 'wlp', 'wlo']

/** 判断是否是可用于局域网访问的 IPv4 地址。导出以便单测覆盖。 */
export function isLanCandidate(name, address) {
  if (address.family !== 'IPv4' || address.internal) return false
  // OVS 网桥（enp3s0-ovs）是有线网卡，要保留；只排除纯虚拟网桥
  const lower = name.toLowerCase()
  if (VIRTUAL_PREFIXES.some(prefix => lower.startsWith(prefix))) return false
  // 169.254/16 是链路本地地址，172.17/16 是默认 docker0，脚本同样排除
  if (address.address.startsWith('169.254.')) return false
  if (address.address.startsWith('172.17.')) return false
  return true
}

/**
 * 读取默认路由对应的网卡名。
 *
 * /proc/net/route 的 Destination 为 00000000 表示默认路由；
 * 该文件对普通用户可读，非 root 环境同样适用。
 * 读取失败（非 Linux / 容器内无该文件）时返回 null。
 */
function defaultRouteInterface() {
  try {
    const lines = readFileSync('/proc/net/route', 'utf8').split('\n').slice(1)
    for (const line of lines) {
      const cols = line.trim().split(/\s+/)
      if (cols.length < 2) continue
      if (cols[1] === '00000000') return cols[0]
    }
  }
  catch {
    // 非 Linux 或不可读：交给后续启发式
  }
  return null
}

/** 网卡优先级得分，分数越高越可能是对外地址。导出以便单测直接覆盖。 */
export function scoreInterface(name, defaultIface) {
  const lower = name.toLowerCase()
  let score = 0

  // 默认路由指向的网卡最可信：它就是实际出网的那块
  if (defaultIface !== null && lower === defaultIface.toLowerCase()) score += 100

  // OVS 网桥通常承载飞牛的主网络，等价于物理网卡
  if (lower.includes('-ovs')) score += 60
  if (WIRED_PREFIXES.some(prefix => lower.startsWith(prefix))) score += 50
  if (WIRELESS_PREFIXES.some(prefix => lower.startsWith(prefix))) score += 20

  return score
}

/** 私有网段的可信度：家用场景 192.168 最常见。导出以便单测直接覆盖。 */
export function scoreSubnet(address) {
  if (address.startsWith('192.168.')) return 3
  if (address.startsWith('10.')) return 2
  if (/^172\.(?:1[6-9]|2\d|3[01])\./.test(address)) return 1
  return 0
}

/**
 * 探测本机局域网 IPv4 地址。
 *
 * 返回最可能被用户访问的地址；没有可用地址时返回 null。
 */
export function localAddress() {
  const defaultIface = defaultRouteInterface()
  const candidates = []

  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (!isLanCandidate(name, address)) continue
      candidates.push({
        name,
        address: address.address,
        score: scoreInterface(name, defaultIface) * 10 + scoreSubnet(address.address),
      })
    }
  }

  if (candidates.length === 0) return null
  // 分数相同时保持稳定顺序，避免每次调用返回不同地址
  candidates.sort((a, b) => b.score - a.score || a.address.localeCompare(b.address))
  return candidates[0].address
}

/**
 * 列出全部网卡地址，供设置页展示。
 *
 * 用户可能有多网卡（有线 + 无线 + 虚拟网卡），面板让用户自己选比猜一个更可靠。
 * `preferred` 标记出按启发式推断最可能正确的那个，供前端默认选中。
 */
export function listAddresses() {
  const defaultIface = defaultRouteInterface()
  const preferred = localAddress()
  const result = []
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4') continue
      result.push({
        name,
        address: address.address,
        internal: address.internal,
        usable: isLanCandidate(name, address),
        preferred: address.address === preferred,
      })
    }
  }
  return result
}

/** 单端口连通性探测：能建立 TCP 连接即视为被占用。 */
function probePort(port, host = '127.0.0.1', timeoutMs = 500) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host })
    let settled = false
    const finish = (occupied) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(occupied)
    }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

/**
 * 检查端口占用。
 *
 * 与脚本的 `check_port` 等价：启动前先把冲突找出来，
 * 否则 `docker compose up` 只在 stderr 里留一句 bind failed，用户很难归因。
 */
export async function checkPorts(ports) {
  const results = []
  for (const port of ports) {
    results.push({ port, occupied: await probePort(port) })
  }
  return {
    ok: results.every(item => !item.occupied),
    occupied: results.filter(item => item.occupied).map(item => item.port),
    ports: results,
  }
}
