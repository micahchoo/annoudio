'use client'

// The client part of the Vocabulary tab (O10v, design/vocab.md §8): the list of questions
// with Move up / Move down and Edit, and one native <dialog> for "Add a question" (common
// questions, Advanced: from an ontology, Your own question) and for "Edit: {question}".
// No <form>: the tab is inside Payload's document form (phase5-notes.md decision 13).

import { toast } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState, useTransition } from 'react'

import type {
  Field,
  FieldPatch,
  Iri,
  ListKind,
  ShowAs,
  Term,
  ValueType,
} from '@/modules/vocabulary'

import { strings } from '../strings'
import { Icon } from '../ui/Icon'

import {
  addQuestion,
  addQuestionList,
  moveQuestion,
  removeQuestion,
  searchProperties,
  updateQuestion,
} from './actions'
import { CLASSES } from './classes'

const s = strings.questions
type ErrorKey = keyof typeof s.errors

export interface EditorData {
  project: string
  fields: Field[]
  lists: { key: string; label: string; kind: ListKind; size: number }[]
  catalogue: { key: string; label: string; asked: boolean }[]
  ontologies: { label: string; prefix: string; namespace: string }[]
  /** The Annotate page of the first recording, or null with no recording. */
  phone: string | null
}

const KINDS: ValueType[] = ['text', 'date', 'number', 'link', 'list', 'entity']
const listKindOf = (kind: ValueType): ListKind | null =>
  kind === 'list' ? 'items' : kind === 'entity' ? 'entities' : null

/** One line under the label: kind or list, count, own answers, required, widget display. */
function summary(field: Field): string {
  const parts = [field.list ? s.fromList(field.list.label) : s.kinds[field.valueType]]
  if (field.max > 1) parts.push(s.upTo(field.max))
  if (field.allowOwn && field.list) parts.push(s.own)
  parts.push(field.required ? s.required : s.optional)
  if (field.showAs === 'tags') parts.push(s.asTags)
  if (field.showAs === 'none') parts.push(s.notShown)
  return parts.join(' · ')
}

type Mode =
  { kind: 'add' } | { kind: 'edit'; field: Field } | { kind: 'term'; term: Term } | { kind: 'own' }

