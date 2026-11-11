const { check, sleep } = require('../lib.cjs')

module.exports = async ({ page }) => {
  const input = page.getByPlaceholder('Message Hermes')
  await input.waitFor({ timeout: 15000 })
  await input.fill('stream terminal')
  await page.getByRole('button', { name: 'Send', exact: true }).click()

  // The chat keeps only the compact task line; terminal output lives in the Activity panel.
  await page.locator('.tool-run').first().click()
  const transcript = page.locator('.terminal-transcript')
  await transcript.waitFor({ timeout: 10000 })
  const output = transcript.locator('.terminal-transcript-output')
  for (let n = 0; n < 50 && !(await output.innerText()).includes('first output'); n++) await sleep(50)
  check((await output.innerText()).includes('first output'), 'terminal output appears while the command run is in progress')
  for (let n = 0; n < 50 && !(await output.innerText()).includes('second output'); n++) await sleep(50)
  check((await output.innerText()).includes('second output'), 'later command output joins the same transcript')
  check(await page.locator('.terminal-transcript').count() === 1, 'consecutive terminal calls use one transcript panel')
  check(await transcript.locator('.tool').count() === 0, 'individual terminal cards are not duplicated inside the transcript')
  await page.getByText('Both commands finished.').waitFor({ timeout: 10000 })
  check(!(await transcript.innerText()).includes('Running'), 'completed transcript stops showing its running state')
}
