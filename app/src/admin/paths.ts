// The admin addresses of the jobs (design/ia.md §4.1). Links name these, not literals.

export const PATHS = {
  today: '/admin',
  review: '/admin/collections/stories',
  /** "Put a recording on a site" (admin/addPlayer/View.tsx). */
  addPlayer: '/admin/add-player',
  /** The concept tree (admin/vocabulary/ConceptsView.tsx); add `/{project slug}`. */
  concepts: '/admin/concepts',
  members: '/admin/collections/members',
  account: '/admin/account',
  newProject: '/admin/collections/projects/create',
  newConcept: '/admin/collections/concepts/create',
} as const
