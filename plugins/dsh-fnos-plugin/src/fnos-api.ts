/** Minimal server-side client for the fnOS open API gateway. */

import { request } from 'node:http'

const FNOS_API_SOCKET = '/var/run/trim_open_gateway_apiscope.socket'
const FNOS_API_PATH = '/api/v1/trimapp'
const RESPONSE_LIMIT = 128 * 1024
const REQUEST_TIMEOUT_MS = 10_000

interface FnOsApiEnvelope<T> {
  code?: unknown
  msg?: unknown
  data?: T
}

export class FnOsApiError extends Error {
  constructor(
    readonly apiCode: number | undefined,
    message: string,
  ) {
    super(message)
    this.name = 'FnOsApiError'
  }
}

export interface FnOsApiRequestOptions {
  socketPath?: string
  appName?: string
  token?: string
  timeoutMs?: number
}

function apiMessage(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim().slice(0, 300) : 'fnOS API request failed'
}

function requestId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/** Call one fnOS API without persisting or exposing TRIM_API_TOKEN. */
export async function callFnOsApi<T>(
  req: string,
  data: Record<string, unknown> = {},
  options: FnOsApiRequestOptions = {},
): Promise<T> {
  const token = (options.token ?? process.env.TRIM_API_TOKEN)?.trim()
  if (token === undefined || token.length === 0) throw new FnOsApiError(undefined, 'fnOS API token is unavailable')

  const appName = options.appName?.trim() || process.env.TRIM_APPNAME?.trim() || 'fn-deepseek-harness'
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS
  const payload = JSON.stringify({
    reqId: requestId(),
    req,
    appName,
    data,
  })

  const response = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
    const reqHandle = request({
      socketPath: options.socketPath ?? FNOS_API_SOCKET,
      path: FNOS_API_PATH,
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
        authorization: `Bearer ${token}`,
      },
    }, responseMessage => {
      let body = ''
      let size = 0
      responseMessage.setEncoding('utf8')
      responseMessage.on('data', (chunk: string) => {
        size += Buffer.byteLength(chunk)
        if (size <= RESPONSE_LIMIT) body += chunk
      })
      responseMessage.on('end', () => {
        if (size > RESPONSE_LIMIT) {
          reject(new FnOsApiError(undefined, 'fnOS API response is too large'))
          return
        }
        resolve({ statusCode: responseMessage.statusCode ?? 0, body })
      })
      responseMessage.on('error', reject)
    })
    reqHandle.setTimeout(timeoutMs, () => {
      reqHandle.destroy(new Error('fnOS API request timed out'))
    })
    reqHandle.on('error', reject)
    reqHandle.end(payload)
  })

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new FnOsApiError(undefined, `fnOS API returned HTTP ${String(response.statusCode)}`)
  }

  let envelope: FnOsApiEnvelope<T>
  try {
    envelope = JSON.parse(response.body) as FnOsApiEnvelope<T>
  } catch {
    throw new FnOsApiError(undefined, 'fnOS API returned invalid JSON')
  }

  const code = typeof envelope.code === 'number' ? envelope.code : undefined
  if (code !== 0) throw new FnOsApiError(code, apiMessage(envelope.msg))
  return envelope.data as T
}
