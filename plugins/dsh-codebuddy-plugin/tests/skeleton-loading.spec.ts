import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { createElement } from 'react'
import { readFileSync } from 'node:fs'

/**
 * 首次加载的骨架必须真的渲染出内容。
 *
 * 这组测试守的是一个真实事故：Semi 的 `Skeleton` 在 `loading` 为真时渲染的是
 * **`placeholder`**，不是 `children`：
 *
 * ```js
 * if (loading) content = <div className={skCls} {...others}>{placeholder}</div>
 * else content = children
 * ```
 *
 * 我起初把骨架写在 `children` 里，而 `loading` 默认 true，于是渲染出一个**空
 * div** —— 进入各管理菜单全是空白页。也不能靠 `loading={false}` 绕开：那样会
 * 直接返回 children、连承载 `.semi-skeleton-active` 的 wrapper 都没有，微光动画
 * 随之消失。唯一正确写法是内容放进 `placeholder`。
 *
 * 这里**真实渲染**组件（而非断言源码文本）——文本断言正是当初让缺陷溜过去的
 * 那类弱测试；渲染结果才能反映组件实际行为，其内部实现变化时也会立刻暴露。
 */
const require = createRequire(import.meta.url)
const SEMI_ENTRY = require.resolve('@douyinfe/semi-ui')
// pnpm 的 peer-suffix 会随 lockfile/安装上下文变化；从解析结果反推包根目录，
// 不要把某一次安装生成的 `.pnpm/...` 路径硬编码进测试。
const SEMI_ROOT = dirname(dirname(dirname(SEMI_ENTRY)))
const semiRequire = createRequire(`${SEMI_ROOT}/package.json`)
// react-dom 是本包的 peer（运行时由宿主提供），测试里从 semi-ui 的解析上下文取。
const { renderToStaticMarkup } = semiRequire('react-dom/server') as {
  renderToStaticMarkup: (element: unknown) => string
}
const Skeleton = ((await import(`${SEMI_ROOT}/lib/es/skeleton/index.js`)) as { default: unknown }).default

/** 渲染一个 Skeleton，返回 HTML。 */
function render(props: Record<string, unknown>): string {
  return renderToStaticMarkup(createElement(Skeleton as never, props as never))
}

describe('Skeleton 的 loading 分支语义', () => {
  it('placeholder 的内容会被渲染出来（正确写法）', () => {
    const html = render({ active: true, placeholder: createElement('div', { className: 'probe' }) })
    expect(html).toContain('probe')
  })

  it('写在 children 的内容在 loading 下会丢失（正是空白页的原因）', () => {
    const html = render({ active: true, children: createElement('div', { className: 'probe' }) })
    expect(html).not.toContain('probe')
    // 只剩一个空壳，界面因此空白。
    expect(html).toContain('semi-skeleton')
  })

  it('active 会带上 .semi-skeleton-active（微光动画依赖它）', () => {
    const html = render({ active: true, placeholder: createElement('div') })
    expect(html).toContain('semi-skeleton-active')
  })
})

describe('面板骨架的实现方式', () => {
  // 骨架实现已迁到 ui/loading-shared.tsx（AccountsSkeleton / TokensSkeleton
  // 由 `<DshSkeleton ... placeholder={(...) }>` 组成；占位内容各自与真实结构对齐）。
  const shared = readFileSync(
    '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/client/ui/loading-shared.tsx',
    'utf8',
  )

  it('两个骨架都把内容放进 placeholder，而不是 children', () => {
    // 必须以 `<DshSkeleton` 作为 JSX 元素的开始（import 行里的 `DshSkeleton,` 不算）；
    // 也排除 JSDoc 注释里的小写反引号引用（如 `\` <DshSkeleton active>\``）——
    // 真正的 JSX 元素紧跟其后是换行 + `active`（典型 props 在独立行），而注释里的
    // `active>` 后面是反引号 + 句子，没有「换行 + 多行 props」。
    const tags = shared.match(/<DshSkeleton\n\s+active\b[\s\S]*?\/>/g) ?? []
    expect(tags).toHaveLength(2)
    for (const tag of tags) {
      expect(tag).toContain('placeholder={(')
      expect(tag).toContain('active')
    }
  })
})
