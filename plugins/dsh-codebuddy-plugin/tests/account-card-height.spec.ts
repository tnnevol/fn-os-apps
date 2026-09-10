import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 账号卡片必须**等高**——拉取不到账户数据时也不能塌下去。
 *
 * 缺陷现象：`creditOk === false`（积分查询失败）与 `row.expired`（已离线）这两个
 * 分支在正文里只渲染**一行文字**，而正常卡片渲染的是
 * 「额度大字 26px + 进度条 + 两行资源包（预留 min-height 42px）」约 92px 的正文。
 * 于是同一栅格行里，失败卡片明显更矮，底部参差、布局错乱。
 *
 * 两层原因，都要修：
 * 1. 栅格会 stretch 子项（`.dsh-codebuddy-account-card-wrap`），但内部 Card 只设了
 *    `width: 100%`，仍是内容高度，不会填满被拉伸的格子 —— 需要把
 *    `height: 100%` 沿 wrap → Card → .semi-card-body 传下去。
 * 2. 正文极少时仍需占位，否则即便被拉伸，文字也挤在顶部显得空荡。
 *
 * 关于 `.semi-card-body` 是 `.semi-card` 直接子元素的前提（已读源码确认）：
 * - `Card.render()` 返回 `div.cardCls`，其子节点是 renderHeader/Cover/Body/Footer；
 * - `Card.defaultProps.loading = false`，而 Skeleton 在 loading 为假时**直接返回
 *   children**、不额外包一层 div，所以卡片内容确实是 `.semi-card-body` 的直接子元素。
 */
const PANEL = readFileSync(
  '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/client/panel.tsx',
  'utf8',
)
const SCSS = readFileSync(
  '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/styles/panel-layout.scss',
  'utf8',
)

describe('两个「拉取不到数据」的分支都走等高状态块', () => {
  it('积分查询失败用状态块，而不是裸的一行文字', () => {
    expect(PANEL).toMatch(/!row\.creditOk[\s\S]{0,200}dsh-codebuddy-account-body-state/)
  })

  it('已离线也用状态块', () => {
    expect(PANEL).toMatch(/dsh-codebuddy-account-body-state dsh-codebuddy-account-expired-pad/)
  })

  it('状态块给最小高度（否则文字挤在顶部、卡片显得空）', () => {
    expect(SCSS).toMatch(/\.dsh-codebuddy-account-body-state\s*\{[^}]*min-height:\s*96px/)
  })

  it('状态块用 min-height 而非固定 height（内容变多时仍可增高）', () => {
    const block = /\.dsh-codebuddy-account-card-wrap \.dsh-codebuddy-account-body-state\s*\{([^}]*)\}/.exec(SCSS)?.[1] ?? ''
    expect(block).not.toMatch(/(^|[^-])height:\s*\d/)
  })
})

describe('高度链把栅格行高传到 Card 内部', () => {
  it('栅格子项 wrap 设 height: 100%', () => {
    const block = /\.dsh-codebuddy-account-card-wrap\s*\{([^}]*)\}/.exec(SCSS)?.[1] ?? ''
    expect(block).toMatch(/height:\s*100%/)
  })

  it('Card 填满 wrap', () => {
    expect(SCSS).toMatch(/\.dsh-codebuddy-account-card-wrap > \.dsh-codebuddy-panel-card\s*\{[^}]*height:\s*100%/)
  })

  it('Card 正文容器改为纵向 flex 并撑满', () => {
    expect(SCSS).toMatch(
      /\.dsh-codebuddy-account-card-wrap > \.dsh-codebuddy-panel-card > \.semi-card-body\s*\{[^}]*height:\s*100%[^}]*flex-direction:\s*column/,
    )
  })

  it('正文吸收剩余高度（flex: 1 1 auto）', () => {
    expect(SCSS).toMatch(
      /\.dsh-codebuddy-account-card-wrap \.dsh-codebuddy-account-card-body,[\s\S]{0,120}dsh-codebuddy-account-expired-pad\s*\{[^}]*flex:\s*1 1 auto/,
    )
  })
})

describe('改动不外溢到其它卡片网格', () => {
  it('新增规则一律限定在 .dsh-codebuddy-account-card-wrap 下', () => {
    // .dsh-codebuddy-panel-cards 是三处共用的容器类（账号页 / 骨架 / 积分统计），
    // 直接给 .dsh-codebuddy-panel-card 加 height:100% 会波及其它页面。
    for (const sel of ['dsh-codebuddy-panel-card', 'semi-card-body', 'dsh-codebuddy-account-body-state']) {
      const offenders = [...SCSS.matchAll(new RegExp(`^([^{}\\n]*${sel}[^{}\\n]*)\\{`, 'gm'))]
        .map(m => m[1]!.trim())
        .filter(s => !s.includes('dsh-codebuddy-account-card-wrap'))
        .filter(s => /height:\s*100%|min-height:\s*96px|flex-direction:\s*column/.test(
          SCSS.slice(SCSS.indexOf(s) + s.length, SCSS.indexOf(s) + s.length + 220),
        ))
      expect(offenders).toEqual([])
    }
  })
})
