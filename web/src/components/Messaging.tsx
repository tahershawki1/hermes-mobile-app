import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { api } from '../api'
import { haptic } from '../bridge'
import { confirmDialog } from '../dialog'
import { navigationText } from '../navigation'
import { toast, useStore } from '../store'
import { SelectRow } from './ui'
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
type WhatsAppSetupState = {
  pairing_id: string
  status: 'starting' | 'waiting' | 'connected' | 'error' | 'expired' | 'cancelled'
  qr_payload?: string | null
  pairing_code?: string | null
  expires_at?: string
  mode?: 'bot' | 'self-chat'
  pairing_method?: 'qr' | 'phone'
  allowed_users?: string
  account_phone?: string | null
  account_name?: string | null
  error?: string | null
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
  whatsapp_setup?: { mode?: string; allowed_users_set?: boolean; home_channel_set?: boolean }
}
type PlatformTest = { ok: boolean; state?: string | null; message: string }
type MessagingList = { platforms: MessagingPlatform[] }

const CHANNELS = new Set(['telegram', 'discord', 'slack', 'whatsapp'])
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
  const [whatsapp, setWhatsApp] = useState<WhatsAppSetupState | null>(null)
  const [whatsappQr, setWhatsAppQr] = useState('')
  const [whatsappMode, setWhatsAppMode] = useState<'bot' | 'self-chat'>('bot')
  const [whatsappPairingMethod, setWhatsAppPairingMethod] = useState<'phone' | 'qr'>('phone')
  const [whatsappPhone, setWhatsAppPhone] = useState('')
  const [linkedPhone, setLinkedPhone] = useState('')

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

  useEffect(() => {
    const session = whatsapp
    if (!session || !['starting', 'waiting'].includes(session.status)) return
    let active = true
    let timer: number | undefined
    const poll = async () => {
      try {
        const state = await api<WhatsAppSetupState>('GET', `/api/messaging/whatsapp/onboarding/${encodeURIComponent(session.pairing_id)}`)
        if (!active) return
        setWhatsApp(state)
        if (state.account_phone) setLinkedPhone(state.account_phone)
        if (['starting', 'waiting'].includes(state.status)) timer = window.setTimeout(() => void poll(), 1200)
      } catch (e) {
        if (active) setWhatsApp(current => current ? { ...current, status: 'error', error: e instanceof Error ? e.message : String(e) } : current)
      }
    }
    timer = window.setTimeout(() => void poll(), 1000)
    return () => { active = false; if (timer) window.clearTimeout(timer) }
  }, [whatsapp?.pairing_id, whatsapp?.status])

  useEffect(() => {
    let active = true
    if (!whatsapp?.qr_payload || whatsapp.status !== 'waiting') { setWhatsAppQr(''); return }
    void QRCode.toDataURL(whatsapp.qr_payload, { errorCorrectionLevel: 'M', margin: 2, width: 240 })
      .then(url => { if (active) setWhatsAppQr(url) })
      .catch(e => { if (active) setWhatsApp(previous => previous ? { ...previous, error: e instanceof Error ? e.message : String(e) } : previous) })
    return () => { active = false }
  }, [whatsapp?.qr_payload, whatsapp?.status])

  const startWhatsAppLink = async (resetSession = false) => {
    setBusy('whatsapp-link')
    try {
      const state = await api<WhatsAppSetupState>('POST', '/api/messaging/whatsapp/onboarding/start', {
        mode: whatsappMode, pairing_method: whatsappPairingMethod,
        phone_number: whatsappPairingMethod === 'phone' ? whatsappPhone : undefined,
        allowed_users: '', reset_session: resetSession
      })
      setWhatsApp(state)
      if (state.account_phone) setLinkedPhone(state.account_phone)
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy('')
    }
  }

  const cancelWhatsAppLink = async () => {
    if (!whatsapp) return
    setBusy('whatsapp-cancel')
    try {
      await api('DELETE', `/api/messaging/whatsapp/onboarding/${encodeURIComponent(whatsapp.pairing_id)}`)
      setWhatsApp(null)
      setWhatsAppQr('')
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy('')
    }
  }

  const applyWhatsAppLink = async () => {
    if (!whatsapp) return
    setBusy('whatsapp-apply')
    try {
      const result = await api<{ restart_started?: boolean; needs_restart?: boolean; restart_error?: string | null }>(
        'POST', `/api/messaging/whatsapp/onboarding/${encodeURIComponent(whatsapp.pairing_id)}/apply`,
        { mode: whatsappMode }
      )
      if (whatsapp.account_phone) setLinkedPhone(whatsapp.account_phone)
      setWhatsApp(null)
      setWhatsAppQr('')
      setRestartNeeded(Boolean(result.needs_restart || !result.restart_started))
      toast(result.restart_started ? navigationText('WhatsApp phone linked; gateway restart started.', 'تم ربط رقم واتساب وبدأت إعادة تشغيل البوابة.') : result.restart_error || navigationText('Phone linked. Restart the gateway to apply.', 'تم ربط الرقم. أعد تشغيل البوابة للتطبيق.'), 'info')
      await refresh()
      if (result.restart_started) window.setTimeout(() => void refresh(), 5000)
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy('')
    }
  }

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
        <p className="dim">{navigationText('View channel health, set credentials and test Telegram, Discord, Slack or WhatsApp. Credentials are masked after saving.', 'تابع حالة القنوات واضبط بيانات الدخول واختبر Telegram أو Discord أو Slack أو WhatsApp. تُخفى بيانات الدخول بعد الحفظ.')}</p>
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
                {platform.id === 'whatsapp' && <section className="hm-whatsapp-link" aria-label={navigationText('Link a WhatsApp phone', 'ربط رقم واتساب')}>
                  <div className="hm-whatsapp-link-head">
                    <strong>{navigationText('Connect a phone number', 'ربط رقم الهاتف')}</strong>
                    <p>{navigationText('Link WhatsApp by entering your phone number and typing the generated code in Linked devices. QR remains available as an alternative.', 'اربط واتساب بإدخال رقم الهاتف ثم كتابة الرمز الناتج في الأجهزة المرتبطة. ويمكنك استخدام QR كطريقة بديلة.')}</p>
                  </div>
                  {linkedPhone && <div className="hm-whatsapp-phone"><span>{navigationText('Linked phone', 'الهاتف المرتبط')}</span><bdi dir="ltr">{linkedPhone}</bdi></div>}
                  {!whatsapp && <>
                    <SelectRow title={navigationText('Pairing method', 'طريقة الربط')} options={[
                      { value: 'phone', label: navigationText('Phone number and code', 'رقم الهاتف ورمز الربط') },
                      { value: 'qr', label: navigationText('QR code', 'رمز QR') }
                    ]} value={whatsappPairingMethod} onChange={value => setWhatsAppPairingMethod(value as 'phone' | 'qr')} />
                    {whatsappPairingMethod === 'phone' && <label className="hm-channel-field">
                      <span className="hm-channel-field-title">{navigationText('WhatsApp phone number with country code', 'رقم واتساب مع مفتاح الدولة')}</span>
                      <input className="sheet-input" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" placeholder="+201234567890" value={whatsappPhone} onChange={e => setWhatsAppPhone(e.target.value)} />
                    </label>}
                    <SelectRow title={navigationText('Connection mode', 'طريقة الاتصال')} options={[
                      { value: 'bot', label: navigationText('Bot — receive messages from allowed contacts', 'بوت — استقبال الرسائل من جهات الاتصال المسموح بها') },
                      { value: 'self-chat', label: navigationText('Self-chat — use this linked phone for your own chats', 'محادثة ذاتية — استخدام الهاتف المرتبط لمحادثاتك') }
                    ]} value={whatsappMode} onChange={value => setWhatsAppMode(value as 'bot' | 'self-chat')} />
                    <div className="hm-channel-actions">
                      <button className="btn primary" disabled={busy === 'whatsapp-link' || (whatsappPairingMethod === 'phone' && whatsappPhone.replace(/\D/g, '').length < 8)} onClick={() => void startWhatsAppLink()}>{busy === 'whatsapp-link' ? navigationText('Starting…', 'جارٍ البدء…') : navigationText(linkedPhone ? 'Link another phone' : 'Link WhatsApp phone', linkedPhone ? 'ربط هاتف آخر' : 'ربط هاتف واتساب')}</button>
                      {linkedPhone && <button className="btn" disabled={busy === 'whatsapp-link'} onClick={async () => {
                        if (await confirmDialog({ title: navigationText('Replace linked phone?', 'استبدال الهاتف المرتبط؟'), message: navigationText('Hermes will back up the current WhatsApp session before linking another phone.', 'سيحفظ Hermes نسخة من جلسة واتساب الحالية قبل ربط هاتف آخر.'), confirmLabel: navigationText('Continue', 'متابعة') })) void startWhatsAppLink(true)
                      }}>{navigationText('Change number', 'تغيير الرقم')}</button>}
                    </div>
                  </>}
                  {whatsapp && <div className="hm-whatsapp-pairing" role="status">
                    {whatsapp.status === 'waiting' && whatsapp.pairing_code && <div className="hm-whatsapp-code" dir="ltr" aria-label={navigationText('WhatsApp pairing code', 'رمز ربط واتساب')}>{whatsapp.pairing_code}</div>}
                    {whatsapp.status === 'waiting' && !whatsapp.pairing_code && whatsappQr && <img className="hm-whatsapp-qr" src={whatsappQr} alt={navigationText('WhatsApp linking QR code', 'رمز QR لربط واتساب')} />}
                    {whatsapp.status === 'starting' && <p>{navigationText('Starting the WhatsApp bridge…', 'جارٍ تشغيل جسر واتساب…')}</p>}
                    {whatsapp.status === 'waiting' && whatsapp.pairing_code && <p>{navigationText('On your phone, open WhatsApp → Linked devices → Link a device → Link with phone number instead, then enter this code.', 'على هاتفك افتح واتساب ← الأجهزة المرتبطة ← ربط جهاز ← الربط برقم الهاتف بدلاً من ذلك، ثم أدخل هذا الرمز.')}</p>}
                    {whatsapp.status === 'waiting' && !whatsapp.pairing_code && <p>{navigationText('Open WhatsApp on the phone you want to link, then choose Linked devices → Link a device and scan this code.', 'افتح واتساب على الهاتف الذي تريد ربطه، ثم اختر الأجهزة المرتبطة ← ربط جهاز وامسح الرمز.')}</p>}
                    {whatsapp.status === 'connected' && <p className="hm-whatsapp-connected">{navigationText('Phone connected', 'تم اتصال الهاتف')}</p>}
                    {(whatsapp.status === 'error' || whatsapp.status === 'expired') && <p className="hm-channel-error">{whatsapp.error || navigationText('WhatsApp pairing failed or expired. Start again.', 'فشل ربط واتساب أو انتهت صلاحيته. ابدأ من جديد.')}</p>}
                    {whatsapp.status === 'connected' && <div className="hm-channel-actions">
                      <button className="btn primary" disabled={busy === 'whatsapp-apply'} onClick={() => void applyWhatsAppLink()}>{busy === 'whatsapp-apply' ? navigationText('Saving and restarting…', 'جارٍ الحفظ وإعادة التشغيل…') : navigationText('Save and connect', 'حفظ والاتصال')}</button>
                      {whatsapp.account_phone && <button className="btn" disabled={busy === 'whatsapp-link'} onClick={async () => {
                        if (await confirmDialog({ title: navigationText('Replace linked phone?', 'استبدال الهاتف المرتبط؟'), message: navigationText('Hermes will back up the current WhatsApp session before linking another phone.', 'سيحفظ Hermes نسخة من جلسة واتساب الحالية قبل ربط هاتف آخر.'), confirmLabel: navigationText('Continue', 'متابعة') })) void startWhatsAppLink(true)
                      }}>{navigationText('Change number', 'تغيير الرقم')}</button>}
                    </div>}
                    {whatsapp.status !== 'connected' && <button className="btn" disabled={busy === 'whatsapp-cancel'} onClick={() => void cancelWhatsAppLink()}>{busy === 'whatsapp-cancel' ? navigationText('Cancelling…', 'جارٍ الإلغاء…') : navigationText('Cancel', 'إلغاء')}</button>}
                  </div>}
                </section>}
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
