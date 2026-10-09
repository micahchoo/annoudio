// What only the real adapters promise: the exact codecs, durations and sizes.
// An independent ffprobe call (helpers `facts`) checks each derived file.

import { mkdtempSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { derivedFormat, ffmpegTranscoder, ffprobeProber } from '../src/index.ts'
import { facts, fixture, serveFixtures } from './helpers.ts'

const prober = ffprobeProber()
const transcoder = ffmpegTranscoder()
const out = mkdtempSync(join(tmpdir(), 'annoudio-ffmpeg-'))

async function derive(name: string): Promise<string> {
  const source = await prober.probe(fixture(name))
  const output = join(out, `${name}.${derivedFormat(source).ext}`)
  await transcoder.derive(fixture(name), output, source)
  return output
}

const audioOf = (path: string) => facts(path).streams.find((s) => s.codec_type === 'audio')!
const videoOf = (path: string) => facts(path).streams.find((s) => s.codec_type === 'video')!

describe('ffprobeProber', () => {
  it.each(['firefox.ogg', 'safari.m4a', 'clip.mp4'])('measures %s as 3 s', async (name) => {
    const { durationSec } = await prober.probe(fixture(name))
    expect(durationSec).toBeGreaterThan(2.8)
    expect(durationSec).toBeLessThan(3.2)
  })

  it("gives no duration for Chrome's WebM, which has none in its header", async () => {
    expect((await prober.probe(fixture('chrome.webm'))).durationSec).toBeUndefined()
  })

  it('gives the size in pixels', async () => {
    expect(await prober.probe(fixture('photo.jpg'))).toMatchObject({ width: 320, height: 240 })
    expect(await prober.probe(fixture('clip.mp4'))).toMatchObject({ width: 1920, height: 1080 })
  })

  it('downloads only the head of a long remote file', async () => {
    const server = await serveFixtures()
    try {
      const probe = await prober.probeUrl(`${server.origin}/long.wav`)
      expect(probe).toMatchObject({ kind: 'sound', format: 'audio/wav' })
      expect(probe.durationSec).toBeCloseTo(600, 0)
      expect(server.sent.get('long.wav')).toBeLessThan(statSync(fixture('long.wav')).size / 4)
    } finally {
      await server.close()
    }
  })
})

describe('ffmpegTranscoder', () => {
  describe.each(['chrome.webm', 'firefox.ogg', 'safari.m4a'])('sound from %s', (name) => {
    let output: string
    beforeAll(async () => {
      output = await derive(name)
    })

    it('is AAC-LC, 48 kHz, mono, in MP4', () => {
      const f = facts(output)
      expect(f.format.format_name).toContain('mp4')
      expect(f.streams).toHaveLength(1)
      expect(audioOf(output)).toMatchObject({ codec_name: 'aac', profile: 'LC', sample_rate: '48000', channels: 1 })
    })

    it('lasts 3 s within 0.2 s', () => {
      expect(Math.abs(Number(facts(output).format.duration) - 3)).toBeLessThan(0.2)
    })

    it('has its index before the data, so a browser can play it while it downloads', () => {
      const bytes = readFileSync(output).toString('latin1')
      expect(bytes.indexOf('moov')).toBeLessThan(bytes.indexOf('mdat'))
    })
  })

  it.each(['safari.m4a', 'clip.mp4'])('removes the tags of %s', async (name) => {
    expect(readFileSync(fixture(name)).includes('LeakyPhone')).toBe(true)
    expect(readFileSync(await derive(name)).includes('LeakyPhone')).toBe(false)
  })

  it('makes a 1080p video H.264 + AAC at 1280 x 720', async () => {
    const output = await derive('clip.mp4')
    expect(videoOf(output)).toMatchObject({ codec_name: 'h264', width: 1280, height: 720, pix_fmt: 'yuv420p' })
    expect(audioOf(output)).toMatchObject({ codec_name: 'aac', profile: 'LC', sample_rate: '48000', channels: 1 })
    expect(Math.abs(Number(facts(output).format.duration) - 3)).toBeLessThan(0.2)
  })

  it('turns a photo upright and removes its EXIF', async () => {
    expect(readFileSync(fixture('photo.jpg')).includes('LeakyPhone')).toBe(true)
    const output = await derive('photo.jpg')
    // Orientation 6 means "turn 90° clockwise", so 320 x 240 becomes 240 x 320.
    expect(videoOf(output)).toMatchObject({ codec_name: 'mjpeg', width: 240, height: 320 })
    const bytes = readFileSync(output)
    expect(bytes.includes('LeakyPhone')).toBe(false)
    expect(bytes.includes('Exif')).toBe(false)
  })

  it('makes a large image at most 2048 px on its longest side', async () => {
    expect(videoOf(await derive('wide.png'))).toMatchObject({ codec_name: 'png', width: 2048, height: 1024 })
  })

  it('keeps a WebP image as WebP', async () => {
    expect(videoOf(await derive('small.webp'))).toMatchObject({ codec_name: 'webp', width: 320, height: 240 })
  })
})
