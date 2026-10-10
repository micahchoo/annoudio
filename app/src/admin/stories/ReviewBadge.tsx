'use client'

import type { DefaultCellComponentProps } from 'payload'

import type { Lifecycle } from '@/modules/stories'

import { badgesOf } from './badge'
import { StateBadge } from '../ui/StateBadge'

/** The lifecycle state of a row of the review list, as badges ("Sent again" too). */
export function ReviewBadge({ cellData }: DefaultCellComponentProps) {
  const state = cellData as Lifecycle | null
  if (!state?.state) return null
  return (
    <span className="ao-badges">
      {badgesOf(state).map((badge) => (
        <StateBadge key={badge.label} badge={badge} />
      ))}
    </span>
  )
}
