/** A small expressive face for the chat, drawn with theme colours and no image downloads.
 * All movement is CSS-only and runs while Hermes is working, never as a background timer.
 */
export function HermesPresence({ state = 'idle', size = 'small' }: {
  state?: 'idle' | 'thinking'
  size?: 'small' | 'large'
}) {
  return (
    <span className={`hm-presence ${size} ${state}`} aria-hidden="true">
      <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <circle className="hm-presence-halo" cx="32" cy="32" r="29" />
        <circle className="hm-presence-face" cx="32" cy="32" r="25" />
        <path className="hm-presence-brow" d="M17 26 Q22 22 27 26 M37 26 Q42 22 47 26" />
        <circle className="hm-presence-eye" cx="23" cy="30" r="2.4" />
        <circle className="hm-presence-eye" cx="41" cy="30" r="2.4" />
        <path className="hm-presence-smile" d="M23 39 Q32 48 41 39" />
        <circle className="hm-presence-spark" cx="47" cy="16" r="3.3" />
      </svg>
    </span>
  )
}

/** A single unobtrusive working row, shown only until a visible assistant reply starts. */
export function WorkingPresence() {
  return (
    <div className="hm-working-presence" role="status" aria-label="Hermes is working">
      <HermesPresence state="thinking" />
      <span>Hermes is on it</span>
      <span className="hm-typing" aria-hidden="true"><i /><i /><i /></span>
    </div>
  )
}
