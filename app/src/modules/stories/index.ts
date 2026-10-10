// The interface of the `stories` module. Callers import only from this file.
// Design: design/stories-interface.md (decision) and design/stories-interface-C-common-caller.md.
//
// Ordering constraints:
// - Add `storiesCollection` and `storyRepresentationsCollection` to `payload.config.ts`.
// - Call `createStories` once per process, in `payload.config.ts`. The admin GUI
//   uses the settings of the first instance that the process makes.
// - The `vocabulary` module must call `conceptChanged` after it commits a label change.

export { createStories } from './create'
export { lifecycle } from './lifecycle'
export { storiesCollection, storyRepresentationsCollection } from './collection'
export { storyValuesCollection } from './values'
export type {
  Annotation,
  BodyInput,
  ConceptIri,
  DraftInput,
  ExportFilter,
  HistoryLine,
  Lifecycle,
  LifecycleRow,
  MediaState,
  MediaId,
  MemberSession,
  OperatorSession,
  OwnDraft,
  OwnStory,
  ProjectReach,
  ProjectSlug,
  PublishedStory,
  RecentCounts,
  RecordingId,
  ResolvedValue,
  Rejection,
  ReplyAnnotation,
  SaveError,
  SaveResult,
  Stories,
  StoriesConfig,
  StoriesError,
  StoryAnnotation,
  StoryCounts,
  StoryEvent,
  StoryRef,
  StoryId,
  StoryReview,
  Tally,
  ValueBody,
  ValueErrorCode,
  ValueInput,
} from './types'
