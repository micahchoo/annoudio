import { OMEKA, click, expect, go, pause, point, record, session } from '../lib.mjs'

export const role = 'Visitor'
export const workflow = 'The Omeka S page: the same widget, play, open a story'

export default async function () {
  const s = await session('15-visitor-omeka', { role, workflow })
  const { page } = s
  const widget = page.locator('annoudio-player').first()
  return record(s, async () => {
    await go(s, OMEKA)
    await expect(widget.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 20_000 })
    await point(s, widget, { dy: 0.1 })
    await pause(s, 1200)
    await click(s, widget.getByRole('button', { name: 'Play' }))
    await pause(s, 2500)
    await click(s, widget.getByRole('button', { name: /^Story by Asha, 0:02/ }))
    await pause(s, 2500)
    await click(s, widget.getByRole('button', { name: /^Story by Leela, 0:02/ }))
    await pause(s, 2000)
    await point(s, widget.locator('[part~="annotate-link"]'))
    await pause(s, 2000)
  }, `
The same widget on the Omeka S demo page, with the theme of River Voices: **Play**, then Asha's story with its answer, then Leela's story with its reply, and **Tell a story**.
`)
}
