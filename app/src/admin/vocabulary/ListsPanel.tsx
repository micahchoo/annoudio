// The lists of one project (O10l, design/vocab.md §8): the Lists tab of a project and the
// Lists page. Each row: the name, the item count, the questions that ask it, and **Open**
// (the page of the list, with its tree). **Add a list** below; SKOS files folded.

import { vocabulary } from '@payload-config'
import type { UIFieldServerProps } from 'payload'

import { byId } from '@/modules/projects'

import { PATHS } from '../paths'
import { strings } from '../strings'

import { AddList } from './AddList'
import { ListDownloads } from './ListDownloads'
import { LoadFile } from './LoadFile'

const s = strings.lists

export async function ListsPanel({ project }: { project: { slug: string; label: string } }) {
  const lists = await vocabulary.lists(project.slug)
  return (
    <section className="ao annoudio-questions" aria-labelledby="annoudio-lists-heading">
      <div className="ao-header">
        <div>
          <h2 id="annoudio-lists-heading" className="ao-header__title">
            {s.title}
          </h2>
          <p className="ao-header__help">{s.help}</p>
        </div>
      </div>
      {lists.length === 0 ? (
        <div className="ao-empty">
          <p>{s.none}</p>
        </div>
      ) : (
        <ul className="ao-list annoudio-lists">
          {lists.map((list) => (
            <li key={list.key} className="ao-row" data-list={list.label}>
              <span className="ao-row__title">{list.label}</span>
              <span className="ao-row__meta">
                <span className="ao-num">{s.items(list.size, list.kind)}</span>
                <span>{s.askedBy(list.askedBy)}</span>
              </span>
              <span className="ao-row__end">
                <a
                  className="ao-btn"
                  href={`${PATHS.concepts}/${project.slug}?list=${encodeURIComponent(list.key)}`}
                  aria-label={s.openLabel(list.label)}
                >
                  {s.open}
                </a>
              </span>
            </li>
          ))}
        </ul>
      )}
      <AddList project={project.slug} />
      <details className="ao-card ao-card--sunken">
        <summary className="ao-label">{s.otherSystems}</summary>
        <ListDownloads
          project={project.slug}
          lists={lists.map(({ key, label }) => ({ key, label }))}
        />
        <LoadFile project={project.slug} />
      </details>
    </section>
  )
}

/** The Lists tab of a project: a `ui` field of the project form. */
export async function ListsTab({ id, payload }: UIFieldServerProps) {
  const project = id === undefined ? null : await byId({ payload }, id)
  if (!project) return <p>{strings.questions.unsaved}</p>
  return <ListsPanel project={project} />
}
