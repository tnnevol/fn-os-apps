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
