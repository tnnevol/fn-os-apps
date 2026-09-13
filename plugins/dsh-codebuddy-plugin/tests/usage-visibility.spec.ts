import { describe, expect, it } from 'vitest'
import { CODEBUDDY_PROVIDER } from '../src/contracts/constants.ts'
import { codebuddyUsageVisible, readSelectedProvider } from '../src/client/usage-visibility.ts'

/**
 * CodeBuddy 用量图标的显隐真值表。
 *
 * 与 Codex 插件共用同一条「按选中模型供应商显隐」的规则，差别在于本插件还有
 * 用户偏好 `showUsage`（「显示额度余量」），它是**更前置**的开关：供应商条件
 * 加在它之上，两者取与。用户关掉偏好后即使选中 CodeBuddy 模型也不显示。
 *
 * 「读不到就不显示」同样适用于这里：投影没送达、两侧为空、选中第三家供应商
 * 都返回 false。
 */
describe('CodeBuddy 用量图标按选中模型供应商显隐', () => {
  it('偏好开启且选中 CodeBuddy 模型时显示', () => {
    expect(codebuddyUsageVisible({ next: { provider: CODEBUDDY_PROVIDER } }, true)).toBe(true)
  })

  it('偏好关闭时即使选中 CodeBuddy 模型也不显示', () => {
    // showUsage 是总闸，压过供应商匹配。
    expect(codebuddyUsageVisible({ next: { provider: CODEBUDDY_PROVIDER } }, false)).toBe(false)
  })

  it('选中别家供应商（例如 Codex）时不显示', () => {
    expect(codebuddyUsageVisible({ next: { provider: 'openai-codex' } }, true)).toBe(false)
  })

  it('选中第三方供应商时不显示', () => {
    expect(codebuddyUsageVisible({ next: { provider: 'anthropic' } }, true)).toBe(false)
  })

  it('next 为空时回退到 lastUsed', () => {
    expect(codebuddyUsageVisible({ next: null, lastUsed: { provider: CODEBUDDY_PROVIDER } }, true)).toBe(true)
  })

  it('next 有值时不会被 lastUsed 覆盖', () => {
    expect(codebuddyUsageVisible({ next: { provider: 'openai-codex' }, lastUsed: { provider: CODEBUDDY_PROVIDER } }, true)).toBe(false)
  })

  it('投影整体缺失时不显示', () => {
    expect(codebuddyUsageVisible(undefined, true)).toBe(false)
  })

  it('投影为空对象时不显示', () => {
    expect(codebuddyUsageVisible({}, true)).toBe(false)
    expect(codebuddyUsageVisible({ next: null, lastUsed: null }, true)).toBe(false)
  })

  it('provider 为空串或非字符串时不显示', () => {
    expect(codebuddyUsageVisible({ next: { provider: '' } }, true)).toBe(false)
    expect(codebuddyUsageVisible({ next: { provider: null } }, true)).toBe(false)
  })

  it('readSelectedProvider 原样透出供应商标识', () => {
    expect(readSelectedProvider({ next: { provider: 'anthropic' } })).toBe('anthropic')
    expect(readSelectedProvider(undefined)).toBeUndefined()
  })
})
