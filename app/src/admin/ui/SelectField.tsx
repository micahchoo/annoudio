'use client'

// A Payload `select` or `radio` field as one native <select> (design/design-system.md §5,
// Dropdown). The stored value does not change: the field keeps its type and its options.
// Label, help and error come from Payload's own parts, so the field lines up with the others.

import { FieldDescription, FieldError, FieldLabel, useField } from '@payloadcms/ui'
import type { RadioFieldClientProps, SelectFieldClientProps } from 'payload'

import { Icon } from './Icon'

type Option = string | { label: unknown; value: string }

const labelOf = (option: Option) =>
  typeof option === 'string'
    ? option
    : typeof option.label === 'string'
      ? option.label
      : option.value
const valueOf = (option: Option) => (typeof option === 'string' ? option : option.value)

export function SelectField(props: SelectFieldClientProps | RadioFieldClientProps) {
  const { field, path, readOnly } = props
  const { value, setValue, showError, errorMessage } = useField<string | null>({ path })
  const id = `field-${path.replace(/\./g, '__')}`
  const options = (field.options ?? []) as Option[]
  const description = typeof field.admin?.description === 'string' ? field.admin.description : ''
  const required = field.required === true
  // A radio always has a choice: a row made before the field existed has no value, and its
  // modules read that as the first option. A select can be empty.
  const radio = field.type === 'radio'
  const current = value ?? (radio && options[0] ? valueOf(options[0]) : '')
  return (
    <div className={`field-type select ao-field${showError ? ' error' : ''}`}>
      <FieldLabel htmlFor={id} label={field.label} path={path} required={required} />
      <div className="field-type__wrap">
        <FieldError path={path} showError={showError} message={errorMessage} />
        <span className="ao-select">
          <select
            id={id}
            name={path}
            value={current}
            disabled={readOnly}
            aria-invalid={showError ? true : undefined}
            aria-describedby={description ? `${id}-help` : undefined}
            onChange={(event) => setValue(event.target.value === '' ? null : event.target.value)}
          >
            {!radio && !required && !current && <option value="">—</option>}
            {options.map((option) => (
              <option key={valueOf(option)} value={valueOf(option)}>
                {labelOf(option)}
              </option>
            ))}
          </select>
          <Icon name="chevron" />
        </span>
      </div>
      {description && (
        <div id={`${id}-help`}>
          <FieldDescription description={description} path={path} />
        </div>
      )}
    </div>
  )
}
