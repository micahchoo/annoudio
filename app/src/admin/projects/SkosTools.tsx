'use client'

import { Button, toast } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { useId, useState, useTransition } from 'react'

import type { ImportReport, SkosFormat } from '@/modules/vocabulary'

import { strings } from '../strings'

import { downloadSkos, uploadSkos } from './actions'

const s = strings.vocabulary

type Errors = keyof typeof s.errors

/** `maxBytes`: the largest file that `importSkos` takes (IMPORT_LIMITS). */
export function SkosTools({ project, maxBytes }: { project: string; maxBytes: number }) {
  const router = useRouter()
  const inputId = useId()
  const [pending, startTransition] = useTransition()
  const [file, setFile] = useState<{ text: string; report: ImportReport } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const download = (format: SkosFormat) =>
    startTransition(async () => {
      const result = await downloadSkos(project, format)
      if ('error' in result) return setError(s.errors[result.error])
      const link = document.createElement('a')
      link.href = URL.createObjectURL(new Blob([result.body], { type: result.contentType }))
      link.download = result.filename
      link.click()
      URL.revokeObjectURL(link.href)
    })

  const send = (text: string, apply: boolean) =>
    startTransition(async () => {
      setError(null)
      const result = await uploadSkos(project, text, apply)
      if (!result.ok) {
        setFile(null)
        return setError(s.errors[result.error as Errors])
      }
      if (!apply) return setFile({ text, report: result.report })
      setFile(null)
      toast.success(s.applied)
      router.refresh()
    })

  const choose = async (chosen: File | undefined) => {
    setFile(null)
    setError(null)
    if (!chosen) return
    if (chosen.size > maxBytes) return setError(s.errors['too-large'])
    send(await chosen.text(), false)
  }

  return (
    <div className="annoudio-skos">
      <h3>{s.download}</h3>
      <p className="annoudio-skos__buttons">
        <Button
          buttonStyle="secondary"
          size="medium"
          disabled={pending}
          onClick={() => download('turtle')}
        >
          {s.turtle}
        </Button>
        <Button
          buttonStyle="secondary"
          size="medium"
          disabled={pending}
          onClick={() => download('json-ld')}
        >
          {s.jsonLd}
        </Button>
      </p>
      <h3>
        <label htmlFor={inputId}>{s.upload}</label>
      </h3>
      <p>{s.uploadIntro}</p>
      <input
        id={inputId}
        type="file"
        accept=".ttl,.jsonld,.json,text/turtle,application/ld+json"
        disabled={pending}
        onChange={(event) => choose(event.target.files?.[0])}
      />
      {error && (
        <p role="alert" className="annoudio-dialog__error">
          {error}
        </p>
      )}
      {file && <Preview report={file.report} />}
      {file && (
        <Button
          buttonStyle="primary"
          size="medium"
          disabled={pending}
          onClick={() => send(file.text, true)}
        >
          {s.apply}
        </Button>
      )}
    </div>
  )
}

function Preview({ report }: { report: ImportReport }) {
  return (
    <div role="status" className="annoudio-skos__preview">
      <p>{s.preview(report)}</p>
      {report.skipped.length > 0 && (
        <>
          <p>{s.skipped(report.skipped.length)}</p>
          <ul>
            {report.skipped.map((item) => (
              <li key={item.iri}>
                {item.iri}: {s.skipReasons[item.reason]}
              </li>
            ))}
          </ul>
        </>
      )}
      {report.ignoredParents.length > 0 && <p>{s.ignoredParents(report.ignoredParents.length)}</p>}
    </div>
  )
}
