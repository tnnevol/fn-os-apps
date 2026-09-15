import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beginGrowthRun, finishGrowthRun, loadGrowthRunState, saveGrowthRunState } from '../src/host/growth-run.ts'

/**
 * 成长任务运行态落盘。
 *
 * 这组用例守住需求里最容易被忽略的一条：**刷新页面后按钮不能恢复成可点击**。
 * 客户端只把 running 放在组件 state 里时，刷新即丢；因此权威必须是宿主落盘的
 * 状态。这里验三件事：写读往返、原子替换（不留临时文件）、以及宿主重启留下的
 * 孤儿 `running` 会被判定为已结束（否则按钮永久卡在 loading）。
 */
let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'codebuddy-growth-run-'))
  process.env.DSH_CODEBUDDY_AUTH_FILE = join(dir, 'codebuddy-auth.json')
})

afterEach(async () => {
  delete process.env.DSH_CODEBUDDY_AUTH_FILE
  await rm(dir, { recursive: true, force: true })
})

describe('成长任务运行态落盘', () => {
  it('没有状态文件时读出 undefined（而不是报错）', async () => {
    expect(await loadGrowthRunState()).toBeUndefined()
  })

  it('begin → load 往返保留模式与目标', async () => {
    await beginGrowthRun('one', { accountId: 'acct-1', taskCode: 'chat_5' })

    const state = await loadGrowthRunState()
    expect(state).toMatchObject({
      running: true,
      mode: 'one',
      accountId: 'acct-1',
      taskCode: 'chat_5',
    })
    expect(typeof state?.startedAt).toBe('number')
  })

  it('finish 记录结束时间与结果摘要，running 归位', async () => {
    await beginGrowthRun('all')
    await finishGrowthRun('all:2 accounts')

    const state = await loadGrowthRunState()
    expect(state?.running).toBe(false)
    expect(state?.summary).toBe('all:2 accounts')
    expect(typeof state?.finishedAt).toBe('number')
  })

  it('原子写入：目录里不残留 .tmp 文件，且权限为仅属主可读写', async () => {
    await saveGrowthRunState({ running: false, mode: 'all', startedAt: Date.now() })

    const entries = (await import('node:fs')).readdirSync(dir)
    expect(entries.filter(name => name.endsWith('.tmp'))).toEqual([])
    const path = `${process.env.DSH_CODEBUDDY_AUTH_FILE}.growth-run.json`
    if (process.platform !== 'win32') {
      const mode = (await stat(path)).mode & 0o777
      expect(mode).toBe(0o600)
    }
  })

  it('宿主重启留下的孤儿 running 被判定为已结束并落盘', async () => {
    // 构造一份「很久以前开始、仍在 running」的状态：进程已经不在了，
    // 若不处理，刷新后的按钮会永远 loading。
    const stale = {
      running: true,
      mode: 'all' as const,
      startedAt: Date.now() - 31 * 60_000,
    }
    await writeFile(`${process.env.DSH_CODEBUDDY_AUTH_FILE}.growth-run.json`, JSON.stringify(stale), 'utf-8')

    const state = await loadGrowthRunState()
    expect(state?.running).toBe(false)
    // 并且已经写回磁盘，后续读取不需要再判断一次。
    const persisted = JSON.parse(
      await readFile(`${process.env.DSH_CODEBUDDY_AUTH_FILE}.growth-run.json`, 'utf-8'),
    ) as { running: boolean }
    expect(persisted.running).toBe(false)
  })

  it('损坏的状态文件读作 undefined，不抛错', async () => {
    await writeFile(`${process.env.DSH_CODEBUDDY_AUTH_FILE}.growth-run.json`, '{ not json', 'utf-8')
    expect(await loadGrowthRunState()).toBeUndefined()
  })
})

describe('逐任务在跑状态隔离', () => {
  it('一个任务在跑不会让另一个任务也被判为在跑', async () => {
    const { growthTaskKey, isGrowthTaskRunning } = await import('../src/client/store/growth-run.ts')
    const inFlight = [growthTaskKey('acct-1', 'chat_5')]
    const idle = { running: false }

    expect(isGrowthTaskRunning(inFlight, idle, 'acct-1', 'chat_5')).toBe(true)
    // 同一账号的其它任务不受影响 —— 这正是「单个任务按钮状态不要影响其他任务」。
    expect(isGrowthTaskRunning(inFlight, idle, 'acct-1', 'first_buddy')).toBe(false)
    // 其它账号的同名任务同样不受影响。
    expect(isGrowthTaskRunning(inFlight, idle, 'acct-2', 'chat_5')).toBe(false)
  })

  it('宿主单项状态只点亮对应的那个任务（覆盖刷新后本地集合丢失）', async () => {
    const { isGrowthTaskRunning } = await import('../src/client/store/growth-run.ts')
    const hostState = { running: true, mode: 'one' as const, accountId: 'acct-1', taskCode: 'chat_5' }

    expect(isGrowthTaskRunning([], hostState, 'acct-1', 'chat_5')).toBe(true)
    expect(isGrowthTaskRunning([], hostState, 'acct-1', 'first_buddy')).toBe(false)
    expect(isGrowthTaskRunning([], hostState, 'acct-2', 'chat_5')).toBe(false)
  })

  it('全量执行状态不把单个任务判为在跑（避免行内按钮误 loading）', async () => {
    const { isGrowthTaskRunning } = await import('../src/client/store/growth-run.ts')
    const hostState = { running: true, mode: 'all' as const }

    expect(isGrowthTaskRunning([], hostState, 'acct-1', 'chat_5')).toBe(false)
  })
})

