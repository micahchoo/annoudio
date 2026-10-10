// The Theme tab (O16.5): what the theme is, a choice of a tested colour set, and the real
// widget of this stack beside the fields, with this project and one of its recordings. Its
// links are live (workflow-audit 1–3): "Tell a story" opens the Annotate page and comes
// back to the preview page of the widget.

import type { UIFieldServerProps } from 'payload'

import { firstRecording, recording as findRecording } from '@/modules/catalogue'
import { DARK_SET, THEME_TOKENS, allProjects } from '@/modules/projects'

import { annotatePath, previewPath } from '../paths'
import { strings } from '../strings'
import { Icon } from '../ui/Icon'

import { ThemePresets } from './ThemePresets'
import { ThemeWidget } from './ThemeWidget'

const s = strings.theme

export async function ThemePreview({ id, payload }: UIFieldServerProps) {
  const origin = process.env.ANNOUDIO_ORIGIN || ''
  const project =
    id === undefined
      ? null
      : (await allProjects({ payload })).find((p) => String(p.id) === String(id))
  // A recording with a widget in this project, else the first of the catalogue.
  const recording = !project
    ? null
    : ((project.recordings[0] &&
        (await findRecording({ payload, origin }, project.recordings[0]))) ||
      (await firstRecording({ payload, origin })))
  const back = project && recording ? `${origin}${previewPath(project.slug, recording.id)}` : ''
  return (
    <section className="ao annoudio-theme-panel" aria-labelledby="annoudio-theme-heading">
      <div className="ao-card">
        <div className="ao-card__head">
          <h2 id="annoudio-theme-heading">{s.heading}</h2>
          <p>{s.intro}</p>
        </div>
        {!project ? (
          <p>{s.unsaved}</p>
        ) : !recording ? (
          <p>{s.noRecording}</p>
        ) : (
          <>
            <ThemeWidget
              origin={origin}
              project={project.slug}
              recording={recording.id}
              src={recording.urls[0]}
              back={back}
              tokens={THEME_TOKENS.map(({ token, field }) => ({ token, field }))}
            />
            <p className="ao-actions">
              <a className="ao-btn" href={annotatePath(origin, project.slug, recording.id, back)}>
                <Icon name="story" />
                {strings.recording.tryIt}
              </a>
              <a className="ao-btn ao-btn--quiet" href={previewPath(project.slug, recording.id)}>
                {strings.recording.preview}
              </a>
            </p>
          </>
        )}
        {project && (
          <ThemePresets
            fields={THEME_TOKENS.filter((t) => t.kind === 'color').map((t) => t.field)}
            dark={{ ...DARK_SET }}
          />
        )}
      </div>
    </section>
  )
}
