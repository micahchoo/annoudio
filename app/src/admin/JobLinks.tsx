'use client'

// Links in the Payload sidebar, with the markup of Payload's own nav links, so they look
// the same. The current page has `aria-current`.

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { Icon, type IconName } from './ui/Icon'

export interface JobLink {
  href: string
  label: string
  /** The icon of the job (design/design-system.md §8). */
  icon?: IconName
  /** A count after the label, with its words for a screen reader. */
  badge?: { count: number; label: string }
}

export function JobLinks({ links }: { links: JobLink[] }) {
  const pathname = usePathname()
  return (
    <div className="annoudio-nav">
      {links.map((link) => {
        const current =
          link.href === '/admin'
            ? pathname === '/admin'
            : pathname === link.href || pathname.startsWith(`${link.href}/`)
        return (
          <Link
            key={link.href}
            href={link.href}
            prefetch={false}
            className="nav__link annoudio-nav__link"
            aria-current={current ? 'page' : undefined}
          >
            {current && <div className="nav__link-indicator" />}
            {link.icon && <Icon name={link.icon} className="annoudio-nav__icon" />}
            <span className="nav__link-label">{link.label}</span>
            {link.badge && link.badge.count > 0 && (
              <span className="annoudio-nav__badge">
                <span aria-hidden="true">{link.badge.count}</span>
                <span className="visually-hidden">({link.badge.label})</span>
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
