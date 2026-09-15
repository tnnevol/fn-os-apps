/**
 * 执行日志的展示模型。
 *
 * 抽成独立模块而不是写在组件里，是因为「时间 / 账号 / 任务 / 状态 / 说明」这五段
 * 各有自己的颜色与对齐规则，把它们做成**纯数据**才好单测。
 *
 * 为什么不用 `CodeHighlight` 做分段着色：它渲染的是 `<code>{字符串}</code>`
 * （见 semi-ui `codeHighlight/index.js`），只能接收纯文本，无法注入分段标记；
 * 而 Semi 只注册了 Prism core 与 line-numbers 插件、**没有加载任何语言词法**
 * （连 `log` 语法都没有），所以拿不到 token 可着色。要按段上色只能自己渲染。
 *
 * @module dsh-codebuddy/log-presentation
 */

import type { GrowthRunLogEntryView } from './rpc.ts'

/** 一行日志的展示字段（已完成对齐与时间格式化）。 */
export interface GrowthLogLine {
  /** 原始时间戳，供 React key 使用。 */
  at: number
  /** `HH:MM:SS`。 */
  time: string
  /** `[账号名]`，含方括号以模仿终端的 `[user@host]`。 */
  account: string
  /** 任务 code，按最长者右侧补空格以保证纵向对齐。 */
  code: string
  /** 状态，右侧补空格以保证说明列对齐。 */
  status: string
  /** 补充说明（可能缺省）。 */
  message?: string
}

/** 状态列的宽度：最长状态 `daily-limit`(11) / `unsupported`(11) 刚好容纳。 */
const STATUS_WIDTH = 11

/** 按行格式化一条日志的时间戳（HH:MM:SS，本地时区）。 */
export function formatLogTime(at: number): string {
  const date = new Date(at)
  const pad = (value: number): string => (value < 10 ? `0${value}` : String(value))
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/**
 * 把日志条目转成逐行的展示数据。
 *
 * 任务 code 补齐到最长者：日志里 code 长度不一（`chat_5` 与 `Expert_team_use_3`），
 * 不补齐会让状态列参差不齐、很难扫读。补齐由**数据**完成（而非 CSS），
 * 这样复制出去的纯文本也是对齐的。
 *
 * @param entries - 宿主返回的日志条目。
 * @returns 逐行数据；无条目时返回空数组。
 */
export function growthLogLines(entries: readonly GrowthRunLogEntryView[] | undefined): GrowthLogLine[] {
  if (entries === undefined || entries.length === 0) return []
  const codeWidth = entries.reduce((max, entry) => Math.max(max, entry.code.length), 0)
  return entries.map(entry => ({
    at: entry.at,
    time: formatLogTime(entry.at),
    account: `[${entry.account}]`,
    code: entry.code.padEnd(codeWidth, ' '),
    status: entry.status.padEnd(STATUS_WIDTH, ' '),
    ...entry.message === undefined ? {} : { message: entry.message },
  }))
}

/** 状态的视觉色调：决定这一行状态文字用什么颜色。 */
export type GrowthLogTone = 'ok' | 'error' | 'warn' | 'info' | 'muted'

/**
 * 把宿主的状态串映射到视觉色调。
 *
 * 覆盖 `growth-run.ts` 与 `auth-service.ts` 里实际会出现的全部取值；未登记的
 * 状态回落到 `info`（宁可平淡也不要误标成成功或失败）。
 *
 * @param status - 宿主写入的状态（可能带对齐用的尾随空格）。
 */
export function statusTone(status: string): GrowthLogTone {
  switch (status.trim()) {
    case 'claimed':
    case 'success':
    case 'done':
      return 'ok'
    case 'error':
      return 'error'
    case 'pending':
    case 'daily-limit':
    case 'traveling':
    case 'departed':
    case 'claiming':
    case 'no-buddy':
      return 'warn'
    case 'running':
    case 'accepted':
      return 'info'
    case 'already':
    case 'skipped':
    case 'unsupported':
      return 'muted'
    default:
      return 'info'
  }
}

/**
 * 把逐行数据拼回等宽纯文本。
 *
 * 用于「日志整体复制」这类需要纯文本的场合；与渲染走的是同一份 {@link growthLogLines}，
 * 因此屏幕上的对齐与复制出来的对齐一致。
 *
 * @param lines - {@link growthLogLines} 的输出。
 */
export function growthLogText(lines: readonly GrowthLogLine[]): string {
  return lines
    .map(line => `${line.time} ${line.account} ${line.code}  ${line.status}${line.message ?? ''}`.trimEnd())
    .join('\n')
}
