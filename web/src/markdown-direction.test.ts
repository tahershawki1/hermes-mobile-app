// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { Markdown } from './components/Markdown'
import { setTextDirection } from './text-direction'

describe('direction survives the Markdown component boundary', () => {
  it('keeps URL-shaped inline code LTR inside Arabic prose', () => {
    setTextDirection('auto')
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const host = document.createElement('div')
    const root = createRoot(host)
    try {
      act(() => root.render(createElement(Markdown, { text: '`https://example.com/docs` ده رابط عربي' })))
      const code = host.querySelector('code')
      expect(code?.getAttribute('dir')).toBe('ltr')
      expect(code?.textContent).toBe('https://example.com/docs')
      expect(host.querySelector('p')?.getAttribute('dir')).toBe('auto')
    } finally {
      act(() => root.unmount())
      delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    }
  })

  it('keeps inline code explicitly LTR so auto-direction prose skips its English prefix', () => {
    setTextDirection('auto')
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const host = document.createElement('div')
    const root = createRoot(host)
    try {
      act(() => root.render(createElement(Markdown, { text: '- `Hermes` ده عنصر عربي\n\n- عنصر آخر\n\n> `API` هذا اقتباس عربي' })))
      const codes = Array.from(host.querySelectorAll('code'))
      expect(codes).toHaveLength(2)
      expect(codes.map(code => code.getAttribute('dir'))).toEqual(['ltr', 'ltr'])
      expect(host.querySelector('li')?.getAttribute('dir')).toBe('rtl')
      expect(host.querySelector('blockquote')?.getAttribute('dir')).toBe('rtl')
      expect(host.querySelector('li p')?.getAttribute('dir')).toBe('auto')
      expect(codes.map(code => code.textContent)).toEqual(['Hermes', 'API'])
    } finally {
      act(() => root.unmount())
      delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    }
  })
})
