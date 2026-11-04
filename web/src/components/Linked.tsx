import { useTextDirection } from '../text-direction'
import { Fragment } from 'react'
import { haptic, openExternal } from '../bridge'
import { linkParts } from '../text'

/** Plain text whose web addresses open with the phone's default handler (browser, or the app that owns the link). */
export function Linked({ text }: { text: string }) {
  const direction = useTextDirection()
  return (
    <span className="plain-text" dir={direction}>
      {text.split('\n').map((line, lineIndex, lines) => (
        <Fragment key={lineIndex}>
          <span className="plain-line" dir={direction}>
            {linkParts(line).map((p, i) =>
              p.href ? (
                <a
                  key={i}
                  href={p.href}
                  dir="auto"
                  className="auto-link"
                  onClick={e => {
                    // The message bubble's own tap shows the time; a link tap must only open the link.
                    e.preventDefault()
                    e.stopPropagation()
                    haptic()
                    openExternal(p.href!)
                  }}
                >
                  {p.text}
                </a>
              ) : (
                <Fragment key={i}>{p.text}</Fragment>
              )
            )}
          </span>
          {lineIndex < lines.length - 1 ? '\n' : null}
        </Fragment>
      ))}
    </span>
  )
}
