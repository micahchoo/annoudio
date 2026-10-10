// The admin addresses of the jobs and objects (design/ia.md §4.1). Links name these, not
// literals.

export const PATHS = {
  today: '/admin',
  review: '/admin/collections/stories',
  /** "Add a widget to a site" (admin/addWidget/View.tsx). Takes `?recording=` and `?project=`. */
  addWidget: '/admin/add-widget',
  /** The lists of a project (admin/vocabulary/ConceptsView.tsx); add `/{project slug}`. */
  concepts: '/admin/concepts',
  /** The questions of a project (admin/vocabulary/VocabularyView.tsx); add `/{project slug}`. */
  vocabulary: '/admin/vocabulary',
  members: '/admin/collections/members',
  recordings: '/admin/collections/recordings',
  projects: '/admin/collections/projects',
  account: '/admin/account',
  newProject: '/admin/collections/projects/create',
  newConcept: '/admin/collections/concepts/create',
  /** The operator preview of one widget (admin/preview/View.tsx); add `/{project}/{recording}`. */
  preview: '/admin/preview',
} as const

/** The page of one recording, one project (its Overview first) or one member. */
export const recordingPath = (id: string) => `${PATHS.recordings}/${encodeURIComponent(id)}`
export const projectPath = (id: string | number) => `${PATHS.projects}/${id}/overview`
export const memberPath = (id: string) => `${PATHS.members}/${encodeURIComponent(id)}`
export const previewPath = (project: string, recording: string) =>
  `${PATHS.preview}/${encodeURIComponent(project)}/${encodeURIComponent(recording)}`

/**
 * Review stories, filtered: all states of one project, recording or member. The tabs of the
 * list then show no tab as current; the filter shows in Payload's own filter bar.
 */
export function storiesPath(filter: { project?: string; recording?: string; member?: string }) {
  const query = new URLSearchParams()
  let i = 0
  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined) query.set(`where[and][${i++}][${key}][equals]`, value)
  }
  query.set(`where[and][${i}][_status][exists]`, 'true')
  return `${PATHS.review}?${query}`
}

/**
 * The Annotate page for one widget (CONTRACT.md §7.1), as an operator opens it to try the
 * member flow. `back`: the page that the Annotate page sends the member back to; it must be
 * on the website list of the project, or the stack itself (the preview page).
 */
export function annotatePath(origin: string, project: string, recording: string, back?: string) {
  const query = new URLSearchParams({ project, recording, t: '0' })
  if (back) query.set('return', back)
  return `${origin}/annotate?${query}`
}

/** The `where` of each tab of Review stories (admin/stories/ReviewTabs.tsx). */
export const REVIEW_TABS = {
  waiting: {
    'where[and][0][_status][equals]': 'draft',
    'where[and][1][rejection.at][exists]': 'false',
    'where[and][2][processing][not_equals]': 'true',
  },
  processing: {
    'where[and][0][_status][equals]': 'draft',
    'where[and][1][processing][equals]': 'true',
    'where[and][2][rejection.at][exists]': 'false',
  },
  returned: {
    'where[and][0][_status][equals]': 'draft',
    'where[and][1][rejection.at][exists]': 'true',
  },
  published: { 'where[and][0][_status][equals]': 'published' },
  all: { 'where[and][0][_status][exists]': 'true' },
} as const satisfies Record<string, Record<string, string>>

export type ReviewTab = keyof typeof REVIEW_TABS

/** One tab of Review stories, for one project or recording too. */
export function reviewTabPath(
  tab: ReviewTab,
  filter: { project?: string; recording?: string; member?: string } = {},
) {
  const query = new URLSearchParams(REVIEW_TABS[tab])
  let i = Object.keys(REVIEW_TABS[tab]).length
  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined) query.set(`where[and][${i++}][${key}][equals]`, value)
  }
  return `${PATHS.review}?${query}`
}
