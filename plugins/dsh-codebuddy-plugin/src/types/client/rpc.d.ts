/** CodeBuddy 类型声明；由原模块抽取，运行时实现保留在 src 下。 */

/** Browser RPC contracts for the CodeBuddy host auth service. */

/** A successful RPC result. */
export interface RpcOk<T> { ok: true, value: T }
/** A failed RPC result. */
export interface RpcErr { ok: false, error: { code: string, message: string, details: Record<string, unknown> } }
export type RpcResult<T> = RpcOk<T> | RpcErr
/** The connection RPC face injected as `ctx.connection.rpc`. */
export interface ConnectionRpc {
  call: <T>(channel: string, endpoint: string, payload?: unknown, signal?: AbortSignal) => Promise<RpcResult<T>>
}
/** The status shape the host `status` endpoint returns. */
export interface AuthStatus {
  loggedIn: boolean
  nickname?: string
  uid?: string
  uin?: string
  enterpriseId?: string
  enterpriseName?: string
  enterpriseUserName?: string
  departmentFullName?: string
}
/** One stored account the host `accounts` endpoint reports. */
export interface AccountView {
  /** Stable local id; pass it to `switchAccount` / `removeAccount`. */
  id: string
  nickname: string
  /** Local display label; falls back to nickname when absent. */
  label?: string
  /** Network environment this credential was issued against, when known. */
  environment?: string
  uid: string
  uin?: string
  enterpriseId?: string
  enterpriseName?: string
  enterpriseUserName?: string
  departmentFullName?: string
  /** Whether this is the active account every request authenticates with. */
  active: boolean
  /** Whether the refresh token has expired — the account is offline and needs re-login. */
  expired: boolean
}
/** The accounts result shape the host `accounts` endpoint returns. */
export interface AccountsResult {
  loggedIn: boolean
  current?: AccountView
  accounts: AccountView[]
}
/** The startLogin result shape. */
export interface LoginStart {
  authUrl: string
  state: string
}
/** The pollLogin result shape. */
export interface LoginPoll {
  done: boolean
  nickname?: string
  /**
   * 登录已确定失败时的原因。有值即应停止轮询并把原因显示给用户——
   * 此前失败与「仍在等待授权」都表现为 done:false，前端只能一直轮询到超时。
   */
  error?: string
}
/** One metering window the host `usage` endpoint reports. */
export interface UsageWindow {
  name: string
  used?: number
  limit?: number
  usedPercent?: number
  resetsAt?: string
}
/** The usage result shape the host `usage` endpoint returns. */
export interface UsageResult {
  loggedIn: boolean
  windows: UsageWindow[]
  primary?: UsageWindow
}
