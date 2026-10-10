'use client'

// The real widget of this stack inside an admin page, with live links (workflow-audit 1–3).
// The widget's Annotate and Reply links name the page that shows them as `return`
// (CONTRACT.md §7.1); an admin page is not a site of the project. So a click on one of the
// links goes to the same Annotate address with `return` set to the operator preview page
// of the widget (admin/preview), which the Annotate page always accepts. The link is a
// normal `<a href>` to `/annotate?…` (CONTRACT §7.1): that is all this reads.

import type { CSSProperties } from 'react'
import { useEffect, useRef } from 'react'

import type { WidgetElement } from '@/widget-element'

export function PreviewWidget(props: {
  origin: string
  project: string
  recording: string
  src: string
  /** The absolute address of the preview page: the `return` of the links. */
  back: string
  style?: CSSProperties
}) {
  const host = useRef<WidgetElement>(null)
  const { back } = props
  useEffect(() => {
    const element = host.current
    if (!element) return
    const follow = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return
      const link = event.composedPath()[0]
      const anchor = link instanceof Element ? link.closest('a') : null
      if (!anchor || !URL.canParse(anchor.href)) return
      const url = new URL(anchor.href)
      if (url.pathname !== '/annotate') return
      url.searchParams.set('return', back)
      event.preventDefault()
      window.location.assign(url.href)
    }
    element.addEventListener('click', follow)
    return () => element.removeEventListener('click', follow)
  }, [back])
  return (
    <>
      <script async src={`${props.origin}/embed/v1.js`} />
      <annoudio-player
        ref={host}
        project={props.project}
        recording={props.recording}
        src={props.src}
        origin={props.origin}
        annotate="link"
        style={props.style}
      />
    </>
  )
}
