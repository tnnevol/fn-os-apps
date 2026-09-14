import { describe, expect, it, vi } from 'vitest'
import { CodexWebAuth, CODEX_AUTH_URL_TIMEOUT_MS } from '../../src/host/auth-routes.ts'
import { CODEX_PROVIDER } from '../../src/host/store.ts'

/**
 * `cancel()` 与 `signOut()` 必须分开。
 *
 * 用户点「取消」时，放弃的只是**这一次**未完成的登录；如果按 `signOut()` 处理
 * （它内部会 `logoutCodex`），就会把已经登录的账号一起删掉——用户只是想退出本次
 * 授权，结果凭据被清空。这里锁住两者的差异。
 */
function fakeStore(credential: unknown) {
  // 有状态：`delete` 必须真正清掉凭据，否则 `status()` 读到的还是旧值，
  // 「退出登录后变成未登录」这类断言就失去意义。
  let current = credential
  const read = vi.fn(async () => current)
  const del = vi.fn(async () => { current = undefined })
  return { store: { read, delete: del } as never, read, del }
}

const OAUTH_CREDENTIAL = { type: 'oauth', expires: Date.now() + 3_600_000 }

describe('Codex 授权取消', () => {
  it('取消未完成的登录时不删除已保存的凭据', async () => {
    const { store, del } = fakeStore(OAUTH_CREDENTIAL)
    const auth = new CodexWebAuth(store)

    await auth.cancel()

    // 关键断言：cancel 不能碰凭据。
    expect(del).not.toHaveBeenCalled()
  })

  it('已登录时取消，状态仍然保持已登录', async () => {
    const { store } = fakeStore(OAUTH_CREDENTIAL)
    const auth = new CodexWebAuth(store)

    await auth.cancel()

    expect((await auth.status()).status).toBe('signed-in')
  })

  it('未登录时取消，状态回到未登录', async () => {
    const { store, del } = fakeStore(undefined)
    const auth = new CodexWebAuth(store)

    await auth.cancel()

    expect(del).not.toHaveBeenCalled()
    expect((await auth.status()).status).toBe('signed-out')
  })

  it('对比：退出登录会删除凭据', async () => {
    const { store, del } = fakeStore(OAUTH_CREDENTIAL)
    const auth = new CodexWebAuth(store)

    await auth.signOut()

    expect(del).toHaveBeenCalledWith(CODEX_PROVIDER)
    expect((await auth.status()).status).toBe('signed-out')
  })

  it('等授权 URL 的超时是两分钟', () => {
    // 放宽到 2 分钟是因为 30 秒对慢网络/慢网关偏紧。
    expect(CODEX_AUTH_URL_TIMEOUT_MS).toBe(120_000)
  })

  it('构造函数拒绝非正或非法超时', () => {
    const { store } = fakeStore(undefined)
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => new CodexWebAuth(store, bad)).toThrow(TypeError)
    }
  })
})
