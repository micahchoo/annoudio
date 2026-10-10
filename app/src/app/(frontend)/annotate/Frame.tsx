// The frame of the member pages (design/ia.md §4.2): the project name, the title, the
// member menu (Your stories, Your account, Sign out), one way back, and the rights line in
// the footer. With a project, its theme tokens go on the root, so the page and the widget
// look like the project.

import type { CSSProperties, ReactNode } from 'react'

import type { MemberSession } from '@/modules/stories'

import { signOut } from './actions'
import { strings } from './strings'

export interface ProjectFrame {
  name: string
  /** Theme tokens without the `--annoudio-` prefix (the theme JSON, CONTRACT §3.2). */
  tokens: Record<string, string>
  rightsLine?: string
  rightsIri?: string
}

export function Frame(props: {
  title: string
  /** The line under the title: the recording. */
  subtitle?: string
  project: ProjectFrame | null
  /** The way back; `note` says why it is not the site (a `return` that is not listed). */
  back: { href: string; label: string; note?: string } | null
  session: MemberSession | null
  /** Where Sign out goes. */
  after: string
  children: ReactNode
}) {
  const { project } = props
  const style = Object.fromEntries(
    Object.entries(project?.tokens ?? {}).map(([token, value]) => [`--annoudio-${token}`, value]),
  ) as CSSProperties
  return (
    <div className="annotate" style={style}>
      <header className="top">
        <div className="top__titles">
          {project && <p className="top__project">{project.name}</p>}
          <h1>{props.title}</h1>
          {props.subtitle && <p className="instance">{props.subtitle}</p>}
        </div>
        {props.session && <MemberMenu session={props.session} after={props.after} />}
      </header>
      {props.back && (
        <p className="back">
          <a href={props.back.href}>
            <span aria-hidden="true">← </span>
            {props.back.label}
          </a>
        </p>
      )}
      {props.back?.note && <p className="back__note">{props.back.note}</p>}
      <main>{props.children}</main>
      {project?.rightsLine && (
        <footer className="rights">
          {project.rightsIri ? (
            <a href={project.rightsIri} rel="license">
              {project.rightsLine}
            </a>
          ) : (
            project.rightsLine
          )}
        </footer>
      )}
    </div>
  )
}

/** "Asha ▾": Your stories, Your account, Sign out. A native disclosure: no script needed. */
function MemberMenu({ session, after }: { session: MemberSession; after: string }) {
  const s = strings.menu
  return (
    <details className="member-menu">
      <summary aria-label={s.label(session.nickname)}>
        {session.nickname} <span aria-hidden="true">▾</span>
      </summary>
      <ul>
        <li>
          <a href="/annotate/mine">{s.stories}</a>
        </li>
        <li>
          <a href="/annotate/account">{s.account}</a>
        </li>
        <li>
          <form action={signOut}>
            <input type="hidden" name="after" value={after} />
            <button type="submit">{s.signOut}</button>
          </form>
        </li>
      </ul>
    </details>
  )
}
