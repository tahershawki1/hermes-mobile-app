import { useEffect, useRef } from 'react'
import { runLazy } from '../lazy'
import type { PresenceInkApi } from '../../presence-ink-entry'

/** Lazy, optional ink wash behind the large Hermes face. */
export function PresenceInk({ active = false }: { active?: boolean }) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = host.current
    if (!root || typeof window === 'undefined') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let disposed = false
    let instance: { remove: () => void } | null = null
    const loader = import.meta.env.DEV
      ? import('../../presence-ink-entry').then(m => m.default)
      : runLazy<PresenceInkApi>('hm-presence-ink', '__hmPresenceInk')
    void loader.then(api => {
      if (!disposed && root) instance = api.mount(root, active)
    }).catch(() => undefined)
    return () => {
      disposed = true
      instance?.remove()
    }
  }, [active])

  return <span ref={host} className="hm-presence-ink" aria-hidden="true" />
}
