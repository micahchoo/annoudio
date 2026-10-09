// The upload formats that the Annotate page can send, per kind. The worker probes the
// file again and refuses a file whose content does not agree (design/media-interface.md).

import { derivedFormat, type Kind } from 'annoudio-worker'

/** The MIME types of an upload, without parameters, and the extension of the raw file. */
const UPLOAD_TYPES: Record<Kind, Record<string, string>> = {
  sound: {
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/flac': 'flac',
  },
  video: { 'video/webm': 'webm', 'video/mp4': 'mp4', 'video/quicktime': 'mov' },
  image: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' },
}

export const KINDS: readonly Kind[] = ['sound', 'image', 'video']

export function isKind(value: unknown): value is Kind {
  return typeof value === 'string' && (KINDS as readonly string[]).includes(value)
}

/**
 * The upload type in a form that the tables know: lower case, without parameters.
 * MediaRecorder gives for example `audio/webm;codecs=opus`.
 */
export function baseType(type: string): string {
  return type.split(';')[0].trim().toLowerCase()
}

/** The extension of the raw file, or null when the kind does not accept the type. */
export function rawExtension(kind: Kind, type: string): string | null {
  return UPLOAD_TYPES[kind][baseType(type)] ?? null
}

/**
 * The format that the derived file will have. The worker gives the real one when it is
 * ready; for an image, the probe can find a different format than the upload declared.
 */
export function expectedFormat(kind: Kind, type: string): string {
  return derivedFormat({ kind, format: baseType(type) }).format
}

/** The MIME types that the file picker of the Annotate page offers: images and videos. */
export const PICKER_TYPES = [...Object.keys(UPLOAD_TYPES.image), ...Object.keys(UPLOAD_TYPES.video)]
