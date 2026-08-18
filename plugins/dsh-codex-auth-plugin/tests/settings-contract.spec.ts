import { describe, expect, it } from 'vitest'
import { decodeCodexAuthSettings, DEFAULT_CODEX_AUTH_SETTINGS } from '../src/settings-contract.ts'

describe('dsh-codex-auth settings contract', () => {
  it('defaults image capabilities to disabled and keeps old settings readable', () => {
    expect(DEFAULT_CODEX_AUTH_SETTINGS).toEqual({ enableImageTool: false, enableImageUpload: false })
    expect(decodeCodexAuthSettings({ enableImageTool: true })).toEqual({ enableImageTool: true, enableImageUpload: false })
    expect(decodeCodexAuthSettings({ enableImageTool: true, enableImageUpload: true })).toEqual({ enableImageTool: true, enableImageUpload: true })
    expect(decodeCodexAuthSettings({ enableImageTool: 'true' })).toBeUndefined()
    expect(decodeCodexAuthSettings(undefined)).toBeUndefined()
  })
})
