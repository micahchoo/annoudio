import { execFileSync } from 'node:child_process'
import { createReadStream, statSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { inject } from 'vitest'
import { fakeProber, fakeTranscoder, ffmpegTranscoder, ffprobeProber, type Prober, type Transcoder } from '../src/index.ts'

export const fixtures = inject('fixtures')
export const fixture = (name: string) => join(fixtures, name)

/** The two adapter pairs. A contract test runs against each. */
export const PAIRS: { name: string; prober: Prober; transcoder: Transcoder }[] = [
  { name: 'ffmpeg', prober: ffprobeProber(), transcoder: ffmpegTranscoder() },
  { name: 'fake', prober: fakeProber(), transcoder: fakeTranscoder() },
]

export interface Facts {
  streams: { codec_type: string; codec_name: string; profile?: string; sample_rate?: string; channels?: number; width?: number; height?: number; pix_fmt?: string }[]
  format: { format_name: string; duration?: string }
}

/** ffprobe as an oracle that does not depend on the code under test. */
export function facts(path: string): Facts {
  return JSON.parse(
    execFileSync('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', path], { encoding: 'utf8' }),
  ) as Facts
}

/**
 * Serve the fixtures over http with byte ranges. `sent` counts the body bytes per file that
 * went into the socket; the kernel buffers make it larger than what the client read.
 */
export async function serveFixtures(): Promise<{ origin: string; sent: Map<string, number>; close(): Promise<void> }> {
  const sent = new Map<string, number>()
  const server: Server = createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname.slice(1))
    const path = fixture(name)
    let size: number
    try {
      size = statSync(path).size
    } catch {
      res.writeHead(404).end()
      return
    }
    const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? '')
    const start = range ? Number(range[1]) : 0
    const end = range && range[2] ? Number(range[2]) : size - 1
    res.writeHead(range ? 206 : 200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': end - start + 1,
      'Accept-Ranges': 'bytes',
      ...(range && { 'Content-Range': `bytes ${start}-${end}/${size}` }),
    })
    const stream = createReadStream(path, { start, end })
    stream.on('data', (chunk) => sent.set(name, (sent.get(name) ?? 0) + chunk.length))
    // When the client hangs up, stop reading, so `sent` stays near what the client took.
    res.on('close', () => stream.destroy())
    stream.pipe(res)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    origin: `http://127.0.0.1:${port}`,
    sent,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      }),
  }
}
