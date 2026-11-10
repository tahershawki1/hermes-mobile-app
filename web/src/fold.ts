import type { ChatItem } from './store'

/** A run of tool calls folded into one "Ran N tools" line. Reasoning-only replies between the calls belong to it. */
export interface ToolRun {
  /** Index of the run's first item (the row that shows the header) and one past its last. */
  start: number
  end: number
  tools: number
  /** Summed tool durations, seconds. */
  secs: number
  errors: number
  running: boolean
  /** Distinct tool names, in order of first use. */
  names: string[]
  /** Number of calls for each tool, kept in first-use order by `names`. */
  counts: Record<string, number>
}

/** Fewer calls than this stay as plain cards. */
export const FOLD_MIN = 3

const inRun = (it: ChatItem) => it.kind === 'tool' || (it.kind === 'assistant' && !it.text.trim() && !it.error && !it.warning)

/** Runs of at least FOLD_MIN tool calls with nothing but tool calls and reasoning between them. */
export function toolRuns(items: ChatItem[]): ToolRun[] {
  const runs: ToolRun[] = []
  let i = 0
  while (i < items.length) {
    if (items[i].kind !== 'tool') {
      i++
      continue
    }
    let j = i
    let last = i
    const terminalOnly = (items[i] as Extract<ChatItem, { kind: 'tool' }>).name === 'terminal'
    while (j < items.length && inRun(items[j])) {
      const current = items[j]
      if (current.kind === 'tool') {
        // Keep terminal transcripts separate from ordinary tool cards, even inside a longer tool run.
        if ((current.name === 'terminal') !== terminalOnly) break
        last = j
      }
      j++
    }
    const end = last + 1 // a reasoning-only reply after the last call belongs to the next text, not the run
    const tools = items.slice(i, end).filter((x): x is Extract<ChatItem, { kind: 'tool' }> => x.kind === 'tool')
    if (tools.length >= FOLD_MIN || tools.length > 0 && tools.every(t => t.name === 'terminal')) {
      const counts: Record<string, number> = {}
      for (const tool of tools) counts[tool.name] = (counts[tool.name] || 0) + 1
      runs.push({
        start: i,
        end,
        tools: tools.length,
        secs: tools.reduce((s, t) => s + (t.duration || 0), 0),
        errors: tools.filter(t => t.status === 'error').length,
        running: tools.some(t => t.status === 'running' || t.status === 'generating'),
        names: [...new Set(tools.map(t => t.name))],
        counts
      })
    }
    i = end
  }
  return runs
}

export type Fold = { head: ToolRun; open: boolean; hidden: boolean } | { hidden: true }

/** How each item index draws: the run's first item carries the header; the rest hide while the run is closed.
 * A run still working keeps its last item visible, so the live call shows. */
export function foldMap(items: ChatItem[], open: ReadonlySet<string>): Map<number, Fold> {
  const out = new Map<number, Fold>()
  for (const r of toolRuns(items)) {
    // Keep active commands visible even when the run would normally collapse.
    const isOpen = open.has(items[r.start].id)
    const terminalOnly = r.names.length === 1 && r.names[0] === 'terminal'
    for (let k = r.start; k < r.end; k++) {
      const hidden = !isOpen && (terminalOnly ? k !== r.start : !(r.running && (k === r.start || k === r.end - 1)))
      if (k === r.start) out.set(k, { head: r, open: isOpen || r.running, hidden })
      else if (hidden) out.set(k, { hidden: true })
    }
  }
  return out
}

/** "Ran 7 tools · 42s", "Running 4 tools…". */
export function runLabel(r: ToolRun): string {
  const n = `${r.tools} tool${r.tools === 1 ? '' : 's'}`
  if (r.running) return `Running ${n}…`
  const t = r.secs >= 60 ? `${Math.floor(r.secs / 60)}m ${Math.round(r.secs % 60)}s` : r.secs >= 1 ? `${Math.round(r.secs)}s` : ''
  return `Ran ${n}${t ? ` · ${t}` : ''}`
}

const ACTIONS: Record<string, { one: string; many: string; verb: string }> = {
  terminal: { one: 'command', many: 'commands', verb: 'Ran' },
  execute_code: { one: 'code block', many: 'code blocks', verb: 'Ran' },
  read_file: { one: 'file', many: 'files', verb: 'Read' },
  search_files: { one: 'search', many: 'searches', verb: 'Searched' },
  write_file: { one: 'file', many: 'files', verb: 'Updated' },
  patch: { one: 'file', many: 'files', verb: 'Edited' },
  web_search: { one: 'web search', many: 'web searches', verb: 'Ran' },
  web_extract: { one: 'page', many: 'pages', verb: 'Read' },
  delegate_task: { one: 'subtask', many: 'subtasks', verb: 'Delegated' }
}

/** A useful summary for the compact activity line; raw tool names stay in the details panel. */
export function runSummary(r: ToolRun): string {
  return r.names.map(name => {
    const count = r.counts[name] || 0
    const action = ACTIONS[name]
    if (!action) return `${name.replaceAll('_', ' ')} ×${count}`
    return `${action.verb} ${count} ${count === 1 ? action.one : action.many}`
  }).join(' · ')
}
