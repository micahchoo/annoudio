'use client'

// The Name column of the Projects list: the link opens the Overview of the project, its
// first tab (workflow-audit 4), not its settings.

import Link from 'next/link'
import type { DefaultCellComponentProps } from 'payload'

import { projectPath } from '../paths'

export function NameCell({ cellData, rowData }: DefaultCellComponentProps) {
  const id = (rowData as { id?: number | string } | undefined)?.id
  const name = typeof cellData === 'string' ? cellData : ''
  if (id === undefined) return <span>{name}</span>
  return (
    <Link href={projectPath(id)} prefetch={false}>
      {name}
    </Link>
  )
}
