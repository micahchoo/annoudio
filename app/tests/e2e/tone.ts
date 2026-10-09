// 10 s of tone (the media fixture of the player tests), served with Range support as a
// real media host does: without Range answers, the browser cannot seek in the audio.

import { readFileSync } from 'node:fs'

import type { Page } from '@playwright/test'

const TONE = readFileSync(new URL('../../../embed/tests/fixture/media/tone.m4a', import.meta.url))

/** The status, headers and body that answer a request with this Range header. */
export function toneResponse(range: string | undefined): {
  status: number
  headers: Record<string, string>
  body: Buffer
} {
  const headers = {
    'Content-Type': 'audio/mp4',
    'Accept-Ranges': 'bytes',
    'Access-Control-Allow-Origin': '*',
  }
  const match = /^bytes=(\d+)-(\d*)$/.exec(range ?? '')
  if (!match) return { status: 200, headers, body: TONE }
  const start = Number(match[1])
  const end = match[2] ? Math.min(Number(match[2]), TONE.length - 1) : TONE.length - 1
  return {
    status: 206,
    headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${TONE.length}` },
    body: TONE.subarray(start, end + 1),
  }
}

/** Serve the tone at `url` for this page only, through Playwright routing. */
export async function serveTone(page: Page, url: string): Promise<void> {
  await page.route(url, (route) => route.fulfill(toneResponse(route.request().headers()['range'])))
}
