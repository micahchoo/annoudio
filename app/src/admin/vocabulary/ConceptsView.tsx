// Concepts (O10): /admin/concepts and /admin/concepts/{project}. The concept tree of one
// project; a project picker when there is more than one. A custom admin view: it puts
// itself in the default template.

import { DefaultTemplate } from '@payloadcms/next/templates'
import { SetStepNav } from '@payloadcms/ui'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'

import { allProjects } from '@/modules/projects'

import { operatorOf } from '../operator'
import { PATHS } from '../paths'
import { strings } from '../strings'

import { ConceptTree } from './ConceptTree'

const s = strings.concepts

export async function ConceptsView(props: AdminViewServerProps) {
  const { initPageResult, payload, user } = props
  if (!operatorOf(user)) redirect('/admin/login')
  const projects = await allProjects({ payload })
  const segments = props.params?.segments
  const asked = Array.isArray(segments) ? segments[1] : undefined
  const project = projects.find((p) => p.slug === asked) ?? projects[0]
  return (
    <DefaultTemplate
      i18n={props.i18n}
      locale={initPageResult.locale}
      params={props.params}
      payload={payload}
      permissions={initPageResult.permissions}
      searchParams={props.searchParams}
      user={user ?? undefined}
      visibleEntities={initPageResult.visibleEntities}
    >
      <SetStepNav nav={[{ label: s.title }]} />
      <div className="annoudio-concepts gutter--left gutter--right">
        <h1>{s.title}</h1>
        <p>{s.intro}</p>
        {!project ? (
          <p className="annoudio-empty">{s.noProject}</p>
        ) : (
          <>
            {projects.length > 1 && (
              <nav aria-label={s.project} className="annoudio-tabs">
                {projects.map((p) => (
                  <Link
                    key={p.slug}
                    href={`${PATHS.concepts}/${p.slug}`}
                    aria-current={p.slug === project.slug ? 'page' : undefined}
                    className="annoudio-tabs__tab"
                  >
                    {p.label}
                  </Link>
                ))}
              </nav>
            )}
            <h2>{project.label}</h2>
            <ConceptTree payload={payload} project={project} />
          </>
        )}
      </div>
    </DefaultTemplate>
  )
}
