/**
 * 自动刷新。
 *
 * 几个页面都需要「定时拉取 + 手动刷新」，各自写 setInterval 会重复三个坑：
 *
 * 1. **续加载导致组件闪动**：定时拉取时把 loading 置真，模板里的
 *    `v-if="!loading && !list.length"` 空状态判断会随之翻转，
 *    列表与空状态来回切换，视觉上就是「抖动一下」。
 *    这里把「静默刷新」与「用户点击刷新」分开：定时触发不碰 loading。
 *
 * 2. **间隔写死**：不同数据的更新频率差别很大（任务状态要看进度，
 *    配置类几乎不变），统一 3 秒既浪费请求也让用户无法控制。
 *
 * 3. **选择不持久**：用户选过的间隔应该记住，否则每次进页面都要重设。
 *
 * @module composables/useAutoRefresh
 */
import { onUnmounted, ref, watch } from 'vue'

/** 可选的刷新间隔（毫秒）；0 表示不自动刷新。 */
export const REFRESH_OPTIONS = [
  { label: '不刷新', value: 0 },
  { label: '5 秒', value: 5000 },
  { label: '10 秒', value: 10000 },
  { label: '30 秒', value: 30000 }
] as const

/** 合法的间隔值，用于校验持久化的选择。 */
const VALID_INTERVALS: number[] = REFRESH_OPTIONS.map((o) => o.value)

/** 默认间隔：5 秒，与容器日志的默认保持一致。 */
const DEFAULT_INTERVAL = 5000

export interface UseAutoRefreshOptions {
  /** localStorage 键名，用于记住用户选择 */
  storageKey: string
  /** 实际执行拉取的函数 */
  run: () => Promise<void> | void
  /** 默认间隔（毫秒），不传用 5000 */
  defaultInterval?: number
}

/**
 * 创建自动刷新控制器。
 *
 * @param options 配置
 * @returns 状态与控制方法
 */
export function useAutoRefresh(options: UseAutoRefreshOptions) {
  const { storageKey, run } = options

  /**
   * 读取上次选择。
   *
   * 不能直接 Number(localStorage.getItem(...))：没存过时得到 Number(null) === 0，
   * 而 0 恰好是合法值（不刷新），会被误判成「用户选过不刷新」。
   */
  function initialInterval(): number {
    // 默认值本身也必须在选项里：否则 ElSelect 找不到匹配项，
    // 会把原始数值（如 15000）当成文本直接显示出来。
    const fallback = VALID_INTERVALS.includes(options.defaultInterval ?? DEFAULT_INTERVAL)
      ? (options.defaultInterval ?? DEFAULT_INTERVAL)
      : DEFAULT_INTERVAL
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw === null) return fallback
      const parsed = Number(raw)
      return VALID_INTERVALS.includes(parsed) ? parsed : fallback
    } catch {
      return fallback
    }
  }

  const interval = ref<number>(initialInterval())
  /** 用户点击「刷新」时才为真；定时触发永远不碰它 */
  const manualLoading = ref(false)
  /** 防止慢请求堆积：上一次还没回来就跳过本次 */
  let inFlight = false
  let timer: ReturnType<typeof setInterval> | undefined

  /** 执行一次拉取。silent 为真时不改动任何 loading 状态。 */
  async function execute(silent: boolean): Promise<void> {
    if (inFlight) return
    inFlight = true
    if (!silent) manualLoading.value = true
    try {
      await run()
    } catch {
      // 单次失败不打断自动刷新；错误交给调用方在数据层展示
    } finally {
      inFlight = false
      if (!silent) manualLoading.value = false
    }
  }

  /** 用户点击刷新（按钮显示 loading）。 */
  function refresh(): Promise<void> {
    return execute(false)
  }

  /** 重建定时器。 */
  function restart(): void {
    if (timer !== undefined) {
      clearInterval(timer)
      timer = undefined
    }
    if (interval.value > 0) {
      timer = setInterval(() => {
        void execute(true)
      }, interval.value)
    }
  }

  // 切换间隔立即生效，并记住选择
  watch(interval, (value) => {
    try {
      localStorage.setItem(storageKey, String(value))
    } catch {
      // 隐私模式下 localStorage 可能不可写，不影响功能
    }
    restart()
    // 从「不刷新」切到有间隔时先取一次，让用户马上看到最新数据
    if (value > 0) void execute(true)
  })

  onUnmounted(() => {
    if (timer !== undefined) clearInterval(timer)
  })

  return {
    interval,
    /** 下拉选项（静态常量） */
    options: REFRESH_OPTIONS,
    manualLoading,
    refresh,
    restart,
    /** 组件挂载后调用：先拉一次，再启动定时器 */
    async start(): Promise<void> {
      await execute(false)
      restart()
    }
  }
}
