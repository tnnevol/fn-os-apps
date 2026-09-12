/**
 * 设置页与输入框指示器共享的本地用量指示器偏好。
 *
 * 这些是纯 UI 辅助开关，除展示外没有业务含义，因此存放在浏览器 storage
 * 而不是 Host 的用户设置文档里。
 *
 * 用 nanostores 的持久化 atom 承载，而不是各处直接读写 `localStorage`：
 *
 * - **一份状态、多处分发**：设置页与输入框指示器订阅同一个 atom，原生 store
 *   保证「先写后读」的一致顺序，不再需要手写的监听器集合 + 手动 emit。
 * - **跨标签同步**由 `@nanostores/persistent` 内置：它监听 `storage` 事件，
 *   并额外监听 `pageshow` —— 后者覆盖「浏览器从 bfcache 恢复页面」这一场景，
 *   手写实现（只监听 `storage`）会漏掉它。
 * - **私密模式安全**：库在模块加载时探测 `localStorage` 可用性，不可用时退回
 *   内存对象，因此读写在私密模式下不会抛错（原先每处都要包 try/catch）。
 *
 * 存储格式**保持与迁移前完全一致**（布尔为 `'1'`/`'0'`，阈值是十进制字符串），
 * 因此用户已有设置无需迁移、也不会被读成默认值。注意**不能**改用库自带的
 * `persistentBoolean`：它按 `'yes'`/`''` 编解码且缺省为 `false`，而这里缺省为
 * `true`，直接替换会把用户已有设置静默反转。
 */

import { persistentAtom } from '@nanostores/persistent'
import {
  CODEBUDDY_AUTO_CHECKIN_KEY,
  CODEBUDDY_AUTO_SWITCH_KEY,
  CODEBUDDY_AUTO_TRAVEL_KEY,
  CODEBUDDY_SHOW_USAGE_KEY,
} from '../constants.ts'

/**
 * 布尔偏好的编解码：沿用 `'1'`/`'0'`，缺省值为 `true`。
 *
 * 缺省为 true 是既有语义（键不存在时视为开启）：首次打开（无键）与用户手动关闭
 * （键为 `'0'`）必须可区分，因此「未设置」不写成 `'0'`，只由 initial 承担默认值。
 */
function createBoolPref(key: string) {
  return persistentAtom(key, true, {
    encode: (value: boolean): string => (value ? '1' : '0'),
    // 只有显式写入 `'0'` 才算关闭；其它情况（含空串、脏数据）一律视为开启，
    // 与迁移前 `getItem(...) !== '0'` 的判断完全相同。
    decode: (raw: string): boolean => raw !== '0',
  })
}

/** 输入框用量指示器的显示开关；缺省显示。 */
export const $showUsage = createBoolPref(CODEBUDDY_SHOW_USAGE_KEY)

/** 自动切换账号；缺省开启。 */
export const $autoSwitch = createBoolPref(CODEBUDDY_AUTO_SWITCH_KEY)

/** 自动每日签到；缺省开启。 */
export const $autoCheckin = createBoolPref(CODEBUDDY_AUTO_CHECKIN_KEY)

/** 自动派发旅行；缺省开启。 */
export const $autoTravel = createBoolPref(CODEBUDDY_AUTO_TRAVEL_KEY)

/**
 * 阈值归一化：取整并夹到 [0, 100]，非法值回落 10。
 *
 * 入参为 `unknown` 是因为它同时用于**写入前**与**解码后**两处，且都可能遇到
 * 非法值（调用方传入 NaN、storage 里是脏字符串）。
 */
function normalizeThreshold(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? Math.round(parsed) : 10
}

/**
 * 写入前先归一化，再交给 atom。
 *
 * **不能只依赖 `encode` 取整**：persistentAtom 的 set 只把编码后的值写进
 * storage，atom 自身的值仍是传入的原始值（见库源码：`store.set = newValue =>
 * { prevValue = encode(newValue); storageEngine[name] = prevValue; set(newValue) }`）。
 * 于是 `set(7.6)` 会让内存读到 7.6、storage 里是 "8"，刷新后才变成 8 —— 内存与
 * 存储不一致。在这里先取整即可让两者始终相同。
 *
 * （迁移前的手写实现没有内存副本，因此不存在这个差异；这是引入状态管理后
 * 必须显式处理的点。）
 */
function setThreshold(value: number): void {
  $autoSwitchThreshold.set(normalizeThreshold(value))
}

/**
 * 自动切换的剩余额度阈值（百分比）；缺省 10。
 *
 * 用独立键 `${CODEBUDDY_AUTO_SWITCH_KEY}:threshold`，与迁移前一致。
 * 越界或非法值一律回落 10，避免脏数据让切换逻辑出现意外行为。
 * 写入请走 {@link setThreshold}，以保证内存与存储一致。
 */
export const $autoSwitchThreshold = persistentAtom(`${CODEBUDDY_AUTO_SWITCH_KEY}:threshold`, 10, {
  encode: (value: number): string => String(Math.round(value)),
  decode: (raw: string): number => normalizeThreshold(raw),
})

/* ---------------------------------------------------------------------------
   批量订阅
   --------------------------------------------------------------------------- */

/** 写入阈值（先归一化，保证内存与存储一致）。 */
export { setThreshold }

