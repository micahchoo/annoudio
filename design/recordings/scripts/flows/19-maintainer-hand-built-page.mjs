import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'

import { APP, WORKDIR, click, expect, go, operatorState, pause, point, record, session, type } from '../lib.mjs'
import { project, projectTokens, setProjectTokens } from '../rest.mjs'

export const role = 'Site maintainer'
export const workflow = 'A hand-built page: copy the snippet, add the website, open the page, change the theme, reload'

const PORT = Number(process.env.REC_SITE_PORT ?? 4792)
const SITE = `http://127.0.0.1:${PORT}`
const ACCENT = '#8c2f39'

/** A plain static server for one folder: the maintainer's own site. */
function serve(dir) {
  const server = createServer((req, res) => {
    if (req.url === '/' || req.url.startsWith('/index.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' })
      res.end(readFileSync(join(dir, 'index.html')))
    } else {
      res.writeHead(404).end()
    }
  })
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)))
}

const page = (snippet) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ferry crossing · Our village archive</title>
<style>body{font:18px/1.5 Georgia,serif;max-width:46rem;margin:2rem auto;padding:0 1rem;color:#222}h1{font-weight:normal}</style>
</head><body>
<h1>Ferry crossing, 1962</h1>
<p>A recording from our village archive. Listen, and read what people remember.</p>
${snippet}
</body></html>
`

export default async function () {
  const before = await projectTokens()
  const dir = join(WORKDIR, 'hand-built-site')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.html'), page('<p>(the snippet goes here)</p>'))
  const server = await serve(dir)
  const s = await session('19-maintainer-hand-built-page', {
    role,
    workflow,
    state: await operatorState(),
    permissions: ['clipboard-read', 'clipboard-write'],
  })
  const p = s.page
  try {
    return await record(s, async () => {
      // 1. Copy the snippet from the recording page.
      await go(s, `${APP}/admin/collections/recordings/1`)
      const snippet = p.getByRole('region', { name: 'Snippet' })
      await point(s, snippet.getByRole('textbox').first())
      await pause(s, 1000)
      await click(s, snippet.getByRole('button', { name: 'Copy the snippet' }))
      await pause(s, 1500)
      const copied = await p.evaluate(() => navigator.clipboard.readText())
      if (!copied.includes('<annoudio-player')) throw new Error(`clipboard: ${copied.slice(0, 80)}`)
      // The paste into the page's HTML file (no editor on camera).
      await s.cut(async () => writeFileSync(join(dir, 'index.html'), page(copied)))

      // 2. The site's address on the website list of the project.
      await go(s, `${APP}/admin/collections/projects/1`)
      await click(s, p.getByRole('button', { name: 'Project', exact: true }))
      const origins = (await project()).siteOrigins?.map((o) => o.origin) ?? []
      const websites = p.getByText('Websites', { exact: true }).first()
      await point(s, websites)
      await pause(s, 1000)
      if (!origins.includes(SITE)) {
        const open = await p.getByRole('textbox', { name: /Website address/ }).filter({ visible: true }).count()
        if (open >= 5) s.note(`The Websites list shows ${open} addresses as open blocks; "Add Website" is far down the tab.`)
        await click(s, p.getByRole('button', { name: /^Add Website/ }).first())
        await pause(s, 600)
        const fields = p.getByRole('textbox', { name: /Website address/ })
        if (!(await fields.last().isVisible())) {
          s.note('After "Add Website" the new row is folded ("New website"): the maintainer must open it before typing the address.')
          const toggle = p.locator('button.collapsible__toggle--collapsed').last()
          if (!(await toggle.getAttribute('aria-label')) && !((await toggle.textContent()) ?? '').trim()) {
            s.note('The fold buttons of the Websites rows have no name (a button with an icon only), so a screen reader hears "button".')
          }
          await click(s, toggle)
          await pause(s, 600)
        }
        await type(s, fields.last(), SITE)
        await pause(s, 600)
        await click(s, p.getByRole('button', { name: 'Save', exact: true }))
        await expect(p.getByText(/updated successfully/i).first()).toBeVisible({ timeout: 15_000 })
        await pause(s, 1500)
      } else {
        s.note(`${SITE} was already on the website list (a second run).`)
      }

      // 3. The maintainer's page.
      const site = p
      await go(s, SITE)
      const widget = site.locator('annoudio-player').first()
      await expect(widget.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 20_000 })
      await point(s, widget, { dy: 0.1 })
      await pause(s, 2500)
      const accent = () => widget.getByRole('button', { name: 'Play' }).evaluate((b) => getComputedStyle(b).backgroundColor)
      const accentBefore = await accent()

      // 4. A new accent colour in the Theme tab.
      await go(s, `${APP}/admin/collections/projects/1`)
      await click(s, p.getByRole('button', { name: 'Theme', exact: true }))
      const hex = p.getByRole('textbox', { name: 'Accent colour', exact: true })
      await type(s, hex, ACCENT)
      await hex.press('Tab')
      await pause(s, 1500)
      await click(s, p.getByRole('button', { name: 'Save', exact: true }))
      await expect(p.getByText(/updated successfully/i).first()).toBeVisible({ timeout: 15_000 })
      await pause(s, 1500)

      // 5. Reload the maintainer's page: no change to its HTML.
      await go(s, SITE)
      await pause(s, 800)
      await s.fast(async () => {
        await site.reload()
        await site.waitForLoadState('networkidle').catch(() => {})
      }, 2)
      await expect(widget.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 20_000 })
      // The theme settles after the widget draws: wait up to 5 s for it.
      const changed = () => expect.poll(accent, { timeout: 5000 }).not.toBe(accentBefore).then(() => true, () => false)
      let ok = await changed()
      await pause(s, 1200)
      if (!ok) {
        s.note('After Save in the Theme tab, a reload of the site page still shows the old accent, also a reload that skips the cache (Ctrl+Shift+R): the widget fetches the theme file with fetch(), and the browser keeps it for 5 minutes (max-age=300). A new visitor (an empty browser cache) sees the new colour at once. The Theme tab says "within 5 minutes", but a maintainer who reloads to check sees no change and may think the save failed.')
        await point(s, widget.getByRole('button', { name: 'Play' }))
        await pause(s, 2000)
        // As a new visitor: an empty browser cache, then the same page.
        await s.cut(async () => {
          const cdp = await s.context.newCDPSession(site)
          await cdp.send('Network.clearBrowserCache')
        })
        await s.fast(async () => {
          await site.reload()
          await site.waitForLoadState('networkidle').catch(() => {})
        }, 2)
        ok = await changed()
        if (!ok) s.note('With an empty browser cache the site page still shows the old accent.')
        await pause(s, 1000)
      }
      await point(s, widget.getByRole('button', { name: 'Play' }))
      await pause(s, 1200)
      await point(s, widget.locator('[part~="annotate-link"]'))
      await pause(s, 2500)
    }, `
A maintainer with a hand-built site. In the admin, the recording page: **Copy the snippet**. The two lines go into the page's HTML file (off camera). On the project's tab **Project**, the site's address goes on the **Websites** list, then **Save**. The page, served from that address (a small local server), shows the widget with its stories. Then the accent colour changes in the Theme tab (**Save**), and the site page is opened again and reloaded, with no change to its HTML: the widget shows the new red accent at once (the theme file is no longer cached for 5 minutes). (After the recording the script puts the accent back to #0b6e4f.)
`)
  } finally {
    await setProjectTokens(before)
    server.close()
  }
}
