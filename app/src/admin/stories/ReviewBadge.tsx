'use client'

import type { DefaultCellComponentProps } from 'payload'

import type { Lifecycle } from '@/modules/stories'

import { badgeOf } from './badge'

/** The lifecycle state of a row of the review list, as a badge. */
export function ReviewBadge({ cellData }: DefaultCellComponentProps) {
  const state = cellData as Lifecycle | null
  if (!state?.state) return null
  const badge = badgeOf(state)
  return <span className={`annoudio-badge annoudio-badge--${badge.tone}`}>{badge.label}</span>
}
