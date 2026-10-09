import { copyFile } from 'node:fs/promises'
import { MediaError, type Probe } from '../media.ts'
import { inputGuard } from '../ffmpeg-input.ts'
import { run } from '../run.ts'

/**
 * Port: make the served file (the derived file) from a raw file.
 * `source` is the probe of `input`. The adapter writes `output` in the format that
 * `derivedFormat(source)` names; the name of `output` does not choose the format.
 * Rejects with MediaError `transcode-failed`.
 */
export interface Transcoder {
  derive(input: string, output: string, source: Probe): Promise<void>
}

/** AAC-LC, 48 kHz, mono, 64 kbit/s. Enough for speech; every browser plays it. */
const AAC = ['-c:a', 'aac', '-profile:a', 'aac_low', '-b:a', '64k', '-ar', '48000', '-ac', '1']
/** The longest side of a derived video, in pixels. The value keeps a 720p frame (1280 x 720). */
const VIDEO_MAX = 1280
/** The longest side of a derived image, in pixels. */
const IMAGE_MAX = 2048
/** Larger than the transcode of a 3-minute video on one slow core. */
const TRANSCODE_TIMEOUT_MS = 10 * 60_000

/** Fit inside `max` x `max`, keep the aspect ratio, never scale up, keep both sides even. */
function fit(max: number): string {
  const side = (s: string) => `trunc(min(${max},${s})/2)*2`
  return `scale=w='if(gte(iw,ih),${side('iw')},-2)':h='if(gte(iw,ih),-2,${side('ih')})'`
}

const IMAGE_CODEC: Record<string, string[]> = {
  'image/jpeg': ['-c:v', 'mjpeg', '-q:v', '3', '-f', 'image2', '-update', '1'],
  'image/png': ['-c:v', 'png', '-f', 'image2', '-update', '1'],
  'image/webp': ['-c:v', 'libwebp', '-quality', '85', '-f', 'webp'],
}

function outputArgs(source: Probe): string[] {
  switch (source.kind) {
    case 'sound':
      return ['-map', '0:a:0', ...AAC, '-movflags', '+faststart', '-f', 'ipod']
    case 'video':
      return [
        '-map', '0:v:0', '-map', '0:a:0?',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
        '-vf', fit(VIDEO_MAX), '-fpsmax', '30',
        ...AAC, '-movflags', '+faststart', '-f', 'mp4',
      ]
    case 'image': {
      const codec = IMAGE_CODEC[source.format]
      if (!codec) throw new MediaError('unsupported', `no derived image for ${source.format}`)
      // The decoder turns the pixels upright from the EXIF orientation. The encoders write
      // no EXIF, so the re-encode also removes it (with the GPS position).
      const scale = `scale=w='min(${IMAGE_MAX},iw)':h='min(${IMAGE_MAX},ih)':force_original_aspect_ratio=decrease`
      return ['-map', '0:v:0', '-frames:v', '1', '-vf', scale, ...codec]
    }
  }
}

/** The ffmpeg adapter. It runs `ffmpeg` from the PATH. */
export function ffmpegTranscoder(): Transcoder {
  return {
    async derive(input, output, source) {
      const args = [
        '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
        ...inputGuard('local'), '-i', `file:${input}`,
        // Drop the container tags and chapters: a phone can put its GPS position in a tag.
        '-map_metadata', '-1', '-map_chapters', '-1',
        ...outputArgs(source),
        `file:${output}`,
      ]
      try {
        await run('ffmpeg', args, TRANSCODE_TIMEOUT_MS)
      } catch (error) {
        throw new MediaError('transcode-failed', (error as Error).message)
      }
    },
  }
}

/** The fake adapter. It copies the input to the output. */
export function fakeTranscoder(): Transcoder {
  return {
    async derive(input, output) {
      try {
        await copyFile(input, output)
      } catch (error) {
        throw new MediaError('transcode-failed', (error as Error).message)
      }
    },
  }
}
