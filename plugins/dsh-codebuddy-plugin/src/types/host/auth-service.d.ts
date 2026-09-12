
import type { CodeBuddyAccountEntry } from '../../host/storage.ts'
import type { UsageSnapshot } from '../../host/usage.ts'
import type { collectCodeBuddyTokenStats } from '../../host/token-stats.ts'

export interface SessionAnalyticsServices {
  sessionQuery?: Parameters<typeof collectCodeBuddyTokenStats>[0]
}
/**
 * 一次额度探测的结果（供面板区分「缓存/新鲜」与「失败/为 0」）。
 *
 * 与 `UsageProbeResult` 同形，但这里不依赖 session 是否存在——session 缺席的
 * profile 会退回直连探测，此时同样需要产出这个形状。
 */
export interface ProbeOutcome {
  snapshot: UsageSnapshot | undefined
  probedAt: number
  fromCache: boolean
  error?: string
}
/** `status` 返回给客户端的形状。 */
export interface CodeBuddyAuthStatus {
  /** 是否存有可用凭据。 */
  loggedIn: boolean
  /** 已登录的显示昵称（若可用）。 */
  nickname?: string
  /** 账号 uid（若可用）。 */
  uid?: string
  /** 腾讯用户身份号码（如 QQ openid），账号披露时才有。 */
  uin?: string
  /** 企业/组织 id，企业租户账号才有。 */
  enterpriseId?: string
  /** 企业显示名称，企业租户账号才有。 */
  enterpriseName?: string
  /** 企业用户名（账号在租户内的名字）。 */
  enterpriseUserName?: string
  /** 部门全名，企业账号披露时才有。 */
  departmentFullName?: string
}
/** `startLogin` 返回给客户端的形状。 */
export interface CodeBuddyLoginStart {
  /** 用户需要打开进行登录的 URL。 */
  authUrl: string
  /** 握手 id；客户端会把它回传给 `pollLogin`。 */
  state: string
}
/** `pollLogin` 返回给客户端的形状。 */
export interface CodeBuddyLoginPoll {
  /** 握手是否已完成且凭据已持久化。 */
  done: boolean
  /** 已登录的显示昵称（登录刚完成时给出）。 */
  nickname?: string
  /**
   * 失败原因（登录已确定失败时给出）。有值即表示不必再轮询：继续等待不会有结果，
   * 应把原因显示给用户。没有该字段时表示「仍在等待用户完成授权」。
   */
  error?: string
}
/**
 * 发送到客户端的一个计量窗口，是 {@link UsageWindow} 的纯数据投影，
 * 可选字段仅在存在时输出，缺省是安全的。
 */
export interface CodeBuddyUsageWindow {
  name: string
  used?: number
  limit?: number
  usedPercent?: number
  resetsAt?: string
}
/** `usage` 返回给客户端的形状。 */
export interface CodeBuddyUsageResult {
  /** 是否存有可用凭据；false 表示没有可展示的用量。 */
  loggedIn: boolean
  /** 每个计量窗口一条；meter 平面没有可用数据时为空。 */
  windows: CodeBuddyUsageWindow[]
  /**
   * 第一个窗口，供单条进度条的呈现使用；平面未报告任何窗口时
   * 为 `undefined`。
   */
  primary?: CodeBuddyUsageWindow
}
/** 投影到客户端的一个存储账号。 */
export interface CodeBuddyAccountView {
  /** 稳定的本地 id；传给 `switchAccount` / `removeAccount` 使用。 */
  id: string
  nickname: string
  /** 本地展示备注名；缺失时回退到昵称。 */
  label?: string
  /** 该凭据签发时所对应的网络环境（若已知）。 */
  environment?: string
  uid: string
  uin?: string
  enterpriseId?: string
  enterpriseName?: string
  enterpriseUserName?: string
  departmentFullName?: string
  /** 是否是所有请求都以其鉴权的当前账号。 */
  active: boolean
  /** refresh token 是否已过期——该账号已离线，需要重新登录。 */
  expired: boolean
}
/** `accounts` 返回给客户端的形状。 */
export interface CodeBuddyAccountsResult {
  /** 是否至少存有一个可用凭据。 */
  loggedIn: boolean
  /** 当前账号（已登录时给出）。 */
  current?: CodeBuddyAccountView
  /** 每个存储账号一条，当前账号在前，其余按存储顺序。 */
  accounts: CodeBuddyAccountView[]
}
/** `removeAccount` / `switchAccount` 返回给客户端的形状。 */
export interface CodeBuddyAccountsChanged {
  loggedIn: boolean
  current?: CodeBuddyAccountView
  accounts: CodeBuddyAccountView[]
}
/** 一次进行中的浏览器登录握手，以其自身的 state 为键。 */
export interface PendingLogin {
  /** 交给浏览器打开的确切 URL；复制按钮提供的是同一个链接。 */
  authUrl?: string
  state: string
  /** `pollAuthToken` 成功后 resolve 为已持久化的存储条目。 */
  promise: Promise<CodeBuddyAccountEntry | undefined>
  /**
   * 失败原因。登录失败时由 {@link CodeBuddyAuthService.runLogin} 写入，
   * `pollLogin` 据此把「已失败」与「仍在等待」区分开——否则前端只能一直轮询到
   * 超时，用户看不到任何失败原因（这正是此前 workbuddy 登录无反应的成因）。
   */
  failure?: string
}
/** 一个成功的 RPC 结果。 */
export interface RpcOk<T> { ok: true, value: T }
/** 一个失败的 RPC 结果。 */
export interface RpcErr { ok: false, error: { code: string, message: string, details: Record<string, unknown> } }
