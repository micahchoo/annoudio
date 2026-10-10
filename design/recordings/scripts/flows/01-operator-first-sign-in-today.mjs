import { APP, OPERATOR, click, expect, go, pause, point, poster, record, session, type } from '../lib.mjs'

export const role = 'Operator'
export const workflow = 'Sign in; Today with "What Annoudio does" and the counts'

export default async function () {
  const s = await session('01-operator-first-sign-in-today', { role, workflow })
  const { page } = s
  return record(s, async (setPoster) => {
    await go(s, `${APP}/admin`)
    await expect(page.getByRole('textbox', { name: /Email/ })).toBeVisible()
    await pause(s, 1200)
    if (await page.locator('.graphic-logo').count()) {
      s.note('The sign-in screen shows the Payload logo above "Sign in to Annoudio": the first thing an operator sees names another product.')
    }
    await type(s, page.getByRole('textbox', { name: /Email/ }), OPERATOR.email)
    await type(s, page.getByLabel(/Password/).first(), OPERATOR.password, { delay: 20 })
    await s.fast(async () => {
      await click(s, page.getByRole('button', { name: 'Sign in' }))
      await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible({ timeout: 20_000 })
      await page.waitForLoadState('networkidle').catch(() => {})
    }, 2)
    await pause(s, 1200)
    const what = page.locator('details', { hasText: 'What Annoudio does' }).first()
    await point(s, what)
    if (!(await what.evaluate((d) => d.open).catch(() => true))) {
      const tall = (await what.boundingBox())?.height ?? 0
      if (tall > 80) s.note(`"What Annoudio does" is folded but ${Math.round(tall)} px high: it looks broken more than folded.`)
      await click(s, what.locator('summary'))
    }
    await pause(s, 2500)
    for (const name of [/Waiting for review/, /Processing/, /Returned to members/]) {
      await point(s, page.getByRole('link', { name }))
      await pause(s, 700)
    }
    await point(s, page.getByText(/^Last 7 days:/))
    setPoster(await poster(s))
    await pause(s, 1500)
  }, `
The operator signs in to the admin and lands on **Today**. The help "What Annoudio does" opens, then the three counts (Waiting for review, Processing, Returned to members) and the line "Last 7 days".
`)
}
