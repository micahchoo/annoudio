import { RUN, click, expect, go, pause, point, record, session, type } from '../lib.mjs'

export const role = 'Site maintainer'
export const workflow = 'WordPress: the plugin settings say "Connected"; an author adds the block, types the recording number, publishes'

const WPHOST = 'http://localhost:8091'

async function logIn(s, user, password) {
  const { page } = s
  await go(s, `${WPHOST}/wp-login.php`)
  await type(s, page.locator('#user_login'), user)
  await type(s, page.locator('#user_pass'), password, { delay: 15 })
  await s.fast(async () => {
    await click(s, page.locator('#wp-submit'))
    await page.waitForURL(/wp-admin/)
    await page.waitForLoadState('networkidle').catch(() => {})
  }, 3)
}

export default async function () {
  const s = await session('17-maintainer-wordpress-block', { role, workflow })
  const { page } = s
  return record(s, async () => {
    // The administrator: Settings → Annoudio.
    await logIn(s, 'admin', 'wp-admin-test')
    await go(s, `${WPHOST}/wp-admin/options-general.php?page=annoudio`)
    await point(s, page.getByLabel('Stack address'))
    await pause(s, 1000)
    await point(s, page.getByLabel('Project'))
    await pause(s, 1000)
    const status = page.locator('#annoudio-status')
    await expect(status).toContainText('Connected to River Voices')
    await point(s, status)
    await pause(s, 2500)

    // An author (no unfiltered_html): a new post with the block.
    await s.cut(() => s.context.clearCookies())
    await logIn(s, 'author1', 'wp-author-test')
    await go(s, `${WPHOST}/wp-admin/post-new.php`)
    const guide = page.getByRole('dialog', { name: /welcome/i })
    if (await guide.isVisible({ timeout: 5000 }).catch(() => false)) {
      await s.cut(() => guide.getByRole('button', { name: 'Close' }).click())
    }
    const canvas = page.frameLocator('iframe[name="editor-canvas"]')
    await type(s, canvas.getByRole('textbox', { name: 'Add title' }), `Ferry crossing, with stories (${RUN})`)
    await click(s, page.getByRole('button', { name: /block inserter/i }))
    await type(s, page.getByRole('searchbox', { name: /search/i }), 'widget')
    await pause(s, 1000)
    if (!(await page.getByRole('option', { name: /Annoudio/ }).count())) {
      s.note('A search for "widget" in the block inserter does not find the Annoudio block.')
      await type(s, page.getByRole('searchbox', { name: /search/i }), 'Annoudio')
    }
    await pause(s, 800)
    const option = page.getByRole('option', { name: /Annoudio/ }).first()
    const optionName = (await option.textContent())?.trim()
    if (!/widget/i.test(optionName ?? '')) s.note(`The block is called "${optionName}" in the inserter, but the admin calls the thing a widget ("Add a widget to a site"): an author who searches "widget" finds nothing.`)
    await click(s, option)
    await pause(s, 1200)
    const id = canvas.getByLabel(/^Recording (number|ID)/).first()
    await expect(id).toBeVisible()
    if (await canvas.getByLabel('Recording ID').count()) s.note('The block asks for the "Recording ID"; the admin\'s snippet panel says "Recording number: 1". Same value, two names.')
    await type(s, id, '1', { delay: 120 })
    const found = canvas.getByText(/^Recording found: Ferry crossing, 1962/)
    await expect(found).toBeVisible({ timeout: 15_000 })
    await point(s, found)
    await pause(s, 2500)
    await click(s, page.getByRole('button', { name: 'Publish', exact: true }))
    const panel = page.getByRole('region', { name: /publish/i })
    await pause(s, 800)
    await click(s, panel.getByRole('button', { name: 'Publish', exact: true }))
    await expect(page.getByTestId('snackbar').filter({ hasText: 'Post published.' })).toBeVisible({ timeout: 20_000 })
    await pause(s, 1200)
    const link = await page.evaluate(() => window.wp.data.select('core/editor').getPermalink())
    await go(s, link)
    const widget = page.locator('annoudio-player').first()
    await expect(widget.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 20_000 })
    await point(s, widget, { dy: 0.1 })
    await pause(s, 1200)
    await click(s, widget.getByRole('button', { name: 'Play' }))
    await pause(s, 3000)
  }, `
In WordPress, the administrator opens **Settings → Annoudio**: the stack address, the project, and the line "Connected to River Voices (project river-voices) at http://127.0.0.1:3500." Then an author (who may not paste HTML) writes a new post, searches the inserter for "widget", adds the **Annoudio widget** block, and types the recording number 1: the block says "Recording found: Ferry crossing, 1962". **Publish**; the published post shows the widget with its stories, and it plays.
`)
}
