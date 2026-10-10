import { rm } from 'node:fs/promises'

import type { Access, CollectionAfterDeleteHook, CollectionConfig } from 'payload'

import { inMediaDir } from './paths'

export const MEDIA = 'media'

const nobody = () => false
const operator: Access = ({ req }) => req.user?.collection === 'users'

// The hook needs MEDIA_DIR. Each `createMedia` gives it, and the newest one wins. The app
// makes one instance per process (`payload.config.ts`); a test makes its own after it.
let appMediaDir: string | undefined

export function registerMediaDir(mediaDir: string): void {
  appMediaDir = mediaDir
}

/**
 * An operator deletes a media body to take it down. The files go too, so the URL gives
 * 404 and no copy stays on the volume. This is the only path that deletes a raw file.
 */
const removeFiles: CollectionAfterDeleteHook = async ({ doc }) => {
  if (!appMediaDir) return
  for (const relative of [doc.raw, doc.derived]) {
    if (typeof relative === 'string' && relative) {
      await rm(inMediaDir(appMediaDir, relative), { force: true })
    }
  }
}

const readOnly = { readOnly: true }

/**
 * One row per upload. Only the `media` module writes it: the upload makes the row,
 * the `media.settled` consumer sets the result. Operators can see the list and delete a
 * row. Closed to GraphQL; the REST API answers operators only.
 */
export const mediaCollection: CollectionConfig = {
  slug: MEDIA,
  labels: { singular: 'Media body', plural: 'Media bodies' },
  admin: {
    // Reached from its story only (design/ia.md §3).
    group: false,
    hideAPIURL: true,
      components: { beforeListTable: ['/admin/ListEmpty#MediaEmpty'] },
    defaultColumns: ['kind', 'state', 'member', 'size', 'createdAt'],
    description:
      'A voice note, photo or video is one part of a story, next to its text. A delete here removes the file from its story.',
  },
  graphQL: false,
  access: { read: operator, delete: operator, create: nobody, update: nobody },
  fields: [
    // The UUID that the upload makes. Also the last part of the body URL.
    { name: 'id', type: 'text', required: true, admin: readOnly },
    // The id of the member who uploaded it.
    { name: 'member', type: 'text', required: true, index: true, admin: readOnly },
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: [
        { label: 'Voice note', value: 'sound' },
        { label: 'Photo', value: 'image' },
        { label: 'Video', value: 'video' },
      ],
      admin: readOnly,
    },
    {
      name: 'state',
      type: 'select',
      required: true,
      defaultValue: 'uploaded',
      options: [
        { label: 'Processing', value: 'uploaded' },
        { label: 'Ready', value: 'ready' },
        { label: 'Failed', value: 'failed' },
      ],
      admin: readOnly,
    },
    // Bytes of the raw file.
    { name: 'size', type: 'number', required: true, admin: readOnly },
    // Paths relative to MEDIA_DIR: raw/<id>.<ext> and, when ready, derived/<id>.<ext>.
    { name: 'raw', type: 'text', required: true, admin: readOnly },
    { name: 'derived', type: 'text', admin: readOnly },
    // The MIME type of the derived file. Until it is ready: the expected type.
    { name: 'format', type: 'text', required: true, admin: readOnly },
    { name: 'durationSec', type: 'number', admin: readOnly },
    { name: 'width', type: 'number', admin: readOnly },
    { name: 'height', type: 'number', admin: readOnly },
    // `<code>: <message>` from the worker when the state is failed.
    { name: 'error', type: 'text', admin: readOnly },
  ],
  hooks: { afterDelete: [removeFiles] },
}
