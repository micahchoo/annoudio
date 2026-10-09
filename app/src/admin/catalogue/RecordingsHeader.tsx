// Above the Recordings list (O8): the button "Add a player", and the empty text.

import { Button } from '@payloadcms/ui'
import type { ServerProps } from 'payload'

import { PATHS } from '../paths'
import { strings } from '../strings'

const s = strings.recordings

export async function RecordingsHeader({ payload }: ServerProps) {
  const { totalDocs } = await payload.count({ collection: 'recordings' })
  return (
    <>
      <p className="annoudio-list-actions">
        <Button el="link" url={PATHS.addPlayer} buttonStyle="primary" size="medium">
          {s.add}
        </Button>
      </p>
      {totalDocs === 0 && (
        <div className="annoudio-empty" role="status">
          <p>{s.empty}</p>
        </div>
      )}
    </>
  )
}
