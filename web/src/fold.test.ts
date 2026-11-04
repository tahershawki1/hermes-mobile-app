import { describe, expect, it } from 'vitest'
import { foldMap } from './fold'
import type { ChatItem } from './store'

const tool = (id: string, status: 'done' | 'running'): ChatItem => ({
  kind: 'tool', id, name: 'terminal', status
})

describe('terminal visibility', () => {
  it('keeps an entire terminal run inside its single live transcript', () => {
    const items = [tool('a', 'done'), tool('b', 'done'), tool('c', 'running')]
    const folds = foldMap(items, new Set())
    expect(folds.get(0)).toMatchObject({ open: true, hidden: false })
    expect(folds.get(1)).toEqual({ hidden: true })
    expect(folds.get(2)).toEqual({ hidden: true })
  })
  it('folds completed tool groups unless explicitly opened', () => {
    const items = [tool('a', 'done'), tool('b', 'done'), tool('c', 'done')]
    expect(foldMap(items, new Set()).get(1)).toEqual({ hidden: true })
    expect(foldMap(items, new Set(['a'])).get(1)).toBeUndefined()
  })
  it('keeps terminal transcripts separate from other tool cards', () => {
    const items: ChatItem[] = [
      tool('term-a', 'done'),
      { kind: 'tool', id: 'read', name: 'read_file', status: 'done' },
      tool('term-b', 'done')
    ]
    const folds = foldMap(items, new Set())
    expect(folds.get(0)).toMatchObject({ head: { names: ['terminal'] }, hidden: false })
    expect(folds.get(1)).toBeUndefined()
    expect(folds.get(2)).toMatchObject({ head: { names: ['terminal'] }, hidden: false })
  })
})
