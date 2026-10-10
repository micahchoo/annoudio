// The operator preview of one widget (workflow-audit fixes 1–3): /admin/preview/{project}/
// {recording}. A plain admin page with the real widget of this stack and its live links,
// the snippet, and "Open the Annotate page". The Annotate page always sends a member back
// to this page (`projects.returnTarget` with `self`), so an operator can walk the whole
// member flow with no host site. A custom admin view: it puts itself in the template.

import { stories } from '@payload-config'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { SetStepNav } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'

import { recording as findRecording, snippet } from '@/modules/catalogue'
import { allProjects } from '@/modules/projects'

import { SnippetCopy } from '../catalogue/SnippetCopy'
import { operatorOf } from '../operator'
import {
  PATHS,
  annotatePath,
  previewPath,
  projectPath,
  recordingPath,
  storiesPath,
} from '../paths'
import { strings } from '../strings'
import { Chip } from '../ui/Chip'
import { storyStates } from '../ui/counts'
import { Icon } from '../ui/Icon'
import { PreviewWidget } from '../ui/PreviewWidget'

const s = strings.preview

export async function PreviewView(props: AdminViewServerProps) {
  const { initPageResult, payload, user } = props
  if (!operatorOf(user)) redirect('/admin/login')
  const origin = process.env.ANNOUDIO_ORIGIN || ''
  const segments = Array.isArray(props.params?.segments) ? props.params.segments : []
  const [, slug = '', id = ''] = segments.map((part) => decodeURIComponent(String(part)))
  const [project, found] = await Promise.all([
    allProjects({ payload }).then((all) => all.find((p) => p.slug === slug) ?? null),
    findRecording({ payload, origin }, id),
  ])
  const counts = project && found ? await stories.counts({ project: slug, recording: id }) : null
  const back = `${origin}${previewPath(slug, id)}`

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
      <SetStepNav
        nav={[
          { label: strings.nav.recordings, url: PATHS.recordings },
          ...(found ? [{ label: found.title, url: recordingPath(found.id) }] : []),
          { label: s.crumb },
        ]}
      />
      <div className="ao annoudio-preview-page gutter--left gutter--right">
        {!project || !found ? (
          <div className="ao-empty">
            <Icon name="alert" />
            <p>{s.notFound}</p>
          </div>
        ) : (
          <>
            <header className="ao-header">
              <div>
                <h1 className="ao-header__title">{s.title(found.title, project.label)}</h1>
                <p className="ao-header__help">{s.help}</p>
              </div>
              <div className="ao-header__actions">
                <a
                  className="ao-btn ao-btn--primary"
                  href={annotatePath(origin, project.slug, found.id, back)}
                >
                  <Icon name="story" />
                  {s.open}
                </a>
              </div>
            </header>
            <div className="ao-chips annoudio-preview-page__links">
              <Chip kind="recording" label={found.title} href={recordingPath(found.id)} />
              <Chip kind="project" label={project.label} href={projectPath(project.id)} />
              <Chip
                kind="story"
                label={s.review}
                count={counts ? storyStates(counts) : undefined}
                href={storiesPath({ project: project.slug, recording: found.id })}
              />
            </div>
            <section className="ao-card annoudio-preview-page__widget" aria-label={s.widget}>
              <PreviewWidget
                origin={origin}
                project={project.slug}
                recording={found.id}
                src={found.urls[0]}
                back={back}
              />
            </section>
            {project.siteOrigins.length === 0 && (
              <p className="ao-field__help">{s.noWebsite}</p>
            )}
            <section className="ao-card" aria-labelledby="annoudio-preview-snippet">
              <div className="ao-card__head">
                <h2 id="annoudio-preview-snippet">{strings.recording.snippet}</h2>
                <p>{strings.recording.snippetIntro}</p>
              </div>
              <SnippetCopy
                recordingId={found.id}
                snippets={[
                  {
                    project: project.slug,
                    label: project.label,
                    text: snippet(origin, {
                      project: project.slug,
                      recording: found.id,
                      src: found.urls[0],
                    }),
                  },
                ]}
              />
            </section>
          </>
        )}
      </div>
    </DefaultTemplate>
  )
}
