import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { startLoginPolling } from '../src/client/login-polling.ts'

/**
 * 「添加 CodeBuddy 账号」弹框的登录反馈闭环。
 *
 * 本轮改动的三条需求：
 *  1/2. 去除复制登录链接按钮——auth 链接由 host 向官方接口握手后签发（含服务端
 *       一次性 state），客户端无法在提交前算出它，做不到「一直可用且随客户端/
 *       环境变化」。
 *  3.   主按钮在整个登录期间持续 loading，登录落定后用通知提示结果，成功时
 *       主动关闭弹框。
 *
 * 这里既做**真实行为测试**（`startLoginPolling` 是导出函数，可直接驱动），
 * 也对无法在 node 环境渲染的 JSX 接线做文本扫描——两类分开标注。
 */

const ROOT = '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src'
const MODAL = readFileSync(`${ROOT}/components/AddAccountModal.tsx`, 'utf8')
const PANEL = readFileSync(`${ROOT}/client/panel.tsx`, 'utf8')
const SECTION = readFileSync(`${ROOT}/components/CodeBuddySection.tsx`, 'utf8')
const ZH = readFileSync(`${ROOT}/client/locales/zh.ts`, 'utf8')
const EN = readFileSync(`${ROOT}/client/locales/en.ts`, 'utf8')

/** 组件函数体（到 startLoginPolling 定义之前），避免误命中轮询实现。 */
const COMPONENT = MODAL.slice(
  MODAL.indexOf('export function AddAccountModal'),
  MODAL.indexOf('export function startLoginPolling'),
)

describe('轮询驱动的登录落定（真实行为）', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  /** 让 `window.setTimeout` 立即同步执行，把轮询循环压成可断言的直线。 */
  function stubImmediateTimers(): void {
    vi.stubGlobal('window', {
      setTimeout: (fn: () => void) => { void Promise.resolve().then(fn); return 0 },
    })
  }

  it('done=true → 只回调 onDone，不误报超时或失败', async () => {
    stubImmediateTimers()
    const rpc = { call: vi.fn().mockResolvedValue({ ok: true, value: { done: true } }) }
    const onDone = vi.fn()
    const onTimeout = vi.fn()
    const onFailed = vi.fn()

    startLoginPolling(rpc as never, 's1', onDone, onTimeout, onFailed)
    await vi.waitFor(() => { expect(onDone).toHaveBeenCalledTimes(1) })

    // 反向：成功路径不得触发另外两个结局。
    expect(onTimeout).not.toHaveBeenCalled()
    expect(onFailed).not.toHaveBeenCalled()
    // 已落定就不再继续轮询。
    expect(rpc.call).toHaveBeenCalledTimes(1)
  })

  it('host 返回 error → 走 onFailed 并带上原因，不等到超时', async () => {
    stubImmediateTimers()
    const rpc = { call: vi.fn().mockResolvedValue({ ok: true, value: { done: false, error: '凭据被拒' } }) }
    const onDone = vi.fn()
    const onTimeout = vi.fn()
    const onFailed = vi.fn()

    startLoginPolling(rpc as never, 's2', onDone, onTimeout, onFailed)
    await vi.waitFor(() => { expect(onFailed).toHaveBeenCalledWith('凭据被拒') })

    expect(onDone).not.toHaveBeenCalled()
    expect(onTimeout).not.toHaveBeenCalled()
  })

  it('未提供 onFailed 时，host 的 error 回落到 onTimeout（不静默丢弃）', async () => {
    stubImmediateTimers()
    const rpc = { call: vi.fn().mockResolvedValue({ ok: true, value: { done: false, error: '坏了' } }) }
    const onDone = vi.fn()
    const onTimeout = vi.fn()

    startLoginPolling(rpc as never, 's3', onDone, onTimeout)
    await vi.waitFor(() => { expect(onTimeout).toHaveBeenCalledTimes(1) })

    expect(onDone).not.toHaveBeenCalled()
  })

  it('返回的 disposer 能中止轮询：卸载后不再回调、不再发请求', async () => {
    // 若不守住这条，关掉弹框后轮询仍在跑，会对已放弃的登录反复打 pollLogin，
    // 并可能在组件卸载后调用 setState。
    const pending: Array<() => void> = []
    vi.stubGlobal('window', { setTimeout: (fn: () => void) => { pending.push(fn); return 0 } })
    const rpc = { call: vi.fn().mockResolvedValue({ ok: true, value: { done: false } }) }
    const onDone = vi.fn()

    const stop = startLoginPolling(rpc as never, 's4', onDone, vi.fn(), vi.fn())
    await vi.waitFor(() => { expect(pending.length).toBeGreaterThan(0) })
    const callsBefore = rpc.call.mock.calls.length

    stop()
    // 手动放行已排队的下一跳：stopped 之后它必须直接返回。
    for (const fn of pending.splice(0)) fn()
    await Promise.resolve()

    expect(rpc.call).toHaveBeenCalledTimes(callsBefore)
    expect(onDone).not.toHaveBeenCalled()
  })

  it('每次轮询都带 state（否则 host 无法定位是哪次握手）', async () => {
    stubImmediateTimers()
    const rpc = { call: vi.fn().mockResolvedValue({ ok: true, value: { done: true } }) }

    startLoginPolling(rpc as never, 'state-xyz', vi.fn(), vi.fn(), vi.fn())
    await vi.waitFor(() => { expect(rpc.call).toHaveBeenCalled() })

    const [, endpoint, payload] = rpc.call.mock.calls[0] as [string, string, { state: string }]
    expect(endpoint).toBe('pollLogin')
    expect(payload).toEqual({ state: 'state-xyz' })
  })
})

