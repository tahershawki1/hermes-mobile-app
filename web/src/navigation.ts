import { getState, setState, type Screen } from './store'

export type MainDestination = 'home' | 'chats' | 'work' | 'knowledge' | 'more'

export function isMainDestination(screen: Screen): screen is MainDestination {
  return screen === 'home' || screen === 'chats' || screen === 'work' || screen === 'knowledge' || screen === 'more'
}

/** Keep the current chat mounted when moving between app screens. */
export function openDestination(screen: Screen, back: Screen = null) {
  const previous = getState().screen
  if (previous !== screen && document.activeElement?.matches('input, textarea, [contenteditable=true]') && document.activeElement instanceof HTMLElement) document.activeElement.blur()
  setState({ screen, screenBack: back, screenProfile: null, drawer: false, sheet: null })
}

export const arabicNavigation = () => /^ar(?:-|$)/i.test(navigator.language)

export const navigationText = (en: string, ar: string) => arabicNavigation() ? ar : en
