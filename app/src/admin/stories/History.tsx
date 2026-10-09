// History (O6, design/ia.md §5.1): the versions of a story in plain lines, in place of
// Payload's versions view. "Published by Ravi", "Returned automatically: a file failed".

import { stories } from '@payload-config'
import type { DocumentViewServerProps } from 'payload'

import type { HistoryLine } from '@/modules/stories'

import { LocalDate } from '../LocalDate'
import { operatorOf } from '../operator'
import { strings } from '../strings'

const s = strings.history

/** The words of one line. The oldest `saved` line is the first send. */
export function lineText(line: HistoryLine, first: boolean): string {
  switch (line.action) {
    case 'saved':
      return first ? s.sent(line.nickname) : s.changed(line.nickname)
    case 'published':
      return line.by === 'system'
        ? s.publishedBySystem
        : s.published(line.by === 'member' ? line.nickname : line.by)
    case 'returned':
      return s.returned(line.by, line.reason ?? '')
    case 'returned-automatically':
      return s.automatic
  }
}

export async function History({ initPageResult, user }: DocumentViewServerProps) {
  const operator = operatorOf(user)
  const id = initPageResult.docID
  const lines = operator && id !== undefined ? await stories.history(operator, String(id)) : []
  return (
    <div className="annoudio-history gutter--left gutter--right">
      <h2>{s.heading}</h2>
      <p className="annoudio-history__intro">{s.intro}</p>
      <ol className="annoudio-history__lines" reversed>
        {lines.map((line, i) => (
          <li key={`${line.at}-${i}`} data-action={line.action}>
            <span>{lineText(line, i === lines.length - 1)}</span>
            <LocalDate iso={line.at} />
          </li>
        ))}
      </ol>
    </div>
  )
}