describe('复制登录链接按钮已去除（需求 1/2）', () => {
  it('弹框不再引用 Copyable 与复制相关文案', () => {
    // 链接由 host 握手签发，提交前不存在；「一直可用且随客户端/环境更新」
    // 无法成立，因此整块功能移除，而不是留一个时好时坏的按钮。
    expect(COMPONENT).not.toContain('DshCopyable')
    expect(COMPONENT).not.toContain('copyLoginLink')
    expect(COMPONENT).not.toContain('DshIconCopy')
  })

  it('两处宿主界面也不再有复制登录链接的入口', () => {
    expect(PANEL).not.toContain('copyLoginLink')
    expect(PANEL).not.toContain('onCopyLoginLink')
    expect(SECTION).not.toContain('copyLoginLink')
    expect(SECTION).not.toContain('cbCopyLoginLink')
  })

  it('弹框不再自己开浏览器窗口（仍由宿主的 onLoginStart 负责）', () => {
    // 保持单一职责：谁掌握页面上下文谁开窗，弹框只管发起与反馈。
    expect(COMPONENT).not.toContain('window.open')
    expect(COMPONENT).toContain('onLoginStart?.(')
  })
})

describe('两个宿主都必须真的打开登录页', () => {
  /**
   * 这是一条真实缺陷的回归守卫。
   *
   * 把轮询收归弹框时，`CodeBuddySection` 的 `onAddLoginStart` 被连同参数一起
   * 简化成了 `() => { setAddWaiting(true) }`——`window.open` 丢了。后果是设置页
   * 点「添加账号」后**登录页根本不出现**，而按钮会一直 loading 到十分钟超时，
   * 用户看不出任何原因。
   *
   * 为什么既有的检查全都抓不到它：
   *  - tsc 不报错，因为回调声明的入参可以比 prop 类型少（函数逆变是合法的）；
   *  - `--noUnusedParameters` 也不报，因为参数是**整个省略**而不是留着不用；
   *  - 该文件里还有另一处 `window.open`（属于「重新登录」流程），所以按文件
   *    整体 grep `window.open` 依然命中。
   *
   * 因此这里必须**按回调各自的函数体**断言，而不是按整个文件。
   */

  /** 截取 `onAddLoginStart` 的函数体（到紧随其后的 onAddFinished 为止）。 */
  function addLoginStartBody(src: string): string {
    const from = src.indexOf('const onAddLoginStart = useCallback(')
    expect(from).toBeGreaterThan(-1)
    const to = src.indexOf('const onAddFinished', from)
    expect(to).toBeGreaterThan(from)
    return src.slice(from, to)
  }

  it('设置区块的 onAddLoginStart 打开 authUrl', () => {
    const body = addLoginStartBody(SECTION)
    expect(body).toContain('window.open(start.authUrl')
  })

  it('后台面板的 onAddLoginStart 打开 authUrl', () => {
    const body = addLoginStartBody(PANEL)
    expect(body).toContain('window.open(start.authUrl')
  })

  it('两处都接收 start 参数（省略参数就拿不到 authUrl）', () => {
    for (const src of [SECTION, PANEL]) {
      expect(addLoginStartBody(src)).toMatch(/useCallback\(\(start: \{ authUrl: string, state: string \}\)/)
    }
  })

  it('设置区块的「重新登录」也仍然开窗（另一条独立流程）', () => {
    const from = SECTION.indexOf('const startRelogin')
    expect(from).toBeGreaterThan(-1)
    expect(SECTION.slice(from)).toContain('window.open(result.value.authUrl')
  })
})

describe('登录期间按钮持续 loading（需求 3）', () => {
  it('loading 覆盖「握手在途」与「等待授权」两个阶段', () => {
    // 只看握手会让按钮在用户还没授权时就恢复可点，进而起第二个握手。
    expect(COMPONENT).toMatch(/const waiting = handshaking \|\| pendingState !== undefined/)
    expect(COMPONENT).toMatch(/loading=\{waiting\}/)
  })

  it('同时显式 disabled：Semi 的 loading 不会自动禁用按钮', () => {
    // 实测 DshButton 的 loading 只渲染 spinner，不阻止点击。
    expect(COMPONENT).toMatch(/disabled=\{waiting\}/)
  })

  it('等待授权期间按钮文案切到「登录中」', () => {
    expect(COMPONENT).toMatch(/pendingState === undefined \? submitLabel \?\? t\('createUserGo'\) : t\('signingIn'\)/)
  })

  it('重复提交被挡在函数入口（不依赖 disabled 生效时机）', () => {
    expect(COMPONENT).toMatch(/const submit = async[\s\S]{0,80}if \(waiting\) return/)
  })
})

describe('落定后的通知与关框（需求 3）', () => {
  it('成功：提示 loginSucceeded 且主动关闭弹框', () => {
    expect(COMPONENT).toMatch(/DshToast\.success\(\{ content: t\('loginSucceeded'\) \}\)/)
    expect(COMPONENT).toMatch(/if \(shouldClose\(\)\) onCancelRef\.current\(\)/)
  })

  it('超时与失败都有通知（不静默）', () => {
    expect(COMPONENT).toMatch(/DshToast\.warning\(\{ content: t\('timeout'\) \}\)/)
    expect(COMPONENT).toMatch(/DshToast\.error\(\{ content: `\$\{t\('loginFailed'\)\} \$\{reason\}` \}\)/)
  })

  it('失败/超时**不**关框，字段保留以便重试', () => {
    // 关框会把备注、客户端、环境全部丢掉，重试等于重新填一遍。
    const settleBlock = COMPONENT.slice(
      COMPONENT.indexOf('return startLoginPolling('),
      COMPONENT.indexOf('const footer ='),
    )
    expect(settleBlock.length).toBeGreaterThan(0)
    // 只有 success 分支调用关闭；另两个分支只 shouldClose() 复位标记。
    const closes = settleBlock.match(/onCancelRef\.current\(\)/g) ?? []
    expect(closes).toHaveLength(1)
  })

  it('握手本身失败：提示原因并关框（此时没有可等待的登录）', () => {
    expect(COMPONENT).toMatch(/DshToast\.error\([\s\S]{0,90}describeRpcError\(result\)[\s\S]{0,120}close\(\)/)
  })

  it('新增的成功文案在两种语言里都有', () => {
    expect(ZH).toContain('loginSucceeded:')
    expect(EN).toContain('loginSucceeded:')
  })
})

describe('轮询归属单一，避免双重轮询', () => {
  it('弹框自己轮询它发起的登录', () => {
    expect(COMPONENT).toContain('return startLoginPolling(')
  })

  it('后台面板不再重复轮询同一个 state', () => {
    // 两处同时轮询会对 pollLogin 发双份请求，并各自判定落定 → 提示出现两次。
    expect(PANEL).not.toContain('startLoginPolling')
  })

  it('设置区块保留自己的轮询，但只服务「重新登录」', () => {
    // startRelogin 是该区块独有的流程，其 state 不经过弹框。
    expect(SECTION).toContain('startLoginPolling')
    expect(SECTION).toContain('const startRelogin')
    // 弹框发起的登录不再喂进该区块的 loginState。
    expect(SECTION).not.toMatch(/onAddLoginStart[\s\S]{0,200}setLoginState/)
  })

  it('宿主通过 onFinished 感知结果并刷新名册', () => {
    expect(PANEL).toMatch(/onFinished=\{onAddFinished\}/)
    expect(SECTION).toMatch(/onFinished=\{onAddFinished\}/)
    expect(PANEL).toMatch(/if \(ok\) bumpRoster\(\)/)
    expect(SECTION).toMatch(/if \(ok\) void refresh\(\)/)
  })
})

describe('onFinished 在每个结局都会触发', () => {
  /**
   * 这是一条真实缺陷的回归守卫。
   *
   * 改动过程中 `onFinished` 一度只在**握手失败**分支被调用，成功/超时/失败三个
   * 结局全漏了。两个宿主都用它把「登录中」标记落回 false 并刷新名册，于是：
   *  - 登录成功后名册不刷新，新账号不出现；
   *  - `addWaiting` / `loginWaiting` 永远停在 true，添加按钮永久禁用。
   *
   * tsc 与「接线是否存在」的断言都抓不到它——前者只看类型，后者只看宿主那侧传了
   * prop。所以这里断言的是**回调真的在每个分支被调用**。
   */
  const settleBlock = COMPONENT.slice(
    COMPONENT.indexOf('const settle = '),
    COMPONENT.indexOf('const footer ='),
  )

  it('settle 一处收口，把结果回报宿主', () => {
    expect(settleBlock.length).toBeGreaterThan(0)
    expect(settleBlock).toMatch(/onFinishedRef\.current\?\.\(ok, text\)/)
  })

  it('成功/超时/失败三个结局各自带正确的 ok 值', () => {
    expect(settleBlock).toMatch(/settle\(true\)/)
    expect(settleBlock).toMatch(/settle\(false, t\('timeout'\)\)/)
    expect(settleBlock).toMatch(/settle\(false, reason\)/)
  })

  it('恰好三个结局各调用一次 settle（没有漏掉的分支）', () => {
    // 定义写作 `const settle = (ok, text) =>`，不带 `settle(`，因此这里数到的
    // 全是调用点：成功 / 超时 / 失败。少于 3 就是有分支忘了回报宿主。
    const calls = settleBlock.match(/settle\(/g) ?? []
    expect(calls).toHaveLength(3)
  })

  it('握手失败也回报（此时没有轮询，必须单独调用）', () => {
    expect(COMPONENT).toMatch(/onFinished\?\.\(false, describeRpcError\(result\)\)/)
  })

  it('onFinished 收进 ref，避免它变化就重启轮询', () => {
    expect(COMPONENT).toMatch(/onFinishedRef\.current = onFinished/)
  })
})

describe('轮询 effect 的依赖是干净的', () => {
  it('不用 eslint-disable 屏蔽依赖检查', () => {
    // 关闭回调收进 ref，effect 依赖表如实只列数据依赖。
    expect(MODAL).not.toContain('eslint-disable')
    expect(COMPONENT).toMatch(/onCancelRef\.current = onCancel/)
    expect(COMPONENT).toMatch(/\}, \[pendingState, rpc, t\]\)/)
  })

  it('重开弹框无需再清 state（关框时已收尾）', () => {
    // 在途标记由 close() 清除，因此打开分支只重置表单字段。若这里也去清，
    // 等于把同一件事写两遍，日后改动容易只改一处。
    const reset = COMPONENT.slice(COMPONENT.indexOf('if (open !== lastOpen)'), COMPONENT.indexOf('const close ='))
    expect(reset).not.toContain('setPendingState')
  })
})

describe('添加账号不抢占当前账号', () => {
  /**
   * host 的 `activate` 默认为 `true`，不传就会让新账号成为当前账号：用户只是想
   * 多存一个备用账号，正在用的账号却被静默换掉，后续请求全部改走新账号。
   *
   * 这里只锁「弹框确实请求了不切换」。规则本身的正确性由 storage.spec.ts 的
   * `nextActiveId` 逐情形钉住——两处合起来才构成完整保护：规则对但没传参，
   * 或者传了参但规则反了，都会让需求失效。
   */
  const optionsBlock = COMPONENT.slice(
    COMPONENT.indexOf('const options = {'),
    COMPONENT.indexOf('rpc.call<LoginStart>'),
  )

  it('startLogin 显式传 activate: false', () => {
    expect(optionsBlock.length).toBeGreaterThan(0)
    expect(optionsBlock).toMatch(/activate: false/)
  })

  it('options 块确实作为 startLogin 的入参（而不是算了没用）', () => {
    expect(COMPONENT).toMatch(/rpc\.call<LoginStart>\(CODEBUDDY_AUTH_CHANNEL, 'startLogin', options\)/)
  })

  it('activate 在 options 块内，不会因可选字段展开而被漏掉', () => {
    // 若被塞进某个条件展开里，默认场景下就不会生效。
    expect(optionsBlock).toMatch(/^\s*activate: false,\s*$/m)
  })
})

describe('关闭弹框即结束本次登录等待', () => {
  /**
   * 关框必须同时收掉三样东西，否则会留下用户看不见却仍在动的状态：
   *  1. 客户端轮询（否则关框后仍在打 pollLogin，且可能对已卸载的组件 setState）；
   *  2. 弹框主按钮的 loading（否则重开弹框时按钮仍在转，且点不下去）；
   *  3. 宿主的「登录中」标记（否则宿主的「添加账号」按钮永久禁用）。
   *
   * 三者都挂在同一个开关上：清掉 `pendingState`。它既是轮询 effect 的依赖
   * （变化即触发 cleanup → disposer），也是 `waiting` 的组成部分。
   */
  const closeBody = COMPONENT.slice(
    COMPONENT.indexOf('const close = ()'),
    COMPONENT.indexOf('const submit ='),
  )

  it('close() 清掉在途 state：连带停轮询与停 loading', () => {
    expect(closeBody.length).toBeGreaterThan(0)
    expect(closeBody).toContain('setPendingState(undefined)')
  })

  it('close() 回报宿主，让它把「登录中」标记落回', () => {
    expect(closeBody).toMatch(/onFinished\?\.\(false\)/)
  })

  it('仅在确有在途登录时才回报（没提交就取消不算一次失败登录）', () => {
    // 无条件回报会让宿主误以为发生过一次失败的登录。
    expect(closeBody).toMatch(/if \(pendingState !== undefined\)[\s\S]{0,120}onFinished\?\.\(false\)/)
  })

  it('close() 复位关框标记，避免旧登录落定时又关一次新开的弹框', () => {
    expect(closeBody).toContain('closeOnDone.current = false')
  })

  it('三个关闭入口都走 close()：footer 取消、右上角 X、ESC', () => {
    // 遮罩点击已禁用（maskClosable={false}），否则误触会中断登录等待。
    expect(COMPONENT).toContain('onClick={close}')
    expect(COMPONENT).toMatch(/onCancel=\{close\}/)
    expect(COMPONENT).toContain('closeOnEsc')
    expect(COMPONENT).toContain('maskClosable={false}')
  })

  it('成功关框不走 close()，避免重复回报宿主', () => {
    // 成功分支的 settle(true) 已经清了 state 并回报过一次；再走 close() 会让
    // 宿主先收到 ok=true 再收到 ok=false，把刚成功的登录记成失败。
    const doneBranch = COMPONENT.slice(
      COMPONENT.indexOf('return startLoginPolling('),
      COMPONENT.indexOf('DshToast.warning'),
    )
    expect(doneBranch).toContain('onCancelRef.current()')
    expect(doneBranch).not.toMatch(/\bclose\(\)/)
  })
})

describe('轮询 disposer 与 pendingState 的联动', () => {
  it('effect 依赖含 pendingState，清掉它即触发 cleanup', () => {
    // 这是「关框停轮询」的实现机理：依赖变化 → React 调 cleanup → disposer。
    expect(COMPONENT).toMatch(/\}, \[pendingState, rpc, t\]\)/)
  })

  it('effect 返回 startLoginPolling 的 disposer（而不是丢掉它）', () => {
    expect(COMPONENT).toMatch(/return startLoginPolling\(/)
  })

  it('state 为空时 effect 直接返回，不起轮询', () => {
    expect(COMPONENT).toMatch(/if \(state === undefined\) return/)
  })
})

