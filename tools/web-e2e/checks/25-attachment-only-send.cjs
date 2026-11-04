// Send a camera photo, gallery image or document with an empty text box.
const { addFiles, rpcs, sleep, check, png } = require('../lib.cjs')

module.exports = async ({ page }) => {
  await page.evaluate(() => {
    window.__compactThinking = []
    window.__compactObserver = new MutationObserver(() => {
      for (const el of document.querySelectorAll('.hm-working-presence, .reasoning.live:not(.open)')) {
        const face = el.querySelector('.hm-presence')
        if (!face) continue
        window.__compactThinking.push({ width: face.getBoundingClientRect().width, text: el.textContent.trim(), border: getComputedStyle(el).borderTopWidth, background: getComputedStyle(el).backgroundColor })
      }
    })
    window.__compactObserver.observe(document.body, { subtree: true, childList: true, attributes: true })
  })
  for (const [option, file, expected] of [
    ['Camera', { name: 'camera-only.jpg', mimeType: 'image/jpeg', buffer: png }, 'Please review the attached images.'],
    ['Photo', { name: 'gallery-only.png', mimeType: 'image/png', buffer: png }, 'Please review the attached images.'],
    ['File', { name: 'document-only.txt', mimeType: 'text/plain', buffer: Buffer.from('Attachment without a caption') }, '@file:ws/document-only.txt']
  ]) {
    await page.getByPlaceholder('Message Hermes').waitFor({ timeout: 15000 })
    await page.getByPlaceholder('Message Hermes').fill('')
    await addFiles(page, option, [file])
    await page.getByRole('button', { name: `Remove ${file.name}`, exact: true }).waitFor()
    const send = page.getByRole('button', { name: 'Send', exact: true })
    check(await send.isEnabled(), `${option}: Send is enabled without text`)
    check(await page.getByRole('button', { name: 'Dictate', exact: true }).count() === 0, `${option}: microphone does not replace Send`)
    const before = rpcs('prompt.submit').length
    await send.click()
    for (let n = 0; n < 50 && rpcs('prompt.submit').length === before; n++) await sleep(100)
    check(rpcs('prompt.submit').length === before + 1 && rpcs('prompt.submit').at(-1).params.text === expected, `${option}: attachment-only prompt reaches Hermes`)
    check(await page.locator('.msg.user').last().locator('.chip', { hasText: file.name }).count() > 0 || await page.locator('.msg.user').last().locator(`img[alt="${file.name}"]`).count() > 0, `${option}: attachment appears in the sent message`)
    check(await page.locator('.composer-wrap .attach-chip').count() === 0, `${option}: sent attachments leave the composer`)
    check(await page.locator('.hm-live-summary').count() === 0, 'no large bottom animation panel')
    await page.getByPlaceholder('Message Hermes').waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Stop', exact: true }).waitFor({ state: 'detached', timeout: 15000 })
  }
  const observed = await page.evaluate(() => {
    window.__compactObserver.disconnect()
    return window.__compactThinking
  })
  check(observed.length > 0 && observed.every(x => x.width === 22 && !x.text && x.border === '0px' && x.background === 'rgba(0, 0, 0, 0)'), 'live thinking shows only a 22 px face without a box or caption')
}
