// Model catalogs are expensive: some providers ask their remote API for every model they expose.
// Keep one catalog per profile in memory and on this device, and refresh it at most once every 30
// minutes. The persisted copy makes the picker useful immediately after an app restart. A provider,
// key or sign-in change invalidates both the Settings (REST) and chat (gateway RPC) copies.

const LIVE_TTL = 30 * 60 * 1000
const STORAGE_PREFIX = 'hm.modelOptions.v1:'

interface Entry<T> {
  data?: T
  liveAt?: number
  requests: Partial<Record<'cached' | 'live', Promise<T>>>
  issued: number
  applied: number
  restored?: boolean
}

const entries = new Map<string, Entry<unknown>>()

const entry = <T>(key: string): Entry<T> => {
  let e = entries.get(key) as Entry<T> | undefined
  if (!e) {
    e = { requests: {}, issued: 0, applied: 0 }
    entries.set(key, e as Entry<unknown>)
  }
  return e
}

export const restModelKey = (profile: string) => `rest:${profile}`
export const chatModelKey = (profile: string) => `chat:${profile}`

export function cachedModelOptions<T>(key: string): T | null {
  const e = entry<T>(key)
  if (!e.restored) {
    e.restored = true
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key)
      if (raw) {
        const saved = JSON.parse(raw) as { data?: T; liveAt?: number }
        if (saved && saved.data !== undefined) {
          e.data = saved.data
          e.liveAt = Number.isFinite(saved.liveAt) ? saved.liveAt : undefined
        }
      }
    } catch {
      // Storage can be unavailable in private browsing or a constrained WebView.
    }
  }
  return e.data ?? null
}

export function modelOptionsNeedLiveRefresh(key: string): boolean {
  cachedModelOptions(key) // Restore the persisted timestamp together with its catalog.
  const at = entries.get(key)?.liveAt || 0
  return Date.now() - at >= LIVE_TTL
}

/** Dedupe cached/live catalog requests and remember the answer for the next picker open. */
export function fetchModelOptions<T>(key: string, live: boolean, load: () => Promise<T>): Promise<T> {
  const e = entry<T>(key)
  const kind = live ? 'live' : 'cached'
  const pending = e.requests[kind]
  if (pending) return pending
  const requestNumber = ++e.issued
  const request = load()
    .then(data => {
      // A fast live refresh may finish before the older disk-cache read. Never let the older answer replace it.
      if (requestNumber >= e.applied) {
        e.data = data
        e.applied = requestNumber
        if (live) e.liveAt = Date.now()
        try {
          localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify({ data, liveAt: e.liveAt }))
        } catch {
          // The in-memory catalog still works when persistent storage is full or unavailable.
        }
      }
      return data
    })
    .finally(() => {
      delete e.requests[kind]
    })
  e.requests[kind] = request
  return request
}

export function invalidateModelOptions(profile: string): void {
  for (const key of [restModelKey(profile), chatModelKey(profile)]) {
    entries.delete(key)
    try {
      localStorage.removeItem(STORAGE_PREFIX + key)
    } catch {
      // Cache invalidation in memory remains effective if storage is unavailable.
    }
  }
}

/** Tests and sign-out flows can clear every profile without knowing which ones were opened. */
export function clearModelOptionsCache(): void {
  entries.clear()
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith(STORAGE_PREFIX)) localStorage.removeItem(key)
    }
  } catch {
    // Tests and sign-out flows still clear the in-memory cache.
  }
}
