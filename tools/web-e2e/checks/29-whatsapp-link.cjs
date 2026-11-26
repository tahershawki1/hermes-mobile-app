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
  await whatsapp.getByText(/not sent by SMS/i).waitFor()
  await whatsapp.getByPlaceholder('+201234567890').fill('+201001234567')
  check(await whatsapp.getByText('Enable WhatsApp? (true/false)').count() === 0, 'raw WhatsApp engine settings stay out of the simple linking screen')
  check(await whatsapp.getByRole('button', { name: 'Turn on' }).count() === 0, 'linking a phone does not require a separate channel toggle')
  await whatsapp.getByRole('button', { name: 'Link by phone' }).click()
  await whatsapp.getByText(/Preparing the WhatsApp bridge/i).waitFor()
  await whatsapp.getByText('ABCD-1234', { exact: true }).waitFor()
  check(true, 'WhatsApp pairing code is requested for the entered phone number')
  await whatsapp.getByText(/enter this code/i).waitFor()

  await whatsapp.getByText('+201001234567', { exact: true }).first().waitFor({ timeout: 5000 })
  await page.getByText('WhatsApp connected.', { exact: true }).waitFor()
  check(true, 'the verified phone is saved and connected automatically')
  check(calls().some(c => c.http === 'POST' && c.path === '/api/messaging/whatsapp/onboarding/start' && c.body?.mode === 'bot' && c.body?.pairing_method === 'phone' && c.body?.phone_number === '+201001234567'), 'phone pairing starts through the WhatsApp onboarding API with the entered number')
  check(calls().some(c => c.http === 'GET' && c.path === '/api/messaging/whatsapp/onboarding/wa-pair-1'), 'the app polls the pairing session until the phone is linked')
  check(calls().some(c => c.http === 'POST' && c.path === '/api/messaging/whatsapp/onboarding/wa-pair-1/apply'), 'linked WhatsApp phone is saved and the gateway restart is requested')

  await whatsapp.getByRole('button', { name: 'QR code', exact: true }).click()
  await whatsapp.getByRole('button', { name: 'Change link', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Continue', exact: true }).click()
  await whatsapp.getByRole('img', { name: 'WhatsApp linking QR code' }).waitFor()
  await whatsapp.getByText(/scan this QR code/i).waitFor()
  check(calls().some(c => c.http === 'POST' && c.path === '/api/messaging/whatsapp/onboarding/start' && c.body?.pairing_method === 'qr'), 'QR pairing can be selected and requested without a phone number')
  } finally {
    await page.close()
  }
}
