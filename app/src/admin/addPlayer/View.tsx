// "Put a recording on a site" (O7, design/ia.md §4.1): /admin/add-player. A custom admin
// view gets no template from Payload; this one puts itself in the default template.

import { DefaultTemplate } from '@payloadcms/next/templates'
import { SetStepNav } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'

import { list } from '@/modules/catalogue'
import { allProjects } from '@/modules/projects'

import { operatorOf } from '../operator'
import { strings } from '../strings'

import { Wizard } from './Wizard'

const s = strings.addPlayer

export async function AddPlayer(props: AdminViewServerProps) {
  const { initPageResult, payload, user } = props
  if (!operatorOf(user)) redirect('/admin/login')
  const origin = process.env.ANNOUDIO_ORIGIN || ''
  const [recordings, projects] = await Promise.all([
    list({ payload, origin }),
    allProjects({ payload }),
  ])
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
      <SetStepNav nav={[{ label: strings.nav.addPlayer }]} />
      <div className="annoudio-wizard gutter--left gutter--right">
        <h1>{s.title}</h1>
        <Wizard
          origin={origin}
          recordings={recordings}
          projects={projects.map(({ slug, label, siteOrigins }) => ({ slug, label, siteOrigins }))}
        />
      </div>
    </DefaultTemplate>
  )
}
