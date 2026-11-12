const { WEB, check, nativeShell, sleep } = require('../lib.cjs')

// Exercise the built app over its real WebSocket consumer, not an imported reducer.
module.exports = async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.addInitScript(nativeShell)
  let sendEvent
  let completion
  const progress = 'هراجع الملفات وأختبر النتيجة.'
  await page.routeWebSocket('**/api/ws*', socket => {
    const server = socket.connectToServer()
    server.onMessage(data => {
      const frame = JSON.parse(String(data))
      const event = frame.method === 'event' ? frame.params : null
      if (event?.type === 'message.delta' && event.payload?.text === 'OK') {
        sendEvent = (type, payload) => socket.send(JSON.stringify({
          jsonrpc: '2.0', method: 'event', params: { type, session_id: event.session_id, payload }
        }))
        sendEvent('message.interim', { text: progress, already_streamed: false })
        return
      }
      if (sendEvent && event?.type === 'message.complete' && event.payload?.text === 'OK') {
        completion = event.payload // hold completion until the test observes live progress
        return
      }
      socket.send(String(data))
    })
  })
  try {
    await page.goto(WEB + '/')
    const input = page.getByPlaceholder('Message Hermes')
    await input.waitFor({ timeout: 15000 })
    await input.fill('interim fixture')
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    await page.locator('.msg.assistant .md', { hasText: progress }).waitFor({ timeout: 10000 })
    check(await page.getByRole('button', { name: 'Stop', exact: true }).isVisible(), 'interim text is visible before final completion and the turn remains running')
    for (let n = 0; n < 50 && !completion; n++) await sleep(50)
    if (!completion || !sendEvent) throw new Error('Mock completion was not intercepted')
    sendEvent('tool.start', { tool_id: 'interim-file', name: 'read_file', args: { path: 'fixture.txt' } })
    sendEvent('tool.complete', { tool_id: 'interim-file', name: 'read_file', result: 'fixture result' })
    sendEvent('message.delta', { text: 'Original answer.' })
    sendEvent('message.interim', { text: 'Original answer.', already_streamed: true })
    sendEvent('message.complete', { ...completion, text: 'Safe.', response_previewed: true, response_transformed: true, status: 'complete' })
    await page.locator('.msg.assistant .md', { hasText: 'Safe.' }).waitFor({ timeout: 10000 })
    await page.getByRole('button', { name: 'Stop', exact: true }).waitFor({ state: 'hidden' })
    const text = await page.locator('.msg.assistant .md').allTextContents()
    check(text.filter(t => t === progress).length === 1, 'interim progress survives the tool boundary exactly once')
    check(text.filter(t => t === 'Safe.').length === 1 && text.every(t => !t.includes('Original answer.')), 'transformed final replaces its sealed preview instead of retaining or duplicating it')
    check(errors.length === 0, `interim flow has no browser errors (${errors.join('; ')})`)
  } finally {
    await page.close()
  }
}
