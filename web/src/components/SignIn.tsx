// Subscription status shared by every provider, plus signing in to Claude (Pro / Max) in the app.
//
// Hermes's dashboard has no Claude sign-in of its own (only `hermes auth add anthropic` in a terminal), so the app
// uses the Hermes Mobile plugin's /claude-login routes: the same PKCE login, split in two (claude_login.py). The user
// opens claude.ai in the browser, signs in, copies the code Claude shows and pastes it here. Termux stays as the
// fallback (older plugin, or the user prefers it).
//
// Hermes's /api/providers/oauth can miss a login that is valid in the credential pool (depending on the provider
// build). The pool (/api/credentials/pool) is therefore the fallback source of truth for every OAuth provider.
import { useEffect, useRef, useState } from 'react'
import { api, qs } from '../api'
import { haptic, openExternal } from '../bridge'
import { errText, loadDefaultModel, rpc } from '../gateway'
import { toast } from '../store'
import { invalidateModelOptions } from '../model-options-cache'
import { Sheet } from './Screens'
import { Spinner } from './Spinner'

/** One credential in a provider's pool, as Hermes lists it (redacted: a preview, never the token). */
export interface PoolEntry {
  /** 1-based position, as `DELETE /api/credentials/pool/<provider>/<index>` takes it. */
  index?: number
  id?: string
  label?: string
  auth_type?: string
  source?: string
  priority?: number
  /** null / "ok", "exhausted" (cooling down after a rate limit or empty credit), "dead" (its login was revoked). */
  last_status?: string | null
  request_count?: number
  token_preview?: string
  has_refresh?: boolean
}
interface PoolAnswer {
  providers?: { provider: string; entries?: PoolEntry[] }[]
}
interface Status {
  logged_in?: boolean
  source?: string | null
  source_label?: string | null
  shared_from_profile?: string | null
  free_tier?: boolean
}

/** The profile's credential pool (redacted by Hermes: labels and sources, never tokens). Empty when unavailable. */
export const loadPool = (profile: string): Promise<Record<string, PoolEntry[]>> =>
  api<PoolAnswer>('GET', `/api/credentials/pool?${qs({ profile })}`, undefined, { profile: false })
    .then(r => Object.fromEntries((r?.providers || []).map(p => [p.provider, p.entries || []])))
    .catch(() => ({}))

/** Any OAuth subscription login Hermes will use. Provider-owned CLI logins keep their own card and API keys do not count. */
const subscriptionLogin = (provider: string, pool: Record<string, PoolEntry[]>) =>
  (pool[provider] || []).find(e => e.auth_type === 'oauth' && !(provider === 'anthropic' && e.source === 'claude_code'))

/** Fills in "signed in" when Hermes's account list misses a valid OAuth subscription in the credential pool. */
export function withPoolStatus<P extends { id: string; status?: Status }>(providers: P[], pool: Record<string, PoolEntry[]>): P[] {
  return providers.map(p => {
    if (p.status?.logged_in) return p
    const e = subscriptionLogin(p.id, pool)
    return e ? { ...p, status: { ...p.status, logged_in: true, source: 'credential_pool', source_label: e.label || null } } : p
  })
}

/**
 * Named bots have their own auth.json, but Hermes deliberately falls back to the main profile for
 * single-use OAuth grants (copying a refresh token would strand one copy after the first refresh).
 * Reflect that runtime behaviour in the UI without sharing API-key pool entries between bots.
 */
export function withSharedSubscriptionStatus<P extends { id: string; status?: Status }>(
  providers: P[],
  pool: Record<string, PoolEntry[]>,
  mainProviders: P[],
  mainPool: Record<string, PoolEntry[]>,
  mainProfile = 'default'
): P[] {
  const own = withPoolStatus(providers, pool)
  const shared = new Map(withPoolStatus(mainProviders, mainPool).map(p => [p.id, p]))
  return own.map(p => {
    if (p.status?.logged_in) return p
    const account = shared.get(p.id)
    if (!account?.status?.logged_in || account.status.free_tier === true) return p
    const label = account.status.source_label?.trim()
    return {
      ...p,
      status: {
        ...p.status,
        ...account.status,
        logged_in: true,
        source: 'shared_profile',
        source_label: label ? `Main profile · ${label}` : 'Main profile',
        shared_from_profile: mainProfile
      }
    }
  })
}

