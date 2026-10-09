import { stat } from 'node:fs/promises'
import { extname } from 'node:path'
import { MediaError, type Kind, type Probe } from '../media.ts'
import { inputGuard } from '../ffmpeg-input.ts'
import { run } from '../run.ts'

/**
 * Port: find the kind, the format and the size of a media file.
 * Both methods reject with MediaError `unsupported` when the input is not media on the
 * accepted list (design/media-interface.md, "Formats accepted").
 */
export interface Prober {
  probe(path: string): Promise<Probe>
  /** Probe a remote file over http(s). ffprobe reads only the bytes that it needs. */
  probeUrl(url: string): Promise<Probe>
}

interface FfprobeStream {
  codec_type?: string
  codec_name?: string
  width?: number
  height?: number
  duration?: string
  disposition?: { attached_pic?: number }
}
interface FfprobeOutput {
  streams?: FfprobeStream[]
  format?: { format_name?: string; duration?: string; tags?: { major_brand?: string } }
}

const IMAGE_CODECS: Record<string, string> = { mjpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
const IMAGE_DEMUXERS = new Set(['image2', 'jpeg_pipe', 'png_pipe', 'webp_pipe'])
/** The MIME subtype of each accepted container, keyed by the first name of the ffprobe demuxer. */
const CONTAINERS: Record<string, { sound?: string; video?: string }> = {
  matroska: { sound: 'audio/webm', video: 'video/webm' },
  ogg: { sound: 'audio/ogg' },
  mov: { sound: 'audio/mp4', video: 'video/mp4' },
  mp3: { sound: 'audio/mpeg' },
  wav: { sound: 'audio/wav' },
  flac: { sound: 'audio/flac' },
}

const PROBE_TIMEOUT_MS = 30_000

/** The ffprobe adapter. It runs `ffprobe` from the PATH. */
export function ffprobeProber(): Prober {
  const probe = async (input: string, guard: string[]): Promise<Probe> => {
    let stdout: string
    try {
      stdout = await run(
        'ffprobe',
        ['-v', 'error', ...guard, '-show_format', '-show_streams', '-of', 'json', input],
        PROBE_TIMEOUT_MS,
      )
    } catch (error) {
      throw new MediaError('unsupported', `ffprobe cannot read the input: ${(error as Error).message}`)
    }
    return interpret(JSON.parse(stdout) as FfprobeOutput)
  }
  return {
    async probe(path) {
      // The `file:` prefix stops ffprobe from reading a name such as `http:x` as a URL.
      return probe(`file:${path}`, inputGuard('local'))
    },
    async probeUrl(url) {
      return probe(remote(url), inputGuard('remote'))
    },
  }
}

function interpret(output: FfprobeOutput): Probe {
  const demuxer = output.format?.format_name ?? ''
  const streams = output.streams ?? []
  const video = streams.find((s) => s.codec_type === 'video' && s.disposition?.attached_pic !== 1)
  const audio = streams.find((s) => s.codec_type === 'audio')

  if (IMAGE_DEMUXERS.has(demuxer)) {
    const format = video?.codec_name && IMAGE_CODECS[video.codec_name]
    if (!format || !video) throw new MediaError('unsupported', `image codec ${video?.codec_name} is not accepted`)
    return { kind: 'image', format, width: video.width, height: video.height }
  }

  const container = CONTAINERS[demuxer.split(',')[0]!]
  const kind: Kind | undefined = video ? 'video' : audio ? 'sound' : undefined
  if (!container || !kind) throw new MediaError('unsupported', `no sound or video in container ${demuxer}`)
  let format = container[kind]
  if (format === 'video/mp4' && output.format?.tags?.major_brand === 'qt  ') format = 'video/quicktime'
  if (!format) throw new MediaError('unsupported', `${kind} in container ${demuxer} is not accepted`)

  const durationSec = seconds(output.format?.duration) ?? seconds((video ?? audio)?.duration)
  return {
    kind,
    format,
    ...(durationSec !== undefined && { durationSec }),
    ...(video && { width: video.width, height: video.height }),
  }
}

function seconds(value: string | undefined): number | undefined {
  const n = Number(value)
  return value !== undefined && Number.isFinite(n) && n > 0 ? n : undefined
}

/**
 * The fake adapter. It does not read the file: the extension gives the kind and the format,
 * and the options give the size. It rejects a missing file and an unknown extension.
 */
export function fakeProber(options: { durationSec?: number; width?: number; height?: number } = {}): Prober {
  const { durationSec = 3, width = 320, height = 240 } = options
  const fromName = (name: string): Probe => {
    const found = FAKE_EXTENSIONS[extname(name).toLowerCase()]
    if (!found) throw new MediaError('unsupported', `the fake prober does not know ${name}`)
    if (found.kind === 'image') return { ...found, width, height }
    if (found.kind === 'video') return { ...found, durationSec, width, height }
    return { ...found, durationSec }
  }
  return {
    async probe(path) {
      await stat(path).catch(() => {
        throw new MediaError('unsupported', `no file at ${path}`)
      })
      return fromName(path)
    },
    async probeUrl(url) {
      return fromName(new URL(remote(url)).pathname)
    },
  }
}

/** Give `url` back when it is http or https. */
function remote(url: string): string {
  const protocol = URL.parse(url)?.protocol
  if (protocol !== 'https:' && protocol !== 'http:') {
    throw new MediaError('unsupported', `only http and https URLs can be probed, not ${protocol}`)
  }
  return url
}

const FAKE_EXTENSIONS: Record<string, Pick<Probe, 'kind' | 'format'>> = {
  '.webm': { kind: 'sound', format: 'audio/webm' },
  '.ogg': { kind: 'sound', format: 'audio/ogg' },
  '.m4a': { kind: 'sound', format: 'audio/mp4' },
  '.mp3': { kind: 'sound', format: 'audio/mpeg' },
  '.wav': { kind: 'sound', format: 'audio/wav' },
  '.flac': { kind: 'sound', format: 'audio/flac' },
  '.mp4': { kind: 'video', format: 'video/mp4' },
  '.mov': { kind: 'video', format: 'video/quicktime' },
  '.jpg': { kind: 'image', format: 'image/jpeg' },
  '.png': { kind: 'image', format: 'image/png' },
  '.webp': { kind: 'image', format: 'image/webp' },
}
