// The relationship chip (design/design-system.md §6.2): one connected thing with its kind,
// its name and a count; the whole chip is a link to it. A chip with no `href` is static,
// for example a topic in a preview. A cut label shows in full in `title`.

import Link from 'next/link'

import { Icon, type IconName } from './Icon'

export type ChipKind = 'project' | 'recording' | 'member' | 'concept' | 'site' | 'story' | 'invite-code'

const ICONS: Record<ChipKind, IconName> = {
  project: 'project',
  recording: 'recording',
  member: 'member',
  concept: 'concept',
  site: 'site',
  story: 'story',
  'invite-code': 'code',
}

export function Chip(props: {
  kind: ChipKind
  label: string
  href?: string
  /** "6 stories": a count or a short fact after the label. */
  count?: string
  /** Opens a page outside the admin (a host site): a new tab, with the "open" icon. */
  external?: boolean
}) {
  const body = (
    <>
      <Icon name={ICONS[props.kind]} />
      <span className="ao-chip__label">{props.label}</span>
      {props.count && <span className="ao-chip__count">{props.count}</span>}
      {props.href && <Icon name={props.external ? 'open' : 'go'} className="ao-chip__go" />}
    </>
  )
  if (!props.href) {
    return (
      <span className="ao-chip" title={props.label}>
        {body}
      </span>
    )
  }
  if (props.external) {
    return (
      <a className="ao-chip" href={props.href} title={props.label} target="_blank" rel="noreferrer">
        {body}
      </a>
    )
  }
  return (
    <Link className="ao-chip" href={props.href} title={props.label} prefetch={false}>
      {body}
    </Link>
  )
}

/** A chip that makes a new connection: "Add to a project". */
export function AddChip({ label, href }: { label: string; href: string }) {
  return (
    <Link className="ao-chip ao-chip--add" href={href} prefetch={false}>
      <Icon name="add" />
      <span className="ao-chip__label">{label}</span>
    </Link>
  )
}
