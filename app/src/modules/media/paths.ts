import { resolve, sep } from 'node:path'

/** The UUID of an upload. The worker accepts only ids of this form as file names. */
export const MEDIA_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** Resolve `relative` in MEDIA_DIR. Throws for a path that goes out of it. */
export function inMediaDir(mediaDir: string, relative: string): string {
  const base = resolve(mediaDir)
  const path = resolve(base, relative)
  if (!path.startsWith(base + sep)) throw new Error(`${relative} is not in MEDIA_DIR`)
  return path
}
