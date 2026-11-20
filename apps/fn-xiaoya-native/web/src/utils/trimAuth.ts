/**
 * 飞牛目录授权（前端）。
 *
 * 生产环境：页面运行在飞牛桌面宿主里，调用 `pickSharedFile` 弹出系统
 * 目录选择器，管理员选中即完成授权。
 *
 * 开发环境：没有宿主，`isStandaloneWeb` 为真，方法返回 `{supported:false}`，
 * 由调用方展示说明，不崩溃、不卡 loading。
 *
 * ## 环境判断为什么用 SDK 而不是自己探测
 *
 * 之前用 `window.$trim` / `window.trimAppBridge` 这类全局变量判断，
 * 结果在真实飞牛桌面里也判定成「不支持」——因为 SDK 根本不注入这些全局，
 * 它是在 `new TrimApp()` 时通过 postMessage 与父窗口握手来确定宿主是否存在，
 * 握手成功则 `isStandaloneWeb = false`。
 *
 * 所以判断必须交给 SDK：等 `ready()` 之后读 `sdk.isStandaloneWeb`。
 */
import type { TrimApp } from '@trimjs/web-app'

/** 目录选择器可展示的侧边栏分组。 */
type SidebarGroup = 'myFiles' | 'otherShare' | 'external' | 'remote' | 'favorites' | 'team'

/** 授权结果。 */
export interface PickResult {
  /** 当前环境是否支持（开发环境为 false） */
  supported: boolean
  /** 授权成功的目录（可能多个） */
  paths: string[]
  /** 用户取消或失败时的说明 */
  reason?: string
}

/** SDK 实例缓存：握手成功一次就复用，失败不缓存以便重试。 */
let sdkPromise: Promise<TrimApp | null> | null = null

/**
 * 懒加载并初始化 SDK。
 *
 * 用动态 import：开发环境没有宿主，SDK 的握手会失败，
 * 把失败收在这一层，不影响面板其它页面的打包与运行。
 */
async function getSdk(): Promise<TrimApp | null> {
  if (sdkPromise !== null) return sdkPromise
  sdkPromise = (async () => {
    try {
      const mod = await import('@trimjs/web-app')
      const sdk = new mod.TrimApp({ debug: false })
      // ready() 会等 postMessage 握手结束，之后 isStandaloneWeb 才可信。
      // 非宿主环境下 SDK 会依次探测：原生桥 1.5s + 扩展宿主 5s + postmate 1.5s，
      // 合计约 8s；超时太短会把真实宿主误判成不支持。
      //
      await withTimeout(sdk.ready(), 9_000)
      // 注意：不要用「握手是否超时」去覆盖 isStandaloneWeb。
      // 飞牛桌面里页面是以 iframe 嵌入的，握手可能需要更久；
      // 之前在这里强行置 true，导致明明在宿主内却走了 openAppAuth，
      // 报「当前页面未运行在飞牛桌面内」。
      // 判断交给 resolveStandalone()：它以「是否在 iframe 内」这个
      // 客观事实为准，超时只影响是否等得到 SDK 自己的结论。
      return sdk
    } catch {
      // 初始化失败：清空缓存，下次点击可重新探测（例如用户在桌面里重新打开）
      sdkPromise = null
      return null
    }
  })()
  return sdkPromise
}

/**
 * 给可能长期挂起的 Promise 加超时。
 *
 * 非宿主环境下 SDK 的握手既不 resolve 也不 reject，
 * 没有超时会让按钮一直转圈。
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise<T | undefined>((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      resolve(undefined)
    }, ms)
    promise.then(
      (value) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

/**
 * 是否应按「独立浏览器」处理。
 *
 * 判断依据优先看客观事实：页面是否被嵌在 iframe 里。
 * - 在 iframe 内 → 一定是宿主嵌入，走 pickSharedFile 直调；
 * - 顶层页面 → 独立浏览器，走 openAppAuth。
 *
 * SDK 的 isStandaloneWeb 作为补充：它握手成功时更权威，
 * 但握手超时时保持初值 false，不能单凭它下结论。
 *
 * @param sdk SDK 实例
 * @returns 是否走独立浏览器路径
 */
function resolveStandalone(sdk: TrimApp): boolean {
  // 宿主内嵌时 window.parent !== window，这是最可靠的信号
  const inIframe = typeof window !== 'undefined' && window.parent !== window
  if (inIframe) return false
  // 顶层页面：SDK 明确说「在宿主内」时才认为不是独立浏览器
  return sdk.isStandaloneWeb !== false
}

/**
 * 当前是否运行在飞牛宿主内。
 *
 * @returns 是否具备宿主能力
 */
export async function isHostAvailable(): Promise<boolean> {
  const sdk = await getSdk()
  if (sdk === null) return false
  return !resolveStandalone(sdk)
}

/**
 * 打开飞牛目录选择器，让管理员授权目录。
 *
 * 标题由组件在调用时通过 SDK 参数传入，这里不再接收入参。
 */
/** 应用名，需与 manifest 的 appname 一致 */
const APP_NAME = 'fn-xiaoya-native'

