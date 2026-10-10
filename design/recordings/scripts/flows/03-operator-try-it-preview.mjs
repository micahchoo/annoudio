import { APP, click, expect, go, operatorState, pause, point, poster, record, session } from '../lib.mjs'

export const role = 'Operator'
export const workflow = 'Recording page → Try it → preview page with the live widget → Open the Annotate page'

export default async function () {
  const s = await session('03-operator-try-it-preview', { role, workflow, state: await operatorState() })
  const { page } = s
  return record(s, async (setPoster) => {
    await go(s, `${APP}/admin/collections/recordings/1`)
    const widgets = page.getByRole('region', { name: 'Widgets of this recording' })
    await expect(widgets).toBeVisible()
    await pause(s, 1000)
    await point(s, widgets.getByRole('heading'))
    await pause(s, 800)
    await point(s, widgets.locator('code').first())
    await pause(s, 1200)
    await s.fast(async () => {
      await click(s, widgets.getByRole('link', { name: 'Try it: tell a story' }).first())
      await page.waitForURL(/\/annotate\?/)
      await page.waitForLoadState('networkidle').catch(() => {})
    }, 2)
    await pause(s, 2000)
    s.note('On a 1280 px screen the Annotate page is a narrow column at the left edge; two thirds of the window stay empty.')
    const back = page.getByRole('link', { name: /Back to the site/ }).first()
    await point(s, back)
    await pause(s, 1000)
    await s.fast(async () => {
      await back.click()
      await page.waitForURL(/\/admin\/preview\//)
      await page.waitForLoadState('networkidle').catch(() => {})
    }, 2)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Ferry crossing, 1962')
    await pause(s, 1500)
    if ((await page.evaluate(() => scrollY)) > 50) s.note('"Back to the site" lands on the preview page scrolled down to the widget: the heading and the help line ("This is the widget as visitors see it…") are above the fold, so the operator does not see where they are.')
    const widget = page.locator('annoudio-player')
    const play = widget.getByRole('button', { name: 'Play' })
    await click(s, play)
    await pause(s, 2500)
    await click(s, widget.getByRole('button', { name: /^Story by Leela, 0:02/ }))
    await pause(s, 2500)
    setPoster(await poster(s))
    const annotate = page.getByRole('link', { name: 'Open the Annotate page' })
    await point(s, annotate)
    await pause(s, 800)
    await s.fast(async () => {
      await annotate.click()
      await page.waitForURL(/\/annotate\?/)
      await page.waitForLoadState('networkidle').catch(() => {})
    }, 2)
    await pause(s, 2500)
  }, `
On the recording page, the region "Widgets of this recording" shows the Annotate address and **Try it: tell a story**. Try it opens the Annotate page as a member sees it, with **Back to the site**; that link goes to the operator's preview page. There the live widget plays and opens a story. **Open the Annotate page** opens the member's page again.
`)
}
