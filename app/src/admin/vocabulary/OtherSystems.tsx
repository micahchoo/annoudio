'use client'

// For other systems (O10x, design/vocab.md §8): the folded panel at the end of the
// Vocabulary tab. Download the questions as SHACL or as an Omeka template, or the linked
// data of the project (/admin/export/{project}.ttl|.trig|.jsonld); upload a vocabulary file.

import { useTransition } from 'react'

import type { ProfileFormat } from '@/modules/vocabulary'

import { strings } from '../strings'

import { downloadQuestions } from './actions'
import { LoadFile } from './LoadFile'

const s = strings.otherSystems

export function OtherSystems({ project }: { project: string }) {
  const [pending, start] = useTransition()
  const download = (format: ProfileFormat) =>
    start(async () => {
      const file = await downloadQuestions(project, format)
      if (!file) return
      const link = document.createElement('a')
      link.href = URL.createObjectURL(new Blob([file.body], { type: file.contentType }))
      link.download = file.filename
      link.click()
      URL.revokeObjectURL(link.href)
    })
  return (
    <details className="ao-card ao-card--sunken" id="annoudio-other-systems">
      <summary className="ao-label">{s.heading}</summary>
      <div className="ao-field">
        <p className="ao-label">{s.download}</p>
        <p className="ao-actions">
          <button
            type="button"
            className="ao-btn"
            disabled={pending}
            onClick={() => download('shacl-turtle')}
          >
            {s.shacl}
          </button>
          <button
            type="button"
            className="ao-btn"
            disabled={pending}
            onClick={() => download('shacl-jsonld')}
          >
            {s.shaclJsonLd}
          </button>
          <button
            type="button"
            className="ao-btn"
            disabled={pending}
            onClick={() => download('omeka')}
          >
            {s.omeka}
          </button>
        </p>
        <p className="ao-label">{s.linked}</p>
        <p className="ao-field__help">{s.linkedHelp}</p>
        <p className="ao-actions">
          {(['ttl', 'trig', 'jsonld'] as const).map((extension) => (
            <a
              key={extension}
              className="ao-btn"
              href={`/admin/export/${project}.${extension}`}
              download
            >
              {s[extension === 'ttl' ? 'turtle' : extension]}
            </a>
          ))}
        </p>
      </div>
      <LoadFile project={project} />
    </details>
  )
}
