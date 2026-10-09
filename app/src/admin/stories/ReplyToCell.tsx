'use client'

import type { DefaultCellComponentProps } from 'payload'

import { strings } from '../strings'

/**
 * The `replyTo` cell of the stories list: "Reply to: …" with the excerpt of the story that
 * the reply answers. Empty for a story. The hook gives '' when that story is gone.
 */
export function ReplyToCell({ cellData }: DefaultCellComponentProps) {
  if (typeof cellData !== 'string') return null
  return <span>{strings.review.replyTo(cellData || null)}</span>
}
