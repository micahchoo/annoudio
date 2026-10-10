// Vocabulary (the sidebar job): /admin/vocabulary and /admin/vocabulary/{project}. The
// questions of one project; a project picker when there is more than one. A custom admin
// view: it puts itself in the default template.

import { DefaultTemplate } from '@payloadcms/next/templates'
import { SetStepNav } from '@payloadcms/ui'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'

import { allProjects } from '@/modules/projects'

import { operatorOf } from '../operator'
import { PATHS } from '../paths'
import { strings } from '../strings'

import { FieldList } from './FieldList'

const s = strings.questions

export async function VocabularyView(props: AdminViewServerProps) {
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
      <div className="ao annoudio-concepts gutter--left gutter--right">
        <header className="ao-header">
          <div>
            <h1 className="ao-header__title">{s.title}</h1>
          </div>
        </header>
        {!project ? (
          <p className="ao-empty">{s.noProject}</p>
        ) : (
          <>
            {projects.length > 1 && (
              <nav aria-label={s.project} className="ao-tabs annoudio-project-tabs">
                {projects.map((p) => (
                  <Link
                    key={p.slug}
                    href={`${PATHS.vocabulary}/${p.slug}`}
                    aria-current={p.slug === project.slug ? 'page' : undefined}
                  >
                    {p.label}
                  </Link>
                ))}
              </nav>
            )}
            <p>
              <Link href={`${PATHS.concepts}/${project.slug}`}>{strings.lists.title}</Link>
            </p>
            <FieldList payload={payload} project={project} />
          </>
        )}
      </div>
    </DefaultTemplate>
  )
}
