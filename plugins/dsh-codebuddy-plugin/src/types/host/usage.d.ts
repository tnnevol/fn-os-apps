

/** 一个计量窗口：一份有名称的额度及其已消耗量。 */
export interface UsageWindow {
  /** 人类可读的套餐名称（当模型目录披露时）。 */
  name: string
  /** 已消耗量；当计量平面未上报时为 `undefined`。 */
  used?: number
  /** 本窗口的总额度；不设上限时为 `undefined`。 */
  limit?: number
  /** 已用占 `limit` 的百分比，钳制在 [0, 100]；`limit` 非正时为 `undefined`。 */
  usedPercent?: number
  /** 窗口重置时间的类 ISO 时间戳（当披露时）。 */
  resetsAt?: string
}
/** 设置界面渲染的解析后用量。 */
export interface UsageSnapshot {
  /** 计量平面报告的每个计量窗口对应一条；失败时为空。 */
  windows: UsageWindow[]
  /**
   * 第一个窗口的数据，供单条额度条展示。
   *
   * 企业租户恰好只报告一个窗口，而个人账号的第一个当前活动套餐正是
   * 一眼可见的展示入口应反映的那个。
   */
  primary?: UsageWindow
}
/** 计量平面的信封式错误应答。 */
export interface MeterErrorResponse {
  code?: number
  msg?: string
}
