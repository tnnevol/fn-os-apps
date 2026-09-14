/** fnOS bridge route used to resolve a presented workspace file before opening it. */

export const FNOS_PRESENTED_PATH_RESOLVE_PATH = '/fnos-plugins/present/resolve'

export interface FnosPresentedPathResolveRequest {
  sessionId: string
  seq: number
  index: number
}

export interface FnosPresentedPathResolveResponse {
  path: string
}
