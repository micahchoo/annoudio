import { join } from 'node:path'

import { RUN, WORKDIR, WP, click, expect, go, pause, point, readState, record, saveState, session, type } from '../lib.mjs'

export const role = 'Member (phone)'
export const workflow = 'From the WordPress page: Tell a story, invite code, name, drag a range, answer, Send for review'

export const MEMBER_STATE = join(WORKDIR, 'member-state.json')

export default async function () {
  const state = readState()
  const email = state.memberEmail ?? `asha.${RUN}@example.org`
  const code = state.inviteCodes?.[0] ?? 'AF3S-ZXS5'
  const s = await session('10-member-tell-a-story', { role, workflow, phone: true })
  const { page } = s
  const widget = page.locator('annoudio-player').first()
  const part = (name) => widget.locator(`[part~="${name}"]`)
  return record(s, async () => {
    await go(s, WP)
    await expect(part('annotate-link')).toBeVisible({ timeout: 20_000 })
    await point(s, widget, { dy: 0.1 })
    await pause(s, 1500)
    const linkTop = (await part('annotate-link').boundingBox())?.y ?? 0
    if (linkTop > s.viewport.height) s.note(`On a phone, "Tell a story" is ${Math.round(linkTop)} px down the host page, below the fold.`)
    await s.fast(async () => {
      await click(s, part('annotate-link'))
      await page.waitForURL(/\/annotate\?/)
      await page.waitForLoadState('networkidle').catch(() => {})
    }, 2)
    await expect(page.getByRole('heading', { name: 'Sign in to tell a story' })).toBeVisible()
    await pause(s, 1500)
    await click(s, page.getByRole('button', { name: 'Have an invite code?' }))
    await expect(page.getByRole('heading', { name: 'Sign in with an invite code' })).toBeVisible()
    await type(s, page.getByRole('textbox', { name: 'Email' }), email)
    await type(s, page.getByRole('textbox', { name: 'Invite code' }), code.toLowerCase().replace('-', ' '))
    await s.fast(async () => {
      await click(s, page.getByRole('button', { name: 'Sign in' }))
      await expect(page.getByRole('heading', { name: 'Choose your name' })).toBeVisible()
    }, 2)
    await type(s, page.getByRole('textbox', { name: 'Name' }), 'Asha')
    await s.fast(async () => {
      await click(s, page.getByRole('button', { name: 'Continue' }))
      await expect(page.locator('.member-menu summary')).toContainText('Asha')
      await page.waitForLoadState('networkidle').catch(() => {})
    }, 2)
    await pause(s, 1500)

    // A drag on the waveform marks the range; the fields follow.
    const wave = part('waveform')
    await expect(wave).toBeVisible()
    await expect.poll(() => part('range').count()).toBe(1)
    const box = await point(s, wave, { dx: 0.2 })
    await pause(s, 600)
    const y = box.y + box.height / 2
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.35, y, { steps: 12 })
    await page.mouse.move(box.x + box.width * 0.55, y, { steps: 12 })
    await page.mouse.up()
    await pause(s, 1200)
    await point(s, page.locator('.moment').first())
    await pause(s, 1500)
    const endBox = await page.getByRole('textbox', { name: 'End', exact: true }).boundingBox()
    if (endBox && endBox.y + endBox.height > s.viewport.height) s.note('After the drag, Start and End are below the fold of the phone screen.')
    const use = page.getByRole('button', { name: /^Start: / }).first()
    if (await use.count()) {
      await point(s, use)
      await pause(s, 1200)
    }

    const story = page.getByRole('textbox', { name: 'Story', exact: true })
    await type(s, story, 'My grandfather rang the horn here before the last crossing.', { delay: 25 })
    await pause(s, 800)
    const questions = page.locator('section.questions')
    await questions.scrollIntoViewIfNeeded()
    const place = questions.getByRole('group', { name: /^Place/ })
    await click(s, place.getByRole('checkbox', { name: 'North landing' }).or(place.getByText('North landing')).first())
    const topics = questions.getByRole('group', { name: /^Topics/ })
    await click(s, topics.getByRole('checkbox', { name: 'Horn' }).or(topics.getByText('Horn')).first())
    await pause(s, 1200)
    const id = await page.locator('input[name="id"]').inputValue().catch(() => '')
    const send = page.getByRole('button', { name: 'Send for review' })
    await point(s, send)
    await pause(s, 800)
    await s.fast(async () => {
      await send.click()
      await page.waitForURL((url) => url.port === '8091', { timeout: 20_000 })
      await page.waitForLoadState('networkidle').catch(() => {})
    }, 2)
    const note = part('message')
    await expect(note).toContainText('Your story is sent', { timeout: 20_000 })
    await point(s, note)
    await pause(s, 3500)
    await s.context.storageState({ path: MEMBER_STATE })
    saveState({ memberEmail: email, textStory: id })
  }, `
On the WordPress demo page (phone), the member selects **Tell a story** in the widget. The Annotate page asks to sign in: **Have an invite code?**, an email and a code from the operator (typed in lower case with a space: case, spaces and the hyphen do not matter). First sign-in: the name "Asha". On the form, a drag on the waveform marks the range and the fields follow; the story text; the answers Place = North landing and Topics = Horn; **Send for review**. The Start and End fields sit right under the waveform, with **Use current time (0:00)**. The browser goes back to the WordPress page, and the widget says "Your story is sent. It shows here after review."
`)
}
