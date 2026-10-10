// The answers of the questions as form entries, both ways. `FieldControls` names its
// controls with these entry names; the page fills them, the save action reads them.

import type { ValueInput } from '@/modules/vocabulary'

const KINDS = ['item', 'own', 'text', 'year', 'month', 'day', 'href', 'linkLabel'] as const
type Kind = (typeof KINDS)[number]

/** The form entries that show these answers. */
export function answersOf(inputs: ValueInput[]): [string, string][] {
  return inputs.flatMap((input): [string, string][] => {
    const p = input.property
    if ('item' in input) return [[`item:${p}`, input.item]]
    if ('text' in input)
      return [
        [`text:${p}`, input.text],
        [`own:${p}`, input.text],
      ]
    if ('date' in input) {
      const { year, month, day } = input.date
      return [
        [`year:${p}`, String(year)],
        ...(month ? [[`month:${p}`, String(month)] as [string, string]] : []),
        ...(day ? [[`day:${p}`, String(day)] as [string, string]] : []),
      ]
    }
    return [
      [`href:${p}`, input.link.href],
      ...(input.link.label ? [[`linkLabel:${p}`, input.link.label] as [string, string]] : []),
    ]
  })
}

/** The question entries of a sent form, as they came. */
export function answerEntries(form: FormData): [string, string][] {
  return [...form.entries()].flatMap(([name, value]) =>
    typeof value === 'string' && KINDS.some((kind) => name.startsWith(`${kind}:`))
      ? [[name, value] as [string, string]]
      : [],
  )
}

/**
 * The answers of the form entries, for `stories.saveDraft`. Empty controls give nothing.
 * The form has one control per question; `vocabulary.resolve` checks the rest.
 */
export function inputsFrom(entries: [string, string][]): ValueInput[] {
  const by = new Map<string, Partial<Record<Kind, string[]>>>()
  const order: string[] = []
  for (const [name, value] of entries) {
    const at = name.indexOf(':')
    const kind = name.slice(0, at) as Kind
    const property = name.slice(at + 1)
    if (!by.has(property)) {
      by.set(property, {})
      order.push(property)
    }
    const fields = by.get(property)!
    fields[kind] = [...(fields[kind] ?? []), value]
  }
  return order.flatMap((property): ValueInput[] => {
    const f = by.get(property)!
    const first = (kind: Kind) => f[kind]?.[0]?.trim() ?? ''
    const out: ValueInput[] = (f.item ?? []).filter(Boolean).map((item) => ({ property, item }))
    for (const own of f.own ?? []) if (own.trim()) out.push({ property, text: own.trim() })
    if (first('text')) out.push({ property, text: first('text') })
    if (first('year') || first('month') || first('day')) {
      const number = (kind: Kind) => (first(kind) ? Number(first(kind)) : undefined)
      out.push({
        property,
        date: {
          year: first('year') ? Number(first('year')) : NaN,
          ...(number('month') !== undefined ? { month: number('month') } : {}),
          ...(number('day') !== undefined ? { day: number('day') } : {}),
        },
      })
    }
    if (first('href')) {
      out.push({
        property,
        link: { href: first('href'), ...(first('linkLabel') ? { label: first('linkLabel') } : {}) },
      })
    }
    return out
  })
}
