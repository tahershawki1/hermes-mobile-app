import { useSyncExternalStore } from 'react'
import type { Root, Element, ElementContent } from 'hast'
import { visit } from 'unist-util-visit'
import './text-direction.css'

export type TextDirection = 'auto' | 'rtl' | 'ltr'
const KEY = 'hm.textDirection.v1'
export const validDirection = (value: unknown): TextDirection => value === 'rtl' || value === 'ltr' ? value : 'auto'
let direction: TextDirection = 'auto'
try { direction = validDirection(localStorage.getItem(KEY)) } catch { /* storage unavailable */ }
const listeners = new Set<() => void>()
export function setTextDirection(value: string) {
  direction = validDirection(value)
  try { localStorage.setItem(KEY, direction) } catch { /* keep the in-memory choice */ }
  listeners.forEach(fn => fn())
}
export function useTextDirection() {
  return useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn) } }, () => direction)
}

// Run after sanitizing: direction belongs to the reader, not to supplied HTML.
const blocks = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'th', 'td', 'dt', 'dd', 'summary', 'figcaption'])
function readableText(node: Element | ElementContent): string {
  if (node.type === 'text') return node.value
  if (node.type !== 'element' || ['code', 'pre', 'a'].includes(node.tagName)) return ''
  return node.children.map(readableText).join('')
}
function containerDirection(node: Element): TextDirection {
  const firstLetter = readableText(node).match(/\p{Letter}/u)?.[0]
  if (!firstLetter) return 'auto'
  return /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff\u{10e80}-\u{10fff}\u{1ee00}-\u{1eeff}]/u.test(firstLetter) ? 'rtl' : 'ltr'
}
export function rehypeTextDirection(options: { direction: TextDirection }) {
  return (tree: Root) => {
    visit(tree, 'element', node => {
      // dir=auto skips descendants that have their own dir. Loose-list paragraphs need
      // an explicit direction on their parent too, so markers and checkbox gutters agree.
      if (blocks.has(node.tagName)) node.properties.dir = options.direction === 'auto' && ['li', 'blockquote'].includes(node.tagName) ? containerDirection(node) : options.direction
      if (node.tagName === 'pre' || node.tagName === 'code') node.properties.dir = 'ltr'
      if (node.tagName === 'a') node.properties.dir = 'auto'
    })
  }
}