/**
 * 点「打开登录」后**整表单禁用**，三种情形解除。
 *
 * 需求：点击后所有字段禁用；重新打开弹框、登录成功、授权轮询超时（或失败）后解除。
 *
 * 四种情形都归结到同一个开关 `waiting = handshaking || pendingState !== undefined`：
 * 进入禁用是握手开始（`handshaking`），解除是它或 `pendingState` 被清干净。
 * 这里既断言接线（每个控件都吃了 `disabled={waiting}`），也断言**四项的因果**。
 */
describe('登录在途时整表单禁用', () => {
  /** 表单区域的源码（只含控件渲染，不含 footer 与弹框外壳）。 */
  const FORM = COMPONENT.slice(
    COMPONENT.indexOf('<div className="dsh-codebuddy-add-form">'),
    COMPONENT.indexOf('</DshModal>'),
  )

  it('表单里的每个控件都受 waiting 控制', () => {
    // 逐个统计，避免「只给前几个加了 disabled」这种漏改。
    const total = (FORM.match(/<(DshInput|DshSelect|DshSwitch)\b/g) ?? []).length
    const guarded = (FORM.match(/disabled=\{waiting\}/g) ?? []).length
    expect(total).toBe(5)          // 备注名 / 客户端 / 环境 / 端点 / 企业
    expect(guarded).toBe(total)
  })

  it('禁用标志覆盖握手中与等待授权两个阶段', () => {
    // 只覆盖其中一个阶段会出现「握手返回后可改字段」或反之的中间态。
    expect(COMPONENT).toMatch(/const waiting = handshaking \|\| pendingState !== undefined/)
  })

  it('点击「打开登录」即进入禁用（setHandshaking(true) 在 await 之前）', () => {
    const submit = COMPONENT.slice(COMPONENT.indexOf('const submit ='), COMPONENT.indexOf('const state = pendingState'))
    const setAt = submit.indexOf('setHandshaking(true)')
    const awaitAt = submit.indexOf('await rpc.call<LoginStart>')
    expect(setAt).toBeGreaterThan(-1)
    expect(awaitAt).toBeGreaterThan(setAt)
  })
})

