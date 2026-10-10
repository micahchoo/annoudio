'use client'

// The Projects column of the Recordings list: one chip for each project with a widget for
// the recording. The list row stays the link to the recording; each chip opens its project.

import type { DefaultCellComponentProps } from 'payload'

import { projectPath } from '../paths'
import { Chip } from '../ui/Chip'

export function ProjectsCell({ cellData }: DefaultCellComponentProps) {
  const projects = Array.isArray(cellData)
    ? (cellData as { id: number | string; slug: string; label: string }[])
    : []
  if (projects.length === 0) return null
  return (
    <span className="ao ao-chips">
      {projects.map((p) => (
        <Chip key={p.slug} kind="project" label={p.label} href={projectPath(p.id)} />
      ))}
    </span>
  )
}
