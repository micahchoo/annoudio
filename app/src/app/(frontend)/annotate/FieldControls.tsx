'use client'

// The questions of the project below the story (design/vocab.md §7.1): one control per
// field, in field order. Every required question shows, then the first three others; the
// rest fold under "More questions (N)". A list of up to 8 items gives chips; a longer list
// gives a search box (ARIA 1.2 combobox). Members see only labels and help: never a
// property, an IRI or the word "field".
//
// Form entry names (actions.ts reads them): `item:<property>` (a chosen item, one entry
// each), `own:<property>` (an own answer), `text:<property>`, `year:`, `month:`, `day:`,
// `href:` and `linkLabel:` + `<property>`.

import { useEffect, useId, useMemo, useRef, useState } from 'react'

import type { ValueType } from '@/modules/vocabulary'

import { strings } from './strings'

const s = strings.questions

export interface FormChoice {
  iri: string
  label: string
  depth: number
}

/** One question as the form shows it. */
export interface FormQuestion {
  property: string
  label: string
  help?: string
  valueType: ValueType
  required: boolean
  max: number
  allowOwn: boolean
  /** The items of a list or entity question that members can choose. */
  choices?: FormChoice[]
}

/** The answer of a hidden question that this story has: shown, not changed. */
export interface KeptAnswer {
  label: string
  text: string
}

type ErrorCode = keyof typeof s.errors

interface Props {
  questions: FormQuestion[]
  /** The form entries to show: the stored answers, or the entries that the member sent. */
  answers: [string, string][]
  errors: { property: string; code: ErrorCode }[]
  kept: KeptAnswer[]
}

/** The questions that show before "More questions": every required one, then three others. */
function split(questions: FormQuestion[]): [FormQuestion[], FormQuestion[]] {
  let others = 0
  const shown = new Set<string>()
  for (const question of questions) {
    if (question.required) shown.add(question.property)
    else if (others < 3) {
      shown.add(question.property)
      others++
    }
  }
  return [
    questions.filter((q) => shown.has(q.property)),
    questions.filter((q) => !shown.has(q.property)),
  ]
}

