// The slots of the review screen (O5): Payload renders them on the server with the
// document id and the user. Each one reads the story through `stories` (once per request)
// and its state through `lifecycle`. The client parts are in Dialogs.tsx.

import { membership, stories } from '@payload-config'
import type { ServerProps } from 'payload'
import { cache } from 'react'

import { ago, clockRange } from '@/clock'
import { lifecycle } from '@/modules/stories'

import { operatorOf } from '../operator'
import { strings } from '../strings'

import { badgeOf } from './badge'
import { NextStoryButton, PublishDialog, RemoveDialog, ReturnDialog } from './Dialogs'

const s = strings.review

type SlotProps = ServerProps & { id?: number | string }

const reviewOf = cache((operatorId: string, name: string | undefined, id: string) =>
  stories.review({ operatorId, name }, id),
)
const historyOf = cache((operatorId: string, id: string) => stories.history({ operatorId }, id))

async function load({ id, user }: SlotProps) {
  const operator = operatorOf(user)
  if (!operator || id === undefined) return null
  const story = await reviewOf(operator.operatorId, operator.name, String(id))
  return story ? { story, state: lifecycle(story) } : null
}

/**
 * The badge of the lifecycle state and its age: "Waiting for review since 2 days ago".
 * A save after a return says "Sent again after a return" (design/ia.md §6, F4).
 */
export async function Status(props: SlotProps) {
  const found = await load(props)
  if (!found) return null
  const badge = badgeOf(found.state)
  const waits = (found.state.change ?? found.state.state) === 'waiting'
  const operator = operatorOf(props.user)!
  const lines = waits ? await historyOf(operator.operatorId, found.story.id) : []
  const again =
    lines[0]?.action === 'saved' && lines.some((line) => line.action.startsWith('returned'))
  return (
    <p className="annoudio-status">
      <span className={`annoudio-badge annoudio-badge--${badge.tone}`}>{badge.label}</span>{' '}
      <span className="annoudio-status__age">{s.since(ago(found.story.modified, new Date()))}</span>
      {again && <span className="annoudio-status__again">{strings.history.sentAgain}</span>}
    </p>
  )
}

/**
 * Publish (O5a), absent for a published story with no change; then Remove (O5c). Payload
 * shows its document menu only with a create or a delete permission, and its Delete would
 * skip `stories.remove` (the replies, the files, M5). So Remove is a button here.
 */
export async function PublishControl(props: SlotProps) {
  const found = await load(props)
  if (!found) return null
  const { story, state } = found
  const remove = <RemoveDialog id={story.id} replies={story.replies} />
  if (state.state === 'published' && state.change === null) return remove
  const processing = (state.change ?? state.state) === 'processing'
  const contact = await membership.contact(story.member.id)
  return (
    <>
      <PublishDialog
        id={story.id}
        blocked={processing ? s.stillProcessing : null}
        mail={contact?.mailNotices === true}
        preview={{
          nickname: story.member.nickname,
          range: story.start === undefined ? null : clockRange(story.start, story.end),
          reply: story.replyTo !== undefined,
          parentNickname: story.replyTo?.nickname ?? null,
          texts: story.texts,
          tags: story.tags.flatMap((tag) => tag.label ?? []),
          media: story.media.map((body) => s.mediaKinds[body.kind]),
        }}
      />
      {remove}
    </>
  )
}

/** Return to the member (O5b). Absent when the member already has it back. */
export async function ReturnControl(props: SlotProps) {
  const found = await load(props)
  if (!found) return null
  const { state } = found
  if ((state.change ?? state.state) === 'returned') return null
  const effect = state.change !== null ? 'keeps' : state.state === 'published' ? 'stops' : 'none'
  return <ReturnDialog id={found.story.id} effect={effect} />
}

/** Next story, in place of Payload's "Save draft". */
export async function NextStoryControl(props: SlotProps) {
  if (!operatorOf(props.user) || props.id === undefined) return null
  return <NextStoryButton next={await stories.nextWaiting(String(props.id))} />
}

/** No Unpublish (design/ia.md §0, 2): Return or Remove takes a story down. */
export function NoUnpublish() {
  return null
}
