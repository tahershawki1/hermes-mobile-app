import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
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
  const [whatsappPairingMethod, setWhatsAppPairingMethod] = useState<'phone' | 'qr'>('phone')
  const [whatsappPhone, setWhatsAppPhone] = useState('')
  const [whatsappQrImage, setWhatsAppQrImage] = useState('')
  const [linkedPhone, setLinkedPhone] = useState('')
  const appliedWhatsAppPairing = useRef('')

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
    const session = whatsapp
    if (!session || session.pairing_method !== 'phone' || !['starting', 'waiting'].includes(session.status) || session.pairing_code) return
    const timer = window.setTimeout(() => {
      setWhatsApp(current => current?.pairing_id === session.pairing_id && !current.pairing_code
        ? { ...current, status: 'error', error: navigationText('Hermes did not receive a link code. Check the phone number and internet connection, then try again.', 'لم يصل رمز الربط من المحرك. راجع رقم الهاتف والإنترنت ثم حاول مرة أخرى.') }
        : current)
    }, 120000)
    return () => window.clearTimeout(timer)
  }, [whatsapp?.pairing_id, whatsapp?.pairing_method, whatsapp?.status, whatsapp?.pairing_code])

  useEffect(() => {
    let active = true
    setWhatsAppQrImage('')
    if (!whatsapp?.qr_payload) return () => { active = false }
    void QRCode.toDataURL(whatsapp.qr_payload, { width: 512, margin: 1, errorCorrectionLevel: 'M' })
      .then(image => { if (active) setWhatsAppQrImage(image) })
      .catch(() => { if (active) setWhatsAppQrImage('') })
    return () => { active = false }
  }, [whatsapp?.pairing_id, whatsapp?.qr_payload])

  const startWhatsAppLink = async (resetSession = false) => {
    setBusy('whatsapp-link')
    try {
      const state = await api<WhatsAppSetupState>('POST', '/api/messaging/whatsapp/onboarding/start', {
        mode: 'bot', pairing_method: whatsappPairingMethod,
        phone_number: whatsappPairingMethod === 'phone' ? whatsappPhone : '',
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
        { mode: 'bot' }
      )
      if (whatsapp.account_phone) setLinkedPhone(whatsapp.account_phone)
      setWhatsApp(null)
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

  useEffect(() => {
    const session = whatsapp
    if (session?.status !== 'connected' || !session.pairing_id || appliedWhatsAppPairing.current === session.pairing_id) return
    appliedWhatsAppPairing.current = session.pairing_id
    let active = true
    setBusy('whatsapp-apply')
    void (async () => {
      try {
        const result = await api<{ restart_started?: boolean; needs_restart?: boolean; restart_error?: string | null }>(
          'POST', `/api/messaging/whatsapp/onboarding/${encodeURIComponent(session.pairing_id)}/apply`, { mode: 'bot' }
        )
        if (!active) return
        if (session.account_phone) setLinkedPhone(session.account_phone)
        setWhatsApp(null)
        setRestartNeeded(Boolean(result.needs_restart || !result.restart_started))
        toast(result.restart_started ? navigationText('WhatsApp connected.', 'تم ربط واتساب بنجاح.') : result.restart_error || navigationText('WhatsApp linked. Restart Hermes to apply.', 'تم الربط. أعد تشغيل هيرمس للتطبيق.'), result.restart_started ? 'info' : 'error')
        await refresh()
        if (result.restart_started) window.setTimeout(() => void refresh(), 5000)
      } catch (e) {
        if (active) {
          appliedWhatsAppPairing.current = ''
          setWhatsApp(current => current ? { ...current, error: e instanceof Error ? e.message : String(e) } : current)
          toast(e instanceof Error ? e.message : String(e), 'error')
        }
      } finally {
        if (active) setBusy('')
      }
    })()
    return () => { active = false }
  }, [whatsapp?.pairing_id, whatsapp?.status])

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
                {platform.id !== 'whatsapp' && <button className="btn" disabled={busy === `toggle:${platform.id}`} onClick={() => void toggle(platform)}>{busy === `toggle:${platform.id}` ? navigationText('Saving…', 'جارٍ الحفظ…') : platform.enabled ? navigationText('Turn off', 'إيقاف') : navigationText('Turn on', 'تشغيل')}</button>}
              </div>
              {platform.error_message && <p className="hm-channel-error">{platform.error_message}</p>}
              {expanded && <div className="hm-channel-details">
                {platform.id === 'whatsapp' && <section className="hm-whatsapp-link" aria-label={navigationText('WhatsApp link setup', 'إعداد ربط واتساب')}>
                  <div className="hm-whatsapp-link-head">
                    <strong>{navigationText('Connect WhatsApp', 'ربط واتساب')}</strong>
                    <p>{navigationText('Choose how to link your WhatsApp account.', 'اختر طريقة ربط حساب واتساب.')}</p>
                  </div>
                  {linkedPhone && <div className="hm-whatsapp-phone"><span>{navigationText('Linked phone', 'الهاتف المرتبط')}</span><bdi dir="ltr">{linkedPhone}</bdi></div>}
                  {!whatsapp && <>
                    <div className="hm-whatsapp-methods" role="group" aria-label={navigationText('WhatsApp linking method', 'طريقة ربط واتساب')}>
                      <button type="button" className={`btn hm-whatsapp-method${whatsappPairingMethod === 'phone' ? ' selected' : ''}`} aria-pressed={whatsappPairingMethod === 'phone'} onClick={() => setWhatsAppPairingMethod('phone')}>{navigationText('Phone number', 'رقم الهاتف')}</button>
                      <button type="button" className={`btn hm-whatsapp-method${whatsappPairingMethod === 'qr' ? ' selected' : ''}`} aria-pressed={whatsappPairingMethod === 'qr'} onClick={() => setWhatsAppPairingMethod('qr')}>{navigationText('QR code', 'رمز QR')}</button>
                    </div>
                    {whatsappPairingMethod === 'phone' ? <>
                      <label className="hm-channel-field">
                        <span className="hm-channel-field-title">{navigationText('Phone number with country code', 'رقم الهاتف مع مفتاح الدولة')}</span>
                        <input className="sheet-input" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" placeholder="+201234567890" value={whatsappPhone} onChange={e => setWhatsAppPhone(e.target.value)} />
                      </label>
                      <p className="hm-whatsapp-method-hint">{navigationText('Hermes will show a device-link code. Enter it in WhatsApp; it is not sent by SMS.', 'سيعرض هيرمس رمز ربط جهاز. أدخله في واتساب؛ لا يُرسل عبر SMS.')}</p>
                    </> : <p className="hm-whatsapp-method-hint">{navigationText('Hermes will display a QR code. Scan it in WhatsApp under Linked devices → Link a device.', 'سيعرض هيرمس رمز QR. امسحه من واتساب عبر الأجهزة المرتبطة ← ربط جهاز.')}</p>}
                    <div className="hm-channel-actions">
                      <button className="btn primary" disabled={busy === 'whatsapp-link' || (whatsappPairingMethod === 'phone' && whatsappPhone.replace(/\D/g, '').length < 8)} onClick={async () => {
                        if (linkedPhone) {
                          if (await confirmDialog({ title: navigationText('Change WhatsApp link?', 'تغيير ربط واتساب؟'), message: navigationText('Hermes will back up the current WhatsApp link before replacing it.', 'سيحفظ هيرمس نسخة من ربط واتساب الحالي قبل استبداله.'), confirmLabel: navigationText('Continue', 'متابعة') })) void startWhatsAppLink(true)
                        } else void startWhatsAppLink()
                      }}>{busy === 'whatsapp-link' ? navigationText('Starting link…', 'جارٍ بدء الربط…') : navigationText(whatsappPairingMethod === 'phone' ? (linkedPhone ? 'Change number' : 'Link by phone') : (linkedPhone ? 'Change link' : 'Show QR code'), whatsappPairingMethod === 'phone' ? (linkedPhone ? 'تغيير الرقم' : 'الربط برقم الهاتف') : (linkedPhone ? 'تغيير الربط' : 'عرض رمز QR'))}</button>
                    </div>
                  </>}
                  {whatsapp && <div className="hm-whatsapp-pairing" role="status">
                    {whatsapp.status === 'waiting' && whatsapp.pairing_code && <div className="hm-whatsapp-code" dir="ltr" aria-label={navigationText('WhatsApp pairing code', 'رمز ربط واتساب')}>{whatsapp.pairing_code}</div>}
                    {whatsapp.status === 'waiting' && whatsapp.pairing_method === 'qr' && whatsappQrImage && <img className="hm-whatsapp-qr" src={whatsappQrImage} alt={navigationText('WhatsApp linking QR code', 'رمز QR لربط واتساب')} />}
                    {whatsapp.status === 'starting' && <p>{whatsapp.pairing_method === 'qr' ? navigationText('Connecting to WhatsApp and preparing a QR code…', 'جارٍ الاتصال بواتساب وتجهيز رمز QR…') : navigationText('Asking the Hermes engine for a link code…', 'جارٍ طلب رمز الربط من محرك هيرمس…')}</p>}
                    {whatsapp.status === 'waiting' && whatsapp.pairing_code && <p>{navigationText('In WhatsApp, open Linked devices → Link a device → Link with phone number instead, then enter this code.', 'في واتساب افتح الأجهزة المرتبطة ← ربط جهاز ← الربط برقم الهاتف بدلاً من ذلك، ثم أدخل هذا الرمز.')}</p>}
                    {whatsapp.status === 'waiting' && whatsapp.pairing_method === 'qr' && !whatsapp.qr_payload && <p>{navigationText('Waiting for the QR code from the Hermes engine…', 'بانتظار رمز QR من محرك هيرمس…')}</p>}
                    {whatsapp.status === 'waiting' && whatsapp.pairing_method === 'phone' && !whatsapp.pairing_code && <p>{navigationText('Waiting for the link code from the Hermes engine…', 'بانتظار رمز الربط من محرك هيرمس…')}</p>}
                    {whatsapp.status === 'waiting' && whatsapp.pairing_method === 'qr' && whatsapp.qr_payload && <p>{navigationText('In WhatsApp, open Linked devices → Link a device and scan this QR code.', 'في واتساب افتح الأجهزة المرتبطة ← ربط جهاز ثم امسح رمز QR هذا.')}</p>}
                    {whatsapp.status === 'connected' && !whatsapp.error && <p className="hm-whatsapp-connected">{navigationText('Code accepted. Saving the connection…', 'تم قبول الرمز. جارٍ حفظ الاتصال…')}</p>}
                    {whatsapp.status === 'connected' && whatsapp.error && <>
                      <p className="hm-channel-error">{whatsapp.error}</p>
                      <button className="btn primary" disabled={busy === 'whatsapp-apply'} onClick={() => void applyWhatsAppLink()}>{busy === 'whatsapp-apply' ? navigationText('Saving…', 'جارٍ الحفظ…') : navigationText('Retry', 'إعادة المحاولة')}</button>
                    </>}
                    {(whatsapp.status === 'error' || whatsapp.status === 'expired') && <p className="hm-channel-error">{whatsapp.error || navigationText('WhatsApp pairing failed or expired. Start again.', 'فشل ربط واتساب أو انتهت صلاحيته. ابدأ من جديد.')}</p>}
                    {whatsapp.status !== 'connected' && <button className="btn" disabled={busy === 'whatsapp-cancel'} onClick={() => void cancelWhatsAppLink()}>{busy === 'whatsapp-cancel' ? navigationText('Cancelling…', 'جارٍ الإلغاء…') : navigationText('Cancel', 'إلغاء')}</button>}
                  </div>}
                </section>}
                {platform.id !== 'whatsapp' && <>
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
                </>}
              </div>}
            </article>
          })}
        </div>
      </div>
    </ScreenShell>
  )
}
