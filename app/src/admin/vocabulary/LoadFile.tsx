'use client'

// "Load a vocabulary file" (Q5, design/vocab.md §6 and O10x): choose a file, read what it
// has (the preview writes nothing), tick what to load, then **Load these**. The file goes
// to `POST /api/ontologies/import` as the request body: a route handler, not a Server
// Action, so the 1 MiB Server Action limit does not apply. No <form>: this panel is inside
// Payload's document form on the project page.

import { toast } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { useId, useState, useTransition } from 'react'

import type { FileError, FileReport, FileResult, ImportChoice } from '@/modules/vocabulary'

import { strings } from '../strings'

const s = strings.loadFile
const LIMIT = 5_000_000

export function LoadFile({ project }: { project: string }) {
  const router = useRouter()
  const id = useId()
  const [pending, start] = useTransition()
  const [file, setFile] = useState<File | null>(null)
  const [report, setReport] = useState<FileReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ontology, setOntology] = useState(true)
  const [lists, setLists] = useState<string[]>([])
  const [form, setForm] = useState(true)
  const [names, setNames] = useState({ label: '', prefix: '' })

  const send = (chosen: File, apply: boolean, accept?: ImportChoice, given = names) =>
    start(async () => {
      setError(null)
      const query = new URLSearchParams({ name: chosen.name, project, apply: apply ? '1' : '0' })
      if (accept) query.set('accept', JSON.stringify(accept))
      if (given.label || given.prefix) query.set('names', JSON.stringify(given))
      let result: FileResult | { ok: false; error: 'forbidden' }
      try {
        const response = await fetch(`/api/ontologies/import?${query}`, {
          method: 'POST',
          body: chosen,
          credentials: 'same-origin',
        })
        result = await response.json()
      } catch {
        result = { ok: false, error: 'unreadable' }
      }
      if (!result.ok) {
        setError(s.errors[result.error as FileError | 'forbidden'])
        return
      }
      if (!apply) {
        setReport(result.report)
        setOntology(result.report.ontology !== null)
        setLists(result.report.lists.map((l) => l.iri))
        setForm(result.report.form !== null)
        if (result.report.ontology) {
          setNames({ label: result.report.ontology.label, prefix: result.report.ontology.prefix })
        }
        return
      }
      toast.success(s.loaded)
      setFile(null)
      setReport(null)
      router.refresh()
    })

  const choose = (chosen: File | undefined) => {
    setReport(null)
    setError(null)
    setNames({ label: '', prefix: '' })
    setFile(chosen ?? null)
    if (!chosen) return
    if (chosen.size > LIMIT) return setError(s.errors['too-large'])
    send(chosen, false, undefined, { label: '', prefix: '' })
  }

  const o = report?.ontology
  return (
    <section
      className="ao-field annoudio-load"
      aria-labelledby={`${id}-heading`}
      id="annoudio-load-file"
    >
      <h3 id={`${id}-heading`} className="ao-label">
        {s.heading}
      </h3>
      <p className="ao-field__help">{s.help}</p>
      <label htmlFor={`${id}-file`}>{s.file}</label>
      <p id={`${id}-file-help`} className="ao-field__help">
        {s.fileHelp}
      </p>
      <input
        id={`${id}-file`}
        type="file"
        accept=".ttl,.nt,.jsonld,.json,.rdf,.owl,.xml,text/turtle,application/ld+json,application/rdf+xml"
        aria-describedby={`${id}-file-help`}
        disabled={pending}
        onChange={(event) => choose(event.target.files?.[0])}
      />
      {pending && <p role="status">{s.reading}</p>}
      {error && (
        <p role="alert" className="ao-field__error">
          {error}
        </p>
      )}
      {report && file && (
        <div role="status" className="ao-card ao-card--sunken annoudio-load__preview">
          <p className="ao-label">{s.found}</p>
          {o && (
            <>
              <label className="annoudio-questions__check">
                <input
                  type="checkbox"
                  checked={ontology}
                  onChange={(event) => setOntology(event.target.checked)}
                />{' '}
                {s.ontology({
                  ...o,
                  label: names.label || o.label,
                  prefix: names.prefix || o.prefix,
                })}
              </label>
              {o.changes && <p className="ao-field__help">{s.changes(o.changes)}</p>}
              {ontology && (
                <div className="ao-row-2">
                  <div className="ao-field">
                    <label htmlFor={`${id}-name`}>{s.name}</label>
                    <input
                      id={`${id}-name`}
                      className="ao-input"
                      value={names.label}
                      onChange={(event) => setNames({ ...names, label: event.target.value })}
                    />
                  </div>
                  <div className="ao-field">
                    <label htmlFor={`${id}-prefix`}>{s.prefix}</label>
                    <input
                      id={`${id}-prefix`}
                      className="ao-input"
                      value={names.prefix}
                      aria-describedby={`${id}-prefix-help`}
                      onChange={(event) => setNames({ ...names, prefix: event.target.value })}
                    />
                    <p id={`${id}-prefix-help`} className="ao-field__help">
                      {s.prefixHelp}
                    </p>
                  </div>
                </div>
              )}
              {(o.leftOut.unlabelled > 0 || o.leftOut.outside > 0) && (
                <p className="ao-field__help">
                  {s.leftOutLabel} {s.leftOut(o.leftOut.unlabelled, o.leftOut.outside)}
                </p>
              )}
            </>
          )}
          {report.lists.map((list) => (
            <label key={list.iri} className="annoudio-questions__check">
              <input
                type="checkbox"
                checked={lists.includes(list.iri)}
                onChange={(event) =>
                  setLists((now) =>
                    event.target.checked
                      ? [...now, list.iri]
                      : now.filter((one) => one !== list.iri),
                  )
                }
              />{' '}
              {s.list(list)}
            </label>
          ))}
          {report.form && (
            <>
              <label className="annoudio-questions__check">
                <input
                  type="checkbox"
                  checked={form}
                  onChange={(event) => setForm(event.target.checked)}
                />{' '}
                {s.form(
                  report.form.label,
                  report.form.fields.filter((f) => f.status === 'new').length,
                )}
              </label>
              {report.form.fields.some((f) => f.status === 'known') && (
                <p className="ao-field__help">
                  {s.known(report.form.fields.filter((f) => f.status === 'known').length)}
                </p>
              )}
              {report.form.fields.some((f) => f.status === 'left-out') && (
                <p className="ao-field__help">
                  {s.leftOutLabel}{' '}
                  {report.form.fields
                    .filter((f) => f.status === 'left-out')
                    .map((f) => s.questionLeftOut(f.label, s.reasons[f.reason!]))
                    .join(', ')}
                </p>
              )}
            </>
          )}
          <p className="ao-actions">
            <button
              type="button"
              className="ao-btn ao-btn--primary"
              disabled={pending || (!ontology && lists.length === 0 && !form)}
              onClick={() => send(file, true, { ontology, lists, form })}
            >
              {s.load}
            </button>
          </p>
        </div>
      )}
    </section>
  )
}
