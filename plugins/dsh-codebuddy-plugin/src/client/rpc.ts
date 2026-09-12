import type { RpcErr } from '../types/client/rpc'
export type { RpcOk, RpcErr, RpcResult, ConnectionRpc, AuthStatus, AccountView, AccountsResult, LoginStart, LoginPoll, UsageWindow, UsageResult } from '../types/client/rpc'


/** Turn an RPC failure into a readable string. */
export function describeRpcError(result: RpcErr): string {
  return `${result.error.code}: ${result.error.message}`
}
