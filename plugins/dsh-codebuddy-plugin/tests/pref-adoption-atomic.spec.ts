import { describe, expect, it } from 'vitest'

/**
 * 从 Host 采纳偏好必须是**原子**的，中途不得回推。
 *
 * 真实缺陷：`$autoSwitch` / `$autoCheckin` / `$autoTravel` / 阈值都是**持久化到
 * localStorage 的共享 atom**，且都被 `subscribeUsagePref` 监听；那个监听器的职责
 * 是「本地改动 → 推给 Host」。而「从 Host 采纳」是逐个 `set` 的，`set` 会**同步**
 * 触发监听器，监听器读的是「当前全部偏好」——第一个 `set` 触发时其余尚未采纳，
 * 于是它们的**本地旧值**被推回 Host，把刚从 Host 读到的值覆盖掉。
 *
 * 这把「Host 为准」反转成了「本地为准」，正是本模块注释里声明已经修过一次的
 * 那个问题的另一个入口。
 *
 * 这些用例直接驱动真实的 store 模块（它不依赖 React），因此验证的是行为而不是
 * 源码里出现了某个函数名。
 */

/** 每个用例用独立键，避免持久化 atom 之间互相污染。 */
let seq = 0
function keys(): Record<string, string> {
  seq += 1
  return {
    sw: `test-adopt-${seq}-sw`,
    ck: `test-adopt-${seq}-ck`,
    tv: `test-adopt-${seq}-tv`,
  }
}

describe('从 Host 采纳偏好是原子的', () => {
  it('采纳期间 isAdoptingPrefs() 为真，结束后复位', async () => {
    const { whileAdoptingPrefs, isAdoptingPrefs } = await import('../src/client/store/usage-prefs.ts')
    expect(isAdoptingPrefs()).toBe(false)
    whileAdoptingPrefs(() => { expect(isAdoptingPrefs()).toBe(true) })
    expect(isAdoptingPrefs()).toBe(false)
  })

  it('apply 抛错也复位（否则会永久静音回推，本地改动再也同步不到 Host）', async () => {
    const { whileAdoptingPrefs, isAdoptingPrefs } = await import('../src/client/store/usage-prefs.ts')
    expect(() => whileAdoptingPrefs(() => { throw new Error('boom') })).toThrow('boom')
    expect(isAdoptingPrefs()).toBe(false)
  })

  it('嵌套采纳：内层结束不提前复位（设置页与面板 hook 可能同时挂载）', async () => {
    const { whileAdoptingPrefs, isAdoptingPrefs } = await import('../src/client/store/usage-prefs.ts')
    whileAdoptingPrefs(() => {
      whileAdoptingPrefs(() => {
        expect(isAdoptingPrefs()).toBe(true)
      })
      // 内层退出后仍应处于采纳中——用布尔实现会在这里错误地变 false。
      expect(isAdoptingPrefs()).toBe(true)
    })
    expect(isAdoptingPrefs()).toBe(false)
  })

  it('采纳期间 store 变化不触发回推（旧实现会把尚未采纳的旧值推给 Host）', async () => {
    const k = keys()
    const { persistentAtom } = await import('@nanostores/persistent')
    const { whileAdoptingPrefs, isAdoptingPrefs } = await import('../src/client/store/usage-prefs.ts')

    // 本地旧值：a=false, b=true
    const boolOpts = { encode: (v: boolean): string => (v ? '1' : '0'), decode: (r: string): boolean => r !== '0' }
    const a = persistentAtom(k.sw!, false, boolOpts)
    const b = persistentAtom(k.ck!, true, boolOpts)
    // 模拟 useAutoPrefs 的回推：任一变化 → 推「当前全部」
    const pushed: Array<{ a: boolean, b: boolean }> = []
    const push = (): void => {
      if (isAdoptingPrefs()) return       // 被修复的这一行
      pushed.push({ a: a.get(), b: b.get() })
    }
    const d1 = a.listen(push)
    const d2 = b.listen(push)

    // Host 权威值：a=true, b=false
    whileAdoptingPrefs(() => {
      a.set(true)
      b.set(false)
    })
    // 采纳阶段一个包都不该推出去。
    expect(pushed).toEqual([])
    // 且本地最终确实采纳了 Host 的值。
    expect(a.get()).toBe(true)
    expect(b.get()).toBe(false)

    // 采纳结束后，真实的本地改动仍然要能推给 Host。
    b.set(true)
    expect(pushed).toEqual([{ a: true, b: true }])
    d1(); d2()
  })

  it('对照：不加抑制时会推出「混合状态」，即被修复的缺陷', async () => {
    const k = keys()
    const { persistentAtom } = await import('@nanostores/persistent')
    const boolOpts = { encode: (v: boolean): string => (v ? '1' : '0'), decode: (r: string): boolean => r !== '0' }
    const a = persistentAtom(k.sw!, false, boolOpts)
    const b = persistentAtom(k.ck!, true, boolOpts)
    const pushed: Array<{ a: boolean, b: boolean }> = []
    const d1 = a.listen(() => { pushed.push({ a: a.get(), b: b.get() }) })
    const d2 = b.listen(() => { pushed.push({ a: a.get(), b: b.get() }) })

    // 不包 whileAdoptingPrefs —— 复现缺陷。
    a.set(true)
    b.set(false)
    // 第一次回调推的是 {a:true, b:true}：b 还是本地旧值，与 Host 的 false 相反。
    expect(pushed[0]).toEqual({ a: true, b: true })
    expect(pushed).toContainEqual({ a: true, b: true })
    d1(); d2()
  })
})