describe('禁用状态在三种情形下解除', () => {
  it('登录成功：settle(true) 清 pendingState（waiting 随之变 false）', () => {
    const settle = COMPONENT.slice(COMPONENT.indexOf('const settle ='), COMPONENT.indexOf('const footer ='))
    expect(settle).toContain('setPendingState(undefined)')
    // 成功分支走 settle(true)
    expect(COMPONENT).toMatch(/settle\(true\)/)
  })

  it('授权轮询超时：走 settle(false, ...) 同样清 pendingState', () => {
    expect(COMPONENT).toMatch(/settle\(false, t\('timeout'\)\)/)
  })

  it('授权失败：走 settle(false, reason) 同样清 pendingState', () => {
    expect(COMPONENT).toMatch(/settle\(false, reason\)/)
  })

  it('重新打开弹框：close() 清 handshaking 与 pendingState', () => {
    /**
     * 这条防的是一处真实漏洞：`close()` 原先把 `setPendingState` 放在
     * `if (pendingState !== undefined)` 里，而**握手在途时 `pendingState` 还是
     * undefined**（它要等握手返回才被 set）。于是「点『打开登录』后立刻关框」
     * 什么都不清，`handshaking` 停在 true，重开弹框后 `waiting` 仍为 true——表单
     * 依旧禁用、主按钮一直转，直到那次握手返回。与需求「重新打开即解除」不符。
     */
    const close = COMPONENT.slice(COMPONENT.indexOf('const close = ()'), COMPONENT.indexOf('const submit ='))
    // handshaking 必须在 if 之外无条件清掉。
    const guardAt = close.indexOf('if (pendingState !== undefined)')
    const clearHandshakeAt = close.indexOf('setHandshaking(false)')
    expect(clearHandshakeAt).toBeGreaterThan(-1)
    expect(clearHandshakeAt).toBeLessThan(guardAt)
  })
})