describe('执行日志格式化', () => {
  it('按行输出时间 / 账号 / 任务 / 状态 / 说明', async () => {
    const { formatGrowthRunLog } = await import('../src/client/store/growth-run.ts')
    const text = formatGrowthRunLog([
      { at: new Date(2026, 0, 2, 3, 4, 5).getTime(), account: '4993', code: 'chat_5', status: 'claimed', message: '领奖 +100 积分 +0 能量' },
    ])
    // 单条时 code 宽度即自身长度（不额外补空格）；状态列补到 11 字符。
    expect(text).toBe('03:04:05 [4993] chat_5  claimed    领奖 +100 积分 +0 能量')
  })

  it('任务 code 补齐到最长者，让状态列对齐', async () => {
    const { formatGrowthRunLog } = await import('../src/client/store/growth-run.ts')
    const at = new Date(2026, 0, 2, 0, 0, 0).getTime()
    const lines = formatGrowthRunLog([
      { at, account: 'a', code: 'chat_5', status: 'pending', message: 'x' },
      { at, account: 'a', code: 'Expert_team_use_3', status: 'error', message: 'y' },
    ]).split('\n')
    // 两行的状态列起始位置必须相同（按最长 code 补齐）。
    expect(lines[0]!.indexOf('pending')).toBe(lines[1]!.indexOf('error'))
  })

  it('无日志或空数组返回空串（调用方据此显示空态）', async () => {
    const { formatGrowthRunLog } = await import('../src/client/store/growth-run.ts')
    expect(formatGrowthRunLog(undefined)).toBe('')
    expect(formatGrowthRunLog([])).toBe('')
  })

  it('省略 message 时不留下尾部空格', async () => {
    const { formatGrowthRunLog } = await import('../src/client/store/growth-run.ts')
    const text = formatGrowthRunLog([
      { at: new Date(2026, 0, 2, 0, 0, 0).getTime(), account: 'a', code: 'chat_5', status: 'claimed' },
    ])
    expect(text.endsWith('claimed')).toBe(true)
  })
})

describe('日志落盘', () => {
  it('begin 清空上一轮日志，append 逐条追加', async () => {
    const { appendGrowthRunLog, beginGrowthRun, loadGrowthRunState } = await import('../src/host/growth-run.ts')
    await beginGrowthRun('all')
    await appendGrowthRunLog({ account: 'a', code: 'chat_5', status: 'claimed', message: 'ok' })
    await appendGrowthRunLog({ account: 'b', code: 'first_buddy', status: 'error', message: 'boom' })

    const state = await loadGrowthRunState()
    expect(state?.log?.map(entry => entry.code)).toEqual(['chat_5', 'first_buddy'])
    expect(state?.log?.[0]?.at).toBeTypeOf('number')

    // 新一轮开始必须清空，否则抽屉会把上一轮结果混进来。
    await beginGrowthRun('all')
    expect((await loadGrowthRunState())?.log).toEqual([])
  })

  it('并发追加不丢日志（账号并发 4 时的读-改-写互斥）', async () => {
    const { appendGrowthRunLog, beginGrowthRun, loadGrowthRunState } = await import('../src/host/growth-run.ts')
    await beginGrowthRun('all')
    // 模拟 forEachAccount 并发 4：不串行的话「读-改-写」会互相覆盖。
    await Promise.all(Array.from({ length: 20 }, (_, i) =>
      appendGrowthRunLog({ account: `acct-${i}`, code: `task_${i}`, status: 'claimed' })))

    const log = (await loadGrowthRunState())?.log ?? []
    expect(log).toHaveLength(20)
    expect(new Set(log.map(entry => entry.code)).size).toBe(20)
  })

  it('超过上限丢最早的，保留最近进度', async () => {
    const { appendGrowthRunLog, beginGrowthRun, loadGrowthRunState, MAX_LOG_ENTRIES } = await import('../src/host/growth-run.ts')
    await beginGrowthRun('all')
    for (let i = 0; i < MAX_LOG_ENTRIES + 5; i += 1) {
      await appendGrowthRunLog({ account: 'a', code: `t${i}`, status: 'claimed' })
    }
    const log = (await loadGrowthRunState())?.log ?? []
    expect(log).toHaveLength(MAX_LOG_ENTRIES)
    // 最早 5 条被丢弃，最新一条仍在。
    expect(log[0]?.code).toBe('t5')
    expect(log.at(-1)?.code).toBe(`t${MAX_LOG_ENTRIES + 4}`)
  })

  it('finish 保留日志并标记结束（不被在途 append 覆盖）', async () => {
    const { appendGrowthRunLog, beginGrowthRun, finishGrowthRun, loadGrowthRunState } = await import('../src/host/growth-run.ts')
    await beginGrowthRun('all')
    // 追加与结束并发入队：finish 必须排在 append 之后，不能把 running 覆盖回 true。
    await Promise.all([
      appendGrowthRunLog({ account: 'a', code: 'chat_5', status: 'claimed' }),
      finishGrowthRun('all:1 accounts'),
    ])

    const state = await loadGrowthRunState()
    expect(state?.running).toBe(false)
    expect(state?.summary).toBe('all:1 accounts')
    expect(state?.log?.map(entry => entry.code)).toEqual(['chat_5'])
  })
})

