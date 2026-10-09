// The contract of the two ports. Each test runs against both adapter pairs
// (ffprobe + ffmpeg, fake + fake), so the fakes stay true to the real adapters.

import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { derivedFormat, MediaError, type Kind } from '../src/index.ts'
import { fixture, PAIRS, serveFixtures } from './helpers.ts'

const ACCEPTED: [string, Kind, string][] = [
  ['chrome.webm', 'sound', 'audio/webm'],
  ['firefox.ogg', 'sound', 'audio/ogg'],
  ['safari.m4a', 'sound', 'audio/mp4'],
  ['clip.mp4', 'video', 'video/mp4'],
  ['photo.jpg', 'image', 'image/jpeg'],
  ['wide.png', 'image', 'image/png'],
  ['small.webp', 'image', 'image/webp'],
]

async function rejectsWith(promise: Promise<unknown>, code: string): Promise<void> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  )
  expect(error).toBeInstanceOf(MediaError)
  expect((error as MediaError).code).toBe(code)
}

describe.each(PAIRS)('$name adapters', ({ prober, transcoder }) => {
  describe('Prober', () => {
    it.each(ACCEPTED)('%s is %s, %s', async (name, kind, format) => {
      const probe = await prober.probe(fixture(name))
      expect(probe).toMatchObject({ kind, format })
      if (kind === 'image') expect(probe.durationSec).toBeUndefined()
      if (probe.durationSec !== undefined) expect(probe.durationSec).toBeGreaterThan(0)
      if (kind !== 'sound') {
        expect(probe.width).toBeGreaterThan(0)
        expect(probe.height).toBeGreaterThan(0)
      }
    })

    it.each(['notes.txt', 'list.ffconcat', 'missing.ogg'])('%s is unsupported', async (name) => {
      await rejectsWith(prober.probe(fixture(name)), 'unsupported')
    })

    describe('with an http server', () => {
      let server: Awaited<ReturnType<typeof serveFixtures>>
      beforeAll(async () => {
        server = await serveFixtures()
      })
      afterAll(() => server.close())

      it('probes a recording over http', async () => {
        expect(await prober.probeUrl(`${server.origin}/safari.m4a`)).toMatchObject({ kind: 'sound', format: 'audio/mp4' })
      })

      it.each(['file:///etc/passwd', 'not a url'])('refuses %s', async (url) => {
        await rejectsWith(prober.probeUrl(url), 'unsupported')
      })

      it('does not follow the URLs in an uploaded playlist', async () => {
        const playlist = join(mkdtempSync(join(tmpdir(), 'annoudio-hls-')), 'upload.m3u8')
        const segment = `${server.origin}/firefox.ogg`
        writeFileSync(playlist, `#EXTM3U\n#EXT-X-TARGETDURATION:3\n#EXTINF:3,\n${segment}\n#EXT-X-ENDLIST\n`)
        await rejectsWith(prober.probe(playlist), 'unsupported')
        expect(server.sent.get('firefox.ogg')).toBeUndefined()
      })
    })
  })

  describe('Transcoder', () => {
    const out = mkdtempSync(join(tmpdir(), 'annoudio-contract-'))

    it.each(ACCEPTED)('derives %s to the served format', async (name) => {
      const source = await prober.probe(fixture(name))
      const target = derivedFormat(source)
      const output = join(out, `${name}.${target.ext}`)
      await transcoder.derive(fixture(name), output, source)
      expect(await prober.probe(output)).toMatchObject({ kind: source.kind, format: target.format })
    })

    it('rejects a missing input with transcode-failed', async () => {
      const source = { kind: 'sound', format: 'audio/ogg' } as const
      await rejectsWith(transcoder.derive(fixture('missing.ogg'), join(out, 'missing.m4a'), source), 'transcode-failed')
    })
  })
})
