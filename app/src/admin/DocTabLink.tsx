'use client'

// One tab of a document (Story · History, Overview · Settings). Payload's own tab is a
// link straight inside the tab list (`<ul>`), which axe refuses (`list`). This one is an
// `<li>` with a link, and the current tab has `aria-current`.

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function DocTabLink({ label, path }: { label: string; path: string }) {
  const pathname = usePathname()
  // /admin/collections/{slug}/{id}[/{view}]
  const doc = pathname.split('/').slice(0, 5).join('/')
  const href = `${doc}${path}`
  const current = pathname === href
  return (
    <li className="annoudio-doc-tab">
      <Link
        href={href}
        prefetch={false}
        aria-current={current ? 'page' : undefined}
        className={`btn btn--style-tab btn--size-medium doc-tab${current ? ' doc-tab--active' : ''}`}
      >
        <span className="doc-tab__label">{label}</span>
      </Link>
    </li>
  )
}
