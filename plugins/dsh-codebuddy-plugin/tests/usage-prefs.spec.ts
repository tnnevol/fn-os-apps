import { beforeEach, describe, expect, it } from 'vitest'
import {
  getTestStorage,
  setTestStorageKey,
  useTestStorageEngine,
} from '@nanostores/persistent'
import { $autoSwitch, $autoSwitchThreshold, $showUsage, USAGE_PREF_STORES } from '../src/client/store/usage-prefs.ts'

/**
 * 偏好持久化：**存储格式必须与迁移前完全一致**。
 *
 * 迁移前是手写 `localStorage`：布尔按 `'1'`/`'0'`，缺省（键不存在）为 `true`，
 * 阈值是十进制字符串、缺省 10。若换成库自带的 `persistentBoolean`，它会按
 * `'yes'`/`''` 编解码且缺省 `false` —— 用户已有设置会被**静默反转**。
 * 因此这里不测「库能工作」，而是测「既有数据仍被按原语义读出」。
 *
 * `@nanostores/persistent` 提供 `useTestStorageEngine()` 注入假 storage，
 * 让这些用例不必依赖真实浏览器环境。
 */
describe('布尔偏好的存储格式与缺省值', () => {
  beforeEach(() => { useTestStorageEngine() })

  it('键不存在时缺省为 true（与迁移前的 getItem(...) !== \'0\' 一致）', () => {
    expect($showUsage.get()).toBe(true)
    expect($autoSwitch.get()).toBe(true)
  })

  it('既有数据 \'1\' / \'0\' 仍被正确解读（迁移前写下的值）', () => {
    setTestStorageKey('dsh-codebuddy:show-usage', '1')
    setTestStorageKey('dsh-codebuddy-auto-switch', '0')
    // 直接断言解码语义：'1' → true、'0' → false。
    expect($showUsage.get()).toBe(true)
    expect($autoSwitch.get()).toBe(false)
  })

  it('写入时编码为 1 / 0（不回退成 yes/空串）', () => {
    $showUsage.set(false)
    expect(getTestStorage()['dsh-codebuddy:show-usage']).toBe('0')
    $showUsage.set(true)
    expect(getTestStorage()['dsh-codebuddy:show-usage']).toBe('1')
  })

  it('脏数据按「开启」处理，而不是抛错或变 false', () => {
    setTestStorageKey('dsh-codebuddy-auto-switch', 'garbage')
    // 迁移前是 `!== '0'`，任何非 '0' 都算开启——保持这一语义。
    expect($autoSwitch.get()).toBe(true)
  })
})

describe('阈值偏好的存储格式与边界', () => {
  beforeEach(() => { useTestStorageEngine() })

  it('缺省 10', () => {
    expect($autoSwitchThreshold.get()).toBe(10)
  })

  it('读回迁移前写下的十进制字符串', () => {
    setTestStorageKey('dsh-codebuddy-auto-switch:threshold', '35')
    expect($autoSwitchThreshold.get()).toBe(35)
  })

  it('写入为十进制字符串键名不变', () => {
    $autoSwitchThreshold.set(42)
    expect(getTestStorage()['dsh-codebuddy-auto-switch:threshold']).toBe('42')
  })

  it('越界或非法值回落到 10，不让脏数据影响切换逻辑', () => {
    setTestStorageKey('dsh-codebuddy-auto-switch:threshold', '999')
    expect($autoSwitchThreshold.get()).toBe(10)
    setTestStorageKey('dsh-codebuddy-auto-switch:threshold', 'abc')
    expect($autoSwitchThreshold.get()).toBe(10)
  })

  it('小数按四舍五入，且**内存与存储一致**（不留到刷新才生效）', async () => {
    const { setThreshold } = await import('../src/client/store/usage-prefs.ts')
    setThreshold(7.6)
    // persistentAtom 的 set 只把编码值写进 storage，atom 自身保留原始值，
    // 因此必须在写入前归一化，否则内存读到 7.6 而 storage 里是 "8"。
    expect($autoSwitchThreshold.get()).toBe(8)
    expect(getTestStorage()['dsh-codebuddy-auto-switch:threshold']).toBe('8')
  })

  it('越界写入也被夹紧（内存与存储同样一致）', async () => {
    const { setThreshold } = await import('../src/client/store/usage-prefs.ts')
    setThreshold(999)
    expect($autoSwitchThreshold.get()).toBe(10)
    expect(getTestStorage()['dsh-codebuddy-auto-switch:threshold']).toBe('10')
  })
})

describe('批量订阅', () => {
  beforeEach(() => { useTestStorageEngine() })

  it('订阅时**不**立即触发（否则同步 host 会多发请求）', async () => {
    // nanostores 的 atom.subscribe 会立即回调一次；这里有 5 个 store，
    // 用 subscribe 会造成订阅瞬间 5 次回调 = 5 次多余 RPC。实现里用的是 listen。
    const { subscribeUsagePref } = await import('../src/client/store/usage-prefs.ts')
    let calls = 0
    const dispose = subscribeUsagePref(() => { calls += 1 })
    expect(calls).toBe(0)
    dispose()
  })

  it('任一偏好变化都会触发一次回调', async () => {
    const { subscribeUsagePref } = await import('../src/client/store/usage-prefs.ts')
    let calls = 0
    const dispose = subscribeUsagePref(() => { calls += 1 })
    $showUsage.set(false)
    expect(calls).toBe(1)
    $autoSwitch.set(false)
    expect(calls).toBe(2)
    dispose()
  })

  it('取消订阅后不再回调', async () => {
    const { subscribeUsagePref } = await import('../src/client/store/usage-prefs.ts')
    let calls = 0
    const dispose = subscribeUsagePref(() => { calls += 1 })
    dispose()
    $showUsage.set(false)
    expect(calls).toBe(0)
  })

  it('受管 store 覆盖全部五个偏好', () => {
    // 漏一个就会让该偏好的变化无法触发 host 同步。
    expect(USAGE_PREF_STORES).toHaveLength(5)
  })
})
