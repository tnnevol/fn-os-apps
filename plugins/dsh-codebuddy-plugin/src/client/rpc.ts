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

/** The startLogin result shape. */
export interface LoginStart {
  authUrl: string
  state: string
}

/** The pollLogin result shape. */
export interface LoginPoll {
  done: boolean
  nickname?: string
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

/** Turn an RPC failure into a readable string. */
export function describeRpcError(result: RpcErr): string {
  return `${result.error.code}: ${result.error.message}`
}
