import { APP, click, expect, go, operatorState, pause, point, record, saveState, session, type } from '../lib.mjs'

export const role = 'Operator'
export const workflow = 'Project → Sign-in tab → Make invite codes → the list of codes'

export default async function () {
  const s = await session('08-operator-invite-codes', { role, workflow, state: await operatorState() })
  const { page } = s
  return record(s, async () => {
    await go(s, `${APP}/admin/collections/projects`)
    await pause(s, 800)
    await s.fast(async () => {
      await click(s, page.getByRole('link', { name: 'River Voices' }).first())
      await page.waitForLoadState('networkidle').catch(() => {})
    }, 2)
    await pause(s, 1000)
    const settings = page.getByRole('link', { name: 'Settings', exact: true }).last()
    if (/overview$/.test(page.url())) await click(s, settings)
    await page.waitForLoadState('networkidle').catch(() => {})
    await click(s, page.getByRole('button', { name: 'Sign-in', exact: true }))
    const region = page.getByRole('region', { name: 'Invite codes' })
    await expect(region).toBeVisible()
    await point(s, page.getByRole('combobox', { name: 'How members sign in' }))
    await pause(s, 1500)
    await point(s, region.getByRole('heading', { name: 'Invite codes', exact: true }))
    await pause(s, 1200)
    await type(s, region.getByRole('spinbutton', { name: 'How many codes' }), '3')
    await type(s, region.getByRole('spinbutton', { name: 'Members per code' }), '30')
    await type(s, region.getByRole('textbox', { name: 'Label (optional)' }), 'Workshop 12 Oct')
    await pause(s, 600)
    await click(s, region.getByRole('button', { name: 'Make invite codes' }))
    await pause(s, 1500)
    // The new codes show in full once; the table keeps only their first two letters.
    const full = await page.locator('code').allTextContents()
    const codes = full.map((c) => c.trim()).filter((c) => /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c))
    if (codes.length) saveState({ inviteCodes: codes })
    else s.note('After "Make invite codes" the new codes are not shown in full on the page.')
    const shown = page.getByText(/[A-Z0-9]{4}-[A-Z0-9]{4}/).first()
    if (await shown.count()) {
      await point(s, shown)
      await pause(s, 2500)
    }
    await point(s, region.getByRole('table'))
    await pause(s, 1200)
    const row = region.getByRole('row', { name: /Workshop 12 Oct/ }).first()
    await point(s, row)
    await pause(s, 2500)
  }, `
The operator opens the project River Voices from **Projects**, then **Settings** and the tab **Sign-in**. "How members sign in" is "Both". Under **Invite codes**, 3 codes, 30 members per code, label "Workshop 12 Oct", then **Make invite codes**. The new codes show in full once; the table lists every code by its first letters, with label, uses, last day and state.
`)
}
