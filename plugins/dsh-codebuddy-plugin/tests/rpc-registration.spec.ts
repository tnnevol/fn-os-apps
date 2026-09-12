import { describe, expect, it, vi } from 'vitest'
import { CodeBuddyAuthService } from '../src/host/auth-service.ts'
import { CodeBuddySession } from '../src/host/session.ts'

vi.mock('../src/host/storage.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/host/storage.ts')>()
  return {
    ...actual,
    loadAutoSwitchConfig: async () => ({ enabled: false, thresholdPct: 10 }),
    loadAutoCheckinConfig: async () => ({ enabled: false }),
    loadAutoTravelConfig: async () => ({ enabled: false }),
  }
})

describe('CodeBuddy auth RPC registration', () => {
  it('when connection is ready, mounts /codebuddy synchronously', () => {
    let registeredChannel: string | undefined
    let injectCalls = 0
    const connection = {
      rpc: {
        handle: (channel: string): (() => void) => {
          registeredChannel = channel
          return () => {}
        },
      },
    }
    const ctx = {
      logger: { warn: () => {}, info: () => {} },
      get: (key: string): unknown => key === 'connection' ? connection : undefined,
      effect: (fn: () => () => void): void => { fn() },
      inject: (): void => { injectCalls += 1 },
    }

    void new CodeBuddyAuthService(ctx as never, new CodeBuddySession())

    expect(registeredChannel).toBe('/codebuddy')
    expect(injectCalls).toBe(0)
  })
})
