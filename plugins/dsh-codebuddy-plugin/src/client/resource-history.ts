/**
 * Per-account resource-package history.
 *
 * The CodeBuddy meter only answers packages whose `Status` is active: once a
 * package's cycle ends (or it is fully consumed and retired) the plane stops
 * returning it entirely — verified against the live API, where every
 * `Status` filter except the active one returns zero rows. A dashboard that
 * showed only the live reply could therefore never explain where last month's
 * allowance went.
 *
 * This module remembers every package a probe has ever seen, keyed by account
 * and package identity, so the account dialog can present the full ledger in
 * three lifecycle groups. It is presentation-only state: nothing here feeds
 * quota math, and a stale entry can never inflate a live balance because the
 * live reply always wins for packages it still returns.
 *
 * @module dsh-codebuddy/resource-history
 */

/** One resource package as observed by a probe. */
export interface ResourceSnapshot {
  /** Stable package identity: name + cycle start, since names repeat. */
  key: string
  name: string
  total: number | null
  remaining: number | null
  /** Reset/expiry timestamp string as the plane disclosed it. */
  resetsAt: string | null
  /** Epoch ms of the last probe that returned this package. */
  lastSeenAt: number
}

const STORAGE_KEY = 'dsh-codebuddy:resource-history'
/** Keep the ledger small: per account, the most recently seen packages. */
const MAX_PER_ACCOUNT = 60

type HistoryDocument = Record<string, ResourceSnapshot[]>

function readDocument(): HistoryDocument {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return {}
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: HistoryDocument = {}
    for (const [accountId, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(value)) continue
      const rows: ResourceSnapshot[] = []
      for (const entry of value) {
        if (entry === null || typeof entry !== 'object') continue
        const row = entry as Partial<ResourceSnapshot>
        if (typeof row.key !== 'string' || typeof row.name !== 'string') continue
        rows.push({
          key: row.key,
          name: row.name,
          total: typeof row.total === 'number' ? row.total : null,
          remaining: typeof row.remaining === 'number' ? row.remaining : null,
          resetsAt: typeof row.resetsAt === 'string' ? row.resetsAt : null,
          lastSeenAt: typeof row.lastSeenAt === 'number' ? row.lastSeenAt : 0,
        })
      }
      out[accountId] = rows
    }
    return out
  } catch {
    return {}
  }
}

function writeDocument(doc: HistoryDocument): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(doc))
  } catch {
    // A private-mode refusal only costs the ledger, never the live view.
  }
}

/** One resource row as the panel receives it from the host. */
export interface LiveResource {
  name: string
  total: number | null
  remaining: number | null
  resetsAt: string | null
}

/** Build the ledger key for one package: name plus its cycle end. */
function resourceKey(resource: LiveResource): string {
  return `${resource.name}@${resource.resetsAt ?? ''}`
}

/**
 * Merge one account's live packages into the remembered ledger.
 *
 * @param accountId - local account id the packages belong to.
 * @param live - packages the current probe returned.
 * @returns the updated ledger for this account, newest activity first.
 */
export function recordResources(accountId: string, live: readonly LiveResource[]): ResourceSnapshot[] {
  const doc = readDocument()
  const existing = doc[accountId] ?? []
  const byKey = new Map(existing.map(row => [row.key, row]))
  const now = Date.now()
  for (const resource of live) {
    const key = resourceKey(resource)
    byKey.set(key, {
      key,
      name: resource.name,
      total: resource.total,
      remaining: resource.remaining,
      resetsAt: resource.resetsAt,
      lastSeenAt: now,
    })
  }
  const merged = [...byKey.values()]
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
    .slice(0, MAX_PER_ACCOUNT)
  doc[accountId] = merged
  writeDocument(doc)
  return merged
}

/** Read one account's remembered ledger without recording anything. */
export function readResources(accountId: string): ResourceSnapshot[] {
  return readDocument()[accountId] ?? []
}

/** Drop one account's ledger (account removed). */
export function forgetResources(accountId: string): void {
  const doc = readDocument()
  if (doc[accountId] === undefined) return
  delete doc[accountId]
  writeDocument(doc)
}

/** Lifecycle group one package belongs to. */
export type ResourceLifecycle = 'usable' | 'depleted' | 'expired'

/** Whether a reset/expiry string is already in the past. */
function isPast(resetsAt: string | null, now: number): boolean {
  if (resetsAt === null || resetsAt.length === 0) return false
  const parsed = new Date(resetsAt.replace(' ', 'T')).getTime()
  return Number.isFinite(parsed) && parsed < now
}

/** One classified package row rendered by the dialog. */
export interface ClassifiedResource extends ResourceSnapshot {
  lifecycle: ResourceLifecycle
  /** True when the live probe still returns this package. */
  live: boolean
}

/**
 * Classify one account's packages into the three lifecycle groups.
 *
 * Live packages win: a package the probe still returns is usable when it has
 * remaining allowance and depleted when it does not. A remembered package the
 * probe no longer returns — or whose cycle end has passed — is expired.
 *
 * @param ledger - remembered packages for the account.
 * @param live - packages the current probe returned.
 * @returns classified rows, usable first, then depleted, then expired.
 */
export function classifyResources(
  ledger: readonly ResourceSnapshot[],
  live: readonly LiveResource[],
): ClassifiedResource[] {
  const now = Date.now()
  const liveByKey = new Map(live.map(resource => [resourceKey(resource), resource]))
  const seen = new Set<string>()
  const rows: ClassifiedResource[] = []

  for (const resource of live) {
    const key = resourceKey(resource)
    seen.add(key)
    const remembered = ledger.find(row => row.key === key)
    const remaining = resource.remaining
    rows.push({
      key,
      name: resource.name,
      total: resource.total,
      remaining,
      resetsAt: resource.resetsAt,
      lastSeenAt: now,
      live: true,
      lifecycle: remaining !== null && remaining > 0 ? 'usable' : 'depleted',
    })
    void remembered
  }

  for (const row of ledger) {
    if (seen.has(row.key)) continue
    // No longer returned by the plane: its cycle ended or it was retired.
    rows.push({ ...row, live: false, lifecycle: 'expired' })
  }

  // A package the plane still lists but whose cycle end already passed counts
  // as expired regardless of the remaining figure it reports.
  for (const row of rows) {
    if (row.live && isPast(row.resetsAt, now)) row.lifecycle = 'expired'
  }

  const order: Record<ResourceLifecycle, number> = { usable: 0, depleted: 1, expired: 2 }
  return rows.sort((a, b) => order[a.lifecycle] - order[b.lifecycle] || b.lastSeenAt - a.lastSeenAt)
}