/** 授权回调页（同域，通过统一网关访问） */
const REDIRECT_PATH = '/app/fn-xiaoya-native/app-auth-callback.html'

/** postMessage 的消息类型，与回调页约定 */
export const AUTH_MESSAGE_TYPE = 'fn-xiaoya:app-auth-result'

/** 保存本次授权请求的 state，回调时校验来源 */
const AUTH_STATE_KEY = 'fn-xiaoya:auth-state'

/**
 * 打开飞牛目录选择器，让管理员授权目录。
 *
 * 两条路径，按文档区分：
 * - 宿主内（isStandaloneWeb=false）：直接调 pickSharedFile，选中即返回；
 * - 独立浏览器（isStandaloneWeb=true）：直接调没有宿主可路由，
 *   必须用 openAppAuth 打开系统授权页，授权后跳到回调页，
 *   再由回调页 postMessage 通知本页。
 *
 * 之前只实现了第一条并直接报「未运行在飞牛桌面内」，
 * 导致通过网关直接访问（非 iframe）时功能完全不可用。
 *
 * @returns 授权结果；独立浏览器路径下 paths 为空，需由监听器接收回调
 */
export async function pickSharedFolder(): Promise<PickResult> {
  const sdk = await getSdk()
  if (sdk === null) {
    return { supported: false, paths: [], reason: '当前环境无法加载飞牛 SDK' }
  }

  if (resolveStandalone(sdk)) {
    return openAuthWindow(sdk)
  }

  try {
    const result = await sdk.pickSharedFile({
      // 侧边栏分组顺序即展示顺序；只给用户可能放元数据的几处
      sidebarGroup: ['myFiles', 'otherShare', 'external'] as SidebarGroup[],
      title: '选择元数据目录',
      okText: '确认授权',
      // 允许在选择器里直接新建目录，省去先去文件管理器建文件夹
      creatable: true
    })

    if (result === undefined || result === null) {
      return { supported: false, paths: [], reason: '目录选择器没有返回结果，请重试' }
    }
    if (result.code !== 0) {
      return {
        supported: true,
        paths: [],
        reason: result.message || '授权失败：需要管理员权限'
      }
    }

    const paths = Array.isArray(result.data)
      ? result.data.filter((p) => typeof p === 'string' && p !== '')
      : []
    if (paths.length === 0) {
      // code 0 但没有路径：用户取消，或宿主未选中任何目录
      return { supported: true, paths: [], reason: '没有选择目录' }
    }
    return { supported: true, paths }
  } catch (error) {
    return {
      supported: true,
      paths: [],
      reason: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * 独立浏览器下走 openAppAuth。
 *
 * 打开独立窗口而不是 _self：授权过程会离开当前页面，
 * 用新窗口可以让用户授权后回到原页面继续操作。
 */
async function openAuthWindow(sdk: TrimApp): Promise<PickResult> {
  try {
    // state 用于回调页确认结果来自本次请求
    const state = `st-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    try {
      sessionStorage.setItem(AUTH_STATE_KEY, state)
    } catch {
      // 隐私模式不可写时不阻断，只是少了一层校验
    }

    await sdk.openAppAuth(
      'pickSharedFile',
      {
        appName: APP_NAME,
        sidebarGroup: ['myFiles', 'otherShare', 'external'] as SidebarGroup[],
        redirectUri: REDIRECT_PATH,
        state
      },
      { target: '_blank', features: 'width=880,height=680' }
    )

    return {
      supported: true,
      paths: [],
      reason: '已打开系统授权页面，完成授权后本页会自动更新'
    }
  } catch (error) {
    return {
      supported: false,
      paths: [],
      reason: `无法打开授权页面：${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * 监听授权回调。
 *
 * 回调页通过 postMessage 把结果发回来，这里校验同源与 type 后取出路径。
 *
 * @param onResult 收到授权结果时回调
 * @returns 取消监听的函数
 */
export function onAuthCallback(onResult: (paths: string[]) => void): () => void {
  function handler(event: MessageEvent): void {
    if (event.origin !== window.location.origin) return
    const data = event.data as { type?: string; result?: { status?: string; path?: string[] } }
    if (data?.type !== AUTH_MESSAGE_TYPE) return
    if (data.result?.status !== 'success') return
    const paths = Array.isArray(data.result.path)
      ? data.result.path.filter((p): p is string => typeof p === 'string' && p !== '')
      : []
    if (paths.length > 0) onResult(paths)
  }

  window.addEventListener('message', handler)
  return () => window.removeEventListener('message', handler)
}

/** 供测试与排查：清空 SDK 缓存，下次重新握手。 */
export function resetTrimSdk(): void {
  sdkPromise = null
}

/**
 * 预热 SDK 握手。
 *
 * SDK 在非宿主环境要依次探测原生桥、扩展宿主、postmate，最长约 8 秒。
 * 若等用户点「选择目录」才开始，按钮会转很久圈。
 * 页面挂载时先跑一遍，用户真正点击时结果通常已在缓存里。
 *
 * 失败不抛出：预热只是优化，不影响后续手动重试。
 */
export function warmupTrim(): void {
  void getSdk().catch(() => undefined)
}
