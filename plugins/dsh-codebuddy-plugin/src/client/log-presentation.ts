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
  /** 该行状态对应的色调（未完成红 / 完成一半黄 / 完成跳过绿）。 */
  tone: GrowthLogTone
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
  return entries.map(entry => {
    // 进度决定 pending 是「红（没做）」还是「黄（做了一半）」。
    const progress = entry.current === undefined || entry.target === undefined
      ? undefined
      : { current: entry.current, target: entry.target }
    return {
      at: entry.at,
      time: formatLogTime(entry.at),
      account: `[${entry.account}]`,
      code: entry.code.padEnd(codeWidth, ' '),
      status: entry.status.padEnd(STATUS_WIDTH, ' '),
      tone: statusTone(entry.status, progress),
      ...entry.message === undefined ? {} : { message: entry.message },
    }
  })
}

/**
 * 状态的视觉色调：决定这一行状态文字用什么颜色。
 *
 * 四种色调对应「任务结局」的四类，与使用者指定的规则一一对应：
 * `ok`＝完成/跳过（绿）、`error`＝未完成（红）、`warn`＝完成一半（黄）、
 * `info`＝进行中（蓝，过程标记而非结局）。刻意不含「灰」——跳过已经归入绿色。
 */
export type GrowthLogTone = 'ok' | 'error' | 'warn' | 'info'

/**
 * 把宿主的状态串映射到视觉色调。
 *
 * 按「任务结局」上色，规则由使用者指定：
 *  - **未完成 → 红**：还没做（进度 0）或执行失败；
 *  - **完成了一半 → 黄**：有进度但未达标；
 *  - **完成 / 跳过 → 绿**：已领奖、已在跑或今日已完成而跳过、不支持自动化的跳过；
 *  - **进行中 → 蓝**：`running` / `accepted` 是**过程标记**而不是结局，
 *    用中性色，避免整屏因为「正在跑」而全红。
 *
 * @param status - 宿主写入的状态（可能带对齐用的尾随空格）。
 * @param progress - 该任务的进度；缺省表示这条日志与具体任务无关（账号级/流程级）。
 */
export function statusTone(status: string, progress?: { current: number, target: number }): GrowthLogTone {
  switch (status.trim()) {
    // 已完成：领奖成功、任务完成、此前已领取。
    case 'claimed':
    case 'success':
    case 'done':
    case 'already':
      return 'ok'
    // 跳过也是「不用做」的终态：今日已签到/已旅行、不支持自动化、企业账号不支持。
    case 'skipped':
    case 'unsupported':
      return 'ok'
    // 失败是未完成的一种。
    case 'error':
      return 'error'
    // 未达标：有进度算「完成了一半」，零进度算「没开始做」。
    case 'pending':
      if (progress !== undefined && progress.current > 0) return 'warn'
      return 'error'
    // 进行中的过程标记，不属于结局。
    case 'running':
    case 'accepted':
    case 'waiting':
      return 'info'
    // 旅行类中间态：尚在等到达/领取中，按「完成了一半」处理。
    case 'traveling':
    case 'departed':
    case 'claiming':
    case 'adopted':
      return 'warn'
    // 今日已旅行（服务端 daily_limit_reached）＝今天这件事不用再做了 → 跳过 → 绿。
    case 'daily-limit':
      return 'ok'
    // 没有猫猫：可重试，不算失败，但也确实没完成。
    case 'no-buddy':
      return 'warn'
    // 领养门槛未达标：今日活跃度不够，不是账号故障，也不是「完成」。
    case 'adopt-threshold':
      return 'warn'
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
