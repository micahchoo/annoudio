// Turn the answers of a member into statements (design/vocab.md §3.1, §9.2). One call
// checks the fields, the lists, hidden fields and items, own answers, the three date
// datatypes, links, numbers and the limits. `inputsOf` goes back, to refill the form.

import type { PayloadRequest } from 'payload'

import type { Iri } from './catalogue'
import { itemsOf, profile, SKOS_CONCEPT, type Store } from './profile'
import { NS } from './terms'
import type {
  Field,
  ResolveResult,
  ResolvedValue,
  ValueErrorCode,
  ValueInput,
  ProjectSlug,
} from './types'

const XSD = NS.xsd
const DECIMAL = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/

export async function resolve(
  store: Store,
  slug: ProjectSlug,
  input: ValueInput[],
  options: { keep?: ResolvedValue[]; req?: PayloadRequest } = {},
): Promise<ResolveResult> {
  const found = await profile(store, slug, { req: options.req })
  if (!found) return { ok: false, errors: [] }
  const fields = new Map(found.fields.map((field) => [field.property, field]))
  const errors: { property: Iri; code: ValueErrorCode }[] = []
  const fail = (property: Iri, code: ValueErrorCode) => {
    if (!errors.some((e) => e.property === property && e.code === code))
      errors.push({ property, code })
  }
  // Stored values of hidden fields carry over (§7.1 rule 6). So do stored items that are
  // hidden now: a story that has one keeps it.
  const keep = options.keep ?? []
  const kept = keep.filter((value) => fields.get(value.property)?.hidden === true)
  const keptItems = new Set(
    keep.flatMap((value) => ('iri' in value.object ? [value.object.iri] : [])),
  )

  const itemIris = input.flatMap((one) => ('item' in one ? [one.item] : []))
  const items = await itemsOf(store, slug, itemIris, options.req)
  const byField = new Map<Iri, ResolvedValue[]>()
  for (const one of input) {
    const field = fields.get(one.property)
    if (!field) {
      fail(one.property, 'unknown-field')
      continue
    }
    if (field.hidden) {
      fail(field.property, 'hidden-field')
      continue
    }
    const value = resolveOne(field, one, found.language, items, keptItems)
    if (typeof value === 'string') fail(field.property, value)
    else if (value) byField.set(field.property, [...(byField.get(field.property) ?? []), value])
  }

  const values: ResolvedValue[] = []
  for (const field of found.fields) {
    const given = field.hidden
      ? kept.filter((v) => v.property === field.property)
      : (byField.get(field.property) ?? [])
    const refused = errors.some((e) => e.property === field.property)
    if (!field.hidden && field.required && given.length === 0 && !refused) {
      fail(field.property, 'required')
    }
    // The same item twice is one answer.
    const unique = given.filter(
      (v, i) => given.findIndex((w) => JSON.stringify(w.object) === JSON.stringify(v.object)) === i,
    )
    if (!field.hidden && unique.length > field.max) fail(field.property, 'too-many')
    values.push(...unique)
  }
  if (values.length > store.limits.valuesPerStory) {
    fail(found.fields[found.fields.length - 1]?.property ?? '', 'too-many')
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, values }
}

function resolveOne(
  field: Field,
  input: ValueInput,
  language: string,
  items: Awaited<ReturnType<typeof itemsOf>>,
  keptItems: Set<Iri>,
): ResolvedValue | ValueErrorCode | null {
  const base = { property: field.property }
  switch (field.valueType) {
    case 'text': {
      if (!('text' in input)) return 'unknown-field'
      const text = input.text.trim()
      if (!text) return null
      if ([...text].length > 500) return 'too-long'
      return { ...base, purpose: 'describing', text, language, object: { literal: text, language } }
    }
    case 'number': {
      if (!('text' in input)) return 'bad-number'
      const text = input.text.trim()
      if (!text) return null
      if (!DECIMAL.test(text)) return 'bad-number'
      return {
        ...base,
        purpose: 'describing',
        text,
        object: { literal: text, datatype: `${XSD}decimal` },
      }
    }
    case 'date': {
      if (!('date' in input)) return 'bad-date'
      const literal = dateLiteral(input.date)
      if (!literal) return 'bad-date'
      return {
        ...base,
        purpose: 'describing',
        text: literal.value,
        object: { literal: literal.value, datatype: literal.datatype },
      }
    }
    case 'link': {
      if (!('link' in input)) return 'bad-link'
      const href = input.link.href.trim()
      if (!href) return null
      if (!isHttps(href)) return 'bad-link'
      const label = input.link.label?.trim()
      if (label && [...label].length > 500) return 'too-long'
      return { ...base, purpose: 'describing', text: label || href, object: { iri: href } }
    }
    case 'list':
    case 'entity': {
      const purpose = field.valueType === 'list' ? 'tagging' : 'describing'
      if ('item' in input) {
        const item = items.get(input.item)
        if (!item || item.listKey !== field.list?.key) return 'unknown-item'
        if (item.hidden && !keptItems.has(item.iri)) return 'hidden-item'
        return {
          ...base,
          purpose,
          text: item.label,
          ...(item.language ? { language: item.language } : {}),
          object: { iri: item.iri },
        }
      }
      if (!('text' in input)) return 'unknown-item'
      const label = input.text.trim()
      if (!label) return null
      if (!field.allowOwn) return 'own-not-allowed'
      if ([...label].length > 500) return 'too-long'
      return {
        ...base,
        purpose,
        text: label,
        language,
        object: { own: { label, language, class: field.list?.class ?? SKOS_CONCEPT } },
      }
    }
  }
}

function isHttps(href: string): boolean {
  try {
    const url = new URL(href)
    return url.protocol === 'https:' && url.hostname.length > 0
  } catch {
    return false
  }
}

/** `xsd:gYear`, `xsd:gYearMonth` or `xsd:date`, or null when the date does not exist. */
function dateLiteral(date: { year: number; month?: number; day?: number }) {
  const { year, month, day } = date
  if (!Number.isInteger(year) || year < 1 || year > 9999) return null
  const y = String(year).padStart(4, '0')
  if (month === undefined) {
    return day === undefined ? { value: y, datatype: `${XSD}gYear` } : null
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) return null
  const m = String(month).padStart(2, '0')
  if (day === undefined) return { value: `${y}-${m}`, datatype: `${XSD}gYearMonth` }
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (!Number.isInteger(day) || day < 1 || day > days) return null
  return { value: `${y}-${m}-${String(day).padStart(2, '0')}`, datatype: `${XSD}date` }
}

/** The form input that gives these values again. */
export async function inputsOf(
  store: Store,
  slug: ProjectSlug,
  values: ResolvedValue[],
): Promise<ValueInput[]> {
  const found = await profile(store, slug)
  const fields = new Map((found?.fields ?? []).map((field) => [field.property, field]))
  return values.flatMap((value): ValueInput[] => {
    const { property, object } = value
    const field = fields.get(property)
    if ('own' in object) return [{ property, text: object.own.label }]
    if ('iri' in object) {
      if (field?.valueType === 'link') {
        return [
          {
            property,
            link: { href: object.iri, ...(value.text !== object.iri ? { label: value.text } : {}) },
          },
        ]
      }
      return [{ property, item: object.iri }]
    }
    if (
      object.datatype?.startsWith(XSD) &&
      /^(gYear|gYearMonth|date)$/.test(object.datatype.slice(XSD.length))
    ) {
      const [year, month, day] = object.literal.split('-').map(Number)
      return [{ property, date: { year, ...(month ? { month } : {}), ...(day ? { day } : {}) } }]
    }
    return [{ property, text: object.literal }]
  })
}
