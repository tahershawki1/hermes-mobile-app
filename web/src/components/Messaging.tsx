import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { haptic } from '../bridge'
import { confirmDialog } from '../dialog'
import { navigationText } from '../navigation'
import { toast, useStore } from '../store'
import { LoadError, ScreenShell, Status } from './Screens'

type MessagingField = {
  key: string
  prompt: string
  description?: string
  required: boolean
  is_set: boolean
  is_password: boolean
  is_list?: boolean
  value?: string | null
  url?: string | null
}
type MessagingPlatform = {
  id: string
  name: string
  description: string
  docs_url?: string
  enabled: boolean
  configured: boolean
  gateway_running: boolean
  state?: string | null
  error_message?: string | null
  env_vars: MessagingField[]
}
type PlatformTest = { ok: boolean; state?: string | null; message: string }
type MessagingList = { platforms: MessagingPlatform[] }

const CHANNELS = new Set(['telegram', 'discord', 'slack'])
const STATUS: Record<string, [string, string, string]> = {
  connected: ['Connected', 'متصل', 'ok'],
  disabled: ['Disabled', 'متوقف', 'dim'],
  not_configured: ['Needs setup', 'يحتاج إعداداً', 'warn'],
  pending_restart: ['Restart needed', 'يحتاج إعادة تشغيل', 'warn'],
  gateway_stopped: ['Gateway stopped', 'البوابة متوقفة', 'warn'],
  startup_failed: ['Startup failed', 'فشل التشغيل', 'err'],
  disconnected: ['Disconnected', 'غير متصل', 'err'],
  fatal: ['Error', 'خطأ', 'err']
}

function ChannelState({ platform }: { platform: MessagingPlatform }) {
  const state = platform.state || (platform.enabled ? 'pending_restart' : 'disabled')
  const label = STATUS[state] || [state.replace(/_/g, ' '), state.replace(/_/g, ' '), 'dim']
  return <span className={`hm-channel-state ${label[2]}`} role="status"><span className={`conn-dot ${label[2]}`} />{navigationText(label[0], label[1])}</span>
}

