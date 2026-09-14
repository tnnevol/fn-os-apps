import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

/**
 * 授权码复制能力由 Semi Typography 的 `copyable` 承载，不由插件自己实现。
 *
 * 背景：早期实现是在 `signIn()` 里先 `window.open()` 弹窗、`await` 拿到授权码后
 * **自动**复制。浏览器把用户的 transient activation 与焦点给了新窗口，此后
 * `navigator.clipboard.writeText` 会一直挂起、`document.execCommand('copy')`
 * 返回 false——所以「复制失败」是必现，不是偶发竞态，加延迟或 `window.focus()`
 * 都救不回来。
 *
 * 因此这里守住两件事，它们都不能被顺手改回去：
 * 1. 授权码用 `DshTypography.Text` 的 `copyable` 渲染，复制发生在**用户点击**时，
 *    那一刻主文档仍有焦点；
 * 2. `signIn()` 里不再有自动复制调用。
 */
const SECTION = new URL('../../src/components/CodexAuthSection.tsx', import.meta.url)

describe('Codex 授权码的复制接线', () => {
  it('用 Typography copyable 承载复制，而不是手写按钮', async () => {
    const source = await readFile(SECTION, 'utf8')
    expect(source).toContain('copyable={{')
    expect(source).toContain('content: challenge.userCode')
    // 复制结果回传给插件，用于展示失败提示。
    expect(source).toContain('setCopyFailed(!result)')
  })

  it('授权码文本不再自带复制按钮，也不再有独立的复制回调', async () => {
    const source = await readFile(SECTION, 'utf8')
    // 旧的 `copyAuthorizationCode()` 函数与 `copyStatus` 状态机已删除。
    // 注意 `copyAuthorizationCode` 仍是 locale key（用于 copyTip），只断言函数定义消失。
    expect(source).not.toContain('const copyAuthorizationCode')
    expect(source).not.toContain('copyStatus')
    expect(source).not.toContain("from '../client/services/copy-to-clipboard.ts'")
  })

  it('登录流程不在开窗之后自动复制', async () => {
    const source = await readFile(SECTION, 'utf8')
    const signInAt = source.indexOf('const signIn = async')
    expect(signInAt).toBeGreaterThan(-1)
    // 取 signIn 函数体：到下一个顶层 `const signOut` 为止。
    const signOutAt = source.indexOf('const signOut = async')
    expect(signOutAt).toBeGreaterThan(signInAt)
    const signInBody = source.slice(signInAt, signOutAt)

    // 弹窗打开后主文档失去焦点，此时的任何复制调用都必然失败。
    expect(signInBody).toContain("popup.location.replace(next.verificationUri)")
    expect(signInBody).not.toContain('copyTextToClipboard')
    expect(signInBody).not.toContain('copyAuthorizationCode')
    expect(signInBody).not.toContain('execCommand')
  })

  it('插件不实现自己的剪贴板逻辑，复制完全交给 Semi 的 copyable', async () => {
    const source = await readFile(SECTION, 'utf8')
    // 主动复制这条路已被证伪（见文件头注释），不再自行调剪贴板 API；
    // 唯一入口是用户点击 copyable 渲染出的图标。
    expect(source).not.toContain('navigator.clipboard')
    expect(source).not.toContain('execCommand')
    expect(source).not.toContain("services/copy-to-clipboard")
  })
})
