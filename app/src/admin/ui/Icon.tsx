// The one icon set of the admin and the member pages (design/design-system.md §8): a 24×24
// grid, `currentColor`, no fill. An icon always goes with a word, or with a name on its
// button; a decorative icon is hidden from screen readers.

const PATHS = {
  'story': "<path d='M4 5h16v11H9l-5 4z'/><path d='M8 9h8M8 12h5'/>",
  'reply': "<path d='M9 7 4 12l5 5'/><path d='M4 12h10a6 6 0 0 1 6 6'/>",
  'recording': "<path d='M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10M21 12h0'/>",
  'project': "<path d='M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'/>",
  'site': "<circle cx='12' cy='12' r='9'/><path d='M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18'/>",
  'concept': "<path d='M3 12V4h8l10 10-8 8z'/><circle cx='7.5' cy='8.5' r='1.5'/>",
  'member': "<circle cx='12' cy='8' r='4'/><path d='M4 21a8 8 0 0 1 16 0'/>",
  'processing': "<circle cx='12' cy='12' r='9'/><path d='M12 7v5l3 2'/>",
  'waiting': "<path d='M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9'/>",
  'returned': "<path d='M9 14 4 9l5-5'/><path d='M4 9h11a5 5 0 0 1 0 10h-3'/>",
  'published': "<circle cx='12' cy='12' r='9'/><path d='m8 12 3 3 5-6'/>",
  'copy': "<rect x='8' y='8' width='12' height='12' rx='2'/><path d='M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2'/>",
  'open': "<path d='M14 4h6v6M20 4l-9 9'/><path d='M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4'/>",
  'chevron': "<path d='m6 9 6 6 6-6'/>",
  'go': "<path d='m9 6 6 6-6 6'/>",
  'play': "<path d='M8 5v14l11-7z'/>",
  'close': "<path d='M6 6l12 12M18 6 6 18'/>",
  'alert': "<circle cx='12' cy='12' r='9'/><path d='M12 7v6M12 16.5v.5'/>",
  'add': "<path d='M12 5v14M5 12h14'/>",
  'remove': "<path d='M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3'/>",
  'code': "<circle cx='8' cy='15' r='4'/><path d='m11 12 9-9M17 6l3 3M15 8l2 2'/>",
  'theme': "<path d='M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.5 0-1.5-1-1.5-1-3 0-1 .7-1.5 1.5-1.5H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8z'/><circle cx='7.5' cy='11' r='1'/><circle cx='10' cy='7' r='1'/><circle cx='15' cy='7' r='1'/>",
  // Added for the sidebar jobs (not in the style guide).
  'today': "<rect x='3' y='5' width='18' height='16' rx='2'/><path d='M3 10h18M8 3v4M16 3v4'/>",
  'widget': "<rect x='3' y='5' width='18' height='14' rx='2'/><path d='M7 12h1M10 9v6M13 10v4M16 11v2'/>",
  'questions': "<path d='M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01'/>",
} as const

export type IconName = keyof typeof PATHS

export function Icon(props: { name: IconName; label?: string; className?: string }) {
  const { name, label } = props
  return (
    <svg
      className={props.className ? `ao-icon ${props.className}` : 'ao-icon'}
      viewBox="0 0 24 24"
      focusable="false"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      dangerouslySetInnerHTML={{ __html: PATHS[name] }}
    />
  )
}
