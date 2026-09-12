import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 目录约定：与同仓库的兄弟插件（codex-auth / fnos）保持一致。
 *
 * ```
 * src/
 *   index.ts        host 入口
 *   host/           仅宿主侧模块
 *   contracts/      host 与 client 共享的协议常量
 *   client/         浏览器入口与面板
 *   types/          Host、Client 与共享类型声明（仅 .d.ts）
 *   components/     两个挂载点的 UI
 *   styles/
 * ```
 *
 * 这么分的依据是**可达性分析**而不是命名猜测：从 host 入口出发可达 15 个文件、
 * 从 client 入口出发可达 20 个，两者交集只有 `contracts/constants.ts`。
 * 因此共享面就是这一个模块，其余一律归 host。
 *
 * 这组用例守住三件事：① 分层不被重新打散；② client 侧不引用 host；
 * ③ 协议常量不在两端各定义一份（这是本项目真实踩过的坑）。
 */
const ROOT = '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src'

function filesUnder(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...filesUnder(full))
    else out.push(full)
  }
  return out
}

describe('src 目录分层', () => {
  it('存在 host / contracts / client / components / styles / types', () => {
    const top = readdirSync(ROOT).filter(n => statSync(join(ROOT, n)).isDirectory())
    for (const dir of ['host', 'contracts', 'client', 'components', 'styles', 'types']) {
      expect(top).toContain(dir)
    }
  })

  it('类型声明统一放在 types/，文件使用 .d.ts 后缀', () => {
    const declarations = filesUnder(join(ROOT, 'types'))
    expect(declarations.length).toBeGreaterThan(0)
    expect(declarations.every(file => file.endsWith('.d.ts'))).toBe(true)
  })

  it('client 下的状态管理集中在 store/（按模块拆 store 单元）', () => {
    // 状态管理不应散在 client 根或堆积在单文件里：token 统计缓存、用量偏好、
    // 账号代际各自成一个 store 单元。
    const storeDir = join(ROOT, 'client', 'store')
    expect(statSync(storeDir).isDirectory()).toBe(true)
    for (const unit of ['token-stats.ts', 'usage-prefs.ts', 'account-epoch.ts']) {
      expect(statSync(join(storeDir, unit)).isFile()).toBe(true)
    }
  })

  it('文案按语言拆分（locales/ 下 en 与 zh 各一个文件）', () => {
    // 文案不堆积在单文件：新增文案先写 en 再补 zh，两文件键集合由类型约束。
    const locDir = join(ROOT, 'client', 'locales')
    expect(statSync(join(locDir, 'en.ts')).isFile()).toBe(true)
    expect(statSync(join(locDir, 'zh.ts')).isFile()).toBe(true)
    expect(statSync(join(locDir, 'index.ts')).isFile()).toBe(true)
    // 旧的聚合单文件不应再存在
    expect(existsSync(join(ROOT, 'client', 'locales.ts'))).toBe(false)
  })

  it('样式按组件拆分（styles/ 下不再有聚合的 panel-layout 大文件）', () => {
    for (const f of ['panel-shell.scss', 'accounts.scss', 'add-account-modal.scss', 'usage-status.scss', 'token-panel.scss']) {
      expect(statSync(join(ROOT, 'styles', f)).isFile()).toBe(true)
    }
    expect(existsSync(join(ROOT, 'styles', 'panel-layout.scss'))).toBe(false)
  })

  it('src 根目录只保留入口文件', () => {
    // 16 个 host 模块曾平铺在根目录，与入口混在一起、边界靠命名猜。
    const stray = readdirSync(ROOT).filter(name => {
      const full = join(ROOT, name)
      if (statSync(full).isDirectory()) return false
      return true
    })
    expect(stray).toEqual(['index.ts'])
  })

  it('host 入口的全部本地引用都指向 host/、contracts/ 或类型声明', () => {
    // 用 toContain("from './host/") 太弱：只改其中一行仍会通过（实测漏网）。
    // 改为逐条检查 index.ts 的每一个相对 import。
    const src = readFileSync(join(ROOT, 'index.ts'), 'utf8')
    const localImports = [...src.matchAll(/from '(\.\/[^']+)'/g)].map(m => m[1]!)
    expect(localImports.length).toBeGreaterThan(10)
    const stray = localImports.filter(p => !p.startsWith('./host/') && !p.startsWith('./contracts/') && !p.startsWith('./types/'))
    expect(stray).toEqual([])
    expect(statSync(join(ROOT, 'client', 'index.tsx')).isFile()).toBe(true)
  })
})

describe('分层依赖方向', () => {
  const clientFiles = filesUnder(join(ROOT, 'client')).concat(filesUnder(join(ROOT, 'components')))

  it('client 侧不引用 host（否则浏览器产物会拖进宿主模块）', () => {
    const offenders: string[] = []
    for (const f of clientFiles) {
      const s = readFileSync(f, 'utf8')
      if (/from '[^']*\/host\/|from '[^']*\.\.\/host\//.test(s)) offenders.push(f.replace(ROOT, 'src'))
    }
    expect(offenders).toEqual([])
  })

  it('client 侧只从 contracts 取共享常量，不直接引 host 的 constants', () => {
    const offenders: string[] = []
    for (const f of clientFiles) {
      const s = readFileSync(f, 'utf8')
      if (/from '[^']*\.\.\/host\/constants\.ts'/.test(s)) offenders.push(f.replace(ROOT, 'src'))
    }
    expect(offenders).toEqual([])
  })
})

describe('协议常量只在 contracts 定义一次', () => {
  it('CODEBUDDY_AUTH_CHANNEL 全仓库只有一个定义', () => {
    // 它曾在 host/auth-service 与 client/constants 各定义一份，靠注释
    // 「mirror of the host constant」维持同步——改一处就静默对不上。
    const defs = filesUnder(ROOT)
      .filter(f => /export const CODEBUDDY_AUTH_CHANNEL\s*=/.test(readFileSync(f, 'utf8')))
      .map(f => f.replace(`${ROOT}/`, 'src/'))
    expect(defs).toEqual(['src/contracts/constants.ts'])
  })

  it('两端都从 contracts 引入该频道', () => {
    const host = readFileSync(join(ROOT, 'host', 'auth-service.ts'), 'utf8')
    expect(host).toMatch(/CODEBUDDY_AUTH_CHANNEL[\s\S]{0,200}from '\.\.\/contracts\/constants\.ts'/)
    const client = readFileSync(join(ROOT, 'client', 'panel.tsx'), 'utf8')
    expect(client).toContain("from '../contracts/constants.ts'")
  })
})
