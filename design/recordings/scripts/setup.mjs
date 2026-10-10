// Setup steps that the videos do not show, done through the admin as a person would
// (the REST API cannot publish a story the way the Publish button does).

import { APP, chromium, expect, operatorState } from './lib.mjs'

/** Publish the newest waiting story or reply whose row text matches, with the Publish button. */
export async function publishInAdmin(text) {
  const browser = await chromium.launch({ args: ['--mute-audio'] })
  const context = await browser.newContext({ storageState: await operatorState(), viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  try {
    await page.goto(`${APP}/admin/collections/stories`)
    const row = page.locator('table tbody tr').filter({ hasText: text }).first()
    if (!(await row.count())) return false
    await row.locator('a').first().click()
    await page.waitForURL(/\/collections\/stories\/[^/?]+$/)
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: /^Publish the/ }).click()
    await expect(page.getByText(/^Published\. Visitors see it/).first()).toBeVisible()
    return true
  } finally {
    await browser.close()
  }
}

/** Wait (no video) until a host page's widget shows the text: the stories cache is up to 60 s. */
export async function waitForWidget(url, text, timeout = 90_000) {
  const browser = await chromium.launch({ args: ['--mute-audio'] })
  const page = await browser.newPage()
  const end = Date.now() + timeout
  try {
    for (;;) {
      await page.goto(url)
      const found = await page
        .locator('annoudio-player')
        .first()
        .getByText(text)
        .first()
        .waitFor({ timeout: 8000 })
        .then(() => true, () => false)
      if (found) return true
      if (Date.now() > end) return false
      await page.waitForTimeout(5000)
    }
  } finally {
    await browser.close()
  }
}
