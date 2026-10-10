import { WP, click, expect, go, pause, point, record, session, type } from '../lib.mjs'
import { MEMBER_STATE } from './10-member-tell-a-story.mjs'

export const role = 'Member (phone)'
export const workflow = 'Widget → Reply on a published story → write → send'

export default async function () {
  const s = await session('13-member-reply', { role, workflow, phone: true, state: MEMBER_STATE })
  const { page } = s
  const widget = page.locator('annoudio-player').first()
  return record(s, async () => {
    await go(s, WP)
    const story = widget.getByRole('button', { name: /^Story by Leela, 0:02/ })
    await expect(story).toBeVisible({ timeout: 20_000 })
    await click(s, story)
    await pause(s, 1500)
    const reply = widget.locator('[part~="reply-link"]').filter({ visible: true }).first()
    await expect(reply).toBeVisible()
    await point(s, reply)
    await pause(s, 1000)
    await s.fast(async () => {
      await reply.click()
      await page.waitForURL(/\/annotate\?.*replyTo=/)
      await page.waitForLoadState('networkidle').catch(() => {})
    }, 2)
    await expect(page.getByRole('heading', { name: 'Reply to a story' })).toBeVisible()
    await pause(s, 1200)
    const parent = page.getByText('My grandmother sang this on the ferry.').first()
    if (await parent.count()) {
      await point(s, parent)
      await pause(s, 1500)
    }
    await type(s, page.getByRole('textbox', { name: 'Reply', exact: true }), 'My grandmother sang it too, at the south landing.', { delay: 25 })
    await pause(s, 800)
    const send = page.getByRole('button', { name: /^Send/ }).first()
    await point(s, send)
    await pause(s, 600)
    await s.fast(async () => {
      await send.click()
      await page.waitForURL((url) => url.port === '8091', { timeout: 20_000 })
      await page.waitForLoadState('networkidle').catch(() => {})
    }, 2)
    const note = widget.locator('[part~="message"]')
    await expect(note).toContainText('Your reply is sent', { timeout: 20_000 })
    await point(s, note)
    await pause(s, 3500)
  }, `
On the WordPress page, the member opens Leela's published story in the widget and selects **Reply**. The Annotate page "Reply to a story" shows the story above the field. The member writes the reply and sends it; the browser goes back to the WordPress page, the widget opens the story and says "Your reply is sent. It shows here after review."
`)
}