/** 全部受管 store，便于「有任一偏好变化」这类批量订阅（如面板同步到 host）。 */
export const USAGE_PREF_STORES = [$showUsage, $autoSwitch, $autoCheckin, $autoTravel, $autoSwitchThreshold] as const

/**
 * 订阅**任一**偏好变化；返回取消订阅的函数。
 *
 * 供「任一侧改动后要同步 host」的场景使用（原先靠手写的监听器集合实现）。
 *
 * 用 `listen` 而不是 `subscribe`：nanostores 的 `subscribe` 会在注册时**立即
 * 同步回调一次**当前值，而这里有 5 个 store —— 用 `subscribe` 会在订阅瞬间触发
 * 5 次回调，对「同步 host」的调用方就是 5 次多余 RPC。`listen` 只注册，语义也
 * 更贴合函数名：只在偏好真正变化时回调。
 *
 * 另注：持久化 store 的跨标签监听挂在 `onMount` 上，而 `listen`/`subscribe`
 * 都会维持 mount，因此订阅期间跨标签同步同样有效。
 */
export function subscribeUsagePref(listener: () => void): () => void {
  const disposers = USAGE_PREF_STORES.map(store => store.listen(listener))
  return () => { for (const dispose of disposers) dispose() }
}

/* ---------------------------------------------------------------------------
   采纳 Host 期间抑制回推
   --------------------------------------------------------------------------- */

/**
 * 正在「从 Host 采纳偏好」的嵌套深度。
 *
 * 为什么必须抑制：`subscribeUsagePref` 的回调会把**当前全部**偏好推给 Host，
 * 而采纳是逐个 `set` 的。第一个 `set` 就同步触发回调时，**其余偏好尚未采纳**，
 * 于是回调把它们的**本地旧值**推了上去，把 Host 上更新的值覆盖掉——正是这个
 * 模块顶部注释里已经修过一次的问题（「曾经把三个开关的持久化值推给主机，会让
 * Host 上更新的值被旧 localStorage 静默覆盖」），只是换了个入口借道回推。
 *
 * 实测（persistentAtom 的 `listen`）：host 给 `a=true,b=false`、本地为
 * `a=false,b=true` 时，`a.set(true)` 触发的第一次回调读到的组合是
 * `{a:true, b:true}` —— b 仍是本地旧值，随即被推给 Host。
 *
 * 用深度计数而不是布尔：采纳可能嵌套（设置页与面板的 hook 同时挂载），
 * 布尔会被内层提前复位。
 */
let adopting = 0

/**
 * 在「从 Host 采纳」期间执行 `apply`，其间不触发任何回推。
 *
 * 用法：把连续的若干个 `set` 包起来，让它们对外表现为一次原子采纳。
 *
 * 注意 `listen` 的回调是**同步**调用的，因此这里的抑制对同一次 `set` 立即生效，
 * 不存在「回调稍后才跑、错过抑制窗口」的情况。
 *
 * @param apply - 执行采纳动作（通常是若干次 store.set）。
 * @returns `apply` 的返回值。
 */
export function whileAdoptingPrefs<T>(apply: () => T): T {
  adopting += 1
  try {
    return apply()
  } finally {
    adopting -= 1
  }
}

/**
 * 当前是否处于采纳期间。
 *
 * 供回推方（`useAutoPrefs` 的订阅回调）判断：采纳引起的 store 变化不应回推给
 * Host——那是 Host 自己的值绕一圈回来，没有任何新信息，还会覆盖别的窗口刚做的
 * 修改。
 *
 * @returns 采纳中返回 true。
 */
export function isAdoptingPrefs(): boolean {
  return adopting > 0
}

/**
 * Host 侧 `autoPrefs` 端点的返回形状（本模块只用到这四项）。
 */
export interface HostAutoPrefs {
  autoSwitch: boolean
  autoSwitchThresholdPct: number
  autoCheckin: boolean
  autoTravel: boolean
}

/**
 * 把 Host 的偏好**整组原子采纳**到本地 store。
 *
 * 抽成单一函数的原因：这段逻辑原先在设置页（`CodeBuddySection` 的 mount effect）
 * 与面板 hook（`useAutoPrefs`）各写了一份，于是两份**默默漂移**了——设置页采纳
 * 四项（三个开关 + 阈值），hook 只采纳三个开关，导致同一份 Host 配置在两端得到
 * 不同的本地副本。同一件事写两遍就会出现这种分歧，因此收敛到这里，让「采纳哪些
 * 字段」只有一个定义。
 *
 * 整体包在 {@link whileAdoptingPrefs} 里：逐个 `set` 会同步触发回推订阅，而回推
 * 读的是「当前全部偏好」，第一个 `set` 触发时其余尚未采纳，会把本地旧值推给 Host。
 *
 * @param host - 已从 Host 读到的偏好（调用方负责判断 `hasStoredPrefs`）。
 */
export function adoptHostPrefs(host: HostAutoPrefs): void {
  whileAdoptingPrefs(() => {
    $autoSwitch.set(host.autoSwitch)
    setThreshold(host.autoSwitchThresholdPct)
    $autoCheckin.set(host.autoCheckin)
    $autoTravel.set(host.autoTravel)
  })
}