export function FieldControls({ questions, answers, errors, kept }: Props) {
  const [shown, folded] = split(questions)
  const root = useRef<HTMLElement>(null)
  const errorOf = (property: string) => {
    const found = errors.find((e) => e.property === property)
    if (!found) return null
    const question = questions.find((q) => q.property === property)
    const message = s.errors[found.code]
    const text = typeof message === 'function' ? message(question?.max ?? 1) : message
    return `${question?.label ?? ''}: ${text}`
  }
  const foldedError = folded.some((q) => errorOf(q.property))
  // Errors name the label; focus goes to the first one (design/ia.md P9).
  useEffect(() => {
    if (errors.length === 0) return
    root.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [errors])
  if (questions.length === 0 && kept.length === 0) return null
  const control = (question: FormQuestion) => (
    <Question
      key={question.property}
      question={question}
      answers={answers}
      error={errorOf(question.property)}
    />
  )
  return (
    <section ref={root} className="questions ao-member" aria-labelledby="questions-heading">
      <h3 id="questions-heading">{s.heading}</h3>
      {shown.map(control)}
      {folded.length > 0 && (
        <details open={foldedError || undefined} className="questions__more">
          <summary>{s.more(folded.length)}</summary>
          {folded.map(control)}
        </details>
      )}
      {kept.map((answer, i) => (
        <div key={i} className="ao-field questions__kept">
          <p className="ao-label">{answer.label}</p>
          <p>{answer.text}</p>
          <p className="ao-field__help">{s.notAsked}</p>
        </div>
      ))}
    </section>
  )
}

const valuesOf = (answers: [string, string][], name: string) =>
  answers.filter(([key]) => key === name).map(([, value]) => value)

function Question(props: {
  question: FormQuestion
  answers: [string, string][]
  error: string | null
}) {
  const { question, answers, error } = props
  const id = useId()
  const helpId = `${id}-help`
  const errorId = `${id}-error`
  const described =
    [question.help ? helpId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined
  const label = (
    <>
      {question.label}
      {!question.required && <span className="questions__optional"> {s.optional}</span>}
    </>
  )
  const help = question.help ? (
    <p id={helpId} className="ao-field__help">
      {question.help}
    </p>
  ) : null
  const errorLine = error ? (
    <p id={errorId} className="ao-field__error">
      {error}
    </p>
  ) : null
  const invalid = error ? true : undefined
  const p = question.property

  switch (question.valueType) {
    case 'text':
    case 'number': {
      const number = question.valueType === 'number'
      return (
        <div className="ao-field">
          <label htmlFor={id}>{label}</label>
          {help}
          {number ? (
            <input
              id={id}
              className="ao-input"
              name={`text:${p}`}
              inputMode="decimal"
              autoComplete="off"
              defaultValue={valuesOf(answers, `text:${p}`)[0] ?? ''}
              aria-invalid={invalid}
              aria-describedby={described}
            />
          ) : (
            <textarea
              id={id}
              className="ao-input questions__text"
              name={`text:${p}`}
              rows={1}
              maxLength={500}
              defaultValue={valuesOf(answers, `text:${p}`)[0] ?? ''}
              aria-invalid={invalid}
              aria-describedby={described}
            />
          )}
          {errorLine}
        </div>
      )
    }
    case 'date':
      return (
        <fieldset className="ao-field" aria-describedby={described}>
          <legend>{label}</legend>
          {help}
          <div className="questions__date">
            <span>
              <label htmlFor={`${id}-y`}>{s.year}</label>
              <input
                id={`${id}-y`}
                className="ao-input"
                name={`year:${p}`}
                inputMode="numeric"
                autoComplete="off"
                size={4}
                maxLength={4}
                defaultValue={valuesOf(answers, `year:${p}`)[0] ?? ''}
                aria-invalid={invalid}
              />
            </span>
            <span className="ao-select">
              <label htmlFor={`${id}-m`}>{s.month}</label>
              <select
                id={`${id}-m`}
                name={`month:${p}`}
                defaultValue={valuesOf(answers, `month:${p}`)[0] ?? ''}
              >
                <option value="">{s.noMonth}</option>
                {s.months.map((month, i) => (
                  <option key={month} value={String(i + 1)}>
                    {month}
                  </option>
                ))}
              </select>
            </span>
            <span className="ao-select">
              <label htmlFor={`${id}-d`}>{s.day}</label>
              <select
                id={`${id}-d`}
                name={`day:${p}`}
                defaultValue={valuesOf(answers, `day:${p}`)[0] ?? ''}
              >
                <option value="">{s.noDay}</option>
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i} value={String(i + 1)}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </span>
          </div>
          {errorLine}
        </fieldset>
      )
    case 'link':
      return (
        <fieldset className="ao-field" aria-describedby={described}>
          <legend>{label}</legend>
          {help}
          <label htmlFor={`${id}-href`}>{s.address}</label>
          <input
            id={`${id}-href`}
            className="ao-input"
            type="url"
            inputMode="url"
            name={`href:${p}`}
            autoComplete="off"
            defaultValue={valuesOf(answers, `href:${p}`)[0] ?? ''}
            aria-invalid={invalid}
          />
          <label htmlFor={`${id}-label`}>{s.linkLabel}</label>
          <input
            id={`${id}-label`}
            className="ao-input"
            name={`linkLabel:${p}`}
            defaultValue={valuesOf(answers, `linkLabel:${p}`)[0] ?? ''}
          />
          {errorLine}
        </fieldset>
      )
    case 'list':
    case 'entity':
      return (question.choices?.length ?? 0) > 8 ? (
        <Search
          question={question}
          id={id}
          label={label}
          help={help}
          errorLine={errorLine}
          described={described}
          invalid={invalid}
          chosen={valuesOf(answers, `item:${p}`)}
          own={valuesOf(answers, `own:${p}`)[0] ?? ''}
        />
      ) : (
        <fieldset className="ao-field" aria-describedby={described}>
          <legend>{label}</legend>
          {help}
          <div className="ao-topics">
            {(question.choices ?? []).map((choice, i) => (
              <label key={choice.iri} className="ao-topic">
                <input
                  type={question.max === 1 ? 'radio' : 'checkbox'}
                  name={`item:${p}`}
                  value={choice.iri}
                  defaultChecked={valuesOf(answers, `item:${p}`).includes(choice.iri)}
                  aria-invalid={i === 0 ? invalid : undefined}
                />
                <span>{choice.label}</span>
              </label>
            ))}
          </div>
          {question.allowOwn && (
            <>
              <label htmlFor={`${id}-own`}>{s.ownLabel}</label>
              <input
                id={`${id}-own`}
                className="ao-input"
                name={`own:${p}`}
                autoComplete="off"
                defaultValue={valuesOf(answers, `own:${p}`)[0] ?? ''}
              />
            </>
          )}
          {errorLine}
        </fieldset>
      )
  }
}

/** A search box over the labels of a long list: an ARIA 1.2 combobox with a listbox. */
function Search(props: {
  question: FormQuestion
  id: string
  label: React.ReactNode
  help: React.ReactNode
  errorLine: React.ReactNode
  described?: string
  invalid?: true
  chosen: string[]
  own: string
}) {
  const { question, id } = props
  const p = question.property
  const choices = question.choices ?? []
  const [chosen, setChosen] = useState(props.chosen)
  const [text, setText] = useState(props.own)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listId = `${id}-list`
  const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const matches = useMemo(
    () =>
      words.length === 0
        ? []
        : choices
            .filter((c) => !chosen.includes(c.iri))
            .filter((c) => words.every((w) => c.label.toLowerCase().includes(w)))
            .slice(0, 20),
    // `words` comes from `text`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, chosen, choices],
  )
  const exact = choices.find((c) => c.label.toLowerCase() === text.trim().toLowerCase())
  const choose = (iri: string) => {
    setChosen((now) => (question.max === 1 ? [iri] : [...now, iri]))
    setText('')
    setOpen(false)
  }
  const labelOf = (iri: string) => choices.find((c) => c.iri === iri)?.label ?? iri
  const ownNote = question.allowOwn && text.trim() && !exact
  return (
    <div className="ao-field">
      <label htmlFor={id}>{props.label}</label>
      {props.help}
      {chosen.length > 0 && (
        <ul className="ao-topics questions__chosen">
          {chosen.map((iri) => (
            <li key={iri} className="questions__chip">
              <input type="hidden" name={`item:${p}`} value={iri} />
              <span>{labelOf(iri)}</span>
              <button
                type="button"
                aria-label={s.remove(labelOf(iri))}
                onClick={() => setChosen((now) => now.filter((one) => one !== iri))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="questions__combo">
        <input
          id={id}
          className="ao-input"
          role="combobox"
          aria-expanded={open && matches.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[active] ? `${listId}-${active}` : undefined}
          aria-invalid={props.invalid}
          aria-describedby={
            [props.described, ownNote ? `${id}-own` : ''].filter(Boolean).join(' ') || undefined
          }
          autoComplete="off"
          // Without JavaScript, or for an own answer, the typed text is sent as it is.
          name={question.allowOwn ? `own:${p}` : undefined}
          placeholder={s.search}
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            setOpen(true)
            setActive(0)
          }}
          onBlur={() => {
            // A text that is exactly the label of an item is that item.
            if (exact && !chosen.includes(exact.iri)) choose(exact.iri)
            setTimeout(() => setOpen(false), 150)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setOpen(true)
              setActive((n) => Math.min(n + 1, Math.max(matches.length - 1, 0)))
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActive((n) => Math.max(n - 1, 0))
            } else if (event.key === 'Enter' && open && matches[active]) {
              event.preventDefault()
              choose(matches[active].iri)
            } else if (event.key === 'Escape') {
              setOpen(false)
            }
          }}
        />
        <ul
          id={listId}
          role="listbox"
          className="questions__list"
          hidden={!open || matches.length === 0}
        >
          {matches.map((choice, i) => (
            <li
              key={choice.iri}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(event) => {
                event.preventDefault()
                choose(choice.iri)
              }}
            >
              {choice.label}
            </li>
          ))}
        </ul>
      </div>
      <p id={`${id}-own`} className="ao-field__help" aria-live="polite">
        {ownNote
          ? `${s.notInList} ${s.ownAnswer(text.trim())}`
          : open && words.length > 0 && matches.length === 0 && !question.allowOwn
            ? s.noMatch
            : ''}
      </p>
      {props.errorLine}
    </div>
  )
}
