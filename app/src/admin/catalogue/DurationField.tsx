'use client'

// The length of a recording: the browser probes the audio address (useAudioProbe), and the
// field keeps the result. The operator never types it (walkthrough 32, 33).

import { FieldLabel, useField, useFormFields } from '@payloadcms/ui'
import type { NumberFieldClientComponent } from 'payload'
import { useEffect, useRef } from 'react'

import { clock } from '@/clock'

import { strings } from '../strings'

import { useAudioProbe } from './useAudioProbe'

const s = strings.recording

export const DurationField: NumberFieldClientComponent = ({ path, field }) => {
  const { value, setValue } = useField<number>({ path })
  const url = useFormFields(([fields]) => fields.url?.value)
  const probe = useAudioProbe(typeof url === 'string' ? url : '')
  // A probe that finds the stored length changes nothing, so opening a recording does not
  // mark the form as changed.
  const stored = useRef(value)
  useEffect(() => {
    stored.current = value
  }, [value])
  useEffect(() => {
    if (probe.state === 'plays' && stored.current !== probe.seconds) setValue(probe.seconds)
  }, [probe, setValue])

  const length = typeof value === 'number' ? clock(value) : s.unknown
  return (
    <div className="field-type annoudio-duration">
      <FieldLabel label={field.label} path={path} />
      <output className="annoudio-duration__value" aria-live="polite">
        {length}
      </output>
      <ProbeText probe={probe} />
    </div>
  )
}

/** What the probe says, as one status line. */
export function ProbeText({ probe }: { probe: ReturnType<typeof useAudioProbe> }) {
  return (
    <p className="annoudio-duration__probe" role="status">
      {probe.state === 'none' && s.noUrl}
      {probe.state === 'probing' && s.probing}
      {probe.state === 'plays' && s.plays(clock(probe.seconds))}
      {probe.state === 'cannot' && s.cannotPlay}
    </p>
  )
}
