const path = require('path')
const { WEB, SHOTS, check, nativeShell } = require('../lib.cjs')

module.exports = async ({ browser }) => {
  const pg = await browser.newPage({ viewport: { width: 375, height: 812 } })
  const errors = []
  pg.on('pageerror', e => errors.push(e.message))
  await pg.addInitScript(nativeShell)
  const answer = 'قبل **Hermes** بعد\n\nHello world\n\n- عنصر عربي\n- English item\n\n- [ ] مهمة عربية\n- [x] English task\n\n| الاسم | Name |\n| --- | --- |\n| عربي | English |\n\nافتح [الموقع](https://example.com) الآن\n\n```js\nconst name = "عربي"\n```\n\n`Hermes` ده نص عربي يبدأ بكود\n\n> `API` هذا اقتباس عربي'
  // Exercise the real gateway/rendering pipeline with controlled multilingual reply content.
  await pg.routeWebSocket('**/api/ws*', socket => {
    const server = socket.connectToServer()
    server.onMessage(data => {
      const msg = JSON.parse(String(data))
      if (msg.method === 'event' && ['message.delta', 'message.complete'].includes(msg.params?.type) && msg.params.payload.text === 'OK') msg.params.payload.text = answer
      socket.send(JSON.stringify(msg))
    })
  })
  await pg.goto(WEB + '/')
  const input = pg.getByPlaceholder('Message Hermes')
  await input.waitFor({ timeout: 15000 })
  check(await pg.title() !== '' && await pg.locator('.composer').isVisible(), 'direction: app identity and nonblank screen')
  await input.fill('قبل Hermes بعد\nHello world\nمرحبا 123')
  check(await input.evaluate(e => getComputedStyle(e).direction) === 'rtl', 'direction: Arabic input aligns from the right')
  await pg.locator('.composer').getByRole('button', { name: 'Send', exact: true }).click()
  const md = pg.locator('.msg.assistant .md').last()
  await md.locator('p', { hasText: 'قبل Hermes بعد' }).waitFor({ timeout: 15000 })
  await pg.locator('.composer').getByRole('button', { name: 'Stop', exact: true }).waitFor({ state: 'hidden' })
  const userLines = pg.locator('.msg.user .plain-line')
  check(JSON.stringify(await userLines.evaluateAll(es => es.map(e => getComputedStyle(e).direction))) === JSON.stringify(['rtl', 'ltr', 'rtl']), 'direction: every user line detects its own language')
  check(await pg.locator('.msg.user .plain-text').last().textContent() === 'قبل Hermes بعد\nHello world\nمرحبا 123', 'direction: user text and newlines stay unchanged')
  const mixed = md.locator('p', { hasText: 'قبل Hermes بعد' })
  const order = await mixed.evaluate(el => {
    const words = ['قبل', 'Hermes', 'بعد']
    return words.map(word => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      let node
      while ((node = walker.nextNode())) {
        const i = node.textContent.indexOf(word)
        if (i < 0) continue
        const range = document.createRange()
        range.setStart(node, i); range.setEnd(node, i + word.length)
        return range.getBoundingClientRect().x
      }
      return null
    })
  })
  check(order.every(x => x !== null) && order[0] > order[1] && order[1] > order[2], `direction: mixed words appear in right-to-left reading order (${order})`)
  check(await md.locator('p', { hasText: 'Hello world' }).evaluate(e => getComputedStyle(e).direction) === 'ltr', 'direction: English paragraph stays left-to-right')
  check(JSON.stringify(await md.locator('li:not(.task-list-item)').evaluateAll(es => es.map(e => getComputedStyle(e).direction))) === '["rtl","ltr"]', 'direction: list items detect their language')
  const tasks = md.locator('.task-list-item')
  check(JSON.stringify(await tasks.evaluateAll(es => es.map(e => getComputedStyle(e).direction))) === '["rtl","ltr"]', 'direction: task items detect each language')
  check(await tasks.evaluateAll(es => es.every(e => { const box = e.querySelector('.task-box').getBoundingClientRect(); const r = e.getBoundingClientRect(); return box.left >= r.left - 1 && box.right <= r.right + 1 && (getComputedStyle(e).direction === 'rtl' ? Math.abs(box.right-r.right) < 2 : Math.abs(box.left-r.left) < 2) })), 'direction: task checkboxes stay in their gutter on the reading side')
  await tasks.first().getByRole('checkbox').click()
  check(await tasks.first().getByRole('checkbox').getAttribute('aria-checked') === 'true', 'direction: Arabic task checkbox still toggles')
  check(await md.locator('td').first().evaluate(e => getComputedStyle(e).direction) === 'rtl', 'direction: Arabic table cell aligns right')
  check(await md.locator('a').first().evaluate(e => getComputedStyle(e).unicodeBidi) === 'isolate', 'direction: links are isolated')
  check(await md.locator('pre').evaluate(e => getComputedStyle(e).direction) === 'ltr', 'direction: code remains left-to-right')
  const leadingCode = md.locator('p', { hasText: 'Hermes ده نص عربي يبدأ بكود' })
  check(await leadingCode.evaluate(e => getComputedStyle(e).direction) === 'rtl', 'direction: English inline code does not set Arabic paragraph direction')
  check(await leadingCode.locator('code').getAttribute('dir') === 'ltr', 'direction: renderer preserves code dir attribute, not CSS alone')
  check(await md.locator('blockquote p').evaluate(e => getComputedStyle(e).direction) === 'rtl', 'direction: Arabic quotation and its parent agree after inline code')
  const setDirection = async label => {
    await pg.getByRole('button', { name: /^Sessions/ }).click()
    await pg.locator('.nav-tile', { hasText: 'Settings' }).click()
    await pg.locator('.set-row', { hasText: 'Theme and text size' }).click()
    await pg.locator('.set-row', { hasText: 'اتجاه النص / Text direction' }).click()
    await pg.locator('.picker-opt', { hasText: label }).click()
    await pg.getByRole('button', { name: 'Back', exact: true }).click()
    await pg.getByRole('button', { name: 'Back', exact: true }).click()
  }
  await setDirection('من اليمين إلى اليسار / Right to left')
  check(await md.locator('p', { hasText: 'Hello world' }).evaluate(e => getComputedStyle(e).direction) === 'rtl', 'direction: manual RTL immediately updates existing replies')
  await setDirection('من اليسار إلى اليمين / Left to right')
  check(await mixed.evaluate(e => getComputedStyle(e).direction) === 'ltr', 'direction: manual LTR updates mixed replies')
  await pg.reload()
  await input.waitFor({ timeout: 15000 })
  check(await input.getAttribute('dir') === 'ltr' && await pg.evaluate(() => localStorage.getItem('hm.textDirection.v1')) === 'ltr', 'direction: manual preference survives reload')
  await setDirection('تلقائي / Automatic')
  await input.fill('English first\nثم العربية')
  check(await input.evaluate(e => getComputedStyle(e).direction) === 'ltr', 'direction: English input returns to automatic LTR')
  await input.fill('قبل Hermes بعد')
  await pg.locator('.composer').getByRole('button', { name: 'Send', exact: true }).click()
  await pg.locator('.msg.user').last().getByRole('button', { name: 'Edit', exact: true }).click()
  check(await pg.locator('.edit-box').evaluate(e => getComputedStyle(e).direction) === 'rtl', 'direction: message editor detects Arabic')
  await pg.getByRole('button', { name: 'Cancel', exact: true }).click()
  await pg.screenshot({ path: path.join(SHOTS, 'hermes-text-direction-mobile.png') })
  await pg.setViewportSize({ width: 1100, height: 850 })
  await pg.screenshot({ path: path.join(SHOTS, 'hermes-text-direction-desktop.png') })
  check(errors.length === 0, `direction: no browser errors (${errors.join('; ')})`)
  check(await pg.locator('vite-error-overlay').count() === 0, 'direction: no framework error overlay')
  await pg.close()
}
