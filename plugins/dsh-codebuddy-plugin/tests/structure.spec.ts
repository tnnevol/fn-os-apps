import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
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
  it('存在 host / contracts / client / components / styles', () => {
    const top = readdirSync(ROOT).filter(n => statSync(join(ROOT, n)).isDirectory())
    for (const dir of ['host', 'contracts', 'client', 'components', 'styles']) {
      expect(top).toContain(dir)
    }
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

  it('host 入口的全部本地引用都指向 host/ 或 contracts/', () => {
    // 用 toContain("from './host/") 太弱：只改其中一行仍会通过（实测漏网）。
    // 改为逐条检查 index.ts 的每一个相对 import。
    const src = readFileSync(join(ROOT, 'index.ts'), 'utf8')
    const localImports = [...src.matchAll(/from '(\.\/[^']+)'/g)].map(m => m[1]!)
    expect(localImports.length).toBeGreaterThan(10)
    const stray = localImports.filter(p => !p.startsWith('./host/') && !p.startsWith('./contracts/'))
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
