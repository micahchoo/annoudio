// A member on the Annotate page.

import { expect, type Page } from '@playwright/test'

/** Sign in through the forms. The code comes from the test mailbox. */
export async function signIn(page: Page, email: string, nickname: string) {
  await page.getByRole('textbox', { name: 'Email' }).fill(email)
  await page.getByRole('button', { name: 'Send the code' }).click()
  await expect(page.getByRole('heading', { name: 'Type your login code' })).toBeVisible()
  const response = await page.request.get(`/test-mailbox?${new URLSearchParams({ to: email })}`)
  const mail = (await response.json()) as { text: string }
  const code = /\b(\d{6})\b/.exec(mail.text)?.[1] ?? ''
  await page.getByRole('textbox', { name: 'Login code' }).fill(code)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Choose your name' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Name' }).fill(nickname)
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.locator('.member-menu summary')).toContainText(nickname)
}
