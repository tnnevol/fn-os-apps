/**
 * 成长任务的分组：未完成 / 已完成。
 *
 * 判定只看 `claimed`，不看进度是否达标：
 *  - 进度达标但还没领奖（`claimable`）仍然算**未完成**——它还需要用户点一次
 *    「完成」去领奖，放进已完成会让那个入口消失；
 *  - `claimed` 才是终态（奖励已到账），之后重复执行会被上游按幂等处理。
 *
 * 抽成纯函数而不是写在组件里，是为了让「哪些任务归哪一栏」有单测守着：
 * 这是分组规则，不是渲染细节。
 *
 * @module dsh-codebuddy/growth-task-groups
 */

/** 分组只看这一个字段，便于测试与复用（不依赖完整的 GrowthTaskView）。 */
export interface GrowthTaskGroupable {
  claimed: boolean
}

/** 未完成 / 已完成两栏的内容。 */
export interface GrowthTaskGroups<T> {
  pending: T[]
  done: T[]
}

/**
 * 把一个账号的成长任务分成未完成与已完成两栏。
 *
 * 保持入参顺序（不重排）：上游返回的任务顺序是稳定的，重排会让用户在
 * 刷新后看到行位置跳动。
 *
 * @param tasks - 该账号的全部成长任务。
 * @returns 两栏数组；`pending` 为未领奖的任务，`done` 为已领奖的任务。
 */
export function groupGrowthTasks<T extends GrowthTaskGroupable>(tasks: readonly T[]): GrowthTaskGroups<T> {
  const pending: T[] = []
  const done: T[] = []
  for (const task of tasks) {
    if (task.claimed) done.push(task)
    else pending.push(task)
  }
  return { pending, done }
}
