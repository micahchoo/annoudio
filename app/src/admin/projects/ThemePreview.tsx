// The live preview of the theme (walkthrough 27): the real player of this stack, with this
// project and the first recording of the catalogue. The values of the form go on the element
// as `--annoudio-*` properties, which win over the saved theme (CONTRACT.md §3.1, rule 3).

import type { UIFieldServerProps } from 'payload'

import { firstRecording } from '@/modules/catalogue'
import { THEME_TOKENS, byId } from '@/modules/projects'

import { strings } from '../strings'

import { ThemePlayer } from './ThemePlayer'

const s = strings.theme

export async function ThemePreview({ id, payload }: UIFieldServerProps) {
  const origin = process.env.ANNOUDIO_ORIGIN || ''
  const project = id === undefined ? null : await byId({ payload }, id)
  const recording = project ? await firstRecording({ payload, origin }) : null
  return (
    <section className="annoudio-panel" aria-labelledby="annoudio-theme-heading">
      <h2 id="annoudio-theme-heading" className="annoudio-panel__heading">
        {s.heading}
      </h2>
      {!project ? (
        <p>{s.unsaved}</p>
      ) : !recording ? (
        <p>{s.noRecording}</p>
      ) : (
        <>
          <p>{s.intro}</p>
          <ThemePlayer
            origin={origin}
            project={project.slug}
            recording={recording.id}
            src={recording.urls[0]}
            tokens={THEME_TOKENS.map(({ token, field }) => ({ token, field }))}
          />
        </>
      )}
    </section>
  )
}
