const { calls, check } = require('../lib.cjs')

module.exports = async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Main navigation' })
  await nav.getByRole('button', { name: 'More', exact: true }).click()
  const more = page.getByRole('region', { name: 'More', exact: true })
  await more.getByRole('button', { name: /Messaging channels/ }).click()
  await page.locator('.screen .topbar').getByText('Messaging channels', { exact: true }).waitFor()

  const telegram = page.locator('.hm-channel-card', { hasText: 'Telegram' })
  await telegram.waitFor()
  await telegram.getByRole('button', { name: /Telegram/ }).click()
  const token = telegram.locator('input').first()
  await token.waitFor()
  check(await token.inputValue() === '', 'saved Telegram token is never prefilled into the password input')
  check(await token.getAttribute('placeholder') === 'Saved securely', 'saved credentials are represented by a safe placeholder')

  await telegram.getByRole('button', { name: 'Test connection' }).click()
  await telegram.getByText('Telegram is connected.', { exact: true }).waitFor()
  check(true, 'the channel Test action displays the backend connectivity result')

  await token.fill('fixture-token-987654321')
  await telegram.getByRole('button', { name: 'Save setup' }).click()
  await page.getByText('Saved channel changes need a gateway restart.', { exact: true }).waitFor()
  await token.waitFor()
  check(await token.inputValue() === '', 'saving resets the secret field instead of rendering its value')
  const put = calls().find(c => c.http === 'PUT' && c.path === '/api/messaging/platforms/telegram' && c.body?.env?.TELEGRAM_BOT_TOKEN)
  check(put?.body?.env?.TELEGRAM_BOT_TOKEN === 'fixture-token-987654321', 'Save sends only the edited credential to the platform endpoint')

  await telegram.getByRole('button', { name: 'Turn off' }).click()
  check(calls().some(c => c.http === 'PUT' && c.path === '/api/messaging/platforms/telegram' && c.body?.enabled === false), 'channel enablement changes use the platform API')
  await telegram.getByRole('button', { name: 'Turn on' }).click()
  await page.getByText('Saved channel changes need a gateway restart.', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Restart gateway' }).click()
  const confirm = page.getByRole('alertdialog')
  await confirm.getByRole('button', { name: 'Restart', exact: true }).click()
  await page.getByText('Gateway restart started', { exact: true }).waitFor()
  check(calls().some(c => c.http === 'POST' && c.path === '/api/gateway/restart'), 'Restart gateway sends the explicit restart action')
}
