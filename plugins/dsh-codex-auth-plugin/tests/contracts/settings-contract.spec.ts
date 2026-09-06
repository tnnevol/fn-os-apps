import { describe, expect, it } from 'vitest'
import { decodeCodexAuthSettings, DEFAULT_CODEX_AUTH_SETTINGS } from '../../src/contracts/settings-contract.ts'

describe('dsh-codex-auth settings contract', () => {
  it('mirrors DSH image defaults and keeps older settings readable', () => {
    expect(DEFAULT_CODEX_AUTH_SETTINGS).toEqual({ enableImageTool: true, enableImageUpload: true })
    expect(decodeCodexAuthSettings({ enableImageTool: true })).toEqual({ enableImageTool: true, enableImageUpload: true })
    expect(decodeCodexAuthSettings({ enableImageTool: true, enableImageUpload: true })).toEqual({ enableImageTool: true, enableImageUpload: true })
    expect(decodeCodexAuthSettings({ enableImageTool: 'true' })).toBeUndefined()
    expect(decodeCodexAuthSettings(undefined)).toBeUndefined()
  })
})
