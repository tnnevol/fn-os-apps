/** Adapt DSH's presented-file opener to the fnOS iframe SDK. */

import type { FnosPresentedPathResolveResponse } from '../../contracts/presented-open-contract.ts'
import { FNOS_PRESENTED_PATH_RESOLVE_PATH } from '../../contracts/presented-open-contract.ts'
import { isEmbeddedFnosFrame } from './sdk-carrier.ts'

const DSH_PRESENT_HOST_PATH = '/api/present.host'
const DSH_PRESENT_OPEN_PATH = '/api/present.open'

type FnosPresentedOpenSdk = {
  ready(): Promise<unknown>
  openFile(path: string): Promise<unknown>
  openFileManager(path: string): Promise<unknown>
}

type FetchInput = Parameters<typeof fetch>[0]
type FetchInit = Parameters<typeof fetch>[1]

type PresentedOpenAction = 'open' | 'reveal'

function requestUrl(input: FetchInput): URL | undefined {
  try {
    const raw = input instanceof Request ? input.url : String(input)
    return new URL(raw, globalThis.location?.href ?? 'http://fnos.invalid/')
  } catch {
    return undefined
  }
}

function requestMethod(input: FetchInput, init: FetchInit): string {
  return String(init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
}

function actionOf(url: URL): PresentedOpenAction | undefined {
  const action = url.searchParams.get('action')
  return action === null || action === 'open' ? 'open' : action === 'reveal' ? 'reveal' : undefined
}

function coordinatesOf(url: URL): { sessionId: string, seq: number, index: number } | undefined {
  const sessionId = url.searchParams.get('sessionId')
  const seq = Number(url.searchParams.get('seq'))
  const index = Number(url.searchParams.get('index'))
  if (sessionId === null || sessionId.length === 0
    || !Number.isSafeInteger(seq) || seq < 0
    || !Number.isSafeInteger(index) || index < 0) return undefined
  return { sessionId, seq, index }
}

function unavailableResponse(status = 502): Response {
  return new Response('fnOS presented-file opener unavailable.', {
    status,
    headers: { 'cache-control': 'no-store' },
  })
}

async function openPresentedPath(
  url: URL,
  signal: AbortSignal | undefined,
  originalFetch: typeof fetch,
  createSdk: () => FnosPresentedOpenSdk,
): Promise<Response> {
  const action = actionOf(url)
  const coordinates = coordinatesOf(url)
  if (action === undefined || coordinates === undefined) return unavailableResponse(400)

  const resolved = await originalFetch(FNOS_PRESENTED_PATH_RESOLVE_PATH, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(coordinates),
    ...(signal === undefined ? {} : { signal }),
  })
  if (!resolved.ok) return new Response(await resolved.text(), {
    status: resolved.status,
    headers: { 'cache-control': 'no-store' },
  })
  const value = await resolved.json().catch(() => undefined) as FnosPresentedPathResolveResponse | undefined
  if (value === undefined || typeof value.path !== 'string' || value.path.length === 0) return unavailableResponse()

  const sdk = createSdk()
  await sdk.ready()
  if (action === 'reveal') await sdk.openFileManager(value.path)
  else await sdk.openFile(value.path)
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } })
}

/** Intercept DSH `present.open` only inside an embedded fnOS page. */
export function installFnosPresentedOpen(createSdk: () => FnosPresentedOpenSdk): () => void {
  if (!isEmbeddedFnosFrame()) return () => undefined
  const originalFetch = globalThis.fetch
  const wrappedFetch: typeof fetch = async (input, init) => {
    const url = requestUrl(input)
    if (url === undefined) return originalFetch(input, init)
    if (url.pathname === DSH_PRESENT_HOST_PATH && requestMethod(input, init) === 'GET') {
      // DSH's native desktop probe runs inside the NAS process and is therefore
      // unavailable. The actual capability is the fnOS iframe SDK, which is
      // exercised when the user clicks the action.
      return Response.json({ name: 'fnOS', available: true, fileManager: 'directory' }, {
        headers: { 'cache-control': 'no-store' },
      })
    }
    if (url.pathname !== DSH_PRESENT_OPEN_PATH || requestMethod(input, init) !== 'POST') {
      return originalFetch(input, init)
    }
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined)
    return openPresentedPath(url, signal, originalFetch, createSdk)
  }
  globalThis.fetch = wrappedFetch
  return () => {
    if (globalThis.fetch === wrappedFetch) globalThis.fetch = originalFetch
  }
}
