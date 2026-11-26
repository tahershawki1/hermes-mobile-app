import type { ReactNode } from 'react'
import { dotState } from '../health'
import { errText, reconnectNow, resumeSession, startDraft } from '../gateway'
import { haptic } from '../bridge'
import { arabicNavigation, navigationText, openDestination, type MainDestination } from '../navigation'
import { getState, setState, toast, useStore, type Screen } from '../store'
import { Title } from './Title'
import './Navigation.css'

type Icon = 'home' | 'chats' | 'work' | 'knowledge' | 'more' | 'plus' | 'chevron' | 'signal' | 'clock' | 'file' | 'folder' | 'canvas' | 'model' | 'skills' | 'bots' | 'system' | 'settings'
const PATH: Record<Icon, string> = {
  home: 'M3 10l9-7 9 7v10H3z M9 20v-7h6v7',
  chats: 'M4 5h16v12H9l-5 4z M8 9h8m-8 4h5',
  work: 'M3 8h18v12H3z M8 8V5h8v3 M3 13h18m-11 0v2h4v-2',
  knowledge: 'M12 6C9 4 6 4 3 5v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1zm0 0v14',
  more: 'M5 12h.01m6.99 0h.01m6.99 0h.01',
  plus: 'M12 5v14M5 12h14',
  chevron: 'm9 6 6 6-6 6',
  signal: 'M3 19h3v-4m4 4v-7m4 7V8m4 11V4',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M12 7v5l3 2',
  file: 'M5 3h10l4 4v14H5z M14 3v5h5 M8 12h8m-8 4h6',
  folder: 'M3 6h7l3 3h8v10H3z',
  canvas: 'M3 5h18v14H3z M14 5v14 M6 9h5m-5 4h3',
  model: 'm12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4z',
  skills: 'M5 5h14v14H5z M9 9h6m-6 3h6m-6 3h4',
  bots: 'M5 8h14v12H5z M12 4v4m-3 5h.01m5.99 0h.01 M9 17h6',
  system: 'M4 4h16v16H4z M7 12h3l2-4 2 8 2-4h1',
  settings: 'M5 6h14M5 12h14M5 18h14 M8 4v4m8 2v4m-6 2v4'
}

function NavIcon({ name }: { name: Icon }) {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={name === 'more' ? 3 : 1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PATH[name]} /></svg>
}

const TABS: { id: MainDestination; icon: Icon; en: string; ar: string; a11y?: string }[] = [
  { id: 'home', icon: 'home', en: 'Home', ar: 'الرئيسية' },
  { id: 'chats', icon: 'chats', en: 'Sessions', ar: 'الجلسات', a11y: 'Conversations' },
  { id: 'work', icon: 'work', en: 'Work', ar: 'العمل' },
  { id: 'knowledge', icon: 'knowledge', en: 'Knowledge', ar: 'المعرفة' },
  { id: 'more', icon: 'more', en: 'More', ar: 'المزيد' }
]

