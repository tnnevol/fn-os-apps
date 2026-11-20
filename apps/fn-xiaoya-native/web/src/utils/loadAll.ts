/**
 * 页面数据加载辅助。
 *
 * 各页面普遍要同时拉多个互不依赖的接口。之前统一用 `Promise.all`，
 * 结果是「一个接口失败 → 整页白屏 + 控制台未捕获的 HttpError」。
 * 面板里有多个可选接口（Docker 未就绪、未配置账号、任务文件缺失都可能 500），
 * 所以这里统一改成 allSettled 语义：能拿到的先显示，拿不到的保留上一次的值。
 *
 * 注意：这只是容错，不掩盖错误——调用方仍可通过 `failed` 判断
 * 是否有接口失败，需要提示用户时自行提示。
 */

/** 单个槽位的结果。 */
export interface Slot<T> {
  /** 有值表示成功，undefined 表示该请求失败 */
  data: T | undefined
  /** 该请求是否失败 */
  failed: boolean
}

/** 批量加载的整体结果。 */
export interface LoadResult {
  /** 失败的接口数量 */
  failedCount: number
  /** 是否全部失败（通常意味着后端整体不可用） */
  allFailed: boolean
}

/**
 * 并行加载多个接口，任一失败不影响其它。
 *
 * 用法：
 * ```ts
 * const [a, b] = await loadAll([fetchA(), fetchB()])
 * if (a.data) { ... }
 * ```
 */
export async function loadAll<T extends readonly unknown[]>(
  promises: [...{ [K in keyof T]: Promise<T[K]> }]
): Promise<{ [K in keyof T]: Slot<T[K]> } & LoadResult> {
  const settled = await Promise.allSettled(promises)

  const slots = settled.map((item) =>
    item.status === 'fulfilled'
      ? { data: item.value, failed: false }
      : { data: undefined, failed: true }
  )

  const failedCount = slots.filter((s) => s.failed).length
  return Object.assign(slots, {
    failedCount,
    allFailed: failedCount === slots.length && slots.length > 0
  }) as { [K in keyof T]: Slot<T[K]> } & LoadResult
}
