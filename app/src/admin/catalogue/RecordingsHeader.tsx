// Above the Recordings list (O8): the button "Add a widget", and the empty state with the
// next move.

import type { ServerProps } from 'payload'

import { PATHS } from '../paths'
import { strings } from '../strings'
import { Icon } from '../ui/Icon'

const s = strings.recordings

export async function RecordingsHeader({ payload }: ServerProps) {
  const { totalDocs } = await payload.count({ collection: 'recordings' })
  if (totalDocs === 0) {
    return (
      <div className="ao ao-empty annoudio-list-empty" role="status">
        <Icon name="recording" />
        <p>{s.empty}</p>
        <a className="ao-btn ao-btn--primary" href={PATHS.addWidget}>
          <Icon name="add" />
          {s.add}
        </a>
      </div>
    )
  }
  return (
    <p className="ao annoudio-list-actions">
      <a className="ao-btn ao-btn--primary" href={PATHS.addWidget}>
        <Icon name="add" />
        {s.add}
      </a>
    </p>
  )
}
