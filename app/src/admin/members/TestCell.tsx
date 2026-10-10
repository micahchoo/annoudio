'use client'

// The Test column of the Members list: a "Test" badge for a member that an operator made to
// try the member steps. Member counts leave such a member out.

import type { DefaultCellComponentProps } from 'payload'

import { strings } from '../strings'

export function TestCell({ cellData }: DefaultCellComponentProps) {
  return cellData === true ? <TestBadge /> : null
}

export function TestBadge() {
  return (
    <span className="ao ao-badge" title={strings.member.testMeaning}>
      {strings.member.test}
    </span>
  )
}