/**
 * 握手在途时关框：这次握手必须彻底作废。
 *
 * `startLogin` 的 RPC 在途时用户关掉弹框（或关掉又重开），它返回后原本会继续走
 * `submit()` 的后半段，产生两个恶果：
 *   1. 把 `handshaking` 又置回 true —— 重开弹框后表单仍禁用、主按钮一直转；
 *   2. `setPendingState` + `onLoginStart` —— 替一次**已被取消**的登录弹开浏览器
 *      登录页。
 * 因此用「代」作废：`close()` 推进代，`submit` 在 await 后比对，不一致即丢弃。
 */
describe('握手在途时关框会作废该次握手', () => {
  it('close() 推进代（作废在途握手）', () => {
    const close = COMPONENT.slice(COMPONENT.indexOf('const close = ()'), COMPONENT.indexOf('const submit ='))
    expect(close).toMatch(/generationRef\.current \+= 1/)
  })

  it('submit 在发起时记录代，并在 await 之后比对', () => {
    const submit = COMPONENT.slice(COMPONENT.indexOf('const submit ='), COMPONENT.indexOf('const state = pendingState'))
    const issuedAt = submit.indexOf('const issuedIn = generationRef.current')
    const awaitAt = submit.indexOf('await rpc.call<LoginStart>')
    const staleAt = submit.indexOf('if (stale()) return')
    expect(issuedAt).toBeGreaterThan(-1)
    expect(awaitAt).toBeGreaterThan(issuedAt)
    // 作废判定必须在 await 之后——否则等于没判。
    expect(staleAt).toBeGreaterThan(awaitAt)
  })

  it('代在推进时必须早于清 state（handshaking 也要一起清）', () => {
    const close = COMPONENT.slice(COMPONENT.indexOf('const close = ()'), COMPONENT.indexOf('const submit ='))
    expect(close.indexOf('generationRef.current += 1')).toBeLessThan(close.indexOf('setHandshaking(false)'))
  })

  it('作废时不得回报 onFinished（宿主从未置起「登录中」）', () => {
    // 宿主的标记由 onLoginStart 置起；这次握手被作废时它从未置起，回报会让宿主
    // 误以为发生过一次失败的登录。
    const submit = COMPONENT.slice(COMPONENT.indexOf('await rpc.call<LoginStart>'), COMPONENT.indexOf('const state = pendingState'))
    const staleBranch = submit.slice(submit.indexOf('if (stale()) return'), submit.indexOf('if (stale()) return') + 40)
    expect(staleBranch).toMatch(/if \(stale\(\)\) return/)
    expect(staleBranch).not.toContain('onFinished')
  })

  it('作废时不得开窗（不替已取消的登录打开登录页）', () => {
    const submit = COMPONENT.slice(COMPONENT.indexOf('await rpc.call<LoginStart>'), COMPONENT.indexOf('const state = pendingState'))
    const staleAt = submit.indexOf('if (stale()) return')
    // onLoginStart 只能出现在 stale 判定**之后**的路径上。
    expect(submit.indexOf('onLoginStart?.(')).toBeGreaterThan(staleAt)
  })
})
