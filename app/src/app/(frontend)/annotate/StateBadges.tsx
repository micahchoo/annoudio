// The state of an own story as badges, on the cards of Your stories and of the Annotate
// page: the lifecycle word in the colour of whose move it is (design-system.md §3.4, the
// same colours as the admin), "Sent again" after a return, and the time of the last save.

import { LocalDate } from '@/admin/LocalDate'
import { lifecycle, type OwnDraft } from '@/modules/stories'

import { stateKey, stateLabel, strings } from './strings'

export function StateBadges({ story }: { story: OwnDraft }) {
  const state = lifecycle(story)
  return (
    <>
      <span className="state" data-state={stateKey(state)}>
        {stateLabel(state)}
      </span>
      {state.again && (
        <>
          {' '}
          <span className="state" data-state={stateKey(state)}>
            {strings.story.sentAgain}
          </span>
        </>
      )}{' '}
      <span className="saved">
        {strings.story.saved} <LocalDate iso={story.modified} />
      </span>
    </>
  )
}
