// Model catalogs are expensive: some providers ask their remote API for every model they expose.
// Keep one catalog per profile in memory and refresh it at most once every 30 minutes. A provider,
// key or sign-in change invalidates both the Settings (REST) and chat (gateway RPC) copies.

const LIVE_TTL = 30 * 60 * 1000

interface Entry<T> {
  data?: T
  liveAt?: number
  requests: Partial<Record<'cached' | 'live', Promise<T>>>
  issued: number
  applied: number
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
  return (entries.get(key)?.data as T | undefined) ?? null
}

export function modelOptionsNeedLiveRefresh(key: string): boolean {
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
  entries.delete(restModelKey(profile))
  entries.delete(chatModelKey(profile))
}

/** Tests and sign-out flows can clear every profile without knowing which ones were opened. */
export function clearModelOptionsCache(): void {
  entries.clear()
}
