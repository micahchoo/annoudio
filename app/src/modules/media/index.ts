// The interface of the `media` module. Callers import only from this file.
// Design: design/media-interface.md; Phase 4b decisions: design/phase4b-notes.md.
//
// The module stores the uploads of media bodies (tus), queues the transcode for the
// worker container, serves the derived files, and keeps the state of each body.
//
// Ordering constraints:
// - Add `mediaCollection` to `payload.config.ts`.
// - Call `createMedia` once per process, in `payload.config.ts`.
// - Start `startSettledConsumer` in the Next server process only (`src/instrumentation.ts`),
//   never in Payload `onInit`: the migrate script and other CLI runs also run `onInit`.

import { LIMITS, type Kind } from 'annoudio-worker'

export { mediaCollection } from './collection'
export { createMedia, type Media, type MediaConfig, type SettledConsumer } from './create'
export { PICKER_TYPES } from './formats'
export {
  body,
  mediaIdOf,
  removeBody,
  type MediaBody,
  type MediaContext,
  type MediaId,
  type MediaState,
} from './lookup'
export type { Kind as MediaKind }

/** The largest upload of each kind, in bytes. The Annotate page shows and checks it. */
export const UPLOAD_LIMITS: Readonly<Record<Kind, number>> = {
  sound: LIMITS.sound.bytes,
  image: LIMITS.image.bytes,
  video: LIMITS.video.bytes,
}
