const { WEB, calls, check } = require('../lib.cjs')

module.exports = async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'en-US' })
  try {
    await page.goto(WEB + '/')
    await page.getByPlaceholder('Message Hermes').waitFor()
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Knowledge', exact: true }).click()
    const knowledge = page.getByRole('region', { name: 'Knowledge', exact: true })
    await knowledge.getByRole('button', { name: /Skills/ }).click()
    await page.locator('.screen .topbar').getByText(/Knowledge · Skills/).waitFor()

    await page.getByRole('button', { name: 'Available' }).click()
    await page.getByText('weather-helper', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Install', exact: true }).click()
    await page.getByRole('button', { name: /Installed/ }).click()
    await page.getByText('weather-helper', { exact: true }).waitFor()
    check(calls().some(c => c.http === 'POST' && c.path === '/api/skills/hub/install' && c.body?.identifier === 'official/general/weather-helper'), 'Knowledge installs an optional skill from the official catalog')
    check(calls().some(c => c.http === 'GET' && c.path.startsWith('/api/actions/skills-install-weather-helper-12345678/status')), 'Knowledge tracks the install result and refreshes its installed list')
  } finally {
    await page.close()
  }
}
