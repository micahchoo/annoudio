// The questions of one project (O10v, design/vocab.md §8): the Vocabulary tab of a project
// and the Vocabulary page. A server component: it reads the `vocabulary` interface and gives
// the data to the client editor (AddQuestion.tsx).

import { vocabulary } from '@payload-config'
import type { Payload, UIFieldServerProps } from 'payload'

import { firstRecording } from '@/modules/catalogue'
import { byId } from '@/modules/projects'
import { CATALOGUE } from '@/modules/vocabulary'

import { strings } from '../strings'

import { QuestionsEditor, type EditorData } from './AddQuestion'
import { OtherSystems } from './OtherSystems'

const s = strings.questions

export async function FieldList(props: {
  payload: Payload
  project: { slug: string; label: string }
}) {
  const { payload, project } = props
  const [profile, lists, ontologies, recording] = await Promise.all([
    vocabulary.profile(project.slug),
    vocabulary.lists(project.slug),
    vocabulary.ontologies(),
    firstRecording({ payload, origin: process.env.ANNOUDIO_ORIGIN || '' }),
  ])
  const fields = profile?.fields ?? []
  const asked = new Set(fields.map((field) => field.property))
  const data: EditorData = {
    project: project.slug,
    fields,
    lists: lists.map(({ key, label, kind, size }) => ({ key, label, kind, size })),
    catalogue: CATALOGUE.map((entry) => ({
      key: entry.key,
      label: entry.label,
      asked: asked.has(entry.property),
    })),
    ontologies: ontologies.map(({ label, prefix, namespace }) => ({ label, prefix, namespace })),
    // The Annotate page of the first recording: the questions as a member sees them.
    phone: recording
      ? `/annotate?${new URLSearchParams({ project: project.slug, recording: recording.id, t: '0' })}`
      : null,
  }
  return (
    <section className="ao annoudio-questions" aria-labelledby="annoudio-questions-heading">
      <div className="ao-header">
        <div>
          <h2 id="annoudio-questions-heading" className="ao-header__title">
            {s.heading(project.label)}
          </h2>
          <p className="ao-header__help">{s.help}</p>
        </div>
      </div>
      <QuestionsEditor data={data} />
      <OtherSystems project={project.slug} />
    </section>
  )
}

/** The Vocabulary tab of a project: a `ui` field of the project form. */
export async function VocabularyTab({ id, payload }: UIFieldServerProps) {
  const project = id === undefined ? null : await byId({ payload }, id)
  if (!project) return <p>{s.unsaved}</p>
  return <FieldList payload={payload} project={project} />
}