/** After a new login: the default model, and the live model list once so the new models show up in the pickers. */
export function afterSignIn(profile = 'default'): void {
  invalidateModelOptions(profile)
  void loadDefaultModel()
  void rpc('model.options', { refresh: true }).catch(() => {})
}

interface Start {
  session_id: string
  url: string
}

/** In-app Claude sign-in: open claude.ai, paste the code back, done. `onTermux` = do it in Termux instead. */
export function ClaudeSignInSheet({ profile, onClose, onDone, onTermux }: { profile: string; onClose: () => void; onDone: () => void; onTermux: () => void }) {
  const [start, setStart] = useState<Start | null>(null)
  const [unavailable, setUnavailable] = useState('')
  const [err, setErr] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [round, setRound] = useState(0) // "Start again" makes a new link (a code works once)
  const sid = useRef('')
  const done = useRef(false)

  useEffect(() => {
    let alive = true
    setStart(null)
    setErr('')
    setCode('')
    api<Start>('POST', `/api/plugins/hermes-mobile/claude-login/start?${qs({ profile })}`, {}, { profile: false })
      .then(s => {
        if (!alive) return
        sid.current = s.session_id
        setStart(s)
      })
      .catch(e => alive && setUnavailable(errText(e)))
    return () => {
      alive = false
      // Closed or restarted before it finished: let the plugin forget the half-done sign-in now (it expires anyway).
      if (sid.current && !done.current) void api('POST', '/api/plugins/hermes-mobile/claude-login/cancel', { session_id: sid.current }, { profile: false }).catch(() => {})
      sid.current = ''
    }
  }, [profile, round])

  const submit = () => {
    if (!start || busy) return
    haptic()
    setBusy(true)
    setErr('')
    api<{ ok: boolean; label?: string }>('POST', `/api/plugins/hermes-mobile/claude-login/finish?${qs({ profile })}`, { session_id: start.session_id, code: code.trim() }, { profile: false })
      .then(() => {
        done.current = true
        toast('Signed in to Claude. Its models are in the model menu now.')
        onDone()
      })
      .catch(e => {
        const msg = errText(e)
        setErr(msg)
        // An expired or used-up sign-in can't take another code: offer a fresh one.
        if (/Start again/i.test(msg)) sid.current = ''
      })
      .finally(() => setBusy(false))
  }
  const restart = /Start again/i.test(err)

  return (
    <Sheet title="Sign in to Claude" onClose={onClose}>
      <div className="sheet-scroll">
        {unavailable ? (
          <>
            <div className="notice notice-warn">Hermes Mobile can’t do this sign-in in the app here ({unavailable}). Sign in with Termux instead: it runs the same login.</div>
            <button className="btn primary block" onClick={onTermux}>
              Sign in with Termux
            </button>
          </>
        ) : !start ? (
          <div className="device-wait dim small">
            <Spinner small /> Asking Hermes for a sign-in link…
          </div>
        ) : (
          <div className="device-login">
            <div className="dim small">1. Sign in on claude.ai with your Pro or Max account and allow access</div>
            <button
              className="btn primary block"
              onClick={() => {
                haptic()
                openExternal(start.url)
              }}
            >
              Open claude.ai
            </button>
            <div className="dim small">2. Claude shows a code. Copy it, come back and paste it here</div>
            <label className="field">
              <span>Code from Claude</span>
              <input
                className="mono"
                type="text"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={code}
                onChange={e => setCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder="Paste the code here"
              />
            </label>
            {err && <div className="notice notice-error">{err}</div>}
            {restart ? (
              <button className="btn block" onClick={() => setRound(r => r + 1)}>
                Start again
              </button>
            ) : (
              <button className="btn primary block" disabled={busy || !code.trim()} onClick={submit}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            )}
            <div className="dim small">Hermes saves the login on this phone, like `hermes auth add anthropic` does. The code works once and only for 10 minutes.</div>
            <button className="btn block" onClick={onTermux}>
              Use Termux instead
            </button>
          </div>
        )}
      </div>
    </Sheet>
  )
}
