import { APP, click, expect, go, operatorState, pause, point, record, session, type } from '../lib.mjs'

export const role = 'Operator'
export const workflow = 'Vocabulary: add a question from the catalogue, the list "Places" and two items, the field lock'

// The first common question of these that the project does not ask yet.
const QUESTIONS = ['Place', 'When it happened', 'Who is speaking', 'Kind of sound']
const ITEMS = ['Old jetty', 'Ferry ghat']

export default async function () {
  const s = await session('04-operator-vocabulary', { role, workflow, state: await operatorState() })
  const { page } = s
  const tab = (name) => page.getByRole('button', { name, exact: true })
  return record(s, async () => {
    await go(s, `${APP}/admin/collections/projects/1`)
    await click(s, tab('Vocabulary'))
    await expect(page.getByRole('region', { name: /^Questions/ })).toBeVisible()
    await pause(s, 1500)

    // A question from the common questions of the catalogue.
    await click(s, page.getByRole('button', { name: 'Add a question' }))
    const dialog = page.getByRole('dialog', { name: 'Add a question' })
    await expect(dialog).toBeVisible()
    await pause(s, 1200)
    let asked = ''
    for (const q of QUESTIONS) {
      const button = dialog.getByRole('button', { name: q, exact: true })
      if ((await button.count()) && (await button.isEnabled())) { asked = q; break }
    }
    if (!asked) throw new Error('every question of QUESTIONS is asked already')
    const done = dialog.getByRole('button', { name: /✓ asked/ }).first()
    await point(s, done)
    await pause(s, 900)
    await click(s, dialog.getByRole('button', { name: asked, exact: true }))
    const row = page.locator(`[data-question="${asked}"]`)
    await expect(row).toBeVisible()
    await point(s, row)
    await pause(s, 2000)

    // The list Places: a second one is refused, with the way to the first.
    await click(s, tab('Lists'))
    await pause(s, 1200)
    const places = page.locator('[data-list="Places"]')
    await point(s, places)
    await pause(s, 1000)
    const form = page.locator('.annoudio-add-list')
    await type(s, form.getByRole('textbox', { name: 'Name of the list' }), 'places')
    await click(s, form.getByRole('button', { name: 'Add a list' }))
    const refused = form.getByRole('alert')
    if (await refused.waitFor({ timeout: 8000 }).then(() => true, () => false)) {
      await point(s, refused)
      await pause(s, 2500)
    } else {
      s.note('A second list named "places" is not refused.')
    }
    const open = refused.getByRole('link').first().or(page.getByRole('link', { name: 'Open Places' })).first()
    await s.fast(async () => {
      await click(s, open)
      await page.waitForURL(/list=places/)
      await page.waitForLoadState('networkidle').catch(() => {})
    }, 2)
    await pause(s, 1000)

    // Two items, without leaving the list.
    for (const label of ITEMS) {
      if (await page.locator(`[data-concept="${label}"]`).count()) continue
      await type(s, page.getByRole('textbox', { name: 'New item' }), label)
      await click(s, page.getByRole('button', { name: 'Add', exact: true }))
      await expect(page.locator(`[data-concept="${label}"]`)).toBeVisible()
      await pause(s, 900)
    }
    if (!/list=places/.test(page.url())) s.note('After "Add" the page of the list is gone.')
    await point(s, page.locator(`[data-concept="${ITEMS[1]}"]`))
    await pause(s, 1500)

    // A used question: kind and list are locked.
    await go(s, `${APP}/admin/collections/projects/1`)
    await click(s, tab('Vocabulary'))
    await click(s, page.getByRole('button', { name: 'Edit: Topics' }))
    const edit = page.getByRole('dialog', { name: 'Edit: Topics' })
    await expect(edit).toBeVisible()
    await pause(s, 800)
    await point(s, edit.getByRole('combobox', { name: 'Kind of answer' }))
    await pause(s, 800)
    await point(s, edit.getByText(/stories answer this question\. Kind and list are fixed\./))
    await pause(s, 3000)
    await click(s, edit.getByRole('button', { name: 'Cancel' }))
    await pause(s, 800)
  }, `
In the project River Voices, tab **Vocabulary**: **Add a question** opens the catalogue; the questions already asked show "✓ asked", and **When it happened** (Place was asked in the first run) becomes a question of the form. Tab **Lists**: a second list named "places" is refused ("Places exists.") with the way to the list. On the page of Places, **New item** + **Add** twice (Old jetty, Ferry ghat): the operator stays on the list. Back on Vocabulary, **Edit: Topics** shows the field lock: "N stories answer this question. Kind and list are fixed."
`)
}
