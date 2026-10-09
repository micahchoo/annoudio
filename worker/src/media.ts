// Words and facts that the probe, the transcode and the jobs share.
// Read design/media-interface.md for the whole `media` interface.

/** The kind of a media body. The WADM body types are `Sound`, `Image` and `Video`. */
export type Kind = 'sound' | 'image' | 'video'

/** The facts that a probe finds in one file. */
export interface Probe {
  kind: Kind
  /** The MIME type of the container, for example `audio/webm`. */
  format: string
  /** Seconds. Sound and video only. Absent when the file does not tell it. */
  durationSec?: number
  /** Pixels. Image and video only. */
  width?: number
  height?: number
}

/** The error codes. The table in design/media-interface.md says when each one occurs. */
export const MEDIA_ERROR_CODES = [
  'unsupported',
  'kind-mismatch',
  'too-large',
  'too-long',
  'missing-raw',
  'transcode-failed',
] as const
export type MediaErrorCode = (typeof MEDIA_ERROR_CODES)[number]

/**
 * An error that the media chain knows. Every code except `transcode-failed` is permanent:
 * the same file gives the same error again, so the job does not retry it.
 */
export class MediaError extends Error {
  readonly code: MediaErrorCode
  constructor(code: MediaErrorCode, message: string) {
    super(message)
    this.name = 'MediaError'
    this.code = code
  }
  get permanent(): boolean {
    return this.code !== 'transcode-failed'
  }
}

const MB = 1024 * 1024

/** The limits per kind. The tus endpoint checks `bytes`; the job checks all of them. */
export const LIMITS: Readonly<Record<Kind, { bytes: number; seconds?: number; pixels?: number }>> = {
  sound: { bytes: 100 * MB, seconds: 15 * 60 },
  video: { bytes: 250 * MB, seconds: 3 * 60 },
  image: { bytes: 25 * MB, pixels: 50_000_000 },
}

/** The MIME type and the file extension of the derived file for each probed format. */
export function derivedFormat(probe: Pick<Probe, 'kind' | 'format'>): { format: string; ext: string } {
  if (probe.kind === 'sound') return { format: 'audio/mp4', ext: 'm4a' }
  if (probe.kind === 'video') return { format: 'video/mp4', ext: 'mp4' }
  const ext = IMAGE_EXT[probe.format]
  if (!ext) throw new MediaError('unsupported', `no derived image for ${probe.format}`)
  return { format: probe.format, ext }
}

const IMAGE_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
