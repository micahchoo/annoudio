// The top of a recording page (O9): what the recording is in audio annotation, its widgets
// (the projects that show it, with their story counts), a live "Try it: tell a story" for
// each, and the snippet. The projects come from `projects` (the widgets that an operator
// added) and from `stories` (projects with stories for it); the snippet from
// `catalogue.snippet` (CONTRACT.md §1).

import { stories } from '@payload-config'
import type { UIFieldServerProps } from 'payload'

import { recording as findRecording, snippet } from '@/modules/catalogue'
import { allProjects } from '@/modules/projects'

import { PATHS, annotatePath, previewPath, projectPath, storiesPath } from '../paths'
import { strings } from '../strings'
import { AddChip, Chip } from '../ui/Chip'
import { storiesIn, storyStates } from '../ui/counts'
import { Icon } from '../ui/Icon'

import { SnippetCopy } from './SnippetCopy'

const s = strings.recording

export async function RecordingPanel({ id, payload }: UIFieldServerProps) {
  const origin = process.env.ANNOUDIO_ORIGIN || ''
  const found = id === undefined ? null : await findRecording({ payload, origin }, String(id))
  if (!found) {
    return (
      <section className="ao ao-card annoudio-recording">
        <p className="ao-header__help">{s.help}</p>
        <p>{s.unsaved}</p>
      </section>
    )
  }
  const projects = await allProjects({ payload })
  const counts = await Promise.all(
    projects.map((p) => stories.counts({ project: p.slug, recording: found.id })),
  )
  const widgets = projects
    .map((project, i) => ({ project, counts: counts[i] }))
    .filter(({ project, counts }) => project.recordings.includes(found.id) || storiesIn(counts) > 0)
  const add = `${PATHS.addWidget}?recording=${encodeURIComponent(found.id)}`

  return (
    <div className="ao annoudio-recording">
      <p className="ao-header__help">{s.help}</p>
      <section className="ao-card" aria-labelledby="annoudio-widgets-heading">
        <div className="ao-card__head">
          <h2 id="annoudio-widgets-heading">{s.widgets}</h2>
        </div>
        {widgets.length === 0 ? (
          <div className="ao-empty">
            <Icon name="widget" />
            <p>{s.noWidget}</p>
            <a className="ao-btn ao-btn--primary" href={add}>
              <Icon name="add" />
              {s.addToProject}
            </a>
          </div>
        ) : (
          <>
            <div className="annoudio-usedin">
              <span className="ao-label">{s.usedIn}</span>
              <div className="ao-chips">
                {widgets.map(({ project, counts: n }) => (
                  <Chip
                    key={project.slug}
                    kind="project"
                    label={project.label}
                    count={storyStates(n)}
                    href={storiesPath({ project: project.slug, recording: found.id })}
                  />
                ))}
                <AddChip label={s.addToProject} href={add} />
              </div>
            </div>
            <ul className="ao-list">
              {widgets.map(({ project }) => {
                const preview = `${origin}${previewPath(project.slug, found.id)}`
                const annotate = annotatePath(origin, project.slug, found.id, preview)
                return (
                  <li key={project.slug} className="ao-row annoudio-widget-row">
                    <a className="ao-row__title" href={projectPath(project.id)}>
                      {project.label}
                    </a>
                    <p className="ao-row__meta">
                      {s.annotateAt}{' '}
                      <code className="annoudio-address">
                        {annotatePath(origin, project.slug, found.id)}
                      </code>
                    </p>
                    <span className="ao-row__end">
                      <a className="ao-btn" href={annotate}>
                        <Icon name="story" />
                        {s.tryIt}
                      </a>
                      <a className="ao-btn ao-btn--quiet" href={previewPath(project.slug, found.id)}>
                        {s.preview}
                      </a>
                    </span>
                  </li>
                )
              })}
            </ul>
            <p className="ao-field__help">{s.tryItHint}</p>
          </>
        )}
      </section>
      {widgets.length > 0 && (
        <section className="ao-card" aria-labelledby="annoudio-snippet-heading">
          <div className="ao-card__head">
            <h2 id="annoudio-snippet-heading">{s.snippet}</h2>
            <p>{s.snippetIntro}</p>
          </div>
          <SnippetCopy
            recordingId={found.id}
            snippets={widgets.map(({ project }) => ({
              project: project.slug,
              label: project.label,
              text: snippet(origin, { project: project.slug, recording: found.id, src: found.urls[0] }),
            }))}
          />
        </section>
      )}
    </div>
  )
}
