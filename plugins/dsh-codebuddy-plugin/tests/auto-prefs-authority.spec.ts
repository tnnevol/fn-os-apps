import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 自动开关配置的权威来源必须是 **Host**。
 *
 * 曾经是反的：设置页与管理面板在挂载时把 localStorage 的值推给 Host，于是
 * Host 上更新的值会被旧 localStorage 静默覆盖。实测复现：
 *
 *   Host = {enabled:false, thresholdPct:25}
 *   另一窗口的旧 localStorage 上推 → {enabled:true, thresholdPct:10}   ← 配置丢失
 *
 * 现在改为「读 Host → 写本地 store」，并有 hasStoredPrefs 区分老用户升级路径。
 */
const ROOT = '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src'
const SECTION = readFileSync(`${ROOT}/components/CodeBuddySection.tsx`, 'utf8')
const PANEL = readFileSync(`${ROOT}/client/panel.tsx`, 'utf8')
const SERVICE = readFileSync(`${ROOT}/host/auth-service.ts`, 'utf8')
const STORAGE = readFileSync(`${ROOT}/host/storage.ts`, 'utf8')

describe('Host 是自动配置的唯一权威', () => {
  it('Host 提供只读端点 autoPrefs', () => {
    // 原先 Host 对这几个偏好只写不读，客户端无从「以 Host 为准」。
    expect(SERVICE).toMatch(/case 'autoPrefs':/)
    expect(SERVICE).toMatch(/hasStoredPrefs: this\.prefsLoadedFromDisk/)
  })

  it('autoPrefs 暴露全部四项配置 + 迁移标志', () => {
    const block = SERVICE.slice(SERVICE.indexOf("case 'autoPrefs':"), SERVICE.indexOf("case 'autoSwitch':"))
    for (const field of ['autoSwitch', 'autoSwitchThresholdPct', 'autoCheckin', 'autoTravel', 'hasStoredPrefs']) {
      expect(block).toContain(field)
    }
  })

  it('设置页挂载时先读 Host；向 Host 推本地值只发生在「Host 尚无配置」之后', () => {
    const mount = SECTION.slice(SECTION.indexOf('挂载时加载一次状态'), SECTION.indexOf('// 轮询进行中的登录'))
    // 必须发起 autoPrefs 读取
    expect(mount).toContain("'autoPrefs'")
    // 迁移用的推写在语法上确实存在，但它必须在 adopt 分支的 early return **之后**。
    // 只断言「不存在该调用」是错的——那会把老用户升级路径一并禁掉（本节用例 4
    // 要求该分支存在）。真正的不变量是「顺序 + 守卫」。
    const adoptReturn = mount.indexOf('$autoTravel.set(host.autoTravel)')
    const migratePush = mount.indexOf("'autoSwitch', {")
    expect(adoptReturn).toBeGreaterThan(-1)
    expect(migratePush).toBeGreaterThan(adoptReturn)
    // 且推写处于 hasStoredPrefs 判定之后（即受 if 保护，不是无条件执行）
    const guard = mount.indexOf('if (host.hasStoredPrefs)')
    expect(guard).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(adoptReturn)
  })

  it('Host 已有配置时设置页采纳 Host 值；没有时才迁移本地值', () => {
    const mount = SECTION.slice(SECTION.indexOf('挂载时加载一次状态'), SECTION.indexOf('// 轮询进行中的登录'))
    expect(mount).toMatch(/if \(host\.hasStoredPrefs\) \{[\s\S]{0,400}\$autoSwitch\.set\(host\.autoSwitch\)/)
    // 迁移分支必须只出现在 hasStoredPrefs 为假之后
    const adoptAt = mount.indexOf('$autoSwitch.set(host.autoSwitch)')
    const migrateAt = mount.indexOf("'autoSwitch', {")
    expect(adoptAt).toBeGreaterThan(-1)
    expect(migrateAt).toBeGreaterThan(adoptAt)
  })

  it('管理面板同样读 Host，不再上推三个开关', () => {
    const block = PANEL.slice(PANEL.indexOf("'autoPrefs'"), PANEL.indexOf('subscribeUsagePref(() => {'))
    expect(PANEL).toContain("'autoPrefs'")
    expect(block).toMatch(/\$autoSwitch\.set\(host\.autoSwitch\)/)
    // 挂载路径里不得再把本地值推给 Host
    expect(block).not.toMatch(/'autoCheckin', \{ enabled: autoCheckinOn \}/)
  })

  it('storage 区分「读到磁盘配置」与「用了默认值」', () => {
    // 没有这个区分就无法判断该采纳 Host 还是该迁移 localStorage。
    expect(STORAGE).toMatch(/fromDisk: true/)
    expect(STORAGE).toMatch(/return \{ enabled: true, thresholdPct: 10, fromDisk: false \}/)
  })
})
