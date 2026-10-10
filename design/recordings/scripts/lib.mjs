// Shared helpers for the workflow recordings: one browser session per recording, a title
// card, a visible cursor, slow and visible clicks, time marks for the cut, and the encode.

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = fileURLToPath(new URL('../../../', import.meta.url)) // repository root
export const OUT = join(ROOT, 'design/recordings')
const WORK = join(OUT, 'scripts/.work') // webm, palettes, state (ignored by the README)

const require = createRequire(join(ROOT, 'embed/package.json'))
const pw = await import(require.resolve('@playwright/test'))
export const { chromium, expect } = pw.default ?? pw

export const APP = 'http://127.0.0.1:3500'
export const WP = 'http://localhost:8091/?pagename=demo'
export const OMEKA = 'http://localhost:8092/s/annoudio/page/demo'
export const MAILPIT = 'http://127.0.0.1:8025'
export const OPERATOR = { email: 'operator@example.org', password: 'demo-operator-pass-1' }
export const PROJECT = 'river-voices'
export const RECORDING = '1'
export const DESKTOP = { width: 1280, height: 800 }
export const PHONE = { width: 390, height: 844 }

/** A run id, so the members and stories of one run of the recordings have their own names. */
export const RUN = process.env.REC_RUN ?? new Date().toISOString().slice(5, 16).replace(/[-T:]/g, '')

mkdirSync(WORK, { recursive: true })

// A dot that follows the mouse, and a ring on each press. Playwright videos draw no cursor.
const CURSOR = `
(() => {
  const add = () => {
    if (document.getElementById('__gif_cursor')) return
    const dot = document.createElement('div')
    dot.id = '__gif_cursor'
    dot.setAttribute('aria-hidden', 'true')
    dot.style.cssText = 'position:fixed;left:0;top:0;width:18px;height:18px;margin:-9px 0 0 -9px;' +
      'border-radius:50%;background:rgba(220,38,38,.55);border:2px solid #fff;' +
      'box-shadow:0 0 0 1px rgba(0,0,0,.45);pointer-events:none;z-index:2147483647;' +
      'transition:transform .12s ease;transform:translate(-100px,-100px)'
    document.documentElement.appendChild(dot)
    let x = -100, y = -100
    const place = (s) => { dot.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + s + ')' }
    addEventListener('mousemove', (e) => { x = e.clientX; y = e.clientY; place(1) }, true)
    addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; place(1) }, true)
    addEventListener('mousedown', () => place(0.6), true)
    addEventListener('mouseup', () => place(1), true)
    const last = sessionStorage.getItem('__gif_xy')
    if (last) { [x, y] = JSON.parse(last); place(1) }
    addEventListener('pagehide', () => sessionStorage.setItem('__gif_xy', JSON.stringify([x, y])))
  }
  if (document.documentElement) add()
  document.addEventListener('DOMContentLoaded', add)
})()`

/**
 * One recorded session. `marks` collects the parts of the video to speed up or cut:
 * [{ from, to, speed }] in seconds from the start of the video; speed 0 cuts the part.
 */
