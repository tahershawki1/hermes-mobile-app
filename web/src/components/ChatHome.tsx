import { useState } from 'react'
import { startDraft } from '../gateway'
import { arabicNavigation, navigationText, openDestination } from '../navigation'
import { SessionList } from './SessionList'
import './ChatHome.css'

/** Full session list, using the same search, pinned order and archive as the drawer. */
export function ChatHome() {
  const [query, setQuery] = useState('')
  const search = navigationText('Search conversations…', 'ابحث في المحادثات…')
  return (
    <main className="hm-chat-home" aria-label={navigationText('Conversations', 'الجلسات')} dir={arabicNavigation() ? 'rtl' : 'ltr'} lang={arabicNavigation() ? 'ar' : 'en'}>
      <div className="hm-chat-home-head">
        <h1>{navigationText('Sessions', 'الجلسات')}</h1>
        <button className="hm-chat-home-new" onClick={() => { startDraft(); openDestination(null) }}>{navigationText('New chat', 'محادثة جديدة')}</button>
      </div>
      <div className="hm-chat-home-tools">
        <label className="hm-chat-home-search">
          <span aria-hidden="true">⌕</span>
          <input type="search" aria-label={search} placeholder={search} value={query} onChange={e => setQuery(e.target.value)} dir="auto" />
        </label>
        <button className="btn" onClick={() => openDestination('projects', 'chats')}>{navigationText('Projects', 'المشاريع')}</button>
      </div>
      <div className="hm-chat-home-list drawer-list" dir="ltr">
        <SessionList query={query} onSelect={() => openDestination(null)} />
      </div>
    </main>
  )
}
