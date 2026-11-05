import { beforeEach, describe, expect, test, vi } from 'vitest'
import { cachedModelOptions, chatModelKey, clearModelOptionsCache, fetchModelOptions, invalidateModelOptions, modelOptionsNeedLiveRefresh, restModelKey } from './model-options-cache'

describe('model options cache', () => {
  beforeEach(() => clearModelOptionsCache())

  test('deduplicates a slow catalog request and keeps its answer', async () => {
    let finish!: (v: { providers: string[] }) => void
    const load = vi.fn(() => new Promise<{ providers: string[] }>(resolve => (finish = resolve)))
    const key = restModelKey('default')
    const a = fetchModelOptions(key, false, load)
    const b = fetchModelOptions(key, false, load)
    expect(load).toHaveBeenCalledTimes(1)
    finish({ providers: ['codex'] })
    await expect(Promise.all([a, b])).resolves.toEqual([{ providers: ['codex'] }, { providers: ['codex'] }])
    expect(cachedModelOptions(key)).toEqual({ providers: ['codex'] })
  })

  test('a live answer suppresses another live refresh inside the TTL', async () => {
    const key = chatModelKey('work')
    expect(modelOptionsNeedLiveRefresh(key)).toBe(true)
    await fetchModelOptions(key, true, async () => ({ model: 'gpt' }))
    expect(modelOptionsNeedLiveRefresh(key)).toBe(false)
  })

  test('an older cached request cannot overwrite a newer live answer', async () => {
    const key = restModelKey('default')
    let finishCached!: (v: { model: string }) => void
    const cached = fetchModelOptions(key, false, () => new Promise(resolve => (finishCached = resolve)))
    await fetchModelOptions(key, true, async () => ({ model: 'new' }))
    finishCached({ model: 'old' })
    await cached
    expect(cachedModelOptions(key)).toEqual({ model: 'new' })
  })

  test('a provider change clears both REST and chat catalogs for only that profile', async () => {
    await fetchModelOptions(restModelKey('default'), false, async () => ({ a: 1 }))
    await fetchModelOptions(chatModelKey('default'), false, async () => ({ b: 2 }))
    await fetchModelOptions(restModelKey('other'), false, async () => ({ c: 3 }))
    invalidateModelOptions('default')
    expect(cachedModelOptions(restModelKey('default'))).toBeNull()
    expect(cachedModelOptions(chatModelKey('default'))).toBeNull()
    expect(cachedModelOptions(restModelKey('other'))).toEqual({ c: 3 })
  })
})
