import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { E2E_ORIGIN } from '../e2e/env'

export interface LoginOptions {
  page: Page
  serverURL?: string
  user: {
    email: string
    password: string
  }
}

/**
 * Logs the user into the admin panel via the login page.
 */
export async function login({ page, serverURL = E2E_ORIGIN, user }: LoginOptions): Promise<void> {
  await page.goto(`${serverURL}/admin/login`)

  await page.fill('#field-email', user.email)
  await page.fill('#field-password', user.password)
  await page.click('button[type="submit"]')

  await page.waitForURL(`${serverURL}/admin`)

  const dashboardArtifact = page.locator('span[title="Today"]')
  await expect(dashboardArtifact).toBeVisible()
}
