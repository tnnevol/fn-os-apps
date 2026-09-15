import { describe, expect, it } from 'vitest'
import { groupGrowthTasks } from '../src/client/growth-task-groups.ts'

/**
 * 成长任务分栏规则。
 *
 * 判定只看 `claimed`：进度达标但**还没领奖**（claimable）仍算未完成——它还需要
 * 用户点一次「完成」去领奖，放进已完成会让那个入口消失。这是分组规则本身，
 * 不是渲染细节，所以用纯函数单测守住。
 */
describe('成长任务分组', () => {
  it('按 claimed 分成未完成与已完成', () => {
    const groups = groupGrowthTasks([
      { claimed: false },
      { claimed: true },
      { claimed: false },
    ])
    expect(groups.pending).toHaveLength(2)
    expect(groups.done).toHaveLength(1)
  })

  it('达标未领奖算未完成（还要点完成去领奖）', () => {
    // claimable 的任务仍在未完成栏——否则「完成」入口会消失。
    const groups = groupGrowthTasks([{ claimed: false }])
    expect(groups.pending).toHaveLength(1)
    expect(groups.done).toHaveLength(0)
  })

  it('保持原始顺序，不重排（避免刷新后行位置跳动）', () => {
    const input = [
      { key: 'a', claimed: false },
      { key: 'b', claimed: true },
      { key: 'c', claimed: false },
      { key: 'd', claimed: true },
    ]
    const groups = groupGrowthTasks(input)
    expect(groups.pending.map(task => task.key)).toEqual(['a', 'c'])
    expect(groups.done.map(task => task.key)).toEqual(['b', 'd'])
  })

  it('空输入得到两个空栏', () => {
    const groups = groupGrowthTasks([])
    expect(groups.pending).toEqual([])
    expect(groups.done).toEqual([])
  })
})
