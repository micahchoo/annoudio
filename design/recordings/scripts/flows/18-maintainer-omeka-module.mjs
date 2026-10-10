import { RUN, click, expect, go, pause, point, record, session, type } from '../lib.mjs'

export const role = 'Site maintainer'
export const workflow = 'Omeka S: the module says "Connected"; the page editor: add the block, pick the media, type the number, save, view'

const OM = 'http://localhost:8092'

export default async function () {
  const slug = `ferry-${RUN}`
  const s = await session('18-maintainer-omeka-module', { role, workflow })
  const { page } = s
  return record(s, async () => {
    await go(s, `${OM}/login`)
    await type(s, page.locator('#email'), 'admin@example.org')
    await type(s, page.locator('#password'), 'omeka-admin-test', { delay: 15 })
    await s.fast(async () => {
      await click(s, page.getByRole('button', { name: /log in/i }).or(page.locator('input[type=submit]')).first())
      await page.waitForURL(/\/admin/)
    }, 3)
    await go(s, `${OM}/admin/module/configure?id=Annoudio`)
    const status = page.locator('#annoudio-status')
    await expect(status).toContainText('Connected to River Voices')
    await point(s, status)
    await pause(s, 2500)

    // A new page of the site, then the block.
    await go(s, `${OM}/admin/site/s/annoudio/add-page`)
    await type(s, page.locator('#title'), `Ferry crossing (${RUN})`)
    await type(s, page.locator('#slug'), slug)
    await s.fast(async () => {
      await click(s, page.getByRole('button', { name: 'Add', exact: true }))
      await page.waitForURL(new RegExp(`/page/${slug}`))
      await page.getByText('Add new block').first().waitFor()
      await page.waitForLoadState('networkidle').catch(() => {})
    }, 2)
    const add = page.locator('#new-block button[value="annoudioPlayer"]')
    await click(s, add)
    const block = page.locator('.block[data-block-layout="annoudioPlayer"]').last()
    const number = block.getByLabel(/^Recording (number|ID)/).first()
    await expect(number).toBeVisible()
    if (await block.getByLabel('Recording ID').count()) s.note('The Omeka block asks for the "Recording ID", while the admin says "Recording number".')
    await type(s, number, '1', { delay: 120 })
    await number.press('Tab')
    const early = block.locator('.annoudio-status').first()
    if (await early.getByText('Recording found').waitFor({ timeout: 8000 }).then(() => true, () => false)) {
      await point(s, early)
      await pause(s, 2000)
    } else {
      s.note('In Omeka S the block says "Recording found" only after Save.')
    }
    await click(s, block.getByRole('button', { name: 'Add attachment' }))
    const media = page.locator('#select-resource').getByText('Ferry crossing, 1962 (Annoudio test)').first()
    await click(s, media)
    await pause(s, 800)
    await click(s, page.locator('#attachment-options .media-list .media').first())
    await click(s, page.getByRole('button', { name: 'Apply changes' }))
    await pause(s, 800)
    await click(s, page.locator('#page-actions').getByRole('button', { name: 'Save' }))
    await expect(page.getByText('Page successfully updated')).toBeVisible({ timeout: 20_000 })
    const found = page.locator('.annoudio-status').first()
    await expect(found).toContainText('Recording found')
    await point(s, found)
    await pause(s, 2500)
    await go(s, `${OM}/s/annoudio/page/${slug}`)
    const widget = page.locator('annoudio-player').first()
    await expect(widget.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 20_000 })
    await point(s, widget, { dy: 0.1 })
    await click(s, widget.getByRole('button', { name: 'Play' }))
    await pause(s, 3000)
  }, `
In Omeka S, the module configuration of Annoudio says "Connected to River Voices (project river-voices) at http://127.0.0.1:3500." The maintainer adds a page to the site, adds the **Annoudio widget** block, types the recording number 1 ("Recording found: Ferry crossing, 1962" shows before any save) and attaches the Omeka media "Ferry crossing, 1962" as the audio, then **Save**: "Page successfully updated". The public page shows the widget, and it plays.
`)
}
