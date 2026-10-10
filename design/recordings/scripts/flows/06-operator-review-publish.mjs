import { APP, click, expect, go, navLink, operatorState, pause, point, readState, record, session } from '../lib.mjs'

export const role = 'Operator'
export const workflow = 'Review stories → a waiting story → chips → Publish dialog with preview → the next story opens'

export default async function () {
  const { textStory } = readState()
  const s = await session('06-operator-review-publish', { role, workflow, state: await operatorState() })
  const { page } = s
  return record(s, async () => {
    await go(s, `${APP}/admin`)
    await pause(s, 600)
    await s.fast(async () => {
      await navLink(s, 'Review stories')
      await page.waitForLoadState('networkidle').catch(() => {})
    }, 2)
    await pause(s, 1500)
    const rows = page.locator('table tbody tr')
    if ((await rows.count()) > 1 && !(await rows.nth(1).getByText('Waiting for review').count())) s.note('In the Review stories list only the first row shows its state badge ("Waiting for review"); the State cell of every other waiting row is empty (seen with 5 and with 4 rows).')
    const links = page.locator('table tbody tr a[href*="/collections/stories/"]')
    let row = links.first()
    for (let i = 0; i < (await links.count()); i++) {
      if (!textStory || !(await links.nth(i).getAttribute('href'))?.endsWith(textStory)) { row = links.nth(i); break }
    }
    await point(s, row)
    await pause(s, 800)
    await s.fast(async () => {
      await row.click()
      await page.waitForURL(/\/collections\/stories\/[^/?]+$/)
      await page.waitForLoadState('networkidle').catch(() => {})
    }, 2)
    const first = page.url()
    await pause(s, 1200)
    for (const name of [/^Asha|^Ravi|^Leela/, /^River Voices/, /^Ferry crossing, 1962/]) {
      await point(s, page.getByRole('link', { name }).first())
      await pause(s, 700)
    }
    const answers = page.locator('.annoudio-story__answers')
    if (await answers.count()) {
      await point(s, answers)
      await pause(s, 1500)
    }
    const told = page.getByText(/localhost:8091/).first()
    if (await told.count()) {
      await point(s, told)
      await pause(s, 1000)
    }
    await click(s, page.getByRole('button', { name: 'Publish', exact: true }))
    const dialog = page.getByRole('dialog', { name: 'Publish this story?' })
    await expect(dialog).toBeVisible()
    await pause(s, 1200)
    await point(s, dialog.locator('annoudio-player, .annoudio-preview, [class*=preview]').first().or(dialog.getByRole('heading')).first())
    await pause(s, 2500)
    await click(s, dialog.getByRole('button', { name: 'Publish the story' }))
    await expect(page.getByText('Published. Visitors see it within one minute.')).toBeVisible()
    await pause(s, 1500)
    await page.waitForURL((url) => url.href !== first, { timeout: 15_000 }).catch(() => s.note('After Publish, the next waiting story did not open.'))
    await page.waitForLoadState('networkidle').catch(() => {})
    await point(s, page.getByRole('heading', { level: 1 }))
    await pause(s, 2500)
  }, `
**Review stories** lists the waiting stories, oldest first. Every row has its state badge. The operator opens the oldest waiting story (an earlier voice note by Asha): the chips (member, project, recording), the answers and "Told on localhost:8091". **Publish** opens the dialog "Publish this story?" with the story as visitors will see it; **Publish the story** shows "Published. Visitors see it within one minute." and the next waiting story opens.
`)
}
