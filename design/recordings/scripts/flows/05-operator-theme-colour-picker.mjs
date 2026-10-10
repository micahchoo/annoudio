import { APP, click, expect, go, operatorState, pause, point, record, session, type } from '../lib.mjs'
import { projectTokens, setProjectTokens } from '../rest.mjs'

export const role = 'Operator'
export const workflow = 'Theme tab: the accent colour with the colour picker, the contrast readout, the live widget'

export default async function () {
  const before = await projectTokens()
  const s = await session('05-operator-theme-colour-picker', { role, workflow, state: await operatorState() })
  const { page } = s
  try {
    return await record(s, async () => {
      await go(s, `${APP}/admin/collections/projects/1`)
      await click(s, page.getByRole('button', { name: 'Theme', exact: true }))
      const preview = page.getByRole('region', { name: 'Preview' })
      await expect(preview).toBeVisible()
      await page.waitForLoadState('networkidle').catch(() => {})
      await pause(s, 1500)
      await point(s, preview.locator('annoudio-player'))
      await pause(s, 1200)

      const swatch = page.getByRole('textbox', { name: 'Accent colour: choose with the colour picker', exact: true })
      const hex = page.getByRole('textbox', { name: 'Accent colour', exact: true })
      const readout = page.locator('#field-themeTokens__colorAccent-contrast')
      await point(s, swatch)
      await pause(s, 600)
      // The native colour dialog is not drawn in a recorded video; the swatch takes the value as a pick would.
      await swatch.fill('#e3a33b')
      await expect(readout).toContainText('too low')
      await point(s, readout)
      await pause(s, 2500)
      await point(s, preview.getByRole('link', { name: 'Tell a story', exact: true }))
      await pause(s, 1500)

      await type(s, hex, '#8c2f39')
      await hex.press('Tab')
      await expect(readout).toContainText('passes')
      await point(s, readout)
      await pause(s, 2000)
      await point(s, preview.locator('annoudio-player'), { dy: 0.15 })
      await pause(s, 2000)
      await click(s, page.getByRole('button', { name: 'Save', exact: true }))
      await expect(page.getByText(/updated successfully|saved|Saved/i).first()).toBeVisible({ timeout: 15_000 })
      await pause(s, 2000)
    }, `
In the project River Voices, tab **Theme**: the live widget sits beside the fields. The accent colour changes with the colour swatch to a light orange: the readout says the contrast is too low for text, and the widget's buttons and "Tell a story" link follow. A darker red typed as hex passes; **Save**. (After the recording the script puts the accent back to #0b6e4f.)
`)
  } finally {
    await setProjectTokens(before)
  }
}
