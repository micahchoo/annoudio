// A lifecycle state as a badge (design/design-system.md §3.4, §5 Badge): an icon and a word,
// in the colour of whose move it is. Never colour alone.

import type { Badge } from '../stories/badge'

import { Icon } from './Icon'

export function StateBadge({ badge }: { badge: Badge }) {
  return (
    <span className={`ao-badge ao-badge--${badge.tone}`}>
      <Icon name={badge.tone} />
      {badge.label}
    </span>
  )
}