/**
 * `adoptHostPrefs`：Host 偏好的**唯一**采纳入口。
 *
 * 抽出来的原因就是它被写了两份并悄悄漂移：设置页采纳 4 项（三个开关 + 阈值），
 * 面板 hook 只采纳 3 个开关。这类「同一件事写两遍」的分歧无法靠测试守住，只能
 * 靠收敛实现；因此这里直接对收敛后的函数做覆盖，两端的行为由它一处决定。
 */
describe('adoptHostPrefs 采纳全部四项', () => {
  /** 四个受管 store 的键，取自真实模块（它们读的是固定 localStorage 键）。 */
  async function stores() {
    const m = await import('../src/client/store/usage-prefs.ts')
    return {
      $autoSwitch: m.$autoSwitch,
      $autoCheckin: m.$autoCheckin,
      $autoTravel: m.$autoTravel,
      $autoSwitchThreshold: m.$autoSwitchThreshold,
      adoptHostPrefs: m.adoptHostPrefs,
      isAdoptingPrefs: m.isAdoptingPrefs,
    }
  }

  it('四项（含阈值）都被写成 Host 的值', async () => {
    const s = await stores()
    s.adoptHostPrefs({
      autoSwitch: false,
      autoSwitchThresholdPct: 42,
      autoCheckin: false,
      autoTravel: false,
    })
    expect(s.$autoSwitch.get()).toBe(false)
    // 阈值是最容易被漏掉的一项——面板 hook 曾漏它。
    expect(s.$autoSwitchThreshold.get()).toBe(42)
    expect(s.$autoCheckin.get()).toBe(false)
    expect(s.$autoTravel.get()).toBe(false)
  })

  it('反向值也生效（排除「只写 true」这类实现错误）', async () => {
    const s = await stores()
    s.adoptHostPrefs({ autoSwitch: true, autoSwitchThresholdPct: 7, autoCheckin: true, autoTravel: true })
    expect(s.$autoSwitch.get()).toBe(true)
    expect(s.$autoSwitchThreshold.get()).toBe(7)
    expect(s.$autoCheckin.get()).toBe(true)
    expect(s.$autoTravel.get()).toBe(true)
  })

  it('采纳期间处于抑制状态（外层观察不到中间态）', async () => {
    const s = await stores()
    // 用订阅者观察：采纳过程中不应有「已退出抑制」的窗口。
    const observed: boolean[] = []
    const unsub = s.$autoCheckin.listen(() => { observed.push(s.isAdoptingPrefs()) })
    s.adoptHostPrefs({ autoSwitch: true, autoSwitchThresholdPct: 11, autoCheckin: false, autoTravel: true })
    unsub()
    // 若有任何一次回调发生在抑制之外，就会把中间态推给 Host。
    expect(observed.every(v => v === true)).toBe(true)
  })

  it('阈值越界时回落到默认 10（不是夹到 100，两端策略不同）', async () => {
    const s = await stores()
    /**
     * 这里如实记录一个**策略差异**，它当前无害但值得知道：
     *   host 写入端：`Math.max(0, Math.min(100, Math.round(x)))` —— 夹取；
     *   本地解码端：`normalizeThreshold` —— 越界一律**回落 10**。
     *
     * 为什么现在无害：host 自己已夹到 [0,100]，永远不会下发越界值，因此这条回落
     * 分支只对**脏 localStorage**（用户手改、旧版本残留）生效，属防御性兜底。
     *
     * 为什么仍要写下来：若日后 host 去掉夹取，本地会把 999 静默变成 10 而不是
     * 100——一个只在异常输入下出现的静默分歧，是这类问题里最难排查的形态。
     */
    s.adoptHostPrefs({ autoSwitch: true, autoSwitchThresholdPct: 999, autoCheckin: true, autoTravel: true })
    expect(s.$autoSwitchThreshold.get()).toBe(10)
  })

  it('阈值边界值 [0,100] 按原值采纳（不误判为越界）', async () => {
    const s = await stores()
    s.adoptHostPrefs({ autoSwitch: true, autoSwitchThresholdPct: 0, autoCheckin: true, autoTravel: true })
    expect(s.$autoSwitchThreshold.get()).toBe(0)
    s.adoptHostPrefs({ autoSwitch: true, autoSwitchThresholdPct: 100, autoCheckin: true, autoTravel: true })
    expect(s.$autoSwitchThreshold.get()).toBe(100)
  })
})
