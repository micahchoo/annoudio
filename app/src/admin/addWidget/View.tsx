// "Add a widget to a site" (O7, design/ia.md §4.1): /admin/add-widget, with `?recording=`
// (from a recording page: "Add to a project") or `?project=` (from a project Overview). A
// custom admin view gets no template from Payload; this one puts itself in the default
// template.

import { DefaultTemplate } from '@payloadcms/next/templates'
import { SetStepNav } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'

import { list } from '@/modules/catalogue'
import { allProjects } from '@/modules/projects'

import { operatorOf } from '../operator'
import { strings } from '../strings'

import { Wizard } from './Wizard'

const s = strings.addWidget

const one = (value: unknown) => (typeof value === 'string' ? value : undefined)

export async function AddWidget(props: AdminViewServerProps) {
  const { initPageResult, payload, user } = props
  if (!operatorOf(user)) redirect('/admin/login')
  const origin = process.env.ANNOUDIO_ORIGIN || ''
  const [recordings, projects] = await Promise.all([
    list({ payload, origin }),
    allProjects({ payload }),
  ])
  const query = props.searchParams ?? {}
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
      <SetStepNav nav={[{ label: strings.nav.addWidget }]} />
      <div className="ao annoudio-wizard gutter--left gutter--right">
        <header className="ao-header">
          <div>
            <h1 className="ao-header__title">{s.title}</h1>
            <p className="ao-header__help">{s.help}</p>
          </div>
        </header>
        <Wizard
          origin={origin}
          recordings={recordings}
          projects={projects.map(({ slug, label, siteOrigins, recordings }) => ({ slug, label, siteOrigins, recordings }))}
          recording={one(query.recording)}
          project={one(query.project)}
        />
      </div>
    </DefaultTemplate>
  )
}
