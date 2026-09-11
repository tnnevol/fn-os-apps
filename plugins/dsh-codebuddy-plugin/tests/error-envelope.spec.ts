import { describe, expect, it } from 'vitest'
import { wireErrorMessage, wireErrorDetail } from '../src/host/types.ts'
import { httpErrorCode } from '../src/host/adapter.ts'

/**
 * CodeBuddy 的错误信封与 OpenAI 不同，实测两种形态（均不兼容 `error.message`）：
 *
 *   ① 扁平：{"code":6004,"msg":"您的使用量已超出频率限制，将在 … 重置，您也可以切换其他模型继续使用。"}
 *   ② 嵌套：{"error":{"data":{"code":14017,"msg":"体验版尚未激活。…"}}}
 *
 * 只读 `error.message` 会丢掉服务端原文，用户只看到兜底的
 * `CodeBuddy API error (HTTP 429)` —— 而原文里写着何时重置、可换哪个模型。
 */
const FLAT = {
  code: 6004,
  msg: '您的使用量已超出频率限制，将在 2026-09-11 19:24:44 UTC+8 重置，您也可以切换其他模型继续使用。',
  requestId: '0f0bddda-b97a-4956-8cbe-871f9ea7ec9',
}
const NESTED = {
  error: { data: { code: 14017, msg: '体验版尚未激活。请退出当前账号后重新登录，即可立即激活并开始免费体验。', requestId: 'b8b020dc' } },
}
const OPENAI = { error: { message: 'rate limited', type: 'rate_limit', code: '429' } }

describe('wireErrorMessage：三种形态都能取到原文', () => {
  it('扁平形态（顶层 msg）', () => {
    expect(wireErrorMessage(FLAT)).toContain('您的使用量已超出频率限制')
    expect(wireErrorMessage(FLAT)).toContain('19:24:44')
  })

  it('嵌套形态（error.data.msg）', () => {
    expect(wireErrorMessage(NESTED)).toContain('体验版尚未激活')
  })

  it('OpenAI 兼容形态（error.message）', () => {
    expect(wireErrorMessage(OPENAI)).toBe('rate limited')
  })

  it('优先级：OpenAI message 优先于 CodeBuddy 字段', () => {
    const both = { error: { message: 'openai', data: { msg: 'codebuddy' } }, msg: 'flat' }
    expect(wireErrorMessage(both)).toBe('openai')
  })

  it('空串/空白不算有效文案（回退到调用方的兜底）', () => {
    expect(wireErrorMessage({ msg: '' })).toBeUndefined()
    expect(wireErrorMessage({ msg: '   ' })).toBeUndefined()
    expect(wireErrorMessage({})).toBeUndefined()
    expect(wireErrorMessage(undefined)).toBeUndefined()
  })
})

describe('wireErrorDetail：分类文本带上业务码', () => {
  it('含业务 code 与文案（DSH 的英文正则匹配不上中文，code 是补充依据）', () => {
    const detail = wireErrorDetail(FLAT)
    expect(detail).toContain('6004')
    expect(detail).toContain('您的使用量已超出频率限制')
  })

  it('嵌套形态的 code 也能取到', () => {
    expect(wireErrorDetail(NESTED)).toContain('14017')
  })

  it('空体返回空串（不是 "undefined" 字样）', () => {
    expect(wireErrorDetail(undefined)).toBe('')
    expect(wireErrorDetail({})).toBe('')
  })
})

describe('httpErrorCode 的分类', () => {
  it('401/403 → AUTH（不看文案）', () => {
    expect(httpErrorCode(401, FLAT)).toBe('AUTH')
    expect(httpErrorCode(403, undefined)).toBe('AUTH')
  })

  it('429 + 业务码 6004 → QUOTA（账号×模型额度耗尽，需换账号）', () => {
    /**
     * 实测 6004 = 账号 × 模型的额度用尽（同一账号换模型即 200、别的账号同模型也
     * 200）。必须归 QUOTA 才能触发**换账号**；归 RATE_LIMIT 只会让外层原地重试
     * 同一账号同一模型——在重置之前不可能成功。
     */
    expect(httpErrorCode(429, FLAT)).toBe('QUOTA')
  })

  it('429 但无业务码 → RATE_LIMIT（保守：不确定是否换号有效）', () => {
    expect(httpErrorCode(429, { msg: 'too many requests' })).toBe('RATE_LIMIT')
    expect(httpErrorCode(429, undefined)).toBe('RATE_LIMIT')
  })

  it('嵌套形态里的 6004 同样识别', () => {
    expect(httpErrorCode(429, { error: { data: { code: 6004, msg: '超额' } } })).toBe('QUOTA')
  })

  it('400 + 上下文超限文案 → CONTEXT_WINDOW_EXCEEDED', () => {
    expect(httpErrorCode(400, { error: { message: 'context window exceeded' } }))
      .toBe('CONTEXT_WINDOW_EXCEEDED')
  })

  it('400 其它 → INVALID_REQUEST', () => {
    expect(httpErrorCode(400, { msg: '参数不合法' })).toBe('INVALID_REQUEST')
  })

  it('5xx → SERVER', () => {
    expect(httpErrorCode(503, undefined)).toBe('SERVER')
  })

  it('英文的额度耗尽文案能被 DSH 正则识别为 QUOTA', () => {
    expect(httpErrorCode(400, { error: { message: 'insufficient quota' } }))
      .toBe('QUOTA')
  })
})
