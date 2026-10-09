'use client'

// The duration probe of the catalogue (design/phase5-notes.md, decision 1). The browser
// loads the metadata of the audio address in an <audio> element and reads its duration.
// So the operator never types a duration, and sees at once whether the audio plays in a
// browser. The recording page and "Put a recording on a site" use it.

import { useEffect, useState } from 'react'

const WAIT_MS = 600

export type Probe =
  | { state: 'none' }
  | { state: 'probing' }
  | { state: 'plays'; seconds: number }
  | { state: 'cannot' }

/** The probe of an audio address. It starts when the operator stops typing. */
export function useAudioProbe(value: string): Probe {
  const address = value.trim()
  const valid = /^https?:\/\/\S+$/.test(address)
  // The result of the last probe, for the address that it probed.
  const [result, setResult] = useState<{ address: string; probe: Probe } | null>(null)

  useEffect(() => {
    if (!valid) return
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      const seconds = audio.duration
      setResult({
        address,
        probe:
          Number.isFinite(seconds) && seconds > 0
            ? { state: 'plays', seconds: Number(seconds.toFixed(3)) }
            : { state: 'cannot' },
      })
    }
    audio.onerror = () => setResult({ address, probe: { state: 'cannot' } })
    const timer = setTimeout(() => {
      audio.src = address
    }, WAIT_MS)
    return () => {
      clearTimeout(timer)
      audio.onloadedmetadata = null
      audio.onerror = null
      audio.removeAttribute('src')
      audio.load()
    }
  }, [address, valid])

  if (!valid) return { state: 'none' }
  return result?.address === address ? result.probe : { state: 'probing' }
}
