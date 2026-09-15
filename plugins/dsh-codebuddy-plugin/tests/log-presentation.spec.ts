import { describe, expect, it } from 'vitest'
import { formatLogTime, growthLogLines, growthLogText, statusTone } from '../src/client/log-presentation.ts'

/**
 * 日志的展示模型。
 *
 * 拆出来做纯数据，是因为「终端风格」要给时间/账号/状态分别上色，而
 * `CodeHighlight` 只接收纯字符串——分段着色只能自己渲染。渲染与纯文本复制
 * 共用同一份逐行数据，这里守住对齐与色调映射。
 */
const at = new Date(2026, 0, 2, 3, 4, 5).getTime()

describe('逐行展示数据', () => {
  it('时间格式化为 HH:MM:SS', () => {
    expect(formatLogTime(at)).toBe('03:04:05')
    expect(formatLogTime(new Date(2026, 0, 2, 23, 59, 9).getTime())).toBe('23:59:09')
  })

  it('code 补齐到最长者，让状态列纵向对齐', () => {
    const lines = growthLogLines([
      { at, account: 'a', code: 'chat_5', status: 'pending', message: 'x' },
      { at, account: 'a', code: 'Expert_team_use_3', status: 'error', message: 'y' },
    ])
    expect(lines[0]!.code).toHaveLength('Expert_team_use_3'.length)
    expect(lines[1]!.code).toHaveLength('Expert_team_use_3'.length)
  })

  it('账号带上方括号，模仿终端 [user] 前缀', () => {
    const lines = growthLogLines([{ at, account: '4993', code: 'chat_5', status: 'claimed' }])
    expect(lines[0]!.account).toBe('[4993]')
  })

  it('无日志返回空数组（调用方据此显示空态）', () => {
    expect(growthLogLines(undefined)).toEqual([])
    expect(growthLogLines([])).toEqual([])
  })

  it('缺省 message 时不产生该字段（不渲染空说明）', () => {
    const lines = growthLogLines([{ at, account: 'a', code: 'chat_5', status: 'claimed' }])
    expect('message' in lines[0]!).toBe(false)
  })

  it('每行都带 tone，且 pending 的色调取决于进度', () => {
    const lines = growthLogLines([
      { at, account: 'a', code: 't1', status: 'pending', current: 0, target: 5 },
      { at, account: 'a', code: 't2', status: 'pending', current: 2, target: 5 },
      { at, account: 'a', code: 't3', status: 'claimed' },
    ])
    expect(lines[0]!.tone).toBe('error')
    expect(lines[1]!.tone).toBe('warn')
    expect(lines[2]!.tone).toBe('ok')
  })
})

describe('纯文本拼接与渲染共用同一份数据', () => {
  it('保持与逐行数据一致的对齐，且不留下尾部空格', () => {
    const lines = growthLogLines([
      { at, account: '4993', code: 'chat_5', status: 'claimed', message: '领奖 +100 积分' },
      { at, account: '5975', code: 'first_buddy', status: 'pending' },
    ])
    const text = growthLogText(lines)
    const [first, second] = text.split('\n')
    expect(first!.endsWith('领奖 +100 积分')).toBe(true)
    expect(second!.endsWith('pending')).toBe(true)
    // 状态列起点一致 → 说明列对齐。
    expect(first!.indexOf('claimed')).toBe(second!.indexOf('pending'))
  })
})

/**
 * 色调规则（由使用者指定）：
 *   - 未完成 → 红
 *   - 完成 / 跳过 → 绿
 *   - 完成了一半 → 黄
 *   - 进行中 → 蓝（过程标记，不算结局）
 */
describe('状态色调映射', () => {
  it('完成类为绿（ok）', () => {
    for (const status of ['claimed', 'success', 'done', 'already']) expect(statusTone(status)).toBe('ok')
  })

  it('跳过类也是绿：不用再做＝终态', () => {
    for (const status of ['skipped', 'unsupported', 'daily-limit']) expect(statusTone(status)).toBe('ok')
  })

  it('失败为红', () => {
    expect(statusTone('error')).toBe('error')
  })

  it('未完成（零进度）为红', () => {
    expect(statusTone('pending')).toBe('error')
    expect(statusTone('pending', { current: 0, target: 5 })).toBe('error')
  })

  it('完成了一半（有进度未达标）为黄', () => {
    expect(statusTone('pending', { current: 2, target: 5 })).toBe('warn')
    expect(statusTone('pending', { current: 1, target: 1 })).toBe('warn')
  })

  it('旅行中间态按「完成了一半」为黄', () => {
    for (const status of ['traveling', 'departed', 'claiming', 'no-buddy', 'adopted', 'adopt-threshold']) {
      expect(statusTone(status)).toBe('warn')
    }
  })

  it('进行中为蓝（过程标记而非结局）', () => {
    for (const status of ['running', 'accepted', 'waiting']) expect(statusTone(status)).toBe('info')
  })

  it('带对齐尾随空格也能识别（宿主写入的 status 已 padEnd）', () => {
    expect(statusTone('claimed    ')).toBe('ok')
    expect(statusTone(' pending ')).toBe('error')
    expect(statusTone(' pending ', { current: 3, target: 5 })).toBe('warn')
  })

  it('未登记状态回落到 info，不误标成功或失败', () => {
    expect(statusTone('whatever')).toBe('info')
    expect(statusTone('')).toBe('info')
  })
})
