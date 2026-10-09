// The snippet of a recording, one for each project (walkthrough 35, 36). The text is the
// two lines of CONTRACT.md §1, from `catalogue.snippet`.

import type { UIFieldServerProps } from 'payload'

import { recording as findRecording, snippet } from '@/modules/catalogue'
import { allProjects } from '@/modules/projects'

import { strings } from '../strings'

import { SnippetCopy } from './SnippetCopy'

const s = strings.recording

export async function SnippetPanel({ id, payload }: UIFieldServerProps) {
  const origin = process.env.ANNOUDIO_ORIGIN || ''
  const found = id === undefined ? null : await findRecording({ payload, origin }, String(id))
  const body = !found ? (
    <p>{s.unsaved}</p>
  ) : (
    <Snippets payload={payload} origin={origin} recording={found.id} src={found.urls[0]} />
  )
  return (
    <section className="annoudio-panel" aria-labelledby="annoudio-snippet-heading">
      <h2 id="annoudio-snippet-heading" className="annoudio-panel__heading">
        {s.snippet}
      </h2>
      {body}
    </section>
  )
}

async function Snippets(props: {
  payload: UIFieldServerProps['payload']
  origin: string
  recording: string
  src: string
}) {
  const projects = await allProjects({ payload: props.payload })
  if (projects.length === 0) return <p>{s.noProject}</p>
  return (
    <>
      <p>{s.snippetIntro}</p>
      <SnippetCopy
        recordingId={props.recording}
        snippets={projects.map((project) => ({
          project: project.slug,
          label: project.label,
          text: snippet(props.origin, {
            project: project.slug,
            recording: props.recording,
            src: props.src,
          }),
        }))}
      />
    </>
  )
}
