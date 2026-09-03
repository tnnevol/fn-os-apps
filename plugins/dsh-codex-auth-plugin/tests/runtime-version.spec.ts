import { APP_IDENTITY } from '@deepseek-ai/dsh-llm'
import { describe, expect, it } from 'vitest'
import { withDshVersion } from '../src/auth-routes.ts'
import { formatImageGenerationHelp } from '../src/client/image-capability-message.ts'
import { en, zh } from '../src/client/locales.ts'

describe('runtime DSH version in the Codex capability message', () => {
  it('adds the installed DSH version to the Host auth status response', () => {
    expect(withDshVersion({ status: 'signed-out' })).toEqual({
      status: 'signed-out',
      dshVersion: APP_IDENTITY.version,
    })
  })

  it('replaces the locale placeholder with the runtime version', () => {
    expect(formatImageGenerationHelp(key => zh[key], APP_IDENTITY.version))
      .toBe(`当前 Codex 提供方和 DSH ${APP_IDENTITY.version} 模型适配器暂不支持图像输出。`)
    expect(formatImageGenerationHelp(key => en[key], undefined))
      .toBe('Not supported by the Codex provider and DSH unknown model adapter.')
  })
})
