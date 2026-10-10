import { APP, PROJECT, RECORDING, click, expect, go, navLink, operatorState, pause, point, readState, record, session, type } from '../lib.mjs'

export const role = 'Operator as member'
export const workflow = 'Preview page → Annotate → send → back to the preview → review → publish → the widget shows it'

const TEXT = 'Operator test: the engine slows down before the landing.'

export default async function () {
  const code = readState().inviteCodes?.[1] ?? 'YRNZ-PADE'
  const s = await session('16-operator-walks-member-flow-from-preview', { role, workflow, state: await operatorState() })
  const { page } = s
  const widget = page.locator('annoudio-player').first()
  const preview = `${APP}/admin/preview/${PROJECT}/${RECORDING}`
  return record(s, async () => {
    await go(s, preview)
    await expect(widget.getByRole('button', { name: 'Play' })).toBeVisible()
    await point(s, page.getByRole('heading', { level: 1 }))
    await pause(s, 1500)
    const tell = widget.locator('[part~="annotate-link"]')
    await point(s, tell)
    await pause(s, 600)
    await s.fast(async () => {
      await tell.click()
      await page.waitForURL(/\/annotate\?/)
      await page.waitForLoadState('networkidle').catch(() => {})
    }, 2)
    await pause(s, 800)

    // Sign in as a member, with an invite code (the operator account is not a member account).
    if (await page.getByRole('button', { name: 'Have an invite code?' }).count()) {
      s.note('The operator, signed in to the admin, must sign in again as a member on the Annotate page: the admin sign-in does not count there.')
      await click(s, page.getByRole('button', { name: 'Have an invite code?' }))
      await type(s, page.getByRole('textbox', { name: 'Email' }), 'operator@example.org')
      await type(s, page.getByRole('textbox', { name: 'Invite code' }), code)
      await s.fast(async () => {
        await click(s, page.getByRole('button', { name: 'Sign in' }))
        await page.waitForLoadState('networkidle').catch(() => {})
      }, 2)
      const name = page.getByRole('textbox', { name: 'Name' })
      if (await name.isVisible().catch(() => false)) {
        await type(s, name, 'Operator test')
        await s.fast(async () => {
          await click(s, page.getByRole('button', { name: 'Continue' }))
          await page.waitForLoadState('networkidle').catch(() => {})
        }, 2)
      }
    }
    await expect(page.getByRole('textbox', { name: 'Story', exact: true })).toBeVisible()
    s.note('To try the member flow the operator makes a member account with the operator email (here "Operator test"); it then counts in Members and in "N members told stories here" like a real member, with no mark that it was a test.')
    await type(s, page.getByRole('textbox', { name: 'Start', exact: true }), '0:07')
    await type(s, page.getByRole('textbox', { name: 'End', exact: true }), '0:09')
    await type(s, page.getByRole('textbox', { name: 'Story', exact: true }), TEXT, { delay: 22 })
    await pause(s, 600)
    await s.fast(async () => {
      await click(s, page.getByRole('button', { name: 'Send for review' }))
      await page.waitForURL(/\/admin\/preview\//, { timeout: 20_000 })
      await page.waitForLoadState('networkidle').catch(() => {})
    }, 2)
    const note = widget.locator('[part~="message"]')
    await expect(note).toContainText('Your story is sent')
    await point(s, note)
    await pause(s, 2500)

    // Review it.
    await s.fast(async () => {
      await navLink(s, 'Review stories')
      await page.waitForLoadState('networkidle').catch(() => {})
    }, 2)
    const row = page.locator('table tbody tr').filter({ hasText: 'Operator test' }).first()
    await point(s, row)
    await pause(s, 800)
    await s.fast(async () => {
      await row.locator('a').first().click()
      await page.waitForURL(/\/collections\/stories\/[^/?]+$/)
      await page.waitForLoadState('networkidle').catch(() => {})
    }, 2)
    const told = page.getByText(/preview page of the admin/i).first()
    if (await told.count()) {
      await point(s, told)
      await pause(s, 2000)
    }
    await click(s, page.getByRole('button', { name: 'Publish', exact: true }))
    const dialog = page.getByRole('dialog', { name: 'Publish this story?' })
    await pause(s, 1500)
    await click(s, dialog.getByRole('button', { name: 'Publish the story' }))
    await expect(page.getByText('Published. Visitors see it within one minute.')).toBeVisible()
    await pause(s, 1500)

    // Back on the preview page: the widget shows it.
    const shown = widget.locator('[part~="story-text"]').filter({ hasText: TEXT })
    await s.cut(async () => {
      for (let i = 0; i < 20; i++) {
        await page.goto(preview)
        if (await shown.first().waitFor({ timeout: 4000 }).then(() => true, () => false)) return
        await page.waitForTimeout(3000)
      }
    })
    await page.goto(preview).catch(() => {})
    await expect(shown.first()).toBeVisible()
    await point(s, shown.first())
    await pause(s, 3000)
  }, `
On the preview page of the widget, the operator selects **Tell a story** in the widget. The Annotate page asks for a member sign-in (an invite code), then the operator types 0:07–0:09 and a story and selects **Send for review**. The Annotate page sends the operator back to the preview page: "Your story is sent." In **Review stories** the story says it was told on the preview page of the admin; **Publish** → **Publish the story**. Back on the preview page, the widget shows the story (the wait for the stories cache is cut).
`)
}
