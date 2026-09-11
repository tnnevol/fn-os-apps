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
    // 窗口不能太窄：曾用 200，加了 tooltip 包裹层后距离变成 321 就误报。
    // 要断言的是「该分支用了状态块」这一不变量，与包裹层数无关。
    expect(PANEL).toMatch(/!row\.creditOk[\s\S]{0,400}dsh-codebuddy-account-body-state/)
  })

  it('查询失败时可看到失败原因（与「额度为 0」区分）', () => {
    // 失败：状态块 + 原因 tooltip；额度 0：正常卡片显示 0 —— 两者是不同状态。
    expect(PANEL).toMatch(/DshTooltip content=\{row\.probeError\}/)
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

describe('账号卡片的套餐行只展示名称与到期日', () => {
  const PANEL = readFileSync(
    '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/client/panel.tsx',
    'utf8',
  )
  const INDEX_SCSS = readFileSync(
    '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/styles/index.scss',
    'utf8',
  )
  /** 卡片内的套餐行（概览，最多两行）。 */
  const cardRow = (): string => {
    const start = PANEL.indexOf('dsh-codebuddy-account-card-resources')
    return PANEL.slice(start, PANEL.indexOf('</div>', PANEL.indexOf('credit-resource-meta', start)))
  }

  it('不再出现「剩余 / 总值」', () => {
    // 同一账号的额度合计已在上方大字给出；逐个套餐的用量留给详情弹框
    // （那里有进度条做比例表达）。
    expect(cardRow()).not.toMatch(/formatCredit\(r\.remaining\)/)
    expect(cardRow()).not.toMatch(/formatCredit\(r\.total\)/)
    expect(cardRow()).not.toContain('∞')
  })

  it('保留套餐名与到期日（只到日）', () => {
    expect(cardRow()).toContain('{r.name}')
    expect(cardRow()).toContain('formatResetDate(r.resetsAt)')
  })

  it('无到期日的套餐显示「长期有效」而不是空白', () => {
    expect(cardRow()).toMatch(/r\.resetsAt === null \? longTerm : formatResetDate/)
  })

  it('已过期行不再给日期加删除线', () => {
    // 删除线原意是划掉「已作废的额度数字」；现在 meta 装的是到期日，
    // 日期是事实，划掉会读成「这个日期不算数」。
    const expired = /\.dsh-codebuddy-credit-resource-row\.is-expired \.dsh-codebuddy-credit-resource-meta\s*\{([^}]*)\}/
      .exec(INDEX_SCSS)?.[1] ?? ''
    expect(expired).toMatch(/color:/)
    expect(expired).not.toContain('line-through')
  })

  it('详情弹框仍保留用量与进度条（只有卡片被简化）', () => {
    const dialogRow = PANEL.slice(PANEL.indexOf('function ResourceRow'))
    expect(dialogRow).toContain('formatCredit(item.remaining)')
    expect(dialogRow).toContain('<DshProgress')
  })
})
