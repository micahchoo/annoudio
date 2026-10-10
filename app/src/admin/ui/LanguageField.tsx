'use client'

// The language of the stories: a text field with the common tags as a native list of
// choices (<datalist>). A language tag has no closed set, so the operator can still type a
// different tag; the field validator of the collection checks nothing more than before.

import { FieldDescription, FieldError, FieldLabel, useField } from '@payloadcms/ui'
import type { TextFieldClientComponent } from 'payload'

/** Tags with their English names. The first ones are the languages of the pilot sites. */
const LANGUAGES: [string, string][] = [
  ['en', 'English'],
  ['ml', 'Malayalam'],
  ['hi', 'Hindi'],
  ['mr', 'Marathi'],
  ['kn', 'Kannada'],
  ['ta', 'Tamil'],
  ['te', 'Telugu'],
  ['bn', 'Bengali'],
  ['gu', 'Gujarati'],
  ['pa', 'Punjabi'],
  ['ur', 'Urdu'],
  ['ar', 'Arabic'],
  ['fr', 'French'],
  ['de', 'German'],
  ['es', 'Spanish'],
  ['pt', 'Portuguese'],
]

export const LanguageField: TextFieldClientComponent = ({ field, path, readOnly }) => {
  const { value, setValue, showError, errorMessage } = useField<string>({ path })
  const id = `field-${path.replace(/\./g, '__')}`
  const description = typeof field.admin?.description === 'string' ? field.admin.description : ''
  const placeholder = typeof field.admin?.placeholder === 'string' ? field.admin.placeholder : ''
  return (
    <div className={`field-type text ao-field${showError ? ' error' : ''}`}>
      <FieldLabel htmlFor={id} label={field.label} path={path} />
      <div className="field-type__wrap">
        <FieldError path={path} showError={showError} message={errorMessage} />
        <input
          id={id}
          name={path}
          type="text"
          list={`${id}-tags`}
          autoComplete="off"
          spellCheck={false}
          value={value ?? ''}
          placeholder={placeholder}
          disabled={readOnly}
          aria-describedby={description ? `${id}-help` : undefined}
          onChange={(event) => setValue(event.target.value)}
        />
        <datalist id={`${id}-tags`}>
          {LANGUAGES.map(([tag, name]) => (
            <option key={tag} value={tag}>
              {name}
            </option>
          ))}
        </datalist>
      </div>
      {description && (
        <div id={`${id}-help`}>
          <FieldDescription description={description} path={path} />
        </div>
      )}
    </div>
  )
}