export function PrimaryNavigation({ screen, approval }: { screen: Screen; approval: boolean }) {
  const selected = screen ?? 'chats'
  return (
    <div className="hm-primary-bar" dir={arabicNavigation() ? 'rtl' : 'ltr'} lang={arabicNavigation() ? 'ar' : 'en'}>
      {approval && screen && <button className="hm-review-approval" onClick={() => openDestination(null)}>{navigationText('Review pending approval', 'راجع الموافقة المطلوبة')}</button>}
      <nav className="hm-primary-nav" aria-label={navigationText('Main navigation', 'التنقل الرئيسي')}>
        {TABS.map(({ id, icon, en, ar, a11y }) => (
          <button type="button" key={id} aria-label={navigationText(a11y ?? en, ar)} aria-current={selected === id ? 'page' : undefined}
            onClick={() => { if (screen !== id) { haptic(); openDestination(id, id === 'home' ? null : 'home') } }}>
            <NavIcon name={icon} />
            <span>{navigationText(en, ar)}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

function Destination({ title, subtitle, screen, children }: { title: string; subtitle?: string; screen: MainDestination; children: ReactNode }) {
  return (
    <section className="screen hm-destination" aria-label={title} dir={arabicNavigation() ? 'rtl' : 'ltr'} lang={arabicNavigation() ? 'ar' : 'en'}>
      <header className="hm-destination-header">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </header>
      <div className={`hm-destination-body hm-destination-${screen}`}>{children}</div>
    </section>
  )
}

function NavRow({ label, description, icon, onClick }: { label: ReactNode; description?: string; icon: Icon; onClick: () => void }) {
  return (
    <button className="hm-nav-row" type="button" onClick={() => { haptic(); onClick() }}>
      <span className="hm-nav-row-icon"><NavIcon name={icon} /></span>
      <span className="hm-nav-row-text"><strong>{label}</strong>{description && <span>{description}</span>}</span>
      <span className="hm-nav-chevron"><NavIcon name="chevron" /></span>
    </button>
  )
}

const STATUS = {
  ok: ['Connected', 'متصل'],
  warn: ['Connected with issues', 'متصل مع وجود مشكلة'],
  wait: ['Connecting…', 'جارٍ الاتصال…'],
  err: ['Offline', 'غير متصل']
} as const

export function WorkspaceHome() {
  const sessions = useStore(s => s.sessions)
  const loading = useStore(s => s.sessionsLoading)
  const current = useStore(s => s.active?.storedId || s.opening)
  const profile = useStore(s => s.profile)
  const display = useStore(s => s.profiles.find(p => p.name === s.profile)?.display_name)
  const conn = useStore(s => s.conn)
  const status = useStore(s => dotState(s.conn, s.health))
  const detail = useStore(s => s.connDetail)
  const recent = sessions.slice(0, 4)
  const openChat = (id: string) => {
    openDestination(null)
    if (id === current && (getState().active || getState().opening)) return
    void resumeSession(id).catch(e => toast(errText(e), 'error'))
  }
  return (
    <Destination screen="home" title={navigationText('Home', 'الرئيسية')} subtitle={navigationText('Hermes on this phone', 'Hermes على هذا الهاتف')}>
      <section className="hm-service-card" aria-label={navigationText('Local Hermes status', 'حالة Hermes المحلي')}>
        <div className="hm-service-heading">
          <span className="hm-nav-row-icon"><NavIcon name="signal" /></span>
          <div><h2>{navigationText('Local Hermes', 'Hermes المحلي')}</h2><p><bdi>{display || (profile === 'default' ? navigationText('Main profile', 'الملف الرئيسي') : profile)}</bdi></p></div>
          <span className={`hm-service-state ${status}`} role="status"><span className={`conn-dot ${status}`} />{navigationText(STATUS[status][0], STATUS[status][1])}</span>
        </div>
        {conn !== 'open' && detail && <p className="hm-service-detail" dir="auto">{detail}</p>}
        <div className="hm-service-actions">
          <button className="btn" onClick={() => setState({ sheet: 'status' })}>{navigationText('Status details', 'تفاصيل الحالة')}</button>
          {status === 'err' && <button className="btn" onClick={() => reconnectNow()}>{navigationText('Reconnect', 'إعادة الاتصال')}</button>}
        </div>
      </section>
      <div className="hm-home-chat-actions">
        <button className="hm-new-chat" onClick={() => { haptic(); startDraft(); openDestination(null) }}><NavIcon name="plus" />{navigationText('New chat', 'محادثة جديدة')}</button>
        <button className="btn" onClick={() => openDestination(null)}>{navigationText('Continue chat', 'متابعة المحادثة')}</button>
      </div>
      <section className="hm-nav-section" aria-label={navigationText('Recent chats', 'المحادثات الأخيرة')}>
        <div className="hm-nav-section-head"><h2>{navigationText('Recent chats', 'المحادثات الأخيرة')}</h2><button className="hm-nav-link" onClick={() => openDestination('chats', 'home')}>{navigationText('View all', 'عرض الكل')}</button></div>
        {recent.length ? <div className="hm-nav-group">{recent.map(session => (
          <NavRow key={session.id} icon="chats" label={<Title text={session.title} fallback={navigationText('Untitled chat', 'محادثة بدون عنوان')} />} onClick={() => openChat(session.id)} />
        ))}</div> : <p className="hm-nav-empty">{loading ? navigationText('Loading conversations…', 'جارٍ تحميل المحادثات…') : conn === 'open' ? navigationText('No chats yet', 'لا توجد محادثات بعد') : navigationText('Connect to load your conversations', 'اتصل لتحميل محادثاتك')}</p>}
      </section>
    </Destination>
  )
}

type Entry = { icon: Icon; label: [string, string]; description: [string, string]; target: Exclude<Screen, null> | 'status' }
const ENTRIES: Record<'work' | 'knowledge' | 'more', Entry[]> = {
  work: [
    { icon: 'clock', label: ['Scheduled jobs', 'المهام المجدولة'], description: ['Run jobs and view results', 'تشغيل المهام وعرض نتائجها'], target: 'cron' },
    { icon: 'folder', label: ['Files', 'الملفات'], description: ['Browse and upload files on the phone', 'تصفح ملفات الهاتف وارفع ملفات'], target: 'files' },
    { icon: 'work', label: ['Projects', 'المشاريع'], description: ['Work folders and their conversations', 'مجلدات العمل ومحادثاتها'], target: 'projects' },
    { icon: 'canvas', label: ['Canvas gallery', 'معرض Canvas'], description: ['Documents from your conversations', 'مستندات محادثاتك'], target: 'gallery' }
  ],
  knowledge: [
    { icon: 'model', label: ['Default models', 'النماذج الافتراضية'], description: ['Choose the starting model for each profile', 'اختر النموذج الافتراضي لكل ملف'], target: 'models' },
    { icon: 'signal', label: ['Model providers', 'مزوّدو النماذج'], description: ['Accounts, fallback models and endpoints', 'الحسابات والنماذج البديلة ونقاط الاتصال'], target: 'providers' },
    { icon: 'skills', label: ['Skills', 'المهارات'], description: ['Browse skills and use them in chat', 'تصفح المهارات واستخدمها في المحادثة'], target: 'skills' },
    { icon: 'file', label: ['Memory', 'الذاكرة'], description: ['Read and edit what Hermes remembers', 'اعرض وعدّل ما يتذكره Hermes'], target: 'memory' }
  ],
  more: [
    { icon: 'signal', label: ['Messaging channels', 'قنوات المراسلة'], description: ['Telegram, Discord and Slack status and setup', 'حالة وإعداد Telegram وDiscord وSlack'], target: 'messaging' },
    { icon: 'bots', label: ['Bots', 'الوكلاء'], description: ['Profiles, models and personalities', 'الملفات والنماذج وشخصيات الوكلاء'], target: 'bots' },
    { icon: 'signal', label: ['Connection', 'الاتصال'], description: ['Local Dashboard and session status', 'حالة لوحة التحكم المحلية والجلسة'], target: 'status' },
    { icon: 'system', label: ['System', 'النظام'], description: ['Termux, permissions and setup check', 'فحص إعداد Termux والصلاحيات'], target: 'setup' },
    { icon: 'settings', label: ['Settings', 'الإعدادات'], description: ['Appearance, voice and Hermes options', 'المظهر والصوت وإعدادات Hermes'], target: 'settings' }
  ]
}

export function WorkspaceSection({ screen }: { screen: keyof typeof ENTRIES }) {
  const title = TABS.find(tab => tab.id === screen)!
  return (
    <Destination screen={screen} title={navigationText(title.en, title.ar)}>
      <div className="hm-nav-group">
        {ENTRIES[screen].map(({ icon, label, description, target }) => (
          <NavRow key={target} icon={icon} label={navigationText(...label)} description={navigationText(...description)}
            onClick={() => target === 'status' ? setState({ sheet: 'status' }) : openDestination(target, screen)} />
        ))}
      </div>
    </Destination>
  )
}
