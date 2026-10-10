import { APP, click, expect, go, operatorState, pause, point, record, session } from '../lib.mjs'

export const role = 'Operator'
export const workflow = 'Relationships: recording "Used in projects" → project Overview → Members → a member page'

export default async function () {
  const s = await session('09-operator-relationships', { role, workflow, state: await operatorState() })
  const { page } = s
  return record(s, async () => {
    await go(s, `${APP}/admin/collections/recordings/1`)
    const widgets = page.getByRole('region', { name: 'Widgets of this recording' })
    await expect(widgets).toBeVisible()
    await pause(s, 1200)
    const chip = widgets.getByRole('link', { name: /^River Voices\s*(\d+ (stories|published)|No stories)/ })
    await point(s, chip)
    const chipText = (await chip.textContent()).replace(/\s+/g, ' ')
    await pause(s, 1800)
    await s.fast(async () => {
      await click(s, widgets.getByRole('link', { name: 'River Voices', exact: true }))
      await page.waitForURL(/\/overview$/)
      await page.waitForLoadState('networkidle').catch(() => {})
    }, 2)
    await pause(s, 1500)
    const published = page.getByRole('link', { name: /Published/ }).first()
    const publishedText = (await published.textContent()).replace(/\s+/g, ' ')
    const n = Number(/(\d+)/.exec(chipText)?.[1] ?? 0)
    const p = Number(/(\d+)/.exec(publishedText)?.[1] ?? 0)
    if (!/published/.test(chipText) && n !== p) s.note(`The recording page says "${chipText.trim().replace(/(\D)(\d)/, "$1 · $2")}", but the widget and the Overview's "Published" say ${p}: the chip counts the stories that wait too, and nothing says so.`)
    for (const name of [/Waiting for review/, /Published/]) {
      await point(s, page.getByRole('link', { name }).first())
      await pause(s, 900)
    }
    await point(s, page.getByRole('region', { name: 'Widgets of this project' }))
    await pause(s, 1200)
    const members = page.getByRole('link', { name: /members told stories here/ })
    if (!(await members.count())) {
      s.note('On the Overview, "N members told stories here" is not a link.')
      await go(s, `${APP}/admin/collections/members`)
    } else {
      await point(s, members)
      await pause(s, 1200)
      await s.fast(async () => {
        await members.click()
        await page.waitForURL(/\/collections\/members/)
        await page.waitForLoadState('networkidle').catch(() => {})
      }, 2)
    }
    await pause(s, 1500)
    const asha = page.locator('table tbody tr a', { hasText: 'Asha' }).first()
    await point(s, asha)
    await pause(s, 800)
    await s.fast(async () => {
      await asha.click()
      await page.waitForURL(/\/collections\/members\/\d+/)
      await page.waitForLoadState('networkidle').catch(() => {})
    }, 2)
    await pause(s, 1500)
    await page.mouse.wheel(0, 300)
    await pause(s, 2500)
  }, `
On the recording page, "Used in projects" has the chip **River Voices · N published · N waiting** (it opens those stories) and the project link. The project link opens the project **Overview**: counts that open their lists, the widgets of the project with the same per-state chip, and the chip **N members told stories here**, which opens **Members**. A member opens with the member's stories by state and invite codes.
`)
}