export function QuestionsEditor({ data }: { data: EditorData }) {
  const router = useRouter()
  const dialog = useRef<HTMLDialogElement>(null)
  const [mode, setMode] = useState<Mode | null>(null)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const open = (next: Mode) => {
    setError(null)
    setMode(next)
    if (!dialog.current?.open) dialog.current?.showModal()
  }
  const close = () => {
    dialog.current?.close()
    setMode(null)
  }
  const run = (
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
    done: string,
    keepOpen = false,
  ) =>
    start(async () => {
      setError(null)
      const result = await action()
      if (!result.ok) return setError(s.errors[result.error as ErrorKey] ?? result.error)
      toast.success(done)
      if (!keepOpen) close()
      router.refresh()
    })

  const { fields } = data
  return (
    <>
      {fields.length === 0 ? (
        <div className="ao-empty">
          <p>{s.none}</p>
        </div>
      ) : (
        <ol className="ao-list annoudio-questions__list">
          {fields.map((field, i) => (
            <li key={field.property} className="ao-row" data-question={field.label}>
              <span className="ao-row__title">
                {field.label}
                {field.hidden && (
                  <span className="ao-badge annoudio-questions__hidden">{s.hiddenBadge}</span>
                )}
              </span>
              <span className="ao-row__meta">
                <code className="annoudio-questions__curie">{field.curie}</code>
                <span>{summary(field)}</span>
                <span className="ao-chip">
                  <span className="ao-chip__label">{s.stories(field.usage)}</span>
                </span>
              </span>
              <span className="ao-row__end">
                <button
                  type="button"
                  className="ao-btn ao-btn--quiet"
                  disabled={pending || i === 0}
                  aria-label={s.moveUpLabel(field.label)}
                  onClick={() =>
                    run(() => moveQuestion(data.project, field.property, i), s.form.saved)
                  }
                >
                  {s.moveUp}
                </button>
                <button
                  type="button"
                  className="ao-btn ao-btn--quiet"
                  disabled={pending || i === fields.length - 1}
                  aria-label={s.moveDownLabel(field.label)}
                  onClick={() =>
                    run(() => moveQuestion(data.project, field.property, i + 2), s.form.saved)
                  }
                >
                  {s.moveDown}
                </button>
                <button
                  type="button"
                  className="ao-btn"
                  aria-label={s.editLabel(field.label)}
                  onClick={() => open({ kind: 'edit', field })}
                >
                  {s.edit}
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="ao-actions">
        <button
          type="button"
          className="ao-btn ao-btn--primary"
          onClick={() => open({ kind: 'add' })}
        >
          {s.add}
        </button>
        {data.phone ? (
          <a className="ao-btn" href={data.phone} target="_blank" rel="noreferrer">
            {s.phone}
          </a>
        ) : (
          <span className="ao-field__help">{s.noRecording}</span>
        )}
      </p>
      <dialog
        ref={dialog}
        className="ao-dialog"
        onClose={() => setMode(null)}
        aria-labelledby="annoudio-question-dialog"
      >
        {mode && (
          <div className="ao-dialog__body">
            {mode.kind === 'add' ? (
              <AddPanel
                data={data}
                pending={pending}
                onCatalogue={(key) =>
                  run(() => addQuestion(data.project, { from: 'catalogue', key }), s.dialog.added)
                }
                onTerm={(term) => open({ kind: 'term', term })}
                onOwn={() => open({ kind: 'own' })}
              />
            ) : (
              <EditPanel
                key={mode.kind === 'edit' ? mode.field.property : mode.kind}
                data={data}
                mode={mode}
                pending={pending}
                run={run}
              />
            )}
            {error && (
              <p role="alert" className="ao-field__error">
                {error}
              </p>
            )}
            <p className="ao-actions">
              <button type="button" className="ao-btn" onClick={close}>
                {s.dialog.cancel}
              </button>
            </p>
          </div>
        )}
      </dialog>
    </>
  )
}

/** "Add a question": the catalogue, a search over the loaded ontologies, an own question. */
function AddPanel(props: {
  data: EditorData
  pending: boolean
  onCatalogue: (key: string) => void
  onTerm: (term: Term) => void
  onOwn: () => void
}) {
  const { data } = props
  const searchId = useId()
  const ontologyId = useId()
  const [text, setText] = useState('')
  const [ontology, setOntology] = useState('')
  const [found, setFound] = useState<Term[] | null>(null)
  // Fewer than two letters: no search, no list.
  const terms = text.trim().length < 2 ? null : found
  useEffect(() => {
    if (text.trim().length < 2) return
    let live = true
    const timer = setTimeout(async () => {
      const result = await searchProperties(data.project, text, ontology)
      if (live) setFound(result)
    }, 250)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [text, ontology, data.project])
  return (
    <>
      <h2 id="annoudio-question-dialog">{s.dialog.heading}</h2>
      <p className="ao-field__help">{s.dialog.help}</p>
      <section aria-labelledby={`${searchId}-common`} className="ao-field">
        <h3 id={`${searchId}-common`} className="ao-label">
          {s.dialog.common}
        </h3>
        <ul className="ao-chips annoudio-questions__catalogue">
          {data.catalogue.map((entry) => (
            <li key={entry.key}>
              <button
                type="button"
                className="ao-btn"
                disabled={props.pending || entry.asked}
                onClick={() => props.onCatalogue(entry.key)}
              >
                {entry.label}
                {entry.asked && <span> ✓ {s.dialog.asked}</span>}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <details className="ao-field">
        <summary className="ao-label">{s.dialog.advanced}</summary>
        <div className="ao-row-2">
          <div className="ao-field">
            <label htmlFor={searchId}>{s.dialog.search}</label>
            <input
              id={searchId}
              className="ao-input"
              type="search"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </div>
          <div className="ao-field">
            <label htmlFor={ontologyId}>{s.dialog.ontology}</label>
            <span className="ao-select">
              <select
                id={ontologyId}
                value={ontology}
                onChange={(event) => setOntology(event.target.value)}
              >
                <option value="">{s.dialog.allOntologies}</option>
                {data.ontologies.map((o) => (
                  <option key={o.namespace} value={o.prefix}>
                    {o.label} ({o.prefix})
                  </option>
                ))}
              </select>
              <Icon name="chevron" />
            </span>
          </div>
        </div>
        {terms !== null &&
          (terms.length === 0 ? (
            <p className="ao-field__help" role="status">
              {s.dialog.noTerms}
            </p>
          ) : (
            <ul className="ao-list" aria-live="polite">
              {terms.map((term) => (
                <li key={term.iri} className="ao-row">
                  <span className="ao-row__title">{term.label}</span>
                  <span className="ao-row__meta">
                    <code>{term.curie}</code>
                    <span>{term.ontology.label}</span>
                    {term.comment && <span>{term.comment}</span>}
                  </span>
                  <span className="ao-row__end">
                    <button
                      type="button"
                      className="ao-btn"
                      aria-label={s.dialog.chooseLabel(term.label)}
                      onClick={() => props.onTerm(term)}
                    >
                      {s.dialog.choose}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ))}
        <p>
          <button
            type="button"
            className="ao-btn ao-btn--quiet"
            onClick={(event) => {
              // The upload is in "For other systems", below the list.
              event.currentTarget.closest('dialog')?.close()
              const panel = document.getElementById(
                'annoudio-other-systems',
              ) as HTMLDetailsElement | null
              if (panel) {
                panel.open = true
                panel.scrollIntoView({ block: 'start' })
                panel.querySelector<HTMLInputElement>('input[type="file"]')?.focus()
              }
            }}
          >
            {s.dialog.loadFile}
          </button>
        </p>
      </details>
      <section aria-labelledby={`${searchId}-own`} className="ao-field">
        <h3 id={`${searchId}-own`} className="ao-label">
          {s.dialog.own}
        </h3>
        <p>
          <button type="button" className="ao-btn" onClick={props.onOwn}>
            {s.dialog.writeNew}
          </button>
        </p>
      </section>
    </>
  )
}

/** "Edit: {question}", and the last step of "from an ontology" and "Your own question". */
function EditPanel(props: {
  data: EditorData
  mode: Exclude<Mode, { kind: 'add' }>
  pending: boolean
  run: (
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
    done: string,
    keepOpen?: boolean,
  ) => void
}) {
  const { data, mode, pending, run } = props
  const field = mode.kind === 'edit' ? mode.field : null
  const id = useId()
  const locked = (field?.usage ?? 0) > 0
  const [label, setLabel] = useState(field?.label ?? (mode.kind === 'term' ? mode.term.label : ''))
  const [help, setHelp] = useState(field?.help ?? '')
  const [kind, setKind] = useState<ValueType>(field?.valueType ?? 'text')
  const [list, setList] = useState(field?.list?.key ?? '')
  const [newList, setNewList] = useState('')
  const [listClass, setListClass] = useState<string>(CLASSES[0].iri)
  const [max, setMax] = useState(String(field?.max ?? 1))
  const [allowOwn, setAllowOwn] = useState(field?.allowOwn ?? false)
  const [required, setRequired] = useState(field?.required ?? false)
  const [showAs, setShowAs] = useState<ShowAs>(field?.showAs ?? 'line')
  const listKind = listKindOf(kind)
  const fitting = data.lists.filter((l) => l.kind === listKind)
  const heading = field
    ? s.form.heading(field.label)
    : mode.kind === 'term'
      ? s.form.heading(mode.term.label)
      : s.form.newHeading

  /** The key of the chosen list, after it makes a new list when the operator asked for one. */
  const listKey = async (): Promise<string | null | { error: string }> => {
    if (!listKind) return null
    if (list !== '__new') return list || { error: 'bad-list' }
    const made = await addQuestionList(data.project, {
      label: newList,
      kind: listKind,
      ...(listKind === 'entities' ? { class: listClass } : {}),
    })
    return made.ok ? made.key : { error: made.error }
  }

  const save = () =>
    run(
      async () => {
        const key = await listKey()
        if (key && typeof key === 'object') return { ok: false, error: key.error }
        if (field) {
          const patch: FieldPatch = {
            label,
            help,
            required,
            max: Number(max),
            showAs,
            allowOwn,
            ...(locked ? {} : { valueType: kind, ...(key ? { list: key } : {}) }),
          }
          return updateQuestion(data.project, field.property, patch)
        }
        const spec =
          mode.kind === 'term'
            ? {
                from: 'term' as const,
                property: mode.term.iri,
                label,
                help,
                valueType: kind,
                ...(key ? { list: key } : {}),
              }
            : { from: 'own' as const, label, help, valueType: kind, ...(key ? { list: key } : {}) }
        const added = await addQuestion(data.project, spec)
        if (!added.ok) return added
        // The rest of the settings: the same call as an edit.
        return updateQuestion(data.project, added.field.property, {
          required,
          max: Number(max),
          showAs,
          allowOwn,
        })
      },
      field ? s.form.saved : s.dialog.added,
    )

  const toggleHidden = (hidden: boolean) =>
    run(() => updateQuestion(data.project, field!.property, { hidden }), s.form.saved)

  return (
    <>
      <h2 id="annoudio-question-dialog">{heading}</h2>
      <p className="ao-field__help">{s.form.help}</p>
      <div className="ao-form">
        <div className="ao-field">
          <label htmlFor={`${id}-label`}>{s.form.label}</label>
          <p id={`${id}-label-help`} className="ao-field__help">
            {s.form.labelHelp}
          </p>
          <input
            id={`${id}-label`}
            className="ao-input"
            value={label}
            aria-describedby={`${id}-label-help`}
            onChange={(event) => setLabel(event.target.value)}
          />
        </div>
        <div className="ao-field">
          <label htmlFor={`${id}-help`}>{s.form.helpField}</label>
          <p id={`${id}-help-help`} className="ao-field__help">
            {s.form.helpHelp}
          </p>
          <input
            id={`${id}-help`}
            className="ao-input"
            value={help}
            aria-describedby={`${id}-help-help`}
            onChange={(event) => setHelp(event.target.value)}
          />
        </div>
        <div className="ao-field">
          <label htmlFor={`${id}-kind`}>{s.form.kind}</label>
          <p id={`${id}-kind-help`} className="ao-field__help">
            {s.form.kindHelp}
          </p>
          <span className="ao-select">
            <select
              id={`${id}-kind`}
              value={kind}
              disabled={locked}
              aria-describedby={`${id}-kind-help`}
              onChange={(event) => {
                setKind(event.target.value as typeof kind)
                setList('')
              }}
            >
              {KINDS.map((one) => (
                <option key={one} value={one}>
                  {s.kinds[one]}
                </option>
              ))}
            </select>
            <Icon name="chevron" />
          </span>
        </div>
        {listKind && (
          <div className="ao-field">
            <label htmlFor={`${id}-list`}>{s.form.list}</label>
            <p id={`${id}-list-help`} className="ao-field__help">
              {s.form.listHelp}
            </p>
            <span className="ao-select">
              <select
                id={`${id}-list`}
                value={list}
                disabled={locked}
                aria-describedby={`${id}-list-help`}
                onChange={(event) => setList(event.target.value)}
              >
                <option value="">{s.form.noList}</option>
                {fitting.map((l) => (
                  <option key={l.key} value={l.key}>
                    {l.label}
                  </option>
                ))}
                <option value="__new">{s.form.newList}</option>
              </select>
              <Icon name="chevron" />
            </span>
            {list === '__new' && (
              <>
                <label htmlFor={`${id}-new-list`}>{s.form.newListName}</label>
                <p className="ao-field__help">{s.form.newListHelp}</p>
                <input
                  id={`${id}-new-list`}
                  className="ao-input"
                  value={newList}
                  onChange={(event) => setNewList(event.target.value)}
                />
                {listKind === 'entities' && (
                  <span className="ao-select">
                    <select
                      aria-label={s.form.list}
                      value={listClass}
                      onChange={(event) => setListClass(event.target.value)}
                    >
                      {CLASSES.map((c) => (
                        <option key={c.iri} value={c.iri}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <Icon name="chevron" />
                  </span>
                )}
              </>
            )}
          </div>
        )}
        <div className="ao-field">
          <label htmlFor={`${id}-max`}>{s.form.max}</label>
          <p id={`${id}-max-help`} className="ao-field__help">
            {s.form.maxHelp}
          </p>
          <input
            id={`${id}-max`}
            className="ao-input annoudio-questions__max"
            inputMode="numeric"
            value={max}
            aria-describedby={`${id}-max-help`}
            onChange={(event) => setMax(event.target.value)}
          />
        </div>
        {listKind && (
          <Check
            id={`${id}-own`}
            label={s.form.own}
            help={s.form.ownHelp}
            checked={allowOwn}
            onChange={setAllowOwn}
          />
        )}
        <Check
          id={`${id}-required`}
          label={s.form.required}
          help={s.form.requiredHelp}
          checked={required}
          onChange={setRequired}
        />
        <div className="ao-field">
          <label htmlFor={`${id}-show`}>{s.form.showAs}</label>
          <span className="ao-select">
            <select
              id={`${id}-show`}
              value={showAs}
              onChange={(event) => setShowAs(event.target.value as typeof showAs)}
            >
              {(['line', 'tags', 'none'] as const).map((one) => (
                <option key={one} value={one}>
                  {s.form.showAsOptions[one]}
                </option>
              ))}
            </select>
            <Icon name="chevron" />
          </span>
          {showAs === 'none' && <p className="ao-field__help">{s.form.showAsNone}</p>}
        </div>
        {field && locked && <p className="annoudio-questions__lock">{s.form.inUse(field.usage)}</p>}
        <p className="ao-field__help">
          {field
            ? field.curie.startsWith('http')
              ? s.form.address(field.property)
              : s.form.savedAs(field.curie, ontologyOf(data, field.property))
            : mode.kind === 'term'
              ? s.form.savedAs(mode.term.curie, mode.term.ontology.label)
              : s.form.ownAddress}
        </p>
        <p className="ao-actions">
          <button
            type="button"
            className="ao-btn ao-btn--primary"
            disabled={pending}
            onClick={save}
          >
            {field ? s.form.save : s.form.add}
          </button>
          {field && (
            <button
              type="button"
              className="ao-btn"
              disabled={pending}
              onClick={() => toggleHidden(!field.hidden)}
            >
              {field.hidden ? s.form.show : s.form.hide}
            </button>
          )}
          {field && !locked && (
            <button
              type="button"
              className="ao-btn ao-btn--danger"
              disabled={pending}
              onClick={() =>
                run(() => removeQuestion(data.project, field.property), s.form.removed)
              }
            >
              {s.form.remove}
            </button>
          )}
        </p>
      </div>
    </>
  )
}

function ontologyOf(data: EditorData, property: Iri): string {
  return data.ontologies.find((o) => property.startsWith(o.namespace))?.label ?? ''
}

function Check(props: {
  id: string
  label: string
  help: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="ao-field annoudio-questions__check">
      <label htmlFor={props.id}>
        <input
          id={props.id}
          type="checkbox"
          checked={props.checked}
          aria-describedby={`${props.id}-help`}
          onChange={(event) => props.onChange(event.target.checked)}
        />{' '}
        {props.label}
      </label>
      <p id={`${props.id}-help`} className="ao-field__help">
        {props.help}
      </p>
    </div>
  )
}
