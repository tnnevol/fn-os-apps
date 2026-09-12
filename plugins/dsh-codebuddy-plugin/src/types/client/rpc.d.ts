/** CodeBuddy 类型声明；由原模块抽取，运行时实现保留在 src 下。 */

/** Browser RPC contracts for the CodeBuddy host auth service. */

/** A successful RPC result. */
export interface RpcOk<T> { ok: true, value: T }
/** A failed RPC result. */
export interface RpcErr { ok: false, error: { code: string, message: string, details: Record<string, unknown> } }
export type RpcResult<T> = RpcOk<T> | RpcErr
/**
 * The connection RPC face injected as `ctx.connection.rpc`.
 *
 * `payload` 是**必填**（与 DSH 真实契约 `payload: unknown` 一致），不是可选。
 * 这里刻意不写成 `payload?: unknown`：Connection 客户端用
 * `JSON.stringify({ type, rpcId, method, payload })` 构造信封，而 stringify 会
 * **丢掉值为 undefined 的键**；host 侧 zod schema 是 `payload: z.unknown()`，
 * 缺键会被判为 `invalid client-request message` 并拒收整个请求。
 *
 * 曾经本地把它声明成可选，于是 `rpc.call(channel, endpoint)`（省略 payload）
 * 能通过 tsc、测试也照过，故障只在真实浏览器+host 联调时暴露（表现为账号管理页
 * 空白）。收紧成必填后，这类写法在 tsc 阶段就会被拦下。
 *
 * 只读端点传空对象 `{}` 即可——host 的对应分支本来就不读 payload。
 */
export interface ConnectionRpc {
  call: <T>(channel: string, endpoint: string, payload: unknown, signal?: AbortSignal) => Promise<RpcResult<T>>
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