export async function session(name, { phone = false, state, args = [], permissions = [], role, workflow } = {}) {
  const viewport = phone ? PHONE : DESKTOP
  const browser = await chromium.launch({
    args: ['--mute-audio', ...args],
    slowMo: Number(process.env.REC_SLOWMO ?? 180),
  })
  const dir = join(WORK, name)
  rmSync(dir, { recursive: true, force: true })
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    recordVideo: { dir, size: viewport },
    storageState: state,
    locale: 'en-GB',
  })
  if (permissions.length) await context.grantPermissions(permissions)
  await context.addInitScript(CURSOR)
  const page = await context.newPage()
  const t0 = Date.now()
  const marks = []
  const notes = []
  const s = {
    name, page, context, browser, viewport, phone, marks, notes, role, workflow, cardEnd: 0,
    now: () => (Date.now() - t0) / 1000,
    /** Speed up (or cut, speed 0) whatever happens inside fn. */
    async fast(fn, speed = 2) {
      const from = s.now()
      try { return await fn() } finally { marks.push({ from, to: s.now(), speed }) }
    },
    cut: (fn) => s.fast(fn, 0),
    /** A stumble that a person would notice: goes into the caption and the audit list. */
    note(text) { notes.push(text); console.log(`  [stumble] ${text}`) },
  }
  // The first frames are blank; then a title card of 1.5 s names the role and the workflow.
  await page.setContent(card(role, workflow, name, phone))
  marks.push({ from: 0, to: s.now() + 0.1, speed: 0 })
  await page.waitForTimeout(1600)
  s.cardEnd = s.now()
  return s
}

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)
function card(role, workflow, name, phone) {
  const n = name.slice(0, 2)
  return `<!doctype html><meta charset="utf-8"><title>${esc(role)}</title>
<body style="margin:0;height:100vh;display:grid;place-items:center;background:#0b3d4f;color:#fff;font-family:system-ui,sans-serif">
<div style="max-width:${phone ? 320 : 900}px;padding:24px">
<div style="font-size:${phone ? 16 : 22}px;letter-spacing:.12em;text-transform:uppercase;opacity:.8">Annoudio · ${esc(n)} · ${esc(role)}</div>
<div style="font-size:${phone ? 28 : 46}px;font-weight:650;line-height:1.15;margin-top:14px">${esc(workflow)}</div>
<div style="font-size:${phone ? 13 : 17}px;opacity:.7;margin-top:18px">Recorded on the demo stack</div></div></body>`
}

/** Move the mouse to the middle of the target, in visible steps. */
export async function point(s, locator, { dx = 0.5, dy = 0.5 } = {}) {
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  if (!box) throw new Error(`no box for ${locator}`)
  await s.page.mouse.move(box.x + box.width * dx, box.y + box.height * dy, { steps: 14 })
  await s.page.waitForTimeout(180)
  return box
}

/** Point, then click. */
export async function click(s, locator, options) {
  await point(s, locator)
  await locator.click(options)
}

/** Point, click, then type at a readable speed. */
export async function type(s, locator, text, { clear = true, delay = 35 } = {}) {
  await click(s, locator)
  if (clear) await locator.fill('')
  await locator.pressSequentially(text, { delay })
}

export const pause = (s, ms = 900) => s.page.waitForTimeout(ms)

/** Go to an address; the load is fast-forwarded. */
export async function go(s, url) {
  await s.fast(async () => {
    await s.page.goto(url)
    await s.page.waitForLoadState('networkidle').catch(() => {})
  }, 3)
}

/** Sign in as the operator in a session that is not recorded; give the state file. */
export async function operatorState() {
  const file = join(WORK, 'operator-state.json')
  const browser = await chromium.launch({ args: ['--mute-audio'] })
  const context = await browser.newContext()
  const res = await context.request.post(`${APP}/api/users/login`, {
    data: { email: OPERATOR.email, password: OPERATOR.password },
  })
  if (!res.ok()) throw new Error(`operator login: ${res.status()}`)
  await context.storageState({ path: file })
  await browser.close()
  return file
}

/** Close the session, cut and speed up the marks, and write the WebM, the poster and the caption. */
export async function finish(s, { caption }) {
  const video = s.page.video()
  const end = s.now()
  await s.context.close()
  await s.browser.close()
  const raw = await video.path()
  const out = join(OUT, `${s.name}.webm`)
  const segments = plan(s.marks, end)
  toWebm(raw, out, segments)
  const length = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out], { encoding: 'utf8' }))
  // The poster: the first frame after the title card, once the first page has loaded.
  const firstPage = s.marks.find((m) => m.from >= s.cardEnd - 0.05 && m.speed > 0)
  const at = outputTime(segments, (firstPage ? firstPage.to : s.cardEnd) + 0.3)
  ff(['-ss', at.toFixed(2), '-i', out, '-frames:v', '1', join(OUT, `${s.name}.png`)])
  if (process.env.REC_GIF) toGif(out, join(OUT, `${s.name}.gif`), s.phone ? 390 : 960)
  const size = statSync(out).size
  const md = [
    `# ${s.name}`,
    '',
    `**${s.role}** · ${s.workflow}`,
    '',
    caption.trim(),
    '',
    `[${s.name}.webm](${s.name}.webm) · ${length.toFixed(1)} s · ${(size / 1024 / 1024).toFixed(2)} MB · ${s.viewport.width}×${s.viewport.height} viewport · recorded ${new Date().toLocaleDateString('en-CA')}.`,
    ...(s.notes.length ? ['', 'Stumbles seen while recording:', '', ...s.notes.map((n) => `- ${n}`)] : []),
    '',
  ].join('\n')
  writeFileSync(join(OUT, `${s.name}.md`), md)
  const result = { name: s.name, seconds: Number(length.toFixed(1)), bytes: size, notes: s.notes }
  writeFileSync(join(WORK, `${s.name}.json`), JSON.stringify(result, null, 2))
  console.log(`  ${s.name}.webm: ${length.toFixed(1)} s, ${(size / 1024 / 1024).toFixed(2)} MB`)
  return result
}

