
/** CodeBuddy 类型声明；由原模块抽取，运行时实现保留在 src 下。 */
import type { CodeBuddyLocaleKey } from '../../client/locales/index.ts'

/** 翻译函数（i18n 接口）。所有组件 props 都直接接 `Translate`。 */
export type Translate = (key: CodeBuddyLocaleKey) => string
/**
 * 一个账号的完整卡片数据（host panelStatus 聚合返回）。
 *
 * 形态在面板内部到处用到：AccountsPage、AccountCard、AccountResourcesModal；
 * 单独成类型，便于未来与 host 端的 host 类型隔离。
 */
export interface PanelAccountRow {
  id: string
  name: string
  nickname: string
  active: boolean
  environment: string
  client: string
  expired: boolean
  rewardCredit: number
  /** 该客户端登录时的版本号；缺失时回退到内置版本（按 client 字典查）。 */
  clientVersion?: string
  /** 服务端当前活跃的服务地址（私有化部署场景尤为有用）。 */
  endpoint?: string
  /** 企业账号才有该字段；提供身份信息面板的所有账号级元数据。 */
  account?: {
    uid: string
    uin?: string
    /** 昵称：identity-rows 把它当作必填展示，因此给一个 string 默认值。 */
    nickname?: string
    label?: string | null
    /** 企业账号的企业 ID（与 host 的 `account.enterpriseId` 对齐）。 */
    enterpriseId?: string | null
    /** 企业名称（host 返回 `account.enterpriseName`）。 */
    enterpriseName?: string | null
    /** 企业内账号所在用户名（host 返回 `account.enterpriseUserName`）。 */
    enterpriseUserName?: string | null
    /** 部门路径 base64 编码。 */
    departmentFullName?: string | null
  }
  /** 是否为企业账号（影响签到、旅行、能力总览）。 */
  enterprise?: boolean
  /** 是否支持签到：false 时隐藏手动签到入口。 */
  checkinOk?: boolean
  /** 是否仍可用（未过期 + 当前可登录）。 */
  usable?: boolean
  /** 总剩余 / 总量。 */
  totalRemaining: number
  totalCapacity: number
  /**
   * 今天的签到状态。true = 今天已签到、false = 未签；undefined = 暂未
   * 探测（不要据此隐藏签到入口，等探测完成后再判断）。
   */
  todayCheckedIn?: boolean
  /** 旅行相关的实时状态；企业账号始终为 null。 */
  travel: null | {
    state: 'idle' | 'traveling'
    arriveAt: number
    serverNow: number
    locationName: string | null
    buddyId: number
    dailyLimitReached: boolean
  }
  /** 该账号的实时资源包（来自 fetchUsage）。 */
  resources: Array<{ name: string, total: number | null, used: number | null, remaining: number | null, resetsAt: string | null }>
  /** 最近一次探测是否成功（false 时不要把台账标记为过期）。 */
  creditOk: boolean
  /** 总剩余与提示文案。 */
  remaining: number
  remainingSum: number
  /** 探测时间戳 / 错误，详情见 host panelStatus。 */
  probedAt?: number
  probedFromCache?: boolean
  probeError?: string | null
  result?: string
  skipped?: boolean
}
/** 积分到期资源（CreditStatsPage 复用账号卡片的 resources）。 */
export interface PanelCreditRow {
  name: string
  remaining: number
  total: number
}
/** CodeBuddy 专属 Token 统计聚合（host tokenStats 返回）。 */
export interface TokenStats {
  provider: string
  rangeDays: number
  generatedAt: number
  totals: { total: number, input: number, output: number, read: number, records: number, sessions: number, cacheHitRate?: number }
  days: Array<{ day: string, total: number, input: number, output: number, read: number, records: number, activeSessions: number }>
  activity: Array<{ day: string, calls: number, tokens: number, activeSessions: number }>
  workspaces: Array<{ name: string, path?: string, total: number, calls: number, percent: number }>
  models: Array<{ name: string, total: number, calls: number, percent: number }>
  sessions: Array<{ id: string, title: string, workspace?: string, total: number, input: number, output: number, calls: number, percent: number, lastActiveAt: number }>
}
/**
 * 账号卡片展示用的翻译标签集合。
 *
 * 与 {@link PanelAccountRow} 并列：账号卡片需要大量本地化文案，但只在卡片渲染
 * 时用——把它们绑在账号数据上会污染数据模型。`AccountsPage` 集中按 `t`
 * 构造一份，传给 `AccountCard`，避免每次 render 重新拼一遍文案。
 */
export interface AccountCardLabels {
  active: string
  offline: string
  checkedIn: string
  unchecked: string
  checkin: string
  remaining: string
  switchLabel: string
  deleteLabel: string
  renameLabel: string
  resourcesLabel: string
  longTerm: string
  noBalanceHint: string
  travel: {
    untraveled: string
    noBuddy: string
    traveling: string
    arrivesIn: string
    dailyLimit: string
    reward: string
  }
}
