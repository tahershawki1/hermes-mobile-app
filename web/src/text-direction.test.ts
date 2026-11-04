import { describe, expect, it } from 'vitest'
import type { Root, Element } from 'hast'
import { rehypeTextDirection, validDirection } from './text-direction'

describe('text direction', () => {
  it('defaults to automatic for absent or invalid saved preferences', () => {
    for (const value of [null, '', 'auto', 'invalid']) expect(validDirection(value)).toBe('auto')
    expect(validDirection('rtl')).toBe('rtl')
    expect(validDirection('ltr')).toBe('ltr')
  })
  it.each(['auto', 'rtl', 'ltr'] as const)('sets reader direction %s without rewriting mixed text', direction => {
    const text = 'قبل Hermes بعد 123 https://example.com'
    const tags = ['p', 'li', 'th', 'td', 'blockquote', 'h2', 'code', 'pre', 'a']
    const tree: Root = { type: 'root', children: tags.map(tagName => ({ type: 'element', tagName, properties: { dir: 'rtl' }, children: [{ type: 'text', value: text }] })) }
    rehypeTextDirection({ direction })(tree)
    for (const node of tree.children as Element[]) {
      expect(node.properties.dir).toBe(['code', 'pre'].includes(node.tagName) ? 'ltr' : node.tagName === 'a' ? 'auto' : direction === 'auto' && ['li', 'blockquote'].includes(node.tagName) ? 'rtl' : direction)
      expect(node.children).toEqual([{ type: 'text', value: text }])
    }
  })
  it('sets loose-list marker direction independently of directed child paragraphs', () => {
    const tree: Root = { type: 'root', children: ['مهمة عربية', 'English task'].map(value => ({ type: 'element', tagName: 'li', properties: {}, children: [{ type: 'element', tagName: 'p', properties: {}, children: [{ type: 'text', value }] }] })) }
    rehypeTextDirection({ direction: 'auto' })(tree)
    expect((tree.children as Element[]).map(n => n.properties.dir)).toEqual(['rtl', 'ltr'])
    expect((tree.children as Element[]).map(n => (n.children[0] as Element).properties.dir)).toEqual(['auto', 'auto'])
  })
})
