import { createHash } from 'node:crypto'

/** A strong ETag: the SHA-256 of the bytes. Equal bytes give an equal ETag. */
export function etagOf(text: string): string {
  return `"${createHash('sha256').update(text, 'utf8').digest('base64url')}"`
}
