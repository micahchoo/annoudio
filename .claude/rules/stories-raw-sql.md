---
scope: app/src/modules/stories/**
tags: [schema, sql, coupling]
priority: high
source: hand-written
---
These places in `stories` read or write the tables with raw SQL, not through Payload:
`review.ts` (`countsOf`, `tagCountsOf`, `recentOf`, `reachOf`, the reply count of
`reviewOf`), `create.ts` (`conceptChanged`, `remove`,
`nextWaiting`, `mediaSettled`, which also writes `processing`), `rebuild.ts`
(`forgetInstances`, which also deletes from `story_representations` by its `instance`
column), and the data moves in
`app/src/migrations/*phase5*`. They name the columns that Payload makes from the fields
in `collection.ts`: `stories._status`, `stories.project`, `stories.recording`,
`stories.wadm`, `stories.member`, `stories.processing`, `stories.created_at`, `_stories_v.latest`,
`_stories_v.parent_id`, `_stories_v.version_*` (for example `version_rejection_at` from
the group `rejection.at`, `version_rejection_automatic`, `version_processing`,
`version_last_action`, `version_changed_by`, `version_told_on`). One
`execute` holds one statement: a prepared statement with parameters takes one command.

A rename of one of these fields, or of the `rejection` group, breaks the counts and the
relabel with no type error. Change the SQL in the same change, and run
`tests/int/stories/` and `tests/int/vocabulary/`.
