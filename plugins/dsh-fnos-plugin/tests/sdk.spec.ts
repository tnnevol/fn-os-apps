import { describe, expect, it } from 'vitest'
import { shouldForceWebCarrier } from '../src/client/sdk-carrier.ts'

describe('fnOS SDK carrier detection', () => {
  it('forces the web carrier only for FNOS application iframes', () => {
    expect(shouldForceWebCarrier('Mozilla/5.0 FNOS/1.2 FNAppVer/1.34.0', true)).toBe(true)
    expect(shouldForceWebCarrier('Mozilla/5.0 FNOS/1.2 FNAppVer/1.34.0', false)).toBe(false)
    expect(shouldForceWebCarrier('Mozilla/5.0 FNOS/1.2', true)).toBe(false)
  })
})
