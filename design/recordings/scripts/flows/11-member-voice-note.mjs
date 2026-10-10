import { APP, PROJECT, RECORDING, click, expect, go, pause, point, readState, record, saveState, session, type } from '../lib.mjs'
import { MEMBER_STATE } from './10-member-tell-a-story.mjs'

export const role = 'Member (phone)'
export const workflow = 'Record a voice note; Processing, then Waiting for review on Your stories'

export default async function () {
  const s = await session('11-member-voice-note', {
    role,
    workflow,
    phone: true,
    state: MEMBER_STATE,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    permissions: ['microphone'],
  })
  const { page } = s
  // No return address: the done screen then shows the state at once (the worker is often done in 2 s).
  const annotate = `${APP}/annotate?${new URLSearchParams({ project: PROJECT, recording: RECORDING, t: '6' })}`
  return record(s, async () => {
    await go(s, annotate)
    await expect(page.locator('.member-menu summary')).toContainText('Asha')
    await pause(s, 1200)
    const story = page.getByRole('textbox', { name: 'Story', exact: true })
    await type(s, story, 'The ferry horn, as I remember it.', { delay: 25 })
    const rec = page.getByRole('button', { name: 'Record a voice note' })
    await click(s, rec)
    const stop = page.getByRole('button', { name: 'Stop the voice note' })
    await expect(stop).toBeVisible()
    await point(s, stop)
    await pause(s, 3500)
    await stop.click()
    await pause(s, 1200)
    const attach = page.getByRole('button', { name: 'Attach this voice note' })
    await click(s, attach)
    await pause(s, 600)
    const busy = page.getByText(/^Processing\./).first()
    if (await busy.count()) {
      await point(s, busy)
      await pause(s, 2500)
    }
    s.note('The voice note is processed from the moment of Attach ("Processing. You can send the story now.") and is ready in about 2 s, so after Send for review the story is at once Waiting for review: the member never sees the state Processing on the done screen or on Your stories.')
    const id = await page.locator('input[name="id"]').inputValue().catch(() => '')
    console.log(`  voice story id: ${id || '(none before the save)'}`)
    const send = page.getByRole('button', { name: 'Send for review' })
    await click(s, send)
    const done = page.getByRole('heading', { name: /Your story is sent/ })
    await expect(done).toBeVisible({ timeout: 30_000 })
    await point(s, done)
    await pause(s, 1200)
    await point(s, page.getByText(/^Waiting for review\./).first())
    await pause(s, 2500)
    saveState({ voiceStory: id })

    // Your stories: the same story goes from Processing to Waiting for review.
    const mine = page.getByRole('link', { name: 'Your stories' }).first()
    await click(s, mine)
    await page.waitForLoadState('networkidle').catch(() => {})
    await expect(page.getByRole('heading', { name: 'Your stories', level: 1 })).toBeVisible()
    await pause(s, 800)
    const processing = id
      ? page.locator(`section[data-group="processing"] li.card[data-story="${id}"]`)
      : page.locator('section[data-group="processing"] li.card')
    const cards = page.locator('section[data-group="waiting"] li.card')
    const waiting = id ? cards.and(page.locator(`[data-story="${id}"]`)) : cards.filter({ hasText: 'The ferry horn, as I remember it.' }).last()
    if (await processing.count()) {
      await point(s, processing.first())
      await pause(s, 2500)
      await s.fast(async () => {
        for (let i = 0; i < 30 && !(await waiting.count()); i++) {
          await page.waitForTimeout(2000)
          await page.reload()
        }
      }, 4)
    }
    await expect(waiting).toBeVisible()
    if ((await cards.count()) > 1) s.note('Cards on Your stories carry no date or time: three stories on the same range (0:06–0:10) with the same text look identical, and the member cannot tell which one is new.')
    await point(s, waiting)
    await pause(s, 3000)
  }, `
The member (signed in from video 10) opens the Annotate page at 0:06, writes a line, selects **Record a voice note**, then **Stop the voice note** and **Attach this voice note** (Chromium's fake microphone gives a beep). Right after Attach the form says "Processing. You can send the story now." **Send for review**: this Annotate page has no return address, so the done screen "Your story is sent" shows the state, already **Waiting for review** (the worker took about 2 s). **Your stories** lists it under Waiting for review. (When the worker is slower, the script waits on Your stories with the Processing card, fast-forwarded 4×.)
`)
}
