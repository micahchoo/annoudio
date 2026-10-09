import { test, expect, Page } from '@playwright/test'
import { E2E_ORIGIN } from './env'
import { login } from '../helpers/login'
import { seedTestUser, cleanupTestUser, testUser } from '../helpers/seedUser'

test.describe('Admin Panel', () => {
  let page: Page

  test.beforeAll(async ({ browser }, testInfo) => {
    await seedTestUser()

    const context = await browser.newContext()
    page = await context.newPage()

    await login({ page, user: testUser })
  })

  test.afterAll(async () => {
    await cleanupTestUser()
  })

  test('can navigate to dashboard', async () => {
    await page.goto(`${E2E_ORIGIN}/admin`)
    await expect(page).toHaveURL(`${E2E_ORIGIN}/admin`)
    const dashboardArtifact = page.locator('span[title="Today"]').first()
    await expect(dashboardArtifact).toBeVisible()
  })

  test('can navigate to list view', async () => {
    await page.goto(`${E2E_ORIGIN}/admin/collections/users`)
    await expect(page).toHaveURL(`${E2E_ORIGIN}/admin/collections/users`)
    const listViewArtifact = page.locator('h1', { hasText: 'Operators' }).first()
    await expect(listViewArtifact).toBeVisible()
  })

  test('can navigate to edit view', async () => {
    await page.goto(`${E2E_ORIGIN}/admin/collections/users/create`)
    await expect(page).toHaveURL(/\/admin\/collections\/users\/[a-zA-Z0-9-_]+/)
    const editViewArtifact = page.locator('input[name="email"]')
    await expect(editViewArtifact).toBeVisible()
  })
})
