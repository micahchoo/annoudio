import { APP, click, expect, go, operatorState, pause, point, readState, record, saveState, session, type } from '../lib.mjs'

export const role = 'Operator'
export const workflow = 'Return to the member, with a reason'

export const REASON = 'Thank you! Please say what the horn meant, and where you heard it.'

export default async function () {
  const { textStory: voiceStory } = readState()
  const s = await session('07-operator-return-to-member', { role, workflow, state: await operatorState() })
  const { page } = s
  return record(s, async () => {
    await go(s, voiceStory ? `${APP}/admin/collections/stories/${voiceStory}` : `${APP}/admin/collections/stories`)
    if (!voiceStory) await click(s, page.locator('table tbody tr a').first())
    await page.waitForLoadState('networkidle').catch(() => {})
    await pause(s, 1500)
    const media = page.getByText(/Voice note/).filter({ visible: true }).first()
    if (await media.count()) {
      await point(s, media)
      await pause(s, 1200)
    }
    const id = /\/stories\/([^/?#]+)/.exec(page.url())?.[1]
    if (id) saveState({ returnedStory: id })
    await click(s, page.getByRole('button', { name: 'Return to the member' }))
    const dialog = page.getByRole('dialog', { name: 'Return this story to the member' })
    await expect(dialog).toBeVisible()
    await pause(s, 1000)
    await click(s, dialog.getByRole('button', { name: 'Return the story' }))
    const alert = dialog.getByRole('alert')
    if (await alert.count()) {
      await point(s, alert)
      await pause(s, 1500)
    }
    await type(s, dialog.getByLabel('Reason'), REASON, { delay: 25 })
    if (await dialog.getByText('Write the reason. The member sees it.').isVisible()) s.note('The red error "Write the reason. The member sees it." stays under the field while the reason is typed.')
    await pause(s, 800)
    await click(s, dialog.getByRole('button', { name: 'Return the story' }))
    await expect(page.getByText('Returned to the member.')).toBeVisible()
    await point(s, page.getByText('Returned to the member.'))
    await pause(s, 1500)
    await page.waitForLoadState('networkidle').catch(() => {})
    await pause(s, 1500)
    if (/\/collections\/stories\/?(\?|$)/.test(page.url()) && (await page.getByText(/Waiting for review/).count())) s.note('After "Return the story" the admin goes back to the Review stories list, but after "Publish the story" it opens the next waiting story: the two review moves end in different places.')
    await pause(s, 1500)
  }, `
On a waiting story (Asha's story from video 10, with its answers) the operator selects **Return to the member**. **Return the story** with no reason says "Write the reason. The member sees it." The operator writes the reason and returns the story: "Returned to the member.", and the next waiting story opens, as after Publish.
`)
}
