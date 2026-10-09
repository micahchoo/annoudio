// Makes the fixture files with ffmpeg, once per run, and makes the test database.
// The sound fixtures copy what each browser's MediaRecorder gives (research/architecture-concerns.md §3).

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'
import type { TestProject } from 'vitest/node'

declare module 'vitest' {
  export interface ProvidedContext {
    fixtures: string
  }
}

const SINE = (rate: number, seconds = 3) => ['-f', 'lavfi', '-i', `sine=frequency=440:duration=${seconds}:sample_rate=${rate}`]
const PICTURE = (size: string) => ['-f', 'lavfi', '-i', `testsrc2=size=${size}`, '-frames:v', '1']

const FIXTURES: Record<string, string[]> = {
  // Chrome: Opus in WebM. MediaRecorder writes no duration in the header; `-live 1` does the same.
  'chrome.webm': [...SINE(48000), '-ac', '2', '-c:a', 'libopus', '-b:a', '48k', '-live', '1', '-f', 'webm'],
  // Firefox: Opus in Ogg.
  'firefox.ogg': [...SINE(48000), '-c:a', 'libopus', '-f', 'ogg'],
  // Safari: AAC in MP4, here 44.1 kHz stereo, so the transcode must resample and mix down.
  // The `LeakyPhone` tags stand for the private tags that a phone writes, such as its position.
  'safari.m4a': [...SINE(44100), '-ac', '2', '-c:a', 'aac', '-metadata', 'title=LeakyPhone', '-f', 'mp4'],
  // A 3 s phone video at 1080p, larger than the video limit of 1280 px.
  'clip.mp4': [
    '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:duration=3:rate=30', ...SINE(44100),
    '-shortest', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
    '-metadata', 'title=LeakyPhone', '-f', 'mp4',
  ],
  'photo.jpg': [...PICTURE('320x240'), '-f', 'image2'],
  'wide.png': [...PICTURE('2400x1200'), '-f', 'image2'],
  'small.webp': [...PICTURE('320x240'), '-c:v', 'libwebp', '-f', 'webp'],
  // 10 minutes of WAV (58 MB) for the test of how much `probeUrl` downloads. It is much
  // larger than the socket buffers (a few MB), which the server count includes.
  'long.wav': [...SINE(48000, 600), '-c:a', 'pcm_s16le', '-f', 'wav'],
}

export default async function setup(project: TestProject): Promise<() => void> {
  const dir = mkdtempSync(join(tmpdir(), 'annoudio-worker-fixtures-'))
  for (const [name, args] of Object.entries(FIXTURES)) {
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args, join(dir, name)])
  }
  addExif(join(dir, 'photo.jpg'))
  writeFileSync(join(dir, 'notes.txt'), 'This is not media.\n')
  // A concat list names another file. The guard must refuse it.
  writeFileSync(join(dir, 'list.ffconcat'), `ffconcat version 1.0\nfile '${join(dir, 'firefox.ogg')}'\n`)
  project.provide('fixtures', dir)

  await createDatabase(process.env.TEST_DATABASE_URL!)
  return () => rmSync(dir, { recursive: true, force: true })
}

/**
 * Put an EXIF block after the JPEG start marker: Orientation 6 (turn 90° clockwise to show)
 * and Make "LeakyPhone", which stands for the private data that a phone writes.
 */
function addExif(path: string): void {
  const make = Buffer.from('LeakyPhone\0', 'latin1')
  const entries = 2
  const ifdSize = 2 + entries * 12 + 4
  const tiff = Buffer.alloc(8 + ifdSize + make.length)
  tiff.write('II', 0, 'latin1')
  tiff.writeUInt16LE(42, 2)
  tiff.writeUInt32LE(8, 4)
  tiff.writeUInt16LE(entries, 8)
  // Make: tag 0x010F, ASCII, the value is after the IFD.
  tiff.writeUInt16LE(0x010f, 10)
  tiff.writeUInt16LE(2, 12)
  tiff.writeUInt32LE(make.length, 14)
  tiff.writeUInt32LE(8 + ifdSize, 18)
  // Orientation: tag 0x0112, SHORT, value 6.
  tiff.writeUInt16LE(0x0112, 22)
  tiff.writeUInt16LE(3, 24)
  tiff.writeUInt32LE(1, 26)
  tiff.writeUInt16LE(6, 30)
  tiff.writeUInt32LE(0, 34)
  make.copy(tiff, 8 + ifdSize)
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff])
  const header = Buffer.from([0xff, 0xe1, 0, 0])
  header.writeUInt16BE(body.length + 2, 2)
  const jpeg = readFileSync(path)
  writeFileSync(path, Buffer.concat([jpeg.subarray(0, 2), header, body, jpeg.subarray(2)]))
}

async function createDatabase(url: string): Promise<void> {
  const target = new URL(url)
  const name = target.pathname.slice(1)
  const admin = new URL(url)
  admin.pathname = '/postgres'
  const client = new pg.Client({ connectionString: admin.toString() })
  await client.connect()
  try {
    const found = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])
    if (found.rowCount === 0) await client.query(`CREATE DATABASE "${name.replaceAll('"', '""')}"`)
  } finally {
    await client.end()
  }
}
