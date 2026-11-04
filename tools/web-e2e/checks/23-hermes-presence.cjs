// Conversational presence: theme-aware face, clear speaker identity, and a motion-safe welcome.
const { WEB, check } = require('../lib.cjs')

module.exports = async ({ browser, page }) => {
  const fresh = await browser.newPage({ viewport: { width: 375, height: 812 } })
  try {
    await fresh.goto(WEB + '/')
    await fresh.getByPlaceholder('Message Hermes').waitFor({ timeout: 15000 })
    check((await fresh.locator('.hm-chat-title .hm-presence').count()) === 1, 'Hermes face is visible beside the chat title')
    const welcome = fresh.locator('.empty .hm-welcome-avatar')
    if (await fresh.locator('.empty').count()) {
      check((await welcome.count()) === 1, 'welcome has a graphical Hermes avatar')
      check((await fresh.getByText('What are we working on today?').count()) === 1, 'welcome opens the conversation naturally')
    }
    const prefersReduced = await fresh.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
    if (!prefersReduced && await welcome.count()) {
      const style = await welcome.evaluate(el => getComputedStyle(el).animationIterationCount)
      check(style === '1', 'welcome animation runs once instead of draining the battery')
    }
  } finally {
    await fresh.close()
  }
  if (await page.locator('.msg.assistant').count()) {
    check((await page.locator('.msg.assistant .hm-assistant-byline').count()) > 0, 'assistant replies identify Hermes as the speaker')
  }
}
