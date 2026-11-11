import { describe, expect, it } from 'vitest'
import { foldMap, runCurrentAction, runResultSummary } from './fold'
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

describe('live tool descriptions', () => {
  it('names the current observed action and target within a folded run', () => {
    const items: ChatItem[] = [
      { kind: 'tool', id: 'a', name: 'read_file', status: 'done', args: { path: 'README.md' } },
      { kind: 'tool', id: 'b', name: 'web_search', status: 'done', args: { query: 'Hermes mobile docs' } },
      { kind: 'tool', id: 'c', name: 'web_search', status: 'running', args: { query: 'Hermes mobile docs' } }
    ]
    const run = foldMap(items, new Set()).get(0)
    expect(run && 'head' in run ? runCurrentAction(items, run.head) : '').toBe('Searching the web for Hermes mobile docs')
  })
  it('keeps Hermes-provided completion results in the folded summary', () => {
    const items: ChatItem[] = [
      { kind: 'tool', id: 'a', name: 'read_file', status: 'done' },
      { kind: 'tool', id: 'b', name: 'search_files', status: 'done' },
      { kind: 'tool', id: 'c', name: 'web_search', status: 'done', summary: 'Found 4 relevant pages' }
    ]
    const run = foldMap(items, new Set()).get(0)
    expect(run && 'head' in run ? runResultSummary(run.head) : '').toBe('Found 4 relevant pages')
  })
})