/** Kept for the flows: a poster is now taken from the cut video. */
export async function poster() {
  return undefined
}

// Marks → ordered segments that cover [0, end] with a speed each; speed 0 parts are dropped.
function plan(marks, end) {
  const cuts = [...marks].sort((a, b) => a.from - b.from)
  const out = []
  let t = 0
  for (const m of cuts) {
    const from = Math.max(m.from, t)
    if (m.to <= from) continue
    if (from > t) out.push({ from: t, to: from, speed: 1 })
    out.push({ from, to: m.to, speed: m.speed })
    t = m.to
  }
  if (end > t) out.push({ from: t, to: end, speed: 1 })
  return out.filter((g) => g.speed > 0 && g.to - g.from > 0.05)
}

// A time of the raw video → the time of the same frame in the cut video.
function outputTime(segments, t) {
  let out = 0
  for (const g of segments) {
    if (t <= g.from) break
    out += (Math.min(t, g.to) - g.from) / g.speed
  }
  return out
}

const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' })

// Trim and speed up with one filter graph, re-encoded so the trims apply (VP9, 24 fps, ≤ 1280 wide).
function toWebm(raw, out, segments) {
  const parts = segments.map(
    (g, i) => `[0:v]trim=start=${g.from.toFixed(3)}:end=${g.to.toFixed(3)},setpts=(PTS-STARTPTS)/${g.speed}[v${i}]`,
  )
  const joined = `${segments.map((_, i) => `[v${i}]`).join('')}concat=n=${segments.length}:v=1:a=0,fps=24,scale='min(1280,iw)':-2[cut]`
  ff(['-i', raw, '-filter_complex', [...parts, joined].join(';'), '-map', '[cut]',
    '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '32', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', '-an', out])
}

// --gif: a GIF from the cut WebM, with a two-pass palette.
function toGif(webm, gif, width) {
  const palette = join(WORK, `${basename(gif)}.palette.png`)
  const vf = `fps=12,scale=${width}:-1:flags=lanczos`
  ff(['-i', webm, '-vf', `${vf},palettegen`, palette])
  ff(['-i', webm, '-i', palette, '-lavfi', `${vf}[x];[x][1:v]paletteuse`, gif])
}

/** Run a recorded flow: on a failure, keep a screenshot and the accessibility tree. */
export async function record(s, body, caption) {
  let posterPng
  try {
    await body((file) => (posterPng = file))
  } catch (error) {
    await s.page.screenshot({ path: join(WORK, `${s.name}.fail.png`) }).catch(() => {})
    const tree = await s.page.locator('body').ariaSnapshot().catch(() => '')
    writeFileSync(join(WORK, `${s.name}.fail.txt`), `${s.page.url()}\n${error.stack}\n\n${tree}`)
    await s.context.close().catch(() => {})
    await s.browser.close().catch(() => {})
    throw error
  }
  return finish(s, { caption })
}

const STATE = join(WORK, 'state.json')
export function readState() {
  try { return JSON.parse(readFileSync(STATE, 'utf8')) } catch { return {} }
}
export function saveState(patch) {
  const next = { ...readState(), ...patch }
  writeFileSync(STATE, JSON.stringify(next, null, 2))
  return next
}
export const WORKDIR = WORK

/** Click a job link of the admin sidebar; open the sidebar first when it is closed. */
export async function navLink(s, name) {
  const link = s.page.getByRole('complementary').getByRole('link', { name: new RegExp(`^${name}`) }).first()
  const open = await s.page.locator('aside.nav--nav-open').count()
  if (!open) {
    await click(s, s.page.getByRole('button', { name: /Open Menu|Close Menu/ }).first())
    await s.page.waitForTimeout(700)
  }
  await click(s, link)
}
