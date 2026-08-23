import { describe, expect, it } from 'vitest'
import { shouldForceWebCarrier } from '../src/client/sdk-carrier.ts'
import { installFnosPageTitle } from '../src/client/sdk-title.ts'

describe('fnOS SDK carrier detection', () => {
  it('forces the web carrier only for FNOS application iframes', () => {
    expect(shouldForceWebCarrier('Mozilla/5.0 FNOS/1.2 FNAppVer/1.34.0', true)).toBe(true)
    expect(shouldForceWebCarrier('Mozilla/5.0 FNOS/1.2 FNAppVer/1.34.0', false)).toBe(false)
    expect(shouldForceWebCarrier('Mozilla/5.0 FNOS/1.2', true)).toBe(false)
  })

  it('updates the host title only inside an embedded fnOS web page', async () => {
    const titles: string[] = []
    let ready = false
    const dispose = installFnosPageTitle(() => ({
      isWeb: true,
      isStandaloneWeb: false,
      ready: async () => { ready = true },
      setTitle: async title => { titles.push(title) },
    }), { title: '当前会话 — DeepSeek Harness' })
    await Promise.resolve()
    expect(ready).toBe(true)
    expect(titles).toEqual(['当前会话 — DeepSeek Harness'])
    dispose()
  })

  it('does not call the NAS SDK in standalone browser mode', () => {
    let ready = false
    installFnosPageTitle(() => ({
      isWeb: true,
      isStandaloneWeb: true,
      ready: async () => { ready = true },
      setTitle: async () => undefined,
    }))
    expect(ready).toBe(false)
  })
})
