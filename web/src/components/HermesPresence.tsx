import './HermesPresenceLive.css'

/** Expressive status indicator driven by observed session/task state, not private model reasoning. */
export type PresenceState = 'idle' | 'thinking' | 'working' | 'success' | 'failed' | 'blocked'
export function HermesPresence({ state = 'idle', size = 'small' }: {
  state?: PresenceState
  size?: 'small' | 'large'
}) {
  return (
    <span className={`hm-presence ${size} ${state} hm-face-live`} role="img" aria-label={`Hermes: ${state}`}>
      <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <circle className="hm-presence-halo" cx="32" cy="32" r="29" />
        <circle className="hm-presence-face" cx="32" cy="32" r="25" />
        <path className="hm-presence-brow" d="M17 26 Q22 22 27 26 M37 26 Q42 22 47 26" />
        <g className="hm-face-eyes">
          <circle className="hm-presence-eye" cx="23" cy="30" r="2.4" />
          <circle className="hm-presence-eye" cx="41" cy="30" r="2.4" />
        </g>
        <path className="hm-presence-smile" d={state === 'failed' ? 'M23 43 Q32 35 41 43' : state === 'thinking' ? 'M26 41 L38 41' : 'M23 39 Q32 48 41 39'} />
        <circle className="hm-presence-spark" cx="47" cy="16" r="3.3" />
      </svg>
    </span>
  )
}

export function WorkingPresence() {
  return (
    <div className="hm-working-presence" role="status" aria-label="Hermes is working">
      <HermesPresence state="thinking" />
    </div>
  )
}
