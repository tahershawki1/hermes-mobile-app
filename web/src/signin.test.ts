// @vitest-environment happy-dom
// Subscription sign-in status: Hermes's account list can miss a login that lives only in the credential pool;
// withPoolStatus fills it in for Claude, Codex and every newer OAuth provider.
import { describe, expect, test } from 'vitest'
import { withPoolStatus, withSharedSubscriptionStatus } from './components/SignIn'

const card = (id: string, logged_in = false) => ({ id, status: { logged_in } })

describe('withPoolStatus', () => {
  test('an OAuth Claude login in the pool marks the Claude card signed in, with its label', () => {
    const [c] = withPoolStatus([card('anthropic')], { anthropic: [{ label: 'claude-sub', auth_type: 'oauth', source: 'manual:hermes_pkce' }] })
    expect(c.status).toMatchObject({ logged_in: true, source: 'credential_pool', source_label: 'claude-sub' })
  })
  test("an API key or Claude Code's own login does not count as the Claude subscription", () => {
    const pool = { anthropic: [{ label: 'k', auth_type: 'api_key', source: 'env:ANTHROPIC_API_KEY' }, { label: 'claude_code', auth_type: 'oauth', source: 'claude_code' }] }
    expect(withPoolStatus([card('anthropic')], pool)[0].status.logged_in).toBe(false)
  })
  test('a Codex subscription in the pool marks Codex signed in', () => {
    const [codex] = withPoolStatus([card('openai-codex')], { 'openai-codex': [{ label: 'ChatGPT Plus', auth_type: 'oauth', source: 'manual:device_code' }] })
    expect(codex.status).toMatchObject({ logged_in: true, source: 'credential_pool', source_label: 'ChatGPT Plus' })
  })
  test("Hermes's own answer wins; an API-key pool entry is ignored; no pool = unchanged", () => {
    const signed = { id: 'anthropic', status: { logged_in: true, source_label: 'Hermes PKCE' } }
    expect(withPoolStatus([signed], { anthropic: [{ label: 'x', auth_type: 'oauth', source: 'manual:hermes_pkce' }] })[0]).toBe(signed)
    const other = card('openai-codex')
    expect(withPoolStatus([other], { 'openai-codex': [{ auth_type: 'api_key', source: 'env:OPENAI_API_KEY' }] })[0]).toBe(other)
    expect(withPoolStatus([card('anthropic')], {})[0].status.logged_in).toBe(false)
  })
})

describe('withSharedSubscriptionStatus', () => {
  test.each([
    ['openai-codex', 'ChatGPT Plus'],
    ['anthropic', 'Claude Pro'],
    ['copilot-acp', 'GitHub Copilot']
  ])('a named bot sees the main profile %s subscription without copying its refresh grant', (provider, label) => {
    const [account] = withSharedSubscriptionStatus(
      [card(provider)],
      {},
      [card(provider)],
      { [provider]: [{ label, auth_type: 'oauth', source: 'manual:device_code' }] }
    )
    expect(account.status).toMatchObject({
      logged_in: true,
      source: 'shared_profile',
      source_label: `Main profile · ${label}`,
      shared_from_profile: 'default'
    })
  })

  test("the bot's own login wins and main-profile API keys are never treated as shared subscriptions", () => {
    const own = { id: 'openai-codex', status: { logged_in: true, source_label: 'This bot' } }
    expect(withSharedSubscriptionStatus([own], {}, [card('openai-codex')], { 'openai-codex': [{ auth_type: 'oauth' }] })[0]).toBe(own)
    const [notShared] = withSharedSubscriptionStatus(
      [card('openai-codex')],
      {},
      [card('openai-codex')],
      { 'openai-codex': [{ label: 'OPENAI_API_KEY', auth_type: 'api_key', source: 'env:OPENAI_API_KEY' }] }
    )
    expect(notShared.status.logged_in).toBe(false)
  })
})