export function MessagingScreen() {
  const profile = useStore(s => s.profile)
  const [platforms, setPlatforms] = useState<MessagingPlatform[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState('')
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({})
  const [clears, setClears] = useState<Record<string, string[]>>({})
  const [busy, setBusy] = useState('')
  const [tests, setTests] = useState<Record<string, PlatformTest>>({})
  const [restartNeeded, setRestartNeeded] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api<MessagingList>('GET', '/api/messaging/platforms')
      setPlatforms((result.platforms || []).filter(p => CHANNELS.has(p.id)))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => { void refresh() }, [refresh])

  const setDraft = (platform: string, key: string, value: string) => {
    setDrafts(current => ({ ...current, [platform]: { ...(current[platform] || {}), [key]: value } }))
    setClears(current => ({ ...current, [platform]: (current[platform] || []).filter(k => k !== key) }))
  }

  const save = async (platform: MessagingPlatform) => {
    const draft = drafts[platform.id] || {}
    const env = Object.fromEntries(Object.entries(draft).filter(([key, value]) =>
      value.trim() && !clears[platform.id]?.includes(key)))
    const clear_env = clears[platform.id] || []
    if (!Object.keys(env).length && !clear_env.length) return
    setBusy(`save:${platform.id}`)
    try {
      const result = await api<{ hot_served?: boolean }>('PUT', `/api/messaging/platforms/${encodeURIComponent(platform.id)}`, { env, clear_env })
      setDrafts(current => ({ ...current, [platform.id]: {} }))
      setClears(current => ({ ...current, [platform.id]: [] }))
      setRestartNeeded(!result.hot_served)
      toast(result.hot_served ? `${platform.name}: ${navigationText('updated live', 'تم التحديث مباشرة')}` : `${platform.name}: ${navigationText('saved. Restart the gateway to apply.', 'تم الحفظ. أعد تشغيل البوابة للتطبيق')}`, 'info')
      await refresh()
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy('')
    }
  }

  const toggle = async (platform: MessagingPlatform) => {
    const enabled = !platform.enabled
    setBusy(`toggle:${platform.id}`)
    try {
      const result = await api<{ hot_served?: boolean }>('PUT', `/api/messaging/platforms/${encodeURIComponent(platform.id)}`, { enabled })
      setRestartNeeded(!result.hot_served)
      toast(`${platform.name}: ${navigationText(enabled ? 'enabled' : 'disabled', enabled ? 'مفعّل' : 'متوقف')}${result.hot_served ? ` — ${navigationText('live', 'مباشرة')}` : ` — ${navigationText('restart the gateway to apply', 'أعد تشغيل البوابة للتطبيق')}`}`, 'info')
      await refresh()
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy('')
    }
  }

  const test = async (platform: MessagingPlatform) => {
    setBusy(`test:${platform.id}`)
    try {
      const result = await api<PlatformTest>('POST', `/api/messaging/platforms/${encodeURIComponent(platform.id)}/test`)
      setTests(current => ({ ...current, [platform.id]: result }))
      toast(result.message, result.ok ? 'info' : 'error')
      await refresh()
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy('')
    }
  }

  const restart = async () => {
    if (!(await confirmDialog({ title: navigationText('Restart messaging gateway?', 'إعادة تشغيل بوابة المراسلة؟'), message: navigationText('This briefly disconnects messaging channels while Hermes restarts.', 'ستنفصل قنوات المراسلة مؤقتاً أثناء إعادة تشغيل Hermes.'), confirmLabel: navigationText('Restart', 'إعادة التشغيل') }))) return
    setBusy('restart')
    try {
      await api('POST', '/api/gateway/restart')
      setRestartNeeded(false)
      toast(navigationText('Gateway restart started', 'بدأت إعادة تشغيل البوابة'), 'info')
      window.setTimeout(() => void refresh(), 5000)
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy('')
    }
  }

  return (
    <ScreenShell title={navigationText('Messaging channels', 'قنوات المراسلة')} className="hm-messaging-screen" actions={<button className="icon-btn" aria-label={navigationText('Refresh channels', 'تحديث القنوات')} onClick={() => { haptic(); void refresh() }}>↻</button>}>
      <div className="hm-messaging-body">
        <p className="dim">{navigationText('View channel health, set credentials and test Telegram, Discord or Slack. Credentials are masked after saving.', 'تابع حالة القنوات واضبط بيانات الدخول واختبر Telegram أو Discord أو Slack. تُخفى بيانات الدخول بعد الحفظ.')}</p>
        {restartNeeded && <div className="hm-messaging-restart" role="status"><span>{navigationText('Saved channel changes need a gateway restart.', 'تغييرات القناة المحفوظة تحتاج إلى إعادة تشغيل البوابة.')}</span><button className="btn primary" disabled={busy === 'restart'} onClick={() => void restart()}>{busy === 'restart' ? navigationText('Restarting…', 'جارٍ إعادة التشغيل…') : navigationText('Restart gateway', 'إعادة تشغيل البوابة')}</button></div>}
        {error && <LoadError error={error} onRetry={() => void refresh()} />}
        <Status loading={loading} error="" empty={!platforms.length} emptyText={navigationText('No supported messaging channels are available in this engine version.', 'لا توجد قنوات مراسلة مدعومة في إصدار المحرك الحالي.')} />
        <div className="hm-channel-list">
          {platforms.map(platform => {
            const expanded = open === platform.id
            const draft = drafts[platform.id] || {}
            const clear = clears[platform.id] || []
            const result = tests[platform.id]
            return <article className="hm-channel-card" key={platform.id}>
              <div className="hm-channel-head">
                <button className="hm-channel-expand" onClick={() => setOpen(expanded ? '' : platform.id)} aria-expanded={expanded}>
                  <span><strong>{platform.name}</strong><small>{platform.description}</small></span>
                  <ChannelState platform={platform} />
                </button>
                <button className="btn" disabled={busy === `toggle:${platform.id}`} onClick={() => void toggle(platform)}>{busy === `toggle:${platform.id}` ? navigationText('Saving…', 'جارٍ الحفظ…') : platform.enabled ? navigationText('Turn off', 'إيقاف') : navigationText('Turn on', 'تشغيل')}</button>
              </div>
              {platform.error_message && <p className="hm-channel-error">{platform.error_message}</p>}
              {expanded && <div className="hm-channel-details">
                {platform.env_vars.map(field => {
                  const value = draft[field.key] ?? (field.is_list ? field.value || '' : '')
                  const cleared = clear.includes(field.key)
                  return <label className="hm-channel-field" key={field.key}>
                    <span className="hm-channel-field-title">{field.prompt || field.key}{field.required && <em>Required</em>}</span>
                    {field.description && <small>{field.description}</small>}
                    <div className="hm-channel-input-wrap">
                      <input className="sheet-input" type={field.is_password ? 'password' : 'text'} value={cleared ? '' : value}
                        placeholder={field.is_set && field.is_password ? navigationText('Saved securely', 'محفوظ بأمان') : field.is_list ? navigationText('Comma-separated IDs', 'معرّفات مفصولة بفواصل') : field.key}
                        autoCapitalize="none" autoCorrect="off" spellCheck={false}
                        onChange={e => setDraft(platform.id, field.key, e.target.value)} />
                      {field.is_set && <button className="btn" onClick={async () => {
                        if (await confirmDialog({ title: `Clear ${field.prompt || field.key}?`, message: 'The saved value will be removed from the Hermes profile.', confirmLabel: 'Clear', danger: true })) {
                          setClears(current => ({ ...current, [platform.id]: [...new Set([...(current[platform.id] || []), field.key])]}))
                          setDrafts(current => ({ ...current, [platform.id]: { ...(current[platform.id] || {}), [field.key]: '' } }))
                        }
                        }}>{cleared ? navigationText('Will clear', 'سيُحذف') : navigationText('Clear', 'حذف')}</button>}
                    </div>
                  </label>
                })}
                {result && <div className={`hm-channel-test ${result.ok ? 'ok' : 'err'}`} role="status">{result.message}</div>}
                <div className="hm-channel-actions">
                  <button className="btn primary" disabled={busy === `save:${platform.id}`} onClick={() => void save(platform)}>{busy === `save:${platform.id}` ? navigationText('Saving…', 'جارٍ الحفظ…') : navigationText('Save setup', 'حفظ الإعداد')}</button>
                  <button className="btn" disabled={busy === `test:${platform.id}`} onClick={() => void test(platform)}>{busy === `test:${platform.id}` ? navigationText('Testing…', 'جارٍ الاختبار…') : navigationText('Test connection', 'اختبار الاتصال')}</button>
                  {platform.docs_url && <a className="btn" href={platform.docs_url} target="_blank" rel="noreferrer">{navigationText('Setup guide', 'دليل الإعداد')}</a>}
                </div>
              </div>}
            </article>
          })}
        </div>
      </div>
    </ScreenShell>
  )
}
