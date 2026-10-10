import { WP, click, expect, go, pause, point, record, session } from '../lib.mjs'
import { publishInAdmin } from '../setup.mjs'

export const role = 'Visitor'
export const workflow = 'The WordPress page: play, open a story, its answers, the thread, Tell a story'

export const REPLY = 'My grandmother sang it too, at the south landing.'

export default async function () {
  // The reply of video 13 must be published for the thread to show (no video of this step).
  await publishInAdmin(REPLY)
  const s = await session('14-visitor-widget', { role, workflow })
  const { page } = s
  const widget = page.locator('annoudio-player').first()
  const part = (name) => widget.locator(`[part~="${name}"]`)
  return record(s, async () => {
    await go(s, WP)
    await expect(widget.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 20_000 })
    await point(s, page.getByRole('heading', { name: 'Ferry crossing, 1962' }).first())
    await pause(s, 1000)
    await click(s, widget.getByRole('button', { name: 'Play' }))
    await pause(s, 3500)
    await click(s, widget.getByRole('button', { name: 'Pause' }).first())
    await pause(s, 600)

    // A story with answers: "Place: North landing" and the topic Horn.
    const asha = widget.getByRole('button', { name: /^Story by Asha, 0:02/ })
    await click(s, asha)
    await pause(s, 1500)
    const field = part('field').filter({ hasText: 'Place' }).first()
    if (await field.count()) {
      await point(s, field)
      const colon = await field.locator('[part~="field-label"]').evaluate((e) => getComputedStyle(e, '::after').content)
      if (!colon.includes(':')) s.note('The answer reads "Place North landing", with no colon after the label.')
    } else {
      s.note('The published story of video 10 shows no "Place" answer in the widget.')
    }
    await pause(s, 2500)

    // A story with a thread.
    const leela = widget.getByRole('button', { name: /^Story by Leela, 0:02/ })
    await click(s, leela)
    await pause(s, 1500)
    const reply = part('reply').filter({ hasText: REPLY }).first()
    if (await reply.count()) {
      await point(s, reply)
      await pause(s, 2500)
    } else {
      s.note('The thread of Leela\'s story does not show the reply published 1 s before (the stories cache is up to 60 s).')
    }
    const tell = part('annotate-link')
    await point(s, tell)
    await pause(s, 2500)
    const rights = widget.getByRole('link', { name: /CC BY 4.0/ })
    await point(s, rights)
    await pause(s, 1500)
  }, `
A visitor on the WordPress demo page: **Play** plays the recording and the time ranges light up. Selecting Asha's story plays its range and shows its answers ("Place: North landing" and the tag Horn). Leela's story opens its thread with the reply of video 13 (published by the operator off camera). **Tell a story** sits under the controls; the rights line is at the end of the list.
`)
}
