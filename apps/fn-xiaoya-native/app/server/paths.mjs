/**
 * 运行路径解析。
 *
 * 生产环境由飞牛应用框架提供 TRIM_* 环境变量；开发环境完全不依赖这些变量，
 * 通过 XIAOYA_DEV / XIAOYA_DATA_DIR 指定本地目录。两条路径的差别只在这里收口，
 * 其余模块一律使用本模块导出的路径，不再直接读 process.env.TRIM_*。
 */
import { accessSync, constants, existsSync, mkdirSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

/** 开发模式：未注入飞牛环境变量时为 true。 */
export const isDev = process.env.TRIM_APPDEST === undefined || process.env.XIAOYA_DEV === '1'

/** 应用安装目录（只读代码与静态资源）。 */
export const appDest = process.env.TRIM_APPDEST ?? resolve(import.meta.dirname, '..')

/** 应用可写数据根目录。 */
export const pkgVar = process.env.TRIM_PKGVAR
  ?? process.env.XIAOYA_DATA_DIR
  ?? join(homedir(), '.fn-xiaoya-native')

/** 应用 home。 */
export const pkgHome = process.env.TRIM_PKGHOME ?? pkgVar

/** 临时目录。 */
export const pkgTmp = process.env.TRIM_PKGTMP ?? join(pkgVar, 'tmp')

/** 前端构建产物目录。 */
export const webRoot = join(appDest, 'ui', 'dist')

/** 小雅配置目录：即容器内 /data 的宿主机对应目录。 */
export const configDir = join(pkgVar, 'config')

/** 元数据与媒体根目录（容器内 /media）。 */
export const mediaRoot = join(pkgVar, 'media')

/** 元数据下载临时目录。 */
export const tempDir = join(mediaRoot, 'temp')

/** 元数据解压目标（媒体库根）。 */
export const xiaoyaMediaDir = join(mediaRoot, 'xiaoya')

/** Emby 配置解压目标。 */
export const embyConfigDir = join(mediaRoot, 'config')

/** 任务状态与日志目录。 */
export const stateDir = join(pkgVar, 'state')

/** 容器编排项目目录。 */
export const composeDir = join(pkgVar, 'compose')

/** 容器编排项目名。 */
export const composeProject = 'fn-xiaoya-native'

/** 小雅容器名。 */
export const alistContainer = 'fn-xiaoya-alist'

/** 网关 Socket 路径（生产环境）。 */
export const gatewaySocket = join(appDest, 'app.sock')

/** 统一网关给本应用分配的前缀。 */
export const gatewayPrefix = '/app/fn-xiaoya-native'

/**
 * 去掉网关前缀。
 *
 * 统一网关转发时保留原始路径（官方 Native 案例同样在 `/` 与网关前缀下各挂一次路由），
 * 因此服务端需要自己剥掉前缀，否则 `/app/fn-xiaoya-native/api/...` 匹配不到 `/api/...`。
 * 直接访问端口时不带前缀，函数原样返回。
 */
export function stripGatewayPrefix(pathname) {
  if (pathname === gatewayPrefix) return '/'
  if (pathname.startsWith(`${gatewayPrefix}/`)) return pathname.slice(gatewayPrefix.length)
  return pathname
}

/** 需要预先创建的目录。 */
const managedDirs = [
  configDir,
  mediaRoot,
  tempDir,
  xiaoyaMediaDir,
  embyConfigDir,
  stateDir,
  composeDir,
  pkgTmp,
]

/**
 * 幂等创建应用自有目录。
 *
 * 建完立即校验可写性：目录可能是旧版本以 root 运行时建的，
 * 现在以包用户身份就写不进去。早失败能给出明确原因，
 * 而不是等到启动容器时才报一个笼统的「没有访问权限」。
 */
export function ensureDirs() {
  for (const dir of managedDirs) {
    mkdirSync(dir, { recursive: true })
    try {
      accessSync(dir, constants.W_OK)
    }
    catch {
      // 只记录不抛：应用仍要能启动，让面板显示可诊断的信息
      console.error(`[paths] 目录不可写：${dir}（请检查归属是否为当前应用用户）`)
    }
  }
}

/**
 * 判断目标路径是否位于允许的根目录内。
 *
 * 用于拦截面板传入的越界路径。比较前对两侧都取 realpath，
 * 避免通过 `..` 或符号链接逃逸到应用目录之外。
 */
export function isInsideAllowedRoot(target, roots = [mediaRoot, configDir, stateDir, pkgTmp]) {
  let resolved
  try {
    resolved = realpathSync(resolve(target))
  }
  catch {
    // 目标尚不存在时按字面路径比较，避免创建前无法校验
    resolved = resolve(target)
  }
  return roots.some((root) => {
    let rootResolved
    try {
      rootResolved = realpathSync(resolve(root))
    }
    catch {
      rootResolved = resolve(root)
    }
    return resolved === rootResolved || resolved.startsWith(`${rootResolved}/`)
  })
}

/** 目标路径是否已存在。 */
export function exists(path) {
  return existsSync(path)
}