/**
 * 单项任务的「立刻有日志」与「全量执行时禁点单项」。
 *
 * 前者是纯函数 `selectGrowthRunView`：把宿主状态与本地乐观起点合并，
 * 让点下按钮的瞬间抽屉就有该任务的具体日志，而不是空态或上一轮内容。
 */
describe('本地乐观日志与全量执行禁用', () => {
  const entries = [
    { at: 1, account: '4993', code: 'chat_5', status: 'running', message: '旧一轮' },
  ]

  it('宿主还没落盘时，抽屉显示本地乐观记录（该任务的具体日志）', async () => {
    const { selectGrowthRunView } = await import('../src/client/store/growth-run.ts')
    // 宿主此刻报告的是**上一轮**的全量执行。
    const host = { running: true, mode: 'all' as const, log: [{ at: 0, account: '-', code: '开始', status: 'running' }] }
    const view = selectGrowthRunView(host, { accountId: 'a1', taskCode: 'black_cat', account: '4993', startedAt: 99 }, '开始执行…')
    expect(view?.mode).toBe('one')
    expect(view?.taskCode).toBe('black_cat')
    expect(view?.running).toBe(true)
    expect(view?.log).toEqual([
      { at: 99, account: '4993', code: 'black_cat', status: 'running', message: '开始执行…' },
    ])
  })

  it('宿主已写出本轮日志后让位，避免重复显示', async () => {
    const { selectGrowthRunView } = await import('../src/client/store/growth-run.ts')
    const host = {
      running: true,
      mode: 'one' as const,
      accountId: 'a1',
      taskCode: 'black_cat',
      log: [{ at: 5, account: '4993', code: 'black_cat', status: 'running', message: '宿主写的' }],
    }
    const view = selectGrowthRunView(host, { accountId: 'a1', taskCode: 'black_cat', account: '4993', startedAt: 99 }, '开始执行…')
    // 返回宿主原值，而不是本地那条。
    expect(view).toBe(host)
  })

  it('宿主在跑同一个任务但还没写日志时，仍用本地记录', async () => {
    const { selectGrowthRunView } = await import('../src/client/store/growth-run.ts')
    const host = { running: true, mode: 'one' as const, accountId: 'a1', taskCode: 'black_cat', log: [] }
    const view = selectGrowthRunView(host, { accountId: 'a1', taskCode: 'black_cat', account: '4993', startedAt: 99 }, '开始执行…')
    expect(view?.log?.[0]?.message).toBe('开始执行…')
  })

  it('没有乐观记录时原样返回宿主状态', async () => {
    const { selectGrowthRunView } = await import('../src/client/store/growth-run.ts')
    const host = { running: false, log: entries }
    expect(selectGrowthRunView(host, undefined, 'x')).toBe(host)
    expect(selectGrowthRunView(undefined, undefined, 'x')).toBeUndefined()
  })

  it('全量执行期间禁用单项按钮', async () => {
    const { isBlockedByRunAll } = await import('../src/client/store/growth-run.ts')
    expect(isBlockedByRunAll({ running: true, mode: 'all' }, [])).toBe(true)
  })

  it('单项执行不禁用其它单项', async () => {
    const { isBlockedByRunAll } = await import('../src/client/store/growth-run.ts')
    expect(isBlockedByRunAll({ running: true, mode: 'one', accountId: 'a', taskCode: 't' }, [])).toBe(false)
    // 本地刚发起单项、宿主还是上一轮的 mode='all'：不该被误禁。
    expect(isBlockedByRunAll({ running: true, mode: 'all' }, ['a:t'])).toBe(false)
    expect(isBlockedByRunAll({ running: false }, [])).toBe(false)
  })
})
