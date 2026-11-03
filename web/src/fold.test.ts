import { describe, expect, it } from 'vitest'
import { foldMap } from './fold'
import type { ChatItem } from './store'

const tool = (id: string, status: 'done' | 'running'): ChatItem => ({
  kind: 'tool', id, name: 'terminal', status
})

describe('terminal visibility', () => {
  it('keeps the running tool visible while folding completed tools', () => {
    const items = [tool('a', 'done'), tool('b', 'done'), tool('c', 'running')]
    const folds = foldMap(items, new Set())
    expect(folds.get(0)).toMatchObject({ open: true, hidden: false })
    expect(folds.get(1)).toEqual({ hidden: true })
    expect(folds.get(2)).toBeUndefined()
  })
  it('folds completed tool groups unless explicitly opened', () => {
    const items = [tool('a', 'done'), tool('b', 'done'), tool('c', 'done')]
    expect(foldMap(items, new Set()).get(1)).toEqual({ hidden: true })
    expect(foldMap(items, new Set(['a'])).get(1)).toBeUndefined()
  })
})
