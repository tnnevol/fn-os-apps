import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * `void promise.finally(cb)` 丢弃了新 promise，但它会带着**同一个拒绝原因**
 * 拒绝。调用方处理的是原 promise，派生出来的那个没人处理——在 dsh 的
 * fail-loud 策略下，一次目录读取或 token 刷新失败就会让整个进程 exit(1)。
 *
 * 这里直接盯住真实实现：让在途去重路径上的刷新/目录读取必然拒绝，断言没有任何
 * 未处理拒绝逃逸。
 */

let workdir: string | undefined

afterEach(() => {
  delete process.env.DSH_CODEBUDDY_AUTH_FILE
  if (workdir !== undefined) {
    rmSync(workdir, { recursive: true, force: true })
    workdir = undefined
  }
})

function useTempAuthFile(): string {
  workdir = mkdtempSync(join(tmpdir(), 'codebuddy-deferred-'))
  const path = join(workdir, 'codebuddy-auth.json')
  process.env.DSH_CODEBUDDY_AUTH_FILE = path
  return path
}

/** 捕获本用例期间逃逸的未处理拒绝。 */
async function withUnhandledCapture(run: () => Promise<void>): Promise<unknown[]> {
  const seen: unknown[] = []
  const onUnhandled = (reason: unknown): void => { seen.push(reason) }
  process.on('unhandledRejection', onUnhandled)
  try {
    await run()
    // 让 microtask/timer 队列先排空，派生 promise 的拒绝才会浮现。
    await new Promise(resolve => setTimeout(resolve, 0))
    await new Promise(resolve => setTimeout(resolve, 0))
  } finally {
    process.off('unhandledRejection', onUnhandled)
  }
  return seen
}

describe('CodeBuddySession 在途去重不泄漏未处理拒绝', () => {
  it('目录读取失败时只让调用方处理，派生 promise 不逃逸', async () => {
    useTempAuthFile()
    const { CodeBuddySession } = await import('../src/host/session.ts')
    const { saveStorage } = await import('../src/host/storage.ts')

    await saveStorage({
      activeId: 'a1',
      accounts: [{
        id: 'a1',
        auth: {
          // 已过期但要靠 refresh 续期，且 refreshExpiresAt 仍在有效期内：
          // 这样 identity() 走刷新分支，而刷新会因无人可用的端点失败。
          accessToken: 'expired',
          expiresAt: Date.now() - 1_000,
          refreshToken: 'r1',
          refreshExpiresAt: Date.now() + 86_400_000,
          domain: 'invalid.invalid',
        },
        account: { uid: 'u1', nickname: 'n1' },
      }],
    })

    const session = new CodeBuddySession()
    const leaked = await withUnhandledCapture(async () => {
      // 调用方自己处理拒绝（与 adapter 的行为一致）。
      await session.identity().catch(() => undefined)
    })

    expect(leaked).toEqual([])
  })

  it('目录读取并发去重时同样不逃逸', async () => {
    useTempAuthFile()
    const { CodeBuddySession } = await import('../src/host/session.ts')
    const { saveStorage } = await import('../src/host/storage.ts')

    await saveStorage({
      activeId: 'a1',
      accounts: [{
        id: 'a1',
        auth: {
          accessToken: 't1',
          expiresAt: Date.now() + 86_400_000,
          refreshToken: 'r1',
          refreshExpiresAt: Date.now() + 86_400_000,
          domain: 'invalid.invalid',
        },
        account: { uid: 'u1', nickname: 'n1' },
      }],
    })

    const session = new CodeBuddySession()
    const leaked = await withUnhandledCapture(async () => {
      // 两次并发调用命中同一个在途 promise（第二个直接复用第一个）。
      await Promise.allSettled([session.models(), session.models()])
    })

    expect(leaked).toEqual([])
  })
})

describe('未处理拒绝捕获本身有效', () => {
  it('能观察到派生 promise 的拒绝（防止测试假阴性）', async () => {
    const leaked = await withUnhandledCapture(async () => {
      const base = Promise.reject(new Error('boom'))
      void base.finally(() => undefined)
      await base.catch(() => undefined)
    })
    expect(leaked).toHaveLength(1)
  })
})
