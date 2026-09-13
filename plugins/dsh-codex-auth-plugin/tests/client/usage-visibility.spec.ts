import { describe, expect, it } from 'vitest'
import { CODEX_PROVIDER } from '../../src/contracts/provider.ts'
import { codexUsageVisible, readSelectedProvider } from '../../src/client/services/usage-visibility.ts'

/**
 * 图标显隐的真值表。
 *
 * 这组测试守的是「按供应商显隐」这条规则本身：两个插件都挂在
 * `conversation.input.right`，只按自己的登录态判断，于是选中 Codex 模型时
 * CodeBuddy 图标也显示、反之亦然。判断依据是会话投影 `modelSelection` 的
 * `provider`。
 *
 * 关键分支是「读不到就不显示」：投影还没送达、`next`/`lastUsed` 都为空、
 * 选中了第三家供应商，都必须返回 false。这里不按登录态或用量请求结果兜底。
 */
describe('Codex 用量图标按选中模型供应商显隐', () => {
  it('选中 Codex 模型时显示', () => {
    expect(codexUsageVisible({ next: { provider: CODEX_PROVIDER } })).toBe(true)
  })

  it('选中别家供应商（例如 CodeBuddy）时不显示', () => {
    expect(codexUsageVisible({ next: { provider: 'codebuddy' } })).toBe(false)
  })

  it('选中第三方供应商时不显示', () => {
    expect(codexUsageVisible({ next: { provider: 'anthropic' } })).toBe(false)
  })

  it('next 为空时回退到 lastUsed', () => {
    // 投影的 view 折叠是 `next = pending ?? lastUsed`，正常读 next 就够；
    // lastUsed 只是请求尚未提交时（pending 为空）的兜底。
    expect(codexUsageVisible({ next: null, lastUsed: { provider: CODEX_PROVIDER } })).toBe(true)
  })

  it('next 有值时不会被 lastUsed 覆盖', () => {
    expect(codexUsageVisible({ next: { provider: 'codebuddy' }, lastUsed: { provider: CODEX_PROVIDER } })).toBe(false)
  })

  it('投影整体缺失时不显示', () => {
    expect(codexUsageVisible(undefined)).toBe(false)
  })

  it('投影为空对象时不显示', () => {
    expect(codexUsageVisible({})).toBe(false)
    expect(codexUsageVisible({ next: null, lastUsed: null })).toBe(false)
  })

  it('provider 为空串或非字符串时不显示', () => {
    expect(codexUsageVisible({ next: { provider: '' } })).toBe(false)
    expect(codexUsageVisible({ next: { provider: null } })).toBe(false)
  })

  it('readSelectedProvider 原样透出供应商标识', () => {
    expect(readSelectedProvider({ next: { provider: 'anthropic' } })).toBe('anthropic')
    expect(readSelectedProvider(undefined)).toBeUndefined()
  })
})
