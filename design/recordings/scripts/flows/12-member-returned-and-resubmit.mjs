import { APP, click, expect, go, pause, point, readState, record, session, type } from '../lib.mjs'
import { MEMBER_STATE } from './10-member-tell-a-story.mjs'

export const role = 'Member (phone)'
export const workflow = 'Your stories shows Returned with the reason → Change the story → Send again'

export default async function () {
  const { returnedStory } = readState()
  const s = await session('12-member-returned-and-resubmit', { role, workflow, phone: true, state: MEMBER_STATE })
  const { page } = s
  return record(s, async () => {
    await go(s, `${APP}/annotate/mine`)
    await expect(page.getByRole('heading', { name: 'Your stories', level: 1 })).toBeVisible()
    await pause(s, 1200)
    const returned = page.locator('section[data-group="returned"]')
    const card = returnedStory
      ? returned.locator(`li.card[data-story="${returnedStory}"]`)
      : returned.locator('li.card').first()
    await expect(card).toBeVisible()
    await point(s, returned.getByRole('heading').first())
    await pause(s, 1000)
    await point(s, card)
    await pause(s, 2500)
    await s.fast(async () => {
      await click(s, card.getByRole('link', { name: 'Change the story' }))
      await page.waitForURL(/\/annotate\?/)
      await page.waitForLoadState('networkidle').catch(() => {})
    }, 2)
    await pause(s, 1000)
    const status = page.locator('.status').first()
    await point(s, status)
    await pause(s, 2500)
    const story = page.getByRole('textbox', { name: 'Story', exact: true })
    await story.scrollIntoViewIfNeeded()
    await click(s, story)
    await page.keyboard.press('End')
    await story.pressSequentially(' The horn meant the last ferry of the day; I heard it from the north landing.', { delay: 22 })
    await pause(s, 1000)
    const heading = (await page.getByRole('heading', { level: 1 }).first().textContent())?.trim()
    if (heading === 'Tell a story') s.note('The page of a returned story is still headed "Tell a story".')
    const send = page.getByRole('button', { name: /^Send again$|^Send for review$/ })
    if ((await send.textContent())?.trim() !== 'Send again') s.note('The button of a returned story says "Send for review", not "Send again".')
    await click(s, send)
    await s.fast(async () => {
      await page.waitForLoadState('networkidle').catch(() => {})
    }, 2)
    const done = page.getByRole('heading', { name: /Your story is sent/ })
    if (await done.isVisible().catch(() => false)) {
      await point(s, done)
      await pause(s, 2000)
      await s.fast(async () => {
        await click(s, page.getByRole('link', { name: 'Your stories' }).first())
        await page.waitForLoadState('networkidle').catch(() => {})
      }, 2)
    } else {
      await go(s, `${APP}/annotate/mine`)
    }
    const waiting = page.locator('section[data-group="waiting"] li.card').filter({ hasText: 'north landing' }).first()
    await expect(waiting).toBeVisible()
    if (!(await waiting.getByText('Sent again').count())) s.note('On Your stories the story sent again has no "Sent again" mark.')
    await point(s, waiting)
    await pause(s, 3000)
  }, `
On **Your stories**, the group **Returned to you** shows the story with the operator's reason from video 07. **Change the story** opens the page "Change your story" with the banner "Returned to you" and the reason. The member adds a line to the story and selects **Send again**; on Your stories the story is under **Waiting for review** with the badge **Sent again**.
`)
}
