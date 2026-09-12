

/** 探测观测到的单个资源包。 */
export interface ResourceSnapshot {
  /** 稳定的包标识：名称 + 周期起点，因为名称会重复。 */
  key: string
  name: string
  total: number | null
  remaining: number | null
  /** 平面披露的重置/到期时间戳字符串。 */
  resetsAt: string | null
  /** 返回过该包的最近一次探测的 epoch 毫秒。 */
  lastSeenAt: number
}
export type HistoryDocument = Record<string, ResourceSnapshot[]>
/** 面板收到的单个资源行（来自 host）。 */
export interface LiveResource {
  name: string
  total: number | null
  remaining: number | null
  resetsAt: string | null
}
/** 资源包所属的生命周期分组。 */
export type ResourceLifecycle = 'usable' | 'depleted' | 'expired'
/** 对话框渲染的单个分类后的资源包行。 */
export interface ClassifiedResource extends ResourceSnapshot {
  lifecycle: ResourceLifecycle
  /** 实时探测是否仍返回该包。 */
  live: boolean
}
