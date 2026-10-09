import { expect, test } from '@playwright/test'

test('the root of the stack goes to the member home, Your stories', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/annotate\/mine$/)
})
