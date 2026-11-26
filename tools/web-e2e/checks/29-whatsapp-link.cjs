const { calls, check, WEB } = require('../lib.cjs')

module.exports = async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'en-US' })
  try {
  await page.goto(WEB + '/')
  await page.getByPlaceholder('Message Hermes').waitFor()
  const nav = page.getByRole('navigation', { name: 'Main navigation' })
  await nav.getByRole('button', { name: 'More', exact: true }).click()
  const more = page.getByRole('region', { name: 'More', exact: true })
  await more.getByRole('button', { name: /Messaging channels/ }).click()
  await page.locator('.screen .topbar').getByText('Messaging channels', { exact: true }).waitFor()

  const whatsapp = page.locator('.hm-channel-card', { hasText: 'WhatsApp' })
  await whatsapp.getByRole('button', { name: /WhatsApp/ }).click()
  await whatsapp.getByRole('button', { name: 'Link WhatsApp phone' }).click()
  await whatsapp.getByRole('img', { name: 'WhatsApp linking QR code' }).waitFor()
  check(true, 'WhatsApp pairing starts and displays a QR code generated on-device')

  await whatsapp.getByText('+201001234567', { exact: true }).first().waitFor({ timeout: 5000 })
  check(true, 'the linked phone number is shown after the pairing status reports connected')
  await whatsapp.getByRole('button', { name: 'Save and connect' }).click()
  await page.getByText(/WhatsApp phone linked; gateway restart started/).waitFor()
  check(calls().some(c => c.http === 'POST' && c.path === '/api/messaging/whatsapp/onboarding/start' && c.body?.mode === 'bot'), 'phone pairing starts through the WhatsApp onboarding API')
  check(calls().some(c => c.http === 'GET' && c.path === '/api/messaging/whatsapp/onboarding/wa-pair-1'), 'the app polls the pairing session until the phone is linked')
  check(calls().some(c => c.http === 'POST' && c.path === '/api/messaging/whatsapp/onboarding/wa-pair-1/apply'), 'linked WhatsApp phone is saved and the gateway restart is requested')
  } finally {
    await page.close()
  }
}
