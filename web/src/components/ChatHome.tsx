import { useState } from 'react'
import { startDraft } from '../gateway'
import { setState, useStore } from '../store'
import { SessionList } from './SessionList'
import './ChatHome.css'

/** Full in-app home, reusing the same pinned and recent sessions as the drawer. */
export function ChatHome() {
  const [query, setQuery] = useState('')
  const count = useStore(s => s.sessions.length)
  return (
    <main className="hm-chat-home" aria-label="Conversations">
      <div className="hm-chat-home-head">
        <div><h1>المحادثات</h1><p>{count} محادثة · المثبتة تظهر أولاً 📌</p></div>
        <button className="hm-chat-home-new" onClick={() => { void startDraft(); setState({ screen: null, drawer: false }) }}>＋ محادثة</button>
      </div>
      <label className="hm-chat-home-search">
        <span aria-hidden="true">⌕</span>
        <input type="search" placeholder="ابحث في المحادثات…" value={query} onChange={e => setQuery(e.target.value)} />
      </label>
      <div className="hm-chat-home-list drawer-list">
        <SessionList query={query} onSelect={() => setState({ screen: null, drawer: false })} />
      </div>
    </main>
  )
}
