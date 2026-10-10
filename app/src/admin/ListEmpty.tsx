// The empty state of a list (design/design-system.md §5, Empty state): what the list holds,
// why it is empty, and the next move. Payload's own "No results" text goes when this shows
// (custom.scss). Each list has one component, above its table (`beforeListTable`).

import type { CollectionSlug, ServerProps } from 'payload'

import { PATHS } from './paths'
import { strings } from './strings'
import { Icon, type IconName } from './ui/Icon'

const s = strings.empty

async function Empty(props: {
  payload: ServerProps['payload']
  collection: CollectionSlug
  /** Show the state at this count (0 for an empty list; 1 for "only you"). */
  at?: number
  icon: IconName
  text: string
  next?: { href: string; label: string }
}) {
  const { totalDocs } = await props.payload.count({ collection: props.collection })
  if (totalDocs !== (props.at ?? 0)) return null
  return (
    <div className="ao ao-empty annoudio-list-empty" role="status">
      <Icon name={props.icon} />
      <p>{props.text}</p>
      {props.next && (
        <a className="ao-btn ao-btn--primary" href={props.next.href}>
          <Icon name="add" />
          {props.next.label}
        </a>
      )}
    </div>
  )
}

export const ProjectsEmpty = ({ payload }: ServerProps) => (
  <Empty
    payload={payload}
    collection="projects"
    icon="project"
    text={s.projects}
    next={{ href: PATHS.newProject, label: s.newProject }}
  />
)

export const MembersEmpty = ({ payload }: ServerProps) => (
  <Empty
    payload={payload}
    collection="members"
    icon="member"
    text={s.members}
    next={{ href: PATHS.addWidget, label: strings.addWidget.title }}
  />
)

export const OperatorsEmpty = ({ payload }: ServerProps) => (
  <Empty
    payload={payload}
    collection="users"
    at={1}
    icon="member"
    text={s.operators}
    next={{ href: '/admin/collections/users/create', label: s.addOperator }}
  />
)

export const MediaEmpty = ({ payload }: ServerProps) => (
  <Empty payload={payload} collection="media" icon="recording" text={s.media} />
)

export const ItemsEmpty = ({ payload }: ServerProps) => (
  <Empty
    payload={payload}
    collection="concepts"
    icon="concept"
    text={s.items}
    next={{ href: PATHS.concepts, label: s.openLists }}
  />
)
