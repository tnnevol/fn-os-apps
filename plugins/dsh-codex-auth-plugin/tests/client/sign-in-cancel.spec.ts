import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

/**
 * 授权等待期间的「放弃」路径。
 *
 * 用户在等待 Codex 授权时有两种退出方式：点「取消」，或者直接关掉授权窗口。
 * 两者都必须让界面停止等待，但**不能**走退出登录——那会删掉已经登录的账号。
 * 这类行为靠组件状态机串起来，纯函数测不到，因此盯源码结构。
 */
const SECTION = new URL('../../src/components/CodexAuthSection.tsx', import.meta.url)
const PATHS = new URL('../../src/contracts/auth-paths.ts', import.meta.url)
const ROUTES = new URL('../../src/host/auth-routes.ts', import.meta.url)

describe('Codex 授权取消接线', () => {
  it('取消走独立的 cancel 端点，而不是 logout', async () => {
    const source = await readFile(SECTION, 'utf8')
    const paths = await readFile(PATHS, 'utf8')
    expect(paths).toContain("CODEX_AUTH_CANCEL_PATH = '/plugins/dsh-codex-auth-plugin/auth/cancel'")
    expect(source).toContain('CODEX_AUTH_CANCEL_PATH')
    // cancelSignIn 里不能出现 logout 端点。
    const start = source.indexOf('const cancelSignIn = useCallback')
    const end = source.indexOf('const signIn = async', start)
    expect(start).toBeGreaterThan(-1)
    const body = source.slice(start, end)
    expect(body).not.toContain('CODEX_AUTH_LOGOUT_PATH')
  })

  it('等待授权时渲染取消按钮，登录按钮文案是「登录」', async () => {
    const source = await readFile(SECTION, 'utf8')
    const locales = await readFile(new URL('../../src/client/locales.ts', import.meta.url), 'utf8')
    expect(source).toContain("status.status === 'signing-in'")
    expect(source).toContain("t('cancelSignIn')")
    // 文案按需求从「去登录」改为「登录」。
    expect(locales).toContain("signIn: '登录'")
    expect(locales).not.toContain("signIn: '去登录'")
  })

  it('轮询授权窗口的 closed，关掉即取消本次登录', async () => {
    const source = await readFile(SECTION, 'utf8')
    expect(source).toContain('authWindowsRef')
    expect(source).toContain('.closed')
    // 只在等待授权期间判定，避免把用户其它窗口算进来。
    const effectStart = source.indexOf('授权窗口被关掉即视为放弃')
    expect(effectStart).toBeGreaterThan(-1)
    const body = source.slice(effectStart, source.indexOf('const signIn = async', effectStart))
    expect(body).toContain("status.status !== 'signing-in'")
    // 关窗场景带提示；用户主动点「取消」则不带。
    expect(body).toContain("void cancelSignIn('authorizationWindowClosed')")
    // 全部窗口都关掉才算放弃：用户可能另开了一个冗余授权窗口。
    expect(body).toContain('.every(authWindow => authWindow.closed)')
  })

  it('取消时关掉仍开着的授权窗口', async () => {
    const source = await readFile(SECTION, 'utf8')
    const start = source.indexOf('const cancelSignIn = useCallback')
    const end = source.indexOf('授权窗口被关掉即视为放弃', start)
    expect(start).toBeGreaterThan(-1)
    const body = source.slice(start, end)
    // 先取快照再清空集合，避免遍历时被改动影响。
    expect(body).toContain('const authWindows = [...authWindowsRef.current]')
    expect(body).toContain('authWindowsRef.current = new Set()')
    // 已关闭的窗口跳过 close（对它调用无意义）。
    expect(body).toContain('if (!authWindow.closed) authWindow.close()')
  })

  it('跟踪全部授权窗口，重复开窗不会留下关不掉的孤儿', async () => {
    const source = await readFile(SECTION, 'utf8')
    // 单个引用会被第二次开窗覆盖，导致先前的窗口在取消时关不掉。
    expect(source).not.toContain('authWindowRef')
    // 两处开窗（signIn 与「打开授权页面」）都登记进集合。
    const adds = source.match(/authWindowsRef\.current\.add\(/gu) ?? []
    expect(adds.length).toBe(2)
  })

  it('授权窗口保留 opener，否则跨域后无法被脚本关闭', async () => {
    const raw = await readFile(SECTION, 'utf8')
    // 只看代码，不看注释：注释里会讲到这两个被禁用的写法本身。
    const source = raw
      .replace(/\/\*[\s\S]*?\*\//gu, '')
      .replace(/(^|[^:])\/\/.*$/gmu, '$1')
    // `opener = null` 会让窗口在跨域导航后失去 script-closable 资格，
    // `close()` 静默失效。两处开窗都不能切断 opener。
    expect(source).not.toContain('.opener = null')
    expect(source).not.toContain('noopener')
  })

  it('宿主侧 cancel() 不清凭据，只有 signOut() 清', async () => {
    const routes = await readFile(ROUTES, 'utf8')
    const cancelStart = routes.indexOf('async cancel(): Promise<void>')
    const disposeStart = routes.indexOf('async dispose()', cancelStart)
    expect(cancelStart).toBeGreaterThan(-1)
    const cancelBody = routes.slice(cancelStart, disposeStart)
    expect(cancelBody).not.toContain('logoutCodex')
    // 取消导致的 abort 不应被当作错误暴露给界面。
    expect(cancelBody).toContain('this.cancelled = true')
  })
})
