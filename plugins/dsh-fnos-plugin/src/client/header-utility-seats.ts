/**
 * 会话头部两个条目的座位形状。
 *
 * 单独成模块是为了让「谁在左、谁在右」这件事可被真实行为测试覆盖：列表插槽的
 * 显示顺序是 **priority 升序、再 order 升序**（`ui-slots` 的 `SlotCore` 排序），
 * 而座位形状一旦被打平，位置就改由注册顺序决定、与官方相反——这种回归不会报错，
 * 只会静默地把两个按钮调换位置。把形状抽出来，测试才能用真实 `SlotCore` 注册
 * 这两个座位并断言最终顺序。
 *
 * 取值对齐官方：`ui-open-in-app` 用 `order: -10`，`session-log-export` 不设
 * order（默认 0），因此官方布局是「文件入口在左、更多操作在右」。
 */

/** 列表插槽里一个条目的排序形状。 */
export interface HeaderUtilitySeat {
  readonly name: 'conversation.session.header.utilities'
  readonly id: string
  readonly order: number
  readonly priority: number
}

/**
 * fnOS 文件入口：遮蔽官方 `open-in-app`。
 *
 * `priority: -1` 是为了遮蔽——官方条目用默认 0，同优先级注册会直接抛错。
 * `order: -10` 与官方一致，保证它排在 session log 之前。
 */
export const FNOS_OPEN_IN_APP_SEAT: HeaderUtilitySeat = {
  name: 'conversation.session.header.utilities',
  id: 'open-in-app',
  order: -10,
  priority: -1,
}

/**
 * Session log：遮蔽官方 `session-log-download`，保持默认 order 0 排在右侧。
 */
export const FNOS_SESSION_LOG_SEAT: HeaderUtilitySeat = {
  name: 'conversation.session.header.utilities',
  id: 'session-log-download',
  order: 0,
  priority: -1,
}
