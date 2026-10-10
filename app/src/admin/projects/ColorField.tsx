'use client'

// The colour picker field of one theme token (design/design-system.md §6.1): a swatch, the
// hex text, and the contrast against the colour that it sits on, live while the operator
// types. The stored value stays a text string, so the theme JSON and its validator do not
// change. The readout does not block Save: the widget does not check host values
// (CONTRACT.md §3.1, rule 6).

import { FieldDescription, FieldError, FieldLabel, useField, useFormFields } from '@payloadcms/ui'
import type { TextFieldClientComponent } from 'payload'

import { strings } from '../strings'
import { contrast, parseHex, readout } from '../ui/contrast'

const s = strings.colour

interface Contrast {
  need: 3 | 4.5
  against: { field: string; label: string; fallback: string }[]
}

/**
 * Any CSS colour as opaque #rrggbb, or null. A canvas reads the colour back as the browser
 * computes it; a colour that is not opaque, or not a colour, gives null.
 */
function toHex(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (parseHex(trimmed)) {
    const [r, g, b] = parseHex(trimmed)!
    return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`
  }
  if (typeof document === 'undefined') return null
  const context = document.createElement('canvas').getContext('2d')
  if (!context) return null
  context.fillStyle = '#010203'
  context.fillStyle = trimmed
  const read = String(context.fillStyle)
  // A value that the canvas refuses leaves the probe colour.
  if (read === '#010203' && trimmed.toLowerCase() !== '#010203') return null
  return parseHex(read) ? read : null
}

export const ColorField: TextFieldClientComponent = ({ field, path, readOnly }) => {
  const { value, setValue, showError, errorMessage } = useField<string>({ path })
  const custom = (field.admin?.custom ?? {}) as { fallback?: string; contrast?: Contrast | null }
  const fallback = custom.fallback ?? '#000000'
  const group = path.slice(0, path.lastIndexOf('.') + 1)
  // One string, so the field renders again only when a colour under it changes.
  const under = useFormFields(([fields]) =>
    JSON.stringify(
      (custom.contrast?.against ?? []).map((a) => fields[`${group}${a.field}`]?.value ?? ''),
    ),
  )
  const id = `field-${path.replace(/\./g, '__')}`
  const description = typeof field.admin?.description === 'string' ? field.admin.description : ''
  const typed = typeof value === 'string' ? value : ''
  const shown = typed.trim() ? toHex(typed) : toHex(fallback)

  // The lowest ratio over the colours under it: the one that decides.
  const pairs = (custom.contrast?.against ?? []).map((a, i) => {
    const raw = (JSON.parse(under) as unknown[])[i]
    const base = typeof raw === 'string' && raw.trim() ? toHex(raw) : toHex(a.fallback)
    return { label: a.label, base, ratio: shown && base ? contrast(shown, base) : null }
  })
  const worst = pairs.reduce<(typeof pairs)[number] | null>(
    (low, pair) => (low === null || (pair.ratio ?? 0) < (low.ratio ?? 0) ? pair : low),
    null,
  )
  const need = custom.contrast?.need ?? 4.5
  const result = worst ? readout(worst.ratio, need) : null

  return (
    <div className={`field-type text ao-field annoudio-colour${showError ? ' error' : ''}`}>
      <FieldLabel htmlFor={id} label={field.label} path={path} />
      <div className="field-type__wrap">
        <FieldError path={path} showError={showError} message={errorMessage} />
        <div className="ao-color">
          <input
            type="color"
            aria-label={s.swatch(String(field.label ?? ''))}
            value={shown ?? '#000000'}
            disabled={readOnly}
            onChange={(event) => setValue(event.target.value)}
          />
          <input
            id={id}
            name={path}
            type="text"
            className="ao-input"
            autoComplete="off"
            spellCheck={false}
            value={typed}
            placeholder={fallback}
            disabled={readOnly}
            aria-invalid={showError ? true : undefined}
            aria-describedby={`${id}-help ${id}-contrast`}
            onChange={(event) => setValue(event.target.value)}
          />
          <p
            id={`${id}-contrast`}
            className="ao-contrast"
            role="status"
            data-pass={result ? result.pass : undefined}
          >
            {worst &&
              (result === null ? (
                s.unmeasured
              ) : (
                <>
                  <span
                    className="ao-contrast__swatch"
                    aria-hidden="true"
                    style={{ background: worst.base ?? undefined }}
                  >
                    {/* The colour on the colour under it, as a bar: no text, so the sample
                        itself is not text that must pass 4.5:1. */}
                    <span className="ao-contrast__mark" style={{ background: shown ?? undefined }} />
                  </span>
                  <span>
                    {result.pass
                      ? s.passes(result.ratio, worst.label, need)
                      : s.fails(result.ratio, worst.label, need)}
                  </span>
                </>
              ))}
          </p>
          {!typed.trim() && <p className="ao-color__default">{s.default(fallback)}</p>}
          {typed.trim() && !shown && <p className="ao-color__default">{s.notAColour}</p>}
        </div>
      </div>
      <div id={`${id}-help`}>
        {description && <FieldDescription description={description} path={path} />}
      </div>
    </div>
  )
}
