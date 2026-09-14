/** Resolve DSH presented-file coordinates into a verified Host path for fnOS. */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { FnosPresentedPathResolveRequest, FnosPresentedPathResolveResponse } from '../contracts/presented-open-contract.ts'
import { FNOS_PRESENTED_PATH_RESOLVE_PATH } from '../contracts/presented-open-contract.ts'
import { isTrustedFnosRequest } from './authorized-directories.ts'

const BODY_LIMIT = 16 * 1024

type SessionQueryLike = {
  readEvent: (request: { sessionId: string, seq: number, before: number, after: number }, signal: AbortSignal) => Promise<{
    session: { cwd?: unknown }
    target: { type?: unknown, data?: unknown }
  }>
}

type WorkspaceFilesLike = {
  stat: (request: { sessionId: string, workspaceRoot: string }, path: string, signal: AbortSignal) => Promise<{ absolutePath: string }>
}

type FsLike = {
  processPathFromHostPath: (path: string) => string | undefined
  resolve: (path: string, options: { signal: AbortSignal }) => Promise<string>
  processPath: (path: string) => string
}

type SandboxPolicyLike = { workspaceRoot: string }

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'content-length': String(Buffer.byteLength(body)),
  })
  res.end(body)
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      size += buffer.length
      if (size > BODY_LIMIT) {
        reject(new Error('request body too large'))
        req.destroy()
        return
      }
      chunks.push(buffer)
    })
    req.once('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('invalid JSON body'))
      }
    })
    req.once('error', reject)
  })
}

function requestOf(value: unknown): FnosPresentedPathResolveRequest | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const sessionId = record.sessionId
  const seq = record.seq
  const index = record.index
  if (typeof sessionId !== 'string' || sessionId.length === 0
    || typeof seq !== 'number' || !Number.isSafeInteger(seq) || seq < 0
    || typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0) return undefined
  return { sessionId, seq, index }
}

function presentedPathOf(target: unknown, index: number): string | undefined {
  if (typeof target !== 'object' || target === null || Array.isArray(target)) return undefined
  const record = target as { type?: unknown, data?: unknown }
  if (record.type !== 'deliverables/presented' || typeof record.data !== 'object'
    || record.data === null || Array.isArray(record.data)) return undefined
  const files = (record.data as { files?: unknown }).files
  if (!Array.isArray(files)) return undefined
  const file = files[index]
  if (typeof file !== 'object' || file === null || Array.isArray(file)) return undefined
  const path = (file as { path?: unknown }).path
  return typeof path === 'string' && path.trim().length > 0 ? path : undefined
}

export async function resolvePresentedPath(ctx: Context, request: FnosPresentedPathResolveRequest, signal: AbortSignal): Promise<string> {
  const sessionQuery = ctx.get('sessionQuery') as SessionQueryLike | undefined
  const workspaceFiles = ctx.get('workspaceFiles') as WorkspaceFilesLike | undefined
  const fs = ctx.get('fs') as FsLike | undefined
  const sandboxPolicy = ctx.get('sandboxPolicy') as SandboxPolicyLike | undefined
  if (sessionQuery === undefined || workspaceFiles === undefined || fs === undefined || sandboxPolicy === undefined) {
    throw new Error('fnOS presented-path resolver services are unavailable')
  }

  const window = await sessionQuery.readEvent({
    sessionId: request.sessionId,
    seq: request.seq,
    before: 0,
    after: 0,
  }, signal)
  const relativePath = presentedPathOf(window.target, request.index)
  if (relativePath === undefined) throw Object.assign(new Error('Presented file not found in this Session result.'), { code: 'not-found' })

  const workspaceRoot = typeof window.session.cwd === 'string' && window.session.cwd.length > 0
    ? window.session.cwd
    : sandboxPolicy.workspaceRoot
  const { absolutePath } = await workspaceFiles.stat({ sessionId: request.sessionId, workspaceRoot }, relativePath, signal)
  const mapped = fs.processPathFromHostPath(absolutePath)
  if (mapped === undefined || fs.processPath(await fs.resolve(mapped, { signal })) !== absolutePath) {
    throw Object.assign(new Error('Presented file has no verified Host path.'), { code: 'unverified' })
  }
  return absolutePath
}

/** Register the fnOS browser bridge resolver for DSH `present.open` coordinates. */
export function registerPresentedPathRoute(ctx: Context): void {
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FNOS_PRESENTED_PATH_RESOLVE_PATH,
    handler: async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'method not allowed' })
        return
      }
      if (!isTrustedFnosRequest(req)) {
        sendJson(res, 403, { error: 'remote-web-origin-not-trusted' })
        return
      }
      let request: FnosPresentedPathResolveRequest | undefined
      try {
        request = requestOf(await readJsonBody(req))
      } catch {
        sendJson(res, 400, { error: 'invalid-presented-path-request' })
        return
      }
      if (request === undefined) {
        sendJson(res, 400, { error: 'invalid-presented-path-request' })
        return
      }
      const lifetime = new AbortController()
      const abort = () => { lifetime.abort() }
      req.once('aborted', abort)
      req.once('close', abort)
      try {
        const path = await resolvePresentedPath(ctx, request, lifetime.signal)
        sendJson(res, 200, { path } satisfies FnosPresentedPathResolveResponse)
      } catch (error: unknown) {
        if (lifetime.signal.aborted) return
        const code = error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : undefined
        sendJson(res, code === 'not-found' ? 404 : code === 'unverified' ? 422 : 500, {
          error: code === 'not-found' || code === 'unverified' ? error instanceof Error ? error.message : String(error) : 'fnos-presented-path-unavailable',
        })
      } finally {
        req.off('aborted', abort)
        req.off('close', abort)
      }
    },
  }), 'dsh-fnos: presented path resolver')
}
