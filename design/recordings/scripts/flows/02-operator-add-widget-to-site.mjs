import { APP, click, expect, go, navLink, operatorState, pause, point, poster, record, session } from '../lib.mjs'

export const role = 'Operator'
export const workflow = 'Add a widget to a site: Recording, Site, Snippet; copy the snippet'

export default async function () {
  const s = await session('02-operator-add-widget-to-site', {
    role,
    workflow,
    state: await operatorState(),
    permissions: ['clipboard-read', 'clipboard-write'],
  })
  const { page } = s
  return record(s, async (setPoster) => {
    await go(s, `${APP}/admin`)
    await pause(s, 600)
    await navLink(s, 'Add a widget')
    await expect(page.getByRole('heading', { name: 'Add a widget to a site' })).toBeVisible()
    await pause(s, 1500)

    // 1 Recording
    const recording = page.getByRole('combobox', { name: 'Recording' })
    await point(s, recording)
    await recording.selectOption({ label: 'Ferry crossing, 1962' })
    await pause(s, 1500)
    await click(s, page.getByRole('button', { name: 'Next' }))
    await pause(s, 1500)

    // 2 Site
    const site = page.getByRole('region', { name: 'Site' })
    await expect(site).toBeVisible()
    await point(s, site.getByRole('heading', { name: 'Site' }))
    await pause(s, 800)
    const which = site.getByRole('combobox', { name: 'Which site shows the widget?' })
    if (await which.count()) {
      const chosen = await which.evaluate((e) => e.selectedOptions[0]?.textContent ?? '')
      if (!/River Voices/.test(chosen)) s.note(`Step 2 starts on "${chosen.trim()}" although River Voices is the site of this recording: the operator must choose again.`)
      await point(s, which)
      await which.selectOption({ label: /^River Voices/ }).catch(async () => {
        const label = await which.locator('option', { hasText: 'River Voices' }).first().textContent()
        await which.selectOption({ label })
      })
    }
    await pause(s, 1500)
    await click(s, page.getByRole('button', { name: 'Next' }))

    // 3 Snippet
    const snippet = page.getByRole('region', { name: 'Snippet' })
    await expect(snippet).toBeVisible({ timeout: 15_000 })
    await page.waitForLoadState('networkidle').catch(() => {})
    await pause(s, 1200)
    await point(s, snippet.getByRole('textbox').first())
    await pause(s, 1200)
    await click(s, snippet.getByRole('button', { name: 'Copy the snippet' }))
    await expect(page.getByText(/Copied/).first()).toBeVisible()
    await pause(s, 1500)
    setPoster(await poster(s))
    const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')
    if (!clip.includes('<annoudio-player')) s.note(`The clipboard after "Copy the snippet" does not hold the snippet (got ${JSON.stringify(clip.slice(0, 60))}).`)
    // The preview below the snippet: the real widget.
    const widget = page.locator('annoudio-player').first()
    if (await widget.count()) {
      await point(s, widget)
      await pause(s, 2000)
    }
    const done = page.getByRole('button', { name: 'Done' }).or(page.getByRole('link', { name: 'Done' }))
    if (await done.count()) {
      await click(s, done.first())
      await page.waitForLoadState('networkidle').catch(() => {})
      await pause(s, 1500)
    }
  }, `
The operator selects **Add a widget**, then walks the 3 steps: **Recording** (Ferry crossing, 1962), **Site** (River Voices), **Snippet**. **Copy the snippet** says "Copied."; the live widget shows below the snippet; **Done** goes back to Today.
`)
}
