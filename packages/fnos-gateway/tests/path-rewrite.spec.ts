import { describe, expect, it } from 'vitest'
import { addGatewayPrefix, normalizePrefix, rewriteLocation, rewritePath } from '../src/middleware/path-rewrite.ts'

describe('gateway path rewriting', () => {
  it('FNOS-002-TP-032-TC-001: normalizes the public gateway prefix once', () => {
    expect(normalizePrefix('///app/fn-deepseek-harness///')).toBe('/app/fn-deepseek-harness')
    expect(normalizePrefix('/')).toBe('')
    expect(normalizePrefix('')).toBe('')
  })

  it('FNOS-002-TP-032-TC-001: strips only the configured prefix and preserves query parameters', () => {
    expect(rewritePath('/app/fn-deepseek-harness/api/status?rev=1', '/app/fn-deepseek-harness'))
      .toBe('/api/status?rev=1')
    expect(rewritePath('/app/fn-deepseek-harness', '/app/fn-deepseek-harness')).toBe('/')
    expect(rewritePath('/app/fn-deepseek-harness-other/file', '/app/fn-deepseek-harness'))
      .toBe('/app/fn-deepseek-harness-other/file')
  })

  it('FNOS-002-TP-032-TC-002: prefixes root-relative resources without double-prefixing them', () => {
    const prefix = '/app/fn-deepseek-harness'
    expect(addGatewayPrefix('/dsh-pet-7340/pic/cursor-grab.png', prefix))
      .toBe('/app/fn-deepseek-harness/dsh-pet-7340/pic/cursor-grab.png')
    expect(addGatewayPrefix('/app/fn-deepseek-harness/dsh-pet-7340/pic/cursor-grab.png', prefix))
      .toBe('/app/fn-deepseek-harness/dsh-pet-7340/pic/cursor-grab.png')
    expect(addGatewayPrefix('//cdn.example.com/pet.png', prefix)).toBe('//cdn.example.com/pet.png')
  })

  it('FNOS-002-TP-032-TC-001: rewrites same-origin Location headers while preserving external URLs', () => {
    expect(rewriteLocation('/login?next=/app', '/app/fn-deepseek-harness'))
      .toBe('/app/fn-deepseek-harness/login?next=/app')
    expect(rewriteLocation('https://example.com/login', '/app/fn-deepseek-harness'))
      .toBe('https://example.com/login')
  })
})
