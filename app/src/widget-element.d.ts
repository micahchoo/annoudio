// The `<annoudio-player>` element (the widget) in JSX, for the admin and the Annotate page.
// Its interface is CONTRACT.md §2 (attributes) and §4 (the method `seek`, the property
// `currentTime`).

import 'react'

/** The part of the element interface that the app uses (CONTRACT.md §4). */
export type WidgetElement = HTMLElement & {
  currentTime?: number
  seek?: (seconds: number) => void
}

declare module 'react' {
  // React declares its JSX types in a namespace. An augmentation must use the same form.
  namespace JSX {
    interface IntrinsicElements {
      'annoudio-player': React.DetailedHTMLProps<
        React.HTMLAttributes<WidgetElement>,
        WidgetElement
      > & {
        project: string
        recording: string
        src: string
        origin: string
        annotate?: 'link' | 'none'
        /** The time range of a story being written, `start,end` (CONTRACT.md §2.1). */
        range?: string
      }
    }
  }
}
