'use client'

import type { DefaultCellComponentProps } from 'payload'

import { strings } from '../strings'

const labels: Record<string, string> = strings.review.mediaColumn

/** The media state of a story in the list. Empty for a story with no media body. */
export function MediaCell({ cellData }: DefaultCellComponentProps) {
  return <span>{typeof cellData === 'string' ? (labels[cellData] ?? '') : ''}</span>
}
