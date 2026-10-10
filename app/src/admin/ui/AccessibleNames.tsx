'use client'

// Names for the few Payload controls that have none (axe `button-name`, `label`, WCAG 4.1.2):
// the document menu (⋮), the copy menu of an array field, and the row checkboxes of a list. Payload 3.90 renders them as an
// icon in a <button> with no text and no label. A provider of the admin, so it runs on
// every screen; it names a button only when the button has no name of its own.

import { useEffect, type ReactNode } from 'react'

import { strings } from '../strings'

const NAMES: [string, string][] = [
  ['.doc-controls__popup .popup-button', strings.payload.documentMenu],
  ['.clipboard-action__popup .popup-button', strings.payload.copyMenu],
  ['.collection-list__sub-header .popup-button', strings.payload.listMenu],
  ['#select-all', strings.payload.selectAll],
  ['.cell-_select input[type="checkbox"]', strings.payload.selectRow],
]

function nameAll() {
  for (const [selector, name] of NAMES) {
    for (const button of document.querySelectorAll<
      HTMLElement & { labels?: NodeListOf<HTMLLabelElement> }
    >(selector)) {
      if (
        !button.getAttribute('aria-label') &&
        !button.textContent?.trim() &&
        !button.labels?.length
      ) {
        button.setAttribute('aria-label', name)
      }
    }
  }
}

export function AccessibleNames({ children }: { children?: ReactNode }) {
  useEffect(() => {
    nameAll()
    const observer = new MutationObserver(nameAll)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
  return <>{children}</>
}
